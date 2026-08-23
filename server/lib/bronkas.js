/* DE BRONKAS: EEN UITKOMST DIE AAN ZIJN INVOER VASTZIT.

   WAAR DIT UIT KOMT. Een serverstart kostte 3,4 seconde, en daarvan ging ruim
   anderhalve seconde op aan drie scanners die allemaal DEZELFDE broncodeboom
   aflopen en er allemaal iets anders uit halen: lib/ui-bronnen.js (welke teksten
   zijn aantoonbaar RTG-interface), kern/magnaat-capabilities.js en
   kern/magnaat-dekkingsmatrix.js. De toetssuite start 647 servers en de
   schermsuite nog eens 184. Dat is bij elke start opnieuw dezelfde 24 MB
   ontleden voor een antwoord dat niet is veranderd.

   Gemeten op 23 augustus 2026, en het getal dat de oplossing bepaalt:

     de boom aflopen        16 ms
     alles stat'en          11 ms
     alles LEZEN            47 ms   <- 24 MB
     alles lezen EN hashen 112 ms
     ui-bronnen bouwen     619 ms   <- dit is parsen, geen I/O
     ui-bronnen terugleren  35 ms   uit de kas

   Lezen is dus goedkoop en PARSEN is duur. Daarom hoeft deze kas geen mtimes te
   vertrouwen: de sleutel is een sha256 over de echte inhoud van elk bestand dat
   in de berekening meegaat. Verandert er een byte, dan verandert de sleutel en
   wordt er opnieuw gerekend. Er bestaat geen "de klok liep achter"-geval, geen
   "mijn editor bewaarde de mtime"-geval en geen `git checkout`-geval.

   DAT IS EEN BEWUSTE KEUZE EN GEEN OMISSIE. De snelle weg die bouwsystemen
   nemen -- alleen stat'en en de inhoud-hash uit een eerdere ronde vertrouwen --
   zou 112 ms terugbrengen naar 27. Dat scheelt over de hele suite ongeveer een
   minuut, en het kost de enige eigenschap waar je bij een cache iets aan hebt:
   dat hij niet kan liegen. Een van de drie afnemers is bovendien een
   VEILIGHEIDSregister (welke tekst naar een modelaanbieder mag), en daar is een
   stille verouderde uitkomst geen traagheid maar een gat. 112 ms op een boot van
   3,4 seconde is die zekerheid waard.

   EEN MANIFEST, MEERDERE AFNEMERS. De boom wordt EEN keer afgelopen en gehasht
   per proces; elke afnemer leidt daar zijn eigen sleutel uit af over precies de
   bestanden die hij leest. Drie afnemers kosten dus geen drie rondes.

   FAALT HIJ, DAN REKENT HIJ. Elke fout in de kas -- geen schrijfrechten, een
   halve regel, een schijf die vol is -- leidt tot gewoon opnieuw uitrekenen. Een
   kas mag nooit een reden zijn dat de server niet start. Wat hij NIET doet is
   stil een verkeerde uitkomst teruggeven: dat kan niet, want de sleutel zit aan
   de inhoud vast.

   WAAR HIJ STAAT. In os.tmpdir(), niet in de repository en niet in RTG_DATA_DIR.
   Niet in de repo, want dan zou een draaiende server de broncodeboom muteren en
   dat mag hier niet meer (check.js regel 51). Niet in RTG_DATA_DIR, want elke
   toetsserver krijgt daar een VERSE map -- dan zou de kas per definitie altijd
   leeg zijn en precies niets doen.

   Handhaver: test/bronkas.test.js. Die eist dat een uitkomst uit de kas gelijk
   is aan een verse berekening, dat EEN gewijzigde byte de kas ongeldig maakt,
   dat een kapotte kas terugvalt op rekenen, en dat de kas ook echt geraakt wordt
   (een kas die nooit raak is, is dode code die je wel elke start betaalt). */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const OVERSLAAN = new Set(['node_modules', '.git', 'dist', 'data', 'coverage']);

/* Alle bestanden onder een map die aan het filter voldoen, gesorteerd. Sorteren
   is geen netheid maar een voorwaarde: readdir geeft geen gegarandeerde
   volgorde, en een sleutel die van de volgorde afhangt is bij elke start anders.
   Dan heb je een cache die nooit raak is en wel elke keer geld kost. */
function bestandenOnder(map, filter, uit) {
  uit = uit || [];
  let items;
  try { items = fs.readdirSync(map, { withFileTypes: true }); } catch (e) { return uit; }
  for (const item of items) {
    if (OVERSLAAN.has(item.name)) continue;
    const p = path.join(map, item.name);
    if (item.isDirectory()) bestandenOnder(p, filter, uit);
    else if (!filter || filter(p)) uit.push(p);
  }
  return uit;
}

/* Het manifest: pad -> sha256 van de inhoud, EEN keer per proces per map.
   Meerdere afnemers over dezelfde map delen dit dus. */
const manifesten = new Map();
function manifestVan(map, filter, merk) {
  const sleutel = path.resolve(map) + '|' + (merk || '');
  if (manifesten.has(sleutel)) return manifesten.get(sleutel);
  const uit = new Map();
  for (const p of bestandenOnder(map, filter).sort()) {
    try { uit.set(p, crypto.createHash('sha256').update(fs.readFileSync(p)).digest()); }
    catch (e) { /* net verdwenen: telt als afwezig, en dat verandert de sleutel */ }
  }
  manifesten.set(sleutel, uit);
  return uit;
}

/* De sleutel over een verzameling manifesten, plus wat de afnemer zelf als
   versie meegeeft. Die VERSIE is niet optioneel: verandert de scanner van
   gedrag zonder dat de bronbestanden veranderen, dan zou de oude uitkomst nog
   passen bij de nieuwe sleutel. Vandaar dat elke afnemer de eigen broncode
   meehasht -- zie leesVersie(). */
function sleutelUit(delen) {
  const h = crypto.createHash('sha256');
  for (const deel of delen) {
    if (deel instanceof Map) {
      for (const [p, sha] of deel) { h.update(p); h.update(sha); }
    } else h.update(String(deel));
  }
  return h.digest('hex');
}

/* De eigen broncode van een afnemer meehashen. Zonder dit blijft een oude
   uitkomst geldig nadat de scanner zelf is veranderd -- de invoer is immers
   hetzelfde -- en dan meet je met een nieuwe scanner een oud antwoord. */
function leesVersie(bestanden) {
  const h = crypto.createHash('sha256');
  for (const b of [].concat(bestanden)) {
    try { h.update(fs.readFileSync(b)); } catch (e) { h.update('?'); }
  }
  return h.digest('hex').slice(0, 16);
}

function kasMap(wortel) {
  const stempel = crypto.createHash('sha256').update(path.resolve(wortel)).digest('hex').slice(0, 12);
  return path.join(os.tmpdir(), 'rtg-bronkas-' + stempel);
}

const tellers = { raak: 0, mis: 0, fout: 0, bespaardMs: 0 };

/* DE KAS BEWIJST ZIJN EIGEN GAAFHEID, HIJ VRAAGT DAT NIET AAN DE AFNEMER.

   Hier stond alleen `vanTekst(rauw)`, met de regel "geeft dat null, dan rekenen
   we opnieuw". Voor een afnemer die JSON opslaat werkt dat: kapotte JSON gooit.
   Voor een afnemer die PLATTE TEKST opslaat werkt het niet, want er is geen
   tekst die ongeldig is -- een half overschreven kasbestand kwam er gewoon als
   geldige waarde uit. test/bronkas.test.js vond dat meteen: waar 'a.txt' hoorde
   te staan kwam ' half geschreven ' terug.

   Dat is niet iets om per afnemer op te lossen, want dan hangt de gaafheid van
   de kas af van wie hem gebruikt. Elke inhoud draagt daarom zijn eigen sha256
   op de eerste regel. Klopt die niet, dan bestaat de kas niet en wordt er
   gerekend. Zo kan een afgebroken schrijfactie, een volle schijf of een
   handmatige knoei nooit een antwoord opleveren dat er goed uitziet. */
const KOPLENGTE = 64;
function inpak(tekst) {
  return crypto.createHash('sha256').update(tekst).digest('hex') + '\n' + tekst;
}
function ontpak(rauw, vanTekst) {
  const knip = rauw.indexOf('\n');
  if (knip !== KOPLENGTE) return null;
  const kop = rauw.slice(0, KOPLENGTE);
  const lijf = rauw.slice(knip + 1);
  if (crypto.createHash('sha256').update(lijf).digest('hex') !== kop) return null;
  return vanTekst(lijf);
}

/* De kern. `bereken` levert de verse uitkomst; `naarTekst`/`vanTekst` maken hem
   opslaanbaar. Geen JSON afdwingen: de grootste afnemer is een lijst van 87.000
   teksten en die gaat als regels tien keer sneller heen en weer dan als JSON. */
function geheugen({ wortel, naam, sleutel, bereken, naarTekst, vanTekst }) {
  const map = kasMap(wortel);
  const bestand = path.join(map, naam + '-' + sleutel.slice(0, 32) + '.kas');
  try {
    const rauw = fs.readFileSync(bestand, 'utf8');
    const uit = ontpak(rauw, vanTekst);
    if (uit !== undefined && uit !== null) { tellers.raak++; return uit; }
    tellers.fout++;                       // leesbaar maar onbruikbaar: opnieuw
  } catch (e) {
    if (e.code !== 'ENOENT') tellers.fout++;   // stuk of onleesbaar telt apart van "nog niet gezien"
    else tellers.mis++;
  }
  const begon = Date.now();
  const vers = bereken();
  tellers.bespaardMs += Date.now() - begon;
  /* Schrijven via een tijdelijk bestand en een rename: twee servers die
     tegelijk starten (en dat zijn er hier vier) mogen elkaar geen halve kas
     laten lezen. Mislukt het schrijven, dan is dat geen fout -- we hebben de
     uitkomst al. */
  try {
    fs.mkdirSync(map, { recursive: true, mode: 0o700 });
    const tmp = bestand + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, inpak(naarTekst(vers)));
    fs.renameSync(tmp, bestand);
    ruimOp(map, naam);
  } catch (e) { tellers.fout++; }
  return vers;
}

/* DE KAS MAG NIET ONBEPERKT GROEIEN.

   Een broncodestand kost hier 16 MB (12 MB capability-graaf, 3 MB UI-register).
   Elke wijziging aan de bron maakt een NIEUWE sleutel en dus een nieuw paar.
   Wie een dag lang schakelt tussen takken laat zo honderden megabytes in de
   tijdelijke map achter -- en dan is een versnelling een lek geworden.

   Drie per soort blijven staan, op leeftijd. Niet een: heen en weer springen
   tussen twee takken is normaal, en met een enkele plek zou dat elke keer weer
   1,3 seconde per serverstart kosten. Drie vangt dat op zonder de map te laten
   groeien.

   Opruimen is nooit een reden om te falen: een bestand dat net door een andere
   server is weggehaald geeft ENOENT, en die leest dan gewoon opnieuw. */
function ruimOp(map, naam, houd) {
  houd = houd || 3;
  let namen;
  try { namen = fs.readdirSync(map); } catch (e) { return; }
  const mijn = namen.filter(n => n.startsWith(naam + '-') && n.endsWith('.kas'))
    .map(n => {
      const p = path.join(map, n);
      try { return { p, t: fs.statSync(p).mtimeMs }; } catch (e) { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => b.t - a.t);
  for (const oud of mijn.slice(houd)) {
    try { fs.unlinkSync(oud.p); } catch (e) { /* al weg, of van iemand anders */ }
  }
}

module.exports = { manifestVan, sleutelUit, leesVersie, geheugen, bestandenOnder, kasMap, ruimOp, tellers };
