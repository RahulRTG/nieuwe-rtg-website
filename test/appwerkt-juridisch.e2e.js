'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { meet, rijen } = require('../scripts/appwerkt');
const root = path.join(__dirname, '..');

/* De bestaande runner en echte lokale RTG-routes, afzonderlijk van de
   synthetische adaptertegenproeven. Alleen documentnavigatie: geen nieuwe
   klikscanner, geen juridische inhoudsbeoordeling of 8/8-afleiding. De
   bestaande voltooiproef bewaakt daarnaast toetsenbord, geschiedenis,
   publicatiecontinuïteit en serverherstel. */
test('APPWERKT: Juridisch bedient drie echte documenten en de terugweg als links', { timeout: 600000 }, async t => {
  const registers = ['APPWERKT.json', 'APPWERKT-RAAKVLAK.json'];
  const voor = registers.map(file => fs.readFileSync(path.join(root, file)));
  t.after(() => registers.forEach((file, i) => assert.deepEqual(fs.readFileSync(path.join(root, file)), voor[i],
    file + ' mag niet worden herschreven door een geselecteerde ontwikkelproef')));

  const selectie = rijen().filter(row => row.functie === 'link:juridisch');
  assert.equal(selectie.length, 1);
  assert.equal(selectie[0].pad, '/apps/juridisch.html');
  const gemeten = await meet(selectie);
  assert.equal(gemeten.regels.length, 1);
  const rij = gemeten.regels[0];
  t.diagnostic(JSON.stringify({ functie: rij.functie, gevonden: rij.gevonden, geklikt: rij.geklikt,
    bereikbaar: rij.bewijzen.bereikbaar, bedienbaar: rij.bewijzen.bedienbaar,
    navigatie: rij.navigatie, waarnemingen: rij.waarnemingen }));
  assert.equal(rij.bewijzen.bereikbaar.status, 'BEWEZEN', rij.bewijzen.bereikbaar.reden);
  assert.equal(rij.bewijzen.bedienbaar.status, 'BEWEZEN', rij.bewijzen.bedienbaar.reden);
  assert.equal(rij.gevonden, 0, 'gedeelde schilknoppen zijn geen eigen documentbediening');
  assert.equal(rij.geklikt, 0, 'linkbewijs wordt niet als knopbewijs geteld');
  assert.deepEqual(rij.onaangeraakt, []);
  assert.deepEqual(rij.nietKlikbaar, []);
  assert.deepEqual(rij.overgeslagen, []);

  const nav = rij.navigatie;
  assert.ok(nav, 'de echte route moet de expliciete linkadapter gebruiken');
  assert.deepEqual(nav.onbewezen, [], 'geen ontbrekende, ongeoorloofde of onbesliste bestemming');
  assert.deepEqual(nav.fouten, [], 'geen document-, script- of serverfout tijdens linkbediening');
  assert.equal(nav.gevonden, 4);
  assert.equal(nav.geklikt, 4);
  assert.equal(nav.aangeraakt.length, 4);
  assert.equal(new Set(nav.aangeraakt.map(link => link.merk)).size, 4);
  const verwacht = new Map([
    ['/apps/app.html', 'RTG Pass'],
    ['/apps/juridisch/voorwaarden.html', 'Algemene voorwaarden, Rahul Travel Group'],
    ['/apps/juridisch/privacy.html', 'Privacybeleid, Rahul Travel Group'],
    ['/apps/juridisch/partnervoorwaarden.html', 'Partnervoorwaarden, Rahul Travel Group']
  ]);
  const gezien = new Set();
  for (const link of nav.aangeraakt) {
    assert.match(link.bestemming, /^\/apps\//, 'geen externe bestemming als geslaagde link');
    const doel = new URL(link.bestemming, 'http://rtg.invalid');
    assert.ok(verwacht.has(doel.pathname), 'uitsluitend de drie publicaties en de terugweg');
    if (doel.pathname !== '/apps/app.html') assert.equal(doel.search + doel.hash, '', 'de openbare publicatie blijft op haar exacte adres');
    assert.equal(gezien.has(doel.pathname), false, 'iedere bestemming afzonderlijk geraakt');
    gezien.add(doel.pathname);
    assert.equal(link.status, 200);
    assert.equal(link.titel, verwacht.get(doel.pathname));
    assert.ok(link.naam.trim(), 'de aangeklikte link heeft een leesbare naam');
  }
  assert.deepEqual([...gezien].sort(), [...verwacht.keys()].sort());
});
