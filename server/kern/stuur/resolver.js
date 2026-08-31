/* DE CAPABILITY-RESOLVER -- welke van de toegestane paden gaan over DEZE vraag.

   WAAROM DIT BESTAAT. De tool `kaart` in ./lus.js gaf het model de complete
   toegestane lijst voor zijn rol: elk pad dat een mens ooit voor die wereld
   heeft vrijgegeven, bij elke vraag opnieuw. Voor "zet een timer" kreeg het
   model dus ook de bankroutes te zien. Dat kost tokens, maakt de keuze
   ambiguer, en vergroot het oppervlak waarop een verkeerd gekozen pad kan
   ontstaan.

   DIT VERANDERT GEEN ENKELE BEVOEGDHEID, en dat is de hele opzet. De resolver
   krijgt de lijst die ./beleid.js al heeft goedgekeurd en maakt hem KLEINER
   voor deze ene opdracht. Hij kan niets toevoegen -- structureel niet, want
   hij filtert een array die hij binnenkrijgt en verzint nooit een pad. Wie hem
   weghaalt, houdt precies het gedrag van gisteren over.

   DE WOORDENSCHAT KOMT UIT DE PADEN ZELF. De verleiding is een tabel
   "bestellen -> /api/supplier/agent/voorstel". Dat is een tweede routelijst, en
   die loopt binnen een maand achter op de echte (LAT.md regel 4, en
   scripts/check.js regel 56 telt eigen routelijsten om precies deze reden). De
   segmenten van een pad ZIJN de woordenschat: /api/bank/overboek draagt de
   woorden `bank` en `overboek`. Komt er een route bij, dan doet de resolver het
   meteen -- niemand hoeft iets bij te werken.

   ER IS EEN KLEINE WOORD-NAAR-WOORD-LIJST, EN DIE HEEFT TANDEN. Een mens zegt
   "rekening" waar het pad `bank` heet en "taxi" waar het pad `ride` heet. Die
   brug staat in SYNONIEMEN, en hij mapt uitsluitend woord op WOORD -- nooit
   woord op pad. Bovendien toetst test/stuur-resolver.test.js dat elk doelwoord
   ook echt als segment in de router voorkomt: een synoniem dat nergens meer
   heen wijst, laat de bouw zakken. Dat is dezelfde les als de cap `rooms` uit
   PLATFORM.md, die een document noemde en die niet bestond.

   EN HIJ VERSMALT NOOIT NAAR NIETS. Levert de weging geen enkel pad op, dan
   gaat de volledige lijst terug met de reden erbij. Een leeg werkveld zou het
   model laten zeggen "dat kan ik niet", en dat is een leugen over wat de
   gebruiker mag -- erger dan een lijst die te lang is (LAT.md: liever te hard
   dan een liegbeest). Om dezelfde reden kan het model in ./lus.js altijd om de
   ONGEFILTERDE lijst vragen: een fout in deze weging mag nooit een vermogen
   verbergen. */
'use strict';
const { woordenUit, inhoudswoorden } = require('./resolver-woorden');

const MIN_STAM = 4;   // korter dan dit is een prefixtreffer toeval
const STANDAARD_MAX = 15;

/* De segmenten van een pad, OOK op het koppelteken. `btw-herinner` is voor een
   mens twee woorden, en "stuur de btw-herinnering" raakte het pad daarom niet:
   de resolver koos /rtmail/stuur en liet juist /rtmail/btw-herinner weg. Dat is
   een gemist vermogen, en dat weegt hier zwaarder dan een kortere lijst. */
function segmentenVan(pad) {
  return String(pad || '').split(/[/-]/).filter(Boolean).map(s => s.toLowerCase());
}

/* WELKE SEGMENTEN ZEGGEN NIETS? Een segment dat in ELK pad van de lijst staat,
   onderscheidt niets: `api` altijd, en `supplier` in elk pad van een zaak.

   Dit was eerst een opsomming (`api`, `member`, `staff`) en dat was fout op de
   manier die deze laag juist moet vermijden. `supplier` stond er niet bij, dus
   "hoe gaat het met mijn zaak" raakte via de brug `zaak -> supplier` ALLE
   veertig paden even hard en leverde de eerste vijftien op alfabet op. Dat is
   geen versmalling maar een willekeurige greep -- en willekeur die het gevraagde
   vermogen kan verbergen is erger dan geen versmalling.

   Het wordt daarom GETELD in plaats van opgesomd. Een lijst die morgen een
   vierde rolvoorvoegsel krijgt, doet het meteen goed; niemand hoeft iets bij te
   werken. Dezelfde redenering als de woordenschat zelf: afleiden, niet
   opschrijven. */
function nietszeggendeSegmenten(paden) {
  const telling = new Map();
  for (const pad of paden)
    for (const seg of new Set(segmentenVan(pad)))
      telling.set(seg, (telling.get(seg) || 0) + 1);
  const uit = new Set();
  for (const [seg, n] of telling) if (n === paden.length) uit.add(seg);
  return uit;
}

/* Raakt dit woord dit segment? Gelijk telt vol; anders telt een gedeelde
   voorkant van minstens MIN_STAM tekens (bestelling/bestel, boeking/boek). */
function raakt(woord, segment) {
  if (woord === segment) return 3;
  const kort = woord.length < segment.length ? woord : segment;
  const lang = woord.length < segment.length ? segment : woord;
  if (kort.length >= MIN_STAM && lang.startsWith(kort)) return 2;
  return 0;
}

function weeg(pad, woorden, nietszeggend) {
  const segmenten = segmentenVan(pad).filter(s => !(nietszeggend && nietszeggend.has(s)));
  if (!segmenten.length) return { score: 0, raakvlak: [] };
  const laatste = segmenten[segmenten.length - 1];
  let score = 0;
  const raakvlak = new Set();
  for (const seg of segmenten) {
    let beste = 0;
    for (const w of woorden) {
      const p = raakt(w, seg);
      if (p > beste) { beste = p; if (p) raakvlak.add(w); }
    }
    if (beste) score += beste + (seg === laatste ? 1 : 0); // het werkwoord weegt zwaarder
  }
  return { score, raakvlak: [...raakvlak] };
}

/* DE RESOLVER. `paden` is de al toegestane lijst (uit stuurPaden); wat eruit
   komt is altijd een deelverzameling daarvan, gesorteerd op hoe sterk een pad
   de woorden van de vraag raakt. */
function resolveer(vraag, paden, opties) {
  const alles = Array.isArray(paden) ? paden.filter(p => typeof p === 'string') : [];
  const max = Math.max(1, Number((opties && opties.max)) || STANDAARD_MAX);
  const geenVersmalling = (reden) => ({ paden: alles, versmald: false, reden, aantalVoor: alles.length });

  if (!alles.length) return geenVersmalling('Er zijn geen toegestane paden om uit te kiezen.');
  const woorden = woordenUit(vraag);
  if (!woorden.length)
    return geenVersmalling('De vraag draagt geen woorden om op te wegen; de volledige lijst blijft staan.');
  if (alles.length <= max)
    return geenVersmalling('De toegestane lijst is al klein genoeg om ongefilterd te tonen.');

  const nietszeggend = nietszeggendeSegmenten(alles);
  const gewogen = alles.map(pad => Object.assign({ pad }, weeg(pad, woorden, nietszeggend))).filter(r => r.score > 0);
  if (!gewogen.length)
    return geenVersmalling('Geen enkel pad raakt de woorden van deze vraag; ' +
      'de volledige lijst blijft staan in plaats van een leeg werkveld.');

  gewogen.sort((a, b) => b.score - a.score || a.pad.localeCompare(b.pad));
  const gekozen = gewogen.slice(0, max);

  /* DUN BEWIJS IS GEEN BEWIJS. "Zet een afsrpaak in mijn agneda" heeft twee
     typefouten; van de drie inhoudswoorden raakte alleen `zet` iets, en dat
     leverde precies een pad op -- /api/bank/terugkerend/zet, dat met de vraag
     niets te maken heeft. Zo'n versmalling is geen selectie maar een gok op een
     werkwoord, en zij verbergt het gevraagde vermogen volledig.

     Raakt maar EEN van de woorden iets terwijl de vraag er drie of meer draagt,
     dan gaat de volledige lijst terug. Dat kost compactheid en levert dekking
     op, en die ruil staat expres deze kant op: liever veertien relevante paden
     dan drie waarvan de juiste ontbreekt (scripts/resolver.js meet allebei). */
  const geraakt = new Set(gekozen.flatMap(r => r.raakvlak));
  const kern = inhoudswoorden(vraag);
  if (geraakt.size <= 1 && kern.length >= 3)
    return geenVersmalling('Maar een van de ' + kern.length + ' woorden in deze vraag raakt een pad; ' +
      'dat is te dun om de rest weg te laten. De volledige lijst blijft staan.');
  return {
    paden: gekozen.map(r => r.pad),
    versmald: true,
    aantalVoor: alles.length,
    reden: 'Van ' + alles.length + ' toegestane paden zijn dit de ' + gekozen.length +
      ' die de woorden van deze opdracht raken. Vraag om de volledige lijst als er iets tussen zou moeten staan.',
    raakvlak: [...new Set(gekozen.flatMap(r => r.raakvlak))]
  };
}

module.exports = { resolveer, segmentenVan, nietszeggendeSegmenten, STANDAARD_MAX };
