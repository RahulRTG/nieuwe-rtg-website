/* RTG Festival (deelmodule): DE RIDER EN DE AFREKENING.

   Afgesplitst van ./artiest.js op de 10 kB-grens, langs een echte naad: daar
   staat WANNEER er gespeeld wordt, hier staat wat er dan klaar moet staan en
   wat er daarna nog open staat.

   DE RIDER IS BEWUST GEEN CONTROL UIT ./gereed.js. Daar hoort bewijs bij dat
   een tweede mens aftekent en dat verloopt; een gitaarcabinet is er wel of
   niet. Diezelfde machinerie eroverheen leggen maakt het afvinken zwaarder
   zonder dat het iets zekerder wordt.

   DE AFREKENING IS EEN OVERZICHT EN GEEN BETALING. Er wordt hier niets geind en
   niets overgemaakt; dit is het bedrag waarover een mens een besluit neemt. Die
   zin staat ook IN de uitkomst, want wie deze data via een ander scherm leest,
   hoort hem net zo goed te zien. */
'use strict';

module.exports = (ctx) => {
  const { save, crypto, schoon, editieVind } = ctx;

  const nuIso = () => new Date().toISOString();
  const heelBedrag = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);
  const bak = (e) => {
    if (!e.boekingen || typeof e.boekingen !== 'object') e.boekingen = {};
    return e.boekingen;
  };

  function riderZet(fid, eid, data) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const d = data || {};
    const x = bak(e)[String(d.boeking || '')];
    if (!x) return { status: 404, error: 'Deze boeking bestaat niet.' };
    const wat = schoon(d.wat, 120);
    if (!wat) return { status: 400, error: 'Wat moet er zijn?' };
    if (x.rider.length >= 200) return { status: 400, error: 'Tot tweehonderd riderpunten per boeking.' };
    const item = { id: 'rid' + crypto.randomBytes(3).toString('hex'), wat, klaar: false, door: null };
    x.rider.push(item);
    save();
    return { ok: true, boeking: x, item };
  }

  function riderVink(fid, eid, data) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const d = data || {};
    const x = bak(e)[String(d.boeking || '')];
    if (!x) return { status: 404, error: 'Deze boeking bestaat niet.' };
    const item = (x.rider || []).find(r => r.id === String(d.item || ''));
    if (!item) return { status: 404, error: 'Dit riderpunt bestaat niet.' };
    const door = schoon(d.door, 60);
    if (!door) return { status: 400, error: 'Wie vinkt dit af?' };
    item.klaar = d.klaar !== false;
    item.door = item.klaar ? door : null;
    item.at = item.klaar ? nuIso() : null;
    save();
    return { ok: true, item };
  }

  const riderOpen = (x) => (x.rider || []).filter(r => !r.klaar).length;

  /* ---- de afrekening ----
     Een OVERZICHT en geen betaling. Er wordt hier niets geind en niets
     overgemaakt; dit is het bedrag waarover een mens een besluit neemt. */
  function afrekening(fid, eid, id) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const x = bak(e)[String(id || '')];
    if (!x) return { status: 404, error: 'Deze boeking bestaat niet.' };
    const extras = (x.extras || []).reduce((t, r) => t + (r.centen || 0), 0);
    const open = (x.gage || 0) + extras - (x.voorschot || 0);
    return { ok: true, boeking: x.id, artiest: x.artiest, stand: x.stand,
      gage: x.gage || 0, voorschot: x.voorschot || 0, extras, openstaand: open,
      betaald: false,
      /* Deze zin staat er met opzet IN de uitkomst en niet alleen in een scherm:
         wie deze data leest via een ander scherm, hoort hem ook te zien. */
      let_op: 'Dit is een overzicht. Er is niets geind en niets overgemaakt.' };
  }

  function extraZet(fid, eid, data) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const d = data || {};
    const x = bak(e)[String(d.boeking || '')];
    if (!x) return { status: 404, error: 'Deze boeking bestaat niet.' };
    const wat = schoon(d.wat, 120);
    if (!wat) return { status: 400, error: 'Waarvoor is deze post?' };
    x.extras.push({ id: 'ex' + crypto.randomBytes(3).toString('hex'), wat, centen: heelBedrag(d.centen) });
    save();
    return { ok: true, boeking: x };
  }

  return { riderZet, riderVink, riderOpen, afrekening, extraZet };
};
