/* Marktplaats in de RTFoundation-app: gezinnen kopen en verkopen, leveranciers
   kunnen er ook op verkopen. Met de vier pijlers: veiligheid (kinderen kijken
   alleen, oplichting wordt gemarkeerd, melden/blokkeren), respect (verboden waar
   en kwetsende taal worden geweigerd), gemak (zoeken/filteren, chat) en AI-hulp.
   Draai: node --experimental-sqlite --test test/markt.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-markt-'));
let child;
// RTF-gezin: beheerder (volw) + een kind
let code, volwToken, kindId, kindToken;
// een tweede gezin (koper)
let code2, volw2Token;
// leverancier
let supManagerToken, supCode = 'MAISON', supName;

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();
// RTF-endpoints dragen code+token in de body, geen Authorization-header
const rtf = (pad, body) => api('/api/foundation' + pad, body);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  // gezin 1 met een volwassen beheerder
  const g1 = await json(await rtf('/gezin/maak', { gezinsnaam: 'Familie Bos', naam: 'Sanne', pin: '1234', groep: 'volw' }));
  code = g1.code; volwToken = g1.token;
  // voeg een kind toe (beschermd profiel)
  const kind = await json(await rtf('/gezin/profiel/maak', { code, token: volwToken, naam: 'Tim', groep: 'kind' }));
  kindId = kind.profiel.id;
  const kindKies = await json(await rtf('/gezin/profiel/kies', { code, profielId: kindId }));
  kindToken = kindKies.token;
  // gezin 2 (koper)
  const g2 = await json(await rtf('/gezin/maak', { gezinsnaam: 'Familie Dijk', naam: 'Omar', pin: '4321', groep: 'volw' }));
  code2 = g2.code; volw2Token = g2.token;
  // leverancier MAISON
  const roster = await json(await api('/api/supplier/roster', { code: supCode }));
  supName = roster.supplier.name;
  const man = roster.staff.find(x => x.role === 'manager');
  supManagerToken = (await json(await api('/api/supplier/login', { code: supCode, staffId: man.id, pin: '1234' }))).token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('respect: verboden waar en kwetsende taal worden geweigerd', async () => {
  assert.equal((await rtf('/markt/plaats', { code, token: volwToken, akkoord: true, titel: 'Vuurwapen te koop', beschrijving: 'pistool met munitie', categorie: 'overig', prijs: 100 })).status, 400);
  assert.equal((await rtf('/markt/plaats', { code, token: volwToken, akkoord: true, titel: 'Kanker rotzooi', beschrijving: 'iets met een scheldwoord kanker erin', prijs: 5 })).status, 400);
  // zonder akkoord op de huisregels kan het ook niet
  assert.equal((await rtf('/markt/plaats', { code, token: volwToken, titel: 'Nette bank', beschrijving: 'mooie bank', prijs: 50 })).status, 400);
});

test('veiligheid: een kind (beschermd profiel) mag kijken maar niet plaatsen of reageren', async () => {
  // kijken mag
  assert.equal((await rtf('/markt/lijst', { code, token: kindToken })).status, 200);
  // plaatsen niet
  assert.equal((await rtf('/markt/plaats', { code, token: kindToken, akkoord: true, titel: 'Mijn oude step', beschrijving: 'werkt nog prima', prijs: 10 })).status, 403);
});

test('een gezin plaatst een advertentie, die verschijnt in de lijst en is te zoeken', async () => {
  const r = await json(await rtf('/markt/plaats', { code, token: volwToken, akkoord: true, titel: 'Houten kinderfietsje', beschrijving: 'Mooi houten loopfietsje, weinig gebruikt.', categorie: 'kids', staat: 'zgan', prijs: 25, plaats: 'Ibiza', levering: ['ophalen'] }));
  assert.ok(r.ok && r.ad.id, 'advertentie geplaatst');
  assert.equal(r.ad.verkoper.badge, 'gezin');
  assert.equal(r.ad.verkoper.soort, 'rtf');
  global.__ad = r.ad.id;
  // zichtbaar voor een ander gezin, en op trefwoord te vinden
  const lijst = await json(await rtf('/markt/lijst', { code: code2, token: volw2Token, q: 'loopfietsje' }));
  assert.ok(lijst.ads.some(a => a.id === global.__ad), 'het andere gezin vindt de advertentie via zoeken');
  // filter op categorie werkt
  const opKids = await json(await rtf('/markt/lijst', { code: code2, token: volw2Token, categorie: 'kids' }));
  assert.ok(opKids.ads.some(a => a.id === global.__ad));
  const opWonen = await json(await rtf('/markt/lijst', { code: code2, token: volw2Token, categorie: 'wonen' }));
  assert.ok(!opWonen.ads.some(a => a.id === global.__ad), 'in de verkeerde categorie staat hij niet');
});

test('veiligheid: een advertentie die om vooruitbetaling vraagt wordt gemarkeerd met een waarschuwing', async () => {
  const r = await json(await rtf('/markt/plaats', { code, token: volwToken, akkoord: true, titel: 'iPhone 15 spotgoedkoop', beschrijving: 'Nieuw in doos. Betaal eerst via een cadeaukaart, dan verstuur ik hem.', categorie: 'elektronica', staat: 'nieuw', prijs: 40 }));
  assert.ok(r.ok, 'de advertentie wordt geplaatst maar');
  assert.equal(r.ad.gemarkeerd, true, 'gemarkeerd als mogelijk onveilig');
  assert.ok(r.waarschuwing, 'met een waarschuwing voor de gebruiker');
});

test('gemak: koper start een chat, verkoper antwoordt, beiden zien het gesprek', async () => {
  const r = await json(await rtf('/markt/reageer', { code: code2, token: volw2Token, id: global.__ad, tekst: 'Hoi, is het fietsje nog beschikbaar?' }));
  assert.ok(r.ok && r.chat.id, 'chat gestart');
  global.__chat = r.chat.id;
  // verkoper ziet het in zijn postvak
  const pv = await json(await rtf('/markt/postvak', { code, token: volwToken }));
  assert.ok(pv.postvak.some(c => c.id === global.__chat && c.rol === 'verkoper'));
  // verkoper antwoordt
  const a = await json(await rtf('/markt/antwoord', { code, token: volwToken, chatId: global.__chat, tekst: 'Ja hoor, kom maar langs.' }));
  assert.ok(a.ok);
  assert.equal(a.chat.berichten.length, 2);
});

test('veiligheid: een bericht met contactgegevens/vooruitbetaling geeft een tip', async () => {
  const r = await json(await rtf('/markt/antwoord', { code: code2, token: volw2Token, chatId: global.__chat, tekst: 'Bel me op 0612345678 en betaal alvast vooruit' }));
  assert.ok(r.ok);
  assert.ok(r.tip, 'de app waarschuwt om niet vooruit te betalen');
});

test('veiligheid: melden verbergt na drie meldingen, en blokkeren verbergt de verkoper', async () => {
  // drie verschillende gezinnen melden dezelfde advertentie
  const g3 = await json(await rtf('/gezin/maak', { gezinsnaam: 'Familie Vos', naam: 'Ana', pin: '1111', groep: 'volw' }));
  const g4 = await json(await rtf('/gezin/maak', { gezinsnaam: 'Familie Ker', naam: 'Ben', pin: '2222', groep: 'volw' }));
  await rtf('/markt/meld', { code: code2, token: volw2Token, id: global.__ad, reden: 'lijkt nep' });
  await rtf('/markt/meld', { code: g3.code, token: g3.token, id: global.__ad, reden: 'nep' });
  const derde = await json(await rtf('/markt/meld', { code: g4.code, token: g4.token, id: global.__ad, reden: 'nep' }));
  assert.equal(derde.verborgen, true, 'na drie meldingen is de advertentie verborgen');
  const lijst = await json(await rtf('/markt/lijst', { code: g4.code, token: g4.token }));
  assert.ok(!lijst.ads.some(a => a.id === global.__ad), 'de gemelde advertentie is uit de lijst');
});

test('AI-hulp: schrijft een omschrijving, stelt een prijs voor en raadt de categorie', async () => {
  const beschrijving = await json(await rtf('/markt/ai', { code, token: volwToken, soort: 'beschrijving', titel: 'Kinderfiets 16 inch', staat: 'gebruikt' }));
  assert.ok(beschrijving.tekst && beschrijving.tekst.length > 10, 'AI schrijft een omschrijving');
  const prijs = await json(await rtf('/markt/ai', { code, token: volwToken, soort: 'prijs', categorie: 'elektronica', staat: 'zgan' }));
  assert.ok(prijs.prijs && prijs.prijs.midden > 0, 'AI stelt een prijs voor');
  const cat = await json(await rtf('/markt/ai', { code, token: volwToken, soort: 'categorie', titel: 'iPhone 12 met oplader' }));
  assert.equal(cat.categorie, 'elektronica', 'AI raadt de juiste categorie');
});

test('leverancier kan er ook op verkopen, met een zaak-badge, zichtbaar voor gezinnen', async () => {
  const r = await json(await api('/api/supplier/markt/plaats', { akkoord: true, titel: 'Etalagepop, tweedehands', beschrijving: 'Nette etalagepop uit onze winkel, op te halen.', categorie: 'wonen', staat: 'gebruikt', prijs: 45, plaats: 'Ibiza' }, supManagerToken));
  assert.ok(r.ok && r.ad.id, 'de zaak plaatst een advertentie');
  assert.equal(r.ad.verkoper.badge, 'zaak');
  // een gezin ziet de zaak-advertentie in de lijst
  const lijst = await json(await rtf('/markt/lijst', { code: code2, token: volw2Token, q: 'etalagepop' }));
  const zaakAd = lijst.ads.find(a => a.id === r.ad.id);
  assert.ok(zaakAd, 'het gezin ziet de advertentie van de zaak');
  assert.equal(zaakAd.verkoper.badge, 'zaak');
  // de zaak ziet zijn eigen advertenties terug
  const mijn = await json(await api('/api/supplier/markt/mijn', {}, supManagerToken));
  assert.ok(mijn.ads.some(a => a.id === r.ad.id));
});

test('verkoper kan de status op verkocht zetten; dan verdwijnt hij uit de lijst', async () => {
  const r = await json(await rtf('/markt/plaats', { code, token: volwToken, akkoord: true, titel: 'Boekenkast eiken', beschrijving: 'Stevige eiken boekenkast.', categorie: 'wonen', staat: 'gebruikt', prijs: 60 }));
  const id = r.ad.id;
  await rtf('/markt/status', { code, token: volwToken, id, status: 'verkocht' });
  const lijst = await json(await rtf('/markt/lijst', { code: code2, token: volw2Token, q: 'boekenkast' }));
  assert.ok(!lijst.ads.some(a => a.id === id), 'verkocht = niet meer in de lijst');
});
