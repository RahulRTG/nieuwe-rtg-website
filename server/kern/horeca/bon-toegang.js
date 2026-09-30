/* Het opslag- en cryptocontract van de horecabon (deur
   horeca.bon_en_polsbandsaldo; de levenscyclus staat in ./bon.js). Wat een
   toegang IS, hoe een code wordt genormaliseerd en gehasht, en wat er naar
   buiten mag. Een kale code bestaat alleen in de terugkeerwaarde van
   nieuweBonToegang() -- nooit op schijf.

   TWEE SOORTEN, EEN GRENS PER SOORT:
   - cadeaubon en tegoed: een jaar geldig, hooguit 100 afboekingen (een bon
     wordt in delen betaald; het saldo is de echte grens, de teller houdt een
     gelekte code die blijft proberen op een vast aantal);
   - polsband: dertig dagen geldig en 10000 afboekingen. Een band wordt de hele
     avond voor elk drankje gebruikt, dus een lage teller zou de gast halverwege
     buitensluiten; wat een band begrenst is zijn SALDO (nooit onder nul, en
     opwaarderen gebeurt alleen door de zaak) en zijn KORTE geldigheid. */
'use strict';

const klok = require('../../lib/klok');

const DOEL = 'horeca-bon-saldo';
const SCOPE = Object.freeze(['horeca.bon.afboeken']);
const DAG = 86400000;
const GRENS = Object.freeze({
  bon: Object.freeze({ geldigMs: 365 * DAG, maxGebruik: 100, prefix: 'HB' }),
  band: Object.freeze({ geldigMs: 30 * DAG, maxGebruik: 10000, prefix: 'PB' })
});

module.exports = ({ crypto, nu = () => klok.datum().toISOString() }) => {
  const bearer = require('../bearercode')({ crypto, namespace: 'horeca.bon_en_polsbandsaldo', nu });
  /* Opmaak telt niet: `HB-1A2B-...`, `hb1a2b...` en een oude `1A2B3C4D` worden
     allemaal eerst tot hun letters en cijfers teruggebracht. */
  const kaal = s => String(s == null ? '' : s).toUpperCase().replace(/[^0-9A-Z]/g, '');
  const codeHash = c => bearer.hash(kaal(c));
  const weergave = c => { const k = kaal(c); return k.slice(0, 2) + '-' + k.slice(2).match(/.{1,4}/g).join('-'); };
  const afdruk = s => crypto.createHash('sha256').update(String(s)).digest('hex');
  const sleutel = v => { const s = String(v == null ? '' : v).trim(); return /^[A-Za-z0-9_.:-]{1,128}$/.test(s) ? s : null; };
  const grensVan = bon => (bon && bon.band ? GRENS.band : GRENS.bon);

  /* `vervalt` (JJJJ-MM-DD van de zaak) mag de geldigheid INKORTEN, nooit
     verlengen voorbij de grens van de soort. */
  function nieuweBonToegang(issuer, bon, vervalt) {
    const g = grensVan(bon);
    const t = bearer.maak({ prefix: g.prefix, issuer, doel: DOEL, scope: SCOPE,
      onderwerp: { soort: bon.band ? 'polsband' : bon.soort, id: bon.id, zaak: bon.zaak },
      geldigMs: g.geldigMs, maxGebruik: g.maxGebruik });
    t.toegang.code_hash = codeHash(t.code);
    const eind = /^\d{4}-\d{2}-\d{2}$/.test(String(vervalt || '')) ? Date.parse(vervalt + 'T23:59:59.999Z') : NaN;
    if (Number.isFinite(eind) && eind < Date.parse(t.toegang.expires_at)) t.toegang.expires_at = new Date(eind).toISOString();
    return { code: weergave(t.code), toegang: t.toegang };
  }

  const stand = b => bearer.reden(b.toegang, { doel: DOEL, scope: SCOPE, negeerGebruik: true }) || 'actief';
  /* Wat er naar buiten gaat: GEEN code, GEEN hash en geen sessiebinding. */
  const naarBuiten = b => ({ id: b.id, soort: b.soort, band: b.band || null, naam: b.naam || null,
    saldo: b.saldo, uitgegeven: b.uitgegeven, at: b.at, stand: stand(b),
    geldigTot: b.toegang ? String(b.toegang.expires_at).slice(0, 10) : null,
    toegang: bearer.publiek(b.toegang), legacy32: !!b.legacy32,
    mutaties: (b.mutaties || []).slice(-10).reverse().map(m => ({ at: m.at, centen: m.centen, soort: m.soort || null })) });

  return { bearer, kaal, codeHash, weergave, afdruk, sleutel, grensVan, nieuweBonToegang, naarBuiten, stand, nu,
    DOEL, SCOPE, GRENS };
};

module.exports.DOEL = DOEL;
module.exports.SCOPE = SCOPE;
module.exports.GRENS = GRENS;
