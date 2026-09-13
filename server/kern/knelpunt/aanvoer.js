/* ============================================================================
   DE AANVOER -- wat een BRON minimaal moet leveren om een manier te heten.

   ./openingen-kaart.js wijst per terrein EEN deur aan ("hier kunt u kijken").
   Dit is de stap erna: niet de deur maar wat erachter staat -- de vacatures
   zelf, de leerpaden zelf, de vrije opvangplekken zelf. Daarvoor is een
   contract nodig, en de verleiding is dat contract te VERKLAREN: een `Manier`
   met een vaste set velden waar elk brondomein zich naar voegt.

   DAT IS GEMETEN EN HET MAG NIET. `scripts/aanvoervorm.js` (AANVOERVORM.json)
   legt de vijf terreinen naast elkaar met de lezer van scripts/objectmodel.js
   -- dezelfde als bij de Asset- en Koopbaar-metingen, want een tweede parser
   maakt de vergelijking waardeloos. Uitslag over TWEE domeinlijsten, ruim en
   smal: **0 velden in alle terreinen**, onder geen van beide. Ruim staat 93,8%
   van de velden in precies EEN terrein; smal is dat 100% en delen zelfs twee
   terreinen onderling niets. Dat is scherper dan de Asset-meting (71%) en
   scherper dan de carriere-meting (88,2%).

   Een `Manier` als OBJECTTYPE met verplichte velden is daarmee niet
   gerechtvaardigd. Wat overleeft is de vorm die dit huis al twee keer heeft
   gevonden: een PROJECTIE met een klein aantal etiketten, per aanroep
   samengesteld door het brondomein zelf -- kern/levensgraaf/graaf.js, en de
   uitweg die COMMERCE.md voor `Koopbaar` koos (een verklaring van werkwoorden,
   geen interface van verplichte methodes). Er komt dus GEEN `manieren`-tabel en
   geen gedeelde basisklasse; er komt een AFSPRAAK over vijf etiketten.

   DE SCHERPSTE KEUZE STAAT IN DE HANDTEKENING: DEZE LAAG KRIJGT DE MENS NIET.
   `manieren()` neemt een randvoorwaarde en verder niets -- geen profiel, geen
   codenaam, geen leeftijd, geen postcode. Daardoor is een geschiktheidstoets
   hier niet iets dat je moet onthouden af te leren, maar iets dat structureel
   niet KAN. FOUNDATION.md par. 5: een eligibility-motor mag alleen toevoegen.
   HDI.md par. 5.1: er komt geen route die "alles over deze mens" samenstelt.
   Een bron die om de mens vraagt, hoort hier te worden geweigerd en niet
   bediend.

   VIJF ETIKETTEN, EN VIER ERVAN ZIJN VERPLICHT:

     terrein    een van ./openingen-kaart.js. Verplicht.
     wat        wat dit is, in de woorden van de bron zelf. Verplicht.
     ingang     waar de mens zelf heen gaat. Verplicht, en het is een PAD en
                nooit een handeling -- deze laag vraagt niets aan.
     dektNiet   wat dit NIET oplost. Verplicht, en dat is de les van
                openingen-kaart.js: de gevaarlijkste lezer is niet degene die
                een leegte voor een gat aanziet, maar degene die aanbod leest
                als "dit is geregeld". Een vacature is geen inkomen.
     herkomst   welk domein dit heeft gezegd. Verplicht. REIZEN.md: het maakt
                niet uit waar een onderdeel vandaan komt, het maakt wel uit dat
                RTG dat weet.

   En een zesde die NOOIT verplicht is en nooit wordt verzonnen:
     beschikbaarheid   `null` tenzij de bron zelf een aantal of een wachttijd
                noemt. `null` leest als "niet nagegaan" en nooit als vol of leeg.

   DRIE DINGEN DIE HIER STRUCTUREEL NIET KUNNEN, en dat is iets anders dan
   verboden zijn:

   1. EEN GETAL OP EEN MENS. Er is geen mens in deze laag om er een op te
      zetten. Geen match-score, geen rangorde, ook niet intern als
      sorteersleutel (LEVEN.md par. 2.4, ONTMOETEN.md par. 4, HDI.md).
   2. EEN TERREIN WEGSTREPEN. `manieren()` voegt samen en trekt nooit af. Een
      bron die niets heeft, levert een LEGE lijst met een reden -- en dat is een
      uitslag, geen stilte (dezelfde regel als kern/ontvanger.js).
   3. IETS AANVRAGEN. Geen boeking, geen reservering, geen bericht aan een
      derde. COMMERCE.md par. 3 en APPSTORE.md grens 5: alles wat een derde
      raakt is maximaal KLAARZETTEN.

   EN EEN VIERDE DIE WEL ONTHOUDEN MOET WORDEN. Een bron mag hier alleen hangen
   als zijn `ingang` werkelijk te bereiken is door de doelgroep die hem krijgt
   voorgeschoteld. Dat is niet te beloven maar te METEN, en de meter bestaat:
   DOELGROEPBEREIK.json zegt per functie x doelgroep of de deur opengaat. Dit is
   de spiegel van regel 4 in kern/ontvanger.js (*elke weg heeft een lezer, en
   dat is gemeten*): een manier wijzen naar een deur die voor deze mens dicht
   zit, is precies zo'n stille non-bezorging.

   GEEN OPSLAG. Alles komt binnen als argument, net als ./index.js en
   ./openingen.js, en om dezelfde reden: zonder database uit te rekenen is
   zonder database te toetsen.
   ========================================================================== */
'use strict';

const { TERREINEN } = require('./openingen-kaart');

/* De etiketten die een manier draagt. Gesloten en bevroren, om dezelfde reden
   als SOORTEN in kern/ontvanger.js: een etiket erbij hoort een besluit te zijn
   en niet iets dat ontstaat doordat een bron een nieuw veld meestuurt. */
const ETIKETTEN = Object.freeze(['terrein', 'wat', 'ingang', 'dektNiet', 'herkomst', 'beschikbaarheid']);
const VERPLICHT = Object.freeze(['terrein', 'wat', 'ingang', 'dektNiet', 'herkomst']);

/* Velden waaraan te zien is dat een bron de MENS heeft meegekregen. Een manier
   die een van deze draagt, wordt geweigerd -- niet gefilterd maar geweigerd,
   met de naam van het veld erbij, zodat de bouwer van die bron het ziet in
   plaats van dat het stil wordt weggepoetst. */
const MENSVELDEN = Object.freeze(['key', 'codenaam', 'profielId', 'bsn', 'naam', 'geboortedatum',
  'leeftijd', 'postcode', 'adres', 'score', 'match', 'rangorde', 'geschikt']);

/* Keurt EEN manier. Geeft `{ ok: true, manier }` of `{ ok: false, reden }`.
   Nooit een uitzondering: een kapotte bron mag de andere niet meenemen. */
function keur(ruw, herkomst) {
  const m = ruw && typeof ruw === 'object' ? ruw : null;
  if (!m) return { ok: false, reden: 'geen-object' };

  for (const v of VERPLICHT) {
    if (v === 'herkomst') continue;                 // die zet deze laag zelf
    if (!String(m[v] == null ? '' : m[v]).trim()) return { ok: false, reden: 'ontbreekt: ' + v };
  }
  if (!TERREINEN.includes(m.terrein)) return { ok: false, reden: 'onbekend terrein: ' + m.terrein };
  /* Een ingang is een PAD. Een bron die een volledige URL of een werkwoord
     meestuurt, wijst buiten dit huis of vraagt om een handeling. */
  if (!/^\//.test(String(m.ingang))) return { ok: false, reden: 'ingang is geen pad: ' + m.ingang };

  const mens = MENSVELDEN.filter((v) => Object.prototype.hasOwnProperty.call(m, v));
  if (mens.length) return { ok: false, reden: 'draagt een gegeven over de mens: ' + mens.join(', ') };

  const onbekend = Object.keys(m).filter((k) => !ETIKETTEN.includes(k));
  if (onbekend.length) return { ok: false, reden: 'etiket onbekend: ' + onbekend.join(', ') };

  return { ok: true, manier: {
    terrein: m.terrein,
    wat: String(m.wat),
    ingang: String(m.ingang),
    dektNiet: String(m.dektNiet),
    herkomst,
    /* Nooit verzonnen: wat de bron niet noemt, blijft null. */
    beschikbaarheid: m.beschikbaarheid == null ? null : m.beschikbaarheid
  } };
}

/* Maakt een aanvoerlaag op de bronnen die dit huis werkelijk heeft.

   `bronnen` is een object { herkomst: fn }, waarbij fn EEN randvoorwaarde
   krijgt en een lijst ruwe manieren teruggeeft. De herkomst is de sleutel, en
   die wordt door DEZE laag gezet en niet door de bron: een bron die zijn eigen
   herkomst mag opschrijven, kan zich voordoen als een andere. */
function maakAanvoer(bronnen) {
  const lijst = bronnen && typeof bronnen === 'object' ? bronnen : {};

  /* `voorwaarde` is de randvoorwaarde uit ./index.js en draagt GEEN mens.
     Er is met opzet geen tweede argument: wie er een wil meegeven, moet deze
     handtekening veranderen, en dan is het een besluit. */
  function manieren(voorwaarde) {
    const uit = { manieren: [], geenBron: [], geweigerd: [], bronnenGevraagd: 0 };
    for (const herkomst of Object.keys(lijst)) {
      const fn = lijst[herkomst];
      if (typeof fn !== 'function') { uit.geweigerd.push({ herkomst, reden: 'bron-is-geen-functie' }); continue; }
      uit.bronnenGevraagd++;
      let ruw;
      /* Een kapotte bron neemt de andere niet mee -- dezelfde regel als in
         kern/ontvanger.js en opzet/meldaan.js. */
      try { ruw = fn(voorwaarde); } catch (e) {
        uit.geweigerd.push({ herkomst, reden: 'bron-brak: ' + ((e && e.message) || e) }); continue;
      }
      if (!Array.isArray(ruw)) { uit.geweigerd.push({ herkomst, reden: 'bron gaf geen lijst' }); continue; }
      /* Niets hebben is een UITSLAG en geen stilte. Zonder deze regel is een
         bron die stuk is niet te onderscheiden van een bron die leeg is. */
      if (!ruw.length) { uit.geenBron.push({ herkomst, reden: 'deze bron heeft hier niets' }); continue; }
      for (const r of ruw) {
        const k = keur(r, herkomst);
        if (k.ok) uit.manieren.push(k.manier);
        else uit.geweigerd.push({ herkomst, reden: k.reden });
      }
    }
    /* De volgorde is die van de bronnen en verder niets: er wordt NIET
       gesorteerd. Een rangorde is een oordeel, en deze laag kent de mens niet
       eens om er een over te vellen. */
    return uit;
  }

  return { manieren, ETIKETTEN, VERPLICHT };
}

module.exports = { maakAanvoer, keur, ETIKETTEN, VERPLICHT, MENSVELDEN };
