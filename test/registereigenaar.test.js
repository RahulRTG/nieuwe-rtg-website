/* ============================================================================
   WIE BEZIT DIT REGISTER? -- de wachter die op 13 september 2026 ontbrak.

   Er kwam een meter bij die zijn uitslag naar BEREIK.json schreef. Dat bestand
   bestond al en is het schermbereik-register, met een schuldlijst die alleen mag
   krimpen. Het werd stil overschreven: de nieuwe inhoud was geldige JSON, alleen
   over iets anders. Geen enkele wachter vroeg wie de schrijver was.

   DEZE TOETS VANGT DRIE DINGEN:

     1. een script schrijft naar een register dat iemand ANDERS bezit
     2. twee scripts schrijven naar hetzelfde register zonder dat dat verklaard is
     3. een verklaarde eigenaar bestaat niet, of een handmatig register heeft
        geen lezer (dan is het geen register maar een bestand)

   De vierde stand is ONBEKEND: een wortelregister zonder verklaarde eigenaar.
   Dat is een open post en geen fout -- het getal hoort te dalen doordat er
   eigenaren bijkomen, en toets 4 houdt die vloer vast.

   Draai los: node --test test/registereigenaar.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const { EIGENAAR, ONVERKLAARDE_BOTSING, detecteer, wortelregisters } = require('../scripts/lib/registereigenaar.js');

/* MUTATIE GEZIEN ZAKKEN: in scripts/gelding.js het DOEL terug op BEREIK.json
   gezet -- precies de fout van 13 september; toets 1 zakte met beide namen erbij. */
test('1. geen script schrijft naar een register dat een ander bezit', () => {
  const gemeten = detecteer();
  const fout = [];
  for (const [register, schrijvers] of gemeten) {
    const e = EIGENAAR[register];
    if (!e) continue;                       // onbekend: toets 4 telt hem
    for (const s of schrijvers) {
      if (e.handmatig) {
        fout.push(s + ' schrijft naar ' + register + ', dat met de hand wordt onderhouden (' +
          (e.lezer || 'geen lezer opgegeven') + ')');
      } else if (e.schrijver !== s && !e.waarom) {
        fout.push(s + ' schrijft naar ' + register + ', dat van ' + e.schrijver + ' is');
      }
    }
  }
  assert.deepEqual(fout, [],
    'hier schrijft een script naar andermans register. Dat is de fout van 13 september: het bestand blijft ' +
    'geldige JSON en niets klaagt, alleen gaat het over iets anders. ' + fout.join(' ; '));
});

/* MUTATIE GEZIEN ZAKKEN: bij GRENZEN.json de `waarom` weggehaald; zakte, want
   dan is de tweede schrijver een onverklaarde botsing. */
test('2. twee schrijvers op een register vragen een verklaring', () => {
  const gemeten = detecteer();
  const onverklaard = [];
  for (const [register, schrijvers] of gemeten) {
    if (schrijvers.size < 2) continue;
    const e = EIGENAAR[register];
    if (e && String(e.waarom || '').length > 20) continue;
    /* Bekend en nog niet uitgezocht: staat in ONVERKLAARDE_BOTSING met een vloer
       in toets 4. Een reden verzinnen zou erger zijn dan hem open laten staan. */
    if (ONVERKLAARDE_BOTSING[register]) continue;
    onverklaard.push(register + ' (' + [...schrijvers].join(', ') + ')');
  }
  assert.deepEqual(onverklaard, [],
    'deze registers worden door meer dan een script geschreven zonder dat iemand heeft opgeschreven waarom. ' +
    'Twee schrijvers op een bestand lopen een keer uiteen: ' + onverklaard.join(' ; '));
});

/* MUTATIE GEZIEN ZAKKEN: bij BEREIK.json de `lezer` weggehaald; zakte. */
test('3. een verklaarde eigenaar bestaat, en een handmatig register heeft een lezer', () => {
  for (const [register, e] of Object.entries(EIGENAAR)) {
    assert.ok(fs.existsSync(path.join(WORTEL, register)),
      'het register ' + register + ' heeft een verklaarde eigenaar maar bestaat niet');

    if (e.handmatig) {
      assert.ok(e.lezer && fs.existsSync(path.join(WORTEL, e.lezer)),
        register + ' wordt met de hand onderhouden zonder bestaande lezer; een register dat niemand leest ' +
        'is geen register maar een bestand');
      assert.ok(String(e.waarom || '').length > 20,
        register + ' staat als handmatig zonder reden; dan weet niemand waarom er geen meter is');
    } else {
      assert.ok(e.schrijver && fs.existsSync(path.join(WORTEL, e.schrijver)),
        register + ' noemt schrijver ' + e.schrijver + ', en die bestaat niet');
    }
  }
});

/* MUTATIE GEZIEN ZAKKEN: BEREIK.json uit EIGENAAR gehaald; het aantal onbekende
   steeg naar 128 en toets 4 zakte.

   DE VLOER IS OP 14 SEPTEMBER MET DE HAND VAN 127 NAAR 141 GEZET, en dat hoort
   hier uitgeschreven te staan in plaats van stil te gebeuren -- een ratel die
   je ongemerkt optrekt, is geen ratel. De merge van bundel-PR #253 (elf PR's
   ineens) bracht veertien nieuwe wortelregisters mee, geen daarvan met een
   verklaarde eigenaar. Dat is schuld van de bundel en niet van deze tak, maar
   hij staat nu wel hier.

   WAT HEM OMLAAG BRENGT, EN WAT MET OPZET NIET IS GEDAAN. `detecteer()` vindt
   voor 79 van de 141 een schrijver, dus de verleiding is om EIGENAAR daaruit te
   vullen en de vloer in een keer naar 62 te duwen. Dat is precies de fout die
   deze hele tak meet: EIGENAAR is een VERKLARING en detecteer() de METING die
   hem controleert. Wie de een uit de ander genereert, laat toets 1 vergelijken
   met zichzelf -- dan is de uitslag per definitie goed en zegt hij niets
   (dezelfde vorm als de sensor die `w.handhaver` teruggaf in
   test/verband.test.js). Eigenaren erbij zetten is mensenwerk, een paar per
   keer, met iemand die kijkt of het klopt. */
/* 141 -> 146 OP 14 SEPTEMBER 2026, EN DE REDEN IS NIET "ER KWAMEN ER VIJF BIJ".
   Deze wachter is zelf nieuw: scripts/lib/registereigenaar.js bestaat niet op
   main en kwam met de tak die hem bouwde. Zijn vloer van 141 is daarom gemeten
   op EEN TAK, en die tak liep achter op main -- dertien wortelregisters die main
   allang had (AANVOERVORM, ADAMPROEF, CRASHAS, CRASHPROEF, DOELGROEPBEREIK,
   GEVOLGDEKKING, MACHINEDEKKING, MOMENTPROEF, OMZETPROEF, ONDERNEMERBEWIJS,
   STAGEVORM, WEKDEKKING, ZAAKLIVEPROEF) stonden er niet in, en drie zijn echt
   nieuw uit andere takken van deze bundel (MELDBESLUIT, REFUNDMIGRATIE,
   SCHRIJFPROEF).

   DAT IS DE LES EN NIET HET GETAL: een vloer die op een tak wordt vastgelegd,
   meet de wereld van die tak. Hij leest daarna als een belofte over het huis
   terwijl hij een momentopname van een werkbank was -- dezelfde vorm als een
   register met een stempel van een andere commit. 146 is de eerste meting op een
   boom waar alle elf takken en main samen in staan.

   De weg omlaag blijft wat hierboven staat: eigenaren erbij zetten is mensenwerk,
   een paar per keer, en NOOIT gevuld uit detecteer(). */
test('4. het aantal registers zonder verklaarde eigenaar mag dalen en niet stijgen', () => {
  const onbekend = wortelregisters().filter(r => !EIGENAAR[r]);
  assert.ok(onbekend.length <= 146,
    'er zijn ' + onbekend.length + ' wortelregisters zonder verklaarde eigenaar, en de vloer staat op 146 ' +
    '(127 op 13 september 2026, 141 na de bundel van elf PR\'s, 146 na de tweede bundel -- zie de ' +
    'toelichting hierboven: de vloer van 141 was op een achterlopende tak gemeten). Het getal hoort te ' +
    'dalen doordat er eigenaren bijkomen, niet te stijgen doordat er registers bijkomen zonder dat iemand ' +
    'zegt wie ze bezit.');

  /* En de detectie moet werken: vindt zij niets, dan staat toets 1 groen omdat
     er niets te vergelijken viel (LAT.md regel 3). */
  /* De onverklaarde botsingen mogen dalen en niet stijgen, om dezelfde reden. */
  assert.ok(Object.keys(ONVERKLAARDE_BOTSING).length <= 2,
    'er zijn ' + Object.keys(ONVERKLAARDE_BOTSING).length + ' onverklaarde botsingen, en dat waren er 2. ' +
    'Twee schrijvers op een bestand lopen een keer uiteen; verklaar hem of maak er een eigenaar van');
  for (const [r, t] of Object.entries(ONVERKLAARDE_BOTSING)) {
    assert.ok(String(t).length > 25, r + ' staat als botsing zonder te zeggen wie er botsen');
  }

  const gemeten = detecteer();
  assert.ok(gemeten.size >= 10,
    'de schrijverdetectie vindt bijna niets; dan zegt het groen van toets 1 en 2 niets over dit huis');
});
