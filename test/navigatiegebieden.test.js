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
/* AMSTERDAM HANGT ONDER NEDERLAND, en dat veld is de hele reden dat de keuze
   werkt: omvatting komt uit de BRON (`ouder`) en niet uit het label `stad`.
   Deze fixture droeg eerst alleen `soort: 'stad'`, en toen de regel van
   oppervlak naar verklaarde omvatting ging, zakte hij terecht -- een stad
   zonder ouder is voor de keuze een buurland. */
const AMS = { code: 'amsterdam', naam: 'Amsterdam', soort: 'stad', ouder: 'nederland',
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

test('5. een kind wint van zijn ouder, want de bron verklaart die omvatting', () => {
  metDataMap((map, g) => {
    const r = g.gebiedVoor({ lat: 52.37, lng: 4.89 }, [NL, AMS].map(x => ({ ...x, gebouwd: false })));
    assert.equal(r.gebied.code, 'amsterdam');
    assert.equal(r.grond, 'kind-in-ouder');
    assert.deepEqual(r.kandidaten, ['nederland'], 'de ouder blijft als kandidaat staan');
  });
});

test('5b. een gebied ZONDER ouder is geen kind, ook niet als het kleiner is', () => {
  /* De tegenproef op toets 5, en de kern van de reparatie: kleiner zijn is geen
     omvatting. Amsterdam zonder `ouder` is voor deze laag een buurland van
     Nederland -- precies de vorm waarin het Belgische vak Maastricht opeiste. */
  metDataMap((map, g) => {
    const los = { ...AMS, ouder: null, gebouwd: false };
    const r = g.gebiedVoor({ lat: 52.37, lng: 4.89 }, [{ ...NL, gebouwd: false }, los]);
    assert.equal(r.gebied, null, 'zonder verklaarde ouder wordt er niet gekozen');
    assert.equal(r.grond, 'meerdere-vakken');
  });
});

test('5c. een ouderketen loopt door, en een lus loopt niet oneindig', () => {
  /* De bron levert kettingen (`europe` > `netherlands` > `noord-holland`), dus
     de winnaar kan een KLEINKIND zijn. En de index komt van buiten: een
     verwijzing die naar zichzelf of rond wijst, mag geen oneindige lus worden. */
  const keuze = require('../server/kern/navigatie/gebiedkeuze');
  const EU = { code: 'europa', naam: 'Europa', ouder: null, vak: { lat0: 35, lat1: 71, lng0: -10, lng1: 40 } };
  const NH = { code: 'noord-holland', naam: 'Noord-Holland', ouder: 'nederland',
    vak: { lat0: 52.16, lat1: 53.18, lng0: 4.51, lng1: 5.36 } };
  const r = keuze.gebiedVoor({ lat: 52.37, lng: 4.89 }, [EU, { ...NL, ouder: 'europa' }, NH]);
  assert.equal(r.gebied.code, 'noord-holland', 'het kleinkind wint van beide ouders');
  assert.deepEqual(r.kandidaten, ['europa', 'nederland']);

  const lus = [{ code: 'a', ouder: 'b', vak: NL.vak }, { code: 'b', ouder: 'a', vak: NL.vak }];
  const l = keuze.gebiedVoor({ lat: 52.09, lng: 5.12 }, lus);
  assert.ok(l, 'een lus in de index levert een antwoord in plaats van vast te lopen');
  assert.equal(l.gebied, null, 'en hij kiest niet tussen twee gebieden die elkaars ouder zijn');
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
    assert.match(r.waarom, /geen familie/i, 'en hij zegt dat het buren zijn');
    assert.match(r.waarom, /gedwongen en niet gemeten/i);
  });
});

test('7. elk gevonden gebied zegt dat een vak geen grens is', () => {
  metDataMap((map, g) => {
    for (const punt of [{ lat: 52.09, lng: 5.12 }, { lat: 52.37, lng: 4.89 }]) {
      const r = g.gebiedVoor(punt, [NL, AMS].map(x => ({ ...x, gebouwd: false })));
      assert.ok(r.gebied, 'er is een gebied gevonden op ' + JSON.stringify(punt));
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

test('10b. de catalogus geeft de ouder DOOR, en de keuze werkt zonder lijst', () => {
  /* HET GAT DAT DEZE TOETS DICHT. Alle keuzetoetsen hierboven geven een eigen
     lijst mee, dus het `ouder`-veld van de CATALOGUS werd nergens geraakt: met
     een mutatie die `ouder: null` zette, bleven ze alle dertien groen. Een
     catalogus die de ouder laat vallen, verliest de omvatting stilzwijgend --
     en dan kiest de laag opeens niet meer tussen Amsterdam en Nederland.

     Daarom loopt deze toets langs `gebiedVoor(punt)` ZONDER lijst, zoals een
     echte aanroeper die alleen een punt heeft. */
  metDataMap((map, g) => {
    schrijfIndex(map, { bron: 'proef', licentie: 'ODbL 1.0', gebieden: [NL, AMS] });
    const uitCatalogus = g.catalogus().gebieden;
    assert.equal(uitCatalogus.find(x => x.code === 'amsterdam').ouder, 'nederland',
      'de catalogus draagt de ouder uit de index');
    assert.equal(uitCatalogus.find(x => x.code === 'nederland').ouder, null);

    const r = g.gebiedVoor({ lat: 52.37, lng: 4.89 });
    assert.equal(r.gebied.code, 'amsterdam', 'en de keuze gebruikt hem');
    assert.equal(r.grond, 'kind-in-ouder');
  });
});

test('10c. een gebiedscode uit een vreemde index verlaat de datamap niet', () => {
  /* EEN ECHT GAT, EN GEEN VOORZORG. De index wordt van BUITEN opgehaald en zijn
     code wordt een bestandsnaam: `pakketVan('../../../etc/passwd')` gaf
     `./etc/passwd.sqlite` terug -- de datamap uit. Het gewone geval was al fout,
     want de bronindex draagt ids MET schuine strepen (`europe/netherlands`), en
     die maakten stilletjes submappen aan waar pakketLigt() nooit keek.

     Fail closed: een onveilige code levert `null` en geen pad. Een pad
     teruggeven dat "toch wel klopt" is precies hoe zo'n gat blijft bestaan. */
  metDataMap((map, g) => {
    for (const kwaad of ['../../../etc/passwd', 'europe/netherlands', 'a\\b', '..', '.',
      'nl/../../x', '-nl', 'nl-', 'nl_1', 'n l', '']) {
      assert.equal(g.pakketVan(kwaad), null, JSON.stringify(kwaad) + ' levert geen pad');
      assert.equal(g.pakketLigt(kwaad), false, JSON.stringify(kwaad) + ' ligt nergens');
    }
    /* En de tegenproef: een gewone code werkt WEL, en blijft in de datamap.
       Zonder deze helft haalt een pakketVan die altijd null geeft de toets. */
    const ok = g.pakketVan('nederland');
    assert.ok(ok, 'een gewone code levert een pakket');
    assert.equal(path.dirname(ok.db), path.join(map, 'navigatie'), 'en het staat in de datamap');
    assert.equal(path.relative(path.join(map, 'navigatie'), ok.db), 'nederland.sqlite');
  });
});

test('10d. een onveilige code valt niet STIL uit de catalogus', () => {
  /* Weigeren is goed, stil weigeren niet: een gebied dat zonder een woord
     verdwijnt, kost iemand een middag zoeken. */
  metDataMap((map, g) => {
    schrijfIndex(map, { bron: 'proef', gebieden: [
      NL,
      { code: 'europe/netherlands', naam: 'Nederland via Europa', vak: NL.vak },
      { code: '../../etc/passwd', naam: 'Kwaad', vak: NL.vak }
    ] });
    const c = g.catalogus();
    assert.equal(c.telling.aangeboden, 1, 'alleen de veilige code komt door');
    assert.equal(c.telling.geweigerd, 2, 'en de andere twee zijn GETELD');
    assert.deepEqual(c.geweigerd.sort(), ['../../etc/passwd', 'europe/netherlands']);
    assert.equal(c.gebieden[0].code, 'nederland');
  });
});

test('11. het pakket van een gebied komt uit zijn CODE en niet uit een vaste naam', () => {
  /* Hier zat een echte val: de graafmap heette letterlijk `nederland-graaf`,
     afgeleid van de MAP van het bestand en niet van zijn naam. Een tweede
     pakket in dezelfde map zou de graaf van Nederland inlezen en er een Franse
     route op rekenen. */
  metDataMap((map, g) => {
    const nl = g.pakketVan('nederland'), fr = g.pakketVan('frankrijk');
    assert.ok(nl && fr, 'beide codes zijn veilig en leveren een pakket');
    assert.notEqual(nl.graafMap, fr.graafMap, 'twee gebieden delen geen graafmap');
    assert.match(nl.graafMap, /nederland-graaf$/);
    assert.match(fr.graafMap, /frankrijk-graaf$/);
    assert.equal(g.pakketLigt('nederland'), false, 'nog niets gelegd');
    legPakket(map, 'nederland');
    assert.equal(g.pakketLigt('nederland'), true);
    assert.equal(g.pakketLigt('frankrijk'), false, 'en dat zegt niets over een ander gebied');
  });
});
