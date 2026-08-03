import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const treeOnly = process.argv.includes('--tree-only');
const tracked = execFileSync('git', ['ls-files', '-z'])
  .toString('utf8')
  .split('\0')
  .filter(Boolean);
const findings = [];
const rules = [
  ['retired schema-domain identifier', /brushcodex[.]org/i],
  ['private workstation path', /(?:E:[\\/]+GitHub[\\/]+BrushCodex|\/home\/[^/\s]+\/[^\r\n]*BrushCodex)/i],
  ['SSN-shaped value', /\b\d{3}-\d{2}-\d{4}\b/],
  ['private key material', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['GitHub token shape', /\b(?:gh[opusr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
  ['AWS access-key shape', /\bAKIA[0-9A-Z]{16}\b/],
];
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

for (const file of tracked) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  if (text.includes('\0')) continue;
  for (const [label, pattern] of rules) {
    if (pattern.test(text)) findings.push(`${file}: ${label}`);
  }
  for (const email of text.match(emailPattern) ?? []) {
    if (!/@example\.(?:com|net|org)$/i.test(email) && !/@users\.noreply\.github\.com$/i.test(email)) {
      findings.push(`${file}: non-example email address`);
    }
  }
}

if (!treeOnly) {
  const commits = Number(execFileSync('git', ['rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim());
  if (commits !== 1) findings.push(`history: expected one public root commit, found ${commits}`);
  const emails = execFileSync('git', ['log', '--format=%ae%n%ce'], { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean);
  for (const email of emails) {
    if (!/@users\.noreply\.github\.com$/i.test(email)) findings.push('history: non-noreply commit email');
  }
}

if (findings.length) {
  console.error([...new Set(findings)].join('\n'));
  process.exit(1);
}

console.log(`Public snapshot scan passed (${tracked.length} tracked files${treeOnly ? ', tree only' : ', one clean root commit'}).`);
