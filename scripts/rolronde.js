#!/usr/bin/env node
/* ============================================================================
   DE ROLRONDE -- de rolscheiding uit GEDRAG, niet uit een regex.

   test/auth-rol.test.js opent met: "Uitputtende auth-scoping-test. Niet een
   steekproef en geen mooipraterij: deze test leest ELKE leden-route
   (auth-middleware) rechtstreeks uit de bron en eist dat een leverancier- EN
   een kantoor-token daar 401 krijgen."

   Dat was niet waar, en de reden is de vorm van de zoektocht. Hij herkent een
   leden-endpoint aan het eerste WOORD na het pad:

       app.post('/api/x', auth, (req, res) => ...)        -> gezien
       app.post('/api/bedrijf/rollen', (req, res) => {
         const g = werkPoort(req, res); if (!g) return;    -> NIET gezien
       })

   Een grendel die in de BODY staat valt buiten de uitdrukking, en de route valt
   daarmee stilzwijgend buiten de toets. Gemeten: van de 1885 registraties met
   `app.X('/api/...')` vielen er 511 buiten die uitdrukking. Het waren er geen
   511 aan echte gaten -- de meeste zijn leveranciers-, kantoor- of
   foundation-routes -- maar SEVENTIG ervan zijn wel degelijk leden-endpoints
   die nooit op rolscheiding zijn beproefd. Een uitputtende toets die 5% mist en
   dat niet zegt, is geen uitputtende toets; hij is er een die geruststelt.

   DEZE RONDE VRAAGT HET AAN DE SERVER IN PLAATS VAN AAN DE BRON. Voor elke
   route uit scripts/lib/routes.js:

     1. klopt een ANONIEME beller aan. Krijgt hij geen 401, dan is het geen
        leden-endpoint (publiek, of het valideert voor de deur) -- de dwaler-trede
        van de ladder gaat over die groep.
     2. klopt een ECHT LID aan (geregistreerd en geverifieerd, geen demo-persona).
        Komt hij er ook niet door, dan is het een route van een andere rol.
     3. blijft over: anoniem eruit, lid erdoor. Dat IS een leden-endpoint, hoe zijn
        grendel er ook uitziet. Daar moeten een leverancier- en een kantoortoken
        401 krijgen -- nooit 2xx (ongewenste toegang) en nooit 5xx (crash).

   DE SESSIE STERFT ONDERWEG, en dat mag geen classificatie worden. Deze ronde
   stuurt {} naar ruim drieduizend routes met het ledentoken, en daar zit
   /api/auth/logout bij -- vroeg in de alfabetische lijst. Bij de eerste meting
   telde daardoor alles daarna als "geen leden-endpoint": 938 routes stil
   verkeerd ingedeeld, en het cijfer zag er geloofwaardig uit. Vandaar de
   kanarie: krijgt het lid 401, dan vragen we eerst of hij nog leeft.

   WAT DEZE RONDE NIET DOET. Hij toetst de VERTICALE scheiding (welke rol mag
   hier binnen) en niet de horizontale (mag lid A aan de gegevens van lid B).
   Dat laatste is de gluurder-trede van de ladder, en die werkt met een
   steekproef -- daar staat nog werk.

   Draai:  node scripts/rolronde.js
           node scripts/rolronde.js --basis http://127.0.0.1:3000
           node scripts/rolronde.js --vastleggen
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const WORTEL = path.join(__dirname, '..');
const K = { rood: '\x1b[31m', groen: '\x1b[32m', geel: '\x1b[33m', grijs: '\x1b[2m', reset: '\x1b[0m', vet: '\x1b[1m' };

const { alleRoutes } = require('./lib/routes');
const proefserver = require('./lib/proefserver');
/* Wanneer is dit gemeten, en waartegen. Zonder stempel is een register niet na
   te lopen: verouderd ziet er identiek uit aan vers, en scripts/versheid.js kan
   er niets over zeggen. Zeven registers misten hem; zie de kop van
   scripts/lib/stempel.js. */
const { stempel } = require('./lib/stempel');

const arg = (naam, std) => { const i = process.argv.indexOf(naam); return i > 0 ? process.argv[i + 1] : std; };
const BASIS_EXTERN = arg('--basis', null);
const PORT = Number(process.env.ROLRONDE_PORT || 4410);
const VASTLEGGEN = process.argv.includes('--vastleggen');

/* ---- DE METERS ----
   `rolscheidingGaten` telt de leden-endpoints die een niet-leden-token
   binnenlieten of crashten. Nul, en dat mag zo blijven.

   `rolscheidingGemeten` telt hoeveel leden-endpoints er ZIJN beproefd, en die
   mag alleen omhoog. Dat tweede getal is de belangrijkste van de twee en de
   minst vanzelfsprekende: nul gaten is triviaal te halen door minder te
   onderzoeken. Precies dat gebeurde hier -- de regexvorm vond er 1374 en zweeg
   over de rest. Verdwijnt een leden-endpoint echt (een functie gaat eruit), dan
   is dat een handmatige verlaging met een notitie, en dat is de goede prijs. */
const METER = 'rolscheidingGaten';
const RICHTING = 'omlaag';           // een plafond: meer gaten is slechter
const METER_N = 'rolscheidingGemeten';
const RICHTING_N = 'omhoog';         // een vloer: minder beproeven is slechter
const UITSLAGBESTAND = path.join(WORTEL, 'ROLRONDE.json');

/* Routes die je niet zomaar aanklopt: een openblijvende stroom hangt de klopper
   op, en de opzettelijke storingen doen wat hun naam zegt. Zelfde lijst-gedachte
   als NIET_KLOPPEN in scripts/ladder/beveiliging.js, en om dezelfde redenen. */
const NIET_KLOPPEN = /\/api\/(sse|stream|live-)|\/sse|\/stream|\/api\/test\/|\/api\/cluster\//;

/* ---------------------------------------------------------------- het vragen */
const agent = new http.Agent({ keepAlive: true, maxSockets: 32 });
function maakVraag(basis) {
  const u = new URL(basis);
  return function vraag(methode, pad, token, lijf, opt) {
    return new Promise(resolve => {
      const data = methode === 'GET' ? null : JSON.stringify(lijf === undefined ? {} : lijf);
      const headers = { 'Content-Type': 'application/json' };
      if (data) headers['Content-Length'] = Buffer.byteLength(data);
      if (token) headers.Authorization = 'Bearer ' + token;
      const req = http.request({ hostname: u.hostname, port: u.port, path: pad, method: methode, headers, agent,
        timeout: (opt && opt.timeout) || 8000 }, res => {
        let body = '';
        res.on('data', c => { if (body.length < 4096) body += c; });
        res.on('end', () => {
          let json = null; try { json = JSON.parse(body); } catch (e) {}
          resolve({ status: res.statusCode, data: json });
        });
      });
      req.on('error', () => resolve({ status: 0, data: null }));
      req.on('timeout', () => { req.destroy(); resolve({ status: 0, data: null }); });
      if (data) req.write(data);
      req.end();
    });
  };
}

/* ------------------------------------------------------------- de drie rollen */
const KYC = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/* EEN ECHT LID EN GEEN DEMO-PERSONA. De demo-sessie heeft geen accountId, dus
   een flink deel van de leden-routes weigert hem met 401 -- en dan belandt een
   echt leden-endpoint in de bak "andere rol" en wordt de rolscheiding er nooit
   op beproefd. Bij de eerste meting scheelde dat ruim duizend routes. */
async function nieuwLid(vraag) {
  const u = 'r' + crypto.randomBytes(8).toString('hex');
  const reg = await vraag('POST', '/api/auth/register', null, {
    name: 'Rolronde ' + u, email: 'rolronde' + u + '@voorbeeld.test', phone: '0612345678',
    password: 'Geheim' + u + '!', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  const tok = reg.data && reg.data.token;
  if (tok) await vraag('POST', '/api/verify/upload', tok, { image: KYC });
  return tok || null;
}

/* --------------------------------------------------------------- het oordeel */

/* Apart, zodat test/meterijk.test.js hem een bekend-foute uitslag kan voeren.
   Zelfde reden als bij scripts/ladder.js: de ronde zelf duurt minuten met een
   echte server en is in een toets niet na te spelen, maar de vraag van een
   ijking is niet "kun je dit namaken" maar "slaat hij uit op een foute invoer". */
function beoordeel(uitslag, normMeters) {
  const redenen = [];
  const plafond = normMeters ? normMeters[METER] : undefined;
  const vloer = normMeters ? normMeters[METER_N] : undefined;
  if (plafond !== undefined && uitslag.gaten > plafond)
    redenen.push('De rolronde vond ' + uitslag.gaten + ' gat(en) tegen een norm van ' + plafond + '.');
  if (vloer !== undefined && uitslag.gemeten < vloer)
    redenen.push('De rolronde beproefde ' + uitslag.gemeten + ' leden-endpoints tegen een norm van ' + vloer +
      '. Minder beproeven is geen betere uitslag.');
  return { zakt: redenen.length > 0, redenen };
}

/* ------------------------------------------------------------------ de ronde */
/* LOKETTEN DIE MET OPZET VOOR MEER DAN EEN ROL OPENGAAN.

   De regel van deze ronde is streng en hoort dat te zijn: een leden-endpoint
   geeft 401 aan een leverancier en aan het kantoor. Maar niet elk endpoint dat
   een lid binnenlaat is een LEDEN-endpoint; een enkele is een loket dat voor
   meer dan een rol dezelfde vraag beantwoordt, elk op zijn eigen naam.

   Ze staan hier bij naam, met de reden en de toets die het gedrag vasthoudt.
   Een filter zonder namen zou hetzelfde effect hebben en niemand zou het zien
   groeien -- zelfde afspraak als GEDEELD_BEDOELD in scripts/gluurronde.js. */
const ROLGEDEELD = new Map([
  ['POST /api/link/koppelingen', {
    reden: 'het loket "wat staat er van mij open". Een zaak heeft daar bonnen (de kassa aanvaardt '
      + 'capabilities) maar geen ledensleutel, en komt binnen op zijn EIGEN naam: linkWieId(wie) rekent uit '
      + 'onder welke naam iemands bonnen staan, dus niemand ziet die van een ander.',
    toets: 'test/linkkoppelingen.test.js -- "je ziet alleen je eigen koppelingen, en een zaak de zijne"' }],
]);

async function main() {
  let srv = null, basis = BASIS_EXTERN;
  if (!basis) {
    srv = proefserver.start({ poort: PORT, merk: 'rolronde' });
    basis = srv.base;
  }
  const vraag = maakVraag(basis);
  console.log('\n' + K.vet + 'DE ROLRONDE' + K.reset + K.grijs + ' -- welke rol komt waar binnen, gevraagd aan de server' + K.reset);
  console.log('  ' + K.grijs + 'tegen ' + basis + (srv ? ' (eigen boot)' : ' (meegegeven)') + K.reset + '\n');

  if (!await proefserver.wachtGezond(vraag)) {
    console.error('  ' + K.rood + 'De server kwam niet op; er is niets gemeten.' + K.reset);
    console.error('  ' + K.grijs + 'Dat is geen schone uitslag maar een ontbrekende meting (LAT.md regel 3).' + K.reset + '\n');
    proefserver.stop(srv);
    return 2;
  }

  let lid = await nieuwLid(vraag);
  const sup = (await vraag('POST', '/api/supplier/login', null, { username: 'rahul', password: 'Imran' })).data;
  const off = (await vraag('POST', '/api/office/login', null, { code: 'RTG-OFFICE' })).data;
  const supTok = sup && sup.token, offTok = off && off.token;
  if (!lid || !supTok || !offTok) {
    console.error('  ' + K.rood + 'Niet alle drie de rollen kwamen rond' + K.reset +
      ' (lid: ' + !!lid + ', leverancier: ' + !!supTok + ', kantoor: ' + !!offTok + ').');
    console.error('  ' + K.grijs + 'Zonder alle drie is er geen scheiding te beproeven.' + K.reset + '\n');
    proefserver.stop(srv);
    return 2;
  }

  const routes = alleRoutes().filter(r => r.pad.startsWith('/api/') && !r.viaRouter && !NIET_KLOPPEN.test(r.pad));
  console.log('  ' + K.grijs + routes.length + ' routes om te onderzoeken' + K.reset);

  const ledenEndpoints = [], publiekOfVroeg = [], andereRol = [], stil = [];
  const gaten = [];
  const gedeeld = [];
  let hersteld = 0;
  const lidLeeft = async () => (await vraag('POST', '/api/state', lid)).status !== 401;

  for (const r of routes) {
    const pad = r.pad.replace(/:[A-Za-z_]+/g, 'x1');       // een padparam met iets onschuldigs
    const anon = await vraag(r.methode, pad, null);
    if (anon.status === 0) { stil.push(r.methode + ' ' + r.pad); continue; }
    if (anon.status !== 401) { publiekOfVroeg.push(r.methode + ' ' + r.pad + ' -> ' + anon.status); continue; }

    let l = await vraag(r.methode, pad, lid);
    if (l.status === 401 && !(await lidLeeft())) {
      lid = await nieuwLid(vraag); hersteld++;
      if (!lid) { stil.push(r.methode + ' ' + r.pad + ' (geen lid meer te maken)'); continue; }
      l = await vraag(r.methode, pad, lid);
    }
    if (l.status === 401) { andereRol.push(r.methode + ' ' + r.pad); continue; }

    ledenEndpoints.push(r.methode + ' ' + pad);
    for (const [rol, tok] of [['leverancier', supTok], ['kantoor', offTok]]) {
      const a = await vraag(r.methode, pad, tok);
      /* 401 is de eis. 404 mag (de padparam-dummy bestaat niet), en een 503 van
         een functie die BEWUST uitstaat mag ook: dat laat niemand binnen, ook
         geen lid, en dat is meer dan hier gevraagd wordt. We eisen wel dat zo'n
         antwoord de functie noemt, zodat een echte 503-crash blijft opvallen --
         zelfde afspraak als in test/auth-rol.test.js. */
      const bewustDicht = a.status === 503 && a.data && a.data.functie;
      /* Een loket dat met opzet voor meer dan een rol opengaat telt hier niet
         als gat -- maar wel als REGEL, want het staat bij naam in ROLGEDEELD
         hierboven met zijn reden en zijn toets. */
      const bewustGedeeld = ROLGEDEELD.has(r.methode + ' ' + pad);
      if (bewustGedeeld) { gedeeld.push(r.methode + ' ' + pad + ' [' + rol + ']'); continue; }
      if (!bewustDicht && (a.status < 400 || a.status >= 500))
        gaten.push({ route: r.methode + ' ' + pad, rol, status: a.status, bestand: r.bestand + ':' + r.regel });
    }
  }

  console.log('  ' + K.grijs + 'sessie onderweg hersteld: ' + hersteld + ' keer' + K.reset + '\n');
  console.log('  ' + K.vet + ledenEndpoints.length + K.reset + ' leden-endpoints beproefd ' +
    K.grijs + '(anoniem eruit, lid erdoor)' + K.reset);
  console.log('  ' + K.grijs + publiekOfVroeg.length + ' routes gaven een anonieme beller geen 401 (publiek, of ze valideren voor de deur)' + K.reset);
  console.log('  ' + K.grijs + andereRol.length + ' routes lieten ook een lid niet binnen (leverancier, kantoor, foundation)' + K.reset);
  if (gedeeld.length) {
    console.log('  ' + K.grijs + gedeeld.length + ' antwoord(en) van een loket dat MET OPZET voor meer dan een rol opengaat:' + K.reset);
    for (const [route, uitleg] of ROLGEDEELD) console.log('    ' + K.grijs + route + ' -- ' + uitleg.reden.slice(0, 90) + K.reset);
  }
  if (stil.length) console.log('  ' + K.geel + stil.length + ' routes gaven geen antwoord' + K.reset);

  try {
    fs.writeFileSync(UITSLAGBESTAND, JSON.stringify({
      stempel: stempel(),
      uitleg: 'De rolronde: welke rol komt waar binnen, gevraagd aan een echte server in plaats van aan de brontekst. ' +
        'gaten MAG ALLEEN DALEN en gemeten mag ALLEEN STIJGEN -- zie scripts/rolronde.js. ' +
        'Dit is de VERTICALE scheiding; de horizontale (lid A tegen lid B) is de gluurder-trede van de ladder.',
      gedraaid: new Date().toISOString(),
      meters: { [METER]: gaten.length, [METER_N]: ledenEndpoints.length },
      routesOnderzocht: routes.length, sessieHersteld: hersteld,
      publiekOfVroegGevalideerd: publiekOfVroeg.length, andereRol: andereRol.length, zonderAntwoord: stil,
      bewustGedeeld: [...ROLGEDEELD].map(([route, u]) => ({ route, reden: u.reden, toets: u.toets })),
      gaten
    }, null, 2) + '\n');
  } catch (e) { console.error('  kon ROLRONDE.json niet schrijven: ' + e.message); }

  proefserver.stop(srv);

  if (gaten.length) {
    console.log('\n  ' + K.rood + K.vet + gaten.length + ' GAT(EN) IN DE ROLSCHEIDING' + K.reset + '\n');
    for (const g of gaten.slice(0, 40))
      console.log('    ' + K.rood + '!' + K.reset + ' ' + g.route + ' [' + g.rol + '] -> ' + g.status + K.grijs + '  (' + g.bestand + ')' + K.reset);
    if (gaten.length > 40) console.log('    ' + K.grijs + '... nog ' + (gaten.length - 40) + K.reset);
    console.log('');
    return 1;
  }
  console.log('\n  ' + K.groen + 'Geen enkel leden-endpoint liet een leverancier- of kantoortoken binnen.' + K.reset + '\n');

  /* ---------- de ratel ---------- */
  let norm = null;
  try { norm = JSON.parse(fs.readFileSync(path.join(WORTEL, 'NORM.json'), 'utf8')); } catch (e) {}
  if (norm && norm.meters && !BASIS_EXTERN) {
    const uitslag = { gaten: gaten.length, gemeten: ledenEndpoints.length };
    if (VASTLEGGEN) {
      const p = norm.meters[METER], v = norm.meters[METER_N];
      if (p === undefined || uitslag.gaten <= p) norm.meters[METER] = uitslag.gaten;
      if (v === undefined || uitslag.gemeten >= v) norm.meters[METER_N] = uitslag.gemeten;
      fs.writeFileSync(path.join(WORTEL, 'NORM.json'), JSON.stringify(norm, null, 2) + '\n');
      console.log('  ' + K.groen + METER + ' vastgelegd op ' + norm.meters[METER] + ', ' + METER_N + ' op ' + norm.meters[METER_N] + '.' + K.reset + '\n');
    } else {
      const oordeel = beoordeel(uitslag, norm.meters);
      if (oordeel.zakt) {
        for (const r of oordeel.redenen) console.error('  ' + K.rood + r + K.reset);
        console.error('');
        return 1;
      }
    }
  }
  return 0;
}

if (require.main === module) main().then(c => { process.exitCode = c; }).catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { beoordeel, METER, METER_N };
