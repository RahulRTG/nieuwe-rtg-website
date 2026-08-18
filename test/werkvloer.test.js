/* De werkvloer-laag: twee schermen één handeling, de tafellijst met
   allergenen en de gedeelde checklijst.
   Getest: een verzoek dat de manager op het bureau maakt staat meteen bij
   de collega op de PDA, de betaalcode is een echte RTG-code en het verzoek
   gaat pas op betaald als de betaling wordt gemeld, tekenen bewaart wie er
   tekende en een handtekening zonder streek wordt geweigerd; de tafellijst
   telt allergenen per tafel op voor de keuken en zet ze per stoel klaar
   voor de bediening; de checklijst is alleen zichtbaar voor wie hem deelt,
   iedereen vinkt zelf af en bij elk vinkje staat wie het deed.
   Draai los: node --test test/werkvloer.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child, bureau, pda, kantoor, stafNaam, manNaam;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkvl-'));

const api = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const man = roster.staff.find(x => x.role === 'manager');
  const staf = roster.staff.find(x => x.role !== 'manager');
  manNaam = man.name; stafNaam = staf.name;
  // twee schermen van dezelfde zaak: het bureau (manager) en de PDA (collega)
  bureau = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' })).body.token;
  pda = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: staf.id, pin: '5678' })).body.token;
  kantoor = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let betaalId, tekenId;

test('het bureau zet een betaalverzoek klaar; de PDA ziet het meteen staan', async () => {
  assert.equal((await api('/api/werkvloer/koppel/maak', { soort: 'betaal', titel: 'Tafel 6' }, bureau)).status, 400,
    'een betaalverzoek zonder bedrag heeft geen zin');
  assert.equal((await api('/api/werkvloer/koppel/maak', { soort: 'verzonnen', titel: 'Iets' }, bureau)).status, 400);

  const r = await api('/api/werkvloer/koppel/maak', { soort: 'betaal', titel: 'Tafel 6, diner',
    bedrag: 184.5, ref: 'BON-4471', vanScherm: 'bureau' }, bureau);
  assert.equal(r.status, 200);
  betaalId = r.body.verzoek.id;
  assert.equal(r.body.verzoek.status, 'open');
  assert.equal(r.body.verzoek.bedrag, 184.5);
  assert.equal(r.body.verzoek.door, manNaam, 'wie het klaarzette staat erbij');

  const opPda = await api('/api/werkvloer/koppel', { alleenOpen: true }, pda);
  assert.equal(opPda.status, 200);
  assert.ok(opPda.body.verzoeken.some(v => v.id === betaalId), 'hetzelfde verzoek staat op het andere scherm');
  assert.equal(opPda.body.open, 1);
});

test('de betaalcode is een echte RTG-code, en pas de melding maakt het betaald', async () => {
  const c = await api('/api/werkvloer/koppel/code', { id: betaalId }, pda);
  assert.equal(c.status, 200);
  assert.match(c.body.token, /^RTG1\./, 'dezelfde gezegelde codelaag als de kassa');
  assert.ok(c.body.vervalt > Date.now(), 'de code verloopt vanzelf');
  assert.match(c.body.tonen, /pas iets als het geld binnen is/);

  const lees = await api('/api/code/scan', { token: c.body.token }, pda);
  assert.equal(lees.body.ok, true, 'de codelaag herkent hem');
  assert.equal(lees.body.soort, 'kas');
  assert.match(lees.body.code, /^KIKUNOI:KOP-/, 'de code wijst terug naar dit verzoek');

  const nog = (await api('/api/werkvloer/koppel', {}, bureau)).body.verzoeken.find(v => v.id === betaalId);
  assert.equal(nog.status, 'open', 'een code tonen is geen betaling');

  assert.equal((await api('/api/werkvloer/koppel/betaald', { id: betaalId, ref: 'PAY-9' }, pda)).status, 403,
    'de melding komt van de manager, niet van elk scherm');
  const b = await api('/api/werkvloer/koppel/betaald', { id: betaalId, ref: 'PAY-9', hoe: 'RTG Pay' }, bureau);
  assert.equal(b.status, 200);
  assert.equal(b.body.verzoek.status, 'betaald');
  assert.equal(b.body.verzoek.betaald.ref, 'PAY-9');
  assert.equal((await api('/api/werkvloer/koppel/code', { id: betaalId }, pda)).status, 409, 'daarna geen code meer');
});

test('tekenen voor verzending: op de telefoon gezet, op het bureau zichtbaar', async () => {
  const r = await api('/api/werkvloer/koppel/maak', { soort: 'verzenden',
    titel: 'Factuur 2026-118, Hotel Mirador', toelichting: 'Cateringweek 30', ref: 'F-118' }, bureau);
  tekenId = r.body.verzoek.id;
  assert.equal(r.body.verzoek.status, 'open');

  assert.equal((await api('/api/werkvloer/koppel/teken', { id: tekenId, paden: [] }, pda)).status, 400,
    'zonder streek is er geen handtekening');
  assert.equal((await api('/api/werkvloer/koppel/teken', { id: betaalId, paden: [[[0, 0], [1, 1]]] }, pda)).status, 400,
    'een betaalverzoek teken je niet');

  const t = await api('/api/werkvloer/koppel/teken', { id: tekenId,
    paden: [[[0.1, 0.5], [0.3, 0.2], [0.5, 0.8]], [[0.6, 0.4], [0.9, 0.4]]] }, pda);
  assert.equal(t.status, 200);
  assert.equal(t.body.verzoek.status, 'getekend');
  assert.equal(t.body.verzoek.handtekening.door, stafNaam, 'de naam hoort bij de handtekening');
  assert.equal(t.body.verzoek.handtekening.paden.length, 2);
  assert.match(t.body.gevolg, /de deur uit/);

  const opBureau = (await api('/api/werkvloer/koppel', {}, bureau)).body.verzoeken.find(v => v.id === tekenId);
  assert.equal(opBureau.status, 'getekend', 'het bureau ziet de handtekening staan');
  assert.equal((await api('/api/werkvloer/koppel/teken', { id: tekenId, paden: [[[0, 0], [1, 1]]] }, bureau)).status, 409,
    'twee keer tekenen kan niet');
});

test('RTG Kantoren kijkt mee bij de zaak, maar tekent niet mee', async () => {
  const k = await api('/api/office/koppel', { zaak: 'KIKUNOI' }, kantoor);
  assert.equal(k.status, 200);
  assert.ok(k.body.verzoeken.some(v => v.id === tekenId));
  assert.equal((await api('/api/werkvloer/koppel/teken', { id: tekenId, paden: [[[0, 0], [1, 1]]] }, kantoor)).status, 401,
    'de kantoor-inlog is geen zaak-inlog');
  assert.equal((await api('/api/office/koppel', { zaak: 'KIKUNOI' })).status, 401);
});

let tafelId;

test('de tafellijst: per stoel voor de bediening, per tafel opgeteld voor de keuken', async () => {
  assert.equal((await api('/api/werkvloer/tafel', { tafel: { gasten: [] } }, bureau)).status, 400, 'welke tafel?');

  const r = await api('/api/werkvloer/tafel', { tafel: {
    tafel: '6', event: 'Bruiloft Ibiza', wanneer: '2026-08-12', gastvrouw: 'Inez',
    gasten: [
      { stoel: 1, naam: 'ORCHIDEE', allergenen: ['noten', 'sesam'], wensen: [] },
      { stoel: 2, naam: 'Jules', allergenen: [], wensen: ['veganistisch'] },
      { stoel: 3, allergenen: ['noten'], wensen: ['geen alcohol'], notitie: 'Kind, kleine portie' },
      { stoel: 4, naam: 'Sam', allergenen: ['verzonnen-allergeen'], wensen: ['halal'] }
    ] } }, bureau);
  assert.equal(r.status, 200);
  tafelId = r.body.tafel.id;
  assert.equal(r.body.tafel.aantalGasten, 4);
  assert.equal(r.body.tafel.allergenenTotaal, 3, 'noten telt twee keer, sesam een keer; de verzonnen allergie valt weg');
  assert.equal(r.body.tafel.let_op, true);
  const noten = r.body.tafel.telling.find(x => x.wat === 'noten');
  assert.deepEqual(noten.stoelen, [1, 3], 'de keuken ziet welke stoelen het raakt');

  const kaart = await api('/api/werkvloer/bedieningskaart', { id: tafelId }, pda);
  assert.equal(kaart.status, 200);
  assert.equal(kaart.body.stoelen[0].regel, 'ALLERGIE: noten, sesam');
  assert.equal(kaart.body.stoelen[2].naam, 'stoel 3', 'zonder naam is het stoelnummer genoeg');
  assert.match(kaart.body.stoelen[2].regel, /Kind, kleine portie/);
  assert.equal(kaart.body.stoelen[1].let_op, false);

  await api('/api/werkvloer/tafel', { tafel: { tafel: '7', event: 'Bruiloft Ibiza', wanneer: '2026-08-12',
    gasten: [{ stoel: 1, allergenen: ['gluten'] }, { stoel: 2, wensen: ['vegetarisch'] }] } }, bureau);

  const bord = await api('/api/werkvloer/keukenbord', { event: 'Bruiloft Ibiza' }, pda);
  assert.equal(bord.status, 200);
  assert.equal(bord.body.gasten, 6);
  assert.equal(bord.body.tafelsMetAllergeen, 2);
  assert.equal(bord.body.tafels[0].tafel, '6', 'de tafel met de meeste allergenen staat bovenaan');
  const samenNoten = bord.body.samen.find(x => x.wat === 'noten');
  assert.equal(samenNoten.aantal, 2);
  assert.match(bord.body.regel, /geen voorkeur/);
});

let lijstId, itemId;

test('de checklijst: gedeeld met wie meedoet, en iedereen vinkt zelf af', async () => {
  const r = await api('/api/werkvloer/checklijst', { lijst: {
    titel: 'Opbouw bruiloft', event: 'Bruiloft Ibiza', wanneer: '2026-08-12',
    gedeeld: [stafNaam],
    items: ['Tafels dekken', { tekst: 'Bar bijvullen', voor: stafNaam }, 'Geluid testen'] } }, bureau);
  assert.equal(r.status, 200);
  lijstId = r.body.lijst.id;
  assert.equal(r.body.lijst.totaal, 3);
  assert.equal(r.body.lijst.af, 0);
  assert.deepEqual(r.body.lijst.meedoen, [stafNaam]);

  const opPda = await api('/api/werkvloer/checklijsten', {}, pda);
  assert.ok(opPda.body.lijsten.some(l => l.id === lijstId), 'wie meedoet ziet de lijst op zijn eigen scherm');
  itemId = opPda.body.lijsten.find(l => l.id === lijstId).items[0].id;

  const v = await api('/api/werkvloer/checklijst/vink', { id: lijstId, item: itemId }, pda);
  assert.equal(v.status, 200);
  assert.equal(v.body.item.klaar.door, stafNaam, 'bij het vinkje staat wie het deed');
  assert.ok(v.body.item.klaar.at);
  assert.equal(v.body.lijst.af, 1);
  assert.equal(v.body.lijst.pct, 33);

  const uit = await api('/api/werkvloer/checklijst/vink', { id: lijstId, item: itemId, aan: false }, pda);
  assert.equal(uit.body.item.klaar, null, 'een vinkje kan terug');
  await api('/api/werkvloer/checklijst/vink', { id: lijstId, item: itemId }, pda);

  const bij = await api('/api/werkvloer/checklijst/item', { id: lijstId, tekst: 'Bloemen ophalen' }, pda);
  assert.equal(bij.body.lijst.totaal, 4, 'wie meedoet mag ook een punt bijzetten');

  assert.equal((await api('/api/werkvloer/checklijst/deel', { id: lijstId, met: [] }, pda)).status, 403,
    'alleen de maker bepaalt met wie de lijst is gedeeld');
  assert.equal((await api('/api/werkvloer/checklijst/weg', { id: lijstId }, pda)).status, 403);
});

test('een lijst die niet met mij is gedeeld, zie ik niet', async () => {
  const geheim = await api('/api/werkvloer/checklijst', { lijst: {
    titel: 'Beoordelingsgesprekken', gedeeld: ['Iemand Anders'], items: ['Voorbereiden'] } }, bureau);
  const id = geheim.body.lijst.id;
  const opPda = await api('/api/werkvloer/checklijsten', {}, pda);
  assert.ok(!opPda.body.lijsten.some(l => l.id === id), 'niet gedeeld is niet zichtbaar');
  assert.equal((await api('/api/werkvloer/checklijst/vink', { id, item: 'x' }, pda)).status, 403);

  // met het hele team delen kan ook: dan mag iedereen mee
  const open = await api('/api/werkvloer/checklijst', { lijst: { titel: 'Sluitronde', items: ['Kassa tellen'] } }, bureau);
  const opPda2 = await api('/api/werkvloer/checklijsten', {}, pda);
  const gevonden = opPda2.body.lijsten.find(l => l.id === open.body.lijst.id);
  assert.ok(gevonden, 'een lege deel-lijst betekent het hele team');
  assert.deepEqual(gevonden.meedoen, ['het hele team']);
});
