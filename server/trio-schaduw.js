/* ============================================================================
   DE SCHADUWWACHT -- wat een voordeurproces van de stand weet.

   Een voordeurproces (zie ./trio-werkers.js) stuurt alleen verkeer door. Het
   start geen servers, doet geen hartslag en kiest geen leider. Toch praat
   server/trio.js daar tegen hetzelfde `wacht`-object als in de hoofdstand --
   anders zou elk stuk in dat bestand een tak "als ik een werker ben" krijgen, en
   dat is precies hoe twee gedaanten uit elkaar gaan lopen.

   Deze module geeft dus dezelfde VORM terug als maakWacht(), maar de stand komt
   van de hoofd over de IPC-lijn in plaats van uit eigen metingen.

   WAT EEN WERKER NIET MAG, en waarom dat hier hard staat: rollen zetten. Een
   werker die zelf mag promoveren, doet dat ooit tegelijk met de hoofd of met een
   andere werker, en dan zijn er twee leiders -- twee servers die de backup
   maken, de zelfzorgautomaat draaien en het roerwerk van de RTG-AI doen. Valt er
   een server om onder een werker, dan meldt hij dat en kiest hij lokaal meteen
   een andere. De melding is een seintje, geen verzoek om toestemming.
   ========================================================================== */
'use strict';
const kleef = require('./trio-kleef');

/* Een schaduw van maakWacht(): dezelfde vorm, maar de stand komt van de hoofd in
   plaats van uit eigen hartslagen. trio.js hoeft daardoor niet te weten of hij
   de hoofd of een werker is -- hij praat in beide gevallen tegen `wacht`. */
function maakSchaduw({ log }) {
  const servers = [];
  let actief = -1;
  let spreiding = false;
  let stoppen = false;
  const wachters = [];

  /* De luisteraar staat op een naam zodat stop() hem weer kan weghalen. In een
     echt proces is er precies een schaduw en maakt het niets uit; een toets die
     er tien maakt, laat er anders tien achter -- en dan waarschuwt Node terecht
     over een lek in plaats van dat wij het opruimen. */
  function hoor(m) {
    if (!m || m.soort !== 'staat') return;
    let s; try { s = JSON.parse(m.staat); } catch (e) { return; }
    actief = s.actief;
    spreiding = !!s.spreiding;
    /* DE LIJST BIJWERKEN EN NIET VERVANGEN. trio.js pakt `const { servers } =
       wacht` een keer bij het laden, en zet op het foutpad rechtstreeks
       servers[i].healthy = false. Zou hier een nieuwe array komen, dan wijst die
       van trio.js voor altijd naar de lege beginlijst: elk verzoek zou dan op
       een 503 uitkomen omdat er in zijn ogen geen enkele server bestaat. */
    servers.length = 0;
    for (const x of s.servers) servers.push({ nr: x.nr, port: x.port, child: x.gezond, healthy: x.gezond, rol: x.rol });
    while (wachters.length && bruikbaar() >= 0) wachters.shift()(bruikbaar());
  }
  process.on('message', hoor);

  /* WELKE SERVER IS DE TERUGVAL. Niet klakkeloos `actief`: in de hoofdstand kiest
     kiesActieve() SYNCHROON een nieuwe leider, maar in een werker is dat alleen
     een seintje naar de hoofd. Tussen de klap en de volgende stand wijst `actief`
     dus nog naar een server die net is omgevallen -- en een verzoek ZONDER token
     heeft geen kleefkeuze om op terug te vallen, dus dat kwam op een 503 uit
     terwijl er twee kerngezonde servers naast stonden. Gemeten met de chaosproef:
     een mislukt verzoek waar de hoofdstand er nul had.

     Een werker kiest hiermee geen LEIDER -- dat blijft bij de hoofd. Hij weigert
     alleen verkeer naar een lijk te sturen. */
  function bruikbaar() {
    if (actief >= 0 && servers[actief] && servers[actief].healthy) return actief;
    return servers.findIndex(s => s && s.child && s.healthy);
  }

  function wachtOpActieve(maxMs) {
    if (bruikbaar() >= 0) return Promise.resolve(bruikbaar());
    return new Promise(resolve => {
      const t = setTimeout(() => {
        const i = wachters.indexOf(klaar); if (i >= 0) wachters.splice(i, 1);
        resolve(-1);
      }, maxMs);
      function klaar(idx) { clearTimeout(t); resolve(idx); }
      wachters.push(klaar);
    });
  }

  /* Dezelfde regel als in trio-spreiding.js, en met opzet niet die functie zelf:
     die heeft een apiCall nodig om rollen te ZETTEN, en dat mag een werker juist
     niet. Wat hier staat is alleen het lezende deel. */
  function kleefDoel(req, terugval) {
    if (!spreiding) return terugval;
    const kandidaten = [];
    for (let i = 0; i < servers.length; i++) {
      const s = servers[i];
      if (s.child && s.healthy && s.rol !== 'uit') kandidaten.push(i);
    }
    if (kandidaten.length < 2) return terugval;
    const i = kleef.kleefIndex(req, kandidaten);
    return i >= 0 ? i : terugval;
  }

  /* Een werker kiest geen leider. Hij zegt tegen de hoofd wat hij zag en gaat
     verder met wat hij nu weet; de hoofd stuurt zo nodig een nieuwe stand. */
  async function kiesActieve(reden) {
    const idx = servers.findIndex(s => !s.healthy);
    try { process.send({ soort: 'gevallen', idx, reden }); } catch (e) {}
  }

  return {
    servers, actieve: bruikbaar, wachtOpActieve, kleefDoel, kiesActieve,
    stop: () => { stoppen = true; process.removeListener('message', hoor); }, gestopt: () => stoppen,
    /* Een werker bewaakt niets: deze drie bestaan alleen omdat trio.js ze in de
       hoofdstand aanroept, en een lege functie is eerlijker dan een tak die
       zegt "als ik de hoofd ben". */
    startServer: () => {}, hartslag: () => {}, isGezond: async () => true,
    spreiding: { aan: () => spreiding }, log
  };
}

/* HET STARTEN VAN EEN WERKER, en meteen zijn levenseinde.

   reusePort laat de kernel de verbindingen over de processen verdelen; zonder
   die vlag geeft de tweede listen een EADDRINUSE.

   STERF MET DE HOOFD. Wordt de hoofd hard omgelegd (kill -9, een crash, een
   chaosproef), dan krijgt een werker geen SIGTERM en blijft hij gewoon draaien:
   hij houdt de poort vast, stuurt verkeer door op een stand die nooit meer
   bijwerkt, en hoort van geen enkele failover. Gemeten: na twee chaosrondes
   stonden er vier van die wezen met ppid 1. Het dichtvallen van de IPC-lijn is
   het signaal dat de ouder weg is. */
function startWerker({ poort, PORT, HOST, log }) {
  process.on('disconnect', () => { log('de hoofd is weg, deze voordeur sluit'); process.exit(0); });
  poort.listen({ port: PORT, host: HOST || '0.0.0.0', reusePort: true },
    () => log('luistert mee op poort ' + PORT));
}

module.exports = { maakSchaduw, startWerker };
