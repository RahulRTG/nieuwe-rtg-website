'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { abonnementsAanbod: prijs, maandCentenVoor } = require('../server/kern/pasprijs');
test('nieuw aanbod houdt consumentenbruto en halve maand jaarkorting exact', () => {
  for (const [pas, maand, jaar] of [['rtg',25000,287500], ['lifestyle',2000000,23000000]]) {
    const p = prijs(pas, {frequentie:'jaar'});
    assert.equal(p.maand.brutoCenten, maand); assert.equal(p.jaar.brutoCenten, jaar);
    assert.equal(p.termijn.nettoCenten + p.termijn.btwCenten, jaar);
    assert.equal(p.minimumMaanden,12); assert.equal(p.herstelDagen,31);
  }
});
test('zakelijk rekent netto; een bodem wordt nooit een overeengekomen prijs', () => {
  assert.equal(prijs('business-lite').maand.nettoCenten,40000);
  assert.equal(prijs('business-lite',{frequentie:'jaar'}).termijn.brutoCenten,556600);
  assert.equal(prijs('business').status,409);
  assert.equal(prijs('business',{aanmelding:{contract:{maandCenten:649999}}}).status,409);
  assert.equal(prijs('business',{frequentie:'jaar',aanmelding:{contract:{maandCenten:700000}}}).jaar.nettoCenten,8050000);
});
test('historische prijsbron blijft intact; ongeldige keuze en btw worden geweigerd', () => {
  assert.equal(maandCentenVoor(null,'rtg'),6500);
  assert.equal(prijs('rtg',{btwProfiel:'onbekend'}).status,409);
  assert.equal(prijs('rtg',{frequentie:'week'}).status,400);
  assert.equal(prijs('gratis').maand.brutoCenten,0);
});
