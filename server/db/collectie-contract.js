/* Het invoercontract van de bestaande collectiepoort, gedeeld door de drie
   opslaguitwerkingen. Een getypeerde map is expliciet: geen coercie naar een
   KV-naam en geen herstel van corrupte of verwijderde ontvangsten als leeg. */
'use strict';
const fout = (code, tekst) => Object.assign(new Error(tekst), { code });
const kaart = x => x && typeof x === 'object' &&
  [Object.prototype, null].includes(Object.getPrototypeOf(x));

module.exports = function collectieContract(invoer, werk) {
  if (typeof werk !== 'function') throw fout('COLLECTIE_CONTRACT', 'Collectietransactie vereist een synchrone bewerker.');
  if (typeof invoer === 'string') {
    const sleutel = invoer.trim();
    if (!sleutel || sleutel.length > 120) throw fout('COLLECTIE_CONTRACT', 'Ongeldige collectiesleutel.');
    return { getypeerd: false, sleutels: [sleutel], leeg: () => ({}),
      controleer: () => {}, verwijderd: () => {}, controleerMap: () => {} };
  }
  if (!kaart(invoer)) throw fout('COLLECTIE_CONTRACT', 'Een collectiecontract vereist een eigen map van typen.');
  const typen = Object.create(null), sleutels = Reflect.ownKeys(invoer);
  if (!sleutels.length) throw fout('COLLECTIE_CONTRACT', 'Een collectiecontract mag niet leeg zijn.');
  for (const k of sleutels) {
    const d = Object.getOwnPropertyDescriptor(invoer, k);
    if (typeof k !== 'string' || !/^[A-Za-z_$][A-Za-z0-9_$-]{0,119}$/.test(k) ||
        (Object.hasOwn(Object.prototype, k) || k === 'prototype') || !d.enumerable ||
        !Object.hasOwn(d, 'value') || !['lijst', 'kaart'].includes(d.value))
      throw fout('COLLECTIE_CONTRACT', 'Ongeldige collectienaam of type; gebruik lijst of kaart.');
    typen[k] = d.value;
  }
  sleutels.sort();
  function controleer(k, waarde) {
    if (typen[k] === 'lijst' ? !Array.isArray(waarde) : !kaart(waarde))
      throw fout('COLLECTIE_TYPE', 'De collectie ' + k + ' heeft niet de afgesproken containervorm.');
    // Controleer ook inhoud: JSON laat undefined/functies/arraymetadata weg.
    // Dat mag geen opgeslagen ontvangst simuleren. Geen getters/toJSON,
    // exotische objecten, niet-eindige getallen, gaten of cyclische structuren.
    const gezien = new Set();
    function json(x) {
      if (x === null || ['string', 'boolean'].includes(typeof x)) return;
      if (typeof x === 'number' && Number.isFinite(x)) return;
      const lijst = Array.isArray(x);
      if ((!lijst && !kaart(x)) || gezien.has(x))
        throw fout('COLLECTIE_TYPE', 'De collectie ' + k + ' bevat niet-opslagbare inhoud.');
      gezien.add(x);
      const namen = Reflect.ownKeys(x);
      if (lijst && namen.length !== x.length + 1)
        throw fout('COLLECTIE_TYPE', 'De collectie ' + k + ' bevat lijstgaten of metadata.');
      for (const naam of namen) {
        if (lijst && naam === 'length') continue;
        const d = Object.getOwnPropertyDescriptor(x, naam);
        if (typeof naam !== 'string' || !d.enumerable || !Object.hasOwn(d, 'value') ||
            ['toJSON', '__proto__', 'constructor', 'prototype'].includes(naam) ||
            (lijst && (!/^(0|[1-9]\d*)$/.test(naam) || Number(naam) >= x.length)))
          throw fout('COLLECTIE_TYPE', 'De collectie ' + k + ' bevat niet-opslagbare eigenschappen.');
        json(d.value);
      }
      gezien.delete(x);
    }
    json(waarde);
  }
  return { getypeerd: true, sleutels,
    context: paren => Object.freeze({ bestaat: Object.freeze(Object.fromEntries(paren)) }),
    leeg: k => typen[k] === 'lijst' ? [] : {}, controleer,
    verwijderd: k => { throw fout('COLLECTIE_VERWIJDERD', 'De collectie ' + k + ' is verwijderd; herstel is vereist.'); },
    controleerMap(waarden) {
      if (Reflect.ownKeys(waarden).length !== sleutels.length)
        throw fout('COLLECTIE_TYPE', 'De bewerker mag alleen de afgesproken collecties bewerken.');
      for (const k of sleutels) {
        const d = Object.getOwnPropertyDescriptor(waarden, k);
        if (!d || !Object.hasOwn(d, 'value')) throw fout('COLLECTIE_TYPE', 'Een afgesproken collectie ontbreekt.');
        controleer(k, d.value);
      }
    }
  };
};
