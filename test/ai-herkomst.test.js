/* De herkomst van een antwoord hoort bij de AANROEP, niet bij de keten.

   Wat hier werd gerepareerd: het label onder een Rahul-antwoord kwam uit de
   CONFIGURATIE (./ai-stand.js beschikbaarheid), en de keten hield de laatst
   gebruikte aanbieder bij op een gedeeld object (`client.actief`). Bij twee
   gelijktijdige vragen kon het ene antwoord dus de herkomst van het andere
   krijgen. Deze toets laat twee verzoeken tegelijk door DEZELFDE keten lopen --
   het ene antwoordt op de eigen modelserver, het andere wijkt uit naar een
   externe aanbieder -- en eist dat elk verzoek alleen zijn eigen plaats ziet.

   En de naam: `op-dit-apparaat` betekende "de server van RTG", en werd aan het
   lid getoond als "deze Mac". `toestel` is gereserveerd voor de browser van het
   lid (TOESTEL.md) en mag door de server nooit worden beweerd.
   Draai los: node --test test/ai-herkomst.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const { maakAI } = require('../server/ai');
const aiContext = require('../server/ai-context');
const { uitgevoerd, beschikbaarheid } = require('../server/ai-stand');

function nepServer(afhandelaar) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const brok = [];
      req.on('data', c => brok.push(c));
      req.on('end', async () => {
        let body = {}; try { body = JSON.parse(Buffer.concat(brok).toString()); } catch (e) {}
        const uit = await afhandelaar(body);
        res.statusCode = uit.status || 200;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(uit.json || {}));
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, base: 'http://127.0.0.1:' + srv.address().port }));
  });
}

const tekstVan = body => JSON.stringify(body.messages || []);
const antwoord = t => ({ json: { choices: [{ message: { content: t }, finish_reason: 'stop' }] } });

test('1. twee gelijktijdige verzoeken zien elk alleen hun eigen uitvoerplaats', async () => {
  /* De eigen modelserver: vraag B faalt meteen, vraag A antwoordt pas als B
     helemaal klaar is. Dat is een VOLGORDE op toestand en geen wachttijd: een
     toets die een race bewijst met een klok, bewijst een race met een race
     (test/klokwacht.test.js). */
  let laatALos;
  const bKlaar = new Promise((r) => { laatALos = r; });
  const lokaal = await nepServer(async (body) => {
    if (tekstVan(body).includes('vraag-A')) { await bKlaar; return antwoord('lokaal A'); }
    return { status: 500, json: { error: 'uit' } };
  });
  const extern = await nepServer(async () => antwoord('extern B'));
  try {
    const ai = maakAI({
      localUrl: lokaal.base, local: { baseURL: lokaal.base, model: 'rtg-local', maxRetries: 0 },
      openaiKey: 'sk-o', openai: { apiKey: 'sk-o', baseURL: extern.base, maxRetries: 0 },
      volgorde: 'local,openai'
    });
    const vraag = (id) => aiContext.inContext({ ip: '10.0.0.' + id.length, req: null }, async () => {
      await ai.messages.create({ model: 'x', max_tokens: 20, messages: [{ role: 'user', content: id }] });
      return uitgevoerd();
    });
    const pa = vraag('vraag-A');
    const b = await vraag('vraag-B');
    laatALos();
    const a = await pa;

    assert.deepEqual(a.plaatsen, ['rtg-server'], 'A antwoordde op de eigen modelserver');
    assert.equal(a.extern, false, 'A mag niet de externe uitwijk van B erven');
    assert.deepEqual(b.plaatsen, ['externe-provider'], 'B week uit naar extern');
    assert.equal(b.extern, true);
    // Het gedeelde veld zegt iets over de LAATSTE aanroep van de keten, en dat is
    // A (die wachtte op B). Wie daar de herkomst van B uit leest, zit ernaast --
    // precies waarom het geen herkomst is.
    assert.equal(ai.actief, 'local');
  } finally { lokaal.srv.close(); extern.srv.close(); }
});

test('2. zonder modelaanroep is het antwoord "zonder model", geen lege of geraden plaats', () => {
  const buiten = uitgevoerd();
  assert.equal(buiten.zonderModel, true);
  assert.deepEqual(buiten.plaatsen, []);
  const binnen = aiContext.inContext({ ip: '1', req: null }, () => uitgevoerd());
  assert.equal(binnen.zonderModel, true, 'een verzoek zonder modelaanroep draagt geen herkomst');
  // noteren buiten een verzoek hangt nergens aan, en lekt dus ook niet naar het volgende
  aiContext.noteerUitvoering('local', 'rtg-server');
  assert.equal(uitgevoerd().zonderModel, true);
});

test('3. de eigen modelserver heet rtg-server, en de server beweert nooit "toestel"', () => {
  const ai = maakAI({ localUrl: 'http://127.0.0.1:11434', local: { model: 'rtg-local' }, externUit: true });
  const s = beschikbaarheid(ai);
  assert.equal(s.verwerking, 'rtg-server');
  assert.doesNotMatch(JSON.stringify(s), /op-dit-apparaat|deze Mac|toestel/i,
    'de server van RTG is niet het apparaat van het lid');
});
