/* DE ADAPTERS VAN DE TESTWERELD -- postvanger (mail) en sms-sandbox.

   BETROUWBAARHEID.md par. 4: een simulatie-adapter vervangt de RAIL, nooit de
   POORT, en elke adapter heeft een grendel die fail-closed is. Wat hier vastligt,
   en elke regel kan zakken:

     1. De drie grendels van de postvanger, elk met de grendel in de reden: geen
        vlag, productie, en een echte mailweg ernaast (ook een SMTP op loopback:
        een lokale MTA stuurt gewoon door).
     2. De drie grendels van de sms-sandbox, met dezelfde vorm. De derde heeft
        vandaag geen onderwerp; dat is gemeten (mail.js: smsConfigured false), en
        deze toets zakt zodra dat verschuift zonder dat de grendel meebeweegt.
     3. De proef WEIGERT te meten als er in haar omgeving post naar buiten kan
        (scripts/lib/postvanger.js eis()).
     4. Beide sms-choke points (sendSms en send('sms:...')) lopen door de sandbox:
        een geldig bericht komt in de outbox, een ongeldig nummer wordt op BEIDE
        geweigerd en komt er niet in -- een adapter laat niets slagen wat in het
        echt zou mislukken.
     5. Met de vanger aan komt mail in de outbox, en de lezer van de proef leest
        hem terug met ontvanger en onderwerp. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Een eigen datamap en de testwereldomgeving VOOR mail.js geladen wordt: de
   module leest zijn omgeving bij het laden. Dit toetsbestand draait in een eigen
   proces, dus dit raakt geen andere toets. */
const MAP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-testwereld-'));
Object.assign(process.env, { RTG_DATA_DIR: MAP, RTG_POSTVANGER: '1', SMS_SANDBOX: '1', SMTP_URL: '', MAIL_DIRECT: '' });
delete process.env.NODE_ENV;
delete process.env.SMS_SANDBOX_RESULT;

const vanger = require('../server/post-vanger');
const sms = require('../server/sms-sandbox');
const pv = require('../scripts/lib/postvanger');

test.after(() => { try { fs.rmSync(MAP, { recursive: true, force: true }); } catch (e) { /* weg */ } });

test('1. de postvanger: drie grendels, en elke weigering noemt de grendel', () => {
  assert.equal(vanger.waaromNiet({ RTG_POSTVANGER: '1' }), null, 'met de vlag en zonder echte mailweg gaat hij aan');
  assert.match(vanger.waaromNiet({}), /RTG_POSTVANGER=1/, 'zonder vlag is hij uit, en dat zegt hij');
  assert.match(vanger.waaromNiet({ RTG_POSTVANGER: '1', NODE_ENV: 'production' }), /nooit in productie/);
  assert.match(vanger.waaromNiet({ RTG_POSTVANGER: '1', MAIL_DIRECT: '1' }), /MAIL_DIRECT/);
  assert.match(vanger.waaromNiet({ RTG_POSTVANGER: '1', SMTP_URL: 'smtp://smarthost.example:587' }), /SMTP_URL/);
  assert.match(vanger.waaromNiet({ RTG_POSTVANGER: '1', SMTP_URL: 'smtp://127.0.0.1:25' }), /SMTP_URL/,
    'ook een SMTP op loopback is een echte mailweg: een lokale MTA stuurt door');
});

test('2. de sms-sandbox: drie grendels met reden, en de derde heeft gemeten geen onderwerp', () => {
  assert.equal(sms.waaromNiet({ SMS_SANDBOX: '1' }), null);
  assert.match(sms.waaromNiet({}), /SMS_SANDBOX=1/);
  assert.match(sms.waaromNiet({ SMS_SANDBOX: '1', NODE_ENV: 'production' }), /nooit in productie/);
  const uit = sms.maakSmsSandbox({ SMS_SANDBOX: '1', NODE_ENV: 'production' });
  assert.equal(uit.enabled, false);
  assert.throws(() => uit.send('+31612345678', 'x'), (e) => e.code === 'SMS_SANDBOX_UIT' && /productie/.test(e.message),
    'de weigering zegt WELKE grendel dichtzit, niet alleen "staat uit"');
  /* Grendel 3: er is geen echte sms-weg in dit huis. Komt er een, dan moet zijn
     sleutel in ECHTE_SMSWEGEN -- en deze regel dwingt dat af. */
  const mail = require('../server/mail');
  assert.equal(mail.smsConfigured, false, 'er is een echte sms-weg bijgekomen: zet zijn omgevingsvariabele in ECHTE_SMSWEGEN van server/sms-sandbox.js en pas deze toets daarna aan');
  assert.deepEqual(sms.ECHTE_SMSWEGEN, []);
  /* En de grendel werkt zodra er een sleutel in de lijst staat. */
  try {
    sms.ECHTE_SMSWEGEN.push('SMS_PROEFSLEUTEL');
    assert.match(sms.waaromNiet({ SMS_SANDBOX: '1', SMS_PROEFSLEUTEL: 'abc' }), /echte sms-weg ingesteld \(SMS_PROEFSLEUTEL\)/);
  } finally { sms.ECHTE_SMSWEGEN.length = 0; }
});

test('3. de proef weigert te meten als er post naar buiten kan', () => {
  assert.equal(pv.eis(Object.assign({}, pv.omgeving())), true);
  assert.throws(() => pv.eis(Object.assign({}, pv.omgeving(), { MAIL_DIRECT: '1' })), (e) => e.code === 'POSTVANGER_UIT' && /MAIL_DIRECT/.test(e.message));
  assert.throws(() => pv.eis(Object.assign({}, pv.omgeving(), { NODE_ENV: 'production' })), /productie/);
  assert.throws(() => pv.eis(Object.assign({}, pv.omgeving(), { SMS_SANDBOX: '' })), /SMS_SANDBOX/);
});

test('4. beide sms-choke points lopen door de sandbox, en een ongeldig nummer slaagt op geen van beide', () => {
  const mail = require('../server/mail');
  assert.equal(mail.smsSandboxConfigured, true);
  const voor = pv.berichten(MAP).filter((b) => b.soort === 'sms').length;
  const r1 = mail.sendSms('+31612345678', 'Herstelcode', 'Uw code is 123456');
  mail.send('sms:+31687654321', 'Bericht', 'Een tweede weg');
  assert.equal(r1.sandbox, true, 'sendSms gaat langs de sandbox');
  assert.equal(r1.bezorgd, false, 'geaccepteerd is niet bezorgd');
  const sms2 = pv.berichten(MAP).filter((b) => b.soort === 'sms');
  assert.equal(sms2.length, voor + 2, 'allebei in de outbox');
  assert.deepEqual(sms2.map((b) => b.aan).sort(), ['sms:+31612345678', 'sms:+31687654321']);

  assert.throws(() => mail.sendSms('0612', 'x', 'y'), (e) => e.code === 'SMS_NUMMER_ONGELDIG');
  assert.throws(() => mail.send('sms:0612', 'x', 'y'), (e) => e.code === 'SMS_NUMMER_ONGELDIG');
  assert.equal(pv.berichten(MAP).filter((b) => b.soort === 'sms').length, voor + 2, 'een geweigerd bericht komt niet in de outbox');
});

test('5. met de vanger aan blijft mail in huis, en de proef leest hem terug', () => {
  const mail = require('../server/mail');
  assert.equal(mail.postvanger, true);
  assert.equal(mail.liveConfigured, false, 'naast de vanger staat geen echte mailweg');
  mail.send('lid@voorbeeld.nl', 'Bevestig uw e-mailadres', 'Hallo');
  const m = pv.berichten(MAP).filter((b) => b.soort === 'mail');
  assert.equal(m.length, 1);
  assert.equal(m[0].aan, 'lid@voorbeeld.nl');
  assert.equal(m[0].onderwerp, 'Bevestig uw e-mailadres');
  assert.match(m[0].lijf, /Hallo/);
});
