/* RTG Redactie: het persbureau (krant, magazine en drukkerij) plus de eigen
   Nieuws-app voor de leden. Getest: de statusketen van een artikel (publiceren
   is een mensbesluit; daarna is het stuk onwijzigbaar), de drukstraat die maar
   een kant op draait (met drukproef), de nieuwstips-wand uit het hele platform,
   de Nieuws-app die alleen gepubliceerd werk toont (met Rahul als nieuwslezer)
   en de spin-off vanuit de Ideeenkamer naar de schrijftafel.
   Draai los: node --experimental-sqlite --test test/redactie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, office;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-redactie-'));
const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let teller = 0;
async function lid() {
  const t = Date.now() + '' + (teller++);
  const r = await api('/api/auth/register', { name: 'Lid ' + t, email: 'r' + t + '@v.test', phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' });
  return r.body.token;
}

test('1. de redactie staat klaar: rubrieken, statusketens en een gezaaid stuk; zonder kantoorpas 401', async () => {
  const r = await api('/api/office/redactie', {}, office);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.rubrieken, ['nieuws', 'reizen', 'lifestyle', 'zaken', 'cultuur', 'sport']);
  assert.deepEqual(r.body.artikelStatus, ['concept', 'eindredactie', 'gepubliceerd']);
  assert.ok(r.body.artikelen.some(a => a.status === 'gepubliceerd'), 'er ligt al een gepubliceerd stuk');
  assert.equal((await api('/api/office/redactie', {}, null)).status, 401);
});

test('2. de statusketen: publiceren vereist tekst en is een mensbesluit; daarna is het stuk onwijzigbaar', async () => {
  const mk = await api('/api/office/redactie/artikel/maak', { kop: 'De Salon opent een tweede verdieping', rubriek: 'lifestyle', intro: 'Meer plek voor de leden.' }, office);
  assert.equal(mk.status, 200);
  const aid = mk.body.artikel.id;
  assert.equal(mk.body.artikel.status, 'concept');
  // zonder tekst komt het niet door de deur van de drukpers
  assert.equal((await api('/api/office/redactie/artikel/status', { id: aid, status: 'gepubliceerd' }, office)).status, 400);
  // schrijven, naar eindredactie en dan publiceren -- die laatste klik is van een mens
  assert.equal((await api('/api/office/redactie/artikel/zet', { id: aid, tekst: 'De tweede verdieping opent deze maand. De leden kregen het als eersten te horen.' }, office)).status, 200);
  assert.equal((await api('/api/office/redactie/artikel/status', { id: aid, status: 'eindredactie' }, office)).status, 200);
  const pub = await api('/api/office/redactie/artikel/status', { id: aid, status: 'gepubliceerd' }, office);
  assert.equal(pub.status, 200);
  assert.ok(pub.body.artikel.publicatieAt, 'de publicatiedatum staat erop');
  // een gepubliceerd stuk wijzig je niet meer: maak een vervolgstuk
  const wz = await api('/api/office/redactie/artikel/zet', { id: aid, kop: 'Andere kop' }, office);
  assert.equal(wz.status, 409);
  assert.match(wz.body.error, /vervolgstuk/);
});

test('3. de drukkerij: een editie uit gepubliceerd werk, de drukstraat draait niet achteruit, en de drukproef is een blad', async () => {
  const mk = await api('/api/office/redactie/artikel/maak', { kop: 'Zeilseizoen geopend', rubriek: 'sport', tekst: 'De eerste boten liggen klaar in de haven.' }, office);
  const aid = mk.body.artikel.id;
  // een concept mag de krant niet in
  assert.equal((await api('/api/office/redactie/editie/maak', { titel: 'Weekend-editie', artikelIds: [aid] }, office)).status, 400);
  await api('/api/office/redactie/artikel/status', { id: aid, status: 'gepubliceerd' }, office);
  const ed = await api('/api/office/redactie/editie/maak', { titel: 'Weekend-editie', soort: 'krant', oplage: 2500, artikelIds: [aid] }, office);
  assert.equal(ed.status, 200);
  const eid = ed.body.editie.id;
  assert.equal(ed.body.editie.status, 'samenstellen');
  assert.equal((await api('/api/office/redactie/editie/status', { id: eid, status: 'ter-perse' }, office)).status, 200);
  const dr = await api('/api/office/redactie/editie/status', { id: eid, status: 'gedrukt' }, office);
  assert.equal(dr.status, 200);
  assert.ok(dr.body.editie.gedruktAt, 'het drukmoment staat vast');
  // terugdraaien kan niet: de drukstraat gaat een kant op
  const terug = await api('/api/office/redactie/editie/status', { id: eid, status: 'samenstellen' }, office);
  assert.equal(terug.status, 409);
  assert.match(terug.body.error, /achteruit/);
  // de drukproef: het hele blad als tekst
  const proef = await api('/api/office/redactie/drukproef', { id: eid }, office);
  assert.equal(proef.status, 200);
  assert.match(proef.body.blad, /=== RTG COURANT · Weekend-editie/);
  assert.match(proef.body.blad, /\[SPORT\] Zeilseizoen geopend/);
});

test('4. de nieuwstips-wand: wat op Pulse leeft komt als verhaal-idee de redactie binnen', async () => {
  const a = await lid();
  await api('/api/member/pulse/post', { tekst: 'Iedereen praat over #regatta dit weekend' }, a);
  const r = await api('/api/office/redactie/nieuwstips', {}, office);
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.tips));
  assert.ok(r.body.tips.some(t => t.bron === 'Pulse' && /#regatta/.test(t.tip)), 'de Pulse-trend staat op de wand');
});

test('5. de Nieuws-app: leden lezen alleen gepubliceerd werk, en Rahul vat een stuk eerlijk samen', async () => {
  const a = await lid();
  const mk = await api('/api/office/redactie/artikel/maak', { kop: 'Concept dat niemand ziet', tekst: 'Nog niet af.' }, office);
  const lijst = await api('/api/member/nieuws', {}, a);
  assert.equal(lijst.status, 200);
  assert.ok(lijst.body.artikelen.length >= 1, 'het gezaaide nieuws staat er');
  assert.ok(!lijst.body.artikelen.some(x => x.id === mk.body.artikel.id), 'een concept staat NIET in de app');
  assert.equal((await api('/api/member/nieuws/artikel', { id: mk.body.artikel.id }, a)).status, 404);
  // per rubriek filteren
  const rub = await api('/api/member/nieuws', { rubriek: 'nieuws' }, a);
  assert.ok(rub.body.artikelen.every(x => x.rubriek === 'nieuws'));
  // een gepubliceerd stuk lezen + Rahul als nieuwslezer (demo: eerlijk uit de tekst zelf)
  const open = lijst.body.artikelen[0];
  const art = await api('/api/member/nieuws/artikel', { id: open.id }, a);
  assert.equal(art.status, 200);
  assert.ok(art.body.artikel.tekst);
  const ai = await api('/api/member/nieuws/ai', { id: open.id, vraag: 'Vat samen' }, a);
  assert.equal(ai.status, 200);
  assert.ok(ai.body.antwoord && ai.body.antwoord.length > 10, 'Rahul geeft een antwoord op basis van het stuk');
  // zonder sessie geen nieuws
  assert.equal((await api('/api/member/nieuws', {}, null)).status, 401);
});

test('6. de Ideeenkamer: de Redactie doet mee als bureau en een spin-off wordt een concept-artikel', async () => {
  const ov = await api('/api/office/ideeen', {}, office);
  assert.ok(ov.body.bureaus.some(b => b.id === 'redactie'), 'de Redactie staat tussen de bureaus');
  const idee = await api('/api/office/ideeen/maak', { titel: 'Serie: de mensen achter de haven', brief: 'Portretten van de havenmeesters en schippers.', bureaus: ['redactie'] }, office);
  assert.equal(idee.status, 200);
  const spin = await api('/api/office/ideeen/spinoff', { id: idee.body.idee.id, bureau: 'redactie' }, office);
  assert.equal(spin.status, 200);
  assert.ok(spin.body.spinoff.ontwerpId, 'de spin-off wijst naar het nieuwe stuk');
  const r = await api('/api/office/redactie', {}, office);
  const art = r.body.artikelen.find(a => a.id === spin.body.spinoff.ontwerpId);
  assert.ok(art, 'het stuk ligt op de schrijftafel');
  assert.equal(art.status, 'concept');
  assert.equal(art.kop, 'Serie: de mensen achter de haven');
  assert.equal(art.auteur, 'Ideeenkamer');
});

test('7. de AI-hoofdredacteur schrijft een concept (zonder feiten te verzinnen) en de eindredacteur oordeelt -- publiceren blijft mensenwerk', async () => {
  const sch = await api('/api/office/redactie/ai/schrijf', { onderwerp: 'het nieuwe beachpaviljoen', rubriek: 'lifestyle' }, office);
  assert.equal(sch.status, 200);
  assert.ok(sch.body.kop && sch.body.tekst, 'kop en tekst');
  if (sch.body.bron === 'demo') assert.match(sch.body.tekst, /\[check/, 'open plekken zijn gemarkeerd, niet ingevuld');
  const mk = await api('/api/office/redactie/artikel/maak', { kop: sch.body.kop, intro: sch.body.intro, tekst: sch.body.tekst, rubriek: 'lifestyle', auteur: 'AI-concept' }, office);
  const red = await api('/api/office/redactie/ai/redactie', { id: mk.body.artikel.id }, office);
  assert.equal(red.status, 200);
  assert.ok(red.body.redactie.length > 20, 'de eindredacteur geeft echte redactie');
  // en het stuk staat na dit alles nog steeds gewoon op concept: de AI publiceert nooit
  const r = await api('/api/office/redactie', {}, office);
  assert.equal(r.body.artikelen.find(a => a.id === mk.body.artikel.id).status, 'concept');
});
