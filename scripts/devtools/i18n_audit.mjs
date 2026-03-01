import fs from 'fs';
import path from 'path';

const ROOTS = ['apps/web', 'apps/admin'];
const EXTENSIONS = new Set(['.ts', '.tsx']);
const IGNORE_DIRS = new Set(['node_modules', '.next', 'dist', 'out', '.git']);
const IGNORE_FILES = ['.d.ts'];

const zhRegex = /(['"`])([^\1\n]*?[\u4e00-\u9fff][^\1\n]*?)\1/g;
const enRegex = /(['"`])([A-Za-z][A-Za-z0-9 ,.!?:;()\-_/]{2,})\1/g;

function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.next')) continue;
    if (entry.name.startsWith('.next.bak')) continue;
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (!EXTENSIONS.has(ext)) continue;
      if (IGNORE_FILES.some((suffix) => entry.name.endsWith(suffix))) continue;
      files.push(full);
    }
  }
  return files;
}

function extractMatches(content, regex) {
  const lines = content.split('\n');
  const results = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(line)) !== null) {
      const raw = match[2].trim();
      if (!raw) continue;
      if (raw.length <= 1) continue;
      if (/^(use client|POST|GET|PUT|PATCH|DELETE|application\/json|text\/plain|Content-Type)$/i.test(raw)) continue;
      if (/^(react|next\/.+|lucide-react|@eggturtle\/.+)$/i.test(raw)) continue;
      if (/^\/[^\s]+$/.test(raw)) continue;
      if (raw.includes('/') || raw.includes('\\')) continue;
      if (raw.includes('${')) continue;
      if (/^[A-Z0-9_:-]+$/.test(raw)) continue;
      if (/^[a-z0-9._@-]+$/i.test(raw)) continue;
      if (/\b(bg-|text-|border-|rounded-|px-|py-|mt-|mb-|ml-|mr-|w-|h-|min-|max-|sm:|md:|lg:|xl:|hover:|dark:|flex|grid)\b/.test(raw)) continue;
      results.push({ line: i + 1, text: raw });
    }
  }
  return results;
}

const allFiles = ROOTS.flatMap((root) => walk(root));
const rows = [];

for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const zh = extractMatches(content, zhRegex);
  const en = extractMatches(content, enRegex);
  if (zh.length === 0 && en.length === 0) continue;

  const score = zh.length * 2 + en.length;
  rows.push({ file, zh, en, score });
}

rows.sort((a, b) => b.score - a.score);

const now = new Date();
const y = now.getFullYear();
const m = String(now.getMonth() + 1).padStart(2, '0');
const d = String(now.getDate()).padStart(2, '0');
const output = `docs/plan/evidence/i18n-audit-${y}${m}${d}.md`;

const lines = [];
lines.push('# i18n Audit');
lines.push('');
lines.push(`- generated_at: ${now.toISOString()}`);
lines.push(`- scope: apps/web + apps/admin`);
lines.push(`- files_scanned: ${allFiles.length}`);
lines.push(`- files_flagged: ${rows.length}`);
lines.push('');
lines.push('## Priority Checklist');
lines.push('');
lines.push('| Priority | File | zh_count | en_count | Suggested Action |');
lines.push('|---|---|---:|---:|---|');
for (const item of rows.slice(0, 80)) {
  const priority = item.score >= 30 ? 'P0' : item.score >= 15 ? 'P1' : 'P2';
  const action = priority === 'P0' ? 'Batch replace now' : priority === 'P1' ? 'Replace after shared dictionary' : 'Track only';
  lines.push(`| ${priority} | ${item.file} | ${item.zh.length} | ${item.en.length} | ${action} |`);
}

lines.push('');
lines.push('## Samples');
lines.push('');
for (const item of rows.slice(0, 20)) {
  lines.push(`### ${item.file}`);
  lines.push('');
  const combined = [
    ...item.zh.slice(0, 6).map((x) => ({ ...x, type: 'zh' })),
    ...item.en.slice(0, 6).map((x) => ({ ...x, type: 'en' }))
  ].sort((a, b) => a.line - b.line);

  if (combined.length === 0) {
    lines.push('- (no samples)');
  } else {
    for (const sample of combined) {
      const text = sample.text.replace(/\|/g, '\\|');
      lines.push(`- [${sample.type}] line ${sample.line}: ${text}`);
    }
  }
  lines.push('');
}

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${lines.join('\n')}\n`, 'utf8');
console.log(output);
console.log(`flagged_files=${rows.length}`);

const jsonOut = 'out/i18n-audit/latest.json';
fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
fs.writeFileSync(
  jsonOut,
  JSON.stringify(
    rows.map((x) => ({ file: x.file, zhCount: x.zh.length, enCount: x.en.length, score: x.score })),
    null,
    2
  ),
  'utf8'
);
console.log(jsonOut);
