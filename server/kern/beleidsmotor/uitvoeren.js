/* ENFORCE_EXECUTE IN DE SCHADUW -- besluit 3 van de eigenaar (11 oktober 2026).

   De volgorde van dat besluit is (a) individuele passkey-identificatie aan de
   deur, (b) schaduwmetingen, (c) pas daarna gecontroleerd afdwingen. Dit bestand
   is (b), en het is met opzet ALLEEN (b): er is geen tak waarlangs een verzoek
   wordt tegengehouden. Afdwingen gaat later langs ./afdwingen.js, met een eigen
   besluit en een rijpe schaduw -- en die rijpheid is wat hier ontstaat.

   WAT ER GETELD WORDT. Na elk kantoorverzoek dat (1) door een kantoordeur van de
   motor ging, (2) werkelijk is uitgevoerd (status onder 400) en (3) UITVOEREND is
   -- niet alleen lezend -- telt de regel welke SOORT identiteit erachter stond:
   passkey, opNaam, eigenaarToken of gedeeld (../kantoor/productiedeur.js
   identiteitVan). Alles behalve `passkey` zou bij afdwingen zijn tegengehouden.

   UITVOEREND, EN NIET "ELKE POST". Dit huis doet alles over POST, ook lezen. De
   classificatie is die van MUTATIECONTRACT.md en komt uit het register dat er al
   is (server/lib/mutatiecontracten.js): een route met stand NOT_APPLICABLE is
   AANTOONBAAR lezend (twee onafhankelijke metingen), en GET/HEAD/OPTIONS zijn het
   per definitie. Al het andere telt als uitvoerend -- ook een route zonder
   contract, en die heet dan `ongeclassificeerd` en wordt niet stil een lezing.
   Een ondergrens voor lezen is de veilige kant: een lezing die als uitvoerend
   telt, maakt de werklijst te lang; een uitvoering die als lezing telt, verbergt
   een handeling die bij afdwingen zou zakken.

   EEN TELLER EN GEEN JOURNAAL -- de grens van ../kantoor/mensdeur.js en van de
   lidpoort-les (CLAUDE.md, AFSPRAAK.md stap 3): de sleutel is klasse + methode +
   ROUTEPATROON, de waarden zijn vier getallen. Geen sessiesleutel, geen
   codenaam, geen tijdstip. Het product is een getal per route en per klasse; wie
   hier een identiteit bij zet, maakt een lijst medewerkers van wie de handeling
   bij afdwingen zou zakken, zonder bewaartermijn. Dat is een besluit, geen detail. */
'use strict';

const SOORTEN = Object.freeze(['passkey', 'opNaam', 'eigenaarToken', 'gedeeld']);
const LEZEND = new Set(['GET', 'HEAD', 'OPTIONS']);
const VOORVOEGSEL = 'uitvoer ';

/* Het mutatiecontract-register lui laden: het is groot en de motor moet ook
   zonder kunnen meten (dan is elke niet-GET `ongeclassificeerd`). */
let contracten = null;
function mutatieContract(sleutel) {
  if (contracten === null) {
    try { contracten = require('../../lib/mutatiecontracten').CONTRACTEN || {}; } catch (e) { contracten = {}; }
  }
  return contracten[sleutel] || null;
}

/* Is deze route uitvoerend, en in welke klasse? `null` = lezend, telt niet. */
function uitvoerKlasse(methode, patroon) {
  const m = String(methode || 'GET').toUpperCase();
  if (LEZEND.has(m)) return null;
  const c = mutatieContract(m + ' ' + patroon);
  if (c && c.stand === 'NOT_APPLICABLE') return null;
  return c && c.stand ? c.stand : 'ongeclassificeerd';
}

/* DE TELLER HANGT IN DE POORTWIKKEL (./index.js bewaak) en niet in een meelezer
   op /api/office: een kantoordeur van de motor bewaakt ook ruim vierhonderd
   routes BUITEN dat voorvoegsel (/api/rtfos, /api/command, /api/lab2,
   /api/appstore/kantoor, ...), en een meelezer op het voorvoegsel zou die stil
   overslaan. De soort identiteit komt uit de feiten die de wikkel bij
   BINNENKOMST al vaststelt (een route kan de eigen sessie beeindigen) en wordt
   pas na afloop geteld. Een keer per verzoek, ook bij twee deuren achter elkaar. */
function maakUitvoeren({ tikVeld, naAfloop }) {
  function telBijBinnenkomst(req, res, feiten) {
    if (req.beleidsUitvoer || LEZEND.has(String(req.method || 'GET').toUpperCase())) return;
    req.beleidsUitvoer = true;
    const identiteit = feiten && feiten.identiteit;
    naAfloop(req, res, () => tel(req, res.statusCode, identiteit));
  }
  /* Na afloop, met de feiten die de motor al had. `identiteit` is de soort uit
     ./feiten.js; ontbreekt hij (een bron kon niet antwoorden), dan telt er niets
     -- ONBEKEND is geen "zou zakken", en geen "zou doorgaan". */
  function tel(req, statusCode, identiteit) {
    if (!req || !req.routePatroon || statusCode >= 400) return;
    if (!req.beleidsPoorten || !req.beleidsPoorten.length) return;   // geen kantoordeur: A3 telt dat al
    const klasse = uitvoerKlasse(req.method, req.routePatroon);
    if (!klasse) return;
    const via = identiteit && identiteit.via;
    if (!SOORTEN.includes(via)) return;
    tikVeld(VOORVOEGSEL + klasse + ' ' + (req.method || 'POST') + ' ' + req.routePatroon, via);
  }
  return { tel, telBijBinnenkomst };
}

/* De lezing van de tellers, voor ./stand.js. Per klasse en per route; de
   werklijst is wat bij afdwingen zou zakken, gesorteerd op hoe vaak. */
function lees(rijen) {
  const perKlasse = {};
  const routes = [];
  for (const r of rijen) {
    const rest = r.pad.slice(VOORVOEGSEL.length);
    const spatie = rest.indexOf(' ');
    const klasse = rest.slice(0, spatie), route = rest.slice(spatie + 1);
    const t = {};
    for (const s of SOORTEN) t[s] = r[s] || 0;
    const zouZakken = t.opNaam + t.eigenaarToken + t.gedeeld;
    routes.push(Object.assign({ klasse, route }, t, { zouZakken }));
    const k = perKlasse[klasse] || (perKlasse[klasse] = { routes: 0, routesDieZoudenZakken: 0, waarnemingen: 0, zouZakken: 0,
      passkey: 0, opNaam: 0, eigenaarToken: 0, gedeeld: 0 });
    k.routes += 1;
    if (zouZakken) k.routesDieZoudenZakken += 1;
    k.waarnemingen += t.passkey + zouZakken;
    k.zouZakken += zouZakken;
    for (const s of SOORTEN) k[s] += t[s];
  }
  const zakkend = routes.filter(r => r.zouZakken > 0).sort((a, b) => b.zouZakken - a.zouZakken);
  return {
    regel: 'ENFORCE_EXECUTE',
    uitleg: 'Besluit 3 (11 oktober 2026), stap b: een uitvoerende kantoorhandeling vraagt een bewezen individu ' +
      '(op naam, met een passkey aan de deur). Telt alleen; houdt niets tegen.',
    grens: 'Een teller en geen journaal: per route en klasse hoe vaak welke SOORT identiteit erachter stond, ' +
      'zonder wie of wanneer. Uitvoerend = geen GET en geen NOT_APPLICABLE in het mutatiecontract-register; ' +
      'een route zonder contract telt als uitvoerend (`ongeclassificeerd`). Een route die hier niet staat is ' +
      'niet uitgevoerd sinds de meting loopt -- niet "zou nooit zakken".',
    soorten: SOORTEN,
    routesGezien: routes.length,
    routesDieZoudenZakken: zakkend.length,
    waarnemingen: routes.reduce((s, r) => s + r.passkey + r.zouZakken, 0),
    zouZakken: routes.reduce((s, r) => s + r.zouZakken, 0),
    perKlasse,
    werklijst: zakkend.slice(0, 100)
  };
}

/* Over DEZE aanroeper: welke soort identiteit draagt zijn sessie, en wat zou
   ENFORCE_EXECUTE over hem besluiten. Geen naam, geen sleutel. */
function overMij(f) {
  const { kanMet, SCHADUWREGELS, inWoorden } = require('./regels');
  const b = kanMet(f, SCHADUWREGELS.ENFORCE_EXECUTE, 'ENFORCE_EXECUTE');
  return { identiteit: (f && f.identiteit) || null,
    uitvoeren: { regel: 'ENFORCE_EXECUTE', stand: 'schaduw', uitkomst: b.uitkomst, reden: b.reden, opbouw: inWoorden(b) } };
}

module.exports = { maakUitvoeren, lees, uitvoerKlasse, overMij, SOORTEN, VOORVOEGSEL };
