/* ============================================================================
   DE POORT VOOR DE EIGEN MODELSERVER.

   Een externe aanbieder schaalt mee; een eigen modelserver niet. Die doet er
   twee, misschien vier tegelijk, en daarboven wordt hij niet langzamer maar
   STUK: alles kruipt, alles loopt in de timeout, en de uitwijkketen stuurt
   vervolgens ALLES naar de betaalde aanbieder. De rekening ziet dat eerder dan
   een mens, en ondertussen verlaat de inhoud wel het huis.

   Twee kleppen, en dit bestand bewaakt ze allebei -- met een echte nagemaakte
   modelserver, want een poort die je niet hebt zien dichtgaan is geen poort:

     1. HOEVEEL TEGELIJK, met een wachtrij en een grens aan het wachten. Een lid
        drie minuten laten wachten is erger dan uitwijken.
     2. WANNEER WE HET OPGEVEN. Na een paar storingen op rij slaan we lokaal
        over in plaats van elke keer de volle timeout te betalen -- en daarna
        mag er weer een verzoek langs om te kijken of hij terug is.

   Draai los: node --test test/lokale-ai-poort.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const LocalAI = require('../server/local-ai');

/* Een nagemaakte OpenAI-compatibele modelserver. `gedrag` bepaalt per verzoek
   wat hij doet, zodat een toets traagheid en storing kan naspelen. */
function maakModelserver(gedrag) {
  let inFlight = 0, maxInFlight = 0, aantal = 0;
  const server = http.createServer((req, res) => {
    inFlight++; aantal++;
    if (inFlight > maxInFlight) maxInFlight = inFlight;
    const klaar = (status, body) => {
      inFlight--;
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const wat = gedrag(aantal);
    const antwoord = { choices: [{ message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 5 } };
    if (wat.stuk) return setTimeout(() => klaar(500, { error: 'kapot' }), wat.traag || 0);
    setTimeout(() => klaar(200, antwoord), wat.traag || 0);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () =>
    r({ server, poort: server.address().port, telling: () => ({ maxInFlight, aantal }) })));
}

const maakClient = (poort, opts) => new LocalAI(Object.assign({
  baseURL: 'http://127.0.0.1:' + poort, model: 'testmodel', maxRetries: 0, timeout: 3000
}, opts));

test('1. niet meer tegelijk naar de modelserver dan is afgesproken', async () => {
  const s = await maakModelserver(() => ({ traag: 120 }));
  try {
    const c = maakClient(s.poort, { gelijktijdig: 2, wachtMs: 5000 });
    await Promise.all(Array.from({ length: 8 }, () =>
      c.messages.create({ max_tokens: 50, messages: [{ role: 'user', content: 'hoi' }] })));
    const t = s.telling();
    assert.equal(t.aantal, 8, 'alle acht zijn uiteindelijk gedaan');
    assert.ok(t.maxInFlight <= 2, 'nooit meer dan twee tegelijk, gemeten: ' + t.maxInFlight);
  } finally { s.server.close(); }
});

test('2. wie te lang moet wachten geeft op, zodat de keten kan uitwijken', async () => {
  const s = await maakModelserver(() => ({ traag: 400 }));
  try {
    const c = maakClient(s.poort, { gelijktijdig: 1, wachtMs: 30 });
    const uitkomsten = await Promise.allSettled(Array.from({ length: 4 }, () =>
      c.messages.create({ max_tokens: 50, messages: [{ role: 'user', content: 'hoi' }] })));
    const opgegeven = uitkomsten.filter(u => u.status === 'rejected' && u.reason && u.reason.code === 'LOKAAL_BEZET');
    assert.ok(opgegeven.length >= 2, 'de wachtenden geven op in plaats van eindeloos te blijven staan');
    assert.ok(uitkomsten.some(u => u.status === 'fulfilled'), 'en wie wel een plek kreeg wordt gewoon bediend');
  } finally { s.server.close(); }
});

test('3. na een paar storingen slaan we lokaal over in plaats van te wachten', async () => {
  const s = await maakModelserver(() => ({ stuk: true }));
  try {
    const c = maakClient(s.poort, { storingsgrens: 3, herstelMs: 10000, wachtMs: 1000 });
    assert.equal(c.kan({}), true, 'eerst doet hij gewoon mee');
    for (let i = 0; i < 3; i++) {
      await assert.rejects(() => c.messages.create({ max_tokens: 50, messages: [{ role: 'user', content: 'hoi' }] }));
    }
    assert.equal(c.kan({}), false, 'na drie storingen slaat de keten hem over');
    assert.equal(c.staat().onderbroken, true);
    /* En dan betaalt een volgend verzoek ook geen timeout meer. */
    await assert.rejects(
      () => c.messages.create({ max_tokens: 50, messages: [{ role: 'user', content: 'hoi' }] }),
      (e) => e.code === 'LOKAAL_ONDERBROKEN');
  } finally { s.server.close(); }
});

test('4. na het herstelvenster mag er weer een verzoek langs', async () => {
  let stuk = true;
  const s = await maakModelserver(() => ({ stuk }));
  try {
    const c = maakClient(s.poort, { storingsgrens: 2, herstelMs: 40, wachtMs: 1000 });
    for (let i = 0; i < 2; i++) {
      await assert.rejects(() => c.messages.create({ max_tokens: 50, messages: [{ role: 'user', content: 'hoi' }] }));
    }
    assert.equal(c.kan({}), false, 'de klep staat open');
    await new Promise(r => setTimeout(r, 60));
    assert.equal(c.kan({}), true, 'na het venster mag er weer een langs');
    // en als hij het weer doet, gaat de klep dicht en blijft hij dicht
    stuk = false;
    await c.messages.create({ max_tokens: 50, messages: [{ role: 'user', content: 'hoi' }] });
    assert.equal(c.staat().storingen, 0, 'een geslaagde aanroep wist de storingen');
    assert.equal(c.kan({}), true);
  } finally { s.server.close(); }
});

test('5. een geslaagde aanroep tussendoor zet de teller terug', async () => {
  let stuk = true;
  const s = await maakModelserver(() => ({ stuk }));
  try {
    const c = maakClient(s.poort, { storingsgrens: 3, herstelMs: 10000, wachtMs: 1000 });
    await assert.rejects(() => c.messages.create({ max_tokens: 50, messages: [{ role: 'user', content: 'hoi' }] }));
    await assert.rejects(() => c.messages.create({ max_tokens: 50, messages: [{ role: 'user', content: 'hoi' }] }));
    assert.equal(c.staat().storingen, 2);
    stuk = false;
    await c.messages.create({ max_tokens: 50, messages: [{ role: 'user', content: 'hoi' }] });
    assert.equal(c.staat().storingen, 0, 'twee losse hikjes zijn geen storing');
    assert.equal(c.kan({}), true, 'en de klep blijft dicht');
  } finally { s.server.close(); }
});

test('6. de poort laat de bestaande capability-regels intact', async () => {
  const s = await maakModelserver(() => ({}));
  try {
    const zonderBeeld = maakClient(s.poort, {});
    const beeldVraag = { messages: [{ role: 'user', content: [{ type: 'image' }, { type: 'text', text: 'x' }] }] };
    assert.equal(zonderBeeld.kan(beeldVraag), false, 'geen vision-model = geen beeld claimen');
    const metBeeld = maakClient(s.poort, { visionModel: 'ogen' });
    assert.equal(metBeeld.kan(beeldVraag), true);
    const zonderTools = maakClient(s.poort, { tools: false });
    assert.equal(zonderTools.kan({ tools: [{ name: 'doe' }] }), false, 'tools uit = geen tools claimen');
  } finally { s.server.close(); }
});

test('7. nul is een antwoord en geen leegte', async () => {
  /* Hier stond `Number(x) || standaard`, en daarmee werd LOCAL_AI_WACHT_MS=0
     stilletjes 20000 -- terwijl nul juist iets zegt: "niet in de rij, meteen
     uitwijken". Wie dat zette kreeg het tegenovergestelde, zonder melding. */
  const s = await maakModelserver(() => ({ traag: 300 }));
  try {
    const nul = maakClient(s.poort, { wachtMs: 0, herstelMs: 0 });
    assert.equal(nul.wachtMs, 0, 'een expliciete nul blijft nul');
    assert.equal(nul.herstelMs, 0);

    const leeg = maakClient(s.poort, {});
    assert.equal(leeg.wachtMs, 20000, 'niets gezet = de standaard');
    assert.equal(leeg.herstelMs, 30000);
    assert.equal(leeg.gelijktijdig, 2);

    const onzin = maakClient(s.poort, { wachtMs: 'geen getal', gelijktijdig: -5 });
    assert.equal(onzin.wachtMs, 20000, 'onzin valt terug op de standaard');
    assert.equal(onzin.gelijktijdig, 1, 'en een negatief aantal wordt naar het minimum getild');

    /* En het GEDRAG erachter: met wachtMs 0 gaat de tweede aanvrager niet in de
       rij maar meteen door, zodat de keten kan uitwijken. */
    const c = maakClient(s.poort, { gelijktijdig: 1, wachtMs: 0 });
    const eerste = c.messages.create({ max_tokens: 50, messages: [{ role: 'user', content: 'hoi' }] });
    await assert.rejects(
      () => c.messages.create({ max_tokens: 50, messages: [{ role: 'user', content: 'hoi' }] }),
      (e) => e.code === 'LOKAAL_BEZET', 'de tweede wacht niet, hij wijkt uit');
    await eerste;
  } finally { s.server.close(); }
});
