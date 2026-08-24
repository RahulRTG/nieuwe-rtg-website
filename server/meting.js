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
      doorgaans minder streng bewaakt is dan de database.

   De cijfers staan in het geheugen en gaan bij een herstart verloren. Dat hoort
   zo: Prometheus telt zelf de verschillen, en een teller die na een herstart op
   nul begint is precies wat het formaat verwacht.
   ========================================================================== */
'use strict';

/* Emmers in seconden. Onder de 25 ms fijnmazig (daar zit het normale werk),
   daarboven grover (daar gaat het toch al mis).

   DE ONDERSTE VIJF EMMERS ZIJN ERBIJ GEKOMEN. De reeks begon op 5 ms, en
   gemeten op 24 augustus 2026 viel 99,41% van alle verzoeken in die EERSTE
   emmer. Elk percentiel eronder was daarmee een verzinsel binnen een enkele
   emmer: twee servers waarvan de ene twee keer zo snel was, rapporteerden
   dezelfde p50, p90, p95 en p99. SLO.md legt doelen vast op juist die reeks.
   Waarom het er vijf werden en geen drie is gemeten: zie PRESTATIES.md. */
const EMMERS = [0.0001, 0.00025, 0.0005, 0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

// De tijd via lib/klok.js: verzetbaar in een toets, en buiten de klokschuld.
// Boven `staat`, want die vraagt hem meteen bij het laden.
const rtgKlok = require('./lib/klok');

const staat = {
  gestart: rtgKlok.nu(),
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

/* Het Prometheus-tekstformaat staat in ./meting-tekst.js: tellen en uitschrijven
   zijn twee zaken, en deze module telt. */
const metingTekst = require('./meting-tekst');
const tekst = () => metingTekst.tekst(staat, EMMERS, statusKlasse);

function samenvatting() {
  let totaal = 0, fout5xx = 0, som = 0, aantal = 0;
  for (const [k, n] of staat.verzoeken) {
    totaal += n;
    if (k.endsWith(' 5xx')) fout5xx += n;
  }
  for (const d of staat.duur.values()) { som += d.som; aantal += d.aantal; }
  return {
    uptimeSeconden: Math.round((rtgKlok.nu() - staat.gestart) / 1000),
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
  staat.open = 0; staat.gestart = rtgKlok.nu();
}

module.exports = { middleware, telVerzoek, telFout, tekst, samenvatting, reeksen, wis, EMMERS, statusKlasse,
  lusVertraging, lusWis };
