/* DE DOODSPOORMETER (scripts/doodspoor.js) -- ziet hij een dood spoor?

   MAATSTAF.md par. 3 maakt "geen dood spoor" meetbaar: een handeling van een
   actor die een collectie aanraakt, hoort een ontvanger in een andere
   actorgroep te hebben, of een verklaring waarom niet. Dit bestand bewaakt de
   meter zelf, niet het product: een meter die altijd "gesloten" zegt is
   slechter dan geen meter (LAT.md regel 9), dus elke uitslag wordt hier een
   keer verdiend door een tegenproef die hem laat omslaan.

   De proef gebruikt een NAGEBOOTSTE IDEMPROEF.json -- klein, met de hand
   geschreven, zodat elke uitslag herleidbaar is tot een regel hierboven. De
   echte uitslag (DOODSPOOR.json) wordt alleen op zijn vorm en op zijn
   verklaringen getoetst; wat erin staat is een meting en geen norm.

   Draai los: node --test test/doodspoor.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const O = require('../scripts/doodspoor');

function route(pad, rol, opslag, status = 200) {
  return { methode: 'POST', pad, rol, statussen: [status, status, status], opslag: { a: opslag, b: {}, c: {} } };
}
function proefMet(...routes) { return { perRoute: routes }; }

const TERM_NAAM = Object.keys(O.TERMINAAL)[0];
const INFRA_NAAM = Object.keys(O.INFRA)[0];

test('0. zonder proef zakt de meter en zegt wat er ontbreekt', () => {
  const u = O.meet({ proef: { perRoute: null } });
  assert.ok(u.fout && /IDEMPROEF/.test(u.fout));
});

test('1. gesloten: een andere groep zet gemeten een stand op dezelfde collectie', () => {
  const u = O.meet({ proef: proefMet(
    route('/api/bestel', 'member', { orders: 1 }),
    route('/api/supplier/bestel/accepteer', 'supplier', { orders: 'gewijzigd' })) });
  const lid = u.perRoute.find(r => r.pad === '/api/bestel');
  assert.equal(lid.stand, 'gesloten');
  assert.deepEqual(lid.collecties[0].zetStand, ['aanbieder']);
  assert.equal(u.matrix.consument.aanbieder, 1);
});

test('2. TEGENPROEF: haal de ontvanger weg en dezelfde route staat open', () => {
  const u = O.meet({ proef: proefMet(route('/api/bestel', 'member', { orders: 1 })) });
  assert.equal(u.perRoute[0].stand, 'open');
  assert.deepEqual(u.openCollecties, [{ collectie: 'orders', bronroutes: 1 }]);
  assert.equal(u.telling.openCollecties, 1);
});

test('3. een ontvanger uit DEZELFDE groep is geen handoff', () => {
  const u = O.meet({ proef: proefMet(
    route('/api/bestel', 'member', { orders: 1 }),
    route('/api/bestel/wijzig', 'openbaar', { orders: 'gewijzigd' })) });
  assert.equal(u.perRoute.find(r => r.pad === '/api/bestel').stand, 'open',
    'member en openbaar zijn allebei consument; elkaar aanraken is geen handoff');
});

test('4. terminaal: een collectie zonder tweede partij is verklaard, met de soort erbij', () => {
  const u = O.meet({ proef: proefMet(route('/api/eigen', 'member', { [TERM_NAAM]: 1 })) });
  assert.equal(u.perRoute[0].stand, 'terminaal');
  assert.equal(u.perRoute[0].collecties[0].graad, O.TERMINAAL[TERM_NAAM].soort,
    'de graad van een terminale collectie IS zijn soort; "verklaard" zou de reden weggooien');
  assert.ok(!u.verlopen.terminaal.includes(TERM_NAAM), 'een gebruikte verklaring is niet verlopen');
});

test('4b. elke terminale soort is een van de drie, en drie is een besluit', () => {
  const soorten = new Set(Object.values(O.TERMINAAL).map(x => x.soort));
  assert.deepEqual([...soorten].sort(), ['boeking', 'huis', 'mens'],
    'een vierde soort erbij is een besluit en geen sluiproute voor een open collectie');
});

test('5. een verklaring die niemand meer nodig heeft, staat als verlopen in de uitslag', () => {
  const u = O.meet({ proef: proefMet(route('/api/x', 'member', { iets: 1 })) });
  assert.ok(u.verlopen.terminaal.includes(TERM_NAAM));
  assert.ok(u.verlopen.tussen.includes(Object.keys(O.TUSSEN)[0]));
  assert.ok(u.verlopen.infra.includes(INFRA_NAAM));
});

test('6. infra telt niet mee: een route die alleen de sessietabel raakt is geen bron', () => {
  const u = O.meet({ proef: proefMet(route('/api/x', 'member', { [INFRA_NAAM]: 1 })) });
  assert.equal(u.telling.bronroutes, 0);
});

test('7. niet gemeten is geen oordeel: een 404 in de proef telt niet als open', () => {
  const u = O.meet({ proef: proefMet(route('/api/x', 'member', { orders: 1 }, 404)) });
  assert.equal(u.telling.bronroutes, 0);
  assert.equal(u.nietGezien.nietGemeten, 1);
});

test('8. zonder rol geen groep: de route wordt geteld als niet gezien, niet als open', () => {
  const u = O.meet({ proef: proefMet(route('/api/x', null, { orders: 1 })) });
  assert.equal(u.telling.bronroutes, 0);
  assert.equal(u.nietGezien.zonderRol, 1);
});

test('8b. tussen: de ontvanger is een ander lid, en dat ziet dit groepenmodel niet', () => {
  const [c, d] = Object.entries(O.TUSSEN)[0];
  const [methode, pad] = d.tegenroute.split(' ');
  /* de tegenroute bestaat in de routelijst -> stand tussen, niet open */
  let u = O.meet({ proef: proefMet(route('/api/lid', 'member', { [c]: 1 })),
    routes: [{ methode, pad, bestand: null }] });
  assert.equal(u.perRoute[0].stand, 'tussen');
  assert.equal(u.perRoute[0].collecties[0].graad, 'verklaard');
  /* hij deed in de proef geen werk -> dat wordt GEMELD en niet verzwegen */
  assert.ok(u.tussenOngemeten.some(x => x.startsWith(c + ' -> ')),
    'een tegenroute die de proef niet kon meten hoort in de uitslag te staan (LAT.md regel 12)');
  /* TEGENPROEF: bestaat de tegenroute niet, dan is de verklaring verlopen en staat de bron open */
  u = O.meet({ proef: proefMet(route('/api/lid', 'member', { [c]: 1 })),
    routes: [{ methode: 'POST', pad: '/api/iets/anders', bestand: null }] });
  assert.equal(u.perRoute[0].stand, 'open');
  assert.ok(u.verlopen.tegenroute.some(x => x.startsWith(c + ' ->')),
    'een tegenroute die niet bestaat hoort in zijn eigen bak, niet bij de aangewezen ontvangers');
});

test('9. de stand van een route is de zwakste van zijn collecties', () => {
  const u = O.meet({ proef: proefMet(
    route('/api/twee', 'member', { orders: 1, los: 1 }),
    route('/api/s', 'supplier', { orders: 1 })) });
  assert.equal(u.perRoute.find(r => r.pad === '/api/twee').stand, 'open',
    'een gesloten collectie naast een open collectie is nog steeds een dood spoor');
});

test('10. een aangewezen ontvanger wordt getoetst tegen de proef', () => {
  const [c, d] = Object.entries(O.ONTVANGER)[0];
  const [, pad] = d.route.split(' ');
  /* aanwezig en met werk: de collectie is gezien, graad aangewezen */
  let u = O.meet({ proef: proefMet(route('/api/lid', 'member', { [c]: 1 }), route(pad, 'office', {})) });
  const r = u.perRoute.find(x => x.pad === '/api/lid');
  assert.equal(r.stand, 'gezien');
  assert.equal(r.collecties[0].graad, 'aangewezen');
  assert.deepEqual(u.verlopen.ontvanger.filter(x => x.startsWith(c + ' ->')), []);
  /* TEGENPROEF: de aangewezen route deed geen werk -> de aanwijzing is verlopen en de collectie open */
  u = O.meet({ proef: proefMet(route('/api/lid', 'member', { [c]: 1 }), route(pad, 'office', {}, 404)) });
  assert.equal(u.perRoute.find(x => x.pad === '/api/lid').stand, 'open');
  assert.ok(u.verlopen.ontvanger.some(v => v.startsWith(c + ' -> ')));
  /* en als de meter de ontvanger ZELF ziet, is de aanwijzing overbodig en dus verlopen */
  u = O.meet({ proef: proefMet(route('/api/lid', 'member', { [c]: 1 }), route(pad, 'office', { [c]: 1 })) });
  assert.equal(u.perRoute.find(x => x.pad === '/api/lid').stand, 'gesloten');
  assert.ok(u.verlopen.ontvanger.some(v => v.includes('niet meer nodig')));
});

test('11. gezien: een lezer in de bron van een andere groep, vermoed en zo gelabeld', () => {
  const map = fs.mkdtempSync(path.join(require('os').tmpdir(), 'doodspoor-'));
  const rel = path.relative(path.join(__dirname, '..'), path.join(map, 'lezer.js')).replace(/\\/g, '/');
  fs.writeFileSync(path.join(map, 'lezer.js'), "module.exports = (db) => db.data.orders.length;\n");
  try {
    const u = O.meet({
      proef: proefMet(route('/api/bestel', 'member', { orders: 1 }), route('/api/office/lees', 'office', {})),
      routes: [{ methode: 'POST', pad: '/api/office/lees', bestand: rel }]
    });
    const r = u.perRoute.find(x => x.pad === '/api/bestel');
    assert.equal(r.stand, 'gezien');
    assert.equal(r.collecties[0].graad, 'vermoed');
    assert.deepEqual(r.collecties[0].leest, ['kantoor']);
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
});

test('12. zonder routelijst zegt de uitslag dat "gezien" niet kon worden vastgesteld', () => {
  const u = O.meet({ proef: proefMet(route('/api/x', 'member', { orders: 1 })) });
  assert.ok(u.nietGezien.lezers && /routelijst/.test(u.nietGezien.lezers));
});

test('12b. een besluit-verklaring wijst naar een document dat bestaat', () => {
  /* De derde verklaringssoort uit de tweede triageronde: de ontvanger bestaat
     niet omdat de FUNCTIE nog niet bestaat, en dat is elders vastgelegd. Zonder
     deze toets is "wacht op een besluit" een etiket waarmee elke open collectie
     te verstoppen valt. */
  const fs2 = require('fs');
  for (const [c, d] of Object.entries(O.WACHT_OP_BESLUIT)) {
    assert.ok(d.document && /\.md$/.test(d.document), c + ': geen document met het besluit');
    assert.ok(fs2.existsSync(path.join(__dirname, '..', d.document)),
      c + ': ' + d.document + ' bestaat niet');
    assert.ok(d.reden && d.reden.length > 80, c + ': de reden is te kort om een besluit te beschrijven');
  }
  const u = O.meet({ proef: proefMet(route('/api/x', 'member', { iets: 1 })) });
  assert.ok(u.verlopen.besluit.length, 'een ongebruikte besluit-verklaring hoort verlopen te heten');
});

test('13. elke verklaring draagt een reden die iets zegt', () => {
  for (const [k, v] of Object.entries(O.INFRA))
    assert.ok(typeof v === 'string' && v.length > 15, k + ' heeft geen reden');
  for (const [k, v] of Object.entries(O.TERMINAAL)) {
    assert.ok(['mens', 'huis', 'boeking'].includes(v.soort), k + ' heeft geen geldige soort');
    assert.ok(v.reden && v.reden.length > 25, k + ' heeft geen reden');
  }
  for (const [k, v] of Object.entries(O.TUSSEN)) {
    assert.ok(/^(POST|GET) \/api\//.test(v.tegenroute), k + ': tegenroute zonder methode en pad');
    assert.ok(v.reden && v.reden.length > 25, k + ' heeft geen reden');
  }
  for (const [k, v] of Object.entries(O.ONTVANGER)) {
    assert.ok(/^(POST|GET) \/api\//.test(v.route), k + ': route zonder methode en pad');
    assert.ok(v.reden && v.reden.length > 15, k + ' heeft geen reden');
  }
});

test('14. het register bestaat, sluit, en heeft geen verlopen verklaringen', () => {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'DOODSPOOR.json'), 'utf8'));
  const t = j.telling;
  assert.ok(t.bronroutes > 0, 'nul bronroutes: de meter zag niets en mag niet groen zijn (LAT.md regel 3)');
  assert.equal(t.gesloten + t.gezien + t.tussen + t.terminaal + t.besluit + t.open, t.bronroutes,
    'de zes standen tellen niet op tot het geheel');
  assert.deepEqual(j.verlopen, { terminaal: [], tussen: [], besluit: [], tegenroute: [], infra: [], ontvanger: [] },
    'verlopen verklaring in DOODSPOOR.json; draai npm run doodspoor:vast en ruim op');
  assert.ok(j.grens && /geen poort/.test(j.grens), 'het register hoort te zeggen dat de eerste ronde geen poort is');
});

test('15. MAATSTAF.md telt zijn uitspraken zoals de tabel ze draagt', () => {
  const tekst = fs.readFileSync(path.join(__dirname, '..', 'MAATSTAF.md'), 'utf8');
  const rijen = tekst.split('\n').filter(l => /^\| U\d+ \|/.test(l));
  assert.ok(rijen.length >= 20, 'de uitsprakentabel is te kort om een noemer te zijn');
  const telling = {};
  for (const r of rijen) {
    const cellen = r.split('|').map(x => x.trim());
    const uitkomst = cellen[cellen.length - 2].replace(/\*/g, '');
    telling[uitkomst] = (telling[uitkomst] || 0) + 1;
  }
  const m = tekst.match(/Geteld uit de tabel: (\d+) uitspraken -- staat (\d+), stap weg (\d+), besluit (\d+), jaren weg (\d+), geprojecteerd (\d+)\./);
  assert.ok(m, 'de telregel ontbreekt of heeft een andere vorm');
  assert.equal(Number(m[1]), rijen.length, 'het totaal in de telregel is niet het aantal rijen');
  assert.equal(Number(m[2]), telling['staat'] || 0, 'staat');
  assert.equal(Number(m[3]), telling['stap weg'] || 0, 'stap weg');
  assert.equal(Number(m[4]), telling['besluit'] || 0, 'besluit');
  assert.equal(Number(m[5]), telling['jaren weg'] || 0, 'jaren weg');
  assert.equal(Number(m[6]), telling['geprojecteerd'] || 0, 'geprojecteerd');
  const onbekend = Object.keys(telling).filter(k => !['staat', 'stap weg', 'besluit', 'jaren weg', 'geprojecteerd'].includes(k));
  assert.deepEqual(onbekend, [], 'een uitkomst die geen van de vijf is: ' + onbekend.join(', '));
});
