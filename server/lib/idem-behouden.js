/* Een beschermde ontvangst migreert binnen de bestaande duurzame bundel.
   Dezelfde inVlucht-poort beschermt replay tegen een nog onbevestigde migratie. */
'use strict';
const { nietVastgelegd } = require('./idem-zondersleutel');
function ontvangstGeldig({ s, a, sleutel, afdruk, geldigeOntvangst }) {
  return Object.hasOwn(a, sleutel) && typeof a[sleutel] === 'string' && !!a[sleutel] && !!afdruk &&
    !!s[sleutel] && typeof s[sleutel] === 'object' && !Array.isArray(s[sleutel]) && s[sleutel].ok === true &&
    (typeof geldigeOntvangst !== 'function' || geldigeOntvangst(sleutel, s[sleutel]));
}

async function migreer({ s, sleutel, afdruk, behouden, save, bijeen, duurzaam, naam, inVlucht }) {
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
}

async function herhaal(opties) {
  const { s, a, sleutel, afdruk, geldigeOntvangst } = opties;
  if (!ontvangstGeldig({ s, a, sleutel, afdruk, geldigeOntvangst }))
    return { status: 503, code: 'IDEMPOTENTIEBEWIJS_ONGELDIG', error: 'De bewaarde ontvangst vereist herstel.' };
  return s._keys.includes(sleutel) ? migreer(opties) : Object.assign({}, s[sleutel], { herhaald: true });
}

module.exports = migreer;
module.exports.ontvangstGeldig = ontvangstGeldig;
module.exports.herhaal = herhaal;
