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
  // Monteer vóór de eerste prepare(), zonder een database te openen.
  const sqlitePhases = require('./sqlite-profile-phases')(require('node:sqlite'));
  // Diagnose per route, zonder payloads. Wacht op de normale moduleinitialisatie:
  // de preload mag geen tweede database of gewijzigde opstartvolgorde maken.
  const saves = new Map(), sqlitePath = require.resolve('../server/db/sqlite');
  const serialisaties = new Map(), trackerPath = require.resolve('../server/db/mutatietracker');
  const handelingPath = require.resolve('../server/opzet/handeling');
  const herstel = [];
  let gestopt = false, timer = null;
  function stop() {
    if (gestopt) return;
    gestopt = true;
    clearInterval(koppel);
    if (timer) clearInterval(timer);
    for (const fn of herstel) fn();
    sqlitePhases.restore();
    try { session.disconnect(); } catch (e) {}
  }
  const koppel = setInterval(() => {
    if (gestopt) return;
    const sqlite = require.cache[sqlitePath];
    if (!sqlite?.loaded) return;
    clearInterval(koppel);
    const origineel = sqlite.exports.saveSqlite;
    const gemetenSave = function(...args) {
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
    sqlite.exports.saveSqlite = gemetenSave;
    herstel.push(() => { if (sqlite.exports.saveSqlite === gemetenSave) sqlite.exports.saveSqlite = origineel; });
    const tracker = require.cache[trackerPath];
    if (tracker?.loaded) {
      const serialiseer = tracker.exports.serialiseerVoorOpslag;
      const gemetenSerialisatie = function(...args) {
        const naam = typeof args[1] === 'string' && (serialisaties.has(args[1]) || serialisaties.size < 5000)
          ? args[1] : 'overig';
        const rij = serialisaties.get(naam) || { collection: naam, count: 0, ms: 0, maxMs: 0, chars: 0 };
        const start = performance.now(); let uit;
        try { uit = serialiseer.apply(this, args); return uit; }
        finally {
          const ms = performance.now() - start;
          rij.count++; rij.ms += ms; rij.maxMs = Math.max(rij.maxMs, ms);
          if (typeof uit === 'string') rij.chars += uit.length;
          serialisaties.set(naam, rij);
        }
      };
      tracker.exports.serialiseerVoorOpslag = gemetenSerialisatie;
      herstel.push(() => {
        if (tracker.exports.serialiseerVoorOpslag === gemetenSerialisatie) tracker.exports.serialiseerVoorOpslag = serialiseer;
      });
    }
  }, 1000);
  koppel.unref();
  const session = new Session();
  try { session.connect(); }
  catch (error) { stop(); console.error('[cpu-profile]', error.message); return; }
  const post = method => new Promise((resolve, reject) => session.post(method, (error, value) => error ? reject(error) : resolve(value)));
  let bezig = false, begin = new Date().toISOString();
  post('Profiler.enable').then(() => post('Profiler.start')).then(() => {
    timer = setInterval(async () => {
      if (bezig || gestopt) return;
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
        const serialization = [...serialisaties.values()].sort((a, b) => b.ms - a.ms).slice(0, 30);
        fs.writeFileSync(path.join(dir, stem + '.json'), JSON.stringify({ pid: process.pid, begin, end, diagnosticOnly: true, collections, storage, serialization, sqlitePhases: sqlitePhases.drain() }));
        saves.clear();
        serialisaties.clear();
        begin = end;
        await post('Profiler.start');
      } catch (error) { stop(); console.error('[cpu-profile]', error.message); }
      finally { bezig = false; }
    }, 30000);
    timer.unref();
  }).catch(error => { stop(); console.error('[cpu-profile]', error.message); });
};
