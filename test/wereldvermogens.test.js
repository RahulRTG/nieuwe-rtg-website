/* De vermogens van de Lifestyle- en Business Pass die eerst alleen een NAAM in
   rechten.js hadden: geavanceerd zoeken, netwerkanalyse en "wie bekeek mijn
   profiel".

   De belangrijkste bewering staat in het midden: ZOEKEN VINDT ALLEEN WAT JE MAG
   ZIEN. Dat wordt hier niet getoetst door te kijken of er een uitslag komt,
   maar door hetzelfde lid twee keer te zoeken met alleen de zichtbaarheid
   ertussen veranderd. Een zoekmachine die matcht op een veld dat hij daarna
   niet toont, is een lek met een nette voorkant.

   Draai los: node --experimental-sqlite --test test/wereldvermogens.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, elevateTier } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wverm-'));

function post(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

async function lid(naam, email, tier) {
  const regTier = (tier === 'lifestyle' || tier === 'business') ? 'rtg' : tier;
  const d = await json(await post('/api/auth/register', {
    name: naam, email, phone: '0612345678', password: 'geheim123',
    geboortedatum: '1990-01-01', tier: regTier
  }));
  assert.ok(d.token, 'registratie geeft een sessietoken');
  if (regTier !== tier) {
    const office = (await json(await post('/api/office/login', { code: 'RTG-OFFICE' }))).token;
    await elevateTier(BASE, d.token, tier, office);
  }
  const mij = await json(await post('/api/member/connections', {}, d.token));
  const p = await json(await post('/api/metier/ik', {}, d.token));
  return { token: d.token, codenaam: p.profiel.codenaam, key: mij.me };
}
const verbind = async (a, b) => {
  await post('/api/member/connect', { key: b.key }, a.token);
  await post('/api/member/connect/respond', { key: a.key, action: 'accept' }, b.token);
};

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* ---------- de poort: dit hoort bij een andere pas ---------- */

test('de drie vermogens zijn dicht voor de gratis pas en open voor Lifestyle', async () => {
  const g = await lid('Verm Gratis', 'v1@x.nl', 'rtg');
  const l = await lid('Verm Lief', 'v2@x.nl', 'lifestyle');

  for (const [pad, body] of [['/api/wereld/zoek', { q: 'x' }],
    ['/api/wereld/introductie', { codenaam: l.codenaam }],
    ['/api/wereld/bezoekers', {}]]) {
    const dicht = await post(pad, body, g.token);
    assert.equal(dicht.status, 403, pad + ' hoort dicht te zijn voor een gratis pas');
    assert.match((await json(dicht)).error, /Lifestyle en Business/);
    assert.equal((await post(pad, body, l.token)).status, 200, pad + ' hoort open te zijn voor Lifestyle');
  }
});

/* ---------- zoeken vindt alleen wat je mag zien ---------- */

test('zoeken op een AFGESCHERMD veld vindt niets, op hetzelfde veld open wel', async () => {
  /* Dezelfde persoon, dezelfde zoekterm, alleen de zichtbaarheid ertussen
     veranderd. Zo kan de toets niet slagen om een andere reden. */
  const doel = await lid('Zoek Doel', 's1@x.nl', 'business');
  const zoeker = await lid('Zoek Zoeker', 's2@x.nl', 'business');   // geen contact

  await post('/api/zakelijk/profiel/zet',
    { naam: 'D', kop: 'Scheepsbouwer', sector: 'Maritiem' }, doel.token);

  const treffers = async (filter) =>
    (await json(await post('/api/wereld/zoek', filter, zoeker.token))).treffers
      .filter(t => t.codenaam === doel.codenaam);

  // sector staat standaard op 'iedereen': te vinden
  assert.equal((await treffers({ sector: 'Maritiem' })).length, 1, 'open sector is vindbaar');

  // nu afschermen -- en dan mag dezelfde zoekopdracht hem niet meer vinden
  await post('/api/wereld/profiel/zicht', { pad: 'professioneel.sector', niveau: 'alleenik' }, doel.token);
  assert.equal((await treffers({ sector: 'Maritiem' })).length, 0,
    'een afgeschermde sector is niet op sector te vinden');

  // en ook de vrije zoekterm mag er niet omheen lopen
  assert.equal((await treffers({ q: 'maritiem' })).length, 0,
    'de vrije term mag niet matchen op een veld dat je niet mag zien');

  // wat wel open staat, blijft gewoon werken -- anders bewijst het bovenstaande
  // alleen dat zoeken kapot is
  assert.equal((await treffers({ q: 'scheepsbouwer' })).length, 1,
    'op een veld dat wel open staat is hij nog steeds te vinden');
});

test('de uitslag bevat alleen velden die de zoeker mag zien', async () => {
  const doel = await lid('Uit Doel', 's3@x.nl', 'business');
  const zoeker = await lid('Uit Zoeker', 's4@x.nl', 'business');

  await post('/api/salon/bio', { bio: 'Mijn persoonlijke verhaal.', plaats: 'Ibiza' }, doel.token);
  await post('/api/zakelijk/profiel/zet', { naam: 'D', kop: 'Kapitein' }, doel.token);

  const t = (await json(await post('/api/wereld/zoek', { q: 'kapitein' }, zoeker.token)))
    .treffers.find(x => x.codenaam === doel.codenaam);
  assert.ok(t, 'het lid staat in de uitslag');

  const paden = t.velden.map(v => v.pad);
  assert.ok(paden.includes('professioneel.kop'), 'de kop staat erbij (die is open)');
  assert.ok(!paden.includes('persoonlijk.over'),
    'de persoonlijke bio staat standaard op contacten en hoort er dus niet in');
  assert.ok(!JSON.stringify(t).includes('persoonlijke verhaal'),
    'en de waarde lekt nergens in de uitslag');
});

/* ---------- netwerkanalyse ---------- */

test('netwerkanalyse noemt wie je kan introduceren, op codenaam en begrensd', async () => {
  const ik = await lid('Intro Ik', 'n1@x.nl', 'business');
  const brug = await lid('Intro Brug', 'n2@x.nl', 'rtg');
  const doel = await lid('Intro Doel', 'n3@x.nl', 'business');
  const vreemde = await lid('Intro Vreemde', 'n4@x.nl', 'rtg');

  await verbind(ik, brug);
  await verbind(brug, doel);

  const r = await json(await post('/api/wereld/introductie', { codenaam: doel.codenaam }, ik.token));
  assert.equal(r.aantal, 1, 'er is precies één gedeelde connectie');
  assert.deepEqual(r.via, [brug.codenaam], 'en dat is de brug, op codenaam');
  assert.ok(!JSON.stringify(r).includes(brug.key), 'er staat nergens een sleutel in');

  // zonder gedeelde connectie is het antwoord leeg en niet "iemand"
  const geen = await json(await post('/api/wereld/introductie', { codenaam: vreemde.codenaam }, ik.token));
  assert.equal(geen.aantal, 0);
  assert.deepEqual(geen.via, []);

  assert.equal((await post('/api/wereld/introductie', { codenaam: 'BestaatNiet9' }, ik.token)).status, 404);
});

/* ---------- wie bekeek mijn profiel ---------- */

test('een profielbezoek wordt genoteerd, en de kijker krijgt dat te horen', async () => {
  const ik = await lid('Bez Ik', 'b1@x.nl', 'lifestyle');
  const kijker = await lid('Bez Kijker', 'b2@x.nl', 'rtg');

  const leeg = await json(await post('/api/wereld/bezoekers', {}, ik.token));
  assert.equal(leeg.totaal, 0, 'nog niemand langs geweest');

  const bezoek = await json(await post('/api/wereld/profiel/van', { codenaam: ik.codenaam }, kijker.token));
  assert.equal(bezoek.bezoekGenoteerd, true,
    'de kijker hoort te weten dat zijn bezoek is genoteerd -- er is geen sluipstand');

  const na = await json(await post('/api/wereld/bezoekers', {}, ik.token));
  assert.equal(na.totaal, 1);
  assert.equal(na.bezoekers[0].codenaam, kijker.codenaam, 'op codenaam');
  assert.equal(na.bezoekers[0].keer, 1);
  assert.ok(!JSON.stringify(na).includes(kijker.key), 'nooit een sleutel');

  // twee keer kijken is EEN regel met een teller, geen tweede regel
  await post('/api/wereld/profiel/van', { codenaam: ik.codenaam }, kijker.token);
  const na2 = await json(await post('/api/wereld/bezoekers', {}, ik.token));
  assert.equal(na2.totaal, 1, 'nog steeds één bezoeker');
  assert.equal(na2.bezoekers[0].keer, 2, 'maar wel twee keer geteld');
});

test('je eigen profiel openen telt niet mee', async () => {
  const ik = await lid('Zelf Ik', 'b3@x.nl', 'lifestyle');
  const r = await json(await post('/api/wereld/profiel/van', { codenaam: ik.codenaam }, ik.token));
  assert.equal(r.bezoekGenoteerd, false, 'jezelf bekijken is geen bezoek');
  assert.equal((await json(await post('/api/wereld/bezoekers', {}, ik.token))).totaal, 0,
    'en je staat niet op je eigen lijst');
});
