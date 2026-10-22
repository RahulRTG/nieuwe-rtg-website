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

     1. vereist een expliciete 401/403 voor de anonieme beller.
     2. vereist 2xx voor het lid en een succesvolle sessiekanarie.
     3. vereist expliciete 401/403 voor leverancier EN kantoor.
        Andere antwoorden zijn onbekend, behalve ongewenste2xx (een gat).
        Bekende gedeelde loketten blijven apart en bewijzen geen rolscheiding.

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
const { stempel, eisSchoneBoom, magSchrijven } = require('./lib/stempel');

const arg = (naam, std) => { const i = process.argv.indexOf(naam); return i > 0 ? process.argv[i + 1] : std; };
const BASIS_EXTERN = arg('--basis', null);
const PORT = Number(process.env.ROLRONDE_PORT || 4410);
const VASTLEGGEN = process.argv.includes('--vastleggen');

/* ---- DE METERS ----
   `rolscheidingGaten` telt de leden-endpoints die een niet-leden-token
   met2xx binnenlieten. Storingen en validatie zijn onbekend bewijs.

   `rolscheidingGemeten` telt hoeveel leden-endpoints expliciete scheiding bewezen, en die
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
        // De kantoorlogin draagt ook de werkvoorraad. 4 KiB knipte geldig
        // JSON halverwege af zodra het antwoord over meer chunks kwam.
        res.on('data', c => { if (body.length < 1024 * 1024) body += c; });
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
  ['GET /api/push/key', {
    reden: 'Alle ingelogde schermen gebruiken dezelfde publieke VAPID-sleutel; geen privésleutel of persoonsdata.',
    toets: 'test/publieke-rand.test.js', zelfdeOpenbareInhoud: true }],
  ...['steden', 'campagnes'].map(naam => ['POST /api/rtfos/publiek/' + naam, {
    reden: 'De buurtprojectie bevat uitsluitend openbare bekendmakingen voor iedere ingelogde rol; geen hulpdossiers.',
    toets: 'test/toegang-buurt.test.js', zelfdeOpenbareInhoud: true }]),
  ['POST /api/link/koppelingen', {
    reden: 'het loket "wat staat er van mij open". Een zaak heeft daar bonnen (de kassa aanvaardt '
      + 'capabilities) maar geen ledensleutel, en komt binnen op zijn EIGEN naam: linkWieId(wie) rekent uit '
      + 'onder welke naam iemands bonnen staan, dus niemand ziet die van een ander.',
    toets: 'test/linkkoppelingen.test.js -- "je ziet alleen je eigen koppelingen, en een zaak de zijne"' }],
  ...['GET', 'POST'].map(m => [m + ' /api/ice', {
    reden: 'de ICE-uitgifte voor elk gesprek: leden, personeel (teamcall), zaken en het kantoor (servicebel, '
      + 'ontmoeting) bellen allemaal. Elke rol krijgt een eigen kortlevend TURN-credential onder een '
      + 'ondoorzichtig label van ZIJN sessie (kern/rtc/ijs.js); er komen geen gegevens van een ander mee.',
    toets: 'test/rtc-relay.test.js -- "end-to-end: /api/ice alleen voor een sessie, kortlevend, HMAC klopt"' }]),
]);

// Gedeeld is een inhoudscontract, geen vrijstelling voor crashes of andere data.
function gedeeldAntwoordGeldig(route, lid, ander) {
  const contract = ROLGEDEELD.get(route);
  if (!contract || ander.status < 200 || ander.status >= 300) return false;
  if (!contract.zelfdeOpenbareInhoud) return true;
  return lid.status === 200 && ander.status === 200 &&
    require('node:util').isDeepStrictEqual(lid.data, ander.data);
}

/* Bewijs is smaller dan geen waargenomen lek. Validatie, een uitgeschakelde
   functie, een storing of een timeout bewijst geen rolgrens. */
const succesvol = antwoord => !!antwoord && antwoord.status >= 200 && antwoord.status < 300;
const geweigerd = antwoord => !!antwoord && [401, 403].includes(antwoord.status);
// Dezelfde token moet op zijn eigen loket vóór én na de tegenproef leven.
async function meetRol(vraag, rol, token, methode, pad, lijf) {
  const eigenPad = { leverancier: '/api/supplier/state', kantoor: '/api/office/state' }[rol];
  if (!eigenPad) throw new Error('Onbekende proefrol');
  const voor = await vraag('POST', eigenPad, token);
  const antwoord = await vraag(methode, pad, token, ...(lijf === undefined ? [] : [lijf]));
  const na = await vraag('POST', eigenPad, token);
  return { voor, antwoord, na };
}
function beoordeelRoute(route, anon, lid, antwoorden = {}, controles = {}) {
  const uit = { bewezen: false, gaten: [], onbekend: [], gedeeld: [] };
  const onbekend = (rol, a) => uit.onbekend.push({ route, rol, status: a ? a.status : 0 });
  if (!geweigerd(anon)) { onbekend('anoniem', anon); return uit; }
  if (!succesvol(lid)) { onbekend('lid', lid); return uit; }
  for (const rol of ['leverancier', 'kantoor']) {
    const a = antwoorden[rol];
    const controle = controles[rol];
    if (!controle || !succesvol(controle.voor) || !succesvol(controle.na)) {
      uit.onbekend.push({ route, rol, status: a ? a.status : 0, reden: 'eigen-sessie-niet-bewezen',
        voor: controle && controle.voor ? controle.voor.status : 0,
        na: controle && controle.na ? controle.na.status : 0 });
      continue;
    }
    if (geweigerd(a)) continue;
    if (succesvol(a)) {
      if (gedeeldAntwoordGeldig(route, lid, a)) uit.gedeeld.push({ route, rol });
      else uit.gaten.push({ route, rol, status: a.status });
    } else onbekend(rol, a);
  }
  uit.bewezen = !uit.gaten.length && !uit.onbekend.length && !uit.gedeeld.length;
  return uit;
}

async function main() {
  let srv = null, basis = BASIS_EXTERN;
  if (!basis) {
    srv = await require('./lib/wegwerpserver').start({ naam: 'rolronde', poort: PORT, gereed: 'ready',
      env: { NODE_ENV: 'test', ...require('./lib/voltooiwereld').KANTOORWERELD, OFFICE_CODE: 'RTG-OFFICE' } });
    basis = srv.basis;
  }
  const vraag = maakVraag(basis);
  const sluit = () => { if (srv) srv.klaar(); };
  const fixtures = require('./lib/rolronde-fixtures').maakFixtures({ vraag });
  console.log('\n' + K.vet + 'DE ROLRONDE' + K.reset + K.grijs + ' -- welke rol komt waar binnen, gevraagd aan de server' + K.reset);
  console.log('  ' + K.grijs + 'tegen ' + basis + (srv ? ' (eigen boot)' : ' (meegegeven)') + K.reset + '\n');

  if (!await proefserver.wachtGezond(vraag)) {
    console.error('  ' + K.rood + 'De server kwam niet op; er is niets gemeten.' + K.reset);
    console.error('  ' + K.grijs + 'Dat is geen schone uitslag maar een ontbrekende meting (LAT.md regel 3).' + K.reset + '\n');
    sluit();
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
    sluit();
    return 2;
  }

  const routes = alleRoutes().filter(r => r.pad.startsWith('/api/') && !r.viaRouter && !NIET_KLOPPEN.test(r.pad));
  console.log('  ' + K.grijs + routes.length + ' routes om te onderzoeken' + K.reset);

  const ledenEndpoints = [], publiekOfVroeg = [], andereRol = [], stil = [];
  const gaten = [];
  const onbekend = [];
  const gedeeld = [];
  const rolproeven = [];
  let hersteld = 0;
  const lidLeeft = async () => succesvol(await vraag('POST', '/api/state', lid));

  for (const r of routes) {
    const pad = r.pad.replace(/:[A-Za-z_]+/g, 'x1');       // een padparam met iets onschuldigs
    const lijf = {};
    const anon = await vraag(r.methode, pad, null, lijf);
    if (!geweigerd(anon)) {
      publiekOfVroeg.push(r.methode + ' ' + r.pad + ' -> ' + anon.status);
      onbekend.push(...beoordeelRoute(r.methode + ' ' + r.pad, anon).onbekend);
      if (anon.status === 0) stil.push(r.methode + ' ' + r.pad);
      continue;
    }

    let l = await vraag(r.methode, pad, lid, lijf);
    if (l.status === 401 && !(await lidLeeft())) {
      lid = await nieuwLid(vraag); hersteld++;
      if (!lid) {
        stil.push(r.methode + ' ' + r.pad + ' (geen lid meer te maken)');
        onbekend.push({ route: r.methode + ' ' + r.pad, rol: 'lid-herstel', status: 0 });
        continue;
      }
      l = await vraag(r.methode, pad, lid, lijf);
    }
    if (fixtures.past(r.methode, pad)) {
      const f = await fixtures.meet(r.methode, pad, lid, lijf);
      rolproeven.push({ route: r.methode + ' ' + r.pad, rol: 'rtg-pas', ...f.proef, oordeel: f.oordeel });
      if (f.oordeel.stand !== 'bewezen') {
        const rij = { route: r.methode + ' ' + r.pad, rol: 'rtg-pas', reden: f.oordeel.reden };
        if (f.oordeel.stand === 'gat') gaten.push(rij);
        else onbekend.push(rij);
        continue;
      }
      l = f.eigen;
    }
    if (!succesvol(l)) {
      andereRol.push(r.methode + ' ' + r.pad);
      onbekend.push(...beoordeelRoute(r.methode + ' ' + r.pad, anon, l).onbekend);
      continue;
    }
    if (!(await lidLeeft())) {
      onbekend.push({ route: r.methode + ' ' + r.pad, rol: 'lid-kanarie', status: 0 });
      continue;
    }
    const antwoorden = {}, controles = {};
    for (const [rol, tok] of [['leverancier', supTok], ['kantoor', offTok]]) {
      const proef = await meetRol(vraag, rol, tok, r.methode, pad, lijf);
      antwoorden[rol] = proef.antwoord;
      controles[rol] = { voor: proef.voor, na: proef.na };
      // Uitsluitend statusbewijs; geen tokens of ontvangen inhoud bewaren.
      rolproeven.push({ route: r.methode + ' ' + r.pad, rol,
        voor: proef.voor.status, antwoord: proef.antwoord.status, na: proef.na.status });
    }
    const uit = beoordeelRoute(r.methode + ' ' + r.pad, anon, l, antwoorden, controles);
    if (uit.bewezen) ledenEndpoints.push(r.methode + ' ' + r.pad);
    gaten.push(...uit.gaten.map(g => ({ ...g, bestand: r.bestand + ':' + r.regel })));
    onbekend.push(...uit.onbekend);
    gedeeld.push(...uit.gedeeld);
  }

  console.log('  ' + K.grijs + 'sessie onderweg hersteld: ' + hersteld + ' keer' + K.reset + '\n');
  console.log('  ' + K.vet + ledenEndpoints.length + K.reset + ' leden-endpoints met bewezen rolscheiding ' +
    K.grijs + '(anoniem401/403, lid2xx, andere rollen401/403 met eigen2xx vóór/na)' + K.reset);
  console.log('  ' + K.grijs + publiekOfVroeg.length + ' routes zonder expliciete anonieme401/403 (scheiding niet bewezen)' + K.reset);
  console.log('  ' + K.grijs + andereRol.length + ' routes zonder succesvolle ledencontrole (rol niet bewezen)' + K.reset);
  if (gedeeld.length) {
    console.log('  ' + K.grijs + gedeeld.length + ' antwoord(en) van een loket dat MET OPZET voor meer dan een rol opengaat:' + K.reset);
    for (const g of gedeeld) console.log('    ' + K.grijs + g.route + ' [' + g.rol + '] -- ' + ROLGEDEELD.get(g.route).reden.slice(0, 90) + K.reset);
  }
  if (stil.length) console.log('  ' + K.geel + stil.length + ' routes gaven geen antwoord' + K.reset);

  try {
    if (magSchrijven(eisSchoneBoom('rolronde'), UITSLAGBESTAND)) fs.writeFileSync(UITSLAGBESTAND, JSON.stringify({
      stempel: stempel(null, { uitvoer: ['ROLRONDE.json'] }),
      uitleg: 'De rolronde: welke rol komt waar binnen, gevraagd aan een echte server in plaats van aan de brontekst. ' +
        'gaten MAG ALLEEN DALEN en gemeten mag ALLEEN STIJGEN -- zie scripts/rolronde.js. ' +
        'Dit is de VERTICALE scheiding; de horizontale (lid A tegen lid B) is de gluurder-trede van de ladder.',
      gedraaid: new Date().toISOString(),
      meters: { [METER]: gaten.length, [METER_N]: ledenEndpoints.length },
      routesOnderzocht: routes.length, sessieHersteld: hersteld,
      publiekOfVroegGevalideerd: publiekOfVroeg.length, andereRol: andereRol.length, zonderAntwoord: stil,
      bewustGedeeld: [...ROLGEDEELD].map(([route, u]) => ({ route, reden: u.reden, toets: u.toets })),
      waargenomenGedeeld: gedeeld, rolproeven,
      onbekend, bewezen: ledenEndpoints,
      gaten
    }, null, 2) + '\n');
  } catch (e) { console.error('  kon ROLRONDE.json niet schrijven: ' + e.message); }

  sluit();

  if (gaten.length) {
    console.log('\n  ' + K.rood + K.vet + gaten.length + ' GAT(EN) IN DE ROLSCHEIDING' + K.reset + '\n');
    for (const g of gaten.slice(0, 40))
      console.log('    ' + K.rood + '!' + K.reset + ' ' + g.route + ' [' + g.rol + '] -> ' + g.status + K.grijs + '  (' + g.bestand + ')' + K.reset);
    if (gaten.length > 40) console.log('    ' + K.grijs + '... nog ' + (gaten.length - 40) + K.reset);
    console.log('');
    return 1;
  }
  console.log('\n  ' + (onbekend.length ? K.geel : K.groen) +
    (onbekend.length ? onbekend.length + ' antwoorden zonder voldoende bewijs; geen waargenomen lek is geen bewezen scheiding.'
      : 'De onderzochte rolgrenzen zijn expliciet beproefd.') + K.reset + '\n');

  /* ---------- de ratel ---------- */
  let norm = null;
  try { norm = JSON.parse(fs.readFileSync(path.join(WORTEL, 'NORM.json'), 'utf8')); } catch (e) { if (!e || e.code !== 'ENOENT') throw e;}
  if (norm && norm.meters && !BASIS_EXTERN) {
    const uitslag = { gaten: gaten.length, gemeten: ledenEndpoints.length };
    const oordeel = beoordeel(uitslag, norm.meters);
    if (oordeel.zakt) {
      for (const reden of oordeel.redenen) console.error(reden);
      return 1;
    }
    if (VASTLEGGEN && !onbekend.length) {
      const p = norm.meters[METER], v = norm.meters[METER_N];
      if (p === undefined || uitslag.gaten <= p) norm.meters[METER] = uitslag.gaten;
      if (v === undefined || uitslag.gemeten >= v) norm.meters[METER_N] = uitslag.gemeten;
      fs.writeFileSync(path.join(WORTEL, 'NORM.json'), JSON.stringify(norm, null, 2) + '\n');
      console.log('  ' + K.groen + METER + ' vastgelegd op ' + norm.meters[METER] + ', ' + METER_N + ' op ' + norm.meters[METER_N] + '.' + K.reset + '\n');
    }
  }
  return onbekend.length ? 2 : 0;
}

if (require.main === module) main().then(c => { process.exitCode = c; }).catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { meetRol, beoordeelRoute, beoordeel, gedeeldAntwoordGeldig, METER, METER_N };
