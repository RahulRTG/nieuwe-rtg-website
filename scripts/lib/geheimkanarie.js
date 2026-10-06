/* De kanaries voor test/geheimkanarie.test.js: per ronde nieuwe, herkenbare
   nepgeheimen in de vorm die het echte geheim heeft (een sk_test_, een whsec_,
   een wachtwoord in een URL), zodat een redactie die op vorm let ze ziet zoals
   ze het echte geheim zou zien. Een vaste kanarie zou in een bestand kunnen
   belanden en dan altijd "gevonden" worden; daarom per ronde willekeurig. */
'use strict';

const crypto = require('crypto');

function kanaries() {
  const r = n => 'Kanarie' + n + crypto.randomBytes(6).toString('hex');
  const env = {
    STRIPE_SECRET_KEY: 'sk_test_' + r('stripe'),
    STRIPE_WEBHOOK_SECRET: 'whsec_' + r('wh'),
    MOLLIE_API_KEY: 'test_' + r('mollie'),
    ADYEN_API_KEY: r('adyen'),
    ADYEN_HMAC_KEY: r('hmac'),
    ERR_WEBHOOK_SECRET: r('errgeheim'),
    SMTP_URL: 'smtps://post:' + r('smtp') + '@127.0.0.1:1',
    LOCAL_AI_URL: 'http://tok:' + r('localai') + '@127.0.0.1:1',
    LOCAL_AI_KEY: r('localkey'),
    LOCAL_AI_MODEL: 'x',
    RTG_SECRET_KEY: r('secret') + 'abcdefghijklmnopqrstuvwxyz012345',
    RTG_VAULT_KEY: r('vault') + 'abcdefghijklmnopqrstuvwxyz012345',
    RTG_ENC_KEY: r('enc') + 'abcdefghijklmnopqrstuvwxyz012345',
    RTG_MEDIA_S3_KEY: r('s3key'),
    RTG_MEDIA_S3_SECRET: r('s3geheim'),
    ANTHROPIC_API_KEY: 'sk-ant-' + r('anth')
  };
  const opslag = { redis: r('redis'), pg: r('pg') };
  const verzoek = { bearer: r('bearer'), cookie: r('cookie'), apikey: r('apikey'), wachtwoord: r('wachtwoord'),
    token: r('token'), url: r('inurl') };
  /* Wat er gezocht wordt is het ONDERSCHEIDENDE deel: de kanarie zelf, niet het
     voorvoegsel dat een redactie mag laten staan (sk_test_ zonder rest is geen
     geheim). */
  const kern = v => (String(v).match(/Kanarie[a-z0-9]+[a-f0-9]{12}/) || [String(v)])[0];
  const alle = [...Object.values(env), ...Object.values(opslag), ...Object.values(verzoek)]
    .filter(v => /Kanarie/.test(v)).map(kern);
  return { env, opslag, verzoek, alle: [...new Set(alle)] };
}

function scan(tekst, lijst) {
  const uit = [];
  const t = String(tekst || '');
  for (const k of lijst) {
    let i = t.indexOf(k);
    while (i >= 0) {
      uit.push({ kanarie: k, context: t.slice(Math.max(0, i - 80), i + k.length + 40).replace(/\s+/g, ' ') });
      if (uit.length > 50) return uit;
      i = t.indexOf(k, i + k.length);
    }
  }
  return uit;
}

module.exports = { kanaries, scan };
