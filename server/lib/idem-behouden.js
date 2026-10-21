/* Een beschermde ontvangst migreert binnen de bestaande duurzame bundel.
   Dezelfde inVlucht-poort beschermt replay tegen een nog onbevestigde migratie. */
'use strict';
const { nietVastgelegd } = require('./idem-zondersleutel');
module.exports = async ({ s, sleutel, afdruk, behouden, save, bijeen, duurzaam, naam, inVlucht }) => {
  let klaar;
  inVlucht.set(sleutel, { afdruk, belofte: new Promise(r => { klaar = r; }) });
  const voor = s._keys, na = voor.filter(k => !behouden(k));
  let uit;
  try {
    const migreer = () => { s._keys = na; save(); };
    if (bijeen) await bijeen(migreer, duurzaam ? { duurzaam: true } : undefined);
    else migreer();
    uit = Object.assign({}, s[sleutel], { herhaald: true });
  } catch (e) {
    // Behoud eventueel ondertussen toegevoegde gewone sleutels.
    if (s._keys === na) s._keys = [...new Set([...voor, ...na])];
    uit = nietVastgelegd(naam, e);
  } finally { inVlucht.delete(sleutel); }
  klaar(uit);
  return uit;
};
