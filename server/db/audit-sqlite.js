'use strict';
/* Rijopslag voor twee auditjournalen. Een normale toevoeging leest alleen de
   DB-kop en schrijft één versleutelde rij. Import, wissing en retentie zijn
   expliciete transacties; geen tweede blobschrijver naast deze eigenaar. */
const vorm = require('./audit-vorm');

module.exports = ({ db, kv, decode, encode, bump }) => {
  kv.exec('CREATE TABLE IF NOT EXISTS audit_meta (naam TEXT PRIMARY KEY, versie INTEGER NOT NULL, epoch INTEGER NOT NULL, kop INTEGER NOT NULL, totaal INTEGER NOT NULL, extra TEXT NOT NULL)');
  kv.exec('CREATE TABLE IF NOT EXISTS audit_rij (naam TEXT NOT NULL, nr INTEGER NOT NULL, waarde TEXT NOT NULL, PRIMARY KEY(naam,nr))');
  require('./audit-compat').bewaak(kv);
  const q = {
    meta: kv.prepare('SELECT * FROM audit_meta WHERE naam=?'),
    metas: kv.prepare('SELECT naam FROM audit_meta'),
    bron: kv.prepare('SELECT val FROM kv WHERE key=?'),
    zetMeta: kv.prepare('INSERT INTO audit_meta VALUES(?,?,?,?,?,?) ON CONFLICT(naam) DO UPDATE SET versie=excluded.versie,epoch=excluded.epoch,kop=excluded.kop,totaal=excluded.totaal,extra=excluded.extra'),
    rij: kv.prepare('INSERT INTO audit_rij VALUES(?,?,?)'),
    kop: kv.prepare('SELECT waarde FROM audit_rij WHERE naam=? ORDER BY nr DESC'),
    staart: kv.prepare('SELECT MIN(nr) AS nr FROM audit_rij WHERE naam=?'),
    vanaf: kv.prepare('SELECT nr,waarde FROM audit_rij WHERE naam=? AND nr>? ORDER BY nr'),
    weg: kv.prepare('DELETE FROM audit_rij WHERE naam=?'),
    snoei: kv.prepare('DELETE FROM audit_rij WHERE naam=? AND nr<=?'),
    wegBron: kv.prepare('DELETE FROM kv WHERE key=?')
  };
  const cache = new Map();
  const projectie = require('./audit-projectie')();
  let context = () => null;
  function metaZet(m) { q.zetMeta.run(m.naam, m.versie, m.epoch, m.kop, m.totaal, m.extra); }
  function transaction(werk) {
    kv.exec('BEGIN IMMEDIATE');
    try { const uit = werk(); kv.exec('COMMIT'); return uit; }
    catch (e) { try { kv.exec('ROLLBACK'); } catch (x) {} throw e; }
  }
  function vervang(naam, waarde, oud) {
    const spec = vorm.eis(naam), lijst = vorm.rijen(naam, waarde);
    const volgorde = spec.omgekeerd ? [...lijst].reverse() : lijst;
    const m = { naam, versie: (oud?.versie || 0) + 1, epoch: (oud?.epoch || 0) + 1,
      kop: volgorde.length, totaal: Math.max(oud?.totaal || 0, vorm.totaal(naam, waarde)), extra: encode(JSON.stringify(vorm.extra(naam, waarde))) };
    q.weg.run(naam);
    for (let i = 0; i < volgorde.length; i++) q.rij.run(naam, i + 1, encode(JSON.stringify(volgorde[i])));
    metaZet(m); q.wegBron.run(naam); bump();
  }
  function open(naam) {
    vorm.eis(naam);
    if (!q.meta.get(naam)) {
      if (!db.writable) throw new Error('Alleen een schrijfbaar proces mag auditrijen migreren.');
      transaction(() => {
      if (q.meta.get(naam)) return;
      const bron = q.bron.get(naam);
      const waarde = bron ? JSON.parse(decode(bron.val)) : db.data?.[naam];
      vervang(naam, waarde || vorm.pak(naam, [], 0, {}), null);
      });
    }
    vernieuw(naam); return naam;
  }
  // Dezelfde snapshot voor metadata en rijen; de cache wordt pas erna gepubliceerd.
  function leesBinnen(naam) {
    const m = q.meta.get(naam); if (!m) return null;
    const oud = cache.get(naam);
    if (oud?.meta.versie === m.versie) return oud;
    const gelijkEpoch = oud?.meta.epoch === m.epoch;
    const nieuw = q.vanaf.all(naam, gelijkEpoch ? oud.meta.kop : 0).map(r => {
      const tekst = decode(r.waarde);
      JSON.parse(tekst); // Ongeldige opgeslagen JSON faalt binnen deze snapshot.
      return { nr: r.nr, tekst };
    });
    const spec = vorm.eis(naam), vanaf = q.staart.get(naam).nr;
    const beeld = projectie.volgende(gelijkEpoch ? oud.beeld : null, nieuw, vanaf);
    const lijst = projectie.lijst(beeld, spec.omgekeerd);
    return { meta: m, beeld, waarde: vorm.alleenLezen(vorm.pak(naam, lijst, m.totaal, JSON.parse(decode(m.extra)))), root: null };
  }
  function publiceer(naam, nieuw) {
    if (!nieuw) return;
    const oud = cache.get(naam), data = db.data;
    if (data && (!oud || data[naam] === oud.waarde || !Object.hasOwn(data, naam))) {
      data[naam] = nieuw.waarde; nieuw.root = data;
      nieuw.pending = null;
    } else if (data && oud) {
      nieuw.pending = oud.pending?.root === data && oud.pending?.waarde === data[naam]
        ? oud.pending : { root: data, waarde: data[naam], versie: oud.meta.versie };
    }
    cache.set(naam, nieuw);
  }
  function vernieuw(naam) {
    kv.exec('BEGIN');
    let nieuw;
    try { nieuw = leesBinnen(naam); kv.exec('COMMIT'); }
    catch (e) { try { kv.exec('ROLLBACK'); } catch (x) {} throw e; }
    publiceer(naam, nieuw);
    return nieuw?.waarde;
  }
  function view(naam) {
    const doos = context();
    return (doos?.open && doos.auditViews?.get(naam)) || vernieuw(naam);
  }
  function bezit(data, naam) {
    const c = cache.get(naam);
    if (!c || data[naam] !== c.waarde) return false;
    c.root = data; return true;
  }
  function vervangingen(data) {
    const uit = [];
    for (const [naam, c] of cache) {
      if (bezit(data, naam)) continue;
      const waarde = data[naam] ?? vorm.pak(naam, [], c.meta.totaal, {});
      if (JSON.stringify(waarde) === JSON.stringify(c.waarde)) { data[naam] = c.waarde; c.root = data; continue; }
      const verwacht = c.pending?.root === data && c.pending?.waarde === data[naam] ? c.pending.versie : c.meta.versie;
      uit.push({ naam, type: 'vervang', verwacht, waarde: vorm.kopie(waarde), resultaat: {} });
    }
    return uit;
  }
  function pasToe(op) {
    const m = q.meta.get(op.naam); if (!m) throw new Error('Auditjournaal is niet geopend.');
    if (op.type === 'append') {
      let top = null;
      for (const r of q.kop.iterate(op.naam)) {
        const waarde = JSON.parse(decode(r.waarde));
        if (!op.kopTest || op.kopTest(waarde)) { top = waarde; break; }
      }
      const rij = op.maak(top, m.totaal);
      if (rij && typeof rij.then === 'function') throw new Error('Auditbewerker moet synchroon zijn.');
      const veilig = vorm.kopie(rij);
      q.rij.run(op.naam, m.kop + 1, encode(JSON.stringify(veilig)));
      q.snoei.run(op.naam, m.kop + 1 - vorm.eis(op.naam).max);
      metaZet({ ...m, versie: m.versie + 1, kop: m.kop + 1, totaal: m.totaal + 1 });
      bump(); return { op, resultaat: veilig };
    }
    if (op.type === 'vervang' && op.verwacht !== m.versie) throw new Error('Auditprojectie is verouderd; ververs voor vervanging.');
    const waarde = op.type === 'vervang' ? op.waarde : vorm.kopie(leesBinnen(op.naam).waarde);
    const resultaat = op.type === 'rewrite' ? op.werk(waarde) : {};
    if (resultaat && typeof resultaat.then === 'function') throw new Error('Auditbewerker moet synchroon zijn.');
    vervang(op.naam, waarde, m); return { op, resultaat };
  }
  function stage(doos, op) {
    if (!doos.auditOps) { doos.auditOps = []; doos.auditViews = new Map(); }
    const basis = doos.auditViews.get(op.naam) || view(op.naam);
    const waarde = op.type === 'append'
      ? vorm.pak(op.naam, [...vorm.rijen(op.naam, basis)], vorm.totaal(op.naam, basis), vorm.extra(op.naam, basis))
      : vorm.kopie(basis);
    let resultaat;
    if (op.type === 'append') {
      const lijst = vorm.rijen(op.naam, waarde), spec = vorm.eis(op.naam);
      const volgorde = spec.omgekeerd ? lijst : [...lijst].reverse();
      const top = volgorde.find(r => !op.kopTest || op.kopTest(r));
      resultaat = op.maak(top || null, vorm.totaal(op.naam, waarde));
      if (spec.omgekeerd) { lijst.unshift(resultaat); lijst.splice(spec.max); }
      else { lijst.push(resultaat); if (lijst.length > spec.max) lijst.splice(0, lijst.length - spec.max); waarde.commandJournaalTotaal = vorm.totaal(op.naam, basis) + 1; }
    } else resultaat = op.werk(waarde);
    if (resultaat && typeof resultaat.then === 'function') throw new Error('Auditbewerker moet synchroon zijn.');
    Object.assign(op.resultaat, resultaat);
    doos.auditOps.push(op); doos.auditViews.set(op.naam, vorm.alleenLezen(waarde));
    return op.resultaat;
  }
  function publicaties(results) {
    return [...new Set(results.map(r => r.op.naam))].map(naam => {
      const nieuw = leesBinnen(naam);
      require('../opzet/begroting').toetsOpslag(db.data, naam, nieuw.waarde);
      return [naam, nieuw];
    });
  }
  function naCommit(results, doos, snapshots) {
    for (const r of results) Object.assign(r.op.resultaat, r.resultaat);
    if (doos?.auditOps) { doos.auditOps.length = 0; doos.auditViews.clear(); }
    for (const [naam, nieuw] of snapshots) {
      db.data[naam] = nieuw.waarde; nieuw.root = db.data; nieuw.pending = null; cache.set(naam, nieuw);
    }
  }
  function snapshots() { return q.metas.all().map(({ naam }) => [naam, leesBinnen(naam)]); }
  function publiceerSnapshots(lijst) { for (const [naam, nieuw] of lijst) publiceer(naam, nieuw); }
  function laad(data, lijst) {
    for (const [naam, nieuw] of lijst) { data[naam] = nieuw.waarde; nieuw.root = data; cache.set(naam, nieuw); }
    return data;
  }
  function poll() { publiceerSnapshots(require('./sqlite-poll').snapshot(kv, snapshots)); }
  return { open, view, bezit, vervangingen, pasToe, stage, publicaties, naCommit, laad, poll, snapshots, publiceerSnapshots,
    bestaat: naam => Boolean(q.meta.get(naam)),
    context: fn => { context = fn; }, doos: () => { const d = context(); return d?.committen ? d : null; } };
};
