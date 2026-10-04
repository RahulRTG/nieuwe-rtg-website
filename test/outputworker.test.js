'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { runWorker } = require('../scripts/lib/outputworker');

test('output worker rejects a failed process even if it prints PASS-shaped JSON', async () => {
  const result = await runWorker(['-e', 'console.log(JSON.stringify({staat:"merkt"})); process.exitCode=1']);
  assert.equal(result.staat, 'stoornis');
  assert.equal(result.execution.code, 1);
});

test('output worker preserves successful evidence and cleans its own lingering server child', async () => {
  const script = `const {spawn}=require('node:child_process');
    const child=spawn(process.execPath,['-e','setInterval(()=>{},10000)'],{stdio:'inherit'});
    child.unref();
    console.log(JSON.stringify({staat:'merkt',childPid:child.pid}));`;
  const result = await runWorker(['-e', script], { timeout: 10000 });
  assert.equal(result.staat, 'merkt');
  // A dead descendant can briefly remain as a zombie until init reaps it.
  // It must never remain a running process holding the worker's pipes open.
  assert.ok(Number.isInteger(result.childPid));
  const { execFileSync } = require('node:child_process');
  let state = '';
  try { state = execFileSync('ps', ['-o', 'stat=', '-p', String(result.childPid)], { encoding: 'utf8' }).trim(); }
  catch (error) { assert.equal(error.status, 1); }
  assert.ok(!state || state.startsWith('Z'), 'the server descendant must be dead');
});

test('output worker timeout is an incomplete proof, never MERKT', async () => {
  const result = await runWorker(['-e', 'setInterval(()=>{},10000)'], { timeout: 100 });
  assert.equal(result.staat, 'stoornis');
  assert.equal(result.execution.timedOut, true);
});
