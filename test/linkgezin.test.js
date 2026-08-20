/* RTG LINK AAN DE GEZINSKANT (server/routes/social/gezinnen/link.js) -- de regel
   die sinds de eerste plak openstond in kern/link/intenties.js.

   WAT HIER BEWEZEN MOET WORDEN:

   1. EEN GEZINSLID KOMT ER LANGS, met zijn eigen geloofsbrief: een gezinscode
      met een profieltoken in het lijf, niet de Bearer-sessie van de leden-app.
      En de intenties wijzen naar ZIJN loketten (/api/rtf/social/...), niet naar
      die van een lid -- een knop die naar de verkeerde wereld wijst, weigert.
   2. VOOR EEN KIND VAN 15 OF JONGER STAAT DEZE DEUR DICHT, met dezelfde woorden
      als bij elk pinloket. Scannen hoort daar niet de uitzondering op te zijn:
      een kind zou anders een kaart krijgen met een knop die de kern alsnog
      weigert.
   3. DE TWEE WERELDEN VINDEN ELKAAR. Dat is de belofte van de pin, en hij is
      pas waar als hij ook langs deze laag heen en terug werkt.

   Draai los: node --experimental-sqlite --test test/linkgezin.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-linkgezin-'));
const json = r => r.json();

function post(pad, body, token) {
  return fetch(BASE + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) });
}
const fond = (pad, body) => post('/api/foundation' + pad, body);
const soc = (pad, body) => post('/api/rtf/social' + pad, body);
const lnk = (pad, body) => post('/api/rtf/link' + pad, body);

async function gezin(naam) {
  const g = await json(await fond('/gezin/maak', { gezinsnaam: naam, naam: 'Ouder ' + naam, pin: '1234' }));
  return g;                        // { code, token } -- de beheerder zelf
}
async function kindVan(g) {
  const kind = await json(await fond('/gezin/profiel/maak',
    { code: g.code, token: g.token, naam: 'Kind', rol: 'gezinslid', groep: 'tiener' }));
  const token = (await json(await fond('/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id }))).token;
  return { token, id: kind.profiel.id };
}
async function nieuwLid(naam) {
  const reg = await json(await post('/api/auth/register', { name: naam,
    email: naam.replace(/\s/g, '') + Date.now() + Math.random().toString(36).slice(2, 5) + '@voorbeeld.test',
    phone: '0611122233', password: 'geheim123', geboortedatum: '1990-05-05', tier: 'rtg' }));
  const st = await json(await post('/api/state', {}, reg.token));
  return { token: reg.token, codenaam: st.state.user.codename };
}

test.before(async () => { ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } })); });
test.after(() => { stop(child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('een gezinslid scant een pin en krijgt ZIJN eigen weg, niet die van een lid', async () => {
  const g = await gezin('Linkhuis');
  const lid = await nieuwLid('Gezin Lid');
  const pin = (await json(await post('/api/member/pin', {}, lid.token))).toon;

  const r = await json(await lnk('/los', { code: g.code, token: g.token, tekst: 'rtg:pin:' + pin }));
  assert.equal(r.type, 'persoon');
  assert.equal(r.onderwerp.codename, lid.codenaam, 'de codenaam, nooit de echte naam');
  assert.ok(!JSON.stringify(r).includes('Gezin Lid'), 'de echte naam blijft in de kluis');
  assert.deepEqual(r.intenties.map(i => i.weg), ['/api/rtf/social/pin/connect'],
    'de gezinsweg, want de ledendeur zou hem weigeren');

  // en die weg werkt ook echt
  const stuur = await json(await soc('/pin/connect', { code: g.code, token: g.token, pin }));
  assert.equal(stuur.ok, true);
  const bij = await json(await post('/api/member/connections', {}, lid.token));
  assert.equal((bij.requests || []).length, 1, 'het lid heeft het verzoek');
});

test('zonder geldige gezinssessie gaat deze deur niet open', async () => {
  const g = await gezin('Linkslot');
  assert.equal((await lnk('/los', { tekst: 'rtg:pin:00000000' })).status, 403, 'zonder code en token');
  assert.equal((await lnk('/los', { code: g.code, token: 'rommel', tekst: 'rtg:pin:00000000' })).status, 403,
    'en met een verzonnen token');
  assert.equal((await lnk('/koppelingen', { code: g.code, token: 'rommel' })).status, 403);
});

test('een kind van 15 of jonger komt hier niet langs, met dezelfde woorden als bij de pin', async () => {
  /* EEN PLEK WAAR DIT BESLUIT STAAT. Zou het scannen wel opengaan, dan krijgt een
     kind een kaart met een knop die de kern daarna alsnog weigert -- en leest hij
     twee verschillende verhalen over hetzelfde. */
  const g = await gezin('Linkkind');
  const kind = await kindVan(g);
  const lid = await nieuwLid('Kind Lid');
  const pin = (await json(await post('/api/member/pin', {}, lid.token))).toon;

  const dichtPin = await soc('/pin', { code: g.code, token: kind.token });
  const dichtScan = await lnk('/los', { code: g.code, token: kind.token, tekst: 'rtg:pin:' + pin });
  assert.equal(dichtScan.status, 403);
  assert.equal((await json(dichtScan)).error, (await json(dichtPin)).error,
    'scannen en de pin zeggen letterlijk hetzelfde');
  assert.match((await json(await lnk('/koppelingen', { code: g.code, token: kind.token }))).error || '',
    /ouder of verzorger/i);
});

test('de twee werelden vinden elkaar: heen op de pin van het gezinslid, terug op die van het lid', async () => {
  const g = await gezin('Linkbrug');
  const lid = await nieuwLid('Brug Lid');
  const gezinsPin = (await json(await soc('/pin', { code: g.code, token: g.token }))).toon;

  // het LID scant de pin van het gezinslid, via zijn eigen deur
  const heen = await json(await post('/api/link/los', { tekst: 'rtg:pin:' + gezinsPin }, lid.token));
  assert.equal(heen.type, 'persoon');
  assert.deepEqual(heen.intenties.map(i => i.weg), ['/api/member/pin/connect'],
    'een lid krijgt de ledenweg, ook bij een gezinslid');
  assert.equal((await json(await post(heen.intenties[0].weg, { pin: gezinsPin }, lid.token))).ok, true);

  // en het gezinslid ziet dat er een verzoek staat
  const bij = await json(await soc('/connections', { code: g.code, token: g.token }));
  assert.equal((bij.requests || []).length, 1);
});

test('een gezinslid ziet een vraagcode wel, maar krijgt er geen knop bij', async () => {
  /* Een gezinsprofiel heeft geen portemonnee, dus geen enkele handeling noemt
     'gezin' als aanvaarder. De kaart is er wel -- iemand houdt hem voor -- maar
     een knop die daarna weigert hoort er niet te staan. */
  const g = await gezin('Linkgeld');
  const lid = await nieuwLid('Geld Lid');
  const cap = await json(await post('/api/link/cap/maak',
    { handeling: 'geld.ontvangen', centen: 1500, oms: 'lunch' }, lid.token));

  const r = await json(await lnk('/los', { code: g.code, token: g.token, tekst: cap.token }));
  assert.equal(r.type, 'capability');
  assert.equal(r.onderwerp.wat, 'Betalen', 'hij ziet wat er gevraagd wordt');
  assert.deepEqual(r.intenties, [], 'en krijgt er geen knop bij');
});

test('mijn koppelingen werkt ook aan de gezinskant, en staat daar altijd op nul open', async () => {
  const g = await gezin('Linkboek');
  const lid = await nieuwLid('Boek Lid');
  const pin = (await json(await post('/api/member/pin', {}, lid.token))).toon;
  await soc('/pin/connect', { code: g.code, token: g.token, pin });

  const k = await json(await lnk('/koppelingen', { code: g.code, token: g.token }));
  assert.deepEqual(k.open, [], 'een gezinslid geeft geen codes uit, dus er staat niets open');
  assert.equal(k.bonnen.length, 1);
  assert.equal(k.bonnen[0].intentie, 'contact.verbinden');
  assert.equal(k.bonnen[0].naarNaam, lid.codenaam);
  assert.ok(k.bonnen[0].terug, 'en het verzoek is nog in te trekken');
  assert.equal(k.partijen.length, 1);

  /* DE WEG TERUG LIGT IN ZIJN EIGEN WERELD. Zou hier de ledendeur staan, dan
     krijgt een gezinslid een knop die zijn eigen sessie niet opent -- en dat is
     precies het soort belofte zonder weg waar deze laag voor bestaat. */
  assert.equal(k.bonnen[0].terug.weg, '/api/rtf/social/connect/intrek');
  const weg = await json(await soc('/connect/intrek',
    { code: g.code, token: g.token, [k.bonnen[0].terug.veld]: k.bonnen[0].terug.waarde }));
  assert.equal(weg.ok, true);
  assert.equal(((await json(await post('/api/member/connections', {}, lid.token))).requests || []).length, 0,
    'het verzoek is echt weg bij het lid');

  const na = await json(await lnk('/koppelingen', { code: g.code, token: g.token }));
  assert.equal(na.bonnen.length, 1, 'en de bon staat er nog -- intrekken wist geen geschiedenis');
  assert.equal(na.bonnen[0].terug, undefined);
});

test('een lid krijgt de ledendeur, een gezinslid de zijne -- voor dezelfde handeling', async () => {
  /* Dezelfde bon, twee werelden, twee wegen terug. Dit is de regel uit
     kern/link/koppelingen.js, gemeten aan beide kanten in plaats van geloofd. */
  const g = await gezin('Linkwegen');
  const a = await nieuwLid('Wegen A');
  const b = await nieuwLid('Wegen B');
  const pinB = (await json(await post('/api/member/pin', {}, b.token))).toon;
  await post('/api/member/pin/connect', { pin: pinB }, a.token);
  await soc('/pin/connect', { code: g.code, token: g.token, pin: pinB });

  const vanLid = await json(await post('/api/link/koppelingen', {}, a.token));
  const vanGezin = await json(await lnk('/koppelingen', { code: g.code, token: g.token }));
  assert.equal(vanLid.bonnen[0].terug.weg, '/api/member/connect/intrek');
  assert.equal(vanGezin.bonnen[0].terug.weg, '/api/rtf/social/connect/intrek');
  assert.notEqual(vanLid.bonnen[0].terug.weg, vanGezin.bonnen[0].terug.weg,
    'twee werelden, twee deuren -- anders weigert er een');
});
