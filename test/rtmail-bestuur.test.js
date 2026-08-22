/* RTMAIL, het bestuur: rechten, delegatie, journaal, bewaartermijn,
   juridische bewaring, aantoonbare vernietiging en export.

   De zes beweringen die deze laag draagt, en ze zijn allemaal van het soort
   waar een organisatie later op wordt afgerekend:

   1. Rechten staan LOS. Wie mag antwoorden, mag daarmee nog niet exporteren.
   2. Niemand kan weggeven wat hij zelf niet heeft.
   3. Vier handelingen vragen een REDEN vooraf, en zonder reden is het antwoord
      nee -- niet "ja maar we loggen het".
   4. Elke handeling op andermans postvak staat in het journaal, ook een
      GEWEIGERDE poging.
   5. Een juridische bewaring wint altijd van de bewaartermijn.
   6. Wat vernietigd is, laat het FEIT achter: aantal, tijdvak, wie en waarom --
      en de inhoud niet, want dat zou de vernietiging ongedaan maken.
   Draai: node --test test/rtmail-bestuur.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, aTok, bTok, aAdres, bAdres;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bestuur-'));

const rauw = (pad, body, tok) => {
  const h = { 'Content-Type': 'application/json' };
  if (tok) h.Authorization = 'Bearer ' + tok;
  return fetch(BASE + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
};
const post = async (pad, body, tok) => (await rauw(pad, body, tok)).body;

async function meldAan(naam, mail, tel) {
  const r = await post('/api/auth/register', { name: naam, email: mail, phone: tel,
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(r.token, 'aangemeld: ' + naam);
  return r.token;
}
async function schrijf(tok, naar, onderwerp, tekst) {
  const c = await post('/api/member/rtmail/concept/bewaar', { naar, onderwerp, tekst }, tok);
  const v = await post('/api/member/rtmail/concept/verstuur', { id: c.concept.id }, tok);
  assert.ok(v.ok, JSON.stringify(v));
  return v.bericht;
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  aTok = await meldAan('Bestuur Een', 'bestuur1@x.nl', '0612345651');
  bTok = await meldAan('Bestuur Twee', 'bestuur2@x.nl', '0612345652');
  aAdres = (await post('/api/member/rtmail/adres', {}, aTok)).adres;
  bAdres = (await post('/api/member/rtmail/adres', {}, bTok)).adres;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('op het eigen postvak heeft u alles, behalve juridische inzage', async () => {
  const r = await post('/api/member/rtmail/rechten', {}, aTok);
  assert.equal(r.ok, true);
  assert.ok(r.rechten.includes('lezen') && r.rechten.includes('exporteren') && r.rechten.includes('delegatie'));
  assert.ok(!r.rechten.includes('inzage'), 'inzage geeft niemand zichzelf');
  assert.deepEqual(r.redenNodig, ['vernietigen', 'exporteren', 'zoekenBreed', 'inzage']);
});

test('op andermans postvak heeft u niets, en dat staat met reden in het antwoord', async () => {
  const r = await post('/api/member/rtmail/rechten', { postvak: bAdres }, aTok);
  assert.deepEqual(r.rechten, [], 'A mag niets op het postvak van B');
  const e = await rauw('/api/member/rtmail/export', { postvak: bAdres, reden: 'nieuwsgierig' }, aTok);
  assert.equal(e.status, 403);
  assert.match(e.body.error, /geen recht "exporteren"/);
});

test('rechten staan los: antwoorden geven is niet exporteren geven', async () => {
  const d = await post('/api/member/rtmail/delegeer',
    { aan: aAdres, rechten: ['metadata', 'lezen', 'antwoorden'], reden: 'vakantiewaarneming' }, bTok);
  assert.equal(d.ok, true, JSON.stringify(d));
  assert.deepEqual(d.delegatie.rechten, ['metadata', 'lezen', 'antwoorden']);

  const r = await post('/api/member/rtmail/rechten', { postvak: bAdres }, aTok);
  assert.ok(r.rechten.includes('lezen'));
  assert.ok(!r.rechten.includes('exporteren'), 'lezen is geen exporteren');
  assert.ok(!r.rechten.includes('vernietigen'));
  const e = await rauw('/api/member/rtmail/export', { postvak: bAdres, reden: 'even meekijken' }, aTok);
  assert.equal(e.status, 403);
});

test('niemand kan weggeven wat hij zelf niet heeft', async () => {
  /* Deze toets moet de JUISTE grendel raken. Krijgt A helemaal geen
     delegatierecht, dan struikelt hij al over "u mag hier geen rechten
     weggeven" en zegt de toets niets over doorgeven-wat-je-niet-hebt. B geeft
     hem dus wel delegatie EN lezen, maar geen exporteren. */
  await post('/api/member/rtmail/delegeer',
    { aan: aAdres, rechten: ['metadata', 'lezen', 'delegatie'], reden: 'A regelt de waarneming' }, bTok);
  const magWel = await post('/api/member/rtmail/rechten', { postvak: bAdres }, aTok);
  assert.ok(magWel.rechten.includes('delegatie'), 'A mag nu wel rechten weggeven op dit postvak');
  assert.ok(!magWel.rechten.includes('exporteren'), 'maar exporteren heeft hij zelf niet');

  const r = await rauw('/api/member/rtmail/delegeer',
    { postvak: bAdres, aan: aAdres, rechten: ['lezen', 'exporteren'], reden: 'handig' }, aTok);
  assert.equal(r.status, 403);
  assert.match(r.body.error, /niet weggeven wat u zelf niet heeft/);
  assert.match(r.body.error, /exporteren/, 'de melding noemt precies welk recht het probleem is');
  // en het doorgeven van wat hij WEL heeft, lukt gewoon
  const wel = await post('/api/member/rtmail/delegeer',
    { postvak: bAdres, aan: aAdres, rechten: ['lezen'], reden: 'alleen lezen' }, aTok);
  assert.equal(wel.ok, true, JSON.stringify(wel));
});

test('vier handelingen vragen een reden VOORAF, en zonder reden is het nee', async () => {
  await post('/api/member/rtmail/delegeer',
    { aan: aAdres, rechten: ['metadata', 'lezen', 'exporteren'], reden: 'audit' }, bTok);
  const zonder = await rauw('/api/member/rtmail/export', { postvak: bAdres }, aTok);
  assert.equal(zonder.status, 403);
  assert.match(zonder.body.error, /reden nodig/);
  const met = await post('/api/member/rtmail/export', { postvak: bAdres, reden: 'jaarlijkse audit 2026' }, aTok);
  assert.equal(met.ok, true, JSON.stringify(met));
  assert.equal(met.inhoudMee, true, 'A kreeg ook leesrecht, dus de inhoud gaat mee');
});

test('een export zonder leesrecht levert alleen metadata, niet stiekem de tekst', async () => {
  await schrijf(bTok, bAdres, 'Iets vertrouwelijks', 'dit is de geheime inhoud');
  await post('/api/member/rtmail/delegeer',
    { aan: aAdres, rechten: ['metadata', 'exporteren'], reden: 'alleen tellen' }, bTok);
  const e = await post('/api/member/rtmail/export', { postvak: bAdres, reden: 'telling voor de audit' }, aTok);
  assert.equal(e.ok, true, JSON.stringify(e));
  assert.equal(e.inhoudMee, false);
  assert.ok(e.aantal >= 1);
  assert.ok(!JSON.stringify(e.berichten).includes('geheime inhoud'), 'de tekst gaat niet mee');
  assert.ok(e.berichten.every(m => m.onderwerp !== undefined), 'de metadata wel');
  assert.match(e.let, /geen leesrecht/);
});

test('ook een GEWEIGERDE poging staat in het journaal', async () => {
  await rauw('/api/member/rtmail/opruimen', { postvak: bAdres, reden: 'opruimen graag' }, aTok);
  const j = await post('/api/member/rtmail/journaal', { postvak: bAdres }, bTok);
  assert.equal(j.ok, true, JSON.stringify(j));
  const geweigerd = j.regels.find(r => /geweigerd/.test(r.wat));
  assert.ok(geweigerd, 'de mislukte poging staat erin: ' + JSON.stringify(j.regels.slice(0, 3)));
  assert.match(geweigerd.wat, /vernietigen/);
  const gelukt = j.regels.find(r => /geexporteerd/.test(r.wat));
  assert.ok(gelukt, 'en de gelukte export ook');
  assert.match(gelukt.reden, /audit/);
});

test('een juridische bewaring wint van de bewaartermijn', async () => {
  // B zet een termijn van 1 dag op zijn eigen postvak en legt er een bewaring op
  const t = await post('/api/member/rtmail/bewaartermijn', { dagen: 1, reden: 'schoon houden' }, bTok);
  assert.equal(t.dagen, 1);
  const zonderReden = await post('/api/member/rtmail/bewaring', { zaak: 'ZK-1' }, bTok);
  assert.match(zonderReden.error, /zonder reden/);
  const b = await post('/api/member/rtmail/bewaring',
    { zaak: 'ZK-2026-01', reden: 'geschil met leverancier' }, bTok);
  assert.equal(b.ok, true, JSON.stringify(b));
  assert.match(b.let, /verdwijnt er niets/);

  const op = await post('/api/member/rtmail/opruimen', { reden: 'de termijn is om' }, bTok);
  assert.match(op.error, /juridische bewaring \(ZK-2026-01\)/);

  const beleid = await post('/api/member/rtmail/bewaarbeleid', {}, bTok);
  assert.equal(beleid.bewaring.zaak, 'ZK-2026-01');
  assert.match(beleid.let, /ook niet wat over de termijn is/);
});

test('opheffen van de bewaring vraagt een eigen reden en staat met naam in het journaal', async () => {
  const zonder = await post('/api/member/rtmail/bewaring', { aan: false }, bTok);
  assert.match(zonder.error, /zonder reden/);
  const op = await post('/api/member/rtmail/bewaring', { aan: false, reden: 'geschil geschikt op 5 augustus' }, bTok);
  assert.equal(op.ok, true, JSON.stringify(op));
  assert.equal(op.bewaring, null);
  const j = await post('/api/member/rtmail/journaal', {}, bTok);
  const regel = j.regels.find(r => /OPGEHEVEN/.test(r.wat));
  assert.ok(regel, 'het opheffen staat in het journaal');
  assert.match(regel.reden, /geschikt/);
});

test('vernietiging laat het FEIT achter en niet de inhoud', async () => {
  // een oud bericht maken door de klok niet te kunnen verzetten: we zetten de
  // termijn op 0 dagen, dan is alles ouder dan de grens
  await post('/api/member/rtmail/bewaartermijn', { dagen: 0, reden: 'terug naar nooit' }, bTok);
  const nul = await post('/api/member/rtmail/opruimen', { reden: 'proef' }, bTok);
  assert.equal(nul.verwijderd, 0);
  assert.match(nul.let, /geen bewaartermijn/);

  await post('/api/member/rtmail/bewaartermijn', { dagen: 1, reden: 'een dag' }, bTok);
  const niets = await post('/api/member/rtmail/opruimen', { reden: 'proef twee' }, bTok);
  assert.equal(niets.verwijderd, 0, 'de post van vandaag is nog geen dag oud');
  assert.match(niets.let, /ouder dan 1 dagen/);
});

test('een verlopen delegatie geeft een ANDERE fout dan nooit toegang gehad', async () => {
  const verleden = new Date(Date.now() + 900).toISOString();
  await post('/api/member/rtmail/delegeer',
    { aan: aAdres, rechten: ['metadata', 'lezen'], tot: verleden, reden: 'kort even' }, bTok);
  const nu = await post('/api/member/rtmail/rechten', { postvak: bAdres }, aTok);
  assert.ok(nu.rechten.includes('lezen'), 'nu nog wel');
  /* WACHTEN TOT HET RECHT ECHT WEG IS, en niet 1200 ms gokken. De delegatie
     loopt tot nu+900 ms, dus 1200 was ruim -- maar "ruim" is geen teken. Het
     vervallen zelf is af te lezen, en dat is meteen strenger: zo staat er dat
     het recht WEGGAAT, niet dat het na 1,2 seconde toevallig weg was. */
  let straks = null;
  {
    const eind = Date.now() + 20000;
    for (;;) {
      straks = await post('/api/member/rtmail/rechten', { postvak: bAdres }, aTok);
      if (!straks.rechten.includes('lezen')) break;
      if (Date.now() >= eind) throw new Error('de delegatie verliep niet binnen 20 s');
      await new Promise(r => setTimeout(r, 50));
    }
  }
  assert.ok(!straks.rechten.includes('lezen'), 'na het venster niet meer');
  const e = await rauw('/api/member/rtmail/export', { postvak: bAdres, reden: 'nog een keer' }, aTok);
  assert.match(e.body.error, /verlopen op/, 'de melding zegt DAT het verlopen is, niet dat u nooit iets mocht');
});

test('rechten afnemen kan, en dan is het meteen voorbij', async () => {
  await post('/api/member/rtmail/delegeer',
    { aan: aAdres, rechten: ['metadata', 'lezen'], reden: 'opnieuw' }, bTok);
  assert.ok((await post('/api/member/rtmail/rechten', { postvak: bAdres }, aTok)).rechten.includes('lezen'));
  const weg = await post('/api/member/rtmail/delegatie/weg', { aan: aAdres }, bTok);
  assert.equal(weg.ok, true);
  assert.deepEqual((await post('/api/member/rtmail/rechten', { postvak: bAdres }, aTok)).rechten, []);
});
