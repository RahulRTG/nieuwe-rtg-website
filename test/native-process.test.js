'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { stop } = require('../scripts/lib/native-process');

test('native cleanup kan een nooit gestart proces begrensd afhandelen', { timeout:2000 }, async () => {
  const child = spawn('/definitely-absent-rtg-native-executable', [], { stdio:'ignore' });
  const [error] = await once(child, 'error'); assert.equal(error.code, 'ENOENT');
  await stop(child);
});
test('native cleanup wacht op het einde van uitsluitend zijn eigen kindproces', { timeout:5000 }, async t => {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio:'ignore' });
  // Ook bij een defecte stop() ruimt de toets alleen dit eigen kind op.
  t.after(async () => {
    if (!child.pid || child.exitCode !== null || child.signalCode) return;
    const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited;
  });
  await once(child, 'spawn'); await stop(child);
  assert.equal(child.signalCode, 'SIGTERM');
});
