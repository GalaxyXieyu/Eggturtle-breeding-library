import fs from 'fs';
import path from 'path';

const DEFAULT_ROOTS = ['apps/web', 'apps/admin'];
const EXTENSIONS = new Set(['.ts', '.tsx']);
const IGNORE_DIRS = new Set(['node_modules', '.next', '.next-dev', 'dist', 'out', '.git']);
const IGNORE_SUFFIXES = ['.d.ts'];
const FROM_RE = /\bfrom\s*(['"])(\.{1,2}\/[^'"\n]+)\1/g;
const DYNAMIC_IMPORT_RE = /\bimport\(\s*(['"])(\.{1,2}\/[^'"\n]+)\1\s*\)/g;
const REQUIRE_RE = /\brequire\(\s*(['"])(\.{1,2}\/[^'"\n]+)\1\s*\)/g;

function parseArgs(argv) {
  const rootsArg = argv.find((arg) => arg.startsWith('--roots='));
  const reportArg = argv.find((arg) => arg.startsWith('--report='));
  return {
    write: argv.includes('--write'),
    includeLocal: argv.includes('--include-local'),
    roots: rootsArg ? rootsArg.replace('--roots=', '').split(',').filter(Boolean) : DEFAULT_ROOTS,
    report: reportArg ? reportArg.replace('--report=', '') : null
  };
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
      continue;
    }
    if (!entry.isFile()) continue;
    if (IGNORE_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))) continue;
    if (!EXTENSIONS.has(path.extname(entry.name))) continue;
    files.push(full);
  }
  return files;
}

function normalizePath(value) {
  return value.split(path.sep).join('/');
}

function toAliasSpecifier(filePath, specifier, rootDir) {
  if (!specifier.startsWith('../') && !(specifier.startsWith('./'))) return null;
  const resolved = path.resolve(path.dirname(filePath), specifier);
  const relativeToRoot = normalizePath(path.relative(rootDir, resolved));
  if (!relativeToRoot || relativeToRoot.startsWith('..')) return null;
  return `@/${relativeToRoot}`;
}

function replaceByRegex(content, regex, filePath, rootDir, includeLocal, changes) {
  return content.replace(regex, (full, quote, specifier) => {
    if (!includeLocal && specifier.startsWith('./')) return full;
    if (!specifier.startsWith('../') && !specifier.startsWith('./')) return full;
    const nextSpecifier = toAliasSpecifier(filePath, specifier, rootDir);
    if (!nextSpecifier || nextSpecifier === specifier) return full;
    changes.push({ from: specifier, to: nextSpecifier });
    return full.replace(specifier, nextSpecifier);
  });
}

function collectLineNumbers(content, specifier) {
  const lines = content.split('\n');
  const hits = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].includes(specifier)) hits.push(index + 1);
  }
  return hits;
}

function processFile(filePath, rootDir, includeLocal, write) {
  const original = fs.readFileSync(filePath, 'utf8');
  const changes = [];
  let updated = original;
  updated = replaceByRegex(updated, FROM_RE, filePath, rootDir, includeLocal, changes);
  updated = replaceByRegex(updated, DYNAMIC_IMPORT_RE, filePath, rootDir, includeLocal, changes);
  updated = replaceByRegex(updated, REQUIRE_RE, filePath, rootDir, includeLocal, changes);

  const uniqueChanges = [];
  const seen = new Set();
  for (const change of changes) {
    const key = `${change.from}->${change.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueChanges.push({ ...change, lines: collectLineNumbers(original, change.from) });
  }

  if (write && updated !== original) {
    fs.writeFileSync(filePath, updated, 'utf8');
  }

  return {
    file: filePath,
    changed: updated !== original,
    changes: uniqueChanges
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const results = [];

  for (const root of options.roots) {
    const rootDir = path.resolve(root);
    const files = walk(rootDir);
    for (const filePath of files) {
      const result = processFile(filePath, rootDir, options.includeLocal, options.write);
      if (result.changes.length > 0) {
        results.push(result);
      }
    }
  }

  const totalRewrites = results.reduce((sum, item) => sum + item.changes.length, 0);
  const changedFiles = results.filter((item) => item.changed).length;
  const summary = {
    mode: options.write ? 'write' : 'audit',
    roots: options.roots,
    filesFlagged: results.length,
    filesChanged: options.write ? changedFiles : 0,
    rewriteCount: totalRewrites,
    includeLocal: options.includeLocal
  };

  if (options.report) {
    fs.mkdirSync(path.dirname(options.report), { recursive: true });
    fs.writeFileSync(options.report, JSON.stringify({ summary, results }, null, 2), 'utf8');
  }

  console.log(JSON.stringify(summary, null, 2));
  for (const item of results.slice(0, 200)) {
    console.log(`- ${normalizePath(path.relative(process.cwd(), item.file))}`);
    for (const change of item.changes.slice(0, 10)) {
      const lineLabel = change.lines.length > 0 ? change.lines.join(',') : '?';
      console.log(`  line ${lineLabel}: ${change.from} -> ${change.to}`);
    }
    if (item.changes.length > 10) {
      console.log(`  ... ${item.changes.length - 10} more rewrites`);
    }
  }
}

main();
