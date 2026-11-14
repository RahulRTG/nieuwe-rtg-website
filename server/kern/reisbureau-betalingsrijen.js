/* Herstelbare projectie van één bewezen Pay-boeking. De bestaande geldlaag
   blijft eigenaar; deze schrijver krijgt haar collecties doorgegeven. */
'use strict';

const { createHash } = require('node:crypto');
const idVoor = (soort, delen) => soort + '-' + createHash('sha256').update(JSON.stringify(delen)).digest('hex');

module.exports = ({ eigen, bewerkCollectie, save }) => async function bewaar(ref, boeking, rijen, at) {
  const typen = { reisGeldrijen: 'lijst', reisUitkeringen: 'lijst' };
  const werk = data => {
    // Oude of beschadigde projecties worden niet ongemerkt nogmaals opgebouwd.
    const ids = new Set(rijen.map((_, i) => idVoor('RGH', [ref, boeking.id, i])));
    if (data.reisGeldrijen.some(g => g.ref === ref && !g.spiegelVan && !ids.has(g.id)))
      return { status: 409, error: 'Er bestaat een afwijkende geldprojectie voor deze reis; financiële aansluiting is vereist.' };
    const nieuw = [], uitkeringen = [];
    for (const [i, r] of rijen.entries()) {
      const rij = {
        id: idVoor('RGH', [ref, boeking.id, i]), ref, at,
        bedragCenten: r.bedragCenten, valuta: r.valuta,
        economischeHerkomst: r.economischeHerkomst,
        economischeEigenaar: r.economischeEigenaar, naarWie: r.naarWie,
        grond: r.grond, bronObject: r.bronObject, relatie: r.relatie,
        land: r.land, bewijs: r.bewijs
      };
      const bestaand = data.reisGeldrijen.find(g => g.id === rij.id);
      if (bestaand && Object.keys(rij).some(k => k !== 'at' && bestaand[k] !== rij[k]))
        return { status: 409, error: 'Een bewaarde geldrij wijkt af van de bewezen betaling; herstel is vereist.' };
      if (!bestaand) nieuw.push(rij);
      if (r.economischeEigenaar === 'rtg') continue;
      const u = { id: idVoor('RUK', [rij.id]), geldrij: rij.id, ref, at,
        centen: r.bedragCenten, valuta: r.valuta, economischeHerkomst: r.economischeHerkomst,
        aan: r.economischeEigenaar, relatie: r.relatie, grond: r.grond,
        uitgevoerd: false, hoe: 'klaargezet; een mens van het kantoor voert hem uit langs kern/pay (GELD.md)' };
      const vorige = data.reisUitkeringen.find(x => x.geldrij === rij.id);
      if (vorige && ['id', 'geldrij', 'ref', 'centen', 'valuta', 'economischeHerkomst', 'aan', 'relatie', 'grond']
        .some(k => vorige[k] !== u[k]))
        return { status: 409, error: 'Een uitkering wijkt af van haar geldrij; financiële aansluiting is vereist.' };
      if (!vorige) uitkeringen.push(u);
    }
    data.reisGeldrijen.push(...nieuw);
    data.reisUitkeringen.push(...uitkeringen);
    return { ok: true };
  };
  if (typeof bewerkCollectie === 'function') return bewerkCollectie(typen, werk);
  const oud = Object.fromEntries(Object.keys(typen).map(k => [k, { bestaat: eigen.bestaat(k), waarde: eigen.kijk(k) }]));
  const data = Object.fromEntries(Object.keys(typen).map(k => [k, JSON.parse(JSON.stringify(oud[k].waarde))]));
  const r = werk(data);
  if (!r.ok) return r;
  for (const k of Object.keys(typen)) eigen.zetBak(k, data[k]);
  try { save(); } catch (e) {
    // In-memory proeven herstellen ook na een opslagfout; echte opslag gebruikt
    // altijd bovenstaande multi-collectietransactie.
    for (const k of Object.keys(typen)) eigen.zetBak(k, oud[k].waarde);
    throw e;
  }
  return r;
};
