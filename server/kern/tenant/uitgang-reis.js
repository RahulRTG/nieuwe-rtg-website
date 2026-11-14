/* Dezelfde uitgang, catalogus en checksum voor een beperkte zaakzelfexport.
   Het archief blijft onder één inert veld; nooit in reisAanvragen/Pay/staff. */
'use strict';
const { reisverklaring, zonderGeheim } = require('./uitgang-grens');
const VERBODEN = new Set(['customerKey', 'actorRef', 'rtgKey', 'token', 'beheerToken', 'lidToken',
  'sessies', 'beheerSessies', 'economischeSleutel', 'startsleutel', 'startafdruk', 'ontvangsten', 'sleutel',
  '__proto__', 'prototype', 'constructor']);
function geldig(a) {
  const { object, veiligeJSON } = require('./uitgang-validatie');
  const tekst = v => typeof v === 'string' && !!v.trim();
  if (!a || a.schemaVersion !== 1 || a.status !== 'documentair' || a.operationeelHerstel !== false ||
      !a.scope || a.scope.soort !== 'zaak' || !['verkoper', 'aanbieder'].includes(a.scope.rol) ||
      typeof a.scope.org !== 'string' || !a.scope.org || typeof a.scope.supplierCode !== 'string' || !a.scope.supplierCode ||
      !Array.isArray(a.reizen) || !a.dekking || !Array.isArray(a.dekking.volledig) || !Array.isArray(a.dekking.nietGedekt) ||
      !a.dekking.volledig.every(tekst) || !a.dekking.nietGedekt.every(tekst) ||
      a.reizen.some(r => !object(r) || !tekst(r.ref) || !Number.isSafeInteger(r.versie) || r.versie < 1 || !tekst(r.status)) ||
      !veiligeJSON(a)) return false;
  const schoon = v => !v || typeof v !== 'object' || Object.keys(v).every(k => !VERBODEN.has(k) && schoon(v[k]));
  return schoon(a);
}

function maak({ archief, catalogus, som, versie }) {
  if (!geldig(archief)) return { status: 400, error: 'Dit reisarchief draagt geen veilige documentaire zaakscope.' };
  const inhoud = { reisketenUitgang: reisverklaring(), reisarchief: zonderGeheim(archief) };
  const cat = catalogus(inhoud);
  return { ok: true, uitvoer: { versie, status: 'gedeeltelijk', at: archief.at,
    tenant: { org: archief.scope.org, naam: archief.naam, modus: 'zaakzelfexport' }, merk: null,
    werkruimte: { code: null, naam: 'Reisarchief ' + archief.naam, land: null, valuta: 'EUR', taal: 'nl', moeder: null },
    inhoud, catalogus: cat, checksum: som(cat),
    recept: 'checksum per soort = sha256(canonieke JSON van die soort); checksum van de uitvoer = sha256(canonieke JSON van de catalogus). ' +
      'Canoniek = JSON met de sleutels van elk object alfabetisch gesorteerd, zonder witruimte.',
    let: 'Zaakgebonden zelfexport, geen volledige tenantuitgang. De gedekte en niet-gedekte geschiedenis staan checksum-gedekt in reisarchief.dekking. ' +
      'Inlezen maakt uitsluitend een nieuw leesarchief, nooit live reizen, bevoegdheden, leveranciersacceptaties of betaalbewijzen.' } };
}
module.exports = { maak, geldig };
