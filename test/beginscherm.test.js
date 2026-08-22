/* HET BEGINSCHERM DRAAGT DE WERELDEN EN VERDER GEEN LOSSE APPS.

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

test('het beginscherm draagt geen losse app-tegels naast de werelden', () => {
  const bundel = lees('public', 'apps', 'app-main.js');
  assert.match(bundel, /const FUNCTIES = \[\s*\]/,
    'de functierij onder de klok is weer gevuld; het beginscherm hoort alleen de werelden te dragen');
});

test('en het zijn er VIER, elk met een eigen wereldpagina die bestaat', () => {
  /* DRIE WERD VIER OP 19 AUGUSTUS 2026, en dat is een besluit en geen slijtage.
     PLATFORM.md par. 0 telde er drie; WERELDEN.md vervangt die telling door
     LivingOS, WorkOS, TravelOS en FoundationOS, met RTG Core als laag eronder
     die met opzet GEEN wereld is. Instellingen staat ook in MAPPEN maar draagt
     `paneel` in plaats van `wereld`, en telt hier dus terecht niet mee.

     Het getal staat hier hard, en dat is de bedoeling: een vijfde wereld hoort
     een besluit te zijn dat je in dit bestand komt opschrijven, niet iets dat
     erbij sluipt. */
  const bron = lees('public', 'apps', 'app-main', 'app-main-24a2.js');
  const werelden = [...bron.matchAll(/wereld:\s*'([^']+)'/g)].map((m) => m[1]);
  assert.equal(werelden.length, 4,
    'er horen vier werelden te staan, gevonden: ' + werelden.join(', '));
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
  assert.equal(mappen.length, 4, 'de vier productindelingen zijn niet allemaal te lezen');

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
  /* DE BLINDE VLEK VAN DEZE REGEL, en hij hoort hier te staan omdat hij niet is
     opgelost. De bestemming wordt afgeleid uit de SLEUTEL (`link:vluchten` ->
     /apps/vluchten.html) en niet uit de url in LINKS. Waar die twee uiteenlopen
     meet deze toets niets: `link:reizen` wijst in werkelijkheid naar
     /apps/reizen-veilig.html en `link:wallet` naar /apps/geld.html#wallet.

     Gemeten wat een url-versie zou opleveren: zestien ontbrekende ingangen, en
     de meeste daarvan zijn geen echte gaten maar het samenvoegpatroon van
     PLATFORM.md -- tien pagina's die tien STANDEN van /apps/geld.html werden,
     elk op hun eigen hash, terwijl het huis nog naar de oude losse adressen
     wijst. Een url-versie vraagt dus eerst hash-besef en daarna een ronde per
     wereld. Dat is een eigen stuk werk; tot die tijd staat hier wat hij NIET
     ziet, in plaats van dat het stil blijft. */
  /* DE LIJST IS LEEG, en dat is nieuws. Er stonden vier apps op -- Onderneming,
     Loonstrook, Browser en Sitemaker -- die in WorkOS hingen terwijl
     /apps/kantoor.html er nergens naar wees. Ze staan er nu in de rij "Werk".
     Leeg laten en niet weghalen: de constructie eromheen is wat de lijst weer
     laat groeien zichtbaar maakt, en een lege verzameling zegt dat er vandaag
     niets openstaat. */
  const SCHULD = new Set([]);

  const gemist = [], nogOpen = new Set();
  for (const m of mappen) {
    const wereldPad = m[1];
    const pagina = path.join(__dirname, '..', 'public', wereldPad.replace(/^\//, ''));
    if (!fs.existsSync(pagina)) continue;
    const html = fs.readFileSync(pagina, 'utf8');
    for (const item of [...m[2].matchAll(/'link:([a-z0-9-]+)'/g)].map((x) => x[1])) {
      const doel = path.join(__dirname, '..', 'public', 'apps', item + '.html');
      if (!fs.existsSync(doel)) continue;              // geen eigen pagina: niets te linken
      /* EEN WERELD HOEFT NIET NAAR ZICHZELF TE WIJZEN. TravelOS heeft
         /apps/reizen.html als huis en draagt `link:reizen` als onderdeel; die
         twee vielen hier samen en leverden de eis op dat de pagina naar zichzelf
         moet linken. Dat is geen ingang maar een cirkel. */
      if ('/apps/' + item + '.html' === wereldPad) continue;
      const regel = wereldPad + ' mist ' + item;
      if (html.includes('/apps/' + item + '.html')) continue;   // bereikbaar, klaar
      if (SCHULD.has(regel)) nogOpen.add(regel); else gemist.push(regel);
    }
  }
  assert.deepEqual(gemist, [],
    'deze functies staan in een wereld maar zijn daar niet te bereiken:\n  ' + gemist.join('\n  '));
});
