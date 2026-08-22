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
  RTG_HERSTEL_SMS_UIT_BEWUST:'1'
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
