/* DE BANK BEVESTIGT GEEN REKENING DIE DE OPSLAG NIET HEEFT.

   WAAROM DEZE TOETS BESTAAT. De verse faalproefronde (FAALPROEF.json, commit
   61c400cc) gaf /api/bank/akkoord als `gezakt`: 2xx terwijl de toestand niet
   veranderde. Nagelopen in de bron klopte dat -- kern/bank/index.js maakte zijn
   idem-bundel ZONDER de vlag `duurzaam`, en lib/idem.js waarschuwt daar zelf
   voor: dan is de bundel wel atomair en niet duurzaam, "bevestigd aan de klant,
   na een herstart weg".

   Het gevolg was concreet: een lid kreeg `{ok:true, akkoord:true, rekening}`
   met een geldige IBAN terug terwijl noch het akkoord noch de rekening
   bevestigd was vastgelegd. Betalen (kern/pay/index.js) was al duurzaam; een
   rekening OPENEN niet, terwijl beide door dezelfde sleutelruimte lopen.

   WAT HIER WORDT BEWEERD, en wat met opzet niet:
     - zonder verraad blijft de bank gewoon werken (dat is de eerste vraag, niet
       de laatste: duurzaamheid gekocht met een kapotte knop is geen reparatie);
     - onder een liegende opslag komt er GEEN 2xx en dus geen IBAN;
     - er staat hier niets over de zeven kantoorverwijderingen uit dezelfde
       ronde; die vragen een eigen besluit.

   Draai los: node --test test/bankduurzaam.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, verwachtServerfout } = require('./helper');

const mappen = [];
const verseMap = () => { const m = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bnkd-')); mappen.push(m); return m; };

const post = (basis, pad, body, token) => fetch(basis + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let seq = 0;
async function nieuwLid(basis) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const r = await post(basis, 'auth/register', { name: 'Bank Duurzaam ' + seq, email: 'bnkd' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-03-03', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  return r.body.token;
}

/* De leden-bank staat dicht tot de boardroom hem live zet. Dat is een
   KANTOORhandeling, dus die moet eerst -- ook op de liegende server, waar hij
   in het geheugen gewoon aankomt. */
async function bankLive(basis, code) {
  const o = await post(basis, 'office/login', { code });
  assert.ok(o.body.token, 'het kantoor logt in');
  const aan = await post(basis, 'office/bank/leden', { aan: true, naam: 'boardroom' }, o.body.token);
  assert.equal(aan.body.ledenAan, true, 'de boardroom zet de leden-bank live');
}

let eerlijk, leugen;
test.before(async () => {
  /* DE WORP IS HIER DE BEDOELING, en dus wordt hij VERWACHT en niet weggepoetst.

     bijeen() gooit als de opslag een duurzame commit niet bevestigt
     (db/bijeen.js regel 83) en metIdem geeft die worp door -- net als in
     kern/pay, waar geen enkele route hem afvangt. De foutisolatie maakt er een
     500 van en het proces leeft door; dat is een expliciete fout en geen vals
     succes, en dat is precies wat deze toets wil zien.

     De strenge poort in helper.js laat een ronde zakken op een onafgevangen
     serveruitzondering, en dat hoort ook. Hem hier VERWACHTEN is zelf een
     bewering: komt de worp niet, dan zakt de ronde op de gemiste verwachting. */
  verwachtServerfout(/\[duurzaam\] de commit is niet vastgelegd/,
    'de liegende opslag hoort de duurzame commit te laten mislukken -- dat is de kern van deze toets');
  eerlijk = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: verseMap(), OFFICE_CODE: 'KANTOOR-BNKD-1' } });
  leugen = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: verseMap(), OFFICE_CODE: 'KANTOOR-BNKD-2',
    RTG_VERRAAD: 'schrijf-verloren' } });
  await bankLive(eerlijk.base, 'KANTOOR-BNKD-1');
  await bankLive(leugen.base, 'KANTOOR-BNKD-2');
});
test.after(() => {
  stop(eerlijk && eerlijk.child); stop(leugen && leugen.child);
  for (const m of mappen) { try { fs.rmSync(m, { recursive: true, force: true }); } catch (e) {} }
});

test('1. zonder verraad opent het akkoord gewoon een betaalrekening', async () => {
  const tok = await nieuwLid(eerlijk.base);
  const akk = await post(eerlijk.base, 'bank/akkoord', {}, tok);
  assert.equal(akk.status, 200, JSON.stringify(akk.body).slice(0, 160));
  assert.equal(akk.body.akkoord, true);
  assert.match(String(akk.body.rekening && akk.body.rekening.iban || ''), /^NL\d{2}RTGB\d{10}$/,
    'het akkoord hoort meteen een geldige IBAN op te leveren');

  /* En het overzicht leest hem terug: een 200 zonder zichtbaar gevolg zou een
     niet-afgewachte belofte kunnen zijn. */
  const ov = await post(eerlijk.base, 'bank/overzicht', {}, tok);
  assert.equal(ov.body.akkoord, true, 'het akkoord staat in het overzicht');
  assert.ok((ov.body.rekeningen || []).length >= 1, 'en de rekening staat er ook');
});

test('2. onder een liegende opslag komt er GEEN akkoord en GEEN IBAN', async () => {
  /* Dit is de bewering die eerder sneuvelde. Niet "hij logt netjes een fout"
     maar: er komt geen 2xx, en er komt geen rekeningnummer uit. Liever geen
     rekening dan een IBAN die na een herstart niet bestaat. */
  const tok = await nieuwLid(leugen.base);
  const akk = await post(leugen.base, 'bank/akkoord', {}, tok);
  assert.ok(akk.status < 200 || akk.status >= 300,
    'een akkoord dat de opslag niet bevestigt mag niet met een 2xx worden bevestigd (kreeg ' + akk.status + ')');
  assert.ok(!(akk.body && akk.body.rekening && akk.body.rekening.iban),
    'en er mag geen IBAN in het antwoord staan: ' + JSON.stringify(akk.body).slice(0, 160));

  /* EN WAT HIER NIET WORDT BEWEERD. Ik heb hier eerst bij gezet dat het
     overzicht daarna geen rekening mag tonen, en dat is fout: `schrijf-verloren`
     gooit de schrijfactie naar de SCHIJF weg, niet de mutatie in het geheugen.
     Binnen hetzelfde proces leest bank/overzicht dus gewoon wat er in het
     geheugen staat, en dat hoort ook -- de belofte gaat over wat een HERSTART
     overleeft. Dat meet de ketenronde met een echte herstart; deze toets meet
     wat de CLIENT te horen krijgt, en dat is de helft die eerder loog. */
});
