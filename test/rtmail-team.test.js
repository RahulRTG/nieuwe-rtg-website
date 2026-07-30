/* RTMAIL-teams: een adres dat meerdere mensen samen lezen (receptie@partner.rtg).
   Toetst de vier beloftes van kern/rtmail-team.js: het adres volgt de oprichter,
   een team kaapt nooit een bestaand postvak, toewijzen voorkomt dubbel werk, en
   wie namens het team schrijft staat er altijd bij.
   Draai: node --experimental-sqlite --test test/rtmail-team.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child, baas, maat, baasCode, maatCode, teamId, teamAdres;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-team-'));

async function api(pad, body, tok) {
  const headers = { 'Content-Type': 'application/json' };
  if (tok) headers['Authorization'] = 'Bearer ' + tok;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();
const t = Date.now();
async function nieuwLid(naam, staart) {
  const r = await json(await api('/api/auth/register', { name: naam, email: naam + t + '@team.test',
    phone: '06' + String(t).slice(-7) + staart, password: 'geheim123', geboortedatum: '1990-03-03', tier: 'rtg' }));
  return r.token;
}
/* De codenaam zoals hij op het scherm staat ("Gouden Panter 2679") -- dat is
   ook wat je in het toevoegveld typt. Het linkerdeel van het adres is een
   afgeleide daarvan ("gouden-panter-2679") en dus niet hetzelfde. */
const codenaamVan = async (tok) => (await json(await api('/api/state', {}, tok))).state.user.codename;
const adresDeelVan = async (tok) => (await json(await api('/api/member/rtmail/adres', {}, tok))).adres.split('@')[0];

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  baas = await nieuwLid('Teambaas', '1');
  maat = await nieuwLid('Teammaat', '2');
  assert.ok(baas && maat, 'twee leden aangemeld');
  // het scherm toont codenamen, dus de toets werkt ook op codenamen
  baasCode = await codenaamVan(baas);
  maatCode = await codenaamVan(maat);
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een team krijgt het domein van de oprichter, nooit een gekozen domein', async () => {
  const d = await json(await api('/api/member/rtmail/team/maak',
    { naam: 'De Receptie', adres: 'receptie', domein: 'gouvernement.rtg' }, baas));
  assert.ok(d.ok, 'het team is opgericht: ' + JSON.stringify(d));
  teamId = d.team.id;
  teamAdres = d.team.adres;
  // de oprichter is een RTG Pass-lid, dus rtgpass.rtg -- het meegestuurde
  // "domein" in de body wordt genegeerd; een domein is een feit, geen keuze
  assert.equal(teamAdres, 'receptie@rtgpass.rtg');
  assert.equal(d.team.ikBenEigenaar, true);
  assert.equal(d.team.aantalLeden, 1);
});

test('een team kan het postvak van een persoon of een zaak niet kapen', async () => {
  // 1. de vorm van een codenaam (woord + vier hex) is dicht -- in beide vormen:
  //    zoals hij op het scherm staat, en zoals hij in een adres zou landen
  for (const vorm of [maatCode, await adresDeelVan(maat)]) {
    const alsLid = await json(await api('/api/member/rtmail/team/maak', { naam: 'Kaper', adres: vorm }, baas));
    assert.ok(alsLid.error, 'een codenaam mag geen teamadres worden: ' + vorm);
    assert.match(alsLid.error, /codenaam/i);
  }

  // 2. een zaakcode ook niet (SAKURA is een demo-partner)
  const alsZaak = await json(await api('/api/member/rtmail/team/maak', { naam: 'Kaper 2', adres: 'sakura' }, baas));
  assert.ok(alsZaak.error, 'een zaakcode mag geen teamadres worden');

  // 3. en een naam die het huis zelf gebruikt evenmin
  const systeem = await json(await api('/api/member/rtmail/team/maak', { naam: 'Kaper 3', adres: 'postmaster' }, baas));
  assert.ok(systeem.error, 'gereserveerde namen blijven van het huis');

  // 4. tweemaal hetzelfde adres kan niet
  const twee = await json(await api('/api/member/rtmail/team/maak', { naam: 'Receptie 2', adres: 'receptie' }, baas));
  assert.match(twee.error || '', /bestaat al/);
});

test('alleen leden komen in het gedeelde postvak', async () => {
  const dicht = await json(await api('/api/member/rtmail/team/postvak', { id: teamId }, maat));
  assert.match(dicht.error || '', /niet in dit team/, 'een gedeeld adres is geen openbaar adres');

  const erbij = await json(await api('/api/member/rtmail/team/lid', { id: teamId, codenaam: maatCode }, baas));
  assert.ok(erbij.ok, 'de eigenaar zet iemand erbij: ' + JSON.stringify(erbij));
  assert.equal(erbij.leden, 2);

  const open = await json(await api('/api/member/rtmail/team/postvak', { id: teamId }, maat));
  assert.ok(open.ok, 'nu mag hij erin');
  assert.ok(Array.isArray(open.berichten));

  // een ander lid kan niemand toevoegen -- dat is aan de eigenaar
  const stiekem = await json(await api('/api/member/rtmail/team/lid', { id: teamId, codenaam: baasCode }, maat));
  assert.match(stiekem.error || '', /eigenaar/);
});

test('de ledenlijst draagt codenamen, nooit sleutels of echte namen', async () => {
  const d = await json(await api('/api/member/rtmail/team/mijn', {}, maat));
  const team = (d.teams || []).find(x => x.id === teamId);
  assert.ok(team, 'het team staat in zijn lijst');
  const plat = JSON.stringify(team);
  assert.equal(/"key"/.test(plat), false, 'geen sleutels in de uitvoer: ' + plat);
  assert.equal(/Teambaas|Teammaat|team\.test/.test(plat), false, 'geen echte namen in de uitvoer: ' + plat);
  assert.ok(team.leden.some(l => l.ikZelf), 'je ziet wel welke van jou is');
});

test('toewijzen voorkomt dat twee mensen hetzelfde bericht beantwoorden', async () => {
  // post op het teamadres: het team stuurt naar zijn eigen adres, zodat er iets
  // in het gedeelde postvak ligt om te verdelen
  const heen = await json(await api('/api/member/rtmail/team/stuur',
    { id: teamId, naar: teamAdres, onderwerp: 'Vraag van een gast', tekst: 'Kan de late check-out?' }, baas));
  assert.ok(heen.ok, 'namens het team verstuurd: ' + JSON.stringify(heen));

  const vak = await json(await api('/api/member/rtmail/team/postvak', { id: teamId }, maat));
  const m = vak.berichten.find(x => /Vraag van een gast/.test(x.onderwerp));
  assert.ok(m, 'het bericht ligt in het gedeelde postvak');
  assert.equal(m.opgepakt, null, 'een bericht is van niemand tot iemand het oppakt');

  const pak = await json(await api('/api/member/rtmail/team/pak', { id: teamId, bericht: m.id }, maat));
  assert.equal(pak.opgepakt, true);

  // de ander ziet WIE het oppakte, en kan het niet stilletjes overnemen
  const bij = await json(await api('/api/member/rtmail/team/postvak', { id: teamId }, baas));
  const zelfde = bij.berichten.find(x => x.id === m.id);
  assert.equal(zelfde.opgepakt, maatCode, 'je ziet wie het doet, op codenaam');
  assert.equal(zelfde.doorMij, false);
  const kaap = await json(await api('/api/member/rtmail/team/pak', { id: teamId, bericht: m.id }, baas));
  assert.match(kaap.error || '', /al opgepakt/);

  // afhandelen haalt het uit de open lijst, maar niet uit de historie
  const af = await json(await api('/api/member/rtmail/team/af', { id: teamId, bericht: m.id }, maat));
  assert.equal(af.af, true);
  const open = await json(await api('/api/member/rtmail/team/postvak', { id: teamId }, maat));
  assert.equal(open.berichten.some(x => x.id === m.id), false, 'af is uit de open lijst');
  const alles = await json(await api('/api/member/rtmail/team/postvak', { id: teamId, alles: true }, maat));
  assert.equal(alles.berichten.some(x => x.id === m.id), true, 'maar niet weg');
});

test('het adres is gedeeld, de hand niet: wie schreef staat er altijd onder', async () => {
  const r = await json(await api('/api/member/rtmail/team/stuur',
    { id: teamId, naar: teamAdres, onderwerp: 'Geregeld', tekst: 'Het is geregeld.', anoniem: true, ondertekening: false }, maat));
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.namens, maatCode);
  // ook met "anoniem" en "ondertekening: false" in de body: er is geen schakelaar
  assert.match(r.bericht.tekst, new RegExp(maatCode + ', namens De Receptie'));
  assert.equal(r.bericht.van, teamAdres, 'het gaat wel degelijk vanaf het teamadres');
});

test('er is geen ranglijst van wie het meest afhandelt', async () => {
  const vak = await json(await api('/api/member/rtmail/team/postvak', { id: teamId, alles: true }, baas));
  const plat = JSON.stringify(vak);
  // structureel, niet op woorden: nergens een telling per persoon
  assert.equal(/"aantalAf"|"scoreVan"|"ranglijst"|"top"/.test(plat), false, plat.slice(0, 300));
  assert.equal(typeof vak.open, 'number', 'wel hoeveel er nog open staat -- dat is werk, geen wedstrijd');
});

test('wie erin gezet is, kan er zelf ook weer uit; de eigenaar niet', async () => {
  const eigenaar = await json(await api('/api/member/rtmail/team/verlaat', { id: teamId }, baas));
  assert.match(eigenaar.error || '', /eigenaar/, 'de eigenaar loopt niet zomaar weg uit zijn eigen postvak');

  const weg = await json(await api('/api/member/rtmail/team/verlaat', { id: teamId }, maat));
  assert.ok(weg.ok, JSON.stringify(weg));
  const dicht = await json(await api('/api/member/rtmail/team/postvak', { id: teamId }, maat));
  assert.match(dicht.error || '', /niet in dit team/);

  // en alleen de eigenaar heft het op
  const nee = await json(await api('/api/member/rtmail/team/hef', { id: teamId }, maat));
  assert.ok(nee.error);
  const ja = await json(await api('/api/member/rtmail/team/hef', { id: teamId }, baas));
  assert.ok(ja.ok);
});

test('zonder inlog blijft alles dicht', async () => {
  const r = await fetch(BASE + '/api/member/rtmail/team/mijn',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 401);
});
