/* ============================================================================
   De meting: hoeveel verzoeken, hoeveel fouten, hoe lang duurde het.

   Zonder dit kun je geen SLA aanbieden -- je kunt geen belofte doen over iets
   wat je niet meet, en "we hebben het gevoel dat het goed gaat" is geen cijfer
   waar een inkoper iets mee kan.

   DRIE KEUZES DIE ERTOE DOEN

   1. WE TELLEN OP HET ROUTEPATROON, NOOIT OP HET PAD. `/api/leden/:id` is een
      reeks; `/api/leden/8412` is er een per lid. Dat tweede is de klassieke
      manier om je eigen monitoring om te leggen: een miljoen tijdreeksen, en
      Prometheus valt om voordat je server dat doet. server/web/routing.js zet
      daarom req.routePatroon.

   2. HISTOGRAM MET VASTE EMMERS, GEEN LIJST MET METINGEN. Een emmer is een
      teller; het geheugen staat vast, ongeacht hoeveel verkeer er is. Met de
      emmers hieronder is p50, p90 en p99 te benaderen, en dat is wat een SLO
      nodig heeft.

   3. GEEN PERSOONSGEGEVENS. Geen paden met namen erin, geen IP's, geen
      codenamen. Een metrics-endpoint wordt gescrapet door een systeem dat
      doorgaans minder streng bewaakt is dan de database; daar hoort niets in
      te staan wat over een persoon gaat.

   De cijfers staan in het geheugen en gaan bij een herstart verloren. Dat hoort
   zo: Prometheus telt zelf de verschillen, en een teller die na een herstart op
   nul begint is precies wat het formaat verwacht.
   ========================================================================== */
'use strict';

/* Emmers in seconden. Onder de 25 ms fijnmazig (daar zit het normale werk),
   daarboven grover (daar gaat het toch al mis).

   DE ONDERSTE VIJF EMMERS ZIJN ERBIJ GEKOMEN, en dat is een correctie op een
   blinde vlek die niemand zag omdat het bord er prima uitzag.

   De reeks begon op 5 ms. Gemeten op 24 augustus 2026 viel 99,41% van alle
   verzoeken in die EERSTE emmer, bij een gemiddelde van 0,46 ms. Elk percentiel
   onder de 5 ms was daarmee geen meting maar een verzinsel binnen een enkele
   emmer: twee servers waarvan de ene twee keer zo snel was, rapporteerden
   dezelfde p50, p90, p95 en p99.

   Dat is erger dan onnauwkeurig. SLO.md legt doelen vast op p90 en p99 van deze
   reeks; een instrument dat 0,3 ms niet van 4,9 ms kan onderscheiden ziet een
   route die tien keer trager wordt pas als hij de 5 ms passeert. Waarom het er
   vijf werden en geen drie is gemeten, niet gegokt: zie PRESTATIES.md.

   De prijs is 45% meer tijdreeksen; het aantal emmers ligt vast per route, dus
   het geheugen blijft begrensd -- keuze 2 hieronder verandert er niet door. */
const EMMERS = [0.0001, 0.00025, 0.0005, 0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

const staat = {
  gestart: Date.now(),
  verzoeken: new Map(),   // "METHODE patroon statusklasse" -> aantal
  duur: new Map(),        // "METHODE patroon" -> { emmers: [], som, aantal }
  fouten: new Map(),      // "soort" -> aantal (onverwachte fouten uit de foutmiddleware)
  open: 0
};

// de event-loop-vertraging: eigen bestand, zie de kop daar waarom
const { lusVertraging, lusWis } = require('./meting-lus');

/* Onbekende paden vallen samen op een enkele noemer. Zonder dit zou een
   scanner die duizend niet-bestaande adressen probeert, duizend tijdreeksen
   aanmaken -- precies de aanval waar punt 1 hierboven over gaat. */
const patroonVan = (req) => req.routePatroon || '(onbekend)';
const statusKlasse = (code) => (code >= 500 ? '5xx' : code >= 400 ? '4xx' : code >= 300 ? '3xx' : '2xx');

function telVerzoek(methode, patroon, status, seconden) {
  const k = methode + ' ' + patroon + ' ' + statusKlasse(status);
  staat.verzoeken.set(k, (staat.verzoeken.get(k) || 0) + 1);

  const dk = methode + ' ' + patroon;
  let d = staat.duur.get(dk);
  if (!d) { d = { emmers: new Array(EMMERS.length).fill(0), som: 0, aantal: 0 }; staat.duur.set(dk, d); }
  d.som += seconden; d.aantal++;
  for (let i = 0; i < EMMERS.length; i++) if (seconden <= EMMERS[i]) d.emmers[i]++;
}

function telFout(soort) {
  const s = String(soort || 'onbekend').slice(0, 60);
  staat.fouten.set(s, (staat.fouten.get(s) || 0) + 1);
}

/* De middleware. Meet op 'finish', want pas dan staat de status vast. */
function middleware() {
  return function meten(req, res, next) {
    const begin = process.hrtime.bigint();
    staat.open++;
    let gedaan = false;
    const klaar = () => {
      if (gedaan) return;
      gedaan = true;
      staat.open--;
      const sec = Number(process.hrtime.bigint() - begin) / 1e9;
      telVerzoek(req.method || 'GET', patroonVan(req), res.statusCode || 0, sec);
    };
    res.on('finish', klaar);
    res.on('close', klaar);  // afgebroken verbinding telt ook mee
    next();
  };
}

/* ---------- het Prometheus-tekstformaat ----------
   Handgeschreven, want een pakket hiervoor binnenhalen zou de enige dependency
   van het hele project zijn voor iets van dertig regels. */
const ontsnap = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');

function tekst() {
  const r = [];
  r.push('# HELP rtg_up 1 zolang dit proces antwoordt.');
  r.push('# TYPE rtg_up gauge');
  r.push('rtg_up 1');
  r.push('# HELP rtg_uptime_seconds Seconden sinds de start van dit proces.');
  r.push('# TYPE rtg_uptime_seconds gauge');
  r.push('rtg_uptime_seconds ' + ((Date.now() - staat.gestart) / 1000).toFixed(0));
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
function samenvatting() {
  let totaal = 0, fout5xx = 0, som = 0, aantal = 0;
  for (const [k, n] of staat.verzoeken) {
    totaal += n;
    if (k.endsWith(' 5xx')) fout5xx += n;
  }
  for (const d of staat.duur.values()) { som += d.som; aantal += d.aantal; }
  return {
    uptimeSeconden: Math.round((Date.now() - staat.gestart) / 1000),
    verzoeken: totaal, fouten5xx: fout5xx,
    foutpercentage: totaal ? Number((fout5xx / totaal * 100).toFixed(3)) : 0,
    gemiddeldeDuurMs: aantal ? Number((som / aantal * 1000).toFixed(2)) : 0,
    reeksen: staat.verzoeken.size + staat.duur.size,
    open: staat.open,
    // null als er niet gemeten kan worden; zie lusVertraging()
    eventLoopMs: lusVertraging()
  };
}

/* De ruwe reeksen als gegevens, voor de SLO-meter (kern/command/slo.js).

   Dit is GEEN tweede telling maar een derde vorm van dezelfde tellers: tekst()
   maakt er Prometheus van, samenvatting() maakt er één regel van, en dit maakt
   er de losse reeksen van omdat een servicedoel per route en per statusklasse
   moet kunnen kiezen. Wie hier zelf zou gaan tellen, zou binnen een maand iets
   anders zeggen dan /api/metrics. */
function reeksen() {
  const verzoeken = [];
  for (const [k, n] of staat.verzoeken) {
    verzoeken.push({
      methode: k.slice(0, k.indexOf(' ')),
      route: k.slice(k.indexOf(' ') + 1, k.lastIndexOf(' ')),
      status: k.slice(k.lastIndexOf(' ') + 1),
      aantal: n
    });
  }
  const duur = [];
  for (const [k, d] of staat.duur) {
    duur.push({ methode: k.slice(0, k.indexOf(' ')), route: k.slice(k.indexOf(' ') + 1),
      emmers: d.emmers.slice(), som: d.som, aantal: d.aantal });
  }
  return { gestart: staat.gestart, emmers: EMMERS.slice(), verzoeken, duur };
}

function wis() {
  staat.verzoeken.clear(); staat.duur.clear(); staat.fouten.clear();
  staat.open = 0; staat.gestart = Date.now();
}

module.exports = { middleware, telVerzoek, telFout, tekst, samenvatting, reeksen, wis, EMMERS, statusKlasse,
  lusVertraging, lusWis };
