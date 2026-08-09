/* Het profiel met lagen, en de kern ervan: WIE WAT MAG ZIEN, per veld.

   Waarom de zichtbaarheden hier op DEZELFDE vier mensen naast elkaar staan:
   dat is de enige manier om te bewijzen dat ze echt iets verschillends doen. In
   rechten.js stonden er eerst zes, met 'vrienden' naast 'contacten' -- twee
   knoppen die precies dezelfde mensen aanwijzen, want dit huis heeft één
   vriendengraaf. Een toets die elk niveau apart afvinkt had dat nooit gezien;
   een toets die ze op één opstelling naast elkaar legt wel.

   Draai los: node --experimental-sqlite --test test/wereldprofiel.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, elevateTier } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wprofiel-'));

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
  /* De LIVE codenaam (via /api/metier/ik), niet die uit het registratie-antwoord.
     Dat is de naam die de gids kent en die de app zelf toont -- dus ook de naam
     waar een gebruiker op tikt. Op de registratienaam toetsen zou iets anders
     bewijzen dan wat er in het echt gebeurt. */
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

test('het profiel leest uit de bestaande apps en bewaart zelf geen kopie', async () => {
  const l = await lid('Profiel Lid', 'p1@x.nl', 'lifestyle');
  // de bio wordt in DE SALON gezet, niet hier
  await post('/api/salon/bio', { bio: 'Ik vaar graag.', plaats: 'Ibiza' }, l.token);
  await post('/api/zakelijk/profiel/zet', { naam: 'P', kop: 'Schipper', sector: 'Maritiem' }, l.token);

  const p = await json(await post('/api/wereld/profiel', {}, l.token));
  const veld = (pad) => p.lagen.flatMap(x => x.velden).find(v => v.pad === pad);

  assert.equal(veld('persoonlijk.over').waarde, 'Ik vaar graag.', 'de Salon-bio komt door');
  assert.equal(veld('professioneel.kop').waarde, 'Schipper', 'de zakelijke kop komt door');

  // en het is echt een LEESLAAG: wijzig de bron, en het profiel volgt meteen
  await post('/api/salon/bio', { bio: 'Toch liever bergen.', plaats: 'Ibiza' }, l.token);
  const p2 = await json(await post('/api/wereld/profiel', {}, l.token));
  assert.equal(p2.lagen.flatMap(x => x.velden).find(v => v.pad === 'persoonlijk.over').waarde,
    'Toch liever bergen.', 'het profiel houdt geen eigen kopie aan');

  // de laag zegt waar je hem wijzigt; er is hier geen invoerveld
  const laag = p.lagen.find(x => x.laag === 'persoonlijk');
  assert.equal(laag.bron.app, '/apps/salon.html', 'de bron van de laag wijst naar De Salon');
});

test('de profiellagen volgen de pas: een gratis lid heeft er één, Business vier', async () => {
  const g = await lid('Laag Gratis', 'p2@x.nl', 'rtg');
  const b = await lid('Laag Baas', 'p3@x.nl', 'business');
  const lagen = async t => (await json(await post('/api/wereld/profiel', {}, t))).lagen.map(l => l.laag);

  assert.deepEqual(await lagen(g.token), ['persoonlijk']);
  assert.deepEqual(await lagen(b.token), ['persoonlijk', 'professioneel', 'creator', 'ondernemer']);

  // en zichtbaarheid zetten op een laag die je niet hebt, mag niet
  const r = await post('/api/wereld/profiel/zicht', { pad: 'professioneel.kop', niveau: 'iedereen' }, g.token);
  assert.equal(r.status, 400, 'een gratis pas zet niets op de professionele laag');
  assert.match((await json(r)).error, /andere pas/);
});

test('de vijf zichtbaarheden wijzen elk een ANDERE groep aan', async () => {
  /* Eén opstelling, vier kijkers, en per niveau kijken we wie het veld ziet.
     Ik (I) heeft:
       - C  een contact, zonder zakelijk profiel
       - Z  een contact MET zakelijk profiel
       - G  geen contact, maar wel samen in een genootschap
       - V  een vreemde
     Zou 'zakelijk' hetzelfde betekenen als 'contacten', dan zag C hem ook --
     dat is precies de dubbeling die hier moet zakken. */
  const I = await lid('Zicht Ik', 'z0@x.nl', 'business');
  const C = await lid('Zicht Contact', 'z1@x.nl', 'rtg');
  const Z = await lid('Zicht Zakelijk', 'z2@x.nl', 'business');
  const G = await lid('Zicht Genoot', 'z3@x.nl', 'rtg');
  const V = await lid('Zicht Vreemde', 'z4@x.nl', 'rtg');

  await verbind(I, C);
  await verbind(I, Z);
  await post('/api/salon/bio', { bio: 'Mijn verhaal.', plaats: 'Ibiza' }, I.token);
  // I en Z hebben allebei een zakelijk profiel; C bewust niet
  await post('/api/zakelijk/profiel/zet', { naam: 'I', kop: 'Oprichter' }, I.token);
  await post('/api/zakelijk/profiel/zet', { naam: 'Z', kop: 'Investeerder' }, Z.token);

  // I en G zitten samen in een genootschap
  const gen = await json(await post('/api/genootschap/richt-op',
    { naam: 'De Zeilers', soort: 'besloten' }, I.token));
  const groep = gen.groep && gen.groep.id;
  assert.ok(groep, 'het genootschap is opgericht: ' + JSON.stringify(gen).slice(0, 140));
  const uitn = await json(await post('/api/genootschap/nodig-uit', { groep, wie: G.codenaam }, I.token));
  assert.ok(!uitn.error, 'G is uitgenodigd: ' + JSON.stringify(uitn).slice(0, 140));
  const binnen = await json(await post('/api/genootschap/binnen', { groep }, G.token));
  assert.ok(!binnen.error, 'G treedt binnen: ' + JSON.stringify(binnen).slice(0, 140));

  const ziet = async (kijker) => {
    const r = await json(await post('/api/wereld/profiel/van', { codenaam: I.codenaam }, kijker.token));
    return r.lagen.flatMap(l => l.velden).some(v => v.pad === 'persoonlijk.over');
  };
  const zet = (niveau) => post('/api/wereld/profiel/zicht', { pad: 'persoonlijk.over', niveau }, I.token);

  await zet('iedereen');
  assert.deepEqual([await ziet(C), await ziet(Z), await ziet(G), await ziet(V)], [true, true, true, true],
    'iedereen: alle vier zien het');

  await zet('contacten');
  assert.deepEqual([await ziet(C), await ziet(Z), await ziet(G), await ziet(V)], [true, true, false, false],
    'contacten: alleen de twee verbindingen');

  await zet('zakelijk');
  assert.deepEqual([await ziet(C), await ziet(Z), await ziet(G), await ziet(V)], [false, true, false, false],
    'zakelijk: alleen het contact dat OOK een zakelijk profiel heeft');

  await zet('genootschap');
  assert.deepEqual([await ziet(C), await ziet(Z), await ziet(G), await ziet(V)], [false, false, true, false],
    'genootschap: alleen wie een genootschap met me deelt');

  await zet('alleenik');
  assert.deepEqual([await ziet(C), await ziet(Z), await ziet(G), await ziet(V)], [false, false, false, false],
    'alleenik: niemand');

  // en ik zie mijn eigen veld in elke stand
  const eigen = await json(await post('/api/wereld/profiel/van', { codenaam: I.codenaam }, I.token));
  assert.ok(eigen.lagen.flatMap(l => l.velden).some(v => v.pad === 'persoonlijk.over'),
    'op alleenik zie ik mijn eigen veld nog steeds');
});

test('een afgeschermd veld is niet te onderscheiden van een leeg veld', async () => {
  /* Anders is de zichtbaarheid zelf een lek: "hij heeft wel iets ingevuld, maar
     niet voor jou" is ook informatie. */
  const A = await lid('Lek A', 'l1@x.nl', 'rtg');
  const B = await lid('Lek B', 'l2@x.nl', 'rtg');   // vreemde
  const leeg = await lid('Lek Leeg', 'l3@x.nl', 'rtg');  // vult niets in

  await post('/api/salon/bio', { bio: 'Een geheim.', plaats: 'Ibiza' }, A.token);
  await post('/api/wereld/profiel/zicht', { pad: 'persoonlijk.over', niveau: 'alleenik' }, A.token);

  const vanA = await json(await post('/api/wereld/profiel/van', { codenaam: A.codenaam }, B.token));
  const vanLeeg = await json(await post('/api/wereld/profiel/van', { codenaam: leeg.codenaam }, B.token));
  const paden = r => r.lagen.flatMap(l => l.velden).map(v => v.pad);

  assert.ok(!paden(vanA).includes('persoonlijk.over'), 'het afgeschermde veld ontbreekt');
  assert.deepEqual(paden(vanA), paden(vanLeeg),
    'afgeschermd en niet-ingevuld zien er van buiten identiek uit');
  // en de waarde lekt nergens in het antwoord
  assert.ok(!JSON.stringify(vanA).includes('Een geheim'), 'de waarde staat niet in het antwoord');
});

test('de standaarden zijn een besluit: persoonlijk staat dicht, professioneel open', async () => {
  const I = await lid('Std Ik', 's1@x.nl', 'business');
  const V = await lid('Std Vreemde', 's2@x.nl', 'rtg');
  await post('/api/salon/bio', { bio: 'Persoonlijk.', plaats: 'Ibiza' }, I.token);
  await post('/api/zakelijk/profiel/zet', { naam: 'I', kop: 'Oprichter' }, I.token);

  // niets ingesteld: de standaarden gelden
  const r = await json(await post('/api/wereld/profiel/van', { codenaam: I.codenaam }, V.token));
  const paden = r.lagen.flatMap(l => l.velden).map(v => v.pad);
  assert.ok(!paden.includes('persoonlijk.over'), 'over mij staat standaard niet open voor een vreemde');
  assert.ok(paden.includes('professioneel.kop'), 'de functiekop staat standaard wel open');
});

test('een onbekend veld of niveau wordt geweigerd, en niet stil genegeerd', async () => {
  const l = await lid('Weiger Lid', 'w1@x.nl', 'business');
  assert.equal((await post('/api/wereld/profiel/zicht', { pad: 'bestaat.niet', niveau: 'iedereen' }, l.token)).status, 400);
  assert.equal((await post('/api/wereld/profiel/zicht', { pad: 'persoonlijk.over', niveau: 'stiekem' }, l.token)).status, 400);
  // 'vrienden' bestond ooit en is bewust weg: hij mag niet stil weer werken
  assert.equal((await post('/api/wereld/profiel/zicht', { pad: 'persoonlijk.over', niveau: 'vrienden' }, l.token)).status, 400,
    'het verwijderde niveau wordt geweigerd');
  assert.equal((await post('/api/wereld/profiel/van', { codenaam: 'BestaatNiet9' }, l.token)).status, 404);
});
