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
function buitenBereik(gezienePaden, haalRoutes) {
  let routes;
  try {
    const haal = haalRoutes || require('./routes').alleRoutes;
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
  /* Zonder ENIGE bewakerslaag volgens de router. `bewakersBekend` is hier de
     voorwaarde en geen detail: is dat false, dan kon de router er niets over
     zeggen, en dat is iets anders dan "er staat niets". */
  const zonderBewaker = [...new Set(buiten
    .filter(r => r.bewakersBekend && (!r.bewakers || !r.bewakers.length))
    .map(r => norm(r.pad)))].sort();

  const perTak = {};
  for (const p of paden) { const t = p.split('/').slice(0, 3).join('/'); perTak[t] = (perTak[t] || 0) + 1; }

  return { paden, zonderBewaker, perTak, gezien: gezien.size, bekend: new Set(api.map(r => norm(r.pad))).size };
}

module.exports = { buitenBereik, norm };
