/* ============================================================================
   HET VERKLARINGSREGISTER -- wat elk mechanisme van namens-iemand-handelen met
   de zeven werkwoorden doet. REPRESENTATIE.md par. 5, REP-01.

   WAAROM DIT EEN VERKLARING IS EN GEEN BASISKLASSE. `NAMENSVORM.json` meet dat
   de zeven mechanismen 0 velden en 0 werkwoorden delen. Een gedeelde klasse zou
   dus elk mechanisme zijn eigen kern naar een `extra`-veld duwen -- de
   `Asset`-fout, en die is in dit huis al vier keer gemeten. De vorm die wél
   overleeft is die van kern/appstore/machtigingen.js en van `Koopbaar` in
   COMMERCE.md: een lijst met per stuk een DOEL en een GRENS.

   DE DRIE STANDEN, EN DE MIDDELSTE IS DE HELE REDEN DAT DIT BESTAAT:

     voert                het mechanisme voert dit werkwoord; `waar` zegt waar
     nietVanToepassing    het hoort hier niet te bestaan, met een GROND
     ontbreekt            het hoort hier wél te bestaan en het is er niet

   Zonder de middelste stand is een ontbrekend werkwoord altijd een gebrek, en
   dan wordt een register dat vol schuld staat binnen een maand genegeerd. Met
   die stand is `ontbreekt` een korte, echte lijst. De prijs is dat iemand een
   grond moet OPSCHRIJVEN, en dat is precies de bedoeling: stil ontbreken wordt
   een uitgesproken besluit.

   EN EEN GROND IS VERPLICHT BIJ ALLEBEI DE UITZONDERINGEN. `nietVanToepassing`
   zonder grond is een vinkje, en `ontbreekt` zonder `wat` is een klacht. Beide
   worden hieronder geweigerd door `keur()` in plaats van getolereerd.

   DIT REGISTER IS EEN VERKLARING EN scripts/namensvorm.js DE METING. Die twee
   staan naast elkaar en de een wordt NOOIT uit de ander gegenereerd -- dezelfde
   opzet als `EIGENAAR` naast `detecteer()` in scripts/lib/registereigenaar.js,
   en als IDEMBESLUIT.json naast IDEMPROEF.json. Wie de verklaring uit de meting
   vult, laat de toets met zichzelf vergelijken en dan zegt de uitslag niets.
   test/namensverklaring.test.js legt ze naast elkaar en meldt waar ze het
   oneens zijn, zonder er een winnaar aan te wijzen.

   HIJ KENT GEEN OPSLAG, geen routes en geen sessie -- zie de kop van
   ./versmalling.js voor waarom dat hier de vorm is.
   ========================================================================== */
'use strict';

/* De zeven werkwoorden. Afgelezen aan kern/vertegenwoordiging/, het enige
   mechanisme dat ze alle zeven voert -- met opzet uit de code en niet uit het
   voorstel, want een grammatica die uit een document komt meet het document. */
const WERKWOORDEN = Object.freeze(['verlenen', 'aanvaarden', 'versmallen',
  'intrekken', 'verlopen', 'handelen', 'spoor']);

const STANDEN = Object.freeze(['voert', 'nietVanToepassing', 'ontbreekt']);

/* WAT EEN AANVAARDING MOET KUNNEN ANTWOORDEN. Dit is de contractkant van
   REP-02: niet "er is een knop" maar "deze zeven vragen zijn beantwoordbaar".
   Een mechanisme dat `aanvaarden` op `voert` zet, verklaart ze alle zeven.

   `bijIntrekking` staat er met opzet bij: een aanvaarding die niet zegt wat er
   bij intrekking met het verleden gebeurt, laat de vraag open of intrekken het
   spoor meewist -- en dat is precies waar kern/vertegenwoordiging/ en het
   carriereledger allebei hard nee op zeggen (intrekken stopt de toekomst, niet
   het verleden). */
const AANVAARDINGSVRAGEN = Object.freeze(['wieGeeft', 'wieOntvangt', 'wieAanvaardt',
  'welkeVersie', 'wanneer', 'welkBewijs', 'bijIntrekking']);

/* --------------------------------------------------------------------------
   HET REGISTER, in twee helften. De data staat in ./verklaring-lijst-a.js (een
   mens aan beide kanten) en ./verklaring-lijst-b.js (een agent, een instantie,
   een incassant of een derde) -- zie de kop daar voor de naad.

   DE STANDEN ZIJN MET DE HAND GEZET op grond van NAMENSVORM.json plus het lezen
   van de bron. Waar de meter en de verklaring van elkaar afwijken staat dat in
   de data als `opmerking` -- de meter is lexicaal en dus een ONDERgrens, en een
   mens die de module opent ziet meer dan hij. Die afwijkingen worden met opzet
   NIET weggepoetst aan een van beide kanten: test/namensverklaring.test.js legt
   ze naast elkaar en meldt waar ze het oneens zijn, zonder een winnaar aan te
   wijzen.
   -------------------------------------------------------------------------- */
const VERKLARING = Object.freeze(Object.assign({},
  require('./verklaring-lijst-a'), require('./verklaring-lijst-b')));

/* --------------------------------------------------------------------------
   DE KEURING. Hij draait niet vanzelf: test/namensverklaring.test.js roept hem
   aan, en een aanroeper die een achtste mechanisme toevoegt kan hem zelf
   draaien voordat hij pusht.
   -------------------------------------------------------------------------- */
function keur(register) {
  const R = register || VERKLARING;
  const fouten = [];
  for (const [naam, m] of Object.entries(R)) {
    if (!m.wat || !m.waar) fouten.push(naam + ': mist `wat` of `waar`');
    const w = m.werkwoorden || {};
    for (const ww of WERKWOORDEN) {
      const v = w[ww];
      if (!v) { fouten.push(naam + '.' + ww + ': geen stand verklaard; stil ontbreken is precies wat dit register uitsluit'); continue; }
      if (!STANDEN.includes(v.stand)) { fouten.push(naam + '.' + ww + ': onbekende stand `' + v.stand + '`'); continue; }
      if (v.stand === 'voert' && !v.waar) fouten.push(naam + '.' + ww + ': `voert` zonder `waar` is niet na te trekken');
      if (v.stand === 'nietVanToepassing' && !v.grond) fouten.push(naam + '.' + ww + ': `nietVanToepassing` zonder grond is een vinkje');
      if (v.stand === 'ontbreekt' && !v.wat) fouten.push(naam + '.' + ww + ': `ontbreekt` zonder `wat` is een klacht en geen post');
      if (ww === 'aanvaarden' && v.stand === 'voert') {
        const a = v.aanvaarding || {};
        for (const vraag of AANVAARDINGSVRAGEN) {
          if (!a[vraag]) fouten.push(naam + '.aanvaarden: de vraag `' + vraag + '` is niet beantwoord');
        }
      }
    }
    for (const ww of Object.keys(w)) {
      if (!WERKWOORDEN.includes(ww)) fouten.push(naam + ': `' + ww + '` is geen van de zeven werkwoorden');
    }
  }
  return fouten;
}

/* De openstaande posten, in de volgorde waarin REPRESENTATIE.md par. 6 ze wil
   aanpakken. Dit is de lijst die korter hoort te worden. */
function openstaand(register) {
  const R = register || VERKLARING;
  const uit = [];
  for (const [naam, m] of Object.entries(R)) {
    for (const ww of WERKWOORDEN) {
      const v = (m.werkwoorden || {})[ww];
      if (v && v.stand === 'ontbreekt') uit.push({ mechanisme: naam, werkwoord: ww, wat: v.wat });
    }
  }
  const orde = { aanvaarden: 0, versmallen: 1, spoor: 2 };
  return uit.sort((a, b) => (orde[a.werkwoord] ?? 9) - (orde[b.werkwoord] ?? 9) ||
    a.mechanisme.localeCompare(b.mechanisme));
}

/* Per werkwoord de telling, in dezelfde drie standen. Bewust GEEN samengesteld
   cijfer: `voert` en `nietVanToepassing` zijn allebei "in orde" en betekenen
   iets heel anders, en ze optellen tot een percentage verbergt precies dat
   (LAT-regel 11). */
function telling(register) {
  const R = register || VERKLARING;
  const namen = Object.keys(R);
  return WERKWOORDEN.map(ww => {
    const t = { werkwoord: ww, voert: 0, nietVanToepassing: 0, ontbreekt: 0 };
    for (const n of namen) {
      const v = (R[n].werkwoorden || {})[ww];
      if (v && t[v.stand] != null) t[v.stand]++;
    }
    return t;
  });
}

module.exports = { VERKLARING, WERKWOORDEN, STANDEN, AANVAARDINGSVRAGEN, keur, openstaand, telling };
