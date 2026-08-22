/* MIJN KOPPELINGEN (server/kern/link/koppelingen.js, cap-beheer.js) -- LINK.md
   par. 4, stap 6.

   Drie vragen die niet dezelfde zijn, en deze toets houdt ze uit elkaar:

   1. WAT STAAT ER OPEN? Codes van mij die nog leven, met een eigen id om ze
      in te trekken -- en zonder het token, want een beheerscherm hoort geen
      tweede manier te zijn om aan een werkende code te komen.
   2. WAT IS ER GEBEURD? De bonnen, en die blijven staan. Intrekken sluit een
      deur; het wist niet dat hij open is geweest (par. 3.6). Dat is hier een
      bewering en geen belofte in commentaar.
   3. WAT KAN IK ER NOG AAN DOEN? Per regel iets anders, en soms niets -- en
      juist dat "niets" hoort er met een reden bij te staan in plaats van als
      een knop die weigert.

   Draai los: node --experimental-sqlite --test test/linkkoppelingen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let BASE, child, zaak;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-koppel-'));
const KYC_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const json = r => r.json();
function api(pad, body, token) {
  return fetch(BASE + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) });
}
async function nieuwLid(naam) {
  const reg = await json(await api('/api/auth/register', { name: naam,
    email: naam.replace(/\s/g, '') + Date.now() + Math.random().toString(36).slice(2, 6) + '@voorbeeld.test',
    phone: '0611122233', password: 'geheim123', geboortedatum: '1990-05-05', tier: 'rtg' }));
  await api('/api/verify/upload', { image: KYC_PNG }, reg.token);
  const st = await json(await api('/api/state', {}, reg.token));
  return { token: reg.token, codenaam: st.state.user.codename };
}
const koppelingen = async (t) => json(await api('/api/link/koppelingen', {}, t));

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = await json(await api('/api/supplier/roster', { code: 'LUCHT' }));
  const man = roster.staff.find(m => m.role === 'manager');
  zaak = (await json(await api('/api/supplier/login', { code: 'LUCHT', staffId: man.id, pin: '1234' }))).token;
});
test.after(() => { stop(child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('wat er van mij openstaat, staat erin -- met een id om in te trekken en zonder het token', async () => {
  const anna = await nieuwLid('Koppel Anna');
  const cap = await json(await api('/api/link/cap/maak',
    { handeling: 'geld.ontvangen', centen: 1850, oms: 'diner' }, anna.token));

  const k = await koppelingen(anna.token);
  assert.equal(k.open.length, 1);
  const open = k.open[0];
  assert.equal(open.handeling, 'geld.ontvangen');
  assert.equal(open.kaart.velden[0].waarde, '€ 18,50', 'je ziet WAT er openstaat');
  assert.ok(open.id && open.id.length >= 6, 'er is een id om hem mee weg te halen');
  /* HET TOKEN HOORT HIER NIET TE STAAN, en het id mag er ook geen halve kopie
     van zijn: dan draagt elk beheerscherm en elke schermafdruk daarvan het deel
     waarmee je de code kunt gebruiken. */
  assert.ok(!JSON.stringify(k).includes(cap.token), 'het token staat niet in de lijst');
  /* EN HET ID IS NIET DE VERWIJZING. Die zit base64-verpakt in de romp van het
     token, dus zoeken met includes() vindt hem nooit -- dat zag ik een mutatie
     bewijzen die er gewoon langsliep. We halen de romp dus uit elkaar en
     vergelijken het veld dat er werkelijk in staat. */
  const velden = Buffer.from(cap.token.split('.')[1], 'base64url').toString().split('|');
  assert.equal(velden[0], 'cap');
  assert.notEqual(open.id, velden[1], 'het beheer-id is niet de verwijzing waarmee je verzilvert');
});

test('intrekken op id werkt een keer, en alleen voor wie hem afgaf', async () => {
  const boris = await nieuwLid('Koppel Boris');
  const carla = await nieuwLid('Koppel Carla');
  const cap = await json(await api('/api/link/cap/maak',
    { handeling: 'geld.ontvangen', centen: 900, oms: 'koffie' }, boris.token));
  const id = (await koppelingen(boris.token)).open[0].id;

  assert.equal((await api('/api/link/cap/trek', { id }, carla.token)).status, 403, 'niet die van een ander');
  assert.equal((await json(await api('/api/link/los', { tekst: cap.token }, carla.token))).type, 'capability',
    'en de mislukte poging heeft niets gedaan');

  assert.equal((await json(await api('/api/link/cap/trek', { id }, boris.token))).ok, true);
  assert.equal((await koppelingen(boris.token)).open.length, 0, 'weg uit de lijst');
  assert.equal((await api('/api/link/los', { tekst: cap.token }, carla.token)).status, 404, 'en de code doet niets meer');
  assert.equal((await api('/api/link/cap/trek', { id }, boris.token)).status, 404, 'twee keer intrekken kan niet');
});

test('een verstuurd verzoek draagt zijn eigen weg terug, en die werkt precies een keer', async () => {
  const dirk = await nieuwLid('Koppel Dirk');
  const eva = await nieuwLid('Koppel Eva');
  const pin = (await json(await api('/api/member/pin', {}, eva.token))).toon;
  await api('/api/member/pin/connect', { pin }, dirk.token);

  const k = await koppelingen(dirk.token);
  assert.equal(k.bonnen.length, 1);
  const bon = k.bonnen[0];
  assert.equal(bon.intentie, 'contact.verbinden');
  assert.equal(bon.naarNaam, eva.codenaam, 'met de codenaam erbij, niet alleen een sleutel');
  assert.ok(bon.terug, 'er staat een weg terug bij');
  assert.equal(bon.terug.weg, '/api/member/connect/intrek');

  // de weg volgen die de bon noemt
  const weg = await json(await api(bon.terug.weg, { [bon.terug.veld]: bon.terug.waarde }, dirk.token));
  assert.equal(weg.ok, true);
  assert.equal(((await json(await api('/api/member/connections', {}, eva.token))).requests || []).length, 0,
    'Eva heeft geen verzoek meer');
  assert.equal((await api('/api/member/connect/intrek', { key: bon.terug.waarde }, dirk.token)).status, 404,
    'en een tweede keer intrekken kan niet');
});

test('de ONTVANGER trekt jouw verzoek niet in -- hij weigert het, en dat is iets anders', async () => {
  /* Intrekken is van wie het verzoek stuurde; weigeren van wie het kreeg. Zonder
     dat onderscheid zou "intrekken" een tweede, stillere manier zijn om iets te
     weigeren -- zonder dat de verzender het ooit als weigering ziet staan. */
  const paul = await nieuwLid('Koppel Paul');
  const roos = await nieuwLid('Koppel Roos');
  const pin = (await json(await api('/api/member/pin', {}, roos.token))).toon;
  await api('/api/member/pin/connect', { pin }, paul.token);
  const naarRoos = (await koppelingen(paul.token)).bonnen[0].naar;

  const mij = (await json(await api('/api/member/connections', {}, roos.token))).me;
  assert.equal((await api('/api/member/connect/intrek', { key: mij }, roos.token)).status, 404,
    'Roos kan niets van zichzelf intrekken');
  const vanPaul = (await json(await api('/api/member/connections', {}, roos.token))).requests[0].key;
  assert.equal((await api('/api/member/connect/intrek', { key: vanPaul }, roos.token)).status, 404,
    'en het verzoek van Paul al helemaal niet');
  assert.equal(((await json(await api('/api/member/connections', {}, roos.token))).requests || []).length, 1,
    'het verzoek staat er nog gewoon');
  assert.ok(naarRoos, 'en Paul weet nog steeds naar wie het ging');
});

test('intrekken sluit een deur, maar wist niet dat hij open is geweest', async () => {
  /* LINK.md par. 3.6, als bewering. Dit is de regel die het verschil maakt
     tussen een logboek en een schoonmaakknop. */
  const finn = await nieuwLid('Koppel Finn');
  const gwen = await nieuwLid('Koppel Gwen');
  const pin = (await json(await api('/api/member/pin', {}, gwen.token))).toon;
  await api('/api/member/pin/connect', { pin }, finn.token);
  const voor = await koppelingen(finn.token);
  await api('/api/member/connect/intrek', { key: voor.bonnen[0].naar }, finn.token);

  const na = await koppelingen(finn.token);
  assert.equal(na.bonnen.length, 1, 'de bon staat er nog');
  assert.equal(na.bonnen[0].at, voor.bonnen[0].at, 'met dezelfde tijd');
  assert.equal(na.bonnen[0].terug, undefined, 'maar zonder knop...');
  assert.match(na.bonnen[0].reden, /staat niet meer open/i, '...en met een reden waarom');
});

test('een betaling heeft geen knop terug, wel een reden', async () => {
  const hans = await nieuwLid('Koppel Hans');
  const iris = await nieuwLid('Koppel Iris');
  await api('/api/pay/oplaad', { centen: 20000, idem: 'kop-' + Date.now() }, hans.token);
  const cap = await json(await api('/api/link/cap/maak',
    { handeling: 'geld.ontvangen', centen: 1200, oms: 'taxi' }, iris.token));
  await api('/api/link/cap/aanvaard', { capcode: cap.token }, hans.token);

  for (const [wie, wat] of [[hans.token, 'geld.ontvangen'], [iris.token, 'geld.ontvangen.gebruikt']]) {
    const k = await koppelingen(wie);
    const bon = k.bonnen.find(b => b.intentie === wat);
    assert.ok(bon, wat + ' hoort in de lijst te staan');
    assert.equal(bon.terug, undefined, 'geen knop die suggereert dat geld terugkomt');
    assert.match(bon.reden, /niet terug/i);
  }
});

test('per partij: hoe vaak, wanneer, en langs welke weg -- het antwoord op "waarom had die toegang"', async () => {
  const jan = await nieuwLid('Koppel Jan');
  const kim = await nieuwLid('Koppel Kim');
  const lou = await nieuwLid('Koppel Lou');
  for (const ander of [kim, lou]) {
    const pin = (await json(await api('/api/member/pin', {}, ander.token))).toon;
    await api('/api/member/pin/connect', { pin }, jan.token);
  }
  const k = await koppelingen(jan.token);
  assert.equal(k.partijen.length, 2, 'twee partijen, niet vier regels');
  const namen = k.partijen.map(p => p.naam).sort();
  assert.deepEqual(namen, [kim.codenaam, lou.codenaam].sort());
  for (const p of k.partijen) {
    assert.equal(p.aantal, 1);
    assert.deepEqual(p.via, ['vast'], 'langs welke weg het ging');
    assert.ok(Date.parse(p.laatst) > 0);
  }
});

test('een levende code levert een bon zonder partij, en dat wordt niet weggemoffeld', async () => {
  /* De levende weg geeft met opzet geen sleutel terug (kern/sociaal/pin-live.js).
     De bon staat er dus wel, maar zonder tegenpartij -- en dan hoort er geen
     partij "onbekend" verzonnen te worden die over niemand gaat. */
  const mees = await nieuwLid('Koppel Mees');
  const nina = await nieuwLid('Koppel Nina');
  const live = await json(await api('/api/member/pin/live', {}, nina.token));
  await api('/api/member/pin/live/verbind', { livecode: live.token }, mees.token);

  const k = await koppelingen(mees.token);
  assert.equal(k.bonnen.length, 1);
  assert.equal(k.bonnen[0].vorm, 'levend');
  assert.equal(k.bonnen[0].naar, null);
  assert.deepEqual(k.partijen, [], 'geen verzonnen partij');
  assert.match(k.bonnen[0].reden, /levende code/i, 'wel uitleg waar je hem dan vindt');
});

test('je ziet alleen je eigen koppelingen, en een zaak de zijne', async () => {
  const olav = await nieuwLid('Koppel Olav');
  await api('/api/link/cap/maak', { handeling: 'geld.ontvangen', centen: 500, oms: 'thee' }, olav.token);
  const vreemd = await nieuwLid('Koppel Piet');
  assert.equal((await koppelingen(vreemd.token)).open.length, 0, 'niet die van een ander');
  assert.equal((await api('/api/link/koppelingen', {})).status, 401, 'en zonder sessie niets');

  /* De kassa heeft geen ledensleutel maar wel bonnen: zij aanvaardt
     capabilities. Dat loket hoort voor allebei dezelfde vraag te beantwoorden. */
  const zaakK = await json(await api('/api/link/koppelingen', {}, zaak));
  assert.ok(Array.isArray(zaakK.bonnen), 'een zaak krijgt een lijst en geen 403');
});
