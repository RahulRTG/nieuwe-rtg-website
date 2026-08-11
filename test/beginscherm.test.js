/* HET BEGINSCHERM DRAAGT DE ACHT WERELDEN EN VERDER GEEN LOSSE APPS.

   Dat is de afspraak van PLATFORM.md par. 0, en hij slijt precies op een
   manier: er komt "even" een app-tegel bij omdat iemand hem vaak nodig heeft,
   en een halfjaar later staat er weer een rij naast de werelden.

   WAAROM DEZE TOETS HIER STAAT EN NIET IN test/comm.e2e.js. Daar stond de
   bewaking eerst -- hij las de tegels uit de DOM van het beginscherm. Die
   bewering kon niet zakken: de schermtoets draait alleen met een browser, en
   zonder browser wordt hij overgeslagen. Ik heb dat pas gezien door er met een
   mutatie een app-tegel in terug te zetten en de toets nog steeds groen te
   zien. Ook de OUDE bewering daar (Bellen staat niet meer in de rij) was
   daarmee al jaren decoratie.

   Dus staat hij nu waar hij wel telt: op de bron. De gebouwde bundel is de
   waarheid die de browser krijgt, en die is zonder browser te lezen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const lees = (...d) => fs.readFileSync(path.join(__dirname, '..', ...d), 'utf8');

test('het beginscherm draagt geen losse app-tegels naast de acht werelden', () => {
  const bundel = lees('public', 'apps', 'app-main.js');
  assert.match(bundel, /const FUNCTIES = \[\s*\]/,
    'de functierij onder de klok is weer gevuld; het beginscherm hoort alleen de acht werelden te dragen');
});

test('en het zijn er ACHT, elk met een eigen wereldpagina die bestaat', () => {
  const bron = lees('public', 'apps', 'app-main', 'app-main-24a2.js');
  const werelden = [...bron.matchAll(/wereld:\s*'([^']+)'/g)].map((m) => m[1]);
  assert.equal(werelden.length, 8,
    'er horen acht werelden te staan, gevonden: ' + werelden.join(', '));
  for (const w of werelden) {
    const p = path.join(__dirname, '..', 'public', w.replace(/^\//, ''));
    assert.ok(fs.existsSync(p), 'de wereldtegel wijst naar een pagina die niet bestaat: ' + w);
  }
});

/* De keerzijde van het opruimen, en de reden dat dit een aparte bewering is:
   een app die van het beginscherm verdwijnt moet ergens ANDERS een ingang
   hebben. Anders is opruimen hetzelfde als weggooien -- de app bestaat nog,
   draait nog, en is alleen niet meer te vinden. Berichten en Camera stonden in
   de oude functierij; ze horen nu in de wereld Sociaal te staan. */
test('wat uit de functierij verdween, heeft een ingang in zijn wereld', () => {
  const sociaal = lees('public', 'apps', 'sociaal.html');
  for (const app of ['/apps/comm.html', '/apps/camera.html']) {
    assert.ok(sociaal.includes(app),
      'vanuit RTG Sociaal is ' + app + ' niet te bereiken, en het beginscherm draagt hem niet meer');
  }
  // de wallet is geen link maar de wereld zelf: geld.html laadt hem in
  assert.match(lees('public', 'apps', 'geld.html'), /wallet\.js/,
    'de Geld-wereld laadt de wallet niet meer; dan is hij nergens meer');
});
