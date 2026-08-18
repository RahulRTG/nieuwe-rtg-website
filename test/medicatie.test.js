/* Het medicatieschema (kern/medicatie.js). De belofte is niet "RTG helpt met uw
   medicijnen" maar iets veel kleiners, en juist dat kleine wordt hier vastgezet:

   1. RTG BEPAALT NOOIT EEN DOSERING. Wat erin gaat is wat het lid intikt; er
      komt niets bij, niets wordt aangevuld en niets wordt gecontroleerd.
   2. DE VOORRAAD IS EEN METING. Niet ingevuld is niet nul, en het scherm krijgt
      te horen HOE er geteld is (LAT.md regel 3).
   3. DE NOODKAART LEEST DE LIJST, hij kopieert hem niet -- net als bij het
      zorgprofiel.
   Draai los: node --test test/medicatie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, sup;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-med-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'KIKUNOI' } });
  base = srv.base;
  lid = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier: 'rtg' }) }).then(r => r.json()).then(d => d.token);
  sup = (await api('supplier/login', { username: 'rahul', password: 'Imran' }, '')).body.token;
  assert.ok(lid && sup);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een leeg schema zegt zelf waar RTG niet over gaat', async () => {
  const r = await api('medicatie', {}, lid);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.middelen, []);
  assert.deepEqual(r.body.vandaag, []);
  /* De grens staat er op een dag dat er niets aan de hand is. Zou hij pas
     verschijnen als er iets misgaat, dan was hij een alarm en geen bordje. */
  assert.match(r.body.grens.kop, /niet over uw medicijnen/i);
  assert.ok(r.body.grens.wegen.some(w => /apotheek/i.test(w.naam)));
  assert.match(r.body.uitleg, /controleert geen combinaties/i);
});

test('wat erin gaat is wat u intikt: RTG vult niets aan', async () => {
  const r = await api('medicatie/zet', { naam: 'Metoprolol', sterkte: '50 mg',
    momenten: '08:00, 20:00', notitie: 'bij het eten' }, lid);
  assert.equal(r.status, 200);
  const m = r.body.middelen[0];
  assert.equal(m.naam, 'Metoprolol');
  assert.equal(m.sterkte, '50 mg');
  assert.deepEqual(m.momenten, ['08:00', '20:00']);
  /* Geen veld dat RTG zelf heeft bedacht: geen voorgestelde dosering, geen
     categorie, geen waarschuwing, geen interactie. */
  assert.deepEqual(Object.keys(m).sort(),
    ['begonnenOp', 'id', 'momenten', 'naam', 'notitie', 'sterkte', 'voorraad'],
    'er staat geen enkel veld op dat RTG zelf heeft ingevuld');
  assert.equal(r.body.vandaag.length, 2, 'twee momenten vandaag');
  assert.ok(r.body.vandaag.every(p => p.afgetekend === false));
});

test('een vertypte tijd valt niet stilletjes weg', async () => {
  const r = await api('medicatie/zet', { naam: 'Vitamine D', momenten: '09:00, halfelf, 25:00' }, lid);
  const m = r.body.middelen.find(x => x.naam === 'Vitamine D');
  assert.deepEqual(m.momenten, ['09:00'], 'alleen echte kloktijden blijven staan');
  assert.match(r.body.gewaarschuwd || '', /kloktijd/i,
    'en het scherm hoort te horen dat er iets is afgevallen, anders lijkt het ingevuld');
  assert.match(r.body.gewaarschuwd, /^2 tijd/,
    'precies de twee die geen kloktijd waren');

  /* Een dubbele tijd is geen vergissing om over te melden: hij telt een keer en
     er komt geen waarschuwing dat er iets "afviel". */
  const dub = await api('medicatie/zet', { naam: 'Vitamine C', momenten: '09:00, 09:00' }, lid);
  assert.deepEqual(dub.body.middelen.find(x => x.naam === 'Vitamine C').momenten, ['09:00']);
  assert.equal(dub.body.gewaarschuwd, undefined, 'geen valse melding over een dubbele tijd');

  /* De bovengrens krijgt zijn eigen zin, en niet die over kloktijden. */
  const veel = await api('medicatie/zet', { naam: 'Druppels',
    momenten: Array.from({ length: 15 }, (_, i) => String(6 + i).padStart(2, '0') + ':00').join(',') }, lid);
  assert.equal(veel.body.middelen.find(x => x.naam === 'Druppels').momenten.length, 12);
  assert.match(veel.body.gewaarschuwd, /twaalf/i, 'met de echte reden erbij');
  assert.ok(!/kloktijd/i.test(veel.body.gewaarschuwd), 'en niet de verkeerde reden');
});

test('een voorraad die niet is ingevuld, staat er als niet ingevuld', async () => {
  const m = (await api('medicatie', {}, lid)).body.middelen.find(x => x.naam === 'Metoprolol');
  assert.equal(m.voorraad.bekend, false, 'geen nul, geen schatting');
  assert.match(m.voorraad.reden, /niet ingevuld/i);
  assert.equal(m.voorraad.over, undefined, 'er staat geen getal waar niets bekend is');
});

test('de voorraad telt af op wat u aftekent, en zegt dat er ook bij', async () => {
  const id = (await api('medicatie', {}, lid)).body.middelen.find(x => x.naam === 'Metoprolol').id;
  let r = await api('medicatie/voorraad', { id, aantal: 20 }, lid);
  let m = r.body.middelen.find(x => x.id === id);
  assert.equal(m.voorraad.bekend, true);
  assert.equal(m.voorraad.over, 20);
  assert.equal(m.voorraad.dagenNog, 10, 'twee per dag, dus tien dagen');
  assert.match(m.voorraad.hoe, /afgetekend/i,
    'het scherm hoort te weten dat dit op aftekenen berust, niet op de klok');

  r = await api('medicatie/af', { id, moment: '08:00', aan: true }, lid);
  m = r.body.middelen.find(x => x.id === id);
  assert.equal(m.voorraad.over, 19, 'aftekenen haalt er een af');
  assert.ok(r.body.vandaag.find(p => p.moment === '08:00' && p.id === id).afgetekend);

  /* En terugdraaien telt hem terug: een vergissing hoort geen gat in uw
     voorraad te slaan. */
  r = await api('medicatie/af', { id, moment: '08:00', aan: false }, lid);
  assert.equal(r.body.middelen.find(x => x.id === id).voorraad.over, 20);
});

test('geen tijden betekent geen dagen, met de reden erbij', async () => {
  const r0 = await api('medicatie/zet', { naam: 'Zalf', momenten: '' }, lid);
  const id = r0.body.middelen.find(x => x.naam === 'Zalf').id;
  const m = (await api('medicatie/voorraad', { id, aantal: 3 }, lid)).body.middelen.find(x => x.id === id);
  assert.equal(m.voorraad.over, 3);
  assert.equal(m.voorraad.dagenNog, null, 'zonder tijden valt er niet uit te rekenen hoe lang het duurt');
  assert.match(m.voorraad.dagenReden, /geen tijden/i, 'en er staat waarom niet');
});

test('aftekenen kan alleen op een moment dat er echt staat', async () => {
  const id = (await api('medicatie', {}, lid)).body.middelen.find(x => x.naam === 'Metoprolol').id;
  assert.equal((await api('medicatie/af', { id, moment: '03:00' }, lid)).status, 400);
  assert.equal((await api('medicatie/af', { id: 'bestaat-niet', moment: '08:00' }, lid)).status, 404);
});

test('de crisisregel loopt over het notitieveld, ook hier', async () => {
  /* Het medische filter van zorgniveau.js hoort hier NIET te knippen -- dan zou
     het woord "medicijn" zijn eigen app blokkeren. De crisisregel wel: wat
     iemand in een notitieveld schrijft, schrijft hij ergens. */
  const r = await api('medicatie/zet', { naam: 'Paracetamol', momenten: '12:00',
    notitie: 'ik wil niet meer leven' }, lid);
  assert.equal(r.body.mag, false, 'er wordt niets bewaard');
  assert.match(JSON.stringify(r.body.escalatie), /0800-0113/, 'en de weg naar hulp komt terug');
  assert.ok(!(await api('medicatie', {}, lid)).body.middelen.some(x => x.naam === 'Paracetamol'),
    'het middel is niet stiekem toch opgeslagen');

  // en de gewone medische woorden komen er wel gewoon door
  const ok = await api('medicatie/zet', { naam: 'Paracetamol', momenten: '12:00',
    notitie: 'dosering afbouwen volgens de arts, 500 mg' }, lid);
  assert.ok(ok.body.middelen.some(x => x.naam === 'Paracetamol'),
    'een medicijnwoord in een medicijn-app hoort geen blokkade te zijn');
});

test('niemand anders komt bij uw schema', async () => {
  assert.equal((await api('medicatie', {}, sup)).status, 401);
  assert.equal((await api('medicatie/zet', { naam: 'X' }, '')).status, 401);
  assert.equal((await api('medicatie/voorraad', { id: 'x', aantal: 1 }, sup)).status, 401);
});

test('het schema staat op het toestemmingsscherm bij wat er NIET onder valt', async () => {
  /* Hij hoort daar en niet in de lijst zelf: er valt niets in te trekken omdat
     er niemand is die hem kan opvragen. Zonder die regel zou een lezer denken
     dat we hem vergeten zijn. */
  const d = (await api('toestemming', {}, lid)).body;
  const rij = d.nietGedekt.find(x => /medicatieschema/i.test(x.naam));
  assert.ok(rij, 'het medicatieschema staat bij wat dit scherm niet dekt');
  assert.match(rij.reden, /eigen lijst/i);
  assert.ok(!d.toestemmingen.some(t => /medicat/i.test(t.laag || '')),
    'en niet als toestemming, want er is er geen');
});

test('de noodkaart LEEST het schema, en alleen als u dat aanzet', async () => {
  let kaart = (await api('noodkaart/zet', { contactNaam: 'Mijn buurman', aan: true }, lid)).body.kaart;
  assert.deepEqual(kaart.medicijnen, [], 'staat uit, dus er staat niets op');

  kaart = (await api('noodkaart/zet', { medicijnenErbij: true }, lid)).body.kaart;
  assert.ok(kaart.medicijnen.includes('Metoprolol 50 mg'),
    'aan gezet: de lijst staat erop, met sterkte, precies zoals het lid hem tikte');

  /* De harde bewering, dezelfde als bij het zorgprofiel: haal het middel van de
     lijst en het staat ook niet meer op de kaart. Bij een kopie zou een gestopt
     medicijn in een ambulance blijven staan. */
  const id = (await api('medicatie', {}, lid)).body.middelen.find(x => x.naam === 'Metoprolol').id;
  await api('medicatie/weg', { id }, lid);
  kaart = (await api('noodkaart', {}, lid)).body.kaart;
  assert.ok(!kaart.medicijnen.some(x => /Metoprolol/.test(x)), 'weg van de lijst is weg van de kaart');
  assert.equal(kaart.contactNaam, 'Mijn buurman', 'en wat van de kaart zelf is, blijft staan');
});
