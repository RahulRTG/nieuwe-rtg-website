/* De MRZ-lezer (de twee <<<-regels onderaan een paspoort): pure ontleding +
   ICAO-controlecijfers (7-3-1). We toetsen met het officiele ICAO-voorbeeld
   ("ANNA MARIA ERIKSSON") en met opzettelijk foute controlecijfers, zodat
   verkeerd gelezen scans niet stilletjes in het profiel belanden.
   Draai: node --test test/mrz.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const MRZ = require('../public/shared/mrz.js');

// ICAO Doc 9303 voorbeeld-TD3 (specimen), 2 regels van 44
const R1 = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<';
const R2 = 'L898902C36UTO7408122F1204159ZE184226B<<<<<10';

test('1. het ICAO-voorbeeld wordt correct ontleed en alle controlecijfers kloppen', () => {
  const p = MRZ.parse(R1, R2);
  assert.equal(p.ok, true, 'de zone is geldig');
  assert.equal(p.checks.nummer, true);
  assert.equal(p.checks.geboorte, true);
  assert.equal(p.checks.verval, true);
  assert.equal(p.checks.totaal, true);
  assert.equal(p.velden.naam, 'ANNA MARIA ERIKSSON');
  assert.equal(p.velden.achternaam, 'ERIKSSON');
  assert.equal(p.velden.voornamen, 'ANNA MARIA');
  assert.equal(p.velden.nummer, 'L898902C3');
  assert.equal(p.velden.land, 'UTO');
  assert.equal(p.velden.geboortedatum, '1974-08-12');
  assert.equal(p.velden.vervaldatum, '2012-04-15');
  assert.equal(p.velden.geslacht, 'F');
});

test('2. een fout controlecijfer op de geboortedatum maakt de zone ongeldig', () => {
  // het controlecijfer van de geboortedatum staat op positie 19 (hier "2" -> "3")
  const stuk = R2.slice(0, 19) + '3' + R2.slice(20);
  const p = MRZ.parse(R1, stuk);
  assert.equal(p.checks.geboorte, false, 'de geboortecontrole faalt');
  assert.equal(p.ok, false, 'en dan vertrouwen we de scan niet');
});

test('3. een Nederlands nationaliteitsveld wordt naar het label vertaald', () => {
  const r2nl = R2.slice(0, 10) + 'NLD' + R2.slice(13);
  const p = MRZ.parse(R1, r2nl);
  assert.equal(p.velden.nationaliteit, 'Nederlandse');
});

test('4. te korte of lege invoer geeft netjes ok:false terug (geen crash)', () => {
  assert.equal(MRZ.parse('', '').ok, false);
  assert.equal(MRZ.parse('P<UTO', 'L898').ok, false);
  assert.equal(MRZ.parse(null, undefined).ok, false);
});

test('5. de losse controle-functie rekent het ICAO-voorbeeld goed uit', () => {
  // ICAO Doc 9303 rekenvoorbeeld: "520727" -> controlecijfer 3
  assert.equal(MRZ.controle('520727'), 3);
});
