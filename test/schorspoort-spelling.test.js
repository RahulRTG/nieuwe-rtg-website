/* DE SCHORSPOORT KENT ELKE SPELLING DIE DE ROUTER KENT (N26 van de V1-audit).

   De schorspoort (server/middleware/schorspoort.js) weigert een SCHRIJVENDE
   aanroep op een route die in VERTROUWEN.json `geschorst` heet. Zijn lezer
   (staatVan in server/lib/vervalstaat.js) zocht de route letterlijk op met het
   pad zoals het binnenkwam, terwijl de router een vast pad ook MET een slash
   erachter bij dezelfde handler laat komen (padMatch in server/web/routing.js)
   en een :param-route ook (zijn RegExp eindigt op \/?). Zelf gezien op de basis:
   met POST /api/foundation/les/maak geschorst gaf het pad zelf een 503, en
   /api/foundation/les/maak/ maakte gewoon een les aan (200, met een lescode);
   PUT /api/scim/v2/Users/abc gaf 503 en /api/scim/v2/Users/abc/ kwam bij de
   handler (401 van SCIM zelf).

   Besluit van de eigenaar: staatVan zoekt het pad op zoals de router dat doet,
   met vastePaden() uit server/web/routeindex.js, net als de inlogpauze sinds
   N18 (test/inlogpauze-spelling.test.js). Deze toets houdt dat op drie manieren
   vast, en ze kunnen alle drie zakken:

     1. DE ROUTER IS HET ORAKEL. Een kleine app op de echte router en de echte
        poort, met een vaste route, een :param-route en een gemounte router.
        Eerst met niets geschorst: welke spellingen bereiken een handler die
        straks geschorst wordt? Dan met de schorsing aan: precies DIE
        spellingen horen de schorsweigering te krijgen, en elke andere spelling
        byte voor byte hetzelfde antwoord als zonder schorsing. De toets hoeft
        zo niet te weten welke vervormingen de router toelaat; hij vraagt het
        hem.

     2. EEN MELDING PER ROUTE. De poort meldt een geschorste route een keer in
        het log. Dat ging op het pad zoals het binnenkwam, dus elke nieuwe
        waarde van een :param (en elke slash) was een nieuwe regel en een nieuwe
        plek in het geheugen.

     3. DE ECHTE SERVER, met een verzonnen register via RTG_VERTROUWEN. Elke
        spelling die bij de geschorste handler hoort krijgt de 503 met de kop
        en de reden; een niet-geschorste route geeft zijn ECHTE status.

   En twee toetsen voor de grens van die reparatie. Een route die op een slash
   eindigt (vast, als :param, of op de wortel van een mount) komt met een slash
   EXTRA bij zijn handler, terwijl zijn registersleutel geen slash draagt: die
   spelling vindt de lezer niet, en dat is zonder een tweede opvatting van het
   pad niet te verhelpen (de kop van staatVan legt uit waarom). Vandaag bestaat
   zo'n schrijvende route niet; deze twee houden dat vast.

     4. HET INSTRUMENT KAN UITSLAAN. Het orakel van toets 5 op een kleine
        router met precies die vormen: het vindt alle drie (en ook een .all()
        en een :param midden in een segment, die langs een andere weg
        hetzelfde doen), en wat het een gat noemt is over HTTP met de echte
        poort ook echt een gat (de handler antwoordt), terwijl alles wat het
        dicht noemt de 503 krijgt.

     5. DE ECHTE ROUTEKAART. Elke schrijvende laag van de echte app, met zijn
        pad zoals hij is opgehangen (test/fixtures/schrijflagen.js), wordt
        opnieuw opgehangen op de echte router; per spelling wordt de ROUTER
        gevraagd of hij bij de handler komt, en dan moet staatVan hem vinden.

   Draai los: node --test test/schorspoort-spelling.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const web = require('../server/web');
const { padNaar } = require('../server/web/routing');
const vervalstaat = require('../server/lib/vervalstaat');
const maakSchorspoort = require('../server/middleware/schorspoort');
const { rauweLagen, SCHRIJFT } = require('./fixtures/schrijflagen');
const { startServer, stop, vrijePoort } = require('./helper');

const WEIGERING = /Deze handeling is tijdelijk geschorst: het bewijs erachter is gezakt/;

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-schorsspelling-'));
const REG = path.join(TMP, 'vertrouwen.json');
test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* Elke vervorming van een pad die een client kan sturen; dezelfde lijst als in
   test/inlogpauze-spelling.test.js. Bewust ook de vormen die de router vandaag
   NIET bij een handler laat komen: de toets beslist dat niet zelf. */
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

/* Een verzoek met het pad PRECIES zoals gegeven: fetch() en new URL() zouden
   een punt-segment of een backslash al aan de kant van de client
   gladstrijken. Elk verzoek komt van een eigen adres, zodat de quarantaine van
   De Wacht (veel 404's van een adres) de meting op de echte server niet in
   403's verandert. */
let volgnummer = 1;
function stuur(base, methode, pad, lijf) {
  const u = new URL(base);
  const n = volgnummer++;
  const ip = '198.51.' + (100 + (n >> 8)) + '.' + (n & 255);
  const data = JSON.stringify(lijf || {});
  return new Promise((klaar) => {
    const r = http.request({ host: u.hostname, port: u.port, method: methode, path: pad,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'X-Forwarded-For': ip } }, (res) => {
      let s = '';
      res.on('data', (d) => { s += d; });
      res.on('end', () => klaar({ status: res.statusCode, kop: res.headers['x-vervalstaat'] || null, body: s }));
    });
    r.on('error', (e) => klaar({ status: 'fout', kop: null, body: e.code || e.message }));
    r.end(data);
  });
}

function luister(app) {
  return new Promise((klaar) => {
    const srv = http.createServer(app).listen(0, '127.0.0.1', () => klaar(srv));
  });
}

/* De routes van de kleine app, met de sleutel zoals het register hem schrijft
   (scripts/vertrouwen.js leest ze uit de routekaart: voorvoegsel plus pad).
   `voorbeeld` is een echt verzoekpad dat bij die route hoort. */
const GESCHORST = [
  { sleutel: 'POST /api/geld/boek', voorbeeld: '/api/geld/boek' },
  { sleutel: 'POST /api/gezin/:code/mij', voorbeeld: '/api/gezin/ABC123/mij' },
  { sleutel: 'POST /api/sub/les/maak', voorbeeld: '/api/sub/les/maak' },
  { sleutel: 'PUT /api/sub/users/:id', voorbeeld: '/api/sub/users/u7' }
];
const OPEN = [
  { sleutel: 'POST /api/geld/boek/extra', voorbeeld: '/api/geld/boek/extra' },
  { sleutel: 'POST /api/sub/vrij', voorbeeld: '/api/sub/vrij' }
];

function bouwApp(log) {
  const app = web();
  app.use(web.json());
  app.use(maakSchorspoort({ pad: REG, ttlMs: 0, log }));
  const zeg = (sleutel) => (req, res) => res.json({ handler: sleutel });
  app.post('/api/geld/boek', zeg('POST /api/geld/boek'));
  app.post('/api/geld/boek/extra', zeg('POST /api/geld/boek/extra'));
  app.post('/api/gezin/:code/mij', zeg('POST /api/gezin/:code/mij'));
  const sub = web.Router();
  sub.post('/les/maak', zeg('POST /api/sub/les/maak'));
  sub.put('/users/:id', zeg('PUT /api/sub/users/:id'));
  sub.post('/vrij', zeg('POST /api/sub/vrij'));
  app.use('/api/sub', sub);
  return app;
}

function schrijfRegister(staat) {
  const perRoute = {};
  for (const r of GESCHORST) perRoute[r.sleutel] = { staat, reden: 'verzonnen stand voor N26' };
  for (const r of OPEN) perRoute[r.sleutel] = { staat: 'verzwakt', reden: 'schakels missen' };
  fs.writeFileSync(REG, JSON.stringify({ perRoute }));
}

test('1. de poort weigert precies de spellingen die de router bij een geschorste handler brengt', async () => {
  const srv = await luister(bouwApp());
  const base = 'http://127.0.0.1:' + srv.address().port;
  try {
    const verzoeken = [];
    for (const r of [...GESCHORST, ...OPEN]) {
      const methode = r.sleutel.split(' ')[0];
      for (const [naam, pad] of vervormingen(r.voorbeeld)) verzoeken.push({ r, methode, naam, pad });
    }

    // Eerst de router zelf, met niets geschorst: welke spellingen komen waar uit?
    schrijfRegister('verzwakt');
    const zonder = [];
    for (const v of verzoeken) zonder.push(await stuur(base, v.methode, v.pad, {}));
    const geschorsteSleutels = new Set(GESCHORST.map(r => r.sleutel));
    const bereikt = zonder.map((z) => {
      try { return geschorsteSleutels.has(JSON.parse(z.body).handler); } catch (e) { return false; }
    });

    /* NIET LEEG: de exacte vorm, de vorm met slash en die met slash en vraag
       bereiken elke route, ook de :param-routes en die in de gemounte router.
       Bereikte geen enkele spelling iets, dan ging het vergelijken hieronder
       over niets en slaagde het altijd. */
    for (const r of [...GESCHORST, ...OPEN]) {
      for (const naam of ['exact', 'slash', 'slash en vraag']) {
        const i = verzoeken.findIndex(v => v.r === r && v.naam === naam);
        assert.equal(JSON.parse(zonder[i].body).handler, r.sleutel,
          'de router hoort ' + verzoeken[i].pad + ' bij de handler van ' + r.sleutel + ' te brengen');
      }
    }

    schrijfRegister('geschorst');
    const fouten = [];
    let dicht = 0;
    for (let i = 0; i < verzoeken.length; i++) {
      const v = verzoeken[i];
      const met = await stuur(base, v.methode, v.pad, {});
      if (bereikt[i]) {
        if (met.status !== 503 || met.kop !== 'geschorst' || !WEIGERING.test(met.body)) {
          fouten.push(v.naam + ' ' + v.methode + ' ' + JSON.stringify(v.pad) + ': de router brengt dit bij ' +
            JSON.parse(zonder[i].body).handler + ', de schorspoort liet het door (' + met.status + ' ' + met.body.slice(0, 60) + ')');
        } else dicht++;
      } else if (met.status !== zonder[i].status || met.body !== zonder[i].body) {
        fouten.push(v.naam + ' ' + v.methode + ' ' + JSON.stringify(v.pad) + ': bereikt geen geschorste handler, maar de poort veranderde het antwoord (' +
          zonder[i].status + ' werd ' + met.status + ')');
      }
    }
    assert.deepEqual(fouten, [], 'de schorspoort en de router zijn het oneens over welk pad bij een geschorste route hoort');
    assert.ok(dicht >= GESCHORST.length * 4, 'per geschorste route horen minstens vier spellingen dicht te zijn, kreeg ' + dicht);
  } finally { srv.close(); }
});

test('2. de poort meldt een geschorste route een keer, hoe hij ook gespeld wordt', async () => {
  const regels = [];
  const srv = await luister(bouwApp({ warn: (m) => regels.push(String(m)) }));
  const base = 'http://127.0.0.1:' + srv.address().port;
  try {
    schrijfRegister('geschorst');
    for (const pad of ['/api/gezin/A1/mij', '/api/gezin/B2/mij/', '/api/gezin/C3/mij?x=1']) {
      assert.equal((await stuur(base, 'POST', pad, {})).status, 503, pad + ' hoort dicht te zijn');
    }
    for (const pad of ['/api/geld/boek', '/api/geld/boek/']) {
      assert.equal((await stuur(base, 'POST', pad, {})).status, 503, pad + ' hoort dicht te zijn');
    }
    assert.deepEqual(regels.map(r => r.replace(/ staat dicht.*$/, '')),
      ['[schorspoort] POST /api/gezin/:code/mij', '[schorspoort] POST /api/geld/boek'],
      'een regel per ROUTE uit het register, niet per id of per spelling');
  } finally { srv.close(); }
});

test('3. op een echte server: een geschorste route is met geen spelling van de router uit te voeren', async () => {
  /* Een verzonnen register, want het echte kent vandaag geen schorsing
     (test/schorspoort.test.js houdt dat vast). Twee routes: een in de gemounte
     router van de RTFoundation die zonder inlog echt werk doet (een les
     aanmaken), en een :param-route. RTG_SCHORSPOORT_UIT staat expliciet op 0,
     zodat een omgeving die hem aanzet deze toets niet stil laat slagen. */
  const REAAL = path.join(TMP, 'echt-vertrouwen.json');
  fs.writeFileSync(REAAL, JSON.stringify({ perRoute: {
    'POST /api/foundation/les/maak': { staat: 'geschorst', reden: 'verzonnen stand voor N26' },
    'PUT /api/scim/v2/Users/:id': { staat: 'geschorst', reden: 'verzonnen stand voor N26 (param)' }
  } }));
  const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-schorsspelling-data-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: DATA, RTG_VERTROUWEN: REAAL, RTG_SCHORSPOORT_UIT: '0' } });
  try {
    const LES = { vak: 'Spellingproef', naam: 'Begeleider' };
    const fouten = [];
    for (const [methode, pad, reden] of [
      ['POST', '/api/foundation/les/maak', /verzonnen stand voor N26/],
      ['POST', '/api/foundation/les/maak/', /verzonnen stand voor N26/],
      ['POST', '/api/foundation/les/maak?x=1', /verzonnen stand voor N26/],
      ['POST', '/api/foundation/les/maak/?x=1', /verzonnen stand voor N26/],
      ['PUT', '/api/scim/v2/Users/abc', /\(param\)/],
      ['PUT', '/api/scim/v2/Users/abc/', /\(param\)/],
      ['PUT', '/api/scim/v2/Users/abc/?x=1', /\(param\)/]
    ]) {
      const r = await stuur(srv.base, methode, pad, LES);
      let d = null; try { d = JSON.parse(r.body); } catch (e) {}
      if (r.status !== 503 || r.kop !== 'geschorst' || !d || !WEIGERING.test(d.error) || !reden.test(d.reden || '')) {
        fouten.push(methode + ' ' + pad + ' kwam langs de schorspoort: ' + r.status + ' ' + r.body.slice(0, 80));
      }
    }
    assert.deepEqual(fouten, [], 'een geschorste route hoort met elke spelling van de router dicht te zijn');

    /* TEGENPROEF: de poort sluit de geschorste route en niets anders. Precies
       de status van de handler, en niet alleen "geen 503": een 404 (de route
       weg) of een 500 liet de tegenproef anders ook slagen. */
    const vreemd = await stuur(srv.base, 'POST', '/api/foundation/les/maak/extra', LES);
    assert.equal(vreemd.status, 404, 'een pad dat geen route raakt blijft de 404 van de afsluiter (kreeg ' + vreemd.status + ' ' + vreemd.body.slice(0, 60) + ')');
    assert.equal(vreemd.kop, null);
    const scimPatch = await stuur(srv.base, 'PATCH', '/api/scim/v2/Users/abc/', {});
    assert.equal(scimPatch.status, 401, 'PATCH op dezelfde :param-route is niet geschorst en geeft de 401 van SCIM (kreeg ' + scimPatch.status + ')');
    assert.equal(scimPatch.kop, null);
    const leden = await stuur(srv.base, 'POST', '/api/state/', {});
    assert.equal(leden.status, 401, 'een gewone ledenroute met een slash geeft zijn eigen 401 (kreeg ' + leden.status + ')');
  } finally {
    stop(srv.child);
    try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) {}
  }
});

/* HET ORAKEL VOOR DE GRENS (toets 4 en 5).

   Per schrijvende laag een eigen kleine router met dezelfde mounts en hetzelfde
   pad als waarmee hij is opgehangen, en een register met precies zijn sleutel:
   die van _routes(), de vorm die scripts/vertrouwen.js schrijft. Daarna per
   spelling twee vragen: brengt de ROUTER dit verzoek bij de handler, en zo ja,
   vindt staatVan het dan ook? De toets beslist dus niet zelf welke vormen
   gevaarlijk zijn; hij vraagt het de router, net als toets 1.

   Een laag waarbij geen enkele spelling de handler haalt, is ONBEPROEFD en geen
   geslaagde laag: anders ging het vergelijken over niets. Een :param krijgt een
   vaste waarde, alleen in het pad (een mount kent geen parameters). Elke laag
   staat los, dus een eerdere laag die een spelling in de echte app zou
   wegvangen telt hier niet mee: het orakel ziet eerder te veel dan te weinig. */
const REG_ORAKEL = path.join(TMP, 'orakel.json');
function spellingGaten(lagen) {
  const proeven = [], onbeproefd = [];
  for (const l of lagen) {
    const wortel = web.Router();
    let r = wortel;
    for (const p of l.voorvoegsels) { const kind = web.Router(); r.use(p, kind); r = kind; }
    let geraakt = false;
    r[l.methode === 'ALL' ? 'all' : l.methode.toLowerCase()](l.pad, () => { geraakt = true; });
    const [k] = wortel._routes('');
    const route = k.methode + ' ' + k.pad;
    fs.writeFileSync(REG_ORAKEL, JSON.stringify({ perRoute: { [route]: { staat: 'geschorst', reden: 'orakel' } } }));
    vervalstaat.vergeet();
    const vol = l.voorvoegsels.map(p => (p === '/' ? '' : p)).join('') + l.pad.replace(/:([A-Za-z0-9_]+)/g, 'p1');
    const kaal = vol.replace(/\/+$/, '') || '/';
    const spellingen = new Set([...vervormingen(vol), ...vervormingen(kaal)].map(([, s]) => s));
    let ooit = false;
    for (const s of spellingen) {
      const pn = padNaar(s);
      if (!pn.startsWith('/api/')) continue;   // de schorspoort kijkt alleen onder /api/
      for (const methode of (l.methode === 'ALL' ? [...SCHRIJFT] : [l.methode])) {
        geraakt = false;
        wortel._handle({ method: methode, url: s, headers: {} }, {}, () => {});
        if (!geraakt) continue;
        ooit = true;
        const st = vervalstaat.staatVan(methode, pn, { pad: REG_ORAKEL, ttlMs: 3600000 });
        proeven.push({ methode, pad: s, route, dicht: !!(st && st.staat === 'geschorst') });
      }
    }
    if (!ooit) onbeproefd.push(l.methode + ' ' + l.voorvoegsels.join('') + ' ' + l.pad);
  }
  return { proeven, gaten: proeven.filter(p => !p.dicht), onbeproefd };
}

/* Een router met elke vorm die het orakel hoort te vinden, en de gewone vormen
   ernaast. De drie bovenste zijn de grens uit de kop van staatVan; .all() en een
   :param midden in een segment hebben hetzelfde gevolg langs een andere weg. */
function bouwGrensRouter() {
  const zeg = (sleutel) => (req, res) => res.json({ handler: sleutel });
  const wortel = web.Router();
  const sub = web.Router();
  sub.post('/', zeg('POST /api/sub'));                          // de wortel van een mount
  sub.post('/les/maak', zeg('POST /api/sub/les/maak'));
  wortel.use('/api/sub', sub);
  wortel.post('/api/t/', zeg('POST /api/t'));                   // vast pad, met een slash opgehangen
  wortel.put('/api/p/:id/', zeg('PUT /api/p/:id'));             // :param, met een slash opgehangen
  wortel.post('/api/geld/boek', zeg('POST /api/geld/boek'));
  wortel.put('/api/gezin/:code/mij', zeg('PUT /api/gezin/:code/mij'));
  wortel.all('/api/alles', zeg('ALL /api/alles'));              // de sleutel draagt ALL
  wortel.post('/api/v:versie/x', zeg('POST /api/v:versie/x'));  // :param midden in een segment
  return wortel;
}

test('4. het orakel vindt elke vorm van de grens, en wat het een gat noemt is over HTTP ook een gat', async () => {
  const wortel = bouwGrensRouter();
  const { lagen, regexp } = rauweLagen(wortel._stack);
  assert.deepEqual(regexp, []);
  assert.equal(lagen.length, 8, 'de lezer van de ruwe stapel hoort elke schrijvende laag te vinden, ook die in de mount');
  const { proeven, gaten, onbeproefd } = spellingGaten(lagen);
  assert.deepEqual(onbeproefd, [], 'elke laag hoort met minstens een spelling bij zijn handler te komen');

  const open = new Set(gaten.map(g => g.methode + ' ' + g.pad));
  for (const g of ['POST /api/sub//', 'POST /api/t//', 'PUT /api/p/p1//', 'POST /api/alles', 'DELETE /api/alles/', 'POST /api/vp1/x']) {
    assert.ok(open.has(g), 'het orakel hoort ' + g + ' als gat te zien; het zag: ' + [...open].join(', '));
  }
  for (const route of ['POST /api/sub/les/maak', 'POST /api/geld/boek', 'PUT /api/gezin/:code/mij']) {
    assert.deepEqual(gaten.filter(g => g.route === route), [], route + ' is met elke spelling dicht, dus geen gat');
  }
  const dicht = new Set(proeven.filter(p => p.dicht).map(p => p.methode + ' ' + p.pad));
  /* /api/t en /api/p/p1 zonder slash horen hier NIET bij: wie met een slash
     ophangt, wordt zonder slash niet bereikt (de router eist hem dan). */
  for (const p of ['POST /api/sub', 'POST /api/sub/', 'POST /api/t/', 'PUT /api/p/p1/']) {
    assert.ok(dicht.has(p), p + ' hoort de router bij de handler te brengen en staatVan hoort hem te vinden');
  }
  for (const p of ['POST /api/t', 'PUT /api/p/p1']) {
    assert.ok(!proeven.some(x => x.methode + ' ' + x.pad === p), p + ' bereikt de handler niet en hoort dus geen proef te zijn');
  }

  /* DEZELFDE VRAAG OVER HTTP. De echte poort voor de router, en een register
     waarin elke schrijvende route geschorst is. Wat het orakel dicht noemt,
     hoort de 503 te geven; wat het een gat noemt, hoort bij DIE handler aan te
     komen. Zo bewijst de zelfijking dat een gat geen kunstje van het opnieuw
     ophangen is, en dat een nul in toets 5 dus iets betekent. */
  const REG_HTTP = path.join(TMP, 'grens.json');
  const perRoute = {};
  for (const r of wortel._routes('')) {
    if (r.methode === 'ALL' || SCHRIJFT.has(r.methode)) perRoute[r.methode + ' ' + r.pad] = { staat: 'geschorst', reden: 'grensproef' };
  }
  fs.writeFileSync(REG_HTTP, JSON.stringify({ perRoute }));
  const app = web();
  app.use(web.json());
  app.use(maakSchorspoort({ pad: REG_HTTP, ttlMs: 0 }));
  app.use(wortel);
  const srv = await luister(app);
  const base = 'http://127.0.0.1:' + srv.address().port;
  try {
    const fouten = [];
    for (const p of proeven) {
      const r = await stuur(base, p.methode, p.pad, {});
      let handler = null; try { handler = JSON.parse(r.body).handler; } catch (e) {}
      if (p.dicht && !(r.status === 503 && r.kop === 'geschorst' && WEIGERING.test(r.body))) {
        fouten.push(p.methode + ' ' + p.pad + ': het orakel zegt dicht, over HTTP ' + r.status + ' ' + r.body.slice(0, 60));
      } else if (!p.dicht && !(r.status === 200 && handler === p.route)) {
        fouten.push(p.methode + ' ' + p.pad + ': het orakel zegt gat naar ' + p.route + ', over HTTP ' + r.status + ' ' + r.body.slice(0, 60));
      }
    }
    assert.deepEqual(fouten, [], 'het orakel en de echte poort horen het over elke spelling eens te zijn');
    assert.ok(proeven.length >= 40, 'de zelfijking hoort over genoeg spellingen te gaan, kreeg ' + proeven.length);
  } finally { srv.close(); }
});

test('5. in de echte routekaart komt geen schrijvende route met een andere spelling langs de schorspoort', async () => {
  /* Het orakel hangt de echte routes op in DIT proces. Hing hier de haak van het
     routejournaal (server/routelog.js), dan telde elke schrijvende route van het
     huis als door een toets geraakt: een dekkingsmeting van honderd procent
     zonder een enkel echt verzoek. Het kindproces krijgt het journaal om
     dezelfde reden niet mee. */
  assert.ok(!require.cache[require.resolve('../server/routelog')],
    'het routejournaal is in dit proces geladen; dan schrijft het orakel nepdekking weg');
  const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-schrijflagen-data-'));
  const env = { ...process.env, PORT: String(await vrijePoort()), RTG_DATA_DIR: DATA, SMTP_URL: '', STUN_UIT: '1' };
  delete env.RTG_ROUTELOG;
  let tekst;
  try {
    tekst = execFileSync(process.execPath, [path.join(__dirname, 'fixtures', 'schrijflagen.js')], {
      cwd: path.join(__dirname, '..'), env, encoding: 'utf8', timeout: 180000,
      maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (e) {
    throw new Error('de lezer van de echte routekaart faalde: ' + String(e.stdout || '').slice(0, 500) +
      ' ' + String(e.stderr || e.message).slice(-2000));
  } finally { try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) {} }
  const uit = JSON.parse(tekst);

  /* NIET LEEG: vandaag ruim vijfduizend. Vond de lezer de stapel niet (een
     andere wortel, een mount die hij niet volgt), dan was nul gaten geen uitslag. */
  assert.ok(uit.lagen.length > 1000, 'de echte app hoort duizenden schrijvende lagen te hebben, gelezen: ' + uit.lagen.length);
  assert.ok(uit.lagen.some(l => l.voorvoegsels.length), 'de lezer hoort ook de lagen in een gemounte router te zien');
  assert.deepEqual(uit.regexp, [], 'een schrijvende route met een RegExp-pad heeft geen sleutel in het register en is voor dit orakel niet te beproeven');
  const { proeven, gaten, onbeproefd } = spellingGaten(uit.lagen);
  assert.deepEqual(onbeproefd, [], 'deze lagen komen met geen enkele spelling bij hun handler; het orakel kan er niets over zeggen');
  assert.ok(proeven.length >= uit.lagen.length * 2, 'per laag horen minstens de exacte vorm en die met een slash de handler te halen');
  assert.deepEqual(gaten.slice(0, 20).map(g => g.methode + ' ' + g.pad + ' (route ' + g.route + ')'), [],
    'de router brengt deze spellingen bij een schrijvende handler die de schorspoort niet vindt, dus een schorsing ' +
    'op die route is ermee te omzeilen (' + gaten.length + ' in totaal). Hang de route op zonder slash aan het eind en ' +
    'niet op de wortel van een mount, met de methode die hij echt aanneemt in plaats van .all(), en met een :param ' +
    'als heel segment. Waarom de lezer dit niet zelf oplost: de kop van staatVan in server/lib/vervalstaat.js.');
});
