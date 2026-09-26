/* HET ACTIECONTRACT VAN DE EDGE, over ALLE combinaties en niet over drie
   voorbeelden.

   shared/edge/actiestaat.js zet een handeling in een van vier standen (AFWEZIG,
   GEBLOKKEERD, BESCHIKBAAR, LOPEND). De beloften uit EDGE.md die hier vastliggen:

   1. een geweigerd of afwezig SERVERoordeel maakt BESCHIKBAAR onmogelijk;
   2. een oordeel dat NIET van de server komt verleent niets (de Edge presenteert
      bevoegdheid, hij verleent haar nooit) en wordt als gebrek gemeld;
   3. GEBLOKKEERD draagt altijd een reden in gewone taal en een bekende bron;
   4. `plechtig` vraagt klaarzetten, nakijken en vasthouden -- afgeleid uit de
      GEWICHT-tabel van shared/adaptief/grammatica.js, niet uit een eigen lijst;
   5. `terug` zonder weg terug wordt `bewust`, en herstel door COMPENSATIE wordt
      nooit als "Ongedaan maken" aangeboden;
   6. een gevolg dat niet gemeten is, zegt nooit "geen gevolgen";
   7. een ingetrokken oordeel zet een beschikbare handeling om (de uitkomst hangt
      alleen van de invoer af: zelfde invoer, zelfde stand).

   DE MUTATIES, elk nagetrokken: laat het serveroordeel `geblokkeerd` negeren
   (1 zakt), laat een oordeel van elders gelden (2 zakt), laat de redenloze
   verhindering zonder vangnet door (3 zakt), bepaal de bevestiging uit de
   trapnaam in plaats van de vlaggen (4 zakt niet -- zie de toets die de tabel
   verandert), en haal de compensatieregel weg (5 zakt). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../public/shared/edge/actiestaat.js');
const gram = require('../public/shared/adaptief/grammatica.js');

const GEWICHTEN = ['licht', 'terug', 'bewust', 'zwaar', 'plechtig', undefined, 'onzin'];
const OORDELEN = [null,
  { bron: 'server', uitkomst: 'toegestaan' }, { bron: 'server', uitkomst: 'geblokkeerd', reden: 'Tweede handtekening ontbreekt.' },
  { bron: 'server', uitkomst: 'geblokkeerd' }, { bron: 'server', uitkomst: 'afwezig' }, { bron: 'server', uitkomst: 'onbekend' },
  { bron: 'client', uitkomst: 'toegestaan' }, { bron: 'edge', uitkomst: 'geblokkeerd' }];
const VERHINDERD = [null, 'Er staat nog geen codenaam.', { reden: '', bron: 'beleid' }, { reden: 'Strikt geclassificeerd.', bron: 'classificatie' }];
const HERSTEL = [undefined, 'exact', 'compensatie', 'geen'];

function alle() {
  const uit = [];
  for (const gewicht of GEWICHTEN) for (const oordeel of OORDELEN) for (const verhinderd of VERHINDERD)
    for (const herstel of HERSTEL) for (const ongedaan of [false, true]) for (const loopt of [false, true])
      uit.push({ id: 'x', gewicht, oordeel, verhinderd, herstel, ongedaan, loopt });
  return uit;
}

test('een geweigerd of afwezig serveroordeel maakt BESCHIKBAAR onmogelijk', () => {
  let gezien = 0;
  for (const inv of alle()) {
    const u = S.bepaal(inv, gram);
    if (inv.oordeel && inv.oordeel.bron === 'server' && (inv.oordeel.uitkomst === 'geblokkeerd' || inv.oordeel.uitkomst === 'afwezig')) {
      gezien++;
      assert.notEqual(u.staat, S.STAAT.BESCHIKBAAR, JSON.stringify(inv));
      assert.notEqual(u.staat, S.STAAT.LOPEND, JSON.stringify(inv));
    }
    if (inv.oordeel && inv.oordeel.bron === 'server' && inv.oordeel.uitkomst === 'afwezig') assert.equal(u.staat, S.STAAT.AFWEZIG);
  }
  assert.ok(gezien > 100, 'de combinatieruimte hoort het geval te bevatten');
});

test('een oordeel van elders dan de server verleent niets en wordt gemeld', () => {
  for (const inv of alle().filter((x) => x.oordeel && x.oordeel.bron !== 'server')) {
    const u = S.bepaal(inv, gram);
    assert.equal(u.gezag, 'onbekend', 'een clientoordeel gaf gezag: ' + JSON.stringify(inv));
    assert.ok(u.gebreken.includes('oordeel-niet-van-server'));
    /* En het verandert de stand niet: hetzelfde geval zonder oordeel geeft
       dezelfde stand. */
    const zonder = S.bepaal(Object.assign({}, inv, { oordeel: null }), gram);
    assert.equal(u.staat, zonder.staat, 'een clientoordeel veranderde de stand: ' + JSON.stringify(inv));
  }
  const server = S.bepaal({ id: 'x', oordeel: { bron: 'server', uitkomst: 'toegestaan' } }, gram);
  assert.equal(server.gezag, 'server');
  assert.equal(S.bepaal({ id: 'x', effect: 'lokaal' }, gram).gezag, 'lokaal');
});

test('GEBLOKKEERD draagt altijd een reden en een bekende bron', () => {
  for (const inv of alle()) {
    const u = S.bepaal(inv, gram);
    if (u.staat !== S.STAAT.GEBLOKKEERD) continue;
    assert.ok(u.waarom && u.waarom.reden && u.waarom.reden.length > 3, 'geblokkeerd zonder reden: ' + JSON.stringify(inv));
    assert.ok(Object.prototype.hasOwnProperty.call(gram.BRONNEN, u.waarom.bron), 'onbekende bron ' + u.waarom.bron);
    assert.equal(u.ongedaan, false, 'een geblokkeerde handeling biedt geen ongedaan maken aan');
  }
  const redenloos = S.bepaal({ id: 'x', verhinderd: { reden: '', bron: 'beleid' } }, gram);
  assert.ok(redenloos.gebreken.includes('redenloos'), 'een verhindering zonder reden hoort een gebrek te zijn');
  assert.equal(redenloos.waarom.reden, gram.BRONNEN.beleid.zin, 'het vangnet is de zin van de bron');
  const server = S.bepaal({ id: 'x', oordeel: { bron: 'server', uitkomst: 'geblokkeerd', reden: 'Tweede handtekening ontbreekt.' } }, gram);
  assert.equal(server.waarom.reden, 'Tweede handtekening ontbreekt.', 'de reden van de server gaat voor');
  assert.equal(server.waarom.bron, 'bevoegdheid');
});

test('de bevestiging volgt de vlaggen van de GEWICHT-tabel, niet een eigen lijst', () => {
  assert.equal(S.bepaal({ id: 'x', gewicht: 'plechtig' }, gram).bevestiging, 'klaarzetten+nakijken+vasthouden');
  assert.equal(S.bepaal({ id: 'x', gewicht: 'zwaar' }, gram).bevestiging, 'reden+vasthouden');
  assert.equal(S.bepaal({ id: 'x', gewicht: 'bewust' }, gram).bevestiging, 'lade');
  assert.equal(S.bepaal({ id: 'x', gewicht: 'terug', ongedaan: true }, gram).bevestiging, 'ongedaan-maken');
  assert.equal(S.bepaal({ id: 'x', gewicht: 'licht' }, gram).bevestiging, 'geen');
  /* Verander de TABEL en de uitkomst moet meebewegen: zo is bewezen dat de
     module de tabel leest en niet de trapnaam. */
  const anders = JSON.parse(JSON.stringify(gram));
  anders.verhindering = gram.verhindering; anders.uitleg = gram.uitleg;
  anders.GEWICHT.bewust = Object.assign({}, anders.GEWICHT.bewust, { mens: true });
  assert.equal(S.bepaal({ id: 'x', gewicht: 'bewust' }, anders).bevestiging, 'klaarzetten+nakijken+vasthouden');
});

test('terug zonder weg terug wordt bewust, en compensatie is nooit ongedaan maken', () => {
  const zonder = S.bepaal({ id: 'x', gewicht: 'terug', ongedaan: false }, gram);
  assert.equal(zonder.gewicht, 'bewust'); assert.ok(zonder.gebreken.includes('terug-zonder-ongedaan'));
  for (const inv of alle().filter((x) => x.herstel === 'compensatie')) {
    const u = S.bepaal(inv, gram);
    assert.equal(u.ongedaan, false, 'compensatie als ongedaan aangeboden: ' + JSON.stringify(inv));
    assert.notEqual(u.gewicht, 'terug');
  }
  const exact = S.bepaal({ id: 'x', gewicht: 'terug', ongedaan: true, herstel: 'exact' }, gram);
  assert.equal(exact.ongedaan, true); assert.equal(exact.gewicht, 'terug');
});

test('een ongemeten gevolg zegt nooit dat er niets gebeurt', () => {
  const u = S.bepaal({ id: 'x' }, gram);
  assert.equal(u.gevolg.klasse, 'onbekend');
  assert.doesNotMatch(u.gevolg.tekst, /geen gevolg|niets|verandert niets/i);
  assert.equal(S.bepaal({ id: 'x', gevolg: 'geen-effect-gemeten' }, gram).gevolg.klasse, 'bekend');
  assert.match(S.bepaal({ id: 'x', gevolg: 'geen-effect-gemeten' }, gram).gevolg.tekst, /Gemeten/);
});

test('een ingetrokken oordeel zet een beschikbare handeling om, en zelfde invoer geeft zelfde stand', () => {
  const basis = { id: 'x', gewicht: 'zwaar' };
  const toe = S.bepaal(Object.assign({}, basis, { oordeel: { bron: 'server', uitkomst: 'toegestaan' } }), gram);
  const in1 = S.bepaal(Object.assign({}, basis, { oordeel: { bron: 'server', uitkomst: 'geblokkeerd', reden: 'Mandaat ingetrokken.' } }), gram);
  const in2 = S.bepaal(Object.assign({}, basis, { oordeel: { bron: 'server', uitkomst: 'afwezig' } }), gram);
  assert.equal(toe.staat, S.STAAT.BESCHIKBAAR);
  assert.equal(in1.staat, S.STAAT.GEBLOKKEERD);
  assert.equal(in2.staat, S.STAAT.AFWEZIG);
  for (const inv of alle().slice(0, 400)) assert.deepEqual(S.bepaal(inv, gram), S.bepaal(inv, gram));
});

test('zonder gewichtstabel faalt een zware handeling dicht', () => {
  const u = S.bepaal({ id: 'x', gewicht: 'plechtig' }, null);
  assert.equal(u.staat, S.STAAT.GEBLOKKEERD, 'zonder grammatica hoort alles wat niet licht is dicht te staan');
  assert.ok(u.waarom.reden.length > 3);
  assert.equal(S.bepaal({ id: 'x' }, null).staat, S.STAAT.BESCHIKBAAR);
});
