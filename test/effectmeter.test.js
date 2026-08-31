/* DE EFFECTMETER: heeft dit verzoek werkelijk iets aangeraakt?

   De staatmeter (server/staatlog.js) kijkt naar de collecties in de database en
   ziet daarom een mail niet, een sms niet en een schrijfactie buiten die
   collecties evenmin. Op die blinde vlek zijn 1.194 routes blijven staan als
   LEGACY: "verandert niets" was er een gevolgtrekking uit AFWEZIG bewijs.

   Deze meter telt drie choke points (opslag, mail, sms) en NOEMT wat hij niet
   telt. Dat laatste is hier het zwaarst getoetst: een meter die zwijgt over zijn
   eigen gaten, is precies de geruststelling die het contractregister verbiedt.

   Draai los: node --test test/effectmeter.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const meter = require('../server/effectmeter');

test('uit is de stand die je krijgt als je niets doet', () => {
  meter.begin('');
  assert.equal(meter.aan, false);
  meter.perVerzoek(() => { meter.tel('opslag'); });
  assert.equal(meter.stand(), '', 'zonder vlag is er geen context en dus geen stand');
});

test('aan met de vlag van de staatmeter, en met geen andere', () => {
  assert.equal(meter.begin('1'), true);
  assert.equal(meter.begin('2'), true, 'stand 2 van de staatmeter zet hem ook aan');
  assert.equal(meter.begin('ja'), false, 'een willekeurige waarde is geen 1');
  assert.equal(meter.begin(undefined), false);
});

test('tellen binnen een verzoek, en de stand als korte tekst', () => {
  meter.begin('1');
  meter.perVerzoek(() => {
    meter.tel('opslag');
    meter.tel('opslag');
    meter.tel('mail');
    assert.equal(meter.stand(), 'opslag=2,mail=1');
  });
  meter.begin('');
});

test('geen spoor heet `geen` en niet leeg -- dat verschil is het hele punt', () => {
  meter.begin('1');
  meter.perVerzoek(() => {
    assert.equal(meter.stand(), 'geen', 'binnen een verzoek waar niets gebeurde: gemeten nul');
  });
  assert.equal(meter.stand(), '', 'buiten een verzoek: niet gemeten, en dat is iets anders');
  meter.begin('');
});

test('tellers zijn per verzoek en lekken niet naar elkaar', () => {
  meter.begin('1');
  meter.perVerzoek(() => {
    meter.tel('opslag');
    meter.perVerzoek(() => {
      assert.equal(meter.stand(), 'geen', 'een genest verzoek begint op nul');
    });
    assert.equal(meter.stand(), 'opslag=1');
  });
  meter.begin('');
});

test('buiten een verzoek telt niets -- achtergrondwerk hoort bij niemand', () => {
  meter.begin('1');
  meter.tel('opslag');           // mag niet gooien, mag niets doen
  meter.perVerzoek(() => { assert.equal(meter.stand(), 'geen'); });
  meter.begin('');
});

test('een onbekende soort wordt genegeerd en maakt geen veld bij', () => {
  meter.begin('1');
  meter.perVerzoek(() => {
    meter.tel('bestand');        // staat met naam in NIET_GEMETEN
    meter.tel('verzonnen');
    assert.equal(meter.stand(), 'geen', 'wat niet gemeten wordt, komt niet als nul in de stand');
  });
  meter.begin('');
});

test('wat hij niet meet, staat met naam in de module', () => {
  assert.deepEqual(meter.SOORTEN, ['opslag', 'mail', 'sms']);
  assert.deepEqual(meter.NIET_GEMETEN, ['bestand', 'externe-aanroep']);
  for (const s of meter.NIET_GEMETEN)
    assert.ok(!meter.SOORTEN.includes(s), s + ' kan niet tegelijk gemeten en ongemeten zijn');
});

test('de haak doet niets zonder de vlag', () => {
  meter.begin('');
  let gebruikt = 0;
  assert.equal(meter.haak({ use: () => { gebruikt++; } }), false);
  assert.equal(gebruikt, 0, 'uit betekent: geen middleware in de keten');
});

test('de haak zet beide koppen op het antwoord, en hangt aan res.end', () => {
  /* MUTATIEPROEF: hang hem terug aan res.json en deze toets zakt. res.end is de
     ENE uitgang: res.json en res.send lopen er allebei doorheen (zie
     server/web/verrijk.js). Aan res.json droegen 282 routes die met 200
     antwoordden geen kop -- gemeten, en dat is precies het soort stilte waar
     deze meter voor bestaat. */
  meter.begin('1');
  let mw = null;
  meter.haak({ use: (f) => { mw = f; } });
  const koppen = {};
  const res = { headersSent: false, setHeader: (k, v) => { koppen[k] = v; }, end: () => 'antwoord' };
  mw({}, res, () => { meter.tel('sms'); });
  assert.equal(res.end(), 'antwoord', 'de wikkel geeft het echte antwoord door');
  assert.equal(koppen['X-RTG-Effect'], 'sms=1');
  assert.equal(koppen['X-RTG-Effect-Niet-Gemeten'], 'bestand,externe-aanroep');
  meter.begin('');
});

test('de drie choke points roepen hem werkelijk aan', () => {
  /* MUTATIEPROEF: haal effectmeter.tel uit een van deze drie bestanden en deze
     toets zakt. Zonder deze toets is de meter een module die niemand aanroept. */
  const fs = require('fs');
  const plekken = {
    'server/db/index.js': "effectmeter.tel('opslag')",
    'server/mail.js': "require('./effectmeter').tel('mail')",
    'server/mail-lokaal.js': "require('./effectmeter').tel('sms')",
  };
  for (const [pad, regel] of Object.entries(plekken))
    assert.ok(fs.readFileSync(require('path').join(__dirname, '..', pad), 'utf8').includes(regel),
      pad + ' telt niet meer mee in de effectmeter');
});

test('de body-lezer houdt de async-context vast (over een echte socket)', async () => {
  /* DE OORZAAK ONDER DEZE METER, en de reden dat hij eerst `geen` meldde op een
     verzoek dat een heel account aanmaakte.

     Een luisteraar op een EventEmitter draait in de context van wie EMIT. De
     'end' van het verzoeklichaam komt uit de HTTP-parser, dus alles NA
     express.json() liep buiten elke async-context die de keten ervoor opende --
     niet alleen deze meter, ook de kostendrager van kern/kosten/haak.js.

     DIT MOET OVER EEN ECHTE SOCKET. Een nagebootste EventEmitter die zijn 'end'
     zelf uitzendt binnen de context, verliest niets: die toets slaagde ook
     zonder de reparatie en bewees dus niets. De parser is precies het stuk dat
     je niet kunt naspelen.

     MUTATIEPROEF: vervang AsyncResource.bind in server/web/body.js door de kale
     terugroep en deze toets zakt -- met precies het symptoom uit de praktijk. */
  const { AsyncLocalStorage } = require('async_hooks');
  const http = require('http');
  const web = require('../server/web');
  const als = new AsyncLocalStorage();

  const app = web();
  app.use((req, res, next) => als.run('de context', next));
  app.use(web.json());
  app.post('/proef', (req, res) => res.json({ binnen: als.getStore() || null, body: req.body }));

  const server = http.createServer(app);
  await new Promise(k => server.listen(0, k));
  const poort = server.address().port;
  try {
    const antwoord = await new Promise((klaar, stuk) => {
      const r = http.request({ port: poort, path: '/proef', method: 'POST',
        headers: { 'content-type': 'application/json' } }, (res) => {
        let t = ''; res.on('data', c => { t += c; }); res.on('end', () => klaar(JSON.parse(t)));
      });
      r.on('error', stuk);
      r.end('{"a":1}');
    });
    assert.deepEqual(antwoord.body, { a: 1 }, 'de body wordt gewoon gelezen');
    assert.equal(antwoord.binnen, 'de context',
      'na de body-lezer draait de route nog in de context die de keten ervoor opende');
  } finally { server.close(); }
});
