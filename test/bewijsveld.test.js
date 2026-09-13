/* ============================================================================
   LAT.md REGEL 14 -- een bewijsveld draagt een bewijsrelatie.

   De regel bijt waar een veldnaam binnen dezelfde bewijsvraag twee verschillende
   RELATIES draagt. Dat is technisch correct en semantisch onjuist, en het is de
   vorm die geen enkele toets ziet: het type klopt, de waarde klopt, de optelling
   klopt -- alleen de vraag die beantwoord wordt is een andere dan de gestelde.

   Deze toets vangt vier dingen:

     1. een register dat een gesplitst veld gebruikt zonder dat te verklaren
     2. een verklaring die verder reikt dan de meting (een genoemd register dat
        het veld helemaal niet draagt)
     3. een splitsing zonder reden, of met minder dan twee relaties
     4. een relatie zonder plek waar hij gemeten wordt

   Draai los: node --test test/bewijsveld.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const { GESPLITST, ENKELVOUDIG, GEBRUIKERS } = require('../scripts/lib/bewijsvelden.js');

/* Welke registers dragen dit veld werkelijk? Uit de bestanden zelf, want een
   lijst die met de hand wordt bijgehouden groeit mee met wat iemand vergat. */
function registersMet(veld) {
  const uit = [];
  for (const f of fs.readdirSync(WORTEL)) {
    if (!f.endsWith('.json') || f.startsWith('package')) continue;
    let j;
    try { j = JSON.parse(fs.readFileSync(path.join(WORTEL, f), 'utf8')); } catch (e) { continue; }
    let raak = false;
    (function loop(o, diep) {
      if (raak || !o || typeof o !== 'object' || diep > 4) return;
      for (const [k, v] of Object.entries(o)) {
        if (k === veld) { raak = true; return; }
        if (v && typeof v === 'object') loop(v, diep + 1);
      }
    })(j, 0);
    if (raak) uit.push(f);
  }
  return uit;
}

/* MUTATIE GEZIEN ZAKKEN: MAGNAATLAB.json uit GEBRUIKERS.bereik gehaald; zakte
   met de naam erbij. */
test('1. elk register dat een gesplitst veld draagt, is verklaard', () => {
  for (const veld of Object.keys(GESPLITST)) {
    const echt = registersMet(veld);
    /* Een gesplitst veld dat NERGENS meer voorkomt is geen dode regel als de
       BRON is gesplitst: dan is de migratie af en bewaakt deze regel dat hij
       niet terugkomt (test/wetrelatie.test.js toets 1). Staat `bronGesplitst`
       op false en komt het veld nergens voor, dan bewaakt hij wel iets wat niet
       bestaat, en dat blijft rood. */
    if (!echt.length) {
      assert.equal(GESPLITST[veld].bronGesplitst, true,
        'het veld "' + veld + '" staat als gesplitst maar komt in geen enkel bestand voor, terwijl de bron ' +
        'niet is gesplitst; dan bewaakt deze regel iets wat niet meer bestaat');
      continue;
    }

    const verklaard = GEBRUIKERS[veld] || [];
    const onverklaard = echt.filter(f => !verklaard.includes(f));
    assert.deepEqual(onverklaard, [],
      'deze registers dragen het veld "' + veld + '" zonder te zeggen welke relatie zij bedoelen. Dat veld ' +
      'draagt er meerdere, en wie ze optelt telt appels bij peren. LAT.md regel 14: ' + onverklaard.join(', '));
  }
});

/* MUTATIE GEZIEN ZAKKEN: 'CODEWERELD.json' aan GEBRUIKERS.bereik toegevoegd;
   zakte. Dit is de andere kant, en hij is een keer echt misgegaan: de eerste
   versie van de lijst noemde twee registers omdat hun NAAM ernaar klinkt. */
test('2. geen verklaring die verder reikt dan de meting', () => {
  for (const [veld, verklaard] of Object.entries(GEBRUIKERS)) {
    const echt = registersMet(veld);
    const spook = verklaard.filter(f => !echt.includes(f));
    assert.deepEqual(spook, [],
      'deze registers staan verklaard voor "' + veld + '" maar dragen het veld niet: ' + spook.join(', ') +
      '. Een verklaring die verder reikt dan de meting is precies zo fout als een meting zonder verklaring.');
  }
});

/* MUTATIE GEZIEN ZAKKEN: bij `bereik` het veld `waarom` weggehaald; zakte. */
test('3. een splitsing draagt een reden en minstens twee relaties', () => {
  for (const [veld, g] of Object.entries(GESPLITST)) {
    assert.ok(String(g.waarom || '').trim().length > 40,
      'de splitsing van "' + veld + '" heeft geen uitgeschreven reden; dan is het een indeling en geen besluit');
    const relaties = Object.keys(g.relaties || {});
    assert.ok(relaties.length >= 2,
      '"' + veld + '" staat als gesplitst met ' + relaties.length + ' relatie(s); een veld met een relatie ' +
      'is niet gesplitst en hoort bij ENKELVOUDIG');
    assert.equal(typeof g.bronGesplitst, 'boolean',
      '"' + veld + '" zegt niet of de BRON gesplitst is of alleen de lezing; dat verschil bepaalt of hier ' +
      'een besluit openstaat');
  }
});

/* MUTATIE GEZIEN ZAKKEN: bij de relatie CLAIM de `waar` weggehaald; zakte. */
test('4. elke relatie noemt waar zij gemeten wordt, en die plek bestaat', () => {
  for (const [veld, g] of Object.entries(GESPLITST)) {
    for (const [naam, r] of Object.entries(g.relaties || {})) {
      assert.ok(String(r.waar || '').length > 3,
        veld + '.' + naam + ' zegt niet waar hij gemeten wordt; dan is de splitsing een bewering op papier');
      assert.ok(String(r.uitleg || '').length > 15,
        veld + '.' + naam + ' draagt geen uitleg, en dan lopen twee relaties binnen een jaar weer samen');

      const bestand = String(r.waar).split(':')[0];
      if (bestand.endsWith('.json')) {
        assert.ok(fs.existsSync(path.join(WORTEL, bestand)),
          veld + '.' + naam + ' wordt gemeten in ' + bestand + ', en dat register bestaat niet');
      }
    }
  }

  for (const [veld, e] of Object.entries(ENKELVOUDIG)) {
    assert.ok(String(e.uitleg || '').length > 15,
      'het veld "' + veld + '" staat als enkelvoudig zonder uitleg; dan weet niemand welke relatie het draagt');
  }
});
