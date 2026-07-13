/* Integratietests voor RTG Zakelijk (de LinkedIn-laag van de Business Pass):
   profiel (opt-in), gids, professioneel verbinden via de bestaande
   vriendengraaf, de zakelijke feed en aanbevelingen. Draait tegen een echte
   server. Draai los: node --experimental-sqlite --test test/zakelijk.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zakelijk-'));
let child;

function post(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

// registreer een echt account met een eigen sessie (elke pas zijn eigen sleutel)
async function lid(naam, email, tier) {
  const d = await json(await post('/api/auth/register', {
    name: naam, email, phone: '0612345678', password: 'geheim123',
    geboortedatum: '1990-01-01', tier
  }));
  assert.ok(d.token, 'registratie geeft een sessietoken');
  return { token: d.token, codename: d.state.user.codename };
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('Lifestyle en Business komen binnen; de basis-pas niet; profiel is opt-in', async () => {
  const a = await lid('Anna Bakker', 'anna@x.nl', 'business');
  const l = await lid('Lars Visser', 'lars@x.nl', 'lifestyle');
  const r = await lid('Roos de Wit', 'roos@x.nl', 'rtg');
  // een Lifestyle-lid komt gewoon binnen
  assert.equal((await post('/api/zakelijk/profiel', {}, l.token)).status, 200);
  assert.equal((await post('/api/zakelijk/gids', {}, l.token)).status, 200);
  // de basis-pas (RTG Pass) niet
  assert.equal((await post('/api/zakelijk/profiel', {}, r.token)).status, 403);
  assert.equal((await post('/api/zakelijk/gids', {}, r.token)).status, 403);
  // zonder profiel: gids leeg, feed meldt dat het profiel er nog niet is
  const feed0 = await json(await post('/api/zakelijk/feed', {}, a.token));
  assert.equal(feed0.mijnProfiel, false);
  // profiel zonder kop wordt geweigerd; met kop lukt het
  assert.equal((await post('/api/zakelijk/profiel/zet', { naam: 'Anna' }, a.token)).status, 400);
  const zet = await json(await post('/api/zakelijk/profiel/zet', {
    naam: 'Anna Bakker', kop: 'Oprichter Bakkerij De Zon', sector: 'Horeca', plaats: 'Utrecht',
    vaardigheden: ['Brood', 'Ondernemen', 'Marketing'], ervaring: ['2019-nu: eigenaar De Zon'],
    bio: 'Bakker met een missie.', openVoorWerk: false
  }, a.token));
  assert.ok(zet.ok);
});

test('gids: zoeken, verbinden via de vriendengraaf, en zichtbaarheid uitzetten', async () => {
  const a = await lid('Bram Kok', 'bram@x.nl', 'business');
  const b = await lid('Cato Smit', 'cato@x.nl', 'business');
  await post('/api/zakelijk/profiel/zet', { kop: 'Fotograaf', sector: 'Media', vaardigheden: ['Fotografie', 'Video'] }, a.token);
  await post('/api/zakelijk/profiel/zet', { kop: 'Jurist ondernemingsrecht', sector: 'Juridisch', vaardigheden: ['Contracten'] }, b.token);

  // zoeken op sector vindt de jurist, niet de fotograaf
  const gids = await json(await post('/api/zakelijk/gids', { q: 'juridisch' }, a.token));
  assert.equal(gids.resultaten.length, 1);
  assert.equal(gids.resultaten[0].kop, 'Jurist ondernemingsrecht');
  assert.equal(gids.resultaten[0].status, 'geen');
  const bKey = gids.resultaten[0].key;

  // verbinden: verzoek gaat via de bestaande vriendengraaf
  const con = await json(await post('/api/zakelijk/connect', { key: bKey }, a.token));
  assert.equal(con.status, 'aangevraagd');
  // B ziet het verzoek in zijn gewone Contacten en accepteert daar
  const conns = await json(await post('/api/member/connections', {}, b.token));
  assert.equal(conns.requests.length, 1);
  await post('/api/member/connect/respond', { key: conns.requests[0].key, action: 'accept' }, b.token);
  const gids2 = await json(await post('/api/zakelijk/gids', { q: 'juridisch' }, a.token));
  assert.equal(gids2.resultaten[0].status, 'verbonden');

  // B zet zijn profiel op onzichtbaar: hij verdwijnt uit de gids
  await post('/api/zakelijk/profiel/zet', { kop: 'Jurist ondernemingsrecht', zichtbaar: false }, b.token);
  const gids3 = await json(await post('/api/zakelijk/gids', { q: 'juridisch' }, a.token));
  assert.equal(gids3.resultaten.length, 0, 'onzichtbaar profiel staat niet in de gids');
  // en verbinden met een onzichtbaar profiel kan niet meer
  assert.equal((await post('/api/zakelijk/connect', { key: bKey }, a.token)).status, 404);
});

test('feed: posten vereist een profiel; liken en reageren werken', async () => {
  const a = await lid('Dirk Mol', 'dirk@x.nl', 'business');
  const b = await lid('Eva Riet', 'eva@x.nl', 'business');
  // posten zonder profiel: nette 409 met de reden
  const zonder = await post('/api/zakelijk/post', { tekst: 'Hallo!' }, a.token);
  assert.equal(zonder.status, 409);
  assert.equal((await zonder.json()).needProfiel, true);

  await post('/api/zakelijk/profiel/zet', { kop: 'Investeerder', vaardigheden: ['Financiering'] }, a.token);
  await post('/api/zakelijk/profiel/zet', { kop: 'Ontwerper', vaardigheden: ['UX'] }, b.token);
  const p = await json(await post('/api/zakelijk/post', { tekst: 'Wie bouwt er mee aan duurzame horeca?' }, a.token));
  assert.ok(p.ok && p.id);

  // B ziet de post, liket en reageert
  const feed = await json(await post('/api/zakelijk/feed', {}, b.token));
  const post0 = feed.posts.find(x => x.id === p.id);
  assert.ok(post0 && post0.kop === 'Investeerder');
  const like = await json(await post('/api/zakelijk/like', { id: p.id }, b.token));
  assert.equal(like.likes, 1);
  const re = await json(await post('/api/zakelijk/reactie', { id: p.id, tekst: 'Ik! Stuur me een DM.' }, b.token));
  assert.equal(re.reactiesTotaal, 1);
  // nogmaals liken = intrekken
  const like2 = await json(await post('/api/zakelijk/like', { id: p.id }, b.token));
  assert.equal(like2.likes, 0);
});

test('aanbevelingen: alleen verbonden leden, alleen bestaande vaardigheden', async () => {
  const a = await lid('Fien Bos', 'fien@x.nl', 'business');
  const b = await lid('Gijs Kamp', 'gijs@x.nl', 'business');
  await post('/api/zakelijk/profiel/zet', { kop: 'Marketeer', vaardigheden: ['SEO', 'Copywriting'] }, a.token);
  await post('/api/zakelijk/profiel/zet', { kop: 'Developer', vaardigheden: ['Node.js'] }, b.token);
  const gids = await json(await post('/api/zakelijk/gids', { q: 'marketeer' }, b.token));
  const aKey = gids.resultaten[0].key;

  // niet verbonden: aanbevelen wordt geweigerd
  assert.equal((await post('/api/zakelijk/aanbevelen', { key: aKey, vaardigheid: 'SEO' }, b.token)).status, 403);
  // verbind en accepteer
  await post('/api/zakelijk/connect', { key: aKey }, b.token);
  const conns = await json(await post('/api/member/connections', {}, a.token));
  await post('/api/member/connect/respond', { key: conns.requests[0].key, action: 'accept' }, a.token);
  // een vaardigheid die niet op het profiel staat: 404
  assert.equal((await post('/api/zakelijk/aanbevelen', { key: aKey, vaardigheid: 'Toveren' }, b.token)).status, 404);
  // en een echte: telt op het profiel
  const r = await json(await post('/api/zakelijk/aanbevelen', { key: aKey, vaardigheid: 'SEO' }, b.token));
  assert.ok(r.aanbevolen && r.aantal === 1);
  const gids2 = await json(await post('/api/zakelijk/gids', { q: 'marketeer' }, b.token));
  const seo = gids2.resultaten[0].vaardigheden.find(v => v.naam === 'SEO');
  assert.equal(seo.aanbevolen, 1);
  assert.equal(seo.doorMij, true);
  // nogmaals klikken trekt de aanbeveling in
  const r2 = await json(await post('/api/zakelijk/aanbevelen', { key: aKey, vaardigheid: 'SEO' }, b.token));
  assert.equal(r2.aanbevolen, false);
});

test('gids: gedeelde connecties tellen mee en het open-voor-werk-filter werkt', async () => {
  // A kent B en C; dan zien B en C elkaar in de gids met 1 gedeelde connectie (A)
  const a = await lid('Hans Roos', 'hans@x.nl', 'lifestyle');
  const b = await lid('Iris Valk', 'iris@x.nl', 'business');
  const c = await lid('Job Steen', 'job@x.nl', 'lifestyle');
  await post('/api/zakelijk/profiel/zet', { kop: 'Coach', openVoorWerk: false }, a.token);
  await post('/api/zakelijk/profiel/zet', { kop: 'Accountant', openVoorWerk: true }, b.token);
  await post('/api/zakelijk/profiel/zet', { kop: 'Tolk', openVoorWerk: false }, c.token);
  const keyVan = async (token, q) => (await json(await post('/api/zakelijk/gids', { q }, token))).resultaten[0].key;
  const verbind = async (van, naarKey, acceptToken) => {
    await post('/api/zakelijk/connect', { key: naarKey }, van);
    const conns = await json(await post('/api/member/connections', {}, acceptToken));
    await post('/api/member/connect/respond', { key: conns.requests[0].key, action: 'accept' }, acceptToken);
  };
  await verbind(a.token, await keyVan(a.token, 'accountant'), b.token);
  await verbind(a.token, await keyVan(a.token, 'tolk'), c.token);
  // B zoekt de tolk: 1 gedeelde connectie, met de codenaam van A erbij
  const gids = await json(await post('/api/zakelijk/gids', { q: 'tolk' }, b.token));
  assert.equal(gids.resultaten[0].gedeeld, 1);
  assert.deepEqual(gids.resultaten[0].gedeeldNamen, [a.codename]);
  // het open-voor-werk-filter houdt alleen de accountant over
  const open = await json(await post('/api/zakelijk/gids', { openVoorWerk: true }, c.token));
  assert.ok(open.resultaten.length >= 1);
  assert.ok(open.resultaten.every(p => p.openVoorWerk), 'alle resultaten zijn open voor werk');
  // en de pas staat op het profiel (Lifestyle/Business zichtbaar in de gids)
  assert.equal(gids.resultaten[0].pas, 'lifestyle');
});

test('kansenbord: plaatsen, filteren, reageren, sluiten; partner-vacatures lopen mee', async () => {
  const a = await lid('Kim Laan', 'kim@x.nl', 'business');
  const b = await lid('Leo Berg', 'leo@x.nl', 'lifestyle');
  // zonder profiel geen kans plaatsen
  assert.equal((await post('/api/zakelijk/kans', { titel: 'X' }, a.token)).status, 409);
  await post('/api/zakelijk/profiel/zet', { kop: 'Uitgever' }, a.token);
  await post('/api/zakelijk/profiel/zet', { kop: 'Illustrator' }, b.token);
  // zonder titel geweigerd; daarna geplaatst
  assert.equal((await post('/api/zakelijk/kans', { soort: 'opdracht' }, a.token)).status, 400);
  const k = await json(await post('/api/zakelijk/kans', { soort: 'opdracht', titel: 'Illustrator gezocht voor kinderboek',
    omschrijving: 'Serie van 12 illustraties.', plaats: 'Utrecht', skills: ['Illustratie'] }, a.token));
  assert.ok(k.ok && k.id);

  // B vindt de kans (filter op soort) en de partner-vacatures lopen mee in de lijst
  const lijst = await json(await post('/api/zakelijk/kansen', { soort: 'opdracht' }, b.token));
  const kans = lijst.kansen.find(x => x.id === k.id);
  assert.ok(kans && kans.vanMij === false);
  const alles = await json(await post('/api/zakelijk/kansen', {}, b.token));
  assert.ok(Array.isArray(alles.partnerVacatures), 'partner-vacatures zitten in het antwoord');

  // B reageert; A ziet de reactie; op je eigen kans reageren kan niet
  assert.equal((await post('/api/zakelijk/kans/reageer', { id: k.id, tekst: 'Mag ik?' }, a.token)).status, 400);
  const re = await json(await post('/api/zakelijk/kans/reageer', { id: k.id, tekst: 'Dit is precies mijn stijl; portfolio via DM.' }, b.token));
  assert.equal(re.reactiesTotaal, 1);
  const mijn = await json(await post('/api/zakelijk/kansen', {}, a.token));
  assert.equal(mijn.kansen.find(x => x.id === k.id).reacties.length, 1);

  // alleen de plaatser sluit; daarna is de kans dicht en reageren onmogelijk
  assert.equal((await post('/api/zakelijk/kans/sluit', { id: k.id }, b.token)).status, 403);
  assert.equal((await post('/api/zakelijk/kans/sluit', { id: k.id }, a.token)).status, 200);
  assert.equal((await post('/api/zakelijk/kans/reageer', { id: k.id, tekst: 'te laat' }, b.token)).status, 409);
  // de gesloten kans is voor anderen weg, maar de plaatser ziet hem nog (vervuld)
  const na = await json(await post('/api/zakelijk/kansen', {}, b.token));
  assert.ok(!na.kansen.some(x => x.id === k.id));
  const naA = await json(await post('/api/zakelijk/kansen', {}, a.token));
  assert.equal(naA.kansen.find(x => x.id === k.id).open, false);
});
