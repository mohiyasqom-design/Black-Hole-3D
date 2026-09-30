// npm run generate:assets
// Runs the optional Blender pipeline if Blender is on PATH. Otherwise explains
// how to run it elsewhere and exits successfully: the app never needs it.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'blender', 'generate_all.py');
const probe = spawnSync(process.env.BLENDER || 'blender', ['--version'], { encoding: 'utf8' });

if (probe.error || probe.status !== 0) {
  console.log(`
Blender was not found on this machine, and that is fine.
The laboratory runs fully procedural assets without it.

To build the optional high-detail GLB assets on a machine with Blender 3.6+:
  blender -b --python blender/generate_all.py
  (add "-- --no-bake" for a quick run without texture baking)

Outputs go to blender/out/ and public/assets/models/, and
public/assets/manifest.json is switched on automatically.
`);
  process.exit(0);
}

console.log(probe.stdout.split('\n')[0]);
const run = spawnSync(process.env.BLENDER || 'blender', ['-b', '--python', script, '--', ...process.argv.slice(2)], { stdio: 'inherit', cwd: root });
process.exit(run.status ?? 0);
