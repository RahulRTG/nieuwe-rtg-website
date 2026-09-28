/* Het opslag- en cryptocontract van de cadeaukaart (zie ./cadeaukaart.js voor
   de levenscyclus): wat een toegang IS, hoe een code wordt genormaliseerd en
   gehasht, en wat er naar buiten mag. Hier staat nooit een kale code op
   schijf: die bestaat alleen in de terugkeerwaarde van nieuweToegang(). */
'use strict';

const klok = require('../lib/klok');

const DOEL = 'cadeaukaart-saldo';
const SCOPE = Object.freeze(['kassa.cadeaukaart.verzilveren']);
const GELDIG_MS = 365 * 86400000;
const MAX_GEBRUIK = 100;

module.exports = ({ crypto, nu = () => klok.datum().toISOString() }) => {
  const bearer = require('./bearercode')({ crypto, namespace: 'pay.giftcard_value_code', nu });
  /* Opmaak telt niet: `GC-1A2B-...`, `gc1a2b...` en een oude `RTG-GC-A1B2C3`
     worden allemaal eerst tot hun letters en cijfers teruggebracht. */
  const kaal = s => String(s == null ? '' : s).toUpperCase().replace(/[^0-9A-Z]/g, '');
  const codeHash = c => bearer.hash(kaal(c));
  const weergave = c => { const k = kaal(c); return k.slice(0, 2) + '-' + k.slice(2).match(/.{1,4}/g).join('-'); };
  const afdruk = s => crypto.createHash('sha256').update(String(s)).digest('hex');
  const sleutel = v => { const s = String(v == null ? '' : v).trim(); return /^[A-Za-z0-9_.:-]{1,128}$/.test(s) ? s : null; };

  function nieuweToegang(issuer, kaart, vervalt) {
    const g = bearer.maak({ prefix: 'GC', issuer, doel: DOEL, scope: SCOPE,
      onderwerp: { soort: 'cadeaukaart', id: kaart.id, supplierCode: kaart.supplierCode },
      geldigMs: GELDIG_MS, maxGebruik: MAX_GEBRUIK });
    g.toegang.code_hash = codeHash(g.code);
    if (vervalt) g.toegang.expires_at = vervalt;
    return { code: weergave(g.code), toegang: g.toegang };
  }

  /* Wat er naar buiten gaat: GEEN code en GEEN hash. */
  const naarBuiten = g => ({ id: g.id, supplierCode: g.supplierCode, supplierName: g.supplierName,
    bedrag: g.bedrag, saldo: g.saldo, kocht: g.kocht, at: g.at,
    stand: bearer.reden(g.toegang, { doel: DOEL, scope: SCOPE, negeerGebruik: true }) || 'actief',
    toegang: bearer.publiek(g.toegang), legacy24: !!g.legacy24 });

  return { bearer, kaal, codeHash, weergave, afdruk, sleutel, nieuweToegang, naarBuiten, nu,
    DOEL, SCOPE, GELDIG_MS, MAX_GEBRUIK };
};

module.exports.DOEL = DOEL;
module.exports.SCOPE = SCOPE;
module.exports.GELDIG_MS = GELDIG_MS;
module.exports.MAX_GEBRUIK = MAX_GEBRUIK;
