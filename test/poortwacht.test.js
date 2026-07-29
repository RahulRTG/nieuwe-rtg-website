/* De poortwacht-bevindingen, vastgelegd zodat ze niet terugkruipen.

   scripts/poortwacht.js klopt anoniem aan bij alle 2496 geregistreerde
   API-routes. 2220 weigerden netjes, 244 sloegen stil af, en van de 25 die
   opendeden bleken er twee niet te kloppen. Die twee staan hieronder.

   1. DE BETAAL-WEBHOOK NAM ONONDERTEKENDE BERICHTEN AAN.
      In server/betaal.js stond in het commentaar "zet in productie altijd een
      secret". Daar hing niets van af: zonder secret viel de code door naar
      JSON.parse en gaf het bericht terug als geverifieerde waarheid. Wie het
      adres van de webhook kende, kon zelf "betaald" roepen. En de
      configuratiecontrole vroeg er niet eens naar.

   2. HET VERTAAL-ENDPOINT WAS EEN OPEN DOORGEEFLUIK NAAR DE AI-AANBIEDER.
      /api/translate had geen inlog en geen rem. Met een echte sleutel betekent
      dat: iedereen kan onbeperkt op onze rekening laten vertalen, en elke
      ingetypte zin gaat naar een derde partij (vaak buiten de EU) zonder dat
      daar een lid tegenover staat.

   Draai los: node --experimental-sqlite --test test/poortwacht.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../server/config');

const PROD = {
  NODE_ENV: 'production',
  RTG_ENC_KEY: 'e'.repeat(64), RTG_VAULT_KEY: 'v'.repeat(64), RTG_SECRET_KEY: 's'.repeat(64),
  OFFICE_CODE: 'KEURING-CODE-12', APP_URL: 'https://rtg.example.com', RTG_OWNER_EMAIL: 'eigenaar@echt.nl'
};

test('1. betaalsleutel zonder webhook-secret blokkeert de productiestart', () => {
  const zonder = config.valideer({ ...PROD, STRIPE_SECRET_KEY: 'sk_live_voorbeeld' });
  assert.ok(zonder.fouten.some(f => /STRIPE_WEBHOOK_SECRET/.test(f)),
    'echt geld zonder ondertekende webhook hoort een blokkerende fout te zijn, geen waarschuwing');

  const met = config.valideer({ ...PROD, STRIPE_SECRET_KEY: 'sk_live_voorbeeld', STRIPE_WEBHOOK_SECRET: 'whsec_voorbeeld' });
  assert.ok(!met.fouten.some(f => /STRIPE_WEBHOOK_SECRET/.test(f)), 'mét secret is er niets aan de hand');

  // en zonder betaalsleutel (demo-stand) hoort de eis niet te gelden
  const demo = config.valideer(PROD);
  assert.ok(!demo.fouten.some(f => /STRIPE_WEBHOOK_SECRET/.test(f)), 'demo-stand vraagt niet om een webhook-secret');
});

test('2. de webhook weigert in productie een bericht zonder handtekening', () => {
  // betaal.js leest het secret bij het laden; een verse require met een schone
  // omgeving geeft dus de situatie "productie, geen secret ingesteld".
  const oudEnv = process.env.NODE_ENV, oudSecret = process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete require.cache[require.resolve('../server/betaal')];
  const betaal = require('../server/betaal');
  try {
    process.env.NODE_ENV = 'production';
    assert.throws(() => betaal.verifieerWebhook(Buffer.from('{"type":"betaald"}'), ''),
      /niet te vertrouwen/, 'onondertekend in productie: weigeren, niet aannemen');

    // buiten productie mag de doorval blijven: daar draait alles op demo-geld en
    // zou een verplicht secret elke lokale start blokkeren
    process.env.NODE_ENV = 'test';
    const evt = betaal.verifieerWebhook(Buffer.from('{"type":"betaald"}'), '');
    assert.equal(evt.type, 'betaald', 'lokaal blijft het werken');
  } finally {
    process.env.NODE_ENV = oudEnv;
    if (oudSecret !== undefined) process.env.STRIPE_WEBHOOK_SECRET = oudSecret;
    delete require.cache[require.resolve('../server/betaal')];
  }
});

test('3. vertalen zonder inlog raakt de AI-aanbieder niet', async () => {
  const i18n = require('../server/translate');
  let geraakt = 0;
  // een nagemaakte aanbieder: als hij wordt aangeroepen, telt hij dat
  i18n.setAnthropic({ messages: { create: async () => { geraakt++; return { content: [{ text: 'x' }] }; } } });
  try {
    // een taal die het woordenboek niet kent, zodat alleen de AI-weg overblijft
    await i18n.translate('een volstrekt onbekende zin voor de test', 'ja', 'nl', { ai: false });
    assert.equal(geraakt, 0, 'zonder inlog gaat er niets naar de aanbieder');

    await i18n.translate('een tweede volstrekt onbekende zin voor de test', 'ja', 'nl', { ai: true });
    assert.equal(geraakt, 1, 'mét inlog wel -- de functie zelf werkt gewoon');
  } finally { i18n.setAnthropic(null); }
});
