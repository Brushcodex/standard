import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const files = execFileSync('git', ['ls-files', '*.md'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean);
const failures = [];

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const links = text.matchAll(/(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g);
  for (const match of links) {
    const target = match[1];
    if (!target || /^(?:https?:|mailto:|#)/i.test(target)) continue;
    const pathPart = decodeURIComponent(target.split('#', 1)[0]);
    if (!pathPart) continue;
    const absolute = resolve(dirname(file), pathPart);
    if (!existsSync(absolute)) {
      failures.push(`${file}: missing local link target ${target}`);
      continue;
    }
    if (target.endsWith('/') && !statSync(absolute).isDirectory()) {
      failures.push(`${file}: expected directory link target ${target}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Local Markdown links valid across ${files.length} tracked files.`);
