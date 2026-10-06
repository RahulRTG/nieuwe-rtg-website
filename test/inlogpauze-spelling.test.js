/* DE INLOGPAUZE KENT ELKE SPELLING DIE DE ROUTER KENT (N18 van de V1-audit).

   De inlogpauze (server/middleware/remmen.js) sluit tijdens een brede brute
   force de paden waarlangs iemand een sessie krijgt. Ze vergeleek letterlijk
   op req.path, terwijl de router een vast pad ook MET een slash erachter bij
   dezelfde handler laat komen (padMatch in server/web/routing.js, en de index
   in server/web/routeindex.js). Een herkeuring zag het zelf: tijdens een
   gesprongen pauze gaf /api/auth/login een 503 en /api/auth/login/ een 200,
   en /api/aanmeld/zeg/ gaf een token. Dat gold voor alle paden op de lijst.

   Besluit van de eigenaar: de pauze krijgt dezelfde opvatting van "dit pad" als
   de router, en leent die van de router in plaats van er een eigen
   normalisatie naast te zetten. Deze toets houdt dat op twee manieren vast,
   en ze kunnen allebei zakken:

     1. DE ROUTER IS HET ORAKEL. Een kleine app op de echte router en de echte
        poort, eerst met de zekering erin: welke spellingen bereiken een
        inloghandler? Dan met de zekering eruit: precies DIE spellingen horen
        een 503 te krijgen, en elke andere spelling hoort byte voor byte
        hetzelfde antwoord te krijgen als zonder pauze. Zo hoeft de toets niet
        te weten welke vervormingen de router toelaat; hij vraagt het hem.
        Wordt de router ooit ruimer (hoofdletters, een dubbele slash) zonder
        dat de pauze meegaat, dan zakt deze helft.

     2. DE ECHTE SERVER. Zes bronnen raden door tot de noodrem de pauze laat
        springen, zoals in test/noodrem-bron.test.js. Daarna krijgt elke
        spelling van elk inlogpad een 503, OF exact het antwoord dat dezelfde
        vervorming van een pad zonder route krijgt (dan bereikte zij geen
        handler). Een niet-inlogpad werkt gewoon door.

   Draai los: node --test test/inlogpauze-spelling.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const web = require('../server/web');
const { INLOG_PADEN, inlogpauzePoort } = require('../server/middleware/remmen');
const { startServer, stop } = require('./helper');

const PAUZE = /Inloggen is enkele minuten gepauzeerd/;

/* Elke vervorming van een pad die een client kan sturen. Bewust ook de vormen
   die de router vandaag NIET bij een handler laat komen: de toets beslist dat
   niet zelf, hij laat het de router zeggen (deel 1) of vergelijkt met een pad
   zonder route (deel 2). */
function vervormingen(p) {
  const laatste = p.charCodeAt(p.length - 1).toString(16).toUpperCase();
  return [
    ['exact', p],
    ['slash', p + '/'],
    ['slash en vraag', p + '/?x=1'],
    ['vraag', p + '?x=1'],
    ['twee slashes achteraan', p + '//'],
    ['hoofdletters', p.toUpperCase()],
    ['een hoofdletter', p.replace(/\/([a-z])([^/]*)$/, (_, a, b) => '/' + a.toUpperCase() + b)],
    ['dubbele slash binnenin', p.replace('/api/', '/api//')],
    ['dubbele slash vooraan', '/' + p],
    ['dubbele slash voor het laatste segment', p.replace(/\/([^/]+)$/, '//$1')],
    ['punt-segment', p.replace(/\/([^/]+)$/, '/./$1')],
    ['terug-segment', p.replace('/api/', '/api/x/../')],
    ['procent op het laatste teken', p.slice(0, -1) + '%' + laatste],
    ['procent op de slash', p.replace(/\/([^/]+)$/, '%2F$1')],
    ['procent-slash achteraan', p + '%2F'],
    ['fragment', p + '#x'],
    ['punt achteraan', p + '.'],
    ['spatie achteraan', p + '%20'],
    ['puntkomma', p + ';x'],
    ['backslash', p.replace(/\/([^/]+)$/, '\\$1')]
  ];
}

/* Een POST met het pad PRECIES zoals gegeven: fetch() en new URL() zouden een
   punt-segment of een backslash al aan de kant van de client gladstrijken, en
   dan meet je de client in plaats van de server. Elk verzoek komt van een eigen
   adres, zodat de quarantaine van De Wacht (veel 404's van een adres) de meting
   niet in 403's verandert. */
let volgnummer = 1;
function stuur(base, pad, lijf) {
  const u = new URL(base);
  const n = volgnummer++;
  const ip = '198.51.' + (100 + (n >> 8)) + '.' + (n & 255);
  const data = JSON.stringify(lijf || {});
  return new Promise((klaar) => {
    const r = http.request({ host: u.hostname, port: u.port, method: 'POST', path: pad,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'X-Forwarded-For': ip } }, (res) => {
      let s = '';
      res.on('data', (d) => { s += d; });
      res.on('end', () => klaar({ status: res.statusCode, body: s }));
    });
    r.on('error', (e) => klaar({ status: 'fout', body: e.code || e.message }));
    r.end(data);
  });
}

function luister(app) {
  return new Promise((klaar) => {
    const srv = http.createServer(app).listen(0, '127.0.0.1', () => klaar(srv));
  });
}

test('1. de pauze sluit precies de spellingen die de router bij een inloghandler brengt', async () => {
  /* De echte router en de echte poort. Elke inloghandler zegt wie hij is; een
     paar gewone routes ernaast zijn de controle dat de poort de rest met rust
     laat. /api/staff/login heeft in de echte server geen handler, maar staat
     op de lijst; hier krijgt hij er een, zodat ook dat pad wordt gemeten. */
  const zekering = { aan: true };
  const db = { data: { techniek: { zekeringen: { inlogpauze: zekering } } } };
  const app = web();
  app.use(inlogpauzePoort({ db }));
  const GEWOON = ['/api/aanmeld/start', '/api/auth/me', '/api/auth/login/extra'];
  for (const p of [...INLOG_PADEN, ...GEWOON]) app.post(p, (req, res) => res.json({ handler: p }));
  const srv = await luister(app);
  const base = 'http://127.0.0.1:' + srv.address().port;
  try {
    const verzoeken = [];
    for (const p of [...INLOG_PADEN, ...GEWOON]) for (const [naam, pad] of vervormingen(p)) verzoeken.push({ p, naam, pad });

    // Eerst de router zelf: welke spellingen komen bij een inloghandler uit?
    const zonder = [];
    for (const v of verzoeken) zonder.push(await stuur(base, v.pad));
    const bereikt = zonder.map((r) => {
      try { return INLOG_PADEN.includes(JSON.parse(r.body).handler); } catch (e) { return false; }
    });

    /* NIET LEEG: de exacte vorm en de vorm met slash erachter bereiken elk
       inlogpad. Bereikte geen enkele spelling iets, dan zou het vergelijken
       hieronder over niets gaan en altijd slagen. */
    for (const p of INLOG_PADEN) {
      for (const naam of ['exact', 'slash', 'slash en vraag']) {
        const i = verzoeken.findIndex(v => v.p === p && v.naam === naam);
        assert.equal(bereikt[i], true, 'de router hoort ' + verzoeken[i].pad + ' bij de handler van ' + p + ' te brengen');
      }
    }

    zekering.aan = false;   // handmatig getrokken: blijft eruit tot hij terug wordt gezet
    const fouten = [];
    for (let i = 0; i < verzoeken.length; i++) {
      const v = verzoeken[i];
      const met = await stuur(base, v.pad);
      if (bereikt[i]) {
        if (met.status !== 503 || !PAUZE.test(met.body)) {
          fouten.push(v.naam + ' ' + JSON.stringify(v.pad) + ': de router brengt dit bij een inloghandler, de pauze liet het door (' + met.status + ' ' + met.body.slice(0, 60) + ')');
        }
      } else if (met.status !== zonder[i].status || met.body !== zonder[i].body) {
        fouten.push(v.naam + ' ' + JSON.stringify(v.pad) + ': bereikt geen inloghandler, maar de pauze veranderde het antwoord (' +
          zonder[i].status + ' werd ' + met.status + ')');
      }
    }
    assert.deepEqual(fouten, [], 'de pauze en de router zijn het oneens over wat een inlogpad is');
  } finally { srv.close(); }
});

/* Elke toets met een echte server krijgt een eigen datamap: de pauze is een
   opgeslagen zekering. */
async function nieuweServer() {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-inlogspelling-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  srv.op = () => { stop(srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} };
  return srv;
}

/* De pauze laten springen zoals een echte aanval dat doet: zes bronnen, elk tien
   mislukte pogingen op een eigen naam (zie test/noodrem-bron.test.js). Daarna
   wordt gecontroleerd dat hij echt is gesprongen, anders meet de rest niets. */
async function laatPauzeSpringen(base) {
  for (let i = 1; i <= 6; i++) {
    for (let j = 0; j < 11; j++) {
      await fetch(base + '/api/auth/login', { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.' + i },
        body: JSON.stringify({ login: 'doel' + i + '@x.test', password: 'fout' + j }) });
    }
  }
  const proef = await stuur(base, '/api/auth/login', { login: 'iemand@x.test', password: 'x' });
  assert.equal(proef.status, 503, 'de pauze hoort na zes bronnen gesprongen te zijn (kreeg ' + proef.status + ')');
  assert.match(proef.body, PAUZE);
}

/* Wat een antwoord zegt zonder de delen die per verzoek anders zijn: de status,
   en bij JSON de foutzin, bij HTML de eerste regel. */
function kern(r) {
  try { const j = JSON.parse(r.body); return r.status + ' ' + (j.error || JSON.stringify(j)); }
  catch (e) { return r.status + ' ' + String(r.body).split('\n')[0]; }
}

test('2. op een echte server: geen spelling van een inlogpad komt langs een gesprongen pauze', async () => {
  const srv = await nieuweServer();
  try {
    await laatPauzeSpringen(srv.base);

    /* Het ijkpad: per inlogpad een pad met DEZELFDE VORM (zelfde segmenten,
       zelfde lengtes, onder /api/) dat geen route heeft. Dezelfde vervorming
       daarop zegt hoe de server antwoordt als er GEEN handler wordt bereikt.
       Een vaste ijkvorm voor alle paden klopt niet: "procent op de slash" haalt
       /api/login onder /api/ vandaan en een diepere ijkvorm niet, en dan
       verschilt het antwoord om een reden die niets met de pauze te maken heeft. */
    const ijkVan = (p) => '/api/' + p.slice(5).replace(/[a-z]/g, 'q');
    const ijk = new Map();
    for (const p of INLOG_PADEN) {
      const vorm = ijkVan(p);
      if (ijk.has(vorm)) continue;
      const per = new Map();
      for (const [naam, pad] of vervormingen(vorm)) per.set(naam, kern(await stuur(srv.base, pad)));
      assert.match(per.get('exact'), /^404 /, 'het ijkpad ' + vorm + ' hoort een gewone 404 te geven, geen quarantaine: ' + per.get('exact'));
      ijk.set(vorm, per);
    }

    const fouten = [];
    let dicht = 0;
    for (const p of INLOG_PADEN) {
      const per = ijk.get(ijkVan(p));
      for (const [naam, pad] of vervormingen(p)) {
        const r = await stuur(srv.base, pad, { login: 'iemand@x.test', password: 'x', bericht: 'hallo' });
        if (r.status === 503 && PAUZE.test(r.body)) { dicht++; continue; }
        if (kern(r) !== per.get(naam)) fouten.push(naam + ' ' + JSON.stringify(pad) + ' kwam langs de pauze: ' + kern(r).slice(0, 80));
      }
      /* Het pad op de lijst, met en zonder slash, hoort hier DICHT te zijn en
         niet alleen "niet anders dan het ijkpad". Ook /api/staff/login, dat
         vandaag geen handler heeft: de lijst zegt wat een inlogpad is, en de
         router zegt welke spellingen daarbij horen. */
      for (const pad of [p, p + '/', p + '/?x=1']) {
        const r = await stuur(srv.base, pad, {});
        if (r.status !== 503) fouten.push(pad + ' hoort tijdens de pauze een 503 te geven (kreeg ' + r.status + ' ' + r.body.slice(0, 60) + ')');
      }
    }
    assert.deepEqual(fouten, [], 'tijdens de pauze bereikte een spelling van een inlogpad nog zijn handler');
    assert.ok(dicht >= INLOG_PADEN.length * 4, 'per inlogpad horen minstens vier spellingen dicht te zijn (exact, slash, met en zonder vraag), kreeg ' + dicht);

    /* TEGENPROEF: de pauze sluit de inlog en niet de app. Een gesprek beginnen
       geeft niemand iets en blijft open, ook met een slash erachter, en een
       gewone ledenroute zegt 401 en geen 503. */
    for (const pad of ['/api/aanmeld/start', '/api/aanmeld/start/']) {
      const r = await stuur(srv.base, pad, {});
      assert.notEqual(r.status, 503, pad + ' hoort open te blijven tijdens de inlogpauze: ' + r.body.slice(0, 80));
    }
    const leden = await stuur(srv.base, '/api/state', {});
    assert.notEqual(leden.status, 503, 'de app zelf blijft open; alleen de inlog pauzeert');
  } finally { srv.op(); }
});
