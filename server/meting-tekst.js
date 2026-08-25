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
  for (const [k, n] of staat.verzoeken) {
    const [methode, patroon, klasse] = [k.slice(0, k.indexOf(' ')), k.slice(k.indexOf(' ') + 1, k.lastIndexOf(' ')), k.slice(k.lastIndexOf(' ') + 1)];
    r.push('rtg_verzoeken_totaal{methode="' + ontsnap(methode) + '",route="' + ontsnap(patroon) + '",status="' + klasse + '"} ' + n);
  }

  r.push('# HELP rtg_duur_seconden Verwerkingsduur per route.');
  r.push('# TYPE rtg_duur_seconden histogram');
  for (const [k, d] of staat.duur) {
    const methode = k.slice(0, k.indexOf(' '));
    const patroon = k.slice(k.indexOf(' ') + 1);
    const label = '{methode="' + ontsnap(methode) + '",route="' + ontsnap(patroon) + '"';
    for (let i = 0; i < EMMERS.length; i++)
      r.push('rtg_duur_seconden_bucket' + label + ',le="' + EMMERS[i] + '"} ' + d.emmers[i]);
    r.push('rtg_duur_seconden_bucket' + label + ',le="+Inf"} ' + d.aantal);
    r.push('rtg_duur_seconden_sum' + label + '} ' + d.som.toFixed(6));
    r.push('rtg_duur_seconden_count' + label + '} ' + d.aantal);
  }

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
