/* Contractgebonden uitvoering van bestaande opzegopdrachten. Geen eigen
   register: plannen blijven bij pasNaarGast, afspraken bij contracten. */
'use strict';
const DAG = 86400000;
const persoonlijk = c => c && (!c.aanbod || c.aanbod.scope.soort === 'persoon');

module.exports = ({ A, B, contracten, eigen, kaart, save, klok, regels, naarGast, meldLid }) => {
  function eigenContracten() {
    // Eén index per ronde: geen volledige account/schema-scan per opzegging.
    const schemas = new Map(), perAccount = new Map();
    for (const b of B()) {
      if (!schemas.has(b.aanmeldingId)) schemas.set(b.aanmeldingId, new Set());
      schemas.get(b.aanmeldingId).add(b.contractId);
    }
    for (const a of A()) {
      if (a.accountId == null || a.status !== 'geaccepteerd') continue;
      const id = Number(a.accountId);
      if (!Number.isFinite(id)) continue;
      const ids = [...(schemas.get(String(a.id)) || [])];
      const c = ids.length === 1 && ids[0] ? contracten.vind(ids[0]) : null;
      if (!perAccount.has(id)) perAccount.set(id, []);
      perAccount.get(id).push({ a, c: c && c.aanmeldingId === String(a.id) ? c : null });
    }
    return perAccount;
  }

  function anderRecht(rijen, doel, t) {
    return rijen.some(({ c }) => {
      if (!c) return true; // gebroken binding is geen bewijs dat rechten ontbreken
      if (!persoonlijk(c)) return false;
      if (c.id === doel.id || !contracten.LOPEND.has(c.status)) return false;
      const start = Date.parse(c.startAt), eind = c.eindigtOp == null ? Infinity : Date.parse(c.eindigtOp);
      if (!Number.isFinite(start) || Number.isNaN(eind)) return true;
      return start <= t && t < eind;
    });
  }

  return function ronde() {
    const t = klok(), r = regels(), k = eigen.kijk('pasNaarGast');
    const uit = { gepland: 0, afgelopen: 0, wacht: 0, aangekondigd: 0, onbetaald: 0, tegengehouden: 0 };
    if (!Number.isFinite(t)) throw new Error('Geen geldige klok voor de opzegronde.');
    const perAccount = eigenContracten();
    let gewijzigd = false;
    for (const [id, g] of Object.entries(k.gepland || {})) {
      const op = g && Date.parse(g.op);
      if (!Number.isFinite(op)) { uit.tegengehouden++; continue; }
      if (op > t) continue;
      const rijen = perAccount.get(Number(id)) || [];
      // Oude accountbrede opdrachten alleen koppelen als de oorsprong uniek is.
      const gebonden = g.contractId != null || g.aanmeldingId != null;
      const kandidaten = gebonden ? rijen.filter(({ a, c }) => c &&
        c.id === g.contractId && String(a.id) === g.aanmeldingId) : rijen.filter(({ c }) => c &&
          [contracten.STATUS.OPZEGGEND, contracten.STATUS.GEEINDIGD].includes(c.status) && Date.parse(c.eindigtOp) === op);
      const doel = kandidaten.length === 1 && kandidaten[0].c;
      if ((!gebonden && rijen.some(x => !x.c)) || !persoonlijk(doel) || ![contracten.STATUS.OPZEGGEND, contracten.STATUS.GEEINDIGD].includes(doel.status)
        || Date.parse(doel.eindigtOp) !== op) { uit.tegengehouden++; continue; }
      if (!gebonden) {
        Object.assign(kaart().gepland[id], { contractId: doel.id, aanmeldingId: String(kandidaten[0].a.id) });
        gewijzigd = true;
      }
      if (anderRecht(rijen, doel, t)) { uit.tegengehouden++; continue; }
      const x = naarGast(id, 'lid-gepland');
      if (x.ok || x.status === 409 || x.status === 404) {
        delete kaart().gepland[id]; gewijzigd = true;
        if (x.ok) uit.gepland++;
      }
    }
    const wacht = r.wacht.aan, dagen = r.wacht.dagen;
    for (const { a, c } of [...perAccount.values()].flat()) {
      const rijen = perAccount.get(Number(a.accountId));
      if (!persoonlijk(c) || !(wacht || r.afgelopen.aan) || c.status !== contracten.STATUS.OPZEGGEND
        || !Number.isFinite(Date.parse(c.eindigtOp)) || Date.parse(c.eindigtOp) > t) continue;
      // Ook de automatische lus mag een nieuwe afspraak niet intrekken of
      // daarvoor een onterecht 'binnenkort gast'-bericht uitsturen.
      if (anderRecht(rijen, c, t)) { uit.tegengehouden++; continue; }
      if (wacht && Date.parse(c.eindigtOp) + dagen * DAG > t) {
        const kk = kaart(); kk.aangekondigd = kk.aangekondigd || {};
        if (!kk.aangekondigd[a.id] && typeof meldLid === 'function') {
          try { meldLid('user-' + a.accountId, { icon: 'pas', title: 'Je lidmaatschap is afgelopen',
            body: 'Over ' + dagen + ' dagen word je gast. Was dit een vergissing, neem dan contact op.' }); } catch (e) { /* bericht is een extra */ }
          kk.aangekondigd[a.id] = new Date(t).toISOString(); uit.aangekondigd++; gewijzigd = true;
        }
        continue;
      }
      contracten.beeindig(c);
      if (naarGast(a.accountId, wacht ? 'regel-wacht' : 'regel-afgelopen').ok) uit[wacht ? 'wacht' : 'afgelopen']++;
      gewijzigd = true;
    }
    if (gewijzigd) save();
    return uit;
  };
};
