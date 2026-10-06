'use strict';
const d = require('../../server/db'); d.load();
let input = '';
process.stdin.on('data', b => { input += b; });
process.stdin.on('end', async () => {
  try {
    const task = JSON.parse(input);
    const transaction = async (name, fn) => {
      const out = await d.bewerkCollectie(name, s => {
        const result = fn(s); if (task.fail === 'before') throw new Error('Injected before commit'); return result;
      });
      if (task.fail === 'after') throw new Error('Injected after commit'); return out;
    };
    const identities = { exists: x => ['user-1', 'user-2', 'user-3'].includes(x), represents: (a, p) => a === p };
    const library = require('../../server/kern/library')({ db: d.db, bewerkCollectie: transaction, store: d.STORE,
      identities, now: () => '2026-10-03T10:00:00.000Z' });
    if (task.gate) { process.send('ready'); await new Promise(r => process.once('message', r)); process.disconnect(); }
    let result;
    if (task.kind === 'seed') result = await d.bewerkCollectie('libraryKernel', s => { Object.assign(s, task.state); return { ok: true }; });
    else if (task.kind === 'inspect') result = d.db.data.libraryKernel;
    else result = await library.execute(task.actor, task.action, task.input, () => true);
    console.log(JSON.stringify(result));
  } catch (e) { console.error(e); process.exitCode = 1; }
});
