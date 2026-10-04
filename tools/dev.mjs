// Dev server: build (unminified), serve dist/, rebuild when sources change.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';
import { startServer } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let busy = false, again = false;
async function rebuild() {
  if (busy) { again = true; return; }
  busy = true;
  try { const r = await build({ dev: true }); console.log(new Date().toLocaleTimeString(), 'rebuilt', r.hash); } catch (e) { console.error(e.message); }
  busy = false;
  if (again) { again = false; rebuild(); }
}
await rebuild();
const { url } = await startServer(path.join(ROOT, 'dist'), 5173);
console.log('dev server:', url);
let t = null;
for (const d of ['js', 'css', 'assets']) fs.watch(path.join(ROOT, d), { recursive: true }, () => { clearTimeout(t); t = setTimeout(rebuild, 150); });
fs.watch(path.join(ROOT, 'index.html'), () => { clearTimeout(t); t = setTimeout(rebuild, 150); });
