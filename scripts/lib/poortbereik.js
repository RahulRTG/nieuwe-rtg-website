/* WAT KEURINGSREGEL 28 NIET ZIET -- de blinde vlek van de poortcontrole, gemeten.

   Regel 28 eist per API-route een poort of een plek op de publieke lijst. Hij
   leest daarvoor de BRON, met een uitdrukking op `app.<verb>('/api/...')`. Die
   uitdrukking ziet drie van de vier manieren waarop dit huis een route ophangt
   niet:

     app.post('/api/ik/zet', ...)                letterlijk        -- WEL gezien
     app.use('/api/foundation', router)          router met mount  -- NIET
     mount('/api/supplier/kantoorpakket', ...)   voorvoegsel-hulpje -- NIET
     p('/notitie', ...)                          hulpje in een hulpje -- NIET

   Dat is dezelfde oorzaak die scripts/lib/routes.js al een keer heeft opgeruimd:
   een regex over de bron gaf daar 2934 routes waar de router er 4191 heeft, en
   vier bewijsproeven misten daardoor exact dezelfde 1257 routes. Deze module
   stelt die vraag voor de POORTcontrole.

   DE UITSLAG BIJ HET AANZETTEN (2 september 2026): regel 28 ziet 4154 unieke
   /api-paden, de router kent er 4717, dus 565 vallen buiten de controle --
   waarvan er 385 volgens de router geen enkele bewakerslaag hebben. Per tak:
   foundation 342, supplier 85, member 80, rtf 43, scim 15, office 6, techniek 6.

   HET ZIJN ER 565 EN NIET 341. De audit die dit vond telde `router.<verb>()` in
   de brontekst en kwam op 341; de vergelijking met de LEVENDE routetabel geeft
   565. Het verschil zijn de voorvoegsel-hulpjes, die in geen van beide
   tekstzoektochten voorkomen. Dat is precies waarom deze meting de router
   raadpleegt en niet nog een regex.

   WAAROM DIT MEET EN NIET BLOKKEERT. Vijfhonderdvijfenzestig routes in een keer
   rood zetten maakt van regel 28 een muur die iemand binnen een week uitzet, en
   "geen bewakerslaag" is bovendien niet hetzelfde als "onbeveiligd": honderden
   routes in deze takken controleren een capability-token IN de handler, en de
   router meldt dat eerlijk als een lege bewakerslijst MET bewakersBekend. Wat
   die 565 nodig hebben is een OORDEEL per route, en dat is werk voor een mens
   met de meting ernaast. CONTROLPLANE.md schrijft die volgorde voor: een nieuwe
   handhavingsregel loopt eerst mee zonder te blokkeren -- je kunt niet afdwingen
   wat nooit in de schaduw heeft gelopen.

   NIET VAST TE STELLEN IS GEEN NUL. Kan de routetabel niet worden opgehaald,
   dan geeft deze module dat als REDEN terug en niet als een lege lijst. Een
   blinde vlek die zichzelf als "geen bevindingen" meldt, is precies de fout die
   deze module blootlegt (LAT.md regel 3). */
'use strict';

/* Paden vergelijken zonder over een slotstreep te struikelen: /api/x en /api/x/
   zijn hetzelfde pad. */
const norm = (p) => String(p || '').replace(/\/+$/, '') || '/';

/* Welke /api-paden kent de router die regel 28 nooit heeft gezien?

   `gezienePaden` is de verzameling die regel 28 zelf heeft opgebouwd -- die komt
   dus uit dezelfde uitdrukking waarmee hij oordeelt, en niet uit een tweede
   scanner die ernaast kan gaan lopen (LAT.md regel 4).

   `haalRoutes` is injecteerbaar zodat een toets deze telling kan voeden zonder
   een server te starten. */
/* HET LIJF VAN EEN HANDLER, uit zijn eigen bestand.

   Van de regel waar de route staat tot de eerstvolgende routedefinitie. Dezelfde
   knip als regel 28 zelf hanteert, en om dezelfde reden: zonder die grens loop je
   de buurman in en keur je een ongepoorte route goed omdat de route eronder
   ergens een 403 teruggeeft.

   EERST KNIPPEN, DAN COMMENTAAR WEGHALEN -- en die volgorde is de hele correctheid
   van deze functie. `zonderCommentaar()` VERWIJDERT regels in plaats van ze leeg
   te laten: server/foundation/onderwijs/schrift.js gaat van 124 naar 119 regels.
   Wie het regelnummer uit de routetabel op de GESCHOONDE bron toepast, leest een
   heel andere handler -- bij /api/foundation/agenda scheelde het vijf regels, en
   die route heeft `lesVan` en `docentCheck` allebei, terwijl de classificatie hem
   als ONGEPOORT meldde. Dat is de gevaarlijkste richting van deze meting: een
   route die wel een poort heeft als gat aanwijzen kost vertrouwen, en andersom
   kost het een gat.

   Gevonden door een enkel geval met het oog na te kijken tegen wat de machine
   zei. De knip gaat dus over de RUWE bron, en het commentaar gaat er pas AF van
   het uitgeknipte stuk -- zodat een uitleg die "403" noemt nog steeds niet als
   poort telt. */
function lijfVan(bestand, regel, leesRuw) {
  const bron = leesRuw(bestand);
  if (bron === null) return null;
  const regels = bron.split('\n');
  let eind = Math.max(0, regel);
  while (eind < regels.length && !/(router|app)\.(get|post|put|delete|patch|use)\s*\(/.test(regels[eind])) eind++;
  let stuk = regels.slice(Math.max(0, regel - 1), eind).join('\n');

  /* EEN HANDLER DIE ELDERS WOONT. `router.post('/gezin/uitnodiging/maak', maak);`
     registreert een BENOEMDE functie, en dan bevat het uitgeknipte stuk alleen
     die ene regel -- de poort zit in `maak`. Vijf uitnodigingsroutes stonden zo
     als ongepoort in de lijst terwijl ze het niet zijn.

     We volgen daarom een kale identifier een stap: is het laatste argument een
     naam in plaats van een functie, dan zoeken we die naam in hetzelfde bestand
     op en nemen zijn lijf erbij. Een stap en niet meer -- een ketting van
     doorverwijzingen navolgen wordt raden, en dan is een groene uitslag niets
     waard. Wat we niet kunnen volgen, blijft eerlijk in de lijst staan. */
  const kaal = /\.(get|post|put|delete|patch)\s*\([^,]+,\s*([A-Za-z_$][\w$]*)\s*\)/.exec(stuk);
  if (kaal) {
    /* Groep 2 en niet groep 1: groep 1 is het werkwoord (`post`). Die verwisseling
       kostte een ronde waarin deze tak niets deed en de vijf uitnodigingsroutes
       als ongepoort bleven staan -- de regex klopte, de index niet. */
    const naam = kaal[2];
    const def = new RegExp('(?:function\\s+' + naam + '\\s*\\(|(?:const|let|var)\\s+' + naam + '\\s*=)');
    const at = regels.findIndex(r => def.test(r));
    if (at >= 0) {
      let e2 = at + 1;
      while (e2 < regels.length && !/(router|app)\.(get|post|put|delete|patch|use)\s*\(/.test(regels[e2])
        && !/^(?:function|const|let|var)\s/.test(regels[e2])) e2++;
      stuk += '\n' + regels.slice(at, e2).join('\n');
    }
  }
  /* LOKALE HULPJES DIE (req, res) KRIJGEN, een niveau diep.

     Bijna elke submodule van de foundation- en schooltak zet een eigen wikkel om
     de poort: `const mijn = (req,res) => { const pv = personeelVan(req,res); ... }`,
     `const sessie = (req,res) => { const s = sessieVan(req,res); ... }`. De
     handler roept dan `mijn(req,res)` aan en de echte poortnaam staat nergens in
     zijn lijf.

     Namen bijhouden werkte niet: `sessie`, `mijn` en `poort` botsten alle drie
     met een gelijknamig iets dat GEEN poort is (een berichtenlijst, een
     taalbeleid-uitkomst). Drie keer bijna een verkeerde uitslag. Daarom niet de
     naam maar de VORM: wordt er in dit bestand iets met `(req` aangeroepen dat
     hier ook gedefinieerd staat, dan hoort de definitie bij het lijf.

     Een niveau, net als hierboven. Verder navolgen is raden. */
  const gezien = new Set();
  for (const m of stuk.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(\s*req\b/g)) {
    const naam = m[1];
    if (gezien.has(naam) || naam === 'require') continue;
    gezien.add(naam);
    const def = new RegExp('(?:function\\s+' + naam + '\\s*\\(|(?:const|let|var)\\s+' + naam + '\\s*=)');
    const at = regels.findIndex(r => def.test(r));
    if (at < 0) continue;
    let e2 = at + 1;
    while (e2 < regels.length && e2 < at + 30
      && !/(router|app)\.(get|post|put|delete|patch|use)\s*\(/.test(regels[e2])) e2++;
    stuk += '\n' + regels.slice(at, e2).join('\n');
  }
  try { return require('./bron').zonderCommentaar(stuk); } catch (e) { return stuk; }
}

/* Welke /api-paden kent de router die regel 28 nooit heeft gezien, en WAT ZIJN
   HET?

   `gezienePaden` is de verzameling die regel 28 zelf heeft opgebouwd -- die komt
   dus uit dezelfde uitdrukking waarmee hij oordeelt, en niet uit een tweede
   scanner die ernaast kan gaan lopen (LAT.md regel 4). Hetzelfde geldt voor
   `poortMw` en `poortBinnen`: die worden MEEGEGEVEN en niet hier herhaald.

   Zonder die twee kan deze module alleen tellen. Met die twee kan hij
   classificeren, en dat is het verschil tussen "565 paden vallen erbuiten" en
   "hiervan zijn er N werkelijk ongepoort". */
function buitenBereik(gezienePaden, opties) {
  const o = opties || {};
  let routes;
  try {
    const haal = o.haalRoutes || require('./routes').alleRoutes;
    routes = haal();
  } catch (e) {
    return { nietVastTeStellen: 'de routetabel kon niet worden opgehaald: ' + (e && e.message || e) };
  }
  if (!Array.isArray(routes) || !routes.length) {
    return { nietVastTeStellen: 'de routetabel gaf geen enkele route terug; dat is geen kaart' };
  }
  const gezien = new Set([...(gezienePaden || [])].map(norm));
  const api = routes.filter(r => r && typeof r.pad === 'string' && r.pad.startsWith('/api/'));
  const buiten = api.filter(r => !gezien.has(norm(r.pad)));
  const paden = [...new Set(buiten.map(r => norm(r.pad)))].sort();
  const perTak = {};
  for (const p of paden) { const t = p.split('/').slice(0, 3).join('/'); perTak[t] = (perTak[t] || 0) + 1; }
  /* `alleApiPaden` gaat mee naar buiten omdat regel 28 hem nodig heeft voor een
     TWEEDE vraag: staat er iets op de publieke lijst dat niet meer bestaat? Die
     controle keek naar de paden die de regel ZELF had gevonden, en die scan mist
     per definitie alles wat via een mount hangt. Zet je zo'n gemonteerde route
     op de publieke lijst, dan meldt hij hem als dode regel terwijl hij springlevend
     is -- precies wat er gebeurde toen /api/foundation/impact erbij kwam. */
  const alleApiPaden = new Set(api.map(r => norm(r.pad)));
  const uit = { paden, perTak, alleApiPaden, gezien: gezien.size, bekend: alleApiPaden.size };

  /* Zonder de poortlijsten blijft het bij tellen. Dat MELDEN we, want een
     classificatie die stilletjes ontbreekt leest als "geen gaten". */
  if (!o.poortMw || !o.poortBinnen) {
    uit.nietGeclassificeerd = 'zonder poortMw en poortBinnen kan deze meting alleen tellen';
    return uit;
  }

  /* RUWE bron, want de regelnummers uit de routetabel horen bij het bestand
     zoals het op schijf staat. Zie de kop van lijfVan(). */
  const cache = new Map();
  const lees = o.lees || ((b) => {
    if (cache.has(b)) return cache.get(b);
    let t = null;
    try { t = require('fs').readFileSync(b, 'utf8'); } catch (e) { t = null; }
    cache.set(b, t);
    return t;
  });

  /* DE GEGENEREERDE FAMILIES. Een handvol routes wordt in een LUS aangemaakt
     (`app.post('/api/rtf/spel/' + naam, ...)`), dus hun pad is een expressie en
     staat nergens letterlijk. Geen enkele lezer van de brontekst vindt ze, en
     `plekVan()` geeft daarom `bestand: null`.

     Dit huis had dat al opgelost: `server/kern/handlerpoorten/buiten.js` draagt
     een register van voorvoegsels met de poort die de lus aanroept EN de bron
     erbij. Die 43 rtf-spelroutes hebben dus wel degelijk een deur. Ze hier als
     "bron onvindbaar" laten staan zou een bestaand antwoord negeren en de lijst
     langer maken dan hij is. */
  let families = [];
  try { families = require('../../server/kern/handlerpoorten/buiten').FAMILIES || []; } catch (e) { families = []; }
  const familiePoort = (pad) => {
    const seg = pad.split('/').filter(Boolean);
    return families.find(f => (f.segmenten || []).every((s2, i) => seg[i] === s2)) || null;
  };

  const bak = { poortwachter: [], familie: [], inHandler: [], publiek: [], onbekend: [], gat: [], bronOnvindbaar: [] };
  for (const r of buiten) {
    const p = norm(r.pad);
    if (o.publiek && o.publiek.has(p)) { bak.publiek.push(p); continue; }
    if (!r.bewakersBekend) { bak.onbekend.push(p); continue; }
    if ((r.bewakers || []).some(n => o.poortMw.has(n))) { bak.poortwachter.push(p); continue; }
    if (familiePoort(p)) { bak.familie.push(p); continue; }
    if (!r.bestand || !r.regel) { bak.bronOnvindbaar.push(p); continue; }
    const lijf = lijfVan(r.bestand, r.regel, lees);
    if (lijf === null) { bak.bronOnvindbaar.push(p); continue; }
    if (o.poortBinnen.test(lijf) || /\b(401|403)\b/.test(lijf)) { bak.inHandler.push(p); continue; }
    bak.gat.push(p + '  (' + r.methode + ', ' + r.bestand + ':' + r.regel + ')');
  }
  for (const k of Object.keys(bak)) bak[k] = [...new Set(bak[k])].sort();
  uit.klasse = bak;
  return uit;
}

module.exports = { buitenBereik, norm };
