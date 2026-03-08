import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const cssTargets = [
  'packages/shared/styles/ui-foundation.css',
  'apps/web/app/globals.css',
  'apps/admin/app/globals.css'
];

const forbiddenPatterns = [
  {
    name: 'bare-button-hover',
    regex: /^\s*button:hover\b/,
    message: 'Use scoped selectors (e.g. container + button) or exclude component buttons via :not([data-ui="button"]).'
  },
  {
    name: 'bare-button-secondary',
    regex: /^\s*button\.secondary\b/,
    message: 'Avoid global button variants; use scoped selectors or component variants.'
  },
  {
    name: 'dark-theme-bare-button',
    regex: /^\s*:root\[data-theme='dark'\]\s+button\b/,
    message: 'Dark-theme button overrides must be scoped; do not target all buttons globally.'
  }
];

const findings = [];

for (const relativePath of cssTargets) {
  const filePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(filePath)) {
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const rule of forbiddenPatterns) {
      if (rule.regex.test(line)) {
        findings.push({
          file: relativePath,
          line: index + 1,
          selector: line.trim(),
          message: rule.message
        });
      }
    }
  }
}

if (findings.length > 0) {
  console.error('Found forbidden global button selectors:\n');
  for (const finding of findings) {
    console.error(
      `- ${finding.file}:${finding.line}\n  selector: ${finding.selector}\n  reason: ${finding.message}\n`,
    );
  }
  process.exit(1);
}

console.log('Global button selector guard passed.');
