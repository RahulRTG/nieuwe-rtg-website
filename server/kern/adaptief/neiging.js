/* ============================================================================
   DE NEIGING -- het enige dat deze laag ZELF bewaart.

   De volle redenering staat in ADAPTIEFRTG.md par. 2 en 5; hier staat wat de
   CODE bindt.

   WAAROM HET EEN NEIGING HEET. Gemeten en niet gekozen: ADAPTIEFRTG.json meting
   A legde vijftien kandidaat-begrippen tegen de bron, en veertien waren bezet --
   `context` in 77 bestanden en 39 domeinen (waar het SITUATIE betekent, zie
   kern/experience/contexts.js), `profiel` in 104, `voorkeur` in 13 met tien
   veldnamen. Een gedeelde laag die de centrale naam van een bestaand begrip
   overneemt, is de `VERMOGENS`-botsing uit OS.md. `neiging` stond op nul. Het
   woord zegt ook preciezer wat dit is: een profiel klinkt als iets wat iemand
   IS, een neiging is wat iemand NEIGT te doen -- en dat verschil bepaalt of je
   het durft te tonen aan degene over wie het gaat.

   WAT HIER NIET BIJ KOMT, EN DAT IS DE HELFT VAN HET ONTWERP. Meting B vond
   VEERTIEN bestaande vormen met een affiniteitsveld in tien domeinen (de wensen
   van RTG Vonk, het zorgprofiel, die van een marina, een sportclub). Die worden
   hier NIET ingelezen, gespiegeld of overgeschreven; ze blijven van hun domein.
   Dat is de les van `Asset`, `Moment` en `Manier`: een laag eroverheen die
   dezelfde waarheid nog een keer opslaat, loopt uiteen met het origineel en
   meestal zonder dat iets klaagt (LAT-regel 4). Wat deze laag toevoegt is wat
   NERGENS stond: van diezelfde veertien dragen er NUL een grond, een zekerheid
   of een verval. Er werd al op voorkeuren gestuurd, en niemand kon zeggen hoe
   hard ze waren.

   DRIE DINGEN DIE ELKE NEIGING DRAAGT

     grond + graad   hoe weten we dit, en hoe hard is het (./ladder.js). De
                     graad wordt BEREKEND bij het lezen en nooit opgeslagen: een
                     bewaarde graad veroudert stil, en dan staat er morgen
                     `gemeten` boven iets wat al een half jaar niet waar is.
     doel            waarvoor het gebruikt mag worden. Een neiging wordt gelezen
                     MET een doel, en een die dat doel niet draagt komt er niet
                     uit -- geweigerd bij het lezen en niet gefilterd erna, want
                     een filter achteraf kan iemand vergeten. De lijst staat in
                     ./neiging-besluiten.js, met de uitleg waarom `delen` en
                     `adverteren` er met opzet niet in staan.
     deel            wie het mag zien. Een POORT en geen etiket, precies zoals
                     kern/levensgraaf/graaf.js dat doet.

   WAAR HET AAN HANGT, EN HOE LANG. Aan een ACTOR: een hash van de
   sessiesleutel, dezelfde vorm die kern/experience/opslag.js gebruikt. Niet aan
   de codenaam, en dat is bewust strenger dan INT-03 vraagt --
   scripts/afleidbaar.js mat dat een codenaam met genoeg ernaast terugleidt naar
   een mens. Het lid komt bij zijn eigen neigingen omdat hij de sleutel HEEFT,
   niet omdat er een koppeling ligt. En er staat een bewaartermijn op vanaf de
   eerste regel: een termijn die je er later bij doet, geldt niet voor wat er al
   ligt.
   ========================================================================== */
'use strict';

const klok = require('../../lib/klok');
const { GRONDEN, graadVan, telt } = require('./ladder');

const { DOELEN, KRING, BEWAARDAGEN } = require('./neiging-besluiten');
const DAG = 24 * 60 * 60 * 1000;

module.exports = function maakNeiging({ db, save, crypto, nu }) {
  const tijd = () => (nu ? nu() : klok.datum().toISOString());
  const { bak, actor, schoon, lijstVan } = require('./neiging-opslag')({ db, crypto });

  /* De vorm die naar buiten gaat. De GRAAD wordt hier berekend, elke keer
     opnieuw -- zie de kop: een bewaarde graad veroudert stil. */
  function toon(n, wanneer) {
    const graad = graadVan({ grond: n.grond, aantal: n.aantal, laatst: n.laatst, nu: wanneer });
    return {
      id: n.id, onderwerp: n.onderwerp, grond: n.grond, aantal: n.aantal,
      graad, telt: telt(graad) && !n.geweigerd,
      doel: n.doel.slice(), deel: n.deel, geweigerd: !!n.geweigerd,
      eerst: n.eerst, laatst: n.laatst, vervalt: n.vervalt
    };
  }

  /* ONTHOUD. Dezelfde onderwerp+grond wordt OPGEHOOGD en niet verdubbeld: twee
     rijen voor hetzelfde zouden de teller onbruikbaar maken, en juist die
     teller is het verschil tussen `vermoed` en `gemeten`. */
  function onthoud(key, invoer) {
    const b = invoer || {};
    const onderwerp = schoon(b.onderwerp, 60);
    if (!onderwerp) return { status: 400, error: 'Zonder onderwerp is er niets te onthouden.' };
    const grond = GRONDEN.includes(b.grond) ? b.grond : null;
    if (!grond) return { status: 400, error: 'Onbekende grond. Het is gezegd, gekozen of afgeleid.' };
    const doel = [...new Set((Array.isArray(b.doel) ? b.doel : ['tonen']).filter(d => DOELEN.includes(d)))];
    if (!doel.length) return { status: 400, error: 'Een neiging zonder doel bestaat niet. Kies tonen of helpen.' };
    const deel = KRING[b.deel] === undefined ? 'lid' : b.deel;
    const a = actor(key), lijst = lijstVan(a), wanneer = tijd();
    const bestaand = lijst.find(n => n.onderwerp === onderwerp && n.grond === grond);
    if (bestaand) {
      /* TWEE KEER HETZELFDE ZEGGEN IS EEN UITSPRAAK, TWEE KEER HETZELFDE DOEN
         ZIJN TWEE KEREN. Voor `gekozen` en `afgeleid` is tellen de hele
         bedoeling -- de teller IS het verschil tussen `vermoed` en `gemeten`
         (./ladder.js). Voor `gezegd` betekent hij niets (de graad is altijd
         `bewezen`) en doet hij wel kwaad: een dubbelklik op "Verder" wordt dan
         geboekt als een tweede gebeurtenis over een mens.

         Gemeten en niet bedacht: een ronde tegen een draaiende server vond dat
         /api/adaptief/antwoord bij een tweede identieke aanroep het beeld van
         het lid opnieuw veranderde. De volle meting staat in
         lib/mutatiecontracten-adaptief.js. Een herhaalde uitspraak is daarom
         een NO-OP, klok en al, zodat de route echt idempotent is en niet bijna.
         Verandert het lid van gedachten, dan is dat een ANDER onderwerp of
         `vergeet()` -- allebei een zichtbaar besluit van het lid. */
      const telt = grond !== 'gezegd';
      if (telt) {
        bestaand.aantal += 1;
        bestaand.laatst = wanneer;
        bestaand.vervalt = new Date(Date.parse(wanneer) + BEWAARDAGEN * DAG).toISOString();
      }
      /* Opnieuw gezien betekent NIET opnieuw toegestaan: een doel dat het lid
         heeft weggehaald, komt niet terug doordat het gedrag zich herhaalt. */
      let erbij = false;
      for (const d of doel) if (!bestaand.doel.includes(d) && !(bestaand.afgewezenDoel || []).includes(d)) {
        bestaand.doel.push(d); erbij = true;
      }
      if (telt || erbij) save();
      return { ok: true, neiging: toon(bestaand, wanneer), nieuw: false };
    }
    const n = { id: 'nei_' + crypto.randomBytes(8).toString('hex'), onderwerp, grond,
      aantal: 1, doel, deel, geweigerd: false, afgewezenDoel: [],
      eerst: wanneer, laatst: wanneer,
      vervalt: new Date(Date.parse(wanneer) + BEWAARDAGEN * DAG).toISOString() };
    lijst.push(n); save();
    return { ok: true, neiging: toon(n, wanneer), nieuw: true };
  }

  /* LEZEN MET EEN DOEL. Een onbekend doel is een WEIGERING en geen lege lijst:
     een lege lijst leest als "deze mens heeft geen voorkeuren", en dat is iets
     heel anders dan "je mag hier niet voor kijken". */
  function neigingen(key, doel, opties) {
    if (!DOELEN.includes(doel)) return { status: 400,
      error: 'Onbekend doel. Deze laag kent alleen tonen en helpen.', doelen: DOELEN.slice() };
    const o = opties || {}, wanneer = tijd();
    const kijker = KRING[o.kijker] === undefined ? 'lid' : o.kijker;
    const rijen = lijstVan(actor(key))
      .filter(n => !n.geweigerd)
      .filter(n => n.doel.includes(doel))
      .filter(n => KRING[kijker] <= KRING[n.deel])
      .map(n => toon(n, wanneer))
      .filter(n => o.ookVervallen ? true : n.telt);
    return { ok: true, doel, neigingen: rijen };
  }

  /* ALLES, ook wat niet meer meetelt en wat is geweigerd -- uitsluitend voor het
     lid zelf (./index.js). Dit is de lezer achter "wat weet RTG van mij", en
     die moet juist WEL tonen wat er niet meer toe doet: een geheugenkaart die
     alleen het geldige toont, verzwijgt wat er is opgeslagen. */
  function alles(key) {
    const wanneer = tijd();
    return lijstVan(actor(key)).map(n => toon(n, wanneer))
      .sort((a, b) => String(b.laatst).localeCompare(String(a.laatst)));
  }

  /* De beheerkant (vergeten, niet-hiervoor, de termijn, en welke vragen al zijn
     gesteld) woont in ./neiging-beheer.js en krijgt de binnenkant MEE. */
  const beheer = require('./neiging-beheer')({ bak, actor, lijstVan, toon, tijd, save });

  return Object.assign({ onthoud, neigingen, alles, DOELEN, KRING, BEWAARDAGEN }, beheer);
};
