'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const { keurCommunicatie }=require('../server/config/productie-communicatie');

const basis=() => ({
  SMTP_URL:'smtps://smtp.example.test:465',
  RTG_MAIL_PUBLIEK_BASIS:'rahultravelgroup.com',
  MAIL_PROVIDER_DKIM:'1',
  MAIL_INBOUND_PROVIDER:'aws-ses',
  SES_INBOUND_SECRET:'x'.repeat(40),
  RTG_HERSTEL_SMS_UIT_BEWUST:'1',
  TURN_URL:'turns:turn.rtg.example:5349',
  TURN_SECRET:'t'.repeat(48)
});
const keur=env => {
  const fouten=[], waarschuwingen=[];
  keurCommunicatie(env, fouten, waarschuwingen, false);
  return { fouten, waarschuwingen };
};

test('publieke mail met provider-DKIM en ondertekende SES-brug is productieklaar', () => {
  const r=keur(basis());
  assert.deepEqual(r.fouten, []);
  assert.equal(r.waarschuwingen.some(x => /ondertekent smarthost-mail niet/.test(x)), false);
});

test('publieke mail faalt dicht zonder inkomende route of sterk SES-geheim', () => {
  const geenRoute=basis(); delete geenRoute.MAIL_INBOUND_PROVIDER;
  assert.equal(keur(geenRoute).fouten.some(x => /inkomende mailroute/.test(x)), true);
  const zwak=basis(); zwak.SES_INBOUND_SECRET='kort';
  assert.equal(keur(zwak).fouten.some(x => /minstens 32/.test(x)), true);
});

test('publieke Connection-calls vereisen een echte TURN-keten', () => {
  const zonder=basis(); delete zonder.TURN_URL; delete zonder.TURN_SECRET;
  const dicht=keur(zonder);
  assert.equal(dicht.fouten.some(x => /TURN_URL ontbreekt/.test(x)), true);
  assert.equal(dicht.fouten.some(x => /TURN-authenticatie/.test(x)), true);

  const zwak=basis(); zwak.TURN_SECRET='kort';
  assert.equal(keur(zwak).fouten.some(x => /TURN-authenticatie/.test(x)), true);

  const vast=basis(); delete vast.TURN_SECRET;
  vast.TURN_USER='rtg'; vast.TURN_PASS='p'.repeat(48);
  assert.equal(keur(vast).fouten.some(x => /TURN/.test(x)), false);
});

test('publieke productie staat geen stille Google-STUN-uitgang toe', () => {
  const env=basis(); env.STUN_FALLBACK_GOOGLE='1';
  assert.equal(keur(env).fouten.some(x => /STUN_FALLBACK_GOOGLE/.test(x)), true);
});
