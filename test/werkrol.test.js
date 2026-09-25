/* DE WERKROL: EEN INGANG IN EEN WERELD NAAR EEN KANTOORSCHERM IS NIET VOOR IEDEREEN.

   Op 24 september 2026 vond APPWERKT.json vier ingangen die de wereld aan elk
   lid toonde en die elk lid doorstuurden naar de kantoordeur: Routedossier,
   RTG One, Decision Room en Project Room. Ze hadden één oorzaak: MAPPEN kende
   wel een pas (PREMIUM) maar geen werkrol, terwijl de server al wist wie een
   kantoorsleutel heeft (/api/account/rollen).

     1. Elke ingang in een wereld naar een scherm dat SCHERMEIGENAAR.json aan
        `kantoor` toeschrijft, draagt `werkrol: 'kantoor'`.
     2. De bank past die poort toe: itemZichtbaar vraagt werkrolOk, en de
        sleutelbos komt van /api/account/rollen.
     3. De afgeleide lijsten zeggen voor wie hij is: de sprongindex zet er het
        label "Kantoor" bij, en APPWERKT meet de rij met de kantoorpersona. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const reg = require('../scripts/lib/wereldregister');
const { schermpad } = require('../scripts/lib/bestemming');

const WORTEL = path.join(__dirname, '..');
const SCHERMEN = JSON.parse(fs.readFileSync(path.join(WORTEL, 'SCHERMEIGENAAR.json'), 'utf8')).schermen;

function kantoorIngangen() {
  const uit = [];
  for (const map of reg.MAPPEN) {
    for (const item of map.items) {
      const l = reg.los(item);
      if (l.soort !== 'link' || !l.url) continue;
      const v = SCHERMEN[schermpad(l.url)];
      if (v && v.doelgroep === 'kantoor') uit.push({ wereld: map.naam, item, l });
    }
  }
  return uit;
}

test('1. een ingang naar een kantoorscherm draagt een werkrol', () => {
  const ingangen = kantoorIngangen();
  assert.ok(ingangen.length >= 4, 'de vier ingangen van 24 september staan er nog');
  for (const { wereld, item, l } of ingangen) {
    assert.equal(l.werkrol, 'kantoor', wereld + ' toont ' + item + ' (' + l.url + ') aan iedereen, maar het scherm is voor kantoor');
  }
});

test('2. de bank past de werkrol toe, met de sleutelbos van de server', () => {
  const zicht = fs.readFileSync(path.join(WORTEL, 'public/apps/app-main/app-main-26.js'), 'utf8');
  const lijf = /function itemZichtbaar\(item\) \{([\s\S]*?)\n  \}/.exec(zicht);
  assert.ok(lijf, 'itemZichtbaar niet gevonden');
  assert.match(lijf[1], /werkrolOk\(LINKS\[item\.slice\(5\)\]\)/, 'itemZichtbaar vraagt de werkrol niet');
  const poort = fs.readFileSync(path.join(WORTEL, 'public/apps/app-main/app-main-24a3.js'), 'utf8');
  assert.match(poort, /\/api\/account\/rollen/);
  assert.match(poort, /const werkrolOk = \(def\) => !def \|\| !def\.werkrol \|\| \(!!werkrollen && werkrollen\.has\(def\.werkrol\)\)/,
    'zonder geladen sleutelbos hoort de ingang weg te blijven');
  const bundel = fs.readFileSync(path.join(WORTEL, 'public/apps/app-main.js'), 'utf8');
  assert.ok(bundel.includes('werkrolOk(LINKS[item.slice(5)])'), 'de bundel loopt achter: draai npm run build');
});

test('3. de afgeleide lijsten zeggen voor wie hij is', () => {
  const index = JSON.parse(fs.readFileSync(path.join(WORTEL, 'public/shared/sprongindex.json'), 'utf8')).items;
  for (const { item, l } of kantoorIngangen()) {
    const rij = index.find((r) => r.url === l.url && !r.huis);
    assert.ok(rij, item + ' staat niet in de sprongindex');
    assert.equal(rij.label, 'Kantoor', item + ' draagt geen label Kantoor in de sprongindex');
  }
  const meter = fs.readFileSync(path.join(WORTEL, 'scripts/appwerkt.js'), 'utf8');
  assert.match(meter, /persona: \(bron && bron\.werkrol\) \|\| PERSONA_VAN_WERELD/);
});
