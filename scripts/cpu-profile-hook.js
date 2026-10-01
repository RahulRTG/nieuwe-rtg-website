'use strict';
/* Alleen de optionele test-preload. Geen netwerkpoort, geen hostsignalen en
   geen productiehaak: verzamel CPU-stacks in korte vensters, zodat de echte
   crashproeven hun SIGKILL mogen houden zonder alle diagnose te verliezen. */
module.exports = function profileer() {
  if (process.env.NODE_ENV !== 'test' || !process.env.RTG_CPU_PROFILE_DIR) return;
  const fs = require('node:fs'), path = require('node:path');
  const { Session } = require('node:inspector');
  const dir = path.resolve(process.env.RTG_CPU_PROFILE_DIR);
  fs.mkdirSync(dir, { recursive: true });
  const session = new Session();
  session.connect();
  const post = method => new Promise((resolve, reject) => session.post(method, (error, value) => error ? reject(error) : resolve(value)));
  let bezig = false, begin = new Date().toISOString();
  post('Profiler.enable').then(() => post('Profiler.start')).then(() => {
    const timer = setInterval(async () => {
      if (bezig) return;
      bezig = true;
      try {
        const { profile } = await post('Profiler.stop');
        const end = new Date().toISOString();
        const stem = process.pid + '-' + end.replace(/[:.]/g, '-');
        fs.writeFileSync(path.join(dir, stem + '.cpuprofile'), JSON.stringify(profile));
        fs.writeFileSync(path.join(dir, stem + '.json'), JSON.stringify({ pid: process.pid, begin, end, diagnosticOnly: true }));
        begin = end;
        await post('Profiler.start');
      } catch (error) { console.error('[cpu-profile]', error.message); }
      finally { bezig = false; }
    }, 30000);
    timer.unref();
  }).catch(error => { console.error('[cpu-profile]', error.message); session.disconnect(); });
};
