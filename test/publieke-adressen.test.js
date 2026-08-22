/* De drie publieke adresregels door de volledige HTTP- en ontvangstketen. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const { startServer }=require('./helper');

let child, base;
const map=fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-publieke-adressen-'));
const post=(pad,body,token) => fetch(base+pad,{ method:'POST', headers:{
  'Content-Type':'application/json', ...(token ? { Authorization:'Bearer '+token } : {})
}, body:JSON.stringify(body || {}) });
const json=async r => ({ status:r.status, body:await r.json() });
const ruw=(naar,onderwerp) => 'From: afzender@voorbeeld.nl\r\nTo: '+naar+
  '\r\nSubject: '+onderwerp+'\r\nDate: Thu, 20 Aug 2026 10:00:00 +0000\r\n\r\nVeilig ontvangen.';

test.before(async () => {
  ({ child, base }=await startServer({ env:{ RTG_DATA_DIR:map, SMTP_URL:'',
    RTG_MAIL_PUBLIEK_BASIS:'rahultravelgroup.com',
    RTF_MAIL_PUBLIEK_DOMEIN:'rahultravelfoundation.com' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (_) {}
  try { fs.rmSync(map,{ recursive:true, force:true }); } catch (_) {}
});

async function lid(naam,n) {
  return (await json(await post('/api/auth/register',{ name:naam,
    email:'publiek'+n+'@voorbeeld.test', password:'veilig-geheim',
    geboortedatum:'1990-01-01', tier:'rtg', pasApp:'rtg' }))).body;
}

test('lid krijgt voor.achternaam op het server-bewezen pasniveau', async () => {
  const a=await lid('Ada Maria Lovelace',1);
  const adres=await json(await post('/api/member/rtmail/adres',{},a.token));
  assert.equal(adres.status,200);
  assert.equal(adres.body.publiekAdres,'ada.lovelace@rtgpass.rahultravelgroup.com');
  assert.match(adres.body.adres,/^[^@]+@rtgpass\.rtg$/);

  const binnen=await post('/api/mail/binnen',{ bericht:ruw(adres.body.publiekAdres,'Ledenalias') });
  assert.equal(binnen.status,200,await binnen.text());
  const inbox=await json(await post('/api/member/rtmail/inbox',{},a.token));
  assert.ok(inbox.body.berichten.some(m => m.onderwerp === 'Ledenalias'));
});

test('gelijke namen botsen niet en het pasdomein is niet zelf te kiezen', async () => {
  const b=await lid('Ada Maria Lovelace',2);
  const adres=await json(await post('/api/member/rtmail/adres',{},b.token));
  assert.equal(adres.body.publiekAdres,'ada.lovelace-2@rtgpass.rahultravelgroup.com');
});

test('RTF-lid houdt de codenaam op het aparte Foundation-domein', async () => {
  const g=await json(await post('/api/foundation/gezin/maak',{
    gezinsnaam:'Mailgezin', naam:'Beheerder', pin:'2468',
    bevoegdGezin:true, privacyAkkoord:true }));
  const sess={ code:g.body.code, token:g.body.token };
  const overzicht=await json(await post('/api/foundation/mail/overzicht',sess));
  assert.equal(overzicht.status,200);
  assert.match(overzicht.body.publiekAdres,/^[a-z0-9-]+@rahultravelfoundation\.com$/);
  assert.equal(overzicht.body.publiekAdres.includes('beheerder'),false,
    'de echte naam staat niet in het Foundation-adres');

  const binnen=await post('/api/mail/binnen',{
    bericht:ruw(overzicht.body.publiekAdres,'Foundationalias') });
  assert.equal(binnen.status,200,await binnen.text());
  const inbox=await json(await post('/api/foundation/mail/inbox',sess));
  assert.ok(inbox.body.berichten.some(m => m.onderwerp === 'Foundationalias'));
});
