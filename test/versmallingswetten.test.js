'use strict';
/* DE VERSMALLINGSWETTEN -- drie regels die een delegatie of machtiging nooit
   ruimer mogen laten worden dan haar bron, met per regel de fout die er echt
   in zat (Fase 0 van het authority-plan, 4 oktober 2026).

   1. LEEG IS DICHT (kern/commercie/bevoegdheid.js). Een bevoegdheid zonder
      scope werd stil `'*'`, en een verzoek zonder scope sloeg de scopetoets
      over: een bevoegdheid voor zaak:A werkte dan overal. Hetzelfde voor een
      bewijstoken dat werd verbruikt zonder te zeggen voor welke handeling.

   2. ROMMEL VERRUIMT NIETS (kern/commercie/bevoegdheid.js). `Math.min(1000,
      'veel')` is NaN, `past()` las NaN als "geen grens", en een delegatie die
      versmallen moest maakte van tien euro een onbeperkte bevoegdheid.

   3. EEN SET IS GEEN UITZONDERING (kern/namens/versmalling.js). Een Set ging
      ongekeurd door: een object kwam in `effectief`, of de sortering viel om.

   De eigenschapstoetsen onderaan draaien met een vaste seed, zodat een gezakt
   geval te herhalen is: de seed en het geval staan in de foutmelding. Er is
   met opzet geen afhankelijkheid voor property-testing bijgekomen. */

const test = require('node:test');
const assert = require('node:assert/strict');

const bev = require('../server/kern/commercie/bevoegdheid');
const { maakBesluit, UITKOMST } = require('../server/kern/commercie/besluit');
const { maakBewijstoken, geheugenGezien } = require('../server/kern/commercie/bewijstoken');
const versmalling = require('../server/kern/namens/versmalling');

const NU = () => 1_700_000_000_000;
const maak = (o = {}) => bev.maakBevoegdheid(Object.assign(
  { capability: 'money.refund', scope: 'zaak:A', grenzen: { maxCenten: 1000 }, door: 'directeur', nu: NU }, o));

/* ---------------------------------------------------------- 1. leeg is dicht */

test('1a. een bevoegdheid zonder scope bestaat niet; "*" moet je uitschrijven', () => {
  assert.throws(() => maak({ scope: undefined }), /expliciete scope/);
  assert.throws(() => maak({ scope: null }), /expliciete scope/);
  assert.throws(() => maak({ scope: '  ' }), /expliciete scope/);
  assert.equal(maak({ scope: '*' }).scope, '*');
});

test('1b. een verzoek zonder scope komt niet door een bevoegdheid met scope', () => {
  const b = maak();
  assert.match(bev.past(b, { waardeCenten: 100 }), /geldt voor zaak:A en het verzoek noemt niet waarvoor/);
  assert.match(bev.past(b, { scope: 'zaak:B', waardeCenten: 100 }), /niet voor zaak:B/);
  assert.equal(bev.past(b, { scope: 'zaak:A', waardeCenten: 100 }), null);
  // '*' is de enige vorm van "overal", en die blijft werken zonder scope
  assert.equal(bev.past(maak({ scope: '*' }), { waardeCenten: 100 }), null);
});

test('1c. in het besluit wordt dat WEIGEREN, en een vergeten scope ONBEKEND -- nooit TOESTAAN', () => {
  const metScope = maakBesluit({ zoekBevoegdheid: () => maak(), nu: NU });
  const zonderDoel = metScope.beslis({ actor: 'x', handeling: 'money.refund', waardeCenten: 100 });
  assert.equal(zonderDoel.uitkomst, UITKOMST.WEIGEREN);

  const vergeten = maakBesluit({ zoekBevoegdheid: () => maak({ scope: undefined }), nu: NU });
  const r = vergeten.beslis({ actor: 'x', handeling: 'money.refund', doel: 'zaak:A', waardeCenten: 100 });
  assert.equal(r.uitkomst, UITKOMST.ONBEKEND, 'een bevoegdheid die niet gebouwd kon worden is geen ja');
});

test('1d. een bewijstoken: scope en handeling moeten worden genoemd', () => {
  const token = maakBewijstoken({ sleutel: 'een-geheim-dat-lang-genoeg-is', nu: NU, gezien: geheugenGezien(NU) });
  const m = token.munt(maak(), { actor: 'x', eenmalig: false });
  assert.equal(m.ok, true);

  assert.match(token.verbruik(m.token, { waardeCenten: 1, doel: 'zaak:A' }).error, /zeg waarvoor/);
  assert.match(token.verbruik(m.token, { capability: 'money.refund', waardeCenten: 1 }).error,
    /geldt voor zaak:A en het verzoek noemt niet waarvoor/);
  assert.equal(token.verbruik(m.token, { capability: 'money.refund', doel: 'zaak:A', waardeCenten: 1 }).ok, true);
});

/* ----------------------------------------------------- 2. rommel verruimt niets */

test('2a. delegeren met een onleesbare grens wordt geweigerd, met de reden', () => {
  const gever = maak({ scope: '*' });
  for (const rommel of ['veel', NaN, Infinity, -1, 2.5, null, {}, '1000']) {
    const d = bev.delegeer(gever, { grenzen: { maxCenten: rommel }, door: 'x', nu: NU });
    assert.ok(d.error, 'maxCenten ' + JSON.stringify(rommel) + ' had geweigerd moeten worden');
    assert.match(d.error, /ongeldige grens: maxCenten/);
  }
  // een geldige versmalling blijft gewoon werken
  assert.equal(bev.delegeer(gever, { grenzen: { maxCenten: 500 }, door: 'x', nu: NU }).bevoegdheid.grenzen.maxCenten, 500);
});

test('2b. de oude aanval: tien euro wordt nooit onbeperkt', () => {
  const tienEuro = maak({ scope: '*' });
  // zelfs als iemand versmal() rechtstreeks met rommel voedt, blijft de basis staan
  assert.equal(bev.versmal(tienEuro.grenzen, { maxCenten: 'veel' }).maxCenten, 1000);
  assert.equal(bev.versmal(tienEuro.grenzen, { maxCenten: NaN }).maxCenten, 1000);

  // en een bevoegdheid waarvan de opgeslagen grens onleesbaar IS, geldt niet
  const kapot = Object.assign({}, tienEuro, { grenzen: { maxCenten: NaN } });
  assert.match(bev.past(kapot, { waardeCenten: 999999 }), /niet te lezen/);
  assert.match(bev.pastBinnenDag(kapot, { waardeCenten: 1 }), /niet te lezen/);
});

test('2c. een bevoegdheid bouwen met een onleesbare grens kan niet', () => {
  assert.throws(() => maak({ grenzen: { maxCenten: 'veel' } }), /Ongeldige grens/);
  assert.throws(() => maak({ grenzen: { apparaatVertrouwd: 'ja' } }), /Ongeldige grens/);
});

test('2d. een bewijstoken munten met een onleesbare grens kan niet', () => {
  const token = maakBewijstoken({ sleutel: 'een-geheim-dat-lang-genoeg-is', nu: NU, gezien: geheugenGezien(NU) });
  assert.match(token.munt(maak(), { actor: 'x', grenzen: { maxCenten: 'veel' } }).error, /Ongeldige grens/);
});

/* ------------------------------------------------- 3. een Set is geen uitzondering */

test('3a. een Set wordt gekeurd zoals een lijst', () => {
  const object = {};
  const s = new Set(['a', object, 1, '', 'b']);
  const r = versmalling.versmalNamens({ gevraagd: s, geverEffectief: s, beleid: s, context: s });
  assert.deepEqual(r.effectief, ['a', 'b']);
  const l = versmalling.versmalNamens({ gevraagd: [...s], geverEffectief: [...s], beleid: [...s], context: [...s] });
  assert.deepEqual(r.effectief, l.effectief);
});

test('3b. een Set met geweigerde niet-teksten laat de doorsnede niet omvallen', () => {
  assert.doesNotThrow(() => versmalling.doorsnede({
    gevraagd: new Set([1, 2, 'x']), geverEffectief: [], beleid: [], context: [] }));
});

/* ------------------------------------------------------------ eigenschappen */

function generator(seed) {
  let s = seed >>> 0;
  const getal = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  const kies = l => l[Math.floor(getal() * l.length)];
  return { getal, kies };
}

const ROMMEL = ['veel', NaN, Infinity, -Infinity, -5, 0.5, null, undefined, {}, [], true, false, '10'];

test('P2. versmal() maakt een grens nooit ruimer, wat je er ook in stopt (10.000 gevallen)', () => {
  const g = generator(20261004);
  const namen = Object.keys(bev.GRENZEN);
  for (let i = 0; i < 10000; i++) {
    const basis = {}, extra = {};
    for (const naam of namen) {
      const getalGrens = bev.GRENZEN[naam].soort === 'getal';
      if (g.getal() < 0.6) basis[naam] = getalGrens ? Math.floor(g.getal() * 100000) : g.getal() < 0.5;
      if (g.getal() < 0.6) {
        extra[naam] = g.getal() < 0.5 ? g.kies(ROMMEL)
          : (getalGrens ? Math.floor(g.getal() * 200000) : g.getal() < 0.5);
      }
    }
    if (g.getal() < 0.2) extra.verzonnenGrens = g.kies(ROMMEL);
    const uit = bev.versmal(basis, extra);
    const geval = ' (seed 20261004, geval ' + i + ': ' + JSON.stringify({ basis, extra }) + ')';
    assert.deepEqual(bev.keurGrenzen(uit), [], 'de uitkomst bevat een onleesbare grens' + geval);
    for (const naam of Object.keys(basis)) {
      if (bev.GRENZEN[naam].soort === 'getal') assert.ok(uit[naam] <= basis[naam], naam + ' werd ruimer' + geval);
      else if (basis[naam] === true) assert.equal(uit[naam], true, naam + ' ging uit' + geval);
    }
    assert.ok(!('verzonnenGrens' in uit), 'een onbekende grens kwam erin' + geval);
  }
});

test('P3. de doorsnede voegt nooit iets toe en valt nooit om, ook niet op rommel (10.000 gevallen)', () => {
  const g = generator(4102026);
  const sleutels = ['a.lezen', 'b.schrijven', 'c.betalen', 'd.delen', 'e.tekenen'];
  const element = () => (g.getal() < 0.7 ? g.kies(sleutels) : g.kies(ROMMEL.concat([1, 2, ''])));
  const bron = () => {
    const r = g.getal();
    if (r < 0.1) return null;
    if (r < 0.15) return g.kies(['tekst', 7, {}]);
    const lijst = Array.from({ length: Math.floor(g.getal() * 6) }, element);
    return r < 0.55 ? lijst : new Set(lijst);
  };
  for (let i = 0; i < 10000; i++) {
    const invoer = { gevraagd: bron(), geverEffectief: bron(), beleid: bron(), context: bron() };
    const geval = ' (seed 4102026, geval ' + i + ')';
    let r;
    assert.doesNotThrow(() => { r = versmalling.doorsnede(invoer); }, 'doorsnede viel om' + geval);
    assert.ok(r.effectief.every(x => typeof x === 'string' && x), 'iets anders dan een sleutel in effectief' + geval);
    assert.equal(versmalling.overtreding(r, invoer), null, 'de doorsnede voegde iets toe' + geval);
    const besluit = versmalling.versmalNamens(invoer);
    if (besluit.ok) assert.equal(versmalling.overtreding(besluit, invoer), null, 'het besluit voegde iets toe' + geval);
    if (Object.values(invoer).some(v => v == null)) assert.equal(besluit.ok, false, 'onbekend werd ja' + geval);
  }
});
