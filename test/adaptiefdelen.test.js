/* HET REGISTER IN DELEN: elk scherm dat register.js laadt, laadt ook wat het
   register nodig heeft, en in de goede volgorde.

   shared/adaptief/register.js stond op 33 bytes van de grens van 10 KB (scripts/
   check.js regel 13). Het deel dat over de VORM van het apparaat gaat (de twee
   mediaqueries, opVorm) is er als zuivere verhuizing uitgehaald naar
   shared/adaptief/vorm.js. Het register leest het bij het laden; zonder vorm
   komt er geen register, net als zonder de leer.

   Dat maakt de volgorde een eis en geen gewoonte: alle scripts laden met
   `defer`, dus in documentvolgorde, en een deel dat NA het register staat is er
   op het moment dat het register draait nog niet. Er staan vijf schermen die het
   register laden (office, app, bestanden, reizen-veilig, reizen), en een scherm
   dat een deel vergeet heeft geen balk en geen context -- zonder foutmelding.

   DE MUTATIE: haal de scripttag van vorm.js weg op reizen-veilig.html. Deze toets
   zakt, en de contextproef van reizen-veilig in test/appmenu.e2e.js ook (de
   context `reizen-veilig.bank` komt nooit aan). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const SCHERMEN = ['office', 'app', 'bestanden', 'reizen-veilig', 'reizen'];
/* De volgorde die het register eist: eerst de leer, dan de delen, dan het register.
   De objectpoort (shared/objectverwijzing.js, stap 20) is zo'n deel: het register
   pakt hem bij het laden, en zonder poort gaat er geen object door. */
const VOLGORDE = ['/shared/adaptief.js', '/shared/objectverwijzing.js', '/shared/adaptief/vorm.js', '/shared/adaptief/register.js'];

function scripts(scherm) {
  const html = fs.readFileSync(path.join(WORTEL, 'public', 'apps', scherm + '.html'), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '');
  return [...html.matchAll(/<script\b[^>]*\bsrc="([^"?]+)/g)].map((m) => m[1]);
}

test('precies deze vijf schermen laden het register', () => {
  const dir = path.join(WORTEL, 'public', 'apps');
  const laden = fs.readdirSync(dir).filter((f) => f.endsWith('.html'))
    .filter((f) => scripts(f.slice(0, -5)).includes('/shared/adaptief/register.js'))
    .map((f) => f.slice(0, -5)).sort();
  assert.deepEqual(laden, SCHERMEN.slice().sort(),
    'een nieuw scherm met het register hoort in deze lijst, zodat zijn volgorde ook bewaakt wordt');
});

for (const scherm of SCHERMEN) {
  test(scherm + '.html laadt de delen van het register, in de goede volgorde', () => {
    const s = scripts(scherm);
    const plek = VOLGORDE.map((src) => s.indexOf(src));
    VOLGORDE.forEach((src, i) => assert.ok(plek[i] >= 0, scherm + '.html laadt ' + src + ' niet'));
    for (let i = 1; i < plek.length; i++) {
      assert.ok(plek[i - 1] < plek[i], scherm + '.html laadt ' + VOLGORDE[i - 1] + ' na ' + VOLGORDE[i]);
    }
  });
}

test('werkruimte.html laadt de objectpoort voor de schil', () => {
  /* De schil (rtg-schil.js, zonder defer) pakt de poort bij het laden; daarna
     laden is voor hem hetzelfde als niet laden. werkruimte-objecten.e2e.js ziet
     dat ook: dan komt er geen sleep door. */
  const s = scripts('werkruimte');
  const p = s.indexOf('/shared/objectverwijzing.js'), schil = s.indexOf('/shared/rtg-schil.js');
  assert.ok(p >= 0 && schil > p, 'werkruimte.html hoort de objectpoort voor rtg-schil.js te laden');
});
