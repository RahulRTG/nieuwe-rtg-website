/* DE RUIMTESCHAAL (ONTWERP.md 2b, TAKEN.md 4.51).

   Zeventien willekeurige margestappen zijn er vijf geworden, en drie daarvan
   stonden al in ONTWERP.md als de basisruimte van World, Pro en Command. Deze
   toets gaat over het OORDEEL -- welke waarde wordt welke stap, en vooral: wat
   blijft met rust.

   WAT HIER HET ZWAARST WEEGT: de uitzonderingen. Een omzetter die te veel pakt
   verschuift opmaak op plekken die niemand in de gaten heeft, en dat is precies
   het soort schade waar geen enkele toets in dit huis op zakt. `0`, `auto`,
   negatieve marges, alles boven 2rem, px/%/calc en alles buiten een
   style-attribuut horen onaangeroerd te blijven -- niet omdat het niet kan, maar
   omdat het daar geen ruis is.

   Draai los: node --test test/margeschaal.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { opSchaal, zetOm, ernaast, SCHAAL } = require('../scripts/margeschaal');

const stijl = (s) => {
  const r = zetOm('<div style="' + s + '"></div>');
  return /style="([^"]*)"/.exec(r.uit)[1];
};

test('de schaal is die uit ONTWERP.md, en niet een die hier is bedacht', () => {
  /* Drie van de vijf zijn de basisruimtes uit de modi-tabel: Command 8px,
     Pro 12px, World 20px. Zou iemand die hier veranderen zonder ONTWERP.md aan
     te raken, dan zijn er twee ruimtetalen. */
  assert.deepEqual(SCHAAL, [0.25, 0.5, 0.75, 1.25, 2]);
  const px = SCHAAL.map((r) => r * 16);
  for (const basis of [8, 12, 20]) assert.ok(px.includes(basis), basis + 'px hoort een stap te zijn');
});

test('naar de dichtstbijzijnde stap', () => {
  assert.equal(opSchaal(0.2), 0.25);
  assert.equal(opSchaal(0.3), 0.25);
  assert.equal(opSchaal(0.35), 0.25);
  assert.equal(opSchaal(0.4), 0.5);
  assert.equal(opSchaal(0.55), 0.5);
  assert.equal(opSchaal(0.6), 0.5);
  assert.equal(opSchaal(0.7), 0.75);
  assert.equal(opSchaal(0.9), 0.75);
  assert.equal(opSchaal(1.5), 1.25);
  assert.equal(opSchaal(1.8), 2);
});

test('BIJ GELIJKE AFSTAND DE RUIMERE -- dat is CLAUDE.md en geen willekeur', () => {
  /* 1rem ligt precies tussen 0.75 en 1.25. "Bij twijfel meer ruimte" staat in
     de merkregels; zonder die regel zou de keuze per implementatie verschillen
     en dan is de schaal niet reproduceerbaar. */
  assert.equal(opSchaal(1), 1.25);
  assert.equal(opSchaal(0.375), 0.5);
  assert.equal(opSchaal(1.625), 2);
});

test('de schrijfwijze wordt ook gelijkgetrokken', () => {
  /* `.5rem` en `0.5rem` zijn dezelfde waarde, twee keer geschreven -- samen 314
     keer. Zolang dat verschil bestaat, heeft elke stap twee hulpklassen nodig. */
  assert.equal(stijl('margin-top:.5rem'), 'margin-top:0.5rem');
  assert.equal(stijl('margin:.25rem .75rem'), 'margin:0.25rem 0.75rem');
});

test('DE UITZONDERINGEN blijven letterlijk staan', () => {
  for (const s of ['margin:0', 'margin:0 auto', 'margin-top:3rem', 'margin-top:-0.5rem',
    'margin-left:12px', 'margin-top:5%', 'margin-top:calc(1rem + 2px)', 'margin-block:0.4rem']) {
    assert.equal(stijl(s), s, s + ' hoort onaangeroerd te blijven');
  }
});

test('een korthand wordt stuk voor stuk gewogen', () => {
  assert.equal(stijl('margin:0.4rem 1rem'), 'margin:0.5rem 1.25rem');
  assert.equal(stijl('margin:0 0.6rem 0 auto'), 'margin:0 0.5rem 0 auto');
});

test('andere eigenschappen in hetzelfde attribuut blijven met rust', () => {
  /* Alleen de marge verschuift; de rest van de declaraties gaat er ongewijzigd
     doorheen, inclusief hun schrijfwijze en volgorde. */
  assert.equal(stijl('font-size:.8rem;margin-top:.6rem;color:#fff'),
    'font-size:.8rem;margin-top:0.5rem;color:#fff');
  assert.equal(stijl('padding:.4rem;gap:.35rem'), 'padding:.4rem;gap:.35rem',
    'padding en gap zijn geen marge en horen niet mee te schuiven');
});

test('het enkele quote blijft een enkel quote', () => {
  /* Deze markup staat vaak in JS-strings met dubbele quotes eromheen. Een
     attribuut dat van ' naar " gaat, breekt de string eromheen -- en dat is
     geen opmaakfout maar een pagina die niet meer laadt. */
  const r = zetOm("el.innerHTML = '<b style=\"margin-top:.6rem\">x</b>';");
  assert.match(r.uit, /style="margin-top:0\.5rem"/);
  const r2 = zetOm('el.innerHTML = "<b style=\'margin-top:.6rem\'>x</b>";');
  assert.match(r2.uit, /style='margin-top:0\.5rem'/, 'en andersom net zo goed');
});

test('DE POORT: ernaast() vindt precies wat de omzetting zou veranderen', () => {
  /* Twee zeven die hetzelfde moeten vinden lopen uiteen (LAT.md regel 4), dus
     de keuring en de omzetter delen deze functie. Wat de een meldt, zet de
     ander om -- en na een omzetting meldt de keuring niets meer. */
  const bron = '<div style="margin-top:0.62rem"></div><p style="margin:0.5rem"></p>';
  assert.deepEqual(ernaast(bron), ['margin-top:0.62rem']);
  assert.deepEqual(ernaast(zetOm(bron).uit), [], 'na de omzetting is er niets meer te melden');
});

test('een omzetting is stabiel: nog een keer draaien verandert niets', () => {
  const bron = '<div style="margin-top:.62rem;margin-bottom:1rem"></div>';
  const een = zetOm(bron).uit;
  assert.equal(zetOm(een).uit, een, 'de tweede ronde is een no-op');
});
