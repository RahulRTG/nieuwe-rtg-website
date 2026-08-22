/* HET BEDOELINGSSCHERM (public/shared/linkkaart.js) -- LINK.md par. 2 en 4.3.

   Waarom dit toetsbaar is zonder browser: `opbouw` en `markeer` zijn puur. Dat
   is met opzet zo gebouwd (zelfde gedachte als de losse helpers in
   shared/scanner.js), want juist de dingen die dit scherm moet garanderen zijn
   met een klik niet te zien:

   - dat de VIJF VRAGEN beantwoord worden -- wie, wat, waarom, welke gegevens,
     hoe lang -- en niet stilletjes een ervan wegvalt bij een ander type;
   - dat er NOOIT een knop verschijnt zonder weg. Een knop die nergens uitkomt is
     een belofte in tekst zonder belofte in code (LAT.md regel 6), en dit scherm
     is de laatste plek waar dat nog te zien is voordat een mens erop drukt.

   Draai los: node --test test/linkkaart.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const K = require('../public/shared/linkkaart');

const straks = (ms) => new Date(Date.now() + (ms || 120000)).toISOString();
const CAP = {
  type: 'capability', wat: 'een verzoek om iets te doen',
  onderwerp: { van: 'Gouden Panter', wat: 'Afrekenen', waarom: 'diner',
    velden: [{ naam: 'Maximaal', waarde: '€ 200,00' }],
    gegevens: ['je codenaam', 'het bedrag'], tot: straks() },
  intenties: [{ id: 'capability.aanvaarden', tekst: 'Bekijken en bevestigen',
    uitleg: 'Je ziet eerst wat er gebeurt.', weg: '/api/supplier/link/cap/aanvaard', methode: 'POST' }]
};

test('de vijf vragen worden alle vijf beantwoord', () => {
  const b = K.opbouw(CAP, {});
  assert.equal(b.kop.van, 'Gouden Panter', 'WIE');
  assert.equal(b.kop.wat, 'Afrekenen', 'WAT');
  assert.equal(b.kop.waarom, 'diner', 'WAAROM');
  assert.deepEqual(b.gegevens, ['je codenaam', 'het bedrag'], 'WELKE GEGEVENS');
  assert.ok(b.regels.some(r => r.l === 'Geldig tot'), 'HOE LANG');
});

test('elk type vult de kaart, en geen enkel type valt stil terug op niets', () => {
  const gevallen = [
    [{ type: 'persoon', wat: 'een mens', onderwerp: { codename: 'Zilveren Vos', status: 'geen' }, intenties: [] }, 'Zilveren Vos', 'Band'],
    [{ type: 'plaats', wat: 'een plek bij een zaak', onderwerp: { naam: 'Hotel Ritz', plek: 'Terras 3' }, intenties: [] }, 'Hotel Ritz', 'Plek'],
    [{ type: 'zaak', wat: 'een zaak', onderwerp: { naam: 'Hotel Ritz' }, intenties: [] }, 'Hotel Ritz', null]
  ];
  for (const [antwoord, van, regel] of gevallen) {
    const b = K.opbouw(antwoord, {});
    assert.equal(b.kop.van, van, antwoord.type);
    assert.ok(b.kop.wat, antwoord.type + ' hoort te zeggen WAT het is');
    if (regel) assert.ok(b.regels.some(r => r.l === regel), antwoord.type + ' mist de regel ' + regel);
  }
});

test('een intentie zonder weg wordt nooit een knop', () => {
  /* De deur weigert zo iets ook wel, maar dan heeft een mens al gedrukt. Dit
     scherm hoort niet te tonen wat nergens uitkomt. */
  const half = { ...CAP, intenties: [
    { id: 'a', tekst: 'Doen', weg: '/api/link/cap/aanvaard' },
    { id: 'b', tekst: 'Kan niet' },                       // geen weg
    { id: 'c', weg: '/api/link/cap/aanvaard' }            // geen tekst
  ] };
  const b = K.opbouw(half, {});
  assert.deepEqual(b.knoppen.map(k => k.id), ['a']);
  const h = K.markeer(b);
  assert.ok(!h.includes('Kan niet'), 'de knop zonder weg staat er niet');
  assert.equal((h.match(/class="doen"/g) || []).length, 1, 'precies een doe-knop');
});

test('wat de app erbij weet staat op dezelfde kaart, met het bedrag als enige ceremonie', () => {
  /* De kassa weet wat DEZE bon kost; de code zegt alleen tot hoeveel het MAG.
     Allebei op de kaart, want dat is wat er werkelijk gaat gebeuren. En het
     bedrag is de enige serif-rol die hier hoort (ONTWERP.md par. 1: "een
     belangrijk bedrag"), dus .rtg-kpi -- de rest is werk. */
  const b = K.opbouw(CAP, { extra: [{ naam: 'Deze bon', waarde: '€ 45,00', nadruk: true }] });
  const bon = b.regels.find(r => r.l === 'Deze bon');
  assert.ok(bon && bon.nadruk);
  const h = K.markeer(b);
  assert.equal((h.match(/rtg-kpi/g) || []).length, 1, 'een ceremonieel getal per kaart, niet meer');
  assert.match(h, /Maximaal<\/span><span class="w">€ 200,00/, 'het maximum blijft werk');
  /* HET CIJFER IS CEREMONIEEL, HET VALUTATEKEN NIET. Bodoni's euro is smal en
     hoog en leest op deze plek als een C -- op precies het scherm waar iemand
     moet zien hoeveel er van hem afgaat. Het teken gaat daarom in de werkletter;
     zonder deze regel valt dat stil terug zodra iemand de opbouw vereenvoudigt. */
  assert.match(h, /class="rtg-kpi"><span class="rtg-werk teken">€<\/span> 45,00</);
});

test('het scherm zegt altijd wat de ander te weten komt', () => {
  assert.match(K.markeer(K.opbouw(CAP, {})), /De ander krijgt: <b>je codenaam<\/b>, <b>het bedrag<\/b>\./);
});

test('tekst uit de server wordt ontsmet voordat hij op het scherm komt', () => {
  const stout = { ...CAP, onderwerp: { ...CAP.onderwerp, van: '<img src=x onerror=alert(1)>', waarom: '"; drop' } };
  const h = K.markeer(K.opbouw(stout, {}));
  assert.ok(!h.includes('<img'), 'geen ruwe HTML uit een antwoord');
  assert.match(h, /&lt;img/);
});

test('de kaart is een dialoog met een naam, en elke knop is aan te wijzen', () => {
  const h = K.markeer(K.opbouw(CAP, {}));
  assert.match(h, /role="dialog"/);
  assert.match(h, /aria-modal="true"/);
  assert.match(h, /aria-label="Bevestigen"/);
  assert.ok(!/<button[^>]*>\s*<\/button>/.test(h), 'geen knop zonder tekst');
});

test('de stijl van dit scherm staat in de tokenlaag, niet in het bestand zelf', () => {
  /* Een component met zijn eigen kleuren in een string is hoe een huisstijl in
     drie apps uiteen gaat lopen (LAT.md regel 4). Dit scherm hoort te leunen op
     public/shared/rtg-ontwerp.css, waar test/ontwerp.test.js overheen gaat. */
  const bron = fs.readFileSync(path.join(__dirname, '..', 'public/shared/linkkaart.js'), 'utf8');
  assert.ok(!/#[0-9a-fA-F]{6}\b/.test(bron.replace(/\/\*[\s\S]*?\*\//g, '')),
    'linkkaart.js zet een eigen kleur; die hoort in rtg-ontwerp.css');
  const css = fs.readFileSync(path.join(__dirname, '..', 'public/shared/rtg-ontwerp.css'), 'utf8');
  assert.match(css, /\.rtg-bedoeling/, 'het component hoort in de tokenlaag te staan');
  assert.match(css, /\.rtg-bedoeling button\{[^}]*min-height:48px/,
    'de knoppen horen ruim boven de 24x24 van WCAG 2.5.8 te blijven (TOEGANKELIJK.md)');
});
