/* DE GEBIEDEN VAN DE NAVIGATIE -- de catalogus, de gebiedsbepaling en de
   licentiepoort.

   Deze laag bestaat omdat de motor precies EEN gebied kende (Nederland, met een
   bbox en een bestandsnaam in de code). Wat hier wordt vastgelegd is vooral wat
   hij NIET mag beweren: aangeboden is geen dekking, een rechthoek is geen
   grens, en een licentieplicht die nergens staat wordt niet doorgelaten.

   Draai los: node --test test/navigatiegebieden.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

/* Een eigen datamap per proef: deze laag LEEST de schijf (welke pakketten
   liggen er), dus een proef die de echte RTG_DATA_DIR gebruikt meet de
   ontwikkelmachine en niet de code. */
function metDataMap(fn) {
  const oud = process.env.RTG_DATA_DIR;
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gebieden-'));
  fs.mkdirSync(path.join(map, 'navigatie'), { recursive: true });
  process.env.RTG_DATA_DIR = map;
  /* Verse require: de module leest RTG_DATA_DIR bij elke aanroep via een
     functie en niet bij het laden, maar dat is precies wat toets 1 vastlegt --
     hier hangt de proef er niet van af. */
  try { return fn(map, require('../server/kern/navigatie/gebieden')); }
  finally { if (oud === undefined) delete process.env.RTG_DATA_DIR; else process.env.RTG_DATA_DIR = oud; }
}
const schrijfIndex = (map, j) =>
  fs.writeFileSync(path.join(map, 'navigatie', 'gebieden.json'), JSON.stringify(j));
const legPakket = (map, code) => {
  fs.writeFileSync(path.join(map, 'navigatie', code + '.sqlite'), 'x');
  fs.mkdirSync(path.join(map, 'navigatie', code + '-graaf'), { recursive: true });
  fs.writeFileSync(path.join(map, 'navigatie', code + '-graaf', 'graaf.json'), '{}');
};

const NL = { code: 'nederland', naam: 'Nederland', soort: 'land',
  vak: { lat0: 50.70, lat1: 53.72, lng0: 3.20, lng1: 7.30 } };
const BE = { code: 'belgie', naam: 'Belgie', soort: 'land',
  vak: { lat0: 49.49, lat1: 51.51, lng0: 2.54, lng1: 6.41 } };
const AMS = { code: 'amsterdam', naam: 'Amsterdam', soort: 'stad',
  vak: { lat0: 52.28, lat1: 52.43, lng0: 4.73, lng1: 5.07 } };

test('1. zonder index is de catalogus LEEG met een reden, niet stil nul', () => {
  /* Het verschil dat deze toets bewaakt: "wij hebben niet gekeken" leest anders
     dan "er is niets aan te bieden". Een lege lijst zonder reden is het tweede,
     en dat is onwaar. */
  metDataMap((map, g) => {
    const c = g.catalogus();
    assert.equal(c.telling.aangeboden, 0);
    assert.ok(c.reden, 'er staat een reden bij de lege catalogus');
    assert.match(c.reden, /geen gebiedsindex/i);
    assert.match(c.reden, /iets anders dan dat er niets is/i, 'en hij zegt het verschil');
  });
});

test('2. een onleesbare index wordt niet geraden', () => {
  metDataMap((map, g) => {
    fs.writeFileSync(path.join(map, 'navigatie', 'gebieden.json'), '{dit is geen json');
    const c = g.catalogus();
    assert.equal(c.telling.aangeboden, 0);
    assert.match(c.reden, /niet te lezen/i);
    assert.match(c.reden, /niet geraden/i);
  });
});

test('3. aangeboden is GEEN dekking: de drie standen lopen niet door elkaar', () => {
  /* De duurste verwarring van deze laag. Een catalogus van tweehonderd landen
     zegt niets over hoeveel kaarten er werkelijk liggen. */
  metDataMap((map, g) => {
    schrijfIndex(map, { bron: 'proef', gebieden: [NL, BE, AMS] });
    legPakket(map, 'nederland');
    const c = g.catalogus();
    assert.equal(c.telling.aangeboden, 3, 'drie gebieden aangeboden');
    assert.equal(c.telling.gebouwd, 1, 'en precies een gebouwd');
    assert.equal(c.gebieden.find(x => x.code === 'nederland').gebouwd, true);
    assert.equal(c.gebieden.find(x => x.code === 'belgie').gebouwd, false);
    for (const x of c.gebieden) assert.equal(x.aangeboden, true);
  });
});

test('4. een rechthoek beslist niet tussen twee landen', () => {
  /* DE VONDST DIE DEZE TOETS VASTLEGT. De eerste versie koos "het kleinste
     omvattende vak", en dat is fout: het Belgische vak is kleiner dan het
     Nederlandse, dus Maastricht -- onmiskenbaar Nederland -- kwam op `belgie`
     uit. Een lid had daar een route over het Belgische wegennet gekregen, met
     een echte reistijd en een bron eronder: de gevaarlijkste vorm van fout. */
  metDataMap((map, g) => {
    const lijst = [NL, BE].map(x => ({ ...x, gebouwd: false }));
    const r = g.gebiedVoor({ lat: 50.85, lng: 5.69 }, lijst);
    assert.equal(r.gebied, null, 'er wordt niet gekozen');
    assert.equal(r.grond, 'meerdere-vakken');
    assert.deepEqual(r.kandidaten, ['belgie', 'nederland'], 'beide kandidaten staan erbij');
    assert.match(r.waarom, /rechthoek is geen grens/i);
    /* En de tegenproef: zodra er maar EEN vak past, wordt er wel gekozen.
       Zonder deze helft haalt een gebiedVoor() die altijd null geeft de toets. */
    const enkel = g.gebiedVoor({ lat: 52.09, lng: 5.12 }, [{ ...NL, gebouwd: false }]);
    assert.equal(enkel.gebied.code, 'nederland');
    assert.equal(enkel.grond, 'enig-vak');
  });
});

test('5. een stad in een land is echte omvatting en wint wel', () => {
  metDataMap((map, g) => {
    const r = g.gebiedVoor({ lat: 52.37, lng: 4.89 }, [NL, AMS].map(x => ({ ...x, gebouwd: false })));
    assert.equal(r.gebied.code, 'amsterdam');
    assert.equal(r.grond, 'stad-in-land');
    assert.deepEqual(r.kandidaten, ['nederland'], 'het land blijft als kandidaat staan');
  });
});

test('6. een gedwongen keuze heet gedwongen en niet gemeten', () => {
  /* Twee landen overlappen, maar van een ligt er een pakket. Dan is de uitkomst
     bruikbaar EN de grond eerlijk: `enige-gebouwde`, met de reden erbij. Wie
     deze grond voor een grensbepaling aanziet, leest er meer in dan er staat. */
  metDataMap((map, g) => {
    const lijst = [{ ...NL, gebouwd: true }, { ...BE, gebouwd: false }];
    const r = g.gebiedVoor({ lat: 50.85, lng: 5.69 }, lijst);
    assert.equal(r.gebied.code, 'nederland');
    assert.equal(r.grond, 'enige-gebouwde');
    assert.match(r.waarom, /gedwongen en niet gemeten/i);
  });
});

test('7. elk gevonden gebied zegt dat een vak geen grens is', () => {
  metDataMap((map, g) => {
    for (const punt of [{ lat: 52.09, lng: 5.12 }, { lat: 52.37, lng: 4.89 }]) {
      const r = g.gebiedVoor(punt, [NL, AMS].map(x => ({ ...x, gebouwd: false })));
      assert.equal(r.vakIsGeenGrens, true, 'op ' + JSON.stringify(punt));
    }
  });
});

test('8. buiten elk vak is een eersteklas antwoord', () => {
  metDataMap((map, g) => {
    const r = g.gebiedVoor({ lat: 38.91, lng: 1.43 }, [NL, BE, AMS]);
    assert.equal(r.gebied, null);
    assert.equal(r.grond, 'geen-vak');
    assert.match(r.waarom, /biedt hier \(nog\) geen kaart aan/i);
  });
});

test('9. een omgedraaid vak omvat NIETS in plaats van alles', () => {
  /* Een vak waarvan de hoeken verwisseld zijn, is een fout en geen leeg gebied.
     Zonder deze controle zou `lat0 > lat1` elke vergelijking laten falen en
     langskomen als "past nergens" -- dan zoekt iemand de fout in de data. */
  metDataMap((map, g) => {
    assert.equal(g.vakGeldig({ lat0: 53, lat1: 50, lng0: 3, lng1: 7 }), false);
    assert.equal(g.inVak({ lat0: 53, lat1: 50, lng0: 3, lng1: 7 }, { lat: 52, lng: 5 }), false);
    assert.equal(g.vakGeldig({ lat0: 50, lat1: 53, lng0: 3, lng1: 7 }), true);
    assert.equal(g.vakGeldig({ lat0: -91, lat1: 53, lng0: 3, lng1: 7 }), false, 'niet op de aarde');
  });
});

test('10. de licentiepoort laat geen onvervulde plicht door', () => {
  /* ODbL vraagt naamsvermelding. Een pakket dat die plicht draagt en er geen
     bij levert, zou RTG een verplichting geven die nergens op het scherm staat.
     Dat is juridisch en geen afspraak, dus het is een poort. */
  metDataMap((map, g) => {
    assert.equal(g.mag({ licentie: 'CC0 1.0' }).ok, true, 'CC0 vraagt niets');
    assert.equal(g.mag({ licentie: 'ODbL 1.0' }).ok, false, 'ODbL zonder vermelding');
    assert.match(g.mag({ licentie: 'ODbL 1.0' }).reden, /eist naamsvermelding/i);
    const met = g.mag({ licentie: 'ODbL 1.0', naamsvermelding: '(c) OpenStreetMap-bijdragers' });
    assert.equal(met.ok, true);
    assert.equal(met.naamsvermelding, '(c) OpenStreetMap-bijdragers');
    assert.equal(g.mag({}).ok, false, 'geen licentie is geen vrijbrief');
    assert.match(g.mag({}).reden, /noemt geen licentie/i);
    /* EEN ONBEKENDE LICENTIE KRIJGT NIET HET VOORDEEL VAN DE TWIJFEL. Zou hij
       dat wel krijgen, dan is elke typefout in een licentienaam een stille
       vrijstelling. */
    assert.equal(g.mag({ licentie: 'iets-eigens' }).ok, false);
    assert.equal(g.eistNaamsvermelding(''), true, 'leeg telt als eisend');
    assert.equal(g.eistNaamsvermelding('ODbL 1.0'), true);
    assert.equal(g.eistNaamsvermelding('CC0 1.0'), false);
  });
});

test('11. het pakket van een gebied komt uit zijn CODE en niet uit een vaste naam', () => {
  /* Hier zat een echte val: de graafmap heette letterlijk `nederland-graaf`,
     afgeleid van de MAP van het bestand en niet van zijn naam. Een tweede
     pakket in dezelfde map zou de graaf van Nederland inlezen en er een Franse
     route op rekenen. */
  metDataMap((map, g) => {
    const nl = g.pakketVan('nederland'), fr = g.pakketVan('frankrijk');
    assert.notEqual(nl.graafMap, fr.graafMap, 'twee gebieden delen geen graafmap');
    assert.match(nl.graafMap, /nederland-graaf$/);
    assert.match(fr.graafMap, /frankrijk-graaf$/);
    assert.equal(g.pakketLigt('nederland'), false, 'nog niets gelegd');
    legPakket(map, 'nederland');
    assert.equal(g.pakketLigt('nederland'), true);
    assert.equal(g.pakketLigt('frankrijk'), false, 'en dat zegt niets over een ander gebied');
  });
});
