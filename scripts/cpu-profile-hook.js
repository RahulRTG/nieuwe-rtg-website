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
  // Diagnose per route, zonder payloads. Wacht op de normale moduleinitialisatie:
  // de preload mag geen tweede database of gewijzigde opstartvolgorde maken.
  const saves = new Map(), sqlitePath = require.resolve('../server/db/sqlite');
  const handelingPath = require.resolve('../server/opzet/handeling');
  const koppel = setInterval(() => {
    const sqlite = require.cache[sqlitePath];
    if (!sqlite?.loaded) return;
    clearInterval(koppel);
    const origineel = sqlite.exports.saveSqlite;
    sqlite.exports.saveSqlite = function(...args) {
      const h = require.cache[handelingPath]?.exports.huidige?.();
      const sleutel = (h?.methode || '') + ' ' + (h?.pad || 'achtergrond');
      const naam = saves.has(sleutel) || saves.size < 5000 ? sleutel : 'overig';
      const rij = saves.get(naam) || { route: naam, count: 0, ms: 0, maxMs: 0, full: 0 };
      const start = performance.now();
      try { return origineel.apply(this, args); }
      finally {
        const ms = performance.now() - start;
        rij.count++; rij.ms += ms; rij.maxMs = Math.max(rij.maxMs, ms);
        if (args[1] === undefined) rij.full++;
        saves.set(naam, rij);
      }
    };
  }, 1000);
  koppel.unref();
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
        // Alleen namen en byteaantallen van de synthetische testdatabase;
        // geen inhoud. Buiten het CPU-venster, zodat dit de hotspot niet wordt.
        let collections;
        try {
          const data = require('../server/db/state').db.data || {};
          collections = Object.entries(data).map(([name, value]) => ({ name, bytes: Buffer.byteLength(JSON.stringify(value) || '') }))
            .sort((a, b) => b.bytes - a.bytes).slice(0, 20);
        } catch (error) { collections = { error: error.message }; }
        const storage = [...saves.values()].sort((a, b) => b.ms - a.ms).slice(0, 30);
        fs.writeFileSync(path.join(dir, stem + '.json'), JSON.stringify({ pid: process.pid, begin, end, diagnosticOnly: true, collections, storage }));
        saves.clear();
        begin = end;
        await post('Profiler.start');
      } catch (error) { console.error('[cpu-profile]', error.message); }
      finally { bezig = false; }
    }, 30000);
    timer.unref();
  }).catch(error => { console.error('[cpu-profile]', error.message); session.disconnect(); });
};
