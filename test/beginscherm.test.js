/* HET BEGINSCHERM DRAAGT DE VIER APPS EN VERDER GEEN LOSSE APPS.

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

test('het beginscherm draagt geen losse app-tegels naast de vier apps', () => {
  const bundel = lees('public', 'apps', 'app-main.js');
  assert.match(bundel, /const FUNCTIES = \[\s*\]/,
    'de functierij onder de klok is weer gevuld; het beginscherm hoort alleen de vier apps te dragen');
});

test('en het zijn exact LIFE, WORK, FOUNDATION en INSTELLINGEN', () => {
  const bron = lees('public', 'apps', 'app-main', 'app-main-24a2.js');
  const apps = [...bron.matchAll(/naam:\s*'([^']+)'[^\n]*wereld:\s*'([^']+)'/g)]
    .map((m) => ({ naam: m[1], wereld: m[2] }));
  assert.deepEqual(apps.map((a) => a.naam), ['LIFE', 'WORK', 'FOUNDATION', 'INSTELLINGEN'],
    'de voordeur hoort exact vier vaste productnamen te dragen');
  for (const w of apps.map((a) => a.wereld)) {
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

/* DE ALGEMENE VORM VAN DEZELFDE FOUT, en die is groter dan die twee apps.

   Elke wereldtegel op het beginscherm draagt een lijst `items` -- de apps die
   in die wereld horen. Sinds de tegel RECHTSTREEKS naar de wereldpagina
   navigeert (er komt geen tussenscherm met tegels meer), wordt die lijst
   nergens meer getekend. Hij voedt alleen nog Spotlight.

   Dat betekent dat een app die alleen in zo'n lijst staat, in de hele app geen
   enkele ingang meer heeft. Zo bleek RTG Spelen -- en daarmee Magnaat, Quizduel
   en de rest van de Game Hall -- alleen nog bereikbaar door het adres met de
   hand in te typen. Gevonden doordat er iemand vroeg waar hij Magnaat kon
   spelen, en niet door een toets. Vandaar deze.

   De regel: staat een app in de items van een wereld, dan moet die wereld ook
   een weg ernaartoe hebben. */
test('elke app in een wereld-lijst heeft ook een ingang op die wereldpagina', () => {
  const bron = lees('public', 'apps', 'app-main', 'app-main-24a2.js');
  const mappen = [...bron.matchAll(/wereld:\s*'([^']+)'[\s\S]*?items:\s*\[([^\]]*)\]/g)];
  assert.equal(mappen.length, 4, 'de vier productindelingen zijn niet allemaal te lezen');

  /* GEEN UITZONDERINGSLIJST MEER. Een geregistreerde functie zonder ingang in
     haar wereld is een verdwenen functie, ook als het HTML-bestand technisch
     nog bestaat. De wereld mag naar het eigen pad of naar een bestaand oud pad
     wijzen; oude bladwijzers blijven immers geldig als omleiding. */
  const linksBron = lees('public', 'apps', 'app-main', 'app-main-23.js') +
    lees('public', 'apps', 'app-main', 'app-main-24.js');
  const gemist = [];
  for (const m of mappen) {
    const wereldPad = m[1];
    const pagina = path.join(__dirname, '..', 'public', wereldPad.replace(/^\//, ''));
    if (!fs.existsSync(pagina)) continue;
    const html = fs.readFileSync(pagina, 'utf8');
    for (const item of [...m[2].matchAll(/'link:([a-z0-9-]+)'/g)].map((x) => x[1])) {
      const eigenPad = '/apps/' + item + '.html';
      const eigenBestand = path.join(__dirname, '..', 'public', eigenPad.replace(/^\//, ''));
      const def = linksBron.match(new RegExp("\\n\\s*" + item + ":\\s*\\{[^}]*url:\\s*['\"]([^'\"]+)"));
      const doelPad = def ? def[1] : eigenPad;
      if (!fs.existsSync(eigenBestand) && !def) {
        gemist.push(wereldPad + ' heeft geen bestaand doel voor ' + item);
        continue;
      }
      const regel = wereldPad + ' mist ' + item;
      if (html.includes(eigenPad) || html.includes(doelPad)) continue;
      gemist.push(regel);
    }
  }
  assert.deepEqual(gemist, [],
    'deze functies staan in een wereld maar zijn daar niet te bereiken:\n  ' + gemist.join('\n  '));
});
