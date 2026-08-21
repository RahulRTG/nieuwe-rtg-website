/* AWS SES -> RTG Mail: de provider mag alleen met een verse HMAC binnenkomen,
   de SMTP-envelop wint van de zichtbare To-kop en een Lambda-retry bezorgt
   hetzelfde bericht niet twee keer. */
'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const { startServer }=require('./helper');
const { teken }=require('../server/kern/ses-ontvangst');

const SECRET='ses-testgeheim-van-meer-dan-32-tekens-123456';
const TMP=fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ses-'));
let child, base, token, publiek;

async function json(pad, body, bearer) {
  const h={ 'content-type':'application/json' };
  if (bearer) h.authorization='Bearer ' + bearer;
  const r=await fetch(base + pad, { method:'POST', headers:h, body:JSON.stringify(body || {}) });
  return { status:r.status, body:await r.json() };
}
async function ses({ ruw, id='ses-bericht-1', tijd=Math.floor(Date.now()/1000),
  ontvanger=publiek, signature, controles={} }={}) {
  const bytes=Buffer.from(ruw || bericht());
  const sig=signature || teken(SECRET, { tijd, berichtId:id, ontvanger, bytes, controles });
  const r=await fetch(base + '/api/mail/ses', { method:'POST', headers:{
    'content-type':'message/rfc822',
    'x-rtg-ses-timestamp':String(tijd),
    'x-rtg-ses-message-id':id,
    'x-rtg-ses-recipient':ontvanger,
    'x-rtg-ses-signature':sig,
    'x-rtg-ses-mail-from':'afzender@buiten.test',
    'x-rtg-ses-spf':controles.spf || '', 'x-rtg-ses-dkim':controles.dkim || '',
    'x-rtg-ses-dmarc':controles.dmarc || '', 'x-rtg-ses-spam':controles.spam || '',
    'x-rtg-ses-virus':controles.virus || ''
  }, body:bytes });
  return { status:r.status, body:await r.json() };
}
const bericht=() => [
  'From: Afzender <afzender@buiten.test>',
  'To: vervalst-onbekend@rtgpass.rahultravelgroup.com',
  'Subject: Alleen de envelop beslist',
  '',
  'Dit bericht hoort bij de echte SES-ontvanger.'
].join('\r\n');

test.before(async () => {
  ({ child, base }=await startServer({ env:{ RTG_DATA_DIR:TMP, SMTP_URL:'',
    MAIL_INBOUND_PROVIDER:'aws-ses', SES_INBOUND_SECRET:SECRET,
    RTG_MAIL_PUBLIEK_BASIS:'rahultravelgroup.com' } }));
  const r=await json('/api/auth/register', { name:'Ada Lovelace', email:'ada-ses@example.test',
    phone:'0612345698', password:'geheim123', geboortedatum:'1990-01-01', tier:'rtg', pasApp:'rtg' });
  token=r.body.token;
  const adres=await json('/api/member/rtmail/adres', {}, token);
  publiek=adres.body.publiekAdres;
  assert.equal(publiek, 'ada.lovelace@rtgpass.rahultravelgroup.com');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive:true, force:true }); } catch (e) {}
});

test('SES bezorgt op de ondertekende envelop en niet op de vervalsbare To-kop', async () => {
  const r=await ses();
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.publiekOntvanger, publiek);
  const vak=await json('/api/member/rtmail/vak', {}, token);
  const post=vak.body.berichten.filter(x => x.onderwerp === 'Alleen de envelop beslist');
  assert.equal(post.length, 1);
  assert.equal(post[0].naar.includes('@rtgpass.rtg'), true);
});

test('dezelfde SES-bezorging is idempotent', async () => {
  const r=await ses();
  assert.equal(r.status, 200);
  assert.equal(r.body.dubbel, true);
  const vak=await json('/api/member/rtmail/vak', {}, token);
  assert.equal(vak.body.berichten.filter(x => x.onderwerp === 'Alleen de envelop beslist').length, 1);
});

test('een foutieve of verlopen HMAC komt niet binnen', async () => {
  assert.equal((await ses({ id:'ses-fout', signature:'0'.repeat(64) })).status, 401);
  assert.equal((await ses({ id:'ses-oud', tijd:Math.floor(Date.now()/1000)-601 })).status, 401);
});

test('SES-controles zijn mee-ondertekend en malware wordt niet afgeleverd', async () => {
  const controles={ spf:'PASS', dkim:'PASS', dmarc:'PASS', spam:'PASS', virus:'FAIL' };
  const r=await ses({ id:'ses-virus', controles });
  assert.equal(r.status, 422);
  assert.match(r.body.error, /malware/);
  const gewijzigd=Object.assign({}, controles, { virus:'PASS' });
  const bytes=Buffer.from(bericht());
  const tijd=Math.floor(Date.now()/1000);
  const signature=teken(SECRET, { tijd, berichtId:'ses-verdict', ontvanger:publiek,
    bytes, controles });
  assert.equal((await ses({ id:'ses-verdict', tijd, controles:gewijzigd, signature })).status, 401,
    'een onderschepte verdict-kop breekt de HMAC');
});

test('de onbeveiligde proefpoort staat in de SES-stand dicht', async () => {
  const r=await json('/api/mail/binnen', { bericht:bericht() });
  assert.equal(r.status, 404);
  assert.match(r.body.error, /proefpoort/);
});
