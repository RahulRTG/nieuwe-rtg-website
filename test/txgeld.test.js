/* ============================================================================
   DE TWEE GELDCOLLECTIES IN HET GROOTBOEK.

   directBetalingen en betaalVerzoeken werden bijgehouden met

       db.data.X.unshift(item);
       db.data.X = db.data.X.slice(0, N);

   Dat is precies waar boeking 50.001 aan verdween (zie test/txkap.test.js),
   maar dan met betalingen erin. Drie gebreken in twee regels:

   1. de slice kopieerde bij ELKE betaling de hele array (tot 200.000 items);
   2. opzoeken ging met .find() over diezelfde array, dus O(N) per aanvraag;
   3. wat buiten de grens viel verdween zonder log en zonder kopie.

   En een vierde, buiten dit bestand: server/pg/sync.js mocht de afsluit-flush
   van deze twee collecties uitstellen op grond van de regel "elk nieuw item
   staat al als eigen rij in het transactie-grootboek". Die regel gold voor
   orders en boekingen; voor deze twee niet, want ze stonden helemaal niet in
   het grootboek. 38 MB betalingen onder een garantie die niet voor hen gold.

   WAT HIER WORDT VASTGELEGD
   1. de index werkt: op ref, op klant en op zaak, zonder scan;
   2. de staart valt niet weg maar gaat eerst naar archief/;
   3. de VELDNAMEN kloppen. Dit is de stille valkuil: een order draagt
      customerKey en total, een directe betaling draagt key en bedrag. Wie de
      grootboekrij voor beide op dezelfde manier bouwt, krijgt een grootboek
      waarin elk bedrag 0 is en geen enkele klant terug te vinden -- en er gaat
      niets stuk, er klopt alleen niets meer. Daarom kijken we hier naar de rij
      die het grootboek ZOU wegschrijven, en niet alleen naar de array.

   De grenzen staan hier laag (TX_*_CAP) -- zelfde gedrag als op 200.000, alleen
   beproefbaar. Eigen bestand, want die variabelen worden bij het laden gelezen.

   Draai los: node --experimental-sqlite --test test/txgeld.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DATA = process.env.RTG_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-txgeld-'));
process.env.TX_DIRECTBETALINGEN_CAP = '4';
process.env.TX_BETAALVERZOEKEN_CAP = '4';
const {
  db, directBetalingMetRef, directBetalingenVanKlant, directBetalingenVanZaak, directBetalingenVoegToe,
  betaalVerzoekMetRef, betaalVerzoekenVoorCodenaam, betaalVerzoekenVanZaak, betaalVerzoekenVoegToe
} = require('../server/db');
const { COLLECTIES, NAMEN } = require('../server/db/tx/collecties');

const leeg = () => { db.data = { orders: [], boekingen: [], directBetalingen: [], betaalVerzoeken: [] }; };
const betaling = (i, key) => ({ ref: 'DP' + i, key: key || 'user-1', codename: 'ALK', supplierCode: 'PONTO',
  supplierName: 'Ponto', bedrag: 1000 + i, omschrijving: 'proef', betaalwijze: 'kaart', at: new Date().toISOString() });
const verzoek = (i, naar) => ({ ref: 'BV' + i, supplierCode: 'PONTO', supplierName: 'Ponto',
  naarCodename: naar === undefined ? 'Alk' : naar, bedrag: 2000 + i, status: 'open', at: new Date().toISOString() });

test('1. betalingen zijn opzoekbaar op ref, op lid en op zaak', () => {
  leeg();
  for (let i = 0; i < 3; i++) directBetalingenVoegToe(betaling(i));
  directBetalingenVoegToe(betaling(9, 'user-2'));

  assert.equal(directBetalingMetRef('DP1').bedrag, 1001, 'op ref');
  assert.equal(directBetalingMetRef('bestaat-niet'), undefined, 'en een onbekende ref geeft niets');
  assert.deepEqual(directBetalingenVanKlant('user-1').map(b => b.ref), ['DP2', 'DP1', 'DP0'],
    'op lid, nieuwste eerst -- en zonder de betaling van het andere lid');
  assert.deepEqual(directBetalingenVanKlant('user-2').map(b => b.ref), ['DP9']);
  assert.equal(directBetalingenVanZaak('PONTO').length, 4, 'op zaak: alle vier');
  assert.deepEqual(directBetalingenVanKlant('user-onbekend'), [], 'een lid zonder betalingen krijgt een lege lijst');
});

/* De klantindex van een betaalverzoek is de CODENAAM in kleine letters. Zet je
   daar de gewone klantsleutel neer (zoals bij orders), dan vindt deze lezing
   niets en blijft dat onopgemerkt: een lege lijst ziet er niet kapot uit. */
test('2. betaalverzoeken zijn opzoekbaar op codenaam, ongeacht hoofdletters', () => {
  leeg();
  betaalVerzoekenVoegToe(verzoek(1, 'Alk'));
  betaalVerzoekenVoegToe(verzoek(2, 'ALK'));
  betaalVerzoekenVoegToe(verzoek(3, 'Beuk'));
  betaalVerzoekenVoegToe(verzoek(4, null));       // open verzoek, aan niemand gericht

  assert.deepEqual(betaalVerzoekenVoorCodenaam('alk').map(v => v.ref), ['BV2', 'BV1'],
    'Alk en ALK zijn dezelfde ontvanger');
  assert.deepEqual(betaalVerzoekenVoorCodenaam('ALK').map(v => v.ref), ['BV2', 'BV1'],
    'en de vraag mag ook in hoofdletters gesteld worden');
  assert.deepEqual(betaalVerzoekenVoorCodenaam('beuk').map(v => v.ref), ['BV3']);
  assert.equal(betaalVerzoekMetRef('BV4').naarCodename, null, 'het open verzoek bestaat wel');
  assert.deepEqual(betaalVerzoekenVoorCodenaam('').map(v => v.ref), [],
    'maar hangt aan niemand: een lege codenaam levert niets op');
  assert.equal(betaalVerzoekenVanZaak('PONTO').length, 4, 'de zaak ziet ze alle vier');
});

/* DE STILLE VALKUIL. rijVan() in het grootboek bouwt de rij; klopt de
   veldnaam niet, dan staat er een 0 en een null en gaat er niets stuk. */
test('3. de grootboekrij draagt het echte bedrag en de echte klant, per collectie', () => {
  const rij = (naam, item) => ({
    klant: COLLECTIES[naam].klant(item),
    totaal: Number(COLLECTIES[naam].totaal(item)) || 0
  });

  assert.deepEqual(rij('directBetalingen', betaling(7, 'user-42')), { klant: 'user-42', totaal: 1007 },
    'een directe betaling draagt key en bedrag, niet customerKey en total');
  assert.deepEqual(rij('betaalVerzoeken', verzoek(8, 'Alk')), { klant: 'alk', totaal: 2008 },
    'een betaalverzoek draagt naarCodename (klein) en bedrag');
  assert.deepEqual(rij('orders', { customerKey: 'user-3', total: 55 }), { klant: 'user-3', totaal: 55 },
    'en een order blijft doen wat hij deed');
  assert.deepEqual(rij('boekingen', { customerTier: 'rtg', price: 12 }), { klant: 'rtg', totaal: 12 },
    'ook via customerTier en price');

  // geen enkele collectie mag een bedrag van 0 opleveren voor een echt bedrag
  for (const naam of NAMEN) assert.ok(typeof COLLECTIES[naam].klant === 'function' &&
    typeof COLLECTIES[naam].totaal === 'function', naam + ' levert een klant- en een totaalfunctie');
});

/* Zonder grootboek (json- en geheugen-stand) is dit de plek waar de staart uit
   het RAM ging. Nu gaat hij eerst duurzaam naar archief/, net als de boekingen. */
test('4. wat buiten de grens valt gaat eerst naar het archief, compleet', () => {
  leeg();
  for (let i = 0; i < 4; i++) directBetalingenVoegToe(betaling(i));
  const bestand = path.join(DATA, 'archief', 'directBetalingen-afgekapt.jsonl');
  assert.equal(fs.existsSync(bestand), false, 'tot de grens is er niets afgekapt');

  directBetalingenVoegToe(betaling(4));
  assert.equal(db.data.directBetalingen.length, 4, 'de collectie blijft op de grens');
  assert.equal(directBetalingMetRef('DP0'), undefined, 'de oudste is uit het werkgeheugen');

  assert.ok(fs.existsSync(bestand), 'en staat op schijf: ' + bestand);
  const regels = fs.readFileSync(bestand, 'utf8').trim().split('\n').map(r => JSON.parse(r));
  assert.equal(regels.length, 1);
  assert.equal(regels[0].ref, 'DP0');
  assert.equal(regels[0].bedrag, 1000, 'met het hele bedrag erin, niet alleen de ref');
});

test('5. hetzelfde voor de betaalverzoeken', () => {
  leeg();
  for (let i = 0; i < 5; i++) betaalVerzoekenVoegToe(verzoek(i));
  assert.equal(db.data.betaalVerzoeken.length, 4);
  const bestand = path.join(DATA, 'archief', 'betaalVerzoeken-afgekapt.jsonl');
  const regels = fs.readFileSync(bestand, 'utf8').trim().split('\n').map(r => JSON.parse(r));
  assert.equal(regels[regels.length - 1].ref, 'BV0', 'het oudste verzoek is bewaard');
});

/* De tegenproef uit txkap.test.js, want een volle schijf is precies de
   omstandigheid waarin geld alsnog zou verdwijnen. */
test('6. kan de staart niet weg, dan wordt er niet gekapt', () => {
  leeg();
  const map = path.join(DATA, 'archief');
  fs.rmSync(map, { recursive: true, force: true });
  fs.writeFileSync(map, 'geen map');   // een BESTAND op de plek van de map: mkdir en open falen allebei
  try {
    for (let i = 0; i < 8; i++) directBetalingenVoegToe(betaling(100 + i));
    assert.equal(db.data.directBetalingen.length, 8,
      'liever een te grote collectie dan een betaling die nergens meer staat');
    assert.ok(directBetalingMetRef('DP100'), 'de oudste staat er nog gewoon');
  } finally { fs.rmSync(map, { force: true }); }
});

test.after(() => { try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) {} });
