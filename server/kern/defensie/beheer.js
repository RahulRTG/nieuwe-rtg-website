/* De defensie-toren, deelbestand "beheer": eenheden en paraatheid, het materieelpark
   en de onderhoudsketen, de bevoorrading (aangevraagd -> goedgekeurd -> geleverd) en
   de oefen-/trainingsagenda. Puur organisatie en logistiek, geen gevechtsfunctie.
   Krijgt de gedeelde ctx van kern/defensie/index.js. */
module.exports = (ctx) => {
  const { crypto, save, nu, schoon, bak, PARAAT, MAT_SOORTEN, MAT_STAAT, BEV_SOORTEN, BEV_KETEN } = ctx;

  /* ---------- eenheden en paraatheid ---------- */
  function eenheidMaak(code, b) {
    const naam = schoon(b.naam, 60);
    if (!naam) return { status: 400, error: 'Hoe heet de eenheid?' };
    const d = bak(code);
    if (d.eenheden.length >= 200) return { status: 400, error: 'Het maximum aantal eenheden op dit bord is bereikt.' };
    const e = { id: crypto.randomBytes(4).toString('hex'), naam, soort: schoon(b.soort, 30) || 'eenheid', paraat: 'gevechtsgereed', reden: '', sterkte: Math.max(0, Math.min(100000, Math.round(Number(b.sterkte) || 0))), at: nu() };
    d.eenheden.unshift(e);
    save();
    return { ok: true, eenheid: e };
  }
  function paraatZet(code, id, paraat, reden) {
    const e = bak(code).eenheden.find(x => x.id === id);
    if (!e) return { status: 404, error: 'Deze eenheid staat niet op het bord.' };
    if (!PARAAT.includes(paraat)) return { status: 400, error: 'Kies gevechtsgereed, beperkt, in-onderhoud of niet-inzetbaar.' };
    e.paraat = paraat;
    e.reden = schoon(reden, 200);
    e.at = nu();
    save();
    return { ok: true, eenheid: e };
  }

  /* ---------- materieel en onderhoud ---------- */
  function materieelMaak(code, b) {
    const naam = schoon(b.naam, 60);
    if (!naam) return { status: 400, error: 'Welk materieel?' };
    if (!MAT_SOORTEN.includes(b.soort)) return { status: 400, error: 'Kies een soort: ' + MAT_SOORTEN.join(', ') + '.' };
    const m = { id: crypto.randomBytes(4).toString('hex'), naam, soort: b.soort, kenmerk: schoon(b.kenmerk, 40), staat: 'inzetbaar', notitie: '', at: nu() };
    bak(code).materieel.unshift(m);
    save();
    return { ok: true, materieel: m };
  }
  function materieelZet(code, id, staat, notitie) {
    const m = bak(code).materieel.find(x => x.id === id);
    if (!m) return { status: 404, error: 'Dit materieel staat niet in het park.' };
    if (!MAT_STAAT.includes(staat)) return { status: 400, error: 'Kies inzetbaar, in-onderhoud of defect.' };
    m.staat = staat;
    m.notitie = schoon(notitie, 200);
    m.at = nu();
    save();
    return { ok: true, materieel: m };
  }

  /* ---------- bevoorrading: aanvraag tot levering ---------- */
  function bevoorradingMaak(code, b) {
    if (!BEV_SOORTEN.includes(b.soort)) return { status: 400, error: 'Kies een soort: ' + BEV_SOORTEN.join(', ') + '.' };
    const wat = schoon(b.wat, 120);
    if (!wat) return { status: 400, error: 'Wat is er nodig?' };
    const v = { id: crypto.randomBytes(4).toString('hex'), soort: b.soort, wat, aantal: schoon(b.aantal, 40),
      prioriteit: ['hoog', 'normaal', 'laag'].includes(b.prioriteit) ? b.prioriteit : 'normaal', status: 'aangevraagd', logboek: [], at: nu() };
    v.logboek.push({ at: nu(), wat: 'Aangevraagd (' + v.prioriteit + ')' });
    bak(code).bevoorrading.unshift(v);
    save();
    return { ok: true, verzoek: v };
  }
  function bevoorradingZet(code, id, status) {
    const v = bak(code).bevoorrading.find(x => x.id === id);
    if (!v) return { status: 404, error: 'Dit verzoek staat niet op het bord.' };
    if (!BEV_KETEN.includes(status)) return { status: 400, error: 'Onbekende status.' };
    v.status = status;
    v.logboek.push({ at: nu(), wat: status });
    if (v.logboek.length > 20) v.logboek.shift();
    save();
    return { ok: true, verzoek: v };
  }

  /* ---------- oefeningen: de trainingsagenda ---------- */
  function oefeningMaak(code, b) {
    const naam = schoon(b.naam, 80);
    if (!naam) return { status: 400, error: 'Hoe heet de oefening?' };
    const o = { id: crypto.randomBytes(4).toString('hex'), naam, wanneer: schoon(b.wanneer, 40), locatie: schoon(b.locatie, 60), doel: schoon(b.doel, 200), status: 'gepland', at: nu() };
    bak(code).oefeningen.unshift(o);
    save();
    return { ok: true, oefening: o };
  }
  function oefeningZet(code, id, status) {
    const o = bak(code).oefeningen.find(x => x.id === id);
    if (!o) return { status: 404, error: 'Deze oefening staat niet in de agenda.' };
    if (!['gepland', 'bezig', 'afgerond', 'afgelast'].includes(status)) return { status: 400, error: 'Onbekende status.' };
    o.status = status;
    save();
    return { ok: true, oefening: o };
  }

  return { eenheidMaak, paraatZet, materieelMaak, materieelZet, bevoorradingMaak, bevoorradingZet, oefeningMaak, oefeningZet };
};
