import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

test('el build publica los módulos del navegador en dist/assets', async () => {
  const result = spawnSync(process.execPath, ['scripts/build.mjs'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  await access('dist/assets/app.js');
  await access('dist/assets/core/trace-parser.js');
  await access('dist/assets/miners/alpha-miner.js');
  await access('dist/assets/ui/svg-renderer.js');
  const html = await readFile('dist/index.html', 'utf8');
  assert.match(html, /src="\.\/assets\/app\.js"/);
});
