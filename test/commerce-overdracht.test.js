/* DE OVERDRACHT -- de keuze afleveren bij de deur die wel bevestigt.

   DE ZWAARSTE TOETSEN ZIJN 2 EN 3. Twee: de regels komen uit het doorgerekende
   mandbeeld en niet uit het verzoek. Een aanroeper die zijn eigen regels mag
   meesturen, mag zijn eigen prijs meesturen -- en dat is precies wat
   kern/commerce/afrekening.js in zijn kop afwijst. Drie: een briefje is alleen
   te lezen met de sleutel waarop het is gemaakt, want er staat in wat iemand
   koopt en voor hoeveel, en het id staat in een adresbalk.

   En toets 8: er bestaat geen stand `bevestigd`. RTG hoort niet van het domein
   of de koper heeft doorgezet; een stand die dat suggereert is een bewering
   zonder meting.

   Draai los: node --test test/commerce-overdracht.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const maakOverdracht = require('../server/kern/commerce/overdracht');
const maakMand = require('../server/kern/commerce/mand');

/* Een mandbeeld zoals kern/commerce/afrekening.js het oplevert. De VORM is
   overgenomen van die bron en niet zelf bedacht: een fixture die afwijkt van de
   bron toetst de fixture (zie test/commerce-kern.test.js, toets 14). */
const BEELD = () => ({
  ok: true, valuta: 'EUR',
  afrekeningen: [{
    aanbiederCode: 'CASA', aanbiederNaam: "Casa d'Oro",
    regels: [
      { koopbaarId: 'zaak:CASA:tafel', titel: 'Tafel voor twee', type: 'eten', aantal: 1,
        stukCenten: 0, totaalCenten: 0, gratis: true, pagina: '/apps/foodcourt.html' },
      { koopbaarId: 'zaak:CASA:wijn', titel: 'Fles wijn', type: 'product', aantal: 2,
        stukCenten: 3250, totaalCenten: 6500, gratis: false, pagina: '/apps/foodcourt.html' }
    ],
    brutoCenten: 6500, totaalCenten: 6500,
    btw: { tariefProcent: 9, btwCenten: 536, nettoCenten: 5964 }, btwOnbekend: null,
    bevestigbaar: true, bevestigBij: ['/apps/foodcourt.html'], blokkades: []
  }],
  toonTotaalCenten: 6500, samenBevestigen: false, geweigerd: [], genegeerd: null
});

let tijd = 1700000000000;
const motor = () => {
  const db = { data: {} };
  return { db, O: maakOverdracht({ db, save: () => {}, nu: () => tijd }) };
};

test('1. een overdracht draagt de regels van EEN verkoper achter EEN deur', () => {
  const { O } = motor();
  const r = O.maak('sleutel-A', { beeld: BEELD(), verkoper: 'CASA' });
  assert.ok(r.ok);
  assert.equal(r.overdracht.verkoper.naam, "Casa d'Oro");
  assert.equal(r.overdracht.pagina, '/apps/foodcourt.html');
  assert.equal(r.overdracht.regels.length, 2);
  assert.equal(r.overdracht.brutoCenten, 6500);
  assert.deepEqual(r.koopbaarIds, ['zaak:CASA:tafel', 'zaak:CASA:wijn']);
});

test('2. de regels komen uit het beeld en NOOIT uit het verzoek', () => {
  const { O } = motor();
  const r = O.maak('sleutel-A', {
    beeld: BEELD(), verkoper: 'CASA',
    /* Alles wat een aanroeper zou willen sturen om zijn eigen prijs te bepalen: */
    regels: [{ koopbaarId: 'zaak:CASA:wijn', aantal: 99, stukCenten: 1, totaalCenten: 1 }],
    brutoCenten: 1, totaalCenten: 1, btw: { tariefProcent: 0, btwCenten: 0 }
  });
  assert.ok(r.ok);
  assert.equal(r.overdracht.brutoCenten, 6500, 'het bedrag komt van de server');
  assert.equal(r.overdracht.regels.find(x => x.koopbaarId === 'zaak:CASA:wijn').aantal, 2);
  assert.equal(r.overdracht.btw.tariefProcent, 9);
});

test('3. een briefje is alleen te lezen met de sleutel waarop het is gemaakt', () => {
  const { O } = motor();
  const id = O.maak('sleutel-A', { beeld: BEELD(), verkoper: 'CASA' }).overdracht.id;
  assert.ok(O.lees(id, 'sleutel-A').ok);
  assert.equal(O.lees(id, 'sleutel-B').status, 403, 'een id in een adresbalk is geen toegang');
  assert.equal(O.lees('bestaat-niet', 'sleutel-A').status, 404);
});

test('4. hij loopt af, en verlopen is niet leeg maar weg', () => {
  const { O } = motor();
  const id = O.maak('sleutel-A', { beeld: BEELD(), verkoper: 'CASA' }).overdracht.id;
  tijd += O.VERVAL_MS - 1000;
  assert.ok(O.lees(id, 'sleutel-A').ok, 'net binnen de tijd');
  tijd += 2000;
  const uit = O.lees(id, 'sleutel-A');
  assert.equal(uit.status, 404);
  assert.match(uit.error, /twee uur/);
  tijd = 1700000000000;
});

test('5. een geblokkeerde afrekening wordt niet overgedragen', () => {
  const { O } = motor();
  const b = BEELD();
  b.afrekeningen[0].bevestigbaar = false;
  b.afrekeningen[0].blokkades = [{ titel: 'Fles wijn', reden: 'Er zijn er nog 1 van.' }];
  const r = O.maak('sleutel-A', { beeld: b, verkoper: 'CASA' });
  assert.equal(r.status, 409);
  assert.equal(r.blokkades.length, 1, 'en de koper hoort te lezen wat er in de weg staat');
});

test('6. twee deuren bij een verkoper is een keuze en geen gok', () => {
  const { O } = motor();
  const b = BEELD();
  b.afrekeningen[0].regels[1].pagina = '/apps/mall.html';
  b.afrekeningen[0].bevestigBij = ['/apps/foodcourt.html', '/apps/mall.html'];

  const zonder = O.maak('sleutel-A', { beeld: b, verkoper: 'CASA' });
  assert.equal(zonder.status, 409, 'RTG kiest niet welke deur');
  assert.deepEqual(zonder.paginas, ['/apps/foodcourt.html', '/apps/mall.html']);

  const met = O.maak('sleutel-A', { beeld: b, verkoper: 'CASA', pagina: '/apps/mall.html' });
  assert.ok(met.ok);
  assert.equal(met.overdracht.regels.length, 1, 'alleen wat achter die deur hoort');
  assert.equal(met.overdracht.brutoCenten, 6500);

  const elders = O.maak('sleutel-A', { beeld: b, verkoper: 'CASA', pagina: '/apps/kwaad.html' });
  assert.equal(elders.status, 400, 'en niet naar een pagina die de verkoper niet noemt');
});

test('6b. een deur buiten RTG is geen deur', () => {
  const W = motor().O;
  for (const kwaad of ['https://ergens-anders.nl/kassa', '//ergens-anders.nl/kassa', 'javascript:alert(1)']) {
    const b = BEELD();
    b.afrekeningen[0].bevestigBij = [kwaad];
    b.afrekeningen[0].regels.forEach(r => { r.pagina = kwaad; });
    const r = W.maak('sleutel-A', { beeld: b, verkoper: 'CASA' });
    assert.equal(r.status, 409, kwaad + ' hoort te worden geweigerd');
    assert.match(r.error, /buiten RTG/);
  }
  /* Een pad met een zoekdeel is wel gewoon een deur: kern/mall/aanbodrtg.js zet
     er `/apps/thuis.html?huis=<id>` in. */
  const b = BEELD();
  const pad = '/apps/thuis.html?huis=h-12';
  b.afrekeningen[0].bevestigBij = [pad];
  b.afrekeningen[0].regels.forEach(r => { r.pagina = pad; });
  assert.ok(W.maak('sleutel-A', { beeld: b, verkoper: 'CASA' }).ok);
});

test('7. zonder bekende deur wordt er niets overgedragen', () => {
  const { O } = motor();
  const b = BEELD();
  b.afrekeningen[0].bevestigBij = [];
  const r = O.maak('sleutel-A', { beeld: b, verkoper: 'CASA' });
  assert.equal(r.status, 409);
  assert.match(r.error, /deur die hij niet kent/);
});

test('8. er bestaat geen stand "bevestigd" -- alleen wat RTG zelf deed', () => {
  const { O } = motor();
  const o = O.maak('sleutel-A', { beeld: BEELD(), verkoper: 'CASA' }).overdracht;
  const velden = Object.keys(o).join(' ');
  assert.ok(!/bevestigd|besteld|betaald|afgerond/i.test(velden), velden);
  assert.equal(o.geopendOp, null, 'ongelezen');
  const na = O.lees(o.id, 'sleutel-A').overdracht;
  assert.equal(na.geopendOp, 1700000000000, 'geopend is iets anders dan bevestigd');
  assert.ok(na.rtgBevestigtNiet.length > 40, 'en het staat er met zoveel woorden');
  assert.match(na.bedragVan, /Casa d'Oro/, 'de verkoper noemt zijn eigen bedrag');
});

test('9. de sleutel gaat er nooit uit', () => {
  const { O } = motor();
  const o = O.maak('geheime-sessiesleutel', { beeld: BEELD(), verkoper: 'CASA' }).overdracht;
  assert.ok(!JSON.stringify(o).includes('geheime-sessiesleutel'));
  assert.ok(!JSON.stringify(O.vanSleutel('geheime-sessiesleutel')).includes('geheime-sessiesleutel'));
});

test('10. een lege mand levert geen briefje, en een vreemde verkoper ook niet', () => {
  const { O } = motor();
  assert.equal(O.maak('sleutel-A', { beeld: { ok: true, afrekeningen: [] } }).status, 409);
  assert.equal(O.maak('', { beeld: BEELD(), verkoper: 'CASA' }).status, 400);
  assert.equal(O.maak('sleutel-A', { beeld: BEELD(), verkoper: 'IEMAND_ANDERS' }).status, 404);
});

test('11. het aantal briefjes per sleutel is begrensd, en de oudste valt af', () => {
  const { O } = motor();
  const ids = [];
  for (let i = 0; i <= O.MAX_PER_SLEUTEL; i++) {
    tijd += 1000;
    ids.push(O.maak('sleutel-A', { beeld: BEELD(), verkoper: 'CASA' }).overdracht.id);
  }
  assert.equal(O.vanSleutel('sleutel-A').length, O.MAX_PER_SLEUTEL);
  assert.equal(O.lees(ids[0], 'sleutel-A').status, 404, 'de oudste');
  assert.ok(O.lees(ids[ids.length - 1], 'sleutel-A').ok, 'de nieuwste staat er');
  tijd = 1700000000000;
});

/* ---- het merkje in de mand: wat er met een regel is GEBEURD ---- */

test('12. een merkje zegt aan wie is doorgegeven, en nooit dat er is besteld', () => {
  const db = { data: {} };
  const M = maakMand({ db, save: () => {}, nu: () => tijd });
  M.zet('sleutel-A', 'zaak:CASA:wijn', 2);
  M.zet('sleutel-A', 'zaak:MODE:jas', 1);
  M.merk('sleutel-A', ['zaak:CASA:wijn'], { id: 'ov123', naar: "Casa d'Oro" });

  const regels = M.lees('sleutel-A').regels;
  const wijn = regels.find(r => r.koopbaarId === 'zaak:CASA:wijn');
  assert.equal(wijn.overdracht.naar, "Casa d'Oro");
  assert.equal(wijn.overdracht.id, 'ov123');
  assert.ok(!('besteld' in wijn) && !('bevestigd' in wijn));
  assert.equal(regels.find(r => r.koopbaarId === 'zaak:MODE:jas').overdracht, undefined,
    'een merkje raakt alleen de regels die zijn doorgegeven');
});

test('13. wie het aantal verandert, gooit zijn eigen merkje weg', () => {
  const db = { data: {} };
  const M = maakMand({ db, save: () => {}, nu: () => tijd });
  M.zet('sleutel-A', 'zaak:CASA:wijn', 2);
  M.merk('sleutel-A', ['zaak:CASA:wijn'], { id: 'ov123', naar: "Casa d'Oro" });
  M.zet('sleutel-A', 'zaak:CASA:wijn', 5, true);
  assert.equal(M.lees('sleutel-A').regels[0].overdracht, undefined,
    'een briefje dat "2 stuks" zegt naast een regel van 5 is erger dan geen briefje');
});

test('14. merken zonder mand doet niets en valt niet om', () => {
  const db = { data: {} };
  const M = maakMand({ db, save: () => {}, nu: () => tijd });
  assert.equal(M.merk('', ['x'], { id: 'a', naar: 'b' }).gemerkt, 0);
  assert.equal(M.merk('sleutel-leeg', ['x'], { id: 'a', naar: 'b' }).gemerkt, 0);
});
