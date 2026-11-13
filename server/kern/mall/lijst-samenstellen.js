/* Eén domeinhandeling voor de hele selectie, binnen de duurzame brokerbundel.
   Herstel leest het bestaande ontvangstbewijs; nieuw aanbod wordt eerst geheel
   gecontroleerd. Geen halve lijst en geen tweede opslag. */
'use strict';
const lijstregel = require('./lijstregel');
module.exports = (ctx, { bak, actief, herstel, schoon, nu, MAX_LIJSTEN }) => {
  const { crypto, save } = ctx;
  return function samenstellen(key, data, bron) {
    const bestaand = herstel.vind(key, data, bron);
    if (bestaand) return bestaand;
    const binding = herstel.binding(key, data, bron);
    if (binding && binding.error) return binding;
    const naam = schoon(data && data.naam, 60), ids = data && data.ids;
    if (!naam || !Array.isArray(ids) || !ids.length || ids.length > 8 || new Set(ids).size !== ids.length)
      return { status: 400, error: 'Ongeldige selectie.' };
    if (actief(key).length >= MAX_LIJSTEN) return { status: 409, error: 'U heeft het maximum aantal lijsten bereikt.' };
    const gevraagd = new Set(ids), index = new Map(); let dubbel = false;
    const bezoek = a => { if (gevraagd.has(a.id)) { if (index.has(a.id)) dubbel = true; index.set(a.id, a); } };
    const aanbod = ctx.aanbodBezoek ? ctx.aanbodBezoek(bezoek) : ctx.aanbodAlles();
    if (!ctx.aanbodBezoek) for (const a of aanbod.aanbod) bezoek(a);
    if (dubbel || ids.some(id => !index.has(id) || (aanbod.stuk || []).some(s => s.bron === index.get(id).bron) ||
        (index.get(id).beschikbaar && index.get(id).beschikbaar.uit)))
      return { status: 409, error: 'Het aanbod is gewijzigd. Stel uw plan opnieuw samen.' };
    const at = nu(), lijst = { id: crypto.randomBytes(12).toString('hex'), naam, soort: 'lijst',
      plek: null, van: null, tot: null, at, regels: ids.map(id => lijstregel(index.get(id), at)) };
    if (binding) lijst.samenstellingBron = { ...binding, naam, aantal: lijst.regels.length };
    bak(key, true).unshift(lijst); save();
    return { ok: true, lijst: herstel.publiek(lijst),
      ontvangst: { id: lijst.id, naam, aantal: lijst.regels.length } };
  };
};
