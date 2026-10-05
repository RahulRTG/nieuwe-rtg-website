/* RTG failover-trio, het bewakingsdeel: de drie servers starten, hun hartslag
   volgen, en bepalen wie de actieve is (met failback naar een lager nummer
   zodra die weer tien seconden stabiel draait). De poortwachter zelf -- het
   doorsturen van verkeer -- staat in ./trio.js en krijgt deze functies mee.

   ELKE SERVER HEEFT EEN ROL: 'uit' (stand-by), 'volger' (schrijft en neemt
   verkeer aan) of 'leider' (dat, plus het werk dat per installatie een keer
   hoort te gebeuren). Zonder RTG_SPREIDING=1 bestaat 'volger' niet en is dit
   dezelfde opstelling als altijd: een leider, twee keer 'uit'. Wat de rollen
   betekenen en waarom staat in ./trio-spreiding.js. */
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { maakSpreiding } = require('./trio-spreiding');
const { maakAfzetten, leesStand } = require('./trio-afzetten');

function maakWacht({ AANTAL, BASISPOORT, SLEUTEL, FAILBACK_MS, log, PROMOTE_MS = 15000 }) {
  const servers = [];
  for (let i = 0; i < AANTAL; i++) servers.push({ nr: i + 1, port: BASISPOORT + i, child: null, healthy: false, healthySince: 0, restarts: 0, rol: 'uit' });
  let activeIdx = -1;
  let switching = null; // lopende overname, zodat er nooit twee tegelijk lopen
  let stopping = false;
  /* Een promote laadt, migreert en maakt een backup voordat hij antwoordt; daar
     is de 1,5 s van een gezondheidscontrole te kort voor. */
  const spreiding = maakSpreiding({ servers, log,
    apiCall: (port, pad, method) => apiCall(port, pad, method, pad.startsWith('/api/cluster/promote') ? PROMOTE_MS : 1500) });
  const { zetAf, promoveer, wissel } = maakAfzetten({ servers, spreiding, log });

  /* ---------- de drie servers starten en bewaken ---------- */

  function startServer(i) {
    const s = servers[i];
    const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
      env: { ...process.env, PORT: String(s.port), RTG_ROL: 'standby', RTG_SERVER: String(s.nr), RTG_CLUSTER_KEY: SLEUTEL },
      /* De vierde stroom is een IPC-lijn en er gaat geen enkel bericht overheen.
         Hij is er zodat een server MERKT dat de poortwachter weg is. Valt die
         hard om (kill -9, een crash), dan krijgt een server geen SIGTERM en
         blijft hij draaien met zijn poort vast -- waarna een herstartende
         poortwachter zijn eigen servers niet meer kan starten, terwijl
         /api/health toch 200 geeft omdat de wees antwoordt. Dat is hier echt
         gebeurd en het zag eruit als een kapotte spreiding. Afgehandeld in
         server/opzet/luister.js, op 'disconnect'. */
      stdio: ['ignore', 'pipe', 'pipe', 'ipc']
    });
    s.child = child;
    s.healthy = false;
    s.healthySince = 0;
    s.rol = 'uit';   // elke server begint als stand-by (RTG_ROL=standby hierboven)
    const tag = '[server ' + s.nr + '] ';
    const doorgeven = stream => d => String(d).split('\n').filter(Boolean).forEach(l => stream.write(tag + l + '\n'));
    child.stdout.on('data', doorgeven(process.stdout));
    child.stderr.on('data', doorgeven(process.stderr));
    child.on('exit', (code, sig) => {
      s.child = null; s.healthy = false; s.healthySince = 0; s.rol = 'uit';
      if (stopping) return;
      s.restarts++;
      log('server ' + s.nr + ' is uitgevallen (' + (sig || 'code ' + code) + '), herstart over 2 seconden');
      if (activeIdx === i) kiesActieve('server ' + s.nr + ' viel uit');
      setTimeout(() => { if (!stopping) startServer(i); }, 2000);
    });
  }

  function apiCall(port, pad, method, wachtMs = 1500) {
    return new Promise(resolve => {
      const req = http.request({ host: '127.0.0.1', port, path: pad, method, timeout: wachtMs, headers: { 'x-rtg-cluster': SLEUTEL } }, res => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.on('error', () => resolve(null));
      req.end();
    });
  }
  const stand = port => leesStand(apiCall, port);   // gezond, en zegt hij leider te zijn
  const isGezond = async port => (await stand(port)).gezond;

  /* ---------- wie is actief ---------- */

  async function kiesActieve(reden) {
    if (switching) return switching;
    switching = (async () => {
      // eerste gezonde server wint; even wachten mag, een herstart duurt seconden
      for (let poging = 0; poging < 20 && !stopping; poging++) {
        for (let i = 0; i < servers.length; i++) {
          const s = servers[i];
          if (!s.child) continue;
          const st = await stand(s.port);
          s.meldtLeider = st.leider;
          if (st.gezond) {
            if (i === activeIdx && st.leider !== false) return; // actieve leeft toch nog
            /* Eerst de oude leider zijn leiderschap afnemen, dan pas de nieuwe
               promoveren -- nooit twee leiders tegelijk. Met spreiding blijft de
               oude meewerken als volger; zonder gaat hij naar stand-by. Lukt
               het afnemen niet, dan wordt zijn proces gestopt; en lukt ook dat
               niet, dan promoveren we deze ronde niemand (./trio-afzetten.js). */
            if (activeIdx >= 0 && activeIdx !== i && !await zetAf(activeIdx)) return;
            const uit = await promoveer(i);
            if (uit === 'nee') continue; // aantoonbaar geen leider: probeer de volgende
            activeIdx = i;               // ook bij 'onzeker': dan zet de volgende ronde hem eerst af
            log((reden ? reden + '; ' : '') + 'server ' + s.nr + ' (poort ' + s.port + ') is nu actief' +
              (uit === 'onzeker' ? ', onbevestigd' : ''));
            return;
          }
        }
        await new Promise(r => setTimeout(r, 500));
      }
      activeIdx = -1;
      log('geen enkele server is bereikbaar; nieuwe pogingen blijven lopen');
    })().finally(() => { switching = null; });
    return switching;
  }

  /* EEN HARTSLAG TEGELIJK. trio.js roept dit met setInterval elke twee seconden
     aan, maar een ronde kan lánger duren: drie gezondheidscontroles van elk
     maximaal 1500 ms, en in het ergste geval een overname erachteraan. Dan
     start de volgende ronde terwijl de vorige nog loopt en nemen twee rondes
     tegelijk rolbesluiten. Dat kon al voordat de spreiding er was; het wordt met
     stemAf() alleen waarschijnlijker, en een overslaan kost niets -- twee
     seconden later komt de volgende. */
  let klopt = false;
  async function hartslag() {
    if (stopping || klopt) return;
    klopt = true;
    try { await hartslagRonde(); } finally { klopt = false; }
  }
  async function hartslagRonde() {
    for (const s of servers) {
      const st = s.child ? await stand(s.port) : { gezond: false, leider: null };
      const ok = st.gezond;
      s.meldtLeider = st.leider;
      if (ok && !s.healthy) s.healthySince = Date.now();
      /* Onbereikbaar is altijd rol 'uit'. Zo krijgt een server die wegvalt geen
         verkeer meer toebedeeld, en pakt stemAf() hem vanzelf weer op zodra hij
         terug is -- zonder dat er ergens een tweede lijstje bijgehouden wordt. */
      if (!ok) { s.healthySince = 0; s.rol = 'uit'; }
      s.healthy = ok;
    }
    const act = servers[activeIdx];
    if (activeIdx < 0 || !act.healthy || act.meldtLeider === false) {
      await kiesActieve(activeIdx < 0 ? null : 'server ' + act.nr + (act.healthy ? ' zegt geen leider te zijn' : ' reageert niet meer'));
    } else {
      // failback: een lager genummerde server die weer 10 seconden gezond is,
      // krijgt het werk terug ("tot die het weer doet")
      const beter = servers.findIndex(s => s.healthy && s.healthySince && Date.now() - s.healthySince >= FAILBACK_MS);
      if (beter >= 0 && beter < activeIdx && !switching) {
        /* Zonder actieve tijdens de wissel, en onder het slot van kiesActieve
           (./trio-afzetten.js wissel). */
        const oudIdx = activeIdx;
        activeIdx = -1;
        switching = wissel(oudIdx, beter)
          .then((nieuw) => { activeIdx = nieuw; }, (e) => log('failback mislukt: ' + (e && e.message)))
          .finally(() => { switching = null; });
        await switching;
      }
    }
    /* En tot slot de meelopers gelijktrekken: elke gezonde server die geen
       leider is, hoort verkeer aan te nemen. Zonder spreiding doet dit niets. */
    if (activeIdx >= 0) await spreiding.stemAf(activeIdx);
  }

  function wachtOpActieve(maxMs) {
    return new Promise(resolve => {
      const t0 = Date.now();
      (function kijk() {
        // ook een herstarte stand-by is gezond
        if (activeIdx >= 0 && servers[activeIdx].healthy && servers[activeIdx].meldtLeider !== false) return resolve(activeIdx);
        if (Date.now() - t0 > maxMs || stopping) return resolve(-1);
        setTimeout(kijk, 200);
      })();
    });
  }

  // netjes stoppen: geen herstarts meer en alle kinderen een SIGTERM
  function stop() {
    if (stopping) return;
    stopping = true;
    for (const s of servers) if (s.child) try { s.child.kill('SIGTERM'); } catch (e) {}
  }

  return { servers, actieve: () => activeIdx, startServer, apiCall, isGezond, kiesActieve, hartslag, wachtOpActieve, stop,
    gestopt: () => stopping, kleefDoel: (req, terugval) => spreiding.kleefDoel(req, terugval), spreiding };
}

module.exports = { maakWacht };
