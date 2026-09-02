/* HET KYC-BESLUIT LAAT EEN SPOOR NA.

   DE ZWAARSTE HANDELING DIE DIT KANTOOR KENT liet er geen achter. Bij
   /api/office/verify kijkt iemand naar een paspoortscan en een selfie, legt
   nationaliteit en geslacht vast, en wist bij een afwijzing het bewijs uit de
   kluis. Er stond geen enkele regel in een journaal die zei WIE dat besloot,
   OVER WIE, en WAT hij besloot.

   Wat er wel was, was toeval: het antwoord bouwt de wachtrij opnieuw op met
   pendingVerifications(), en die noteert de INZAGE in de rij. Bij een lege rij
   zwijgt die (noteerVeel geeft null zonder id's), dus was dit het laatste
   dossier in de stapel, dan verdween het besluit spoorloos. Precies dat maakte
   de route "wisselend" op de AUDIT-as: soms wel een spoor, soms geen, binnen
   dezelfde geslaagde aanroep.

   Deze toets zet de wachtrij OPZETTELIJK leeg (het lid staat niet op pending),
   zodat er niets is om per ongeluk mee te liften: wat hier gemeten wordt, is
   het besluit zelf.

   Draai los: node --experimental-sqlite --test test/kycspoor.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, kantoorAlsPersoon, wachtOpWaarde } = require('./helper');

let BASE, child, office;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kycspoor-'));

const post = async (pad, lijf, tok) => {
  const headers = { 'Content-Type': 'application/json' };
  if (tok) headers.Authorization = 'Bearer ' + tok;
  const r = await fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(lijf || {}) });
  let data = null; try { data = await r.json(); } catch (e) {}
  return { status: r.status, data };
};

/* Het inzagejournaal uit de bron lezen; zie de uitleg bij dezelfde constructie
   in test/inlogspoor.test.js waarom er RTG_STORE=json onder staat. */
const inzage = () => {
  try { return JSON.parse(fs.readFileSync(path.join(TMP, 'db.json'), 'utf8')).inzageLog || []; }
  catch (e) { return []; }
};

let teller = 0;
async function nieuwLid() {
  const u = 'kyc' + Date.now() + (++teller) + '@voorbeeld.test';
  const r = await post('/api/auth/register', { name: 'KYC Lid ' + teller, email: u,
    password: 'geheim123', geboortedatum: '1990-03-03', pasApp: 'rtg' });
  assert.ok(r.data && r.data.token, 'het proeflid moet bestaan');
  return r.data.state.user.id;
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '',
    RTG_STORE: 'json', OFFICE_CODE: 'KANTOOR-KYCSPOOR' } }));
  /* OP NAAM EN NIET OP DE GEDEELDE CODE. Deze toets ging tot nu toe met
     /api/office/login naar binnen, en dat is precies wat kern/kantoor/
     kluispoort.js sinds kort tegenhoudt: een KYC-besluit komt in het
     inzagejournaal, en daar hoort een mens bij en geen gedeelde code. Dat de
     toets dat zonder mopperen deed, was zelf het bewijs dat de deur openstond. */
  office = await kantoorAlsPersoon(BASE, 'KANTOOR-KYCSPOOR');
  assert.ok(office, 'een kantoorsessie op naam moet te krijgen zijn');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een GOEDKEURING komt in het inzagejournaal, ook bij een lege wachtrij', async () => {
  const id = await nieuwLid();
  const voor = inzage().length;
  const r = await post('/api/office/verify', { userId: id, decision: 'approve' }, office);
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.pending, [], 'de wachtrij is leeg: er valt niets mee te liften');
  /* WACHTEN OP DE REGEL, NIET OP DE KLOK. Hier stond een vaste 400 ms. Het
     journaal wordt na het antwoord geschreven, en op een belaste scherf haalt
     die 400 ms het niet: dan zakt deze toets EN de toets hieronder, die op
     twee regels rekent die deze had moeten achterlaten (CI 2 september 2026,
     drie gezakte toetsen uit een te trage schrijfronde). */
  const na = await wachtOpWaarde(() => { const r2 = inzage(); return r2.length > voor ? r2 : false; },
    { ms: 8000, wat: 'de journaalregel van de goedkeuring' });
  assert.equal(na.length, voor + 1, 'het besluit hoort een regel op te leveren');
  assert.equal(na[0].overId, String(id), 'de regel wijst de persoon aan over wie besloten is');
  assert.match(na[0].waarom, /goedgekeurd/);
  assert.equal(na[0].bron, 'backoffice/verificaties');
});

test('een AFWIJZING ook, en die zegt erbij dat het bewijs is gewist', async () => {
  /* Juist de afwijzing wist de paspoortscan en de selfie uit de kluis. Zonder
     regel is achteraf niet te zien wie dat heeft gedaan. */
  const id = await nieuwLid();
  const voor = inzage().length;
  const r = await post('/api/office/verify', { userId: id, decision: 'reject' }, office);
  assert.equal(r.status, 200);
  const na = await wachtOpWaarde(() => { const r2 = inzage(); return r2.length > voor ? r2 : false; },
    { ms: 8000, wat: 'de journaalregel van de afwijzing' });
  assert.equal(na.length, voor + 1);
  assert.match(na[0].waarom, /afgewezen/);
  assert.match(na[0].waarom, /gewist/, 'wat er met het bewijs gebeurde hoort in de reden te staan');
});

test('de regel hangt aan de hashketen en draagt geen echte naam', async () => {
  /* Twee eisen tegelijk: onuitwisbaar (server/lib/keten.js hangt een nr en een
     hash aan elke regel) en privacy by design -- het journaal wijst een account
     aan, niet een mens met een naam uit de kluis. */
  const rij = inzage();
  assert.ok(rij.length >= 2, 'er staan besluiten in het journaal');
  const besluit = rij.find(r => r.bron === 'backoffice/verificaties');
  assert.ok(besluit.hash, 'elke regel draagt zijn hash');
  assert.ok(Number.isFinite(besluit.nr), 'en zijn plaats in de keten');
  assert.ok(!/KYC Lid/.test(JSON.stringify(rij)), 'geen echte naam in het journaal');
});
