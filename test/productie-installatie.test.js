'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  leesEnvTekst, werkEnvTekstBij, schrijfAtoom, valideerKeuzes, samenvatting
} = require('../scripts/productie-installatie');

test('productiewizard bewaart commentaar, vervangt waarden en verwijdert dubbele waarheid', () => {
  const bron = '# uitleg\nAPP_URL=https://oud.example\nAPP_URL=https://dubbel.example\nSMTP_URL=smtps://oud\n';
  const tekst = werkEnvTekstBij(bron, { APP_URL: 'https://rtg.example', REDIS_URL: 'rediss://redis.example' });
  assert.match(tekst, /^# uitleg/m);
  assert.equal((tekst.match(/^APP_URL=/gm) || []).length, 1);
  assert.equal(leesEnvTekst(tekst).APP_URL, 'https://rtg.example');
  assert.equal(leesEnvTekst(tekst).SMTP_URL, 'smtps://oud');
  assert.equal(leesEnvTekst(tekst).REDIS_URL, 'rediss://redis.example');
});

test('productiewizard weigert regelinjectie en onveilige productieadressen', () => {
  assert.throws(() => werkEnvTekstBij('', { SMTP_URL: 'smtps://goed\nRTG_DEMO=1' }), /regelovergang/);
  const fouten = valideerKeuzes({
    RTG_OWNER_EMAIL: 'geen-email', APP_URL: 'http://rtg.example',
    DATABASE_URL: 'mysql://db', REDIS_URL: 'http://redis', SMTP_URL: 'file:///tmp/mail',
    ERR_WEBHOOK_URL: 'http://alarm', RTG_BACKUP_DIR: 'relatief',
    RTG_MOTOR_STATE_KEY_FILE: 'relatief.key', RTG_MOTOR_EXPECT_GENESIS: 'g-fout'
  });
  assert.ok(fouten.length >= 9);
});

test('atomair geschreven geheimenbestand krijgt uitsluitend eigenaarsrechten', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-installatie-'));
  const doel = path.join(map, '.env.productie');
  schrijfAtoom(doel, 'NODE_ENV=production\n');
  assert.equal(fs.readFileSync(doel, 'utf8'), 'NODE_ENV=production\n');
  assert.equal(fs.statSync(doel).mode & 0o777, 0o600);
  schrijfAtoom(doel, 'NODE_ENV=production\nAPP_URL=https://rtg.example\n');
  assert.match(fs.readFileSync(doel, 'utf8'), /APP_URL=https:\/\/rtg\.example/);
});

test('samenvatting lekt geen SMTP-, Stripe- of S3-geheimen', () => {
  const regels = samenvatting({
    APP_URL: 'https://rtg.example', SMTP_URL: 'smtps://user:zeer-geheim@mail.example',
    STRIPE_SECRET_KEY: 'sk_live_geheim', STRIPE_WEBHOOK_SECRET: 'whsec_geheim',
    RTG_MEDIA_S3_KEY: 'toegang', RTG_MEDIA_S3_SECRET: 'opslaggeheim'
  });
  const tekst = JSON.stringify(regels);
  for (const geheim of ['zeer-geheim', 'sk_live_geheim', 'whsec_geheim', 'toegang', 'opslaggeheim']) assert.equal(tekst.includes(geheim), false);
});
