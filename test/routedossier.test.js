/* HET ROUTEDOSSIER: WAT WETEN WE VAN ELKE ROUTE, EN KAN HET PERSONEEL DAT ZIEN.

   Draai los: node --experimental-sqlite --test test/routedossier.test.js

   WAT HIER BEWEZEN WORDT.

   1. DE DEUR. Het dossier zit achter dezelfde kantoordeur als de rest.

   2. EEN POPULATIE. De matrix die dit scherm toont, gaat over dezelfde routes
      als de dekkingspoort telt. Dit is de toets die voorkomt dat er een negende
      populatie ontstaat: de bewijsmatrix rekende zijn routetabel op via een
      TWEEDE server (scripts/routekaart.js), dit scherm injecteert de router van
      de server zelf, en die twee horen tot op de route gelijk te zijn.

   3. ELF SCHAKELS, MET HUN BRON. Het scherm haalt de schakels bij
      scripts/bewijsmatrix.js op en houdt geen eigen woordenlijst bij -- die zou
      uit de motor lopen zodra daar een schakel bij komt.

   4. GEEN INSTRUMENT IS IETS ANDERS DAN NIET GEMETEN. OUTPUT en AUDIT staan voor
      elke route op ongemeten omdat er niets bestaat dat ze meet. Het antwoord
      moet dat verschil DRAGEN, anders leest het kantoor 8368 cellen als
      achterstallig werk.

   5. HET FILTER FILTERT ECHT. Een klik op een schakel gaf eerst onveranderd alle
      4184 routes terug (`!!r.cellen[schakel]` is waar voor elke route, want elke
      route heeft alle elf cellen). Een knop die eruitziet alsof hij filtert en
      niets doet is erger dan geen knop: wie hem gebruikt denkt dat hij naar het
      openstaande werk kijkt.

   6. HET DOSSIER VAN EEN ENKELE ROUTE draagt de REDEN, en dat is het veld waar
      het om begonnen is. "Ongemeten" helpt niemand; "onbeslist: status 404 op een
      leeg verzoek zegt niets over een slot" vertelt wat er moet gebeuren.

   DE MUTATIES (LAT.md regel 2), alle vier gedaan en alle vier zag ik de JUISTE
   toets zakken:
     - de schakel-tak terug naar `!!r.cellen[schakel]`        -> toets 5 zakt
     - `nodig` uit de schakellijst weglaten                   -> toets 4 zakt
     - de injectie weghalen (bouw() zijn eigen tabel laten
       halen, dus een tweede server starten)                  -> toets 2 zakt
     - officeAuth van de route halen                          -> toets 1 zakt */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

let srv, base, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-routedossier-'));

test.before(async () => {
  srv = await startServer({ env: { RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-DOSSIER-1' } });
  base = srv.base;
  token = await kantoorAlsPersoon(base);
  assert.ok(token, 'het kantoor logt in');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const vraag = (body, mee) => fetch(base + '/api/office/routedossier', {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' },
    mee === false ? {} : { Authorization: 'Bearer ' + token }),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test('1. het routedossier zit achter de kantoordeur', async () => {
  assert.equal((await vraag({}, false)).status, 401, 'zonder kantoorsessie blijft de deur dicht');
  assert.equal((await vraag({})).status, 200, 'met kantoorsessie gaat hij open');
});

test('2. het dossier gaat over dezelfde routes als de dekkingspoort telt', async () => {
  const d = (await vraag({ limiet: 1 })).body;
  const dek = (await fetch(base + '/api/office/routedekking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ limiet: 1 })
  }).then(r => r.json()));

  assert.ok(d.routes > 1000, 'het dossier kent de routes van dit huis (' + d.routes + ')');
  /* De dekking telt ALLE routes, het dossier alleen het API-vlak -- bouw() rekent
     over /api/. Het dossier hoort dus kleiner te zijn, maar niet veel: er zijn
     maar een handvol pagina-routes. Loopt dit verder uiteen dan een handvol, dan
     is er een tweede populatie ontstaan en dat is precies wat hier niet mag. */
  const verschil = dek.totaal - d.routes;
  assert.ok(verschil >= 0 && verschil <= 20,
    'dekking telt ' + dek.totaal + ', dossier ' + d.routes + ' (verschil ' + verschil +
    '); dat hoort alleen de pagina-routes buiten /api/ te zijn');
  assert.match(d.herkomst, /router van deze server/,
    'de routelijst komt uit DEZE server en niet uit een tweede die erbij wordt gestart');
  assert.equal(d.gedegradeerd, false);
});

test('3. de elf schakels komen uit de motor, met hun uitleg', async () => {
  const d = (await vraag({ limiet: 1 })).body;
  assert.equal(d.schakels.length, 11);
  const ids = d.schakels.map(s => s.id);
  for (const nodig of ['AUTH', 'ACL', 'INPUT', 'OUTPUT', 'STATE', 'AUDIT', 'PRIVACY']) {
    assert.ok(ids.includes(nodig), nodig + ' hoort erbij');
  }
  for (const s of d.schakels) {
    assert.ok(s.uitleg && s.uitleg.length > 10, s.id + ' hoort een uitleg te dragen');
  }
  assert.equal(d.cellen, d.routes * 11, 'cellen = routes x schakels');
});

test('4. GEEN INSTRUMENT is iets anders dan NIET GEMETEN, en het antwoord zegt dat', async () => {
  /* Toen deze toets werd geschreven stonden OUTPUT en AUDIT zonder instrument,
     en hield hij vast dat het antwoord dat gemis benoemde. Sindsdien hebben
     alle elf assen een meter (outputproef en auditproef waren de laatste twee);
     de toets is dus gekanteld: elke schakel hoort nu een bron te dragen. Het
     onderscheid zelf blijft bewaakt -- verliest een as zijn bron, dan gelden
     de oude eisen weer en zakt dit op de eigenschappen hieronder, niet stil. */
  const d = (await vraag({ limiet: 1 })).body;
  const zonder = d.schakels.filter(s => !s.bron);
  for (const s of zonder) {
    assert.ok(s.nodig && s.nodig.length > 20,
      s.id + ' heeft geen instrument en hoort te zeggen WAT er nodig is, niet alleen dat het ontbreekt');
    /* En de cijfers horen erbij te kloppen: geen instrument betekent geen enkele
       bewezen cel. Stond daar wel iets, dan meet er stilletjes toch iets mee. */
    assert.equal(d.perSchakel[s.id].bewezen, 0,
      s.id + ' heeft geen instrument maar meldt ' + d.perSchakel[s.id].bewezen + ' bewezen cellen');
    assert.equal(d.perSchakel[s.id].ongemeten, d.routes,
      s.id + ' hoort voor ELKE route ongemeten te zijn');
  }
  for (const s of d.schakels) {
    assert.ok(s.bron,
      s.id + ' had een instrument (alle elf assen hebben er sinds de OUTPUT-band een); ' +
      'is de bron uit scripts/bewijsmatrix.js gevallen?');
  }
});

test('5. een klik op een schakel filtert naar het OPENSTAANDE werk', async () => {
  const alles = (await vraag({ limiet: 1 })).body;
  const open = (await vraag({ schakel: 'ACL', limiet: 1 })).body;

  assert.ok(open.lijst.totaal < alles.lijst.totaal,
    'filteren op een schakel hoort de lijst korter te maken; nu ' + open.lijst.totaal +
    ' van ' + alles.lijst.totaal + ' -- staat er weer `!!r.cellen[schakel]`?');
  /* En het is niet zomaar korter: het is precies het niet-bewezen, niet-nvt deel. */
  const p = alles.perSchakel.ACL;
  assert.equal(open.lijst.totaal, alles.routes - p.bewezen - p.nvt,
    'het openstaande werk op ACL is alles behalve bewezen en nvt');

  // en schakel + staat samen is de scherpste vraag
  const ongemeten = (await vraag({ schakel: 'ACL', staat: 'ongemeten', limiet: 1 })).body;
  assert.equal(ongemeten.lijst.totaal, p.ongemeten,
    'ACL+ongemeten hoort precies de ongemeten cellen van die as te geven');
});

test('6. het dossier van EEN route draagt elf cellen met hun reden', async () => {
  const lijst = (await vraag({ limiet: 5 })).body.lijst.resultaten;
  assert.ok(lijst.length, 'er is een route om open te slaan');
  const eerste = lijst[0];

  const d = (await vraag({ methode: eerste.methode, pad: eerste.pad })).body;
  assert.equal(d.gevonden, true, 'de route uit de lijst is ook los op te vragen');
  assert.equal(Object.keys(d.route.cellen).length, 11);
  assert.equal(d.route.pad, eerste.pad);

  /* Elke cel draagt een STAAT, en een bewezen cel draagt bovendien wie het heeft
     gemeten. Zonder die bron is "bewezen" een bewering zonder afzender. */
  for (const [as, c] of Object.entries(d.route.cellen)) {
    assert.ok(c.staat, as + ' hoort een staat te dragen');
    if (c.staat === 'bewezen') {
      assert.ok(c.bron, as + ' staat op bewezen maar noemt geen bron');
    }
  }

  const weg = (await vraag({ methode: 'POST', pad: '/api/dit-bestaat-niet-xyz' })).body;
  assert.equal(weg.gevonden, false, 'een onbekende route levert geen half dossier op');
});
