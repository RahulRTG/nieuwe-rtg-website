'use strict';
/* De SQLite-save: plan, één transactie, en pas NA de commit publiceren.

   Het plan (./sqlite-saveplan.js) kiest de collecties die de mutatietracker
   aanwees, plus geld en een periodieke volledige vangrail voor onbekende
   mutatievormen. Collecties, tombstones en de auditrijen van ./audit-sqlite.js
   gaan samen in dezelfde `BEGIN IMMEDIATE ... COMMIT`; laatsteJson, versies en
   trackergeneraties worden pas bevestigd als die commit werkelijk geslaagd is.
   Met `duurzaam` loopt dezelfde save onder FULL-sync (./sqlite-duurzaam.js). */
const maakSaveplan = require('./sqlite-saveplan');
const { losVanVerzoek } = require('../lib/losvanverzoek');

module.exports = ({ db, verbinding, statements, auditMotor, mutaties, voorcheck, merge3,
  uitStore, naarStore, laatsteJson, toegepast, vouwWal }) => {
  const saveplan = maakSaveplan({ db, mutaties, voorcheck });
  /* Een periodieke volledige vangrail dekt toekomstige onbekende mutatievormen;
     geraakte collecties en geld gaan meteen. */
  const VOLLEDIG_MS = Number(process.env.RTG_SQLITE_VOLLEDIG_MS || 2000);
  let volledigTimer = null;
  function planVolledig() {
    if (volledigTimer || !(VOLLEDIG_MS > 0)) return;
    /* De vangrail is van niemand: hij bewaart het werk van ALLE verzoeken en
       start dus in de nulcontext, niet in die van het verzoek dat hem plande
       (Fase 2, I4; ../lib/losvanverzoek.js). */
    volledigTimer = losVanVerzoek(setTimeout, () => {
      volledigTimer = null;
      try { bewaar(false, undefined, [], true); } catch (e) { console.warn('[db] SQLite-vangrail mislukt:', e.message); }
    }, VOLLEDIG_MS);
    if (volledigTimer.unref) volledigTimer.unref();
  }

  function saveSqlite(force, sleutels, extraAudit = [], duurzaam = false) {
    /* Een gerichte save noemt bestaande collecties. Een tikfout of een lege lijst
       zou anders stil niets bewaren en toch slagen. */
    if (sleutels !== undefined && (!Array.isArray(sleutels) || (!sleutels.length && !extraAudit.length) ||
        sleutels.some(k => typeof k !== 'string' || !Object.hasOwn(db.data, k))))
      throw new TypeError('Een gerichte save vereist bestaande collecties');
    if (duurzaam) return require('./sqlite-duurzaam')(verbinding(),
      () => bewaar(true, sleutels, extraAudit, false), vouwWal);
    return bewaar(force, sleutels, extraAudit, false);
  }
  saveSqlite.stopVangrail = () => { if (volledigTimer) { clearTimeout(volledigTimer); volledigTimer = null; } };

  function bewaar(force, sleutels, extraAudit, vangrail) {
    const kvdb = verbinding();
    const audits = auditMotor(), doos = audits.doos();
    const auditOps = [...audits.vervangingen(db.data), ...(doos?.auditOps || []), ...extraAudit];
    const auditSleutels = new Set(auditOps.map(op => op.naam));
    const overslaan = k => auditSleutels.has(k) || audits.bezit(db.data, k) || audits.beheert(k);
    const { gewijzigd, verwijderd, nagekeken, uitgesteld } =
      saveplan(force, vangrail, laatsteJson, { sleutels, overslaan });
    if (uitgesteld) voorcheck.planNaronde(saveSqlite);
    if (!force && !vangrail) planVolledig();
    /* Niets te schrijven is iets anders dan niet geschreven; beide gaven hier
       `undefined`, en de duurzame bundel las dat als verlies -- zie duurzaam.js.
       Alleen zonder uitgesteld werk is elke collectie ook echt nagekeken. */
    if (!gewijzigd.length && !verwijderd.length && !auditOps.length) {
      mutaties.bevestig(nagekeken);
      return { alGelijk: !uitgesteld };
    }
    const { bump, huidig, lees, up, weg } = statements();
    const vastgelegd = [], weggeschreven = [], overgenomenGrafstenen = [];
    const auditResultaten = [];
    let auditSnapshots;
    kvdb.exec('BEGIN IMMEDIATE'); // pak meteen de schrijflock, zodat de versie en de merge kloppen
    try {
      for (const [k, jOns] of gewijzigd) {
        let j = jOns;
        const rij = lees.get(k);
        if (rij && rij.deleted) {
          /* Delete-wins ook wanneer DIT proces de grafsteen bij load() al heeft
             toegepast. Na een herstart zetten de vormdefaults ontbrekende
             collecties namelijk weer als lege container in RAM; de eerstvolgende
             gewone save mag dat niet lezen als een bewuste herschepping. Alleen
             bewerkCollectieSqlite mag onder hetzelfde DB-slot vanaf de lege basis
             en na een echte mutatie de grafsteen vervangen. */
          overgenomenGrafstenen.push({ k, ver: Number(rij.ver) });
          continue;
        }
        // Schreef een ander proces deze collectie ondertussen? Voeg per item samen
        // in plaats van hun wijzigingen te overschrijven.
        if (rij && rij.ver > (toegepast.get(k) || 0)) {
          const base = laatsteJson.has(k) ? JSON.parse(laatsteJson.get(k)) : undefined;
          const samen = merge3(base, db.data[k], JSON.parse(uitStore(rij.val)));
          db.data[k] = samen;
          j = JSON.stringify(samen);
          // na een merge is de collectie een ANDER object: de maten van de
          // voorcheck horen bij deze nieuwe inhoud, niet bij die van voor de merge
          voorcheck.onthoud(k, j.length, samen);
        }
        bump.run();
        const v = huidig.get().v;
        up.run(k, naarStore(j), v);
        vastgelegd.push([k, j, v]);
      }
      for (const k of verwijderd) {
        bump.run();
        const v = huidig.get().v;
        weg.run(k, v);
        weggeschreven.push([k, v]);
      }
      for (const op of auditOps) auditResultaten.push(audits.pasToe(op));
      auditSnapshots = audits.publicaties(auditResultaten);
      kvdb.exec('COMMIT');
    } catch (e) {
      try { kvdb.exec('ROLLBACK'); } catch (x) {}
      for (const [k] of gewijzigd) voorcheck.vergeet(k);
      throw e;
    }
    for (const [k, j, v] of vastgelegd) { laatsteJson.set(k, j); toegepast.set(k, v); }
    for (const [k, v] of weggeschreven) { laatsteJson.delete(k); toegepast.set(k, v); voorcheck.vergeet(k); }
    for (const x of overgenomenGrafstenen) {
      delete db.data[x.k];
      laatsteJson.delete(x.k);
      toegepast.set(x.k, x.ver);
      voorcheck.vergeet(x.k);
      mutaties.vergeet(x.k);
    }
    audits.naCommit(auditResultaten, doos, auditSnapshots);
    mutaties.bevestig(nagekeken);
    return { alGelijk: false, committed: true };
  }
  return saveSqlite;
};
