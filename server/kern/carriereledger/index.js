/* ============================================================================
   HET CARRIERE LEDGER -- de opslag. De regels staan in ./regels.js.

   EEN LEDGER IS GEEN LIJST DIE JE BIJWERKT. Er komt uitsluitend bij; niets
   wordt herschreven. Daarom staan er drie soorten regels in EEN reeks:

     feit          iemand stelt dat er iets gebeurd is
     bevestiging   iemand anders zegt dat hij dat heeft gezien of bevestigt
     intrekking    de schrijver haalt zijn eigen regel terug

   Een intrekking WIST NIETS. Dat is dezelfde regel als bij de machtiging
   (kern/vertegenwoordiging): intrekken stopt de toekomst en niet het verleden.
   Wie een feit kan laten verdwijnen, kan zijn ledger poetsen -- en dan is het
   geen bewijs meer maar een etalage.

   ER IS PRECIES EEN SCHRIJVER, en dat is `schrijfRegel()` hieronder. Zolang dat er
   een is, IS de reeks de waarheid; zodra het er twee zijn is hij een verslag dat
   meestal klopt (kern/service/loop.js, dezelfde reden).

   DE LEESKANT STAAT IN ./projectie.js, en de knip loopt langs het onderwerp:
   hier komt er iets BIJ de reeks, daar wordt de reeks GELEZEN. Dat is dezelfde
   snede als kern/service/zaak.js naast kern/service/loop.js, en de aanleiding
   was dezelfde als daar: dit bestand liep over de 10 kB van keuringsregel 13,
   en die grens is een dakpan die zegt dat er een tweede onderwerp in zit.
   ========================================================================== */
'use strict';

const R = require('./regels');

const MAX_REGELS = 500;

function maakCarriereLedger(state) {
  const { db, save, bijeen, inBundel, crypto, schoon, codenaamVan } = state;

  const vastleggen = require('../../lib/duurzaam')({ bijeen, save, inBundel, bron: 'carriereledger' });
  /* Beide collecties van dit domein staan in EEN declaratie. Twee aanroepen met
     dezelfde domeinnaam zouden werken, maar keuringsregel 54 leest declaraties
     en niet aanroepen -- en dan staat de eigendomsvraag op twee plekken. */
  const eigen = require('../eigencollectie')({ db, domein: 'kern/carriereledger',
    bezit: { carriereLedger: 'kaart', carriereDelen: 'lijst' } });

  const nu = () => new Date().toISOString();
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));
  const id = () => 'cl' + crypto.randomBytes(5).toString('hex');
  const naam = (k) => (codenaamVan && codenaamVan(k)) || 'een mens';

  const kaart = () => eigen.bak('carriereLedger');
  const kijk = () => eigen.kijk('carriereLedger') || {};

  /* Lezen maakt niets aan (kern/eigencollectie.js): een verzoek dat op 403 of
     404 eindigt hoort geen leeg ledger achter te laten voor iemand die er nooit
     een had. */
  const reeksKijk = (key) => ((kijk()[key] || {}).regels) || [];
  function reeks(key) {
    const k = kaart();
    if (!k[key] || !Array.isArray(k[key].regels)) k[key] = { regels: [] };
    return k[key].regels;
  }

  /* DE ENIGE SCHRIJVER. Kapt aan de voorkant zoals kern/service/loop.js, en
     houdt de eerste regel vast: het begin van een loopbaan is het stuk dat je
     nooit kwijt wilt.

     HIJ HEET GEEN `noteer`, en dat is met opzet. Die naam woont inmiddels in
     achttien kernmodules met achttien betekenissen -- precies de kostenpost die
     SEMANTIEK.json meet (103 namen met meer dan een betekenis). Hij naar de
     vorm van kern/service/loop.js noemen zou consistent LIJKEN en de negentiende
     betekenis toevoegen. `schrijfRegel` zegt wat er gebeurt. */
  function schrijfRegel(key, regel) {
    const rs = reeks(key);
    const r = Object.assign({ id: id(), at: nu() }, regel);
    rs.push(r);
    if (rs.length > MAX_REGELS) rs.splice(1, rs.length - MAX_REGELS);
    return r;
  }

  const { feitVan, weggehaald } = require('./projectie');

  /* DE DUBBELKLIK-GRENS, en hier weegt hij zwaarder dan elders. Een dubbeltik
     op een agenda geeft rommel die je weghaalt; in een LEDGER kan een regel
     alleen worden ingetrokken en nooit verdwijnen -- dus een tweede identieke
     regel vervuilt voorgoed, en juist op de plek die een mens naar buiten
     toont. De dubbeltik-ronde vond ze allebei (zet: 0 -> 2, bevestig: 0 -> 2).

     Dit is een TOESTANDSCONTROLE en geen duplicaatlaag (MUTATIECONTRACT.md par.
     5o): wat vaststaat is dat er geen tweede IDENTIEKE regel kan ontstaan. Wijk
     ergens van af -- een ander woord, een andere dag -- en het is een ander feit
     dat gewoon doorgaat. Een ingetrokken regel telt niet mee: die opnieuw zetten
     is een correctie en moet kunnen. */
  function alGezet(rs, gelijk) {
    const weg = weggehaald(rs);
    return rs.some(r => !weg.has(r.id) && gelijk(r));
  }

  /* ---------- schrijven ---------- */

  /* Een feit zetten doet de mens zelf, en de herkomst is dus altijd `zelf`.
     Dat is geen beperking maar de waarheid: op het moment van schrijven heeft
     niemand anders er iets van gezien. Een hogere herkomst komt er alleen bij
     doordat een ANDER hem toevoegt. */
  function zet(key, data) {
    const d = data || {};
    const voorstel = { kapitaal: scho(d.kapitaal, 20), herkomst: 'zelf',
      wat: scho(d.wat, 300), op: scho(d.op, 10) };
    const bezwaar = R.toets(Object.assign({}, voorstel,
      { bedragCenten: d.bedragCenten, bedrag: d.bedrag, cijfer: d.cijfer, punten: d.punten }), Date.now());
    if (bezwaar) return { status: 400, error: bezwaar };
    const rs = reeks(key);
    if (alGezet(rs, r => r.soort === 'feit' && r.kapitaal === voorstel.kapitaal &&
      r.wat === voorstel.wat && r.op === voorstel.op)) {
      return { status: 409, error: 'Deze regel staat er al, woord voor woord, op dezelfde dag. ' +
        'Een ledger kan niets wissen, dus een dubbele regel blijft staan. Is het echt iets anders, ' +
        'schrijf dat er dan bij.' };
    }
    const r = schrijfRegel(key, Object.assign({ soort: 'feit' }, voorstel,
      { toelichting: scho(d.toelichting, 600) || null }));
    vastleggen();
    return { status: 200, regel: r };
  }

  /* Een bevestiging hangt aan een feit en komt van een ANDER dan de eigenaar.
     `door` moet een naam of een zaak zijn: een bevestiging die op niemand terug
     te voeren is, is geen bevestiging (KANTOORMACHT.md -- een spoor dat eindigt
     bij een gedeelde code is een alibi). */
  function bevestig(key, fid, { herkomst, door, wat } = {}) {
    if (!R.HERKOMSTNAMEN.includes(herkomst) || herkomst === 'zelf') {
      return { status: 400, error: 'Een bevestiging is `gezien` of `bevestigd`; `zelf` zet de eigenaar.' };
    }
    const wie = scho(door, 120);
    if (!wie) {
      return { status: 403, error: 'Een bevestiging gaat op naam. Zonder naam is later niet te zien wie dit heeft bevestigd.' };
    }
    const rs = reeks(key);
    const f = scho(fid, 20);
    if (!feitVan(rs, f)) return { status: 404, error: 'Dit feit staat niet in dit ledger.' };
    const tekst = scho(wat, 300) || null;
    if (alGezet(rs, r => r.soort === 'bevestiging' && r.feit === f && r.herkomst === herkomst &&
      r.door === wie && r.wat === tekst)) {
      return { status: 409, error: 'Deze bevestiging staat er al, van dezelfde partij en met ' +
        'dezelfde tekst. Twee keer hetzelfde bevestigen maakt een feit niet harder.' };
    }
    const r = schrijfRegel(key, { soort: 'bevestiging', feit: f, herkomst, door: wie, wat: tekst });
    vastleggen();
    return { status: 200, regel: r };
  }

  /* Terugnemen. Werkt op een feit (de eigenaar) en op een bevestiging (wie hem
     gaf). In beide gevallen komt er een REGEL bij; de oorspronkelijke blijft
     staan en blijft leesbaar.

     HIJ HEET `trekRegelIn` EN NIET `intrek`, om dezelfde reden als `schrijfRegel`
     hierboven: `intrek` woont al in kern/rtgid-regie.js en kern/werkmail.js, en
     die trekken alle drie iets ANDERS terug. Een werkwoord zonder lijdend
     voorwerp is precies de vorm die SEMANTIEK.json duur maakt. De ROUTE blijft
     wel /intrek heten -- dat is de taal van buiten, en daar is het onderwerp uit
     het pad al duidelijk. */
  function trekRegelIn(key, rid, { door, reden } = {}) {
    const rs = reeks(key);
    const doel = rs.find(r => r.id === scho(rid, 20));
    if (!doel || doel.soort === 'intrekking') return { status: 404, error: 'Deze regel staat niet in dit ledger.' };
    if (rs.some(r => r.soort === 'intrekking' && r.doel === doel.id)) {
      return { status: 409, error: 'Deze regel is al ingetrokken.' };
    }
    const w = scho(reden, 300);
    if (!w) return { status: 400, error: 'Schrijf erbij waarom. Een intrekking zonder reden laat de lezer raden wat er niet klopte.' };
    const r = schrijfRegel(key, { soort: 'intrekking', doel: doel.id, door: scho(door, 120) || 'het lid', reden: w });
    vastleggen();
    return { status: 200, regel: r };
  }

  const { mijn, feit } = require('./projectie')({ reeksKijk, naam });

  const delen = require('./deel')({ eigen, crypto, schoon: scho, save, bijeen, inBundel, feit, naam });

  return { zet, bevestig, intrek: trekRegelIn, mijn, feit, naam,
    deel: delen.deel, toon: delen.toon, mijnDelen: delen.mijnDelen, stopDelen: delen.stop };
}

module.exports = { maakCarriereLedger, MAX_REGELS };
