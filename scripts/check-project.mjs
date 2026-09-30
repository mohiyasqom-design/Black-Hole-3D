// npm run check: offline sanity checks that need no dependencies.
// Verifies every relative import resolves and every bare import is declared.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const deps = new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]);
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|mjs)$/.test(f)) files.push(p);
  }
})(path.join(root, 'src'));

let problems = 0;
const re = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|^import\s+['"]([^'"]+)['"]/gm;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(re)) {
    const spec = m[1] || m[2] || m[3];
    if (spec.startsWith('.')) {
      const target = path.resolve(path.dirname(f), spec);
      if (!fs.existsSync(target)) {
        console.error(`missing: ${path.relative(root, f)} -> ${spec}`);
        problems++;
      }
    } else {
      const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      if (!deps.has(name)) {
        console.error(`undeclared dependency "${name}" in ${path.relative(root, f)}`);
        problems++;
      }
    }
  }
  if (/\bTODO\b|FIXME/.test(src)) {
    console.error(`leftover TODO in ${path.relative(root, f)}`);
    problems++;
  }
}
console.log(`${files.length} source files checked, ${problems} problem(s).`);
process.exit(problems ? 1 : 0);
