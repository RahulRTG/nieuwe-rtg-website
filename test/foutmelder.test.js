/* Eigen externe fout-melder (server/foutmelder.js), die @sentry/node verving.
   We draaien tegen een lokale nep-webhook en controleren: er gaat een nette
   JSON-POST uit met de fout + context, dezelfde fout wordt binnen het venster
   niet nog eens verstuurd (temperen), en zonder URL gebeurt er niets (en gooit
   het nooit). Los: node --test test/foutmelder.test.js */
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { maakFoutmelder } = require('../server/foutmelder');

function nepWebhook() {
  const ontvangen = [];
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const b = []; req.on('data', c => b.push(c));
      req.on('end', () => { try { ontvangen.push(JSON.parse(Buffer.concat(b).toString())); } catch (e) {} res.writeHead(200); res.end('{}'); });
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, poort: srv.address().port, ontvangen }));
  });
}
const wacht = ms => new Promise(r => setTimeout(r, ms));

test('stuurt een JSON-POST met de fout + context naar de webhook', async () => {
  const { srv, poort, ontvangen } = await nepWebhook();
  try {
    // localhost = een bewuste interne collector: intern:true (anders weigert de
    // SSRF-poort een privé-adres, precies zoals bedoeld).
    const m = maakFoutmelder({ url: 'http://127.0.0.1:' + poort + '/hook', app: 'rtg-test', intern: true });
    assert.strictEqual(m.actief, true);
    m.melden(new Error('kapot ding'), { p: '/api/x', id: 'abc' });
    for (let i = 0; i < 50 && ontvangen.length === 0; i++) await wacht(20);
    assert.strictEqual(ontvangen.length, 1);
    assert.strictEqual(ontvangen[0].app, 'rtg-test');
    assert.strictEqual(ontvangen[0].fout, 'kapot ding');
    assert.strictEqual(ontvangen[0].context.p, '/api/x');
    assert.ok(ontvangen[0].stack.includes('kapot ding'));
  } finally { srv.close(); }
});

test('tempert: dezelfde fout gaat binnen het venster maar één keer uit', async () => {
  const { srv, poort, ontvangen } = await nepWebhook();
  try {
    const m = maakFoutmelder({ url: 'http://127.0.0.1:' + poort + '/hook', vensterMs: 60000, intern: true });
    m.melden(new Error('zelfde'), { p: '/a' });
    m.melden(new Error('zelfde'), { p: '/a' });
    m.melden(new Error('zelfde'), { p: '/a' });
    for (let i = 0; i < 30 && ontvangen.length < 1; i++) await wacht(20);
    await wacht(120);
    assert.strictEqual(ontvangen.length, 1, 'drie keer gemeld, één keer verstuurd');
    // een ANDERE fout gaat wél door
    m.melden(new Error('anders'), { p: '/b' });
    for (let i = 0; i < 30 && ontvangen.length < 2; i++) await wacht(20);
    assert.strictEqual(ontvangen.length, 2);
  } finally { srv.close(); }
});

test('zonder URL: inert en gooit nooit', () => {
  const m = maakFoutmelder({ url: '' });
  assert.strictEqual(m.actief, false);
  assert.doesNotThrow(() => m.melden(new Error('x'), {}));
});

test('SSRF-poort: een privé/metadata-webhook wordt geweigerd (melder inert)', () => {
  const stil = { warn() {} };
  // standaard streng: elk privé-adres wordt geweigerd
  assert.strictEqual(maakFoutmelder({ url: 'http://10.0.0.5/hook', log: stil }).actief, false);
  // cloud-metadata wordt ALTIJD geweigerd, ook met intern:true
  assert.strictEqual(maakFoutmelder({ url: 'http://169.254.169.254/latest/', log: stil }).actief, false);
  assert.strictEqual(maakFoutmelder({ url: 'http://169.254.169.254/latest/', intern: true, log: stil }).actief, false);
  // een gewone publieke https-webhook mag wel
  assert.strictEqual(maakFoutmelder({ url: 'https://hooks.slack.com/services/T/B/x', log: stil }).actief, true);
});

/* ONAFHANKELIJK IS EEN OORDEEL MET DRIE UITKOMSTEN.

   Hier stond `let onafhankelijk = true` met een try/catch eromheen: elke fout in
   de berekening -- APP_URL niet gezet, APP_URL zonder schema -- liet de waarde
   op `true` staan, en een ontvanger die deze app ZELF is telde dan als externe
   bewaking. Het alarmbord noemde daarna "de externe webhook (ERR_WEBHOOK_URL)"
   als uitgang terwijl er bij een volledige app- of hostuitval niets afgaat.

   Het oordeel hangt nu voorop aan protocol.eigenEndpoint() -- dezelfde bron die
   server/config/productie.js gebruikt, en die geen APP_URL nodig heeft -- en
   valt bij twijfel DICHT op `null` met de reden erbij. */
test('onafhankelijkheid staat vast, is weerlegd, of is niet vast te stellen -- nooit stil "ja"', () => {
  const stil = { warn: () => {} };
  const sleutel = 'a'.repeat(64);
  const stand = (o) => maakFoutmelder(Object.assign({ sleutel, log: stil }, o)).stand();

  const buiten = stand({ url: 'https://hooks.voorbeeld.test/x', appUrl: 'https://app.rtg.test' });
  assert.strictEqual(buiten.onafhankelijk, true, 'een echte externe webhook is bewezen onafhankelijk');
  assert.strictEqual(buiten.beperking, null, 'en draagt dan geen beperking');

  /* Het eigen endpoint, ook zonder APP_URL om mee te vergelijken: het PAD is
     genoeg, en juist dit geval liep vroeger als "onafhankelijk" binnen. */
  for (const appUrl of ['https://app.rtg.test', '', 'app.rtg.test']) {
    const eigen = stand({ url: 'https://app.rtg.test/api/webhooks/storingen', appUrl });
    assert.strictEqual(eigen.onafhankelijk, false,
      'de eigen storingenwebhook is nooit onafhankelijk, ook niet met APP_URL = ' + JSON.stringify(appUrl));
    assert.match(eigen.beperking, /hostuitval/);
  }

  /* Een loopback-ontvanger draait op een andere HERKOMST en kwam er daarom
     vroeger als "extern" doorheen -- terwijl het dezelfde machine is. */
  const lokaal = stand({ url: 'http://127.0.0.1:3000/api/webhooks/storingen', appUrl: 'https://app.rtg.test', intern: true });
  assert.strictEqual(lokaal.onafhankelijk, false, 'een loopback-ontvanger van onszelf is geen externe bewaking');

  const zelfde = stand({ url: 'https://app.rtg.test/intern/meld', appUrl: 'https://app.rtg.test' });
  assert.strictEqual(zelfde.onafhankelijk, false, 'dezelfde herkomst is dezelfde app');
  assert.match(zelfde.beperking, /dezelfde app/);

  /* Niet vast te stellen is een eigen uitslag en geen "ja": zonder bruikbare
     APP_URL weten we het niet, en dan zegt het bord dat ook. */
  const onbekend = stand({ url: 'https://hooks.voorbeeld.test/x', appUrl: 'niet-een-adres' });
  assert.strictEqual(onbekend.onafhankelijk, null, 'zonder bruikbare APP_URL is het oordeel onbekend');
  assert.match(onbekend.beperking, /niet vast te stellen/);
});
