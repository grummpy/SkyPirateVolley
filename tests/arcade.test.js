import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('arcade.json matches the manifest and points at real files', () => {
  const arcade = JSON.parse(read('arcade.json'));
  assert.equal(arcade.name, 'Sky Pirate Volley');
  assert.equal(arcade.id, 'skypiratevolley');
  assert.equal(arcade.icon, 'assets/icon.jpg');
  assert.equal(arcade.cover, 'assets/cover.jpg');
  assert.equal(arcade.players, 4);
  assert.equal(arcade.minPlayers, 1);
  assert.equal(arcade.port, 8820);
  assert.equal(arcade.version, '1.0.0');
  assert.deepEqual(arcade.input, ['keyboard', 'gamepad']);
  assert.equal(arcade.launch.mac, './launch-mac.command');
  assert.equal(arcade.launch.windows, 'launch-windows.bat');
  assert.equal(arcade.launch.linux, './launch-linux.sh');
  assert.equal(arcade.launch.web, 'index.html');

  for (const rel of [arcade.icon, arcade.cover, arcade.launch.web, arcade.launch.windows]) {
    assert.equal(fs.existsSync(path.join(root, rel)), true, rel);
  }
  for (const rel of ['launch-mac.command', 'launch-linux.sh', 'server.py']) {
    const stat = fs.statSync(path.join(root, rel));
    assert.ok(stat.mode & 0o111, `${rel} should be executable`);
  }
});

test('launchers invoke the server and mention Python 3', () => {
  for (const rel of ['launch-mac.command', 'launch-linux.sh', 'launch-windows.bat']) {
    const text = read(rel);
    assert.match(text, /server\.py/);
    assert.match(text, /Python 3/);
  }
  for (const rel of ['launch-mac.command', 'launch-linux.sh']) {
    const result = spawnSync('bash', ['-n', path.join(root, rel)], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
});

test('the client is offline and wires the canvas module', () => {
  const html = read('index.html');
  assert.match(html, /<canvas/);
  assert.match(html, /src\/ui\/main\.js/);
  assert.match(html, /assets\/cover\.jpg|assets\/icon\.jpg/);
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(html|js|css)$/.test(entry.name)) files.push(full);
    }
  }
  walk(path.join(root, 'src'));
  files.push(path.join(root, 'index.html'));
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    assert.equal(/https?:\/\//.test(text), false, file);
  }
});
