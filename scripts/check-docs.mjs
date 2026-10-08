import { existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, relative, resolve } from 'node:path';
const root = process.cwd();
const listed = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' },
);
const markdown = [...new Set(listed.split('\0'))]
  .filter((path) => path.endsWith('.md') && existsSync(resolve(root, path)))
  .map((path) => resolve(root, path));
function headings(path) {
  const counts = new Map();
  const found = new Set();
  const text = readFileSync(path, 'utf8').replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '');
  for (const match of text.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const slug = match[1]
      .toLowerCase()
      .replace(/[^\p{L}\p{N}_\-\s]/gu, '')
      .replace(/\s/g, '-');
    const count = counts.get(slug) ?? 0;
    found.add(count ? `${slug}-${count}` : slug);
    counts.set(slug, count + 1);
  }
  return found;
}
const failures = [];
for (const file of markdown) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const link = match[1];
    if (/^[a-z][a-z\d+.-]*:/i.test(link)) continue;
    const [path, anchor] = link.split('#');
    const target = resolve(
      dirname(file),
      decodeURIComponent(path || relative(dirname(file), file)),
    );
    try {
      if (relative(root, target).startsWith('..') || path.startsWith('/'))
        throw new Error('link leaves the repository');
      if (!statSync(target).isFile()) throw new Error('target is not a file');
      if (anchor && target.endsWith('.md') && !headings(target).has(decodeURIComponent(anchor)))
        throw new Error('heading does not exist');
    } catch {
      failures.push(`${relative(root, file)}: broken local link ${link}`);
    }
  }
}
if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
} else
  console.log(`Local documentation links and heading anchors passed (${markdown.length} files).`);
