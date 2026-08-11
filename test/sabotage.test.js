/* DE SABOTAGEMOTOR MAG NOOIT ROMMEL ACHTERLATEN, EN MOET DE GATEN ZIEN.

   Dit gereedschap doet iets wat geen enkel ander script in dit huis doet: het
   SCHRIJFT IN DE BRON. Het zet de handhaver van een wet uit, draait een toets en
   zet alles terug. Daarmee is de gevaarlijkste fout niet een verkeerd oordeel
   maar een gesaboteerd bestand dat blijft staan -- dat zou stilletjes de
   beveiliging uitzetten van precies de wet die hij zou bewijzen.

   Daarom gaat de eerste helft van deze toets over HERSTEL, byte voor byte, in
   alle vier de uitgangen: de toets zakt, de toets blijft groen, de sabotage past
   niet meer, en de toetsloper gooit een fout.

   De tweede helft gaat over het oordeel. De motor moet OVERLEEFD melden als de
   handhaver uit kon zonder dat er iets rood werd -- dat is het gat waar dit
   gereedschap voor bestaat, en het is precies de stand die hij bij RTG-023 vond
   (vijf van de zes spel-toetsen injecteren hun eigen progressieMag en raken de
   echte 18+-grens dus nooit).

   Gemuteerd en zien zakken: de `finally` die het bestand terugzet weghalen
   (toets 1, 2 en 4 rood), de telling van `van` op !== 1 omkeren (toets 3 rood),
   en OVERLEEFD als BEWEZEN laten teruggeven (toets 5 rood).
   Draai los: node --test test/sabotage.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { saboteer } = require('../scripts/sabotage.js');

const WORTEL = path.join(__dirname, '..');
/* We saboteren een ECHT bestand in de boom, want dat is wat de motor doet -- een
   tijdelijk bestand buiten de wortel zou een andere code laten lopen. Het bestand
   is met opzet iets onschuldigs dat we zelf neerzetten en weer weghalen. */
const PROEFPAD = 'test/zz-sabotage-proef.txt';
const INHOUD = 'regel een\nDE HANDHAVER STAAT AAN\nregel drie\n';

function metProefbestand(doe) {
  const vol = path.join(WORTEL, PROEFPAD);
  assert.equal(fs.existsSync(vol), false, 'de proef overschrijft nooit een bestaand bestand');
  fs.writeFileSync(vol, INHOUD);
  try { return doe(vol); } finally { try { fs.unlinkSync(vol); } catch (e) {} }
}

const wet = (extra) => ({ id: 'RTG-000', wet: 'proefwet', sabotageProef: Object.assign({
  bestand: PROEFPAD, van: 'DE HANDHAVER STAAT AAN', naar: 'DE HANDHAVER STAAT UIT', toets: ['nep.test.js']
}, extra || {}) });

test('na een geslaagde sabotage staat het bestand byte voor byte terug', () => {
  metProefbestand((vol) => {
    const u = saboteer(wet(), () => true); // de toets zakt: precies wat we willen
    assert.equal(u.stand, 'BEWEZEN');
    assert.equal(fs.readFileSync(vol, 'utf8'), INHOUD, 'het bestand moet exact terug zijn');
  });
});

test('ook als de toets GROEN blijft, staat het bestand terug', () => {
  metProefbestand((vol) => {
    const u = saboteer(wet(), () => false);
    assert.equal(u.stand, 'OVERLEEFD');
    assert.equal(fs.readFileSync(vol, 'utf8'), INHOUD, 'herstel hangt niet af van de uitslag');
  });
});

test('een sabotage die niet meer past heet STUK en raakt het bestand niet aan', () => {
  metProefbestand((vol) => {
    const weg = saboteer(wet({ van: 'DEZE TEKST STAAT ER NIET' }), () => true);
    assert.equal(weg.stand, 'STUK', 'nul treffers: de sabotage is verlopen en bewijst niets');
    assert.match(weg.uitleg, /0x voor/);
    assert.equal(fs.readFileSync(vol, 'utf8'), INHOUD);

    const dubbel = saboteer(wet({ van: 'regel' }), () => true);
    assert.equal(dubbel.stand, 'STUK', 'twee treffers is dubbelzinnig; dan weten we niet wat we uitzetten');
    assert.equal(fs.readFileSync(vol, 'utf8'), INHOUD);
  });
});

test('gooit de toetsloper een fout, dan staat het bestand alsnog terug', () => {
  metProefbestand((vol) => {
    assert.throws(() => saboteer(wet(), () => { throw new Error('loper stuk'); }), /loper stuk/);
    assert.equal(fs.readFileSync(vol, 'utf8'), INHOUD,
      'juist bij een onverwachte fout mag er geen gesaboteerd bestand blijven staan');
  });
});

test('OVERLEEFD is een eigen stand en wordt nooit als bewijs geteld', () => {
  metProefbestand(() => {
    const u = saboteer(wet(), () => false);
    assert.equal(u.stand, 'OVERLEEFD');
    assert.notEqual(u.stand, 'BEWEZEN', 'een handhaver die uit kan zonder rood, bewijst niets');
    assert.match(u.uitleg, /gat/, 'en de uitleg noemt het bij naam');
  });
});

test('een wet zonder uitvoerbare sabotage heet GEEN, niet BEWEZEN', () => {
  const u = saboteer({ id: 'RTG-000', wet: 'x' }, () => true);
  assert.equal(u.stand, 'GEEN', 'geen sabotage opgegeven is werkvoorraad, geen bewijs');
});
