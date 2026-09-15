/* HET VERKLARINGSREGISTER NAAST DE METING -- en met opzet zonder winnaar.

   `kern/namens/verklaring.js` is een VERKLARING (een mens schrijft op wat een
   mechanisme doet) en `NAMENSVORM.json` een METING (een script leest de bron).
   Die twee horen naast elkaar te staan, zoals `EIGENAAR` naast `detecteer()` in
   scripts/lib/registereigenaar.js en IDEMBESLUIT.json naast IDEMPROEF.json.

   TOETS 4 IS DE REDEN DAT DEZE VORM WERKT. Hij legt ze naast elkaar en eist NIET
   dat ze het eens zijn -- de meter is lexicaal en dus een ondergrens, en hij
   mist aantoonbaar dingen (`verleen` dat een doorsnede rekent, een spoor dat in
   een buurmodule woont). Wat hij wél eist is dat elke afwijking in de verklaring
   is OPGESCHREVEN als `opmerking`. Zo kan de verklaring niet stilletjes ruimer
   worden dan de code, en hoeft de meter niet te liegen om groen te blijven.

   Zou deze toets gelijkheid eisen, dan is er maar één uitweg: de verklaring uit
   de meting genereren. Dan vergelijkt hij zichzelf en zegt de uitslag niets --
   precies de fout die de kop van registereigenaar.js beschrijft. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const V = require('../server/kern/namens/verklaring');

const WORTEL = path.join(__dirname, '..');
const meting = () => JSON.parse(fs.readFileSync(path.join(WORTEL, 'NAMENSVORM.json'), 'utf8'));

test('1. elk mechanisme verklaart alle zeven werkwoorden, met een grond bij elke uitzondering', () => {
  const fouten = V.keur();
  assert.deepEqual(fouten, [], fouten.join('\n  '));
});

test('2. de keuring SLAAT UIT op een stil ontbrekend werkwoord en op een grondloze uitzondering', () => {
  /* Zonder deze toets staat toets 1 groen om dezelfde reden als een keuring die
     niets controleert -- en die twee zijn van buiten niet te onderscheiden. */
  const kaal = { x: { wat: 'iets', waar: 'ergens', werkwoorden: {} } };
  assert.ok(V.keur(kaal).some(f => /geen stand verklaard/.test(f)),
    'een ontbrekend werkwoord wordt aangewezen en niet overgeslagen');

  /* Een volledig register bouwen, en daarna ÉÉN werkwoord vervangen. Zo weet je
     zeker dat een gevonden bezwaar over dat ene werkwoord gaat en niet over een
     halve fixture -- de fout die test/vertegenwoordiging eerder maakte, waar de
     fixture zich aan de vorm hield die de code AANNAM. */
  function volledig(verlenen) {
    const ww = {};
    for (const w of V.WERKWOORDEN) ww[w] = { stand: 'voert', waar: 'ergens' };
    ww.aanvaarden.aanvaarding = {};
    for (const q of V.AANVAARDINGSVRAGEN) ww.aanvaarden.aanvaarding[q] = 'x';
    ww.verlenen = verlenen;
    return { x: { wat: 'iets', waar: 'ergens', werkwoorden: ww } };
  }

  assert.equal(V.keur(volledig({ stand: 'voert', waar: 'ergens' })).length, 0,
    'een volledig ingevuld register komt er wél doorheen -- anders keurt de keuring gewoon alles af ' +
    'en bewijzen de drie regels hieronder niets');
  assert.ok(V.keur(volledig({ stand: 'nietVanToepassing' })).some(f => /zonder grond is een vinkje/.test(f)));
  assert.ok(V.keur(volledig({ stand: 'ontbreekt' })).some(f => /zonder `wat` is een klacht/.test(f)));
  assert.ok(V.keur(volledig({ stand: 'voert' })).some(f => /zonder `waar` is niet na te trekken/.test(f)));
  assert.ok(V.keur(volledig({ stand: 'verzonnen' })).some(f => /onbekende stand/.test(f)));
});

test('3. een aanvaarding die `voert` is, beantwoordt alle zeven vragen', () => {
  for (const [naam, m] of Object.entries(V.VERKLARING)) {
    const a = m.werkwoorden.aanvaarden;
    if (a.stand !== 'voert') continue;
    for (const vraag of V.AANVAARDINGSVRAGEN) {
      assert.ok(a.aanvaarding && a.aanvaarding[vraag],
        naam + ' voert aanvaarden maar beantwoordt `' + vraag + '` niet');
    }
    /* In WOORDEN en niet als vinkje. Dit stond eerst als /\w{10,}/ en zakte op
       "beëindigt": `\w` kent de ë niet, dus de toets mat het alfabet in plaats
       van de inhoud. Een lengte-eis doet wat er bedoeld was en struikelt niet
       over Nederlands. */
    assert.ok(a.aanvaarding.bijIntrekking.length >= 30,
      naam + ': wat er bij intrekking met het verleden gebeurt, staat er in woorden en niet als vinkje ' +
      '(nu: "' + a.aanvaarding.bijIntrekking + '")');
  }
});

test('4. verklaring naast meting: elke AFWIJKING is opgeschreven, en geen van beide wint', () => {
  const m = meting();
  const perMech = new Map(m.gemeten.werkwoord.perMechanisme.map(r => [r.mechanisme, r]));
  assert.equal(perMech.size, Object.keys(V.VERKLARING).length,
    'de meter en de verklaring kennen dezelfde mechanismen; loopt dat uiteen, dan gaat de ' +
    'vergelijking hieronder over twee verschillende dingen');

  const onverklaard = [];
  for (const [naam, decl] of Object.entries(V.VERKLARING)) {
    const gemeten = perMech.get(naam);
    assert.ok(gemeten, 'de meter kent ' + naam);
    for (const ww of V.WERKWOORDEN) {
      const v = decl.werkwoorden[ww];
      const zietDeMeter = gemeten.opSynoniem.includes(ww);
      /* De enige afwijking die een verklaring hoort te dragen: de mens zegt
         `voert` waar de meter niets ziet. Andersom (meter ziet iets, mens zegt
         ontbreekt) is geen afwijking maar voorzichtigheid, en die mag stil. */
      if (v.stand === 'voert' && !zietDeMeter && !v.opmerking) {
        onverklaard.push(naam + '.' + ww);
      }
    }
  }
  assert.deepEqual(onverklaard, [],
    'deze staan in de verklaring op `voert` terwijl scripts/namensvorm.js ze niet ziet, zonder ' +
    '`opmerking` die uitlegt waarom de meter ze mist: ' + onverklaard.join(', ') + '. Schrijf de reden ' +
    'op of zet de stand terug -- de meter aanpassen om hem gelijk te krijgen is de verkeerde kant.');
});

test('5. de tegenproef: de meter ziet aantoonbaar MEER dan nul, dus toets 4 is geen holle vergelijking', () => {
  const m = meting();
  const totaal = m.gemeten.werkwoord.perMechanisme.reduce((a, r) => a + r.opSynoniem.length, 0);
  assert.ok(totaal > 0, 'de meting bevat werkwoorden; bij nul zou toets 4 alles als afwijking zien ' +
    'en dus met evenveel gemak groen staan als de verklaring leeg was');
  const vert = m.gemeten.werkwoord.perMechanisme.find(r => r.mechanisme === 'vertegenwoordiging');
  assert.equal(vert.mist.length, 0, 'en kern/vertegenwoordiging voert er nog steeds zeven');
});

test('6. de openstaande posten staan in de volgorde van REPRESENTATIE.md par. 6', () => {
  const open = V.openstaand();
  assert.ok(open.length > 0, 'er staat vandaag werk open; nul zou betekenen dat stap 1 klaar is');
  const eerste = open.filter(o => o.werkwoord === 'versmallen').length;
  assert.ok(eerste > 0, 'versmallen staat open -- REP-03 is de regel waar het voorstel op leunt');
  /* De volgorde is aanvaarden, dan versmallen, dan spoor, dan de rest. */
  const rang = { aanvaarden: 0, versmallen: 1, spoor: 2 };
  const reeks = open.map(o => rang[o.werkwoord] ?? 9);
  assert.deepEqual(reeks, reeks.slice().sort((a, b) => a - b), 'de lijst komt in de juiste volgorde');
});

test('7. de telling wordt NIET tot een cijfer geknepen', () => {
  const t = V.telling();
  assert.equal(t.length, V.WERKWOORDEN.length);
  for (const r of t) {
    assert.equal(typeof r.voert, 'number');
    assert.equal(typeof r.nietVanToepassing, 'number');
    assert.equal(typeof r.ontbreekt, 'number');
    /* `voert` en `nietVanToepassing` zijn allebei "in orde" en betekenen iets
       heel anders. Zou hier een percentage of een score staan, dan verdwijnt
       precies dat verschil (LAT-regel 11). */
    assert.equal(r.score, undefined, 'er komt geen samengesteld cijfer bij');
    assert.equal(r.pct, undefined);
  }
  const aanvaarden = t.find(r => r.werkwoord === 'aanvaarden');
  assert.equal(aanvaarden.ontbreekt, 0,
    'aanvaarden staat nergens meer op `ontbreekt`: waar het niet gevoerd wordt, is dat een verklaarde ' +
    'grond en geen stilte. Dat is wat stap 1 van REPRESENTATIE.md par. 6 vraagt.');
});
