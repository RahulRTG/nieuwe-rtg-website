/* ============================================================================
   DE VRAAGMOTOR -- welke vraag levert nog iets op, en wanneer houdt het op?

   Dit is het stuk waar het woord "adaptief" op slaat. De volle redenering staat
   in NEIGING.md par. 3.3; hier staat wat de CODE bindt.

   HET PROBLEEM MET EEN INTAKE VAN VEERTIG VELDEN is niet dat hij lang is, maar
   dat niemand kan zeggen wat een antwoord oplevert. Veld 37 wordt uitgevraagd
   omdat hij in het formulier staat. De vraag die dit bestand in plaats daarvan
   per keer stelt:

       verandert het antwoord op deze vraag iets aan wat RTG voor jou opendoet?

   Zo niet, dan wordt hij niet gesteld. Daarmee stopt de intake vanzelf -- niet
   na een afgesproken aantal stappen, maar op het moment dat er niets meer te
   winnen valt. Vijf goede antwoorden zijn meer waard dan veertig velden, en dat
   is hier een REKENSOM en geen leus.

   DE WINST IS EEN GETAL EN GEEN GEVOEL. Elke optie wijst naar BESTEMMINGEN, en
   de winst van een vraag is het aantal dat hij nog kan opendoen. Winst nul
   betekent: welk antwoord je ook geeft, er verandert niets. Met opzet geen
   gewogen score met verzonnen factoren -- INT-04 zegt dat zo'n motor zijn
   besluit met de OPBOUW geeft en nooit als samengesteld cijfer, en `confidence`
   is hier niet meetbaar. Een telling van bestemmingen is wel na te rekenen: je
   kunt ze aanwijzen.

   DE BESTEMMINGEN KOMEN UIT DE BESTAANDE LIJST, EN WORDEN NAGETROKKEN. `wijst`
   verwijst naar de SLEUTEL van een onderdeel in public/shared/sprongindex.json,
   afgeleid uit MAPPEN door scripts/sprongindex.js -- de enige lijst apps die dit
   huis heeft, en TIKKEN.md is daar terecht streng over. Verdwijnt een onderdeel
   of wordt het hernoemd, dan zakt test/neiging.test.js in plaats van dat een lid
   stil een vraag krijgt die nergens meer toe leidt.

   WAT HIER EEN BESLUIT IS EN GEEN AFLEIDING: de VRAGEN zelf zijn geschreven
   (./vraag-lijst.js). Welke onderdelen samen "eten" heten staat nergens in de
   code -- precies zoals WERELDLIJST.md vaststelt over de laag tussen wereld en
   onderdeel. De grens loopt tussen de indeling (mensenwerk) en de bestemmingen
   (nagetrokken), en niet ertussenin.

   DRIE DINGEN DIE DEZE MOTOR MET OPZET NIET DOET

   - Hij vraagt niets over een MENS. Geen leeftijd, geen geslacht, geen inkomen,
     geen gezinssamenstelling; alles gaat over wat iemand wil DOEN. Dat is geen
     kiesheid: FOUNDATION.md par. 5 zegt dat zo'n motor alleen mag TOEVOEGEN, en
     een vraag naar een eigenschap van de mens is de eerste stap naar een antwoord
     dat iets afsluit.
   - Hij slaat niets over op grond van een antwoord. Een vervolgvraag KOMT erbij;
     er valt nooit iets weg. Wie dat omdraait, bouwt een trechter.
   - Hij beslist niet dat iemand ergens NIET bij hoort. De uitkomst is een lijst
     die opengaat, nooit een die dichtgaat. */
'use strict';

/* De vragen zelf staan in ./vraag-lijst.js -- zie daar ook waarom de INDELING
   een ontwerpbesluit is en de BESTEMMINGEN wel worden nagetrokken. */
const { VRAGEN } = require('./vraag-lijst');
/* EEN LETTERLIJK PAD EN GEEN path.join(__dirname, ...). Hier stond dat laatste,
   en scripts/bedrading.js telde het terecht als onzekerheid: wie de bron leest
   kan dan niet zien welk bestand er wordt geladen, en een verhuizing breekt
   stil. Een letterlijke require is statisch na te lopen en faalt hard. */
const SPRONGINDEX = require('../../../public/shared/sprongindex.json');

/* De enige lijst onderdelen die dit huis heeft, afgeleid uit MAPPEN. Hij wordt
   HIER gelezen en nergens overgetypt. Ontbreekt het bestand, dan levert
   `controle()` dat als bevinding op in plaats van stil door te draaien.

   TWEE VERZAMELINGEN EN NIET EEN, en dat verschil is met een browser gevonden.
   Een sleutel kan BESTAAN zonder een adres te hebben: `reizen` staat er twee
   keer in, eerst als TAB (een tabblad binnen de app-schil, zonder url) en daarna
   als LINK. Beide zijn echte bestemmingen, maar alleen de tweede kan een slot-
   scherm aanklikbaar maken. Wie alleen op bestaan toetst, laat een vraag door
   die het lid als dode tekst te zien krijgt.

   MAAR EEN TAB IS NIET ONBEREIKBAAR, en dat was de eerste lezing hier wel.
   public/shared/sprong.js -- de bestaande korte weg door dit huis -- adresseert
   een tab of een os-app als `/apps/app.html#tab=<sleutel>` respectievelijk
   `#os=<sleutel>`. Adresseerbaar is dus: een eigen url, OF een soort die sprong.js
   kan openen. Zonder dat onderscheid meldde deze controle vijf valse gebreken
   (werk, bestellen, salon, videobellen, zorg) die alle vijf gewoon te bereiken
   zijn. `zonderAdres` blijft bestaan voor de soort die NIEMAND kan openen. */
const ADRESSEERBAAR = new Set(['tab', 'os']);
function sleutels() {
  const items = SPRONGINDEX && SPRONGINDEX.items;
  if (!Array.isArray(items)) return null;
  const bestaat = new Set(), metAdres = new Set();
  for (const i of items) {
    if (!i.sleutel) continue;
    bestaat.add(i.sleutel);
    if (i.url || ADRESSEERBAAR.has(i.soort)) metAdres.add(i.sleutel);
  }
  return { bestaat, metAdres };
}

/* Wijst elke optie naar een onderdeel dat bestaat, en is dat onderdeel ook aan
   te klikken? Dit is de handhaver achter de belofte in de kop;
   test/neiging.test.js leest hem.

   `onbekend` is een FOUT (de vraag wijst nergens heen) en `zonderAdres` een
   WAARSCHUWING (de vraag wijst ergens heen dat een scherm niet kan linken). Ze
   worden niet opgeteld: de eerste is een gebrek, de tweede een keuze die iemand
   bewust kan maken zolang hij weet wat het lid dan ziet. */
function controle() {
  const s = sleutels();
  if (!s) return { ok: false, reden: 'sprongindex.json niet leesbaar', onbekend: [], zonderAdres: [] };
  const onbekend = [], zonderAdres = [];
  for (const v of VRAGEN) for (const o of v.opties) for (const w of o.wijst) {
    if (!s.bestaat.has(w)) onbekend.push({ vraag: v.id, onderwerp: o.onderwerp, wijst: w });
    else if (!s.metAdres.has(w)) zonderAdres.push({ vraag: v.id, onderwerp: o.onderwerp, wijst: w });
  }
  return { ok: onbekend.length === 0, onbekend, zonderAdres, bestemmingen: s.bestaat.size };
}

/* Alle bestemmingen die al opengaan door wat het lid draagt. */
function open(onderwerpen) {
  const heeft = new Set(onderwerpen || []);
  const uit = new Set();
  for (const v of VRAGEN) for (const o of v.opties)
    if (heeft.has(o.onderwerp)) for (const w of o.wijst) uit.add(w);
  return uit;
}

/* DE WINST. Het aantal bestemmingen dat deze vraag nog kan opendoen. */
function winstVan(vraag, onderwerpen) {
  const al = open(onderwerpen);
  const nieuw = new Set();
  for (const o of vraag.opties) {
    /* Een optie die het lid al draagt, opent per definitie niets nieuws. */
    if ((onderwerpen || []).includes(o.onderwerp)) continue;
    for (const w of o.wijst) if (!al.has(w)) nieuw.add(w);
  }
  return nieuw.size;
}

/* Mag deze vraag uberhaupt in beeld komen? Een vervolgvraag alleen als het lid
   het onderwerp draagt waar hij op volgt -- en een vraag die al GESTELD is,
   nooit meer.

   DAT TWEEDE IS EEN REPARATIE, EN HIJ KWAM UIT HET DRAAIEN EN NIET UIT HET
   LEZEN. Zonder `beantwoord` bleef de openingsvraag terugkomen: wie "reizen" en
   "eten" koos liet vijf opties liggen, en die vijf droegen samen nog winst 5.
   De rekensom klopte en het gedrag was onzinnig -- het lid kreeg acht keer
   dezelfde vraag, en geen enkele vervolgvraag.

   De denkfout zat een laag dieper dan de winst: NIET KIEZEN IS OOK EEN ANTWOORD.
   Wie sport niet aantikt, heeft gezegd dat sport het niet is. Alleen bijhouden
   wat iemand WEL koos, maakt van elk niet-gekozen vakje een openstaande vraag,
   en dan is er geen intake die ooit eindigt. */
function vraagBeschikbaar(vraag, onderwerpen, beantwoord) {
  if ((beantwoord || []).includes(vraag.id)) return false;
  if (!vraag.alsOnderwerp) return true;
  return (onderwerpen || []).includes(vraag.alsOnderwerp);
}

/* DE VOLGENDE VRAAG, of niets. `null` is hier een volwaardig antwoord en geen
   storing: het betekent dat er niets meer te winnen valt. De aanroeper hoort
   dat te lezen als "klaar", en ./index.js doet dat ook. */
function volgendeVraag(onderwerpen, beantwoord) {
  const kandidaten = VRAGEN
    .filter(v => vraagBeschikbaar(v, onderwerpen, beantwoord))
    .map(v => ({ vraag: v, winst: winstVan(v, onderwerpen) }))
    .filter(x => x.winst > 0)
    /* Hoogste winst eerst. Bij gelijke winst wint de volgorde in VRAGEN, en dat
       is met opzet vast: een willekeurige keuze bij gelijkspel maakt de intake
       onreproduceerbaar, en dan is een gezakte toets niet na te spelen. Dezelfde
       reden waarom scripts/resolverbereik.js een gelijke score niet afkapt. */
    .sort((a, b) => b.winst - a.winst);
  if (!kandidaten.length) return null;
  const { vraag, winst } = kandidaten[0];
  return {
    id: vraag.id, tekst: vraag.tekst, meerdere: !!vraag.meerdere, winst,
    opties: vraag.opties.map(o => ({ onderwerp: o.onderwerp, label: o.label, opent: o.wijst.slice() }))
  };
}

/* Wat gaat er voor dit lid open? Dit is de uitkomst die het slotscherm toont:
   niet "we hebben je gegevens", maar de onderdelen die door zijn eigen
   antwoorden zijn opengegaan. */
function opent(onderwerpen) {
  return [...open(onderwerpen)].sort();
}

module.exports = { VRAGEN, controle, volgendeVraag, winstVan, opent, open };
