'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const { keurCommunicatie }=require('../server/config/productie-communicatie');
const turn=require('../server/config/turn');
const iceServers=require('../server/routes/social').iceServers;

const STERK='T9!relay-A7#tijdelijk-B4$geheim-C8%2026';

const basis=() => ({
  APP_URL:'https://app.rahultravelgroup.com',
  SMTP_URL:'smtps://smtp.example.test:465',
  RTG_MAIL_PUBLIEK_BASIS:'rahultravelgroup.com',
  MAIL_PROVIDER_DKIM:'1',
  MAIL_INBOUND_PROVIDER:'aws-ses',
  SES_INBOUND_SECRET:'x'.repeat(40),
  RTG_HERSTEL_SMS_UIT_BEWUST:'1',
  STUN_PUBLIC_HOST:'stun.rahultravelgroup.com',
  STUN_URL:'stun:stun.rahultravelgroup.com:3478',
  TURN_URL:'turns:turn.rahultravelgroup.com:5349?transport=tcp',
  TURN_SECRET:STERK
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

  /* Een vaste TURN_USER/TURN_PASS gaat ongewijzigd naar elke browser en
     verloopt nooit: een permanente frontendcredential. Publieke productie
     weigert hem, ook als hij sterk is; alleen TURN_SECRET (TURN REST) telt. */
  const vast=basis(); delete vast.TURN_SECRET;
  vast.TURN_USER='rtg'; vast.TURN_PASS='V8!vast-A3#wachtwoord-B7$relay-C9%2026';
  assert.equal(keur(vast).fouten.some(x => /vaste TURN_USER\/TURN_PASS is in publieke productie niet toegestaan/.test(x)), true);
  assert.equal(turn.projecteerTurn(vast, { publiekeProductie:true }).server, null);
  assert.ok(turn.projecteerTurn(vast, { publiekeProductie:false }).server, 'lokaal blijft de vaste route bruikbaar');
});

test('publieke TURN-config weigert plaintext, onvolledige, lokale en test-relays', () => {
  for (const url of [
    'turn:turn.rahultravelgroup.com:3478',
    'turns:turn.rahultravelgroup.com',
    'turns:turn.rahultravelgroup.com:0',
    'turns:turn.rahultravelgroup.com:65536',
    'turns:localhost:5349',
    'turns:127.0.0.1:5349',
    'turns:10.0.0.8:5349',
    'turns:[::1]:5349',
    'turns:[::ffff:7f00:1]:5349',
    'turns:[::ffff:a00:1]:5349',
    'turns:[::ffff:c0a8:1]:5349',
    'turns:turn.example.test:5349',
    'turns:turn.voorbeeld.nl:5349',
    'turns:user@turn.rahultravelgroup.com:5349',
    'turns:turn.rahultravelgroup.com:5349?transport=udp',
    'turns:turn.rahultravelgroup.com:5349?transport=tcp&onbekend=1',
    'turns:turn.rahultravelgroup.com:5349,'
  ]) {
    const env=basis(); env.TURN_URL=url;
    assert.equal(keur(env).fouten.some(x => /TURN_URL is niet veilig/.test(x)), true, url);
  }
});

test('TURN-credentials moeten werkelijk sterk zijn en ICE-projectie bevat geen lege items', () => {
  const herhaald=basis(); herhaald.TURN_SECRET='t'.repeat(48);
  assert.equal(keur(herhaald).fouten.some(x => /TURN-authenticatie/.test(x)), true);
  const placeholder=basis(); delete placeholder.TURN_SECRET;
  placeholder.TURN_USER='rtg'; placeholder.TURN_PASS='CHANGE-ME-PLACEHOLDER-01234567890123456789';
  assert.equal(keur(placeholder).fouten.some(x => /TURN-authenticatie/.test(x)), true);

  const env=basis(); env.TURN_URL=' , ' + env.TURN_URL + ',, ';
  const dev=turn.projecteerTurn(env, { publiekeProductie:false, nu:()=>1_000_000 });
  assert.ok(dev.server);
  assert.deepEqual(dev.server.urls, ['turns:turn.rahultravelgroup.com:5349?transport=tcp']);
  assert.equal(dev.server.urls.some(Boolean), true);
  assert.equal(dev.server.urls.every(Boolean), true);
  const publiek=turn.projecteerTurn(env, { publiekeProductie:true, nu:()=>1_000_000 });
  assert.equal(publiek.server, null, 'publieke runtime projecteert geen gedeeltelijk geldige lijst');
});

test('/api/ice-projectie laat in publieke productie alleen complete veilige items door', () => {
  const env={ NODE_ENV:'production', APP_URL:'https://app.rahultravelgroup.com',
    STUN_PUBLIC_HOST:'stun.rahultravelgroup.com', STUN_URL:'stun:stun.rahultravelgroup.com:3478',
    TURN_URL:'turns:turn.rahultravelgroup.com:5349?transport=tcp', TURN_SECRET:STERK };
  const lijst=iceServers({ hostname:'app.rahultravelgroup.com' }, env);
  assert.equal(lijst.length, 2);
  assert.equal(lijst.every(s => Array.isArray(s.urls) && s.urls.length && s.urls.every(Boolean)), true);
  const onveilig={ ...env, TURN_URL:'turn:turn.rahultravelgroup.com:3478' };
  assert.equal(iceServers({ hostname:'app.rahultravelgroup.com' }, onveilig)
    .some(s => s.urls.some(x => /^turn:/i.test(x))), false,
  'zelfs buiten de startkeuring projecteert de route geen plaintext relay');
});

test('publieke STUN is syntactisch veilig, openbaar en exact aan de eigen host gebonden', () => {
  for (const url of [
    'stun:127.0.0.1:3478',
    'stun:[::ffff:7f00:1]:3478',
    'stun:[::ffff:a00:1]:3478',
    'stun:stun.l.google.com:19302',
    'https://stun.rahultravelgroup.com:3478',
    'stun:stun.rahultravelgroup.com',
    'stun:stun.rahultravelgroup.com:3478,'
  ]) {
    const env=basis(); env.STUN_URL=url;
    assert.equal(keur(env).fouten.some(x => /STUN-configuratie/.test(x)), true, url);
    assert.equal(iceServers(null, { ...env, NODE_ENV:'production' })
      .some(s => s.urls.includes(url)), false, 'onveilige STUN kwam in /api/ice: ' + url);
  }
  const afgeleid=basis(); delete afgeleid.STUN_URL; delete afgeleid.STUN_PUBLIC_HOST;
  assert.deepEqual(turn.projecteerStun(afgeleid, { publiekeProductie:true }).urls,
    ['stun:app.rahultravelgroup.com:3478'], 'zonder override is uitsluitend APP_URL de bron');
});

test('publieke productie staat geen stille Google-STUN-uitgang toe', () => {
  const env=basis(); env.STUN_FALLBACK_GOOGLE='1';
  assert.equal(keur(env).fouten.some(x => /STUN_FALLBACK_GOOGLE/.test(x)), true);
});
