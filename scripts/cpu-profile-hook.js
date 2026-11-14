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
  const correlatie = require('./save-profile-correlation')(() => performance.now());
  const meet = fn => { try { return fn(); } catch (e) { correlatie.error(); } };
  // Monteer vóór de eerste prepare(), zonder een database te openen.
  const sqlitePhases = require('./sqlite-profile-phases')(require('node:sqlite'), undefined,
    (...args) => meet(() => correlatie.native(...args)));
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
      const frame = meet(() => correlatie.begin(naam, args)); let gelukt = false;
      try { const uit = origineel.apply(this, args); gelukt = true; return uit; }
      finally {
        const ms = performance.now() - start;
        rij.count++; rij.ms += ms; rij.maxMs = Math.max(rij.maxMs, ms);
        if (args[1] === undefined) rij.full++;
        saves.set(naam, rij);
        if (frame) meet(() => correlatie.end(frame, !gelukt));
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
        const start = performance.now(); let uit, gelukt = false;
        try { uit = serialiseer.apply(this, args); gelukt = true; return uit; }
        finally {
          const ms = performance.now() - start;
          rij.count++; rij.ms += ms; rij.maxMs = Math.max(rij.maxMs, ms);
          if (typeof uit === 'string') rij.chars += uit.length;
          serialisaties.set(naam, rij);
          meet(() => correlatie.serialization(naam, ms, typeof uit === 'string' ? uit.length : 0, !gelukt));
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
  let bezig = false, begin = new Date().toISOString(), vorigeOnderhoud = null, captureStartAcknowledgedAt;
  post('Profiler.enable').then(() => post('Profiler.start')).then(() => {
    captureStartAcknowledgedAt = new Date().toISOString();
    timer = setInterval(async () => {
      if (bezig || gestopt) return;
      bezig = true;
      try {
        const captureStopRequestedAt = new Date().toISOString();
        const { profile } = await post('Profiler.stop');
        const end = new Date().toISOString();
        const stem = process.pid + '-' + end.replace(/[:.]/g, '-');
        const onderhoudStart = performance.now(); correlatie.maintenance(true);
        const tekst = JSON.stringify(profile), encodeEnd = performance.now();
        fs.writeFileSync(path.join(dir, stem + '.cpuprofile'), tekst);
        const writeEnd = performance.now();
        // Alleen namen en byteaantallen van de synthetische testdatabase;
        // geen inhoud. Buiten het CPU-venster, zodat dit de hotspot niet wordt.
        let collections;
        try {
          const data = require('../server/db/state').db.data || {};
          collections = Object.entries(data).map(([name, value]) => ({ name, bytes: Buffer.byteLength(JSON.stringify(value) || '') }))
            .sort((a, b) => b.bytes - a.bytes).slice(0, 20);
        } catch (error) { collections = { error: error.message }; }
        const inventarisEnd = performance.now();
        const storage = [...saves.values()].sort((a, b) => b.ms - a.ms).slice(0, 30);
        const serialization = [...serialisaties.values()].sort((a, b) => b.ms - a.ms).slice(0, 30);
        const meta = JSON.stringify({ pid: process.pid, begin, end, diagnosticOnly: true,
          captureStartAcknowledgedAt, captureStopRequestedAt, collections, storage, serialization,
          storageFullMeans: 'unscoped-call-not-full-plan',
          sqlitePhases: sqlitePhases.drain(), saveCorrelation: correlatie.drain(),
          profilerMaintenance: { previous: vorigeOnderhoud, finalIntervalNotPublished: true,
            coverage:'profile-encode-write+inventory+metadata-encode-write-not-whole-capture-gap' } });
        const metaEnd = performance.now();
        fs.writeFileSync(path.join(dir, stem + '.json'), meta);
        const klaar = performance.now();
        vorigeOnderhoud = {window:stem,startedAtMs:onderhoudStart,endedAtMs:klaar,
          profileEncodeMs:encodeEnd-onderhoudStart,profileWriteMs:writeEnd-encodeEnd,
          inventoryMs:inventarisEnd-writeEnd,metadataEncodeMs:metaEnd-inventarisEnd,metadataWriteMs:klaar-metaEnd,
          profileBytes:Buffer.byteLength(tekst),metadataBytes:Buffer.byteLength(meta)};
        correlatie.maintenance(false);
        saves.clear();
        serialisaties.clear();
        begin = end;
        await post('Profiler.start');
        captureStartAcknowledgedAt = new Date().toISOString();
      } catch (error) { stop(); console.error('[cpu-profile]', error.message); }
      finally { correlatie.maintenance(false); bezig = false; }
    }, 30000);
    timer.unref();
  }).catch(error => { stop(); console.error('[cpu-profile]', error.message); });
};
