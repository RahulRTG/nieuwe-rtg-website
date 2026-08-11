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
  assert.ok(mappen.length >= 7, 'de mappen zijn niet te lezen; dan meet deze regel niets');

  /* DE SCHULD DIE ER AL LAG, met naam en toenaam -- zelfde afspraak als de
     BEKEND-lijst in scripts/check.js regel 45: hij mag ALLEEN KRIMPEN. Deze
     vierendertig apps bestaan, draaien en staan in een wereld, maar die wereld
     wijst er niet naartoe. Ze zijn dus alleen te bereiken door het adres met de
     hand in te typen. Dat is niet in een keer op te lossen -- elke wereld
     verdient een eigen ronde, en sommige van deze apps horen misschien op te
     gaan IN hun wereld in plaats van ernaast te blijven staan.

     Wat deze lijst wel doet: hem zichtbaar houden en verhinderen dat hij
     groeit. Een nieuwe app zonder ingang zakt meteen. RTG Media is de eerste
     wereld die af is (zie de rij specialisten in apps/media.html); de rest
     hoort te volgen. */
  const SCHULD = new Set([
    '/apps/reizen.html mist reizen', '/apps/reizen.html mist ov', '/apps/reizen.html mist navigatie',
    '/apps/reizen.html mist flits', '/apps/reizen.html mist stad', '/apps/reizen.html mist reisboek',
    '/apps/reizen.html mist hangar', '/apps/reizen.html mist residentie',
    '/apps/geld.html mist wallet', '/apps/geld.html mist bank', '/apps/geld.html mist wbw',
    '/apps/geld.html mist rtgcode', '/apps/geld.html mist balans', '/apps/geld.html mist labfonds',
    '/apps/geld.html mist mecenaat', '/apps/geld.html mist nalatenschap', '/apps/geld.html mist logboek',
    '/apps/sociaal.html mist vonk', '/apps/sociaal.html mist cercle', '/apps/sociaal.html mist entourage',
    '/apps/sociaal.html mist rendezvous', '/apps/sociaal.html mist attenties',
    '/apps/lifestyle.html mist maison', '/apps/lifestyle.html mist table',
    '/apps/lifestyle.html mist cellier', '/apps/lifestyle.html mist garderobe',
    '/apps/kantoor.html mist onderneming', '/apps/kantoor.html mist loonstrook',
    '/apps/kantoor.html mist browser', '/apps/kantoor.html mist sitemaker',
    '/apps/veilig.html mist ik', '/apps/veilig.html mist veilig',
    '/apps/veilig.html mist passkeys', '/apps/veilig.html mist juridisch'
  ]);

  const gemist = [], nogOpen = new Set();
  for (const m of mappen) {
    const wereldPad = m[1];
    const pagina = path.join(__dirname, '..', 'public', wereldPad.replace(/^\//, ''));
    if (!fs.existsSync(pagina)) continue;
    const html = fs.readFileSync(pagina, 'utf8');
    for (const item of [...m[2].matchAll(/'link:([a-z0-9-]+)'/g)].map((x) => x[1])) {
      const doel = path.join(__dirname, '..', 'public', 'apps', item + '.html');
      if (!fs.existsSync(doel)) continue;              // geen eigen pagina: niets te linken
      const regel = wereldPad + ' mist ' + item;
      if (html.includes('/apps/' + item + '.html')) continue;   // bereikbaar, klaar
      if (SCHULD.has(regel)) nogOpen.add(regel); else gemist.push(regel);
    }
  }
  assert.deepEqual(gemist, [],
    'NIEUW: deze apps staan in een wereld maar zijn daar niet te bereiken (en dus nergens):\n  ' + gemist.join('\n  '));
  /* En wie er een oplost, haalt hem van de lijst. Anders slijt de lijst tot
     een verzameling namen die niets meer zegt -- dezelfde afspraak als bij
     regel 45 in scripts/check.js. */
  const opgelost = [...SCHULD].filter((r) => !nogOpen.has(r));
  assert.deepEqual(opgelost, [],
    'deze staan nog als schuld genoteerd maar zijn inmiddels bereikbaar; haal ze uit SCHULD:\n  ' + opgelost.join('\n  '));
});
