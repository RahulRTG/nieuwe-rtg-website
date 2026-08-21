/* Contracttests voor de volledig lokale provider-sandboxes. Geen enkele toets
   maakt netwerkverkeer of beweegt geld; subprocessen isoleren de env-standen. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { maakSmsSandbox } = require('../server/sms-sandbox');
const iban = require('../server/iban');
const config = require('../server/config');

const WORTEL = path.join(__dirname, '..');
function kind(code, extra) {
  return spawnSync(process.execPath, ['-e', code], {
    cwd: WORTEL, encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test', RTG_DEMO: '', STRIPE_SECRET_KEY: '',
      STRIPE_DEMO_BEWUST: '', MAIL_DIRECT: '', SMTP_URL: '', ...extra }
  });
}

test('SMS-contractsandbox valideert lokaal en bezorgt nooit echt', () => {
  const sms = maakSmsSandbox({ NODE_ENV: 'test', SMS_SANDBOX: '1' });
  const r = sms.send('+31612345678', 'Herstelcode 123456');
  assert.equal(r.ok, true);
  assert.equal(r.sandbox, true);
  assert.equal(r.bezorgd, false);
  assert.match(r.id, /^sms_test_/);
  assert.throws(() => sms.send('0612345678', 'code'), e => e.code === 'SMS_NUMMER_ONGELDIG');
  const stuk = maakSmsSandbox({ NODE_ENV: 'test', SMS_SANDBOX: '1', SMS_SANDBOX_RESULT: 'failed' });
  assert.throws(() => stuk.send('+31612345678', 'code'), e => e.code === 'SMS_SANDBOX_MISLUKT');
});

test('SMS-sandbox kan in productie niet actief worden', () => {
  const sms = maakSmsSandbox({ NODE_ENV: 'production', SMS_SANDBOX: '1' });
  assert.equal(sms.enabled, false);
  assert.throws(() => sms.send('+31612345678', 'code'), e => e.code === 'SMS_SANDBOX_UIT');
});

test('SMTP-sandbox accepteert alleen een lokale catcher en noemt die niet live', () => {
  const code = `const m=require('./server/mail');if(!m.sandboxConfigured||m.liveConfigured)process.exit(9);`;
  const r = kind(code, { SMTP_SANDBOX: '1', SMTP_URL: 'smtp://127.0.0.1:2525' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test('SMTP-sandbox weigert een externe host zonder er verbinding mee te maken', () => {
  const code = `const m=require('./server/mail');if(m.sandboxConfigured||m.liveConfigured)process.exit(9);`;
  const r = kind(code, { SMTP_SANDBOX: '1', SMTP_URL: 'smtp://smtp.example.invalid:2525' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test('de SMTP-zekering stopt de VERZENDKANT, niet alleen het bord', () => {
  /* DE TOETS DIE ER NIET WAS. De toets hieronder kijkt of sandboxStand() na het
     omzetten "uit" meldt. Dat is het BORD. Of send() en bezorgNu() zich er iets
     van aantrekken werd nergens nagegaan -- en dat is wat de Integratiekamer
     belooft: "uit zetten zonder procesherstart".

     Betrapt bij het afsplitsen van ./server/mail-lokaal.js: de stand kreeg daar
     een eigenaar, en de tegenproef -- smtpAan() de STARTwaarde laten teruggeven
     in plaats van de levende vlag -- liet geen enkele toets zakken. Een schakelaar
     die nergens op aangesloten zit ziet er precies zo uit als een die het doet.

     Meetbaar zonder netwerk: met de sandbox AAN gaat bezorgNu langs de smarthost
     op 127.0.0.1:2525, waar niets luistert -- dat geeft een tijdelijke fout. Met
     de zekering UIT slaat hij de smarthost over en valt terug op de outbox. Het
     verschil tussen die twee antwoorden IS de schakelaar. */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mailzekering-'));
  const code = `
    const m=require('./server/mail');
    (async () => {
      const aan = await m.bezorgNu('iemand@example.test','proef','tekst');
      if (aan.via === 'outbox') process.exit(9);
      if (!m.zetSandbox('smtp', false).ok) process.exit(8);
      const uit = await m.bezorgNu('iemand@example.test','proef','tekst');
      if (!(uit.ok && uit.via === 'outbox')) process.exit(7);
    })().catch(() => process.exit(6));`;
  const r = kind(code, { SMTP_SANDBOX: '1', SMTP_URL: 'smtp://127.0.0.1:2525', RTG_DATA_DIR: dir });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test('Integratiekamer-zekeringen blokkeren SMS en SMTP runtime fail-closed', () => {
  const code = `
    const m=require('./server/mail');
    if(!m.sandboxStand().sms.aan||!m.sandboxStand().smtp.aan)process.exit(9);
    if(!m.zetSandbox('sms',false).ok||!m.zetSandbox('smtp',false).ok)process.exit(8);
    let smsDicht=false;try{m.sendSms('+31612345678','proef','123456')}catch(e){smsDicht=e.code==='SMS_SANDBOX_UIT'}
    if(!smsDicht||m.sandboxStand().sms.aan||m.sandboxStand().smtp.aan)process.exit(7);`;
  const r = kind(code, { SMS_SANDBOX: '1', SMTP_SANDBOX: '1', SMTP_URL: 'smtp://127.0.0.1:2525' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test('Stripe Connect-sandbox maakt een wachtende destination charge zonder netwerk', () => {
  const code = `
    const b=require('./server/betaal');
    b.maakBetaling({bedrag:1250,valuta:'eur',referentie:'DP-test',idempotentieSleutel:'dp:test',bestemming:'acct_TEST123'})
      .then(r=>{if(!b.CONNECT_SANDBOX||r.status!=='processing'||r.transferData.destination!=='acct_TEST123'||!r.sandbox)process.exit(9)})
      .catch(e=>{console.error(e);process.exit(8)});`;
  const r = kind(code, { STRIPE_CONNECT_SANDBOX: '1' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test('Connect-sandbox weigert een ongeldige partneridentiteit', () => {
  const code = `
    const b=require('./server/betaal');
    b.maakBetaling({bedrag:1250,bestemming:'partner'}).then(()=>process.exit(9)).catch(e=>{
      if(e.code!=='CONNECT_ACCOUNT_ONGELDIG')process.exit(8)
    });`;
  const r = kind(code, { STRIPE_CONNECT_SANDBOX: '1' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test('SEPA-sandbox gebruikt echte IBAN-controle en blijft processing', () => {
  assert.equal(iban.geldig('NL91 ABNA 0417 1643 00'), true);
  assert.equal(iban.geldig('NL00 ABNA 0417 1643 00'), false);
  const code = `
    const b=require('./server/betaal');
    Promise.all([
      b.maakUitbetaling({bedrag:9900,iban:'NL91ABNA0417164300',referentie:'sepa-1'}),
      b.maakUitbetaling({bedrag:9900,iban:'NL00ABNA0417164300',referentie:'sepa-fout'}).then(()=>null,e=>e.code)
    ]).then(([goed,fout])=>{if(!b.SEPA_SANDBOX||goed.status!=='processing'||!goed.sandbox||fout!=='IBAN_ONGELDIG')process.exit(9)})
      .catch(e=>{console.error(e);process.exit(8)});`;
  const r = kind(code, { SEPA_SANDBOX: '1' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test('Integratiekamer-zekeringen blokkeren Connect en SEPA runtime fail-closed', () => {
  const code = `
    const b=require('./server/betaal');
    b.zetSandbox('connect',false);b.zetSandbox('sepa',false);
    Promise.all([
      b.maakBetaling({bedrag:1250,referentie:'dicht-c',bestemming:'acct_TEST123'}).then(()=>'',e=>e.code),
      b.maakUitbetaling({bedrag:1250,referentie:'dicht-s',iban:'NL91ABNA0417164300'}).then(()=>'',e=>e.code)
    ]).then(([c,s])=>{if(c!=='CONNECT_SANDBOX_UIT'||s!=='SEPA_SANDBOX_UIT')process.exit(9)})
      .catch(()=>process.exit(8));`;
  const r = kind(code, { STRIPE_CONNECT_SANDBOX: '1', SEPA_SANDBOX: '1' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test('productieconfiguratie weigert iedere lokale sandbox', () => {
  const basis = {
    NODE_ENV: 'production', RTG_ENC_KEY: 'e'.repeat(64), RTG_VAULT_KEY: 'v'.repeat(64),
    RTG_SECRET_KEY: 's'.repeat(64), RTG_OWNER_EMAIL: 'eigenaar@echt.nl',
    SMTP_URL: 'smtps://smtp.example:465', STRIPE_DEMO_BEWUST: '1',
    RTG_HERSTEL_SMS_UIT_BEWUST: '1'
  };
  const r = config.valideer({ ...basis, SMTP_SANDBOX: '1', SMS_SANDBOX: '1',
    STRIPE_CONNECT_SANDBOX: '1', SEPA_SANDBOX: '1' });
  for (const naam of ['SMTP_SANDBOX', 'SMS_SANDBOX', 'STRIPE_CONNECT_SANDBOX', 'SEPA_SANDBOX'])
    assert.ok(r.fouten.some(f => f.includes(naam)), naam + ' moet productie blokkeren');
});
