/* ============================================================================
   DE VRAAGMOTOR -- welke vraag levert nog iets op, en wanneer houdt het op?

   DIT IS HET STUK WAAR HET WOORD "ADAPTIEF" OP SLAAT. De rest van deze laag
   bewaart en toont; dit bestand beslist wat er GEVRAAGD wordt, en vooral wat er
   NIET meer gevraagd wordt.

   HET PROBLEEM MET EEN INTAKE VAN VEERTIG VELDEN is niet dat hij lang is, maar
   dat niemand kan zeggen wat een antwoord oplevert. Veld 37 wordt uitgevraagd
   omdat hij in het formulier staat. De vraag die dit bestand in plaats daarvan
   stelt, en per keer opnieuw:

       verandert het antwoord op deze vraag iets aan wat RTG voor jou opendoet?

   Zo niet, dan wordt hij niet gesteld. Daarmee stopt de intake vanzelf -- niet
   na een afgesproken aantal stappen, maar op het moment dat er niets meer te
   winnen valt. Vijf goede antwoorden zijn meer waard dan veertig velden, en dat
   is hier een REKENSOM en geen leus.

   ------------------------------------------------------------------------
   DE WINST IS EEN GETAL EN GEEN GEVOEL

   Elke optie wijst naar BESTEMMINGEN: onderdelen van dit huis die door dat
   antwoord relevant worden. De winst van een vraag is het aantal bestemmingen
   dat hij kan opendoen en dat nog NIET open staat. Winst nul betekent: welk
   antwoord je ook geeft, er verandert niets -- dus stellen we hem niet.

   Dat is met opzet geen gewogen score met verzonnen factoren. INT-04 zegt dat
   een aandachtmotor zijn besluit met de OPBOUW geeft en nooit een samengesteld
   cijfer, en `confidence` en `novelty` zijn hier niet meetbaar. Een telling van
   bestemmingen is wel na te rekenen: je kunt ze aanwijzen.

   ------------------------------------------------------------------------
   DE BESTEMMINGEN KOMEN UIT DE BESTAANDE LIJST, EN WORDEN NAGETROKKEN

   `wijst` verwijst naar de SLEUTEL van een onderdeel in
   public/shared/sprongindex.json. Die lijst wordt door scripts/sprongindex.js
   AFGELEID uit MAPPEN in app-main.js -- de enige lijst apps die dit huis heeft.
   TIKKEN.md is daar streng over en terecht: er komt geen tweede lijst apps bij.

   Daarom staan hier geen namen van schermen en geen url's, maar sleutels die
   worden NAGETROKKEN door `controle()`. Verdwijnt een onderdeel of wordt het
   hernoemd, dan wijst een optie naar niets -- en dan zakt
   test/neiging.test.js in plaats van dat een lid stil een vraag krijgt
   die nergens meer toe leidt. Dat is dezelfde vorm als de nagetrokken
   verwijzing in scripts/neigingvorm.js meting C.

   ------------------------------------------------------------------------
   ------------------------------------------------------------------------
   DRIE DINGEN DIE DEZE MOTOR MET OPZET NIET DOET

   - Hij vraagt niets over een MENS. Geen leeftijd, geen geslacht, geen
     inkomen, geen gezinssamenstelling. Alles wat hij vraagt gaat over wat
     iemand wil DOEN. Dat is geen kiesheid: FOUNDATION.md par. 5 zegt dat een
     eligibility-motor alleen mag TOEVOEGEN, en een vraag naar een eigenschap
     van de mens is de eerste stap naar een antwoord dat iets afsluit.
   - Hij slaat niets over op grond van een antwoord. Een vervolgvraag KOMT erbij
     als hij iets opent; er valt nooit iets weg. Wie dat omdraait, bouwt een
     trechter.
   - Hij beslist niet dat iemand ergens NIET bij hoort. De uitkomst is een lijst
     bestemmingen die opengaan, nooit een lijst die dichtgaat. */
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
   `controle()` dat als bevinding op in plaats van stil door te draaien. */
function sleutels() {
  const items = SPRONGINDEX && SPRONGINDEX.items;
  if (!Array.isArray(items)) return null;
  return new Set(items.map(i => i.sleutel).filter(Boolean));
}

/* Wijst elke optie naar een onderdeel dat bestaat? Dit is de handhaver achter
   de belofte in de kop; test/neiging.test.js leest hem. */
function controle() {
  const bestaat = sleutels();
  if (!bestaat) return { ok: false, reden: 'sprongindex.json niet leesbaar', onbekend: [] };
  const onbekend = [];
  for (const v of VRAGEN) for (const o of v.opties) for (const w of o.wijst)
    if (!bestaat.has(w)) onbekend.push({ vraag: v.id, onderwerp: o.onderwerp, wijst: w });
  return { ok: onbekend.length === 0, onbekend, bestemmingen: bestaat.size };
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
function beschikbaar(vraag, onderwerpen, beantwoord) {
  if ((beantwoord || []).includes(vraag.id)) return false;
  if (!vraag.alsOnderwerp) return true;
  return (onderwerpen || []).includes(vraag.alsOnderwerp);
}

/* DE VOLGENDE VRAAG, of niets. `null` is hier een volwaardig antwoord en geen
   storing: het betekent dat er niets meer te winnen valt. De aanroeper hoort
   dat te lezen als "klaar", en ./index.js doet dat ook. */
function volgende(onderwerpen, beantwoord) {
  const kandidaten = VRAGEN
    .filter(v => beschikbaar(v, onderwerpen, beantwoord))
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

module.exports = { VRAGEN, controle, volgende, winstVan, opent, open };
