/* De AI-hulp bij een gesprek: samenvatten, actiepunten en het uitleggen van
   phishing-risico.

   Drie beweringen, en de eerste is de voorwaarde waaronder de andere twee
   mogen bestaan:

   1. ELKE BEWERING DRAAGT DE HERKOMST. Geen punt, geen actiepunt en geen
      risicomelding zonder het bericht-id waar het vandaan komt. Een
      samenvatting zonder verwijzing is een tweede versie van de waarheid.
   2. LIEVER NIETS DAN VERZONNEN WERK. Post waarin niemand ergens om vraagt,
      levert een LEGE actielijst op met die reden erbij -- geen bedachte taken.
   3. RISICO IS EEN REDEN, GEEN CIJFER. En "niets gevonden" wordt nooit als
      garantie gepresenteerd.
   Draai: node --test test/rtmail-ai.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, aTok, bTok, aAdres, bAdres;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mailai-'));

const post = async (pad, body, tok) => {
  const h = { 'Content-Type': 'application/json' };
  if (tok) h.Authorization = 'Bearer ' + tok;
  const r = await fetch(BASE + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return r.json().catch(() => ({}));
};
async function meldAan(naam, mail, tel) {
  const r = await post('/api/auth/register', { name: naam, email: mail, phone: tel,
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(r.token, 'aangemeld: ' + naam);
  return r.token;
}
async function schrijf(tok, naar, onderwerp, tekst, antwoordOp) {
  const c = await post('/api/member/rtmail/concept/bewaar', { naar, onderwerp, tekst, antwoordOp }, tok);
  const v = await post('/api/member/rtmail/concept/verstuur', { id: c.concept.id }, tok);
  assert.ok(v.ok, JSON.stringify(v));
  return v.bericht;
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  aTok = await meldAan('Ai Een', 'ai1@x.nl', '0612345671');
  bTok = await meldAan('Ai Twee', 'ai2@x.nl', '0612345672');
  aAdres = (await post('/api/member/rtmail/adres', {}, aTok)).adres;
  bAdres = (await post('/api/member/rtmail/adres', {}, bTok)).adres;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een samenvatting draagt per punt het bericht waar het vandaan komt', async () => {
  const eerst = await schrijf(aTok, bAdres, 'Offerte kamers',
    'Wij zoeken 40 kamers in oktober. Kunt u voor vrijdag een voorstel sturen?');
  const tweede = await schrijf(bTok, aAdres, 'Re: Offerte kamers', 'Dank, ik kijk ernaar.', eerst.id);

  const s = await post('/api/member/rtmail/hulp', { id: eerst.id }, bTok);
  assert.equal(s.ok, true, JSON.stringify(s));
  assert.equal(s.aantal, 2);
  assert.equal(s.punten.length, 2);
  for (const p of s.punten) {
    assert.ok(p.bericht, 'elk punt noemt een bericht-id');
    assert.ok([eerst.id, tweede.id].includes(p.bericht), 'en dat id bestaat echt in dit gesprek');
    assert.ok(p.zin && p.at && p.van);
  }
  assert.match(s.let, /terugspringen naar de oorspronkelijke post/);
  // wie aan zet is, volgt uit wie het laatst schreef
  assert.equal(s.laatsteVan, tweede.van);
  assert.equal(s.aanZet, 'de ander', 'B schreef als laatste, dus B wacht niet op zichzelf');
  const bijA = await post('/api/member/rtmail/hulp', { id: eerst.id }, aTok);
  assert.equal(bijA.aanZet, 'u', 'voor A ligt de bal wel');
});

test('actiepunten komen uit de post zelf, met de datum die erin staat', async () => {
  const m = await schrijf(aTok, bAdres, 'Contract',
    'Hallo.\nKunt u het contract uiterlijk 12-08 ondertekenen?\nDe rest komt later.');
  const a = await post('/api/member/rtmail/hulp', { id: m.id, wat: 'acties' }, bTok);
  assert.equal(a.ok, true, JSON.stringify(a));
  assert.ok(a.aantal >= 1, 'er is een actiepunt gevonden');
  const punt = a.acties[0];
  assert.equal(punt.bericht, m.id, 'het actiepunt verwijst naar het bericht');
  assert.match(punt.zin, /ondertekenen/);
  assert.ok(punt.datums.includes('12-08'), 'de datum uit de zin staat erbij: ' + JSON.stringify(punt.datums));
  assert.match(a.let, /ZINNEN uit de post/);
});

test('post zonder verzoek levert een LEGE actielijst op, geen verzonnen werk', async () => {
  const m = await schrijf(aTok, bAdres, 'Ter info', 'De lift is gisteren gemaakt. Fijne dag.');
  const a = await post('/api/member/rtmail/hulp', { id: m.id, wat: 'acties' }, bTok);
  assert.equal(a.aantal, 0);
  assert.deepEqual(a.acties, []);
  assert.match(a.let, /Liever niets dan verzonnen werk/);
});

test('uw eigen post is geen actiepunt voor uzelf', async () => {
  const m = await schrijf(aTok, bAdres, 'Vraag', 'Kunt u dit graag bevestigen?');
  const bijB = await post('/api/member/rtmail/hulp', { id: m.id, wat: 'acties' }, bTok);
  assert.ok(bijB.aantal >= 1, 'voor de ontvanger is het wel een actie');
  const bijA = await post('/api/member/rtmail/hulp', { id: m.id, wat: 'acties' }, aTok);
  assert.equal(bijA.aantal, 0, 'maar niet voor wie het zelf schreef');
});

test('het risico wordt uitgelegd met redenen, niet met een cijfer', async () => {
  const m = await schrijf(aTok, bAdres, 'Actie vereist',
    'Uw account wordt vandaag nog geblokkeerd. Klik hier: http://nep.example/login en vul uw wachtwoord in.');
  const r = await post('/api/member/rtmail/hulp', { id: m.id, wat: 'risico' }, bTok);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.bericht, m.id);
  assert.ok(r.redenen.length >= 3, 'meerdere redenen: ' + JSON.stringify(r.redenen));
  const tekst = r.redenen.map(x => x.uitleg).join(' | ');
  assert.match(tekst, /inloggegevens/);
  assert.match(tekst, /urgentie/);
  assert.match(tekst, /externe link/);
  /* Geen score: dat toetsen we op de VORM van het antwoord en niet door in de
     tekst naar het woord "score" te zoeken -- dan zou mijn eigen uitleg
     ("dit zijn redenen, geen score") de toets laten zakken. */
  assert.ok(!Object.keys(r).some(k => /score|cijfer|waarde|punten/i.test(k)),
    'er zit geen scoreveld in het antwoord: ' + Object.keys(r).join(', '));
  for (const red of r.redenen) {
    assert.deepEqual(Object.keys(red).sort().filter(k => k !== 'links'), ['uitleg', 'zwaar'],
      'een reden bestaat uit een uitleg en of hij zwaar weegt, meer niet');
    assert.equal(typeof red.zwaar, 'boolean');
  }
  assert.match(r.let, /geen score/);
  assert.match(r.let, /geen garantie/);
});

test('een gewoon bericht van een geverifieerd lid levert geen alarm op', async () => {
  const m = await schrijf(aTok, bAdres, 'Even bijpraten', 'Zullen we volgende week koffie doen?');
  const r = await post('/api/member/rtmail/hulp', { id: m.id, wat: 'risico' }, bTok);
  assert.equal(r.vertrouwd, true, 'een lid dat via de app schrijft, is geverifieerd');
  assert.equal(r.oordeel, 'niets bijzonders gevonden');
  assert.deepEqual(r.redenen, []);
});

test('bij een NIET-geverifieerde afzender staat die reden vooraan', async () => {
  /* Post van buiten komt via de buitenpoort binnen en valt daar altijd in de
     onbetrouwde baan. Zonder zo'n bericht kan de zwaarste reden -- "de afzender
     is niet geverifieerd" -- nooit worden getoetst, en dan is hij een bewering
     zonder dekking. */
  const bericht = [
    'From: Bank Service <service@nep-bank.test>',
    'To: ' + bAdres,
    'Subject: Uw rekening',
    '',
    'Bevestig binnen 24 uur uw pincode via http://nep-bank.test/verify'
  ].join('\r\n');
  const in_ = await post('/api/mail/binnen', { bericht });
  assert.equal(in_.ok, true, JSON.stringify(in_));
  const r = await post('/api/member/rtmail/hulp', { id: in_.id, wat: 'risico' }, bTok);
  assert.equal(r.vertrouwd, false);
  assert.ok(r.redenen.length >= 2, JSON.stringify(r.redenen));
  assert.match(r.redenen[0].uitleg, /niet geverifieerd/, 'die reden staat bovenaan');
  assert.equal(r.redenen[0].zwaar, true);
  assert.equal(r.oordeel, 'wees voorzichtig');
});

test('de hulp raakt nooit een gesprek van iemand anders aan', async () => {
  const m = await schrijf(aTok, aAdres, 'Alleen voor mij', 'Kunt u dit graag doen?');
  const r = await post('/api/member/rtmail/hulp', { id: m.id }, bTok);
  assert.match(r.error, /staat niet in dit postvak/);
});
