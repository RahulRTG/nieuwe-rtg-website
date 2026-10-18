/* De meting, deel "tekst": het Prometheus-formaat.

   Apart van ./meting.js omdat het een andere zaak is -- daar wordt GETELD, hier
   wordt het uitgeschreven -- en omdat meting.js anders tegen de omvangsgrens van
   de keuring aan groeit. Deze module houdt zelf niets bij; hij krijgt de staat
   mee en levert tekst.

   Handgeschreven, want een pakket hiervoor binnenhalen zou de enige dependency
   van het hele project zijn voor iets van dertig regels. */
'use strict';
const { lusVertraging } = require('./meting-lus');
/* De tijd komt uit lib/klok.js en niet rechtstreeks van het besturingssysteem:
   dan kan een toets hem verzetten, en telt deze module niet mee in de klokschuld
   (scripts/klok.js ratelt daarop). */
const rtgKlok = require('./lib/klok');

const ontsnap = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');

/* DE REGELS WORDEN EEN KEER GEBOUWD, NIET PER SCRAPE.

   Een label hangt alleen af van zijn sleutel ("METHODE patroon [klasse]") en
   die sleutel verandert nooit van inhoud; alleen de getallen erachter lopen op.
   Toch werd hier per scrape voor elke reeks het patroon opnieuw geknipt, drie
   keer door een regex gehaald en negentien regels opnieuw samengesteld: met
   ruim vierduizend routes maal zestien emmers is dat tegen de honderdduizend
   tussenstrings per aanroep, en gemeten 40 ms per scrape op de lus. In De
   Beproeving van 18 oktober 2026 was deze functie de grootste enkele bron van
   allocaties in de server (333 MB per 40 s storm, 14% van alles) en 2,2 s CPU --
   en elke megabyte is een scavenge-pauze die de storm als event-loop-vertraging
   terugziet.

   Per reeks blijft daarom haar laatst gebouwde TEKSTBLOK staan, samen met het
   tellerobject en de stand waarbij hij is gebouwd. Een route die sinds de vorige
   scrape niet is geraakt (onder een storm is dat ruim negen van de tien) krijgt
   haar blok ongewijzigd terug; een geraakte route wordt herbouwd zodra `aantal`
   (of bij de tellers `n`) verschilt. Het tellerobject gaat mee in de vergelijking
   omdat wis() nieuwe objecten maakt: een nieuwe reeks met toevallig hetzelfde
   aantal mag nooit het blok van haar voorganger tonen. De kaarten groeien mee met
   het aantal reeksen, en dat aantal is al begrensd door de regel dat er op het
   routePATROON wordt geteld (zie meting.js). De uitvoer is byte voor byte
   dezelfde als voorheen; test/meting.test.js leest hem na een mutatie opnieuw. */
const blokVerzoek = new Map();   // "METHODE patroon klasse" -> { kop, n, regel }
const blokDuur = new Map();      // "METHODE patroon" -> { emmer, inf, som, aantal, d, stand, blok }
let emmerSuffix = null, emmerBron = null;
function verzoekRegel(k, n) {
  let b = blokVerzoek.get(k);
  if (b === undefined) {
    const methode = k.slice(0, k.indexOf(' ')), patroon = k.slice(k.indexOf(' ') + 1, k.lastIndexOf(' ')), klasse = k.slice(k.lastIndexOf(' ') + 1);
    b = { kop: 'rtg_verzoeken_totaal{methode="' + ontsnap(methode) + '",route="' + ontsnap(patroon) + '",status="' + klasse + '"} ', n: -1, regel: '' };
    blokVerzoek.set(k, b);
  }
  if (b.n !== n) { b.n = n; b.regel = b.kop + n; }
  return b.regel;
}
function duurBlok(k, d, EMMERS) {
  if (emmerBron !== EMMERS) { emmerBron = EMMERS; emmerSuffix = EMMERS.map(e => ',le="' + e + '"} '); blokDuur.clear(); }
  let b = blokDuur.get(k);
  if (b === undefined) {
    const methode = k.slice(0, k.indexOf(' ')), patroon = k.slice(k.indexOf(' ') + 1);
    const label = '{methode="' + ontsnap(methode) + '",route="' + ontsnap(patroon) + '"';
    b = { emmer: 'rtg_duur_seconden_bucket' + label, inf: 'rtg_duur_seconden_bucket' + label + ',le="+Inf"} ',
      som: 'rtg_duur_seconden_sum' + label + '} ', aantal: 'rtg_duur_seconden_count' + label + '} ',
      d: null, stand: -1, blok: '' };
    blokDuur.set(k, b);
  }
  if (b.d !== d || b.stand !== d.aantal) {
    const r = [];
    for (let i = 0; i < EMMERS.length; i++) r.push(b.emmer + emmerSuffix[i] + d.emmers[i]);
    r.push(b.inf + d.aantal);
    r.push(b.som + d.som.toFixed(6));
    r.push(b.aantal + d.aantal);
    b.d = d; b.stand = d.aantal; b.blok = r.join('\n');
  }
  return b.blok;
}

function tekst(staat, EMMERS, statusKlasse) {
  const r = [];
  r.push('# HELP rtg_up 1 zolang dit proces antwoordt.');
  r.push('# TYPE rtg_up gauge');
  r.push('rtg_up 1');
  r.push('# HELP rtg_uptime_seconds Seconden sinds de start van dit proces.');
  r.push('# TYPE rtg_uptime_seconds gauge');
  r.push('rtg_uptime_seconds ' + ((rtgKlok.nu() - staat.gestart) / 1000).toFixed(0));
  r.push('# HELP rtg_verzoeken_open Verzoeken die nu in behandeling zijn.');
  r.push('# TYPE rtg_verzoeken_open gauge');
  r.push('rtg_verzoeken_open ' + staat.open);
  /* De event-loop-vertraging. Staat hier BEWUST als aparte reeks en niet
     verstopt in de duur-histogrammen: een route die traag lijkt omdat de lus
     vaststaat, is een heel ander probleem dan een route die zelf traag is, en
     op het bord horen die uit elkaar te blijven. Ontbreekt de meter, dan staat
     er niets -- geen nul, want nul zou een meetwaarde zijn. */
  const lv = lusVertraging();
  if (lv) {
    r.push('# HELP rtg_eventloop_vertraging_seconden Hoeveel later de event-loop draaide dan afgesproken.');
    r.push('# TYPE rtg_eventloop_vertraging_seconden gauge');
    for (const [naam, waarde] of [['gemiddeld', lv.gemiddeld], ['p50', lv.p50], ['p99', lv.p99], ['max', lv.max]])
      r.push('rtg_eventloop_vertraging_seconden{soort="' + naam + '"} ' + (waarde / 1000).toFixed(6));
  }

  r.push('# HELP rtg_verzoeken_totaal Afgehandelde verzoeken per route en statusklasse.');
  r.push('# TYPE rtg_verzoeken_totaal counter');
  for (const [k, n] of staat.verzoeken) r.push(verzoekRegel(k, n));

  r.push('# HELP rtg_duur_seconden Verwerkingsduur per route.');
  r.push('# TYPE rtg_duur_seconden histogram');
  for (const [k, d] of staat.duur) r.push(duurBlok(k, d, EMMERS));

  r.push('# HELP rtg_fouten_totaal Onverwachte fouten (500) per soort.');
  r.push('# TYPE rtg_fouten_totaal counter');
  for (const [soort, n] of staat.fouten)
    r.push('rtg_fouten_totaal{soort="' + ontsnap(soort) + '"} ' + n);

  const mem = process.memoryUsage();
  r.push('# HELP rtg_geheugen_bytes Geheugengebruik van dit proces.');
  r.push('# TYPE rtg_geheugen_bytes gauge');
  r.push('rtg_geheugen_bytes{soort="heap_gebruikt"} ' + mem.heapUsed);
  r.push('rtg_geheugen_bytes{soort="rss"} ' + mem.rss);
  return r.join('\n') + '\n';
}

/* Voor tests en het techniekbord: dezelfde cijfers als object. */

module.exports = { tekst, ontsnap };
