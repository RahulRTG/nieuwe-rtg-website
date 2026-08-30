/* DE BEWEGINGSLAAG, machinaal gehandhaafd.

   WAAROM DEZE TOETS BESTAAT. Bewegingscode is het makkelijkst stil kapot te
   krijgen wat er in dit huis staat: er komt geen foutmelding, er blijft alleen
   iets onzichtbaar of het hapert op één soort toestel dat de bouwer niet heeft.
   Wat hier gemeten wordt is dus precies wat je door te KIJKEN niet ziet: de
   rustige weergave, het telefoonbudget, en de grens dat verbergen niet bestaat.

   Wat hij NIET meet is smaak: of 0,15 tot 0,55 de mooie momenten zijn, of een
   scene fraai oogt. Dat blijft mensenwerk.

   Bij elke toets staat DE MUTATIE die hem hoort te laten zakken (LAT.md regel
   2); alle mutaties hieronder zijn gedraaid en zakten op de genoemde toets. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const lees = (p) => fs.readFileSync(path.join(WORTEL, p), 'utf8');
const leer = require('../public/shared/beweging.js');

const MOTOR = lees('public/shared/beweging/motor.js');
const BLAD = lees('public/shared/beweging/blad.js');
const CSS = lees('public/shared/beweging.css');

/* ============================================================ het rekenen == */

test('bereik snijdt een deeltijdlijn uit, en een leeg bereik is een schakelaar', () => {
  /* DE MUTATIE: laat bereik() bij eind <= start gewoon delen. Dan geeft een
     bereik van nul lengte NaN, en NaN in een transform is een element dat
     zonder melding van het scherm valt. */
  assert.equal(leer.bereik(0.10, 0.20, 0.60), 0);
  assert.ok(Math.abs(leer.bereik(0.40, 0.20, 0.60) - 0.5) < 1e-9);
  assert.equal(leer.bereik(0.90, 0.20, 0.60), 1);
  assert.equal(leer.bereik(0.10, 0.5, 0.5), 0);
  assert.equal(leer.bereik(0.90, 0.5, 0.5), 1);
  Object.values(leer.VERSNELLING).forEach((f) => {
    assert.ok(Number.isFinite(f(leer.bereik(0.5, 0.5, 0.5))));
  });
});

test('elke versnelling begint op 0 en eindigt op 1', () => {
  /* DE MUTATIE: laat easeInOut eindigen op 0,98. Een beeld komt dan elke keer
     nét niet aan, en op een scherm is dat "het voelt onaf" zonder dat iemand
     kan aanwijzen waarom. */
  Object.entries(leer.VERSNELLING).forEach(([naam, f]) => {
    assert.ok(Math.abs(f(0)) < 1e-9, naam + ' begint niet op 0');
    assert.ok(Math.abs(f(1) - 1) < 1e-9, naam + ' eindigt niet op 1');
  });
});

/* ================================================== grens 2: rustig is af == */

test('rustig geeft de EINDstand en geen transform', () => {
  /* DE MUTATIE: laat rekenStand bij rustig de voortgang gewoon doorgeven. Dan
     ziet iemand die bewegingsanimaties uit heeft staan een pagina waarvan de
     inhoud op opacity 0 staat te wachten op een animatie die nooit komt --
     een leeg scherm dat op elk ander toestel prima werkt. */
  const decl = { element: 'beeld', opacity: { van: 0, naar: 1, start: 0, eind: 0.3 },
    schaal: { van: 0.8, naar: 1.2 } };
  const rustig = leer.rekenStand(decl, 0, { rustig: true });
  assert.equal(rustig.opacity, '1');
  assert.equal(rustig.transform, undefined);
  const bewegend = leer.rekenStand(decl, 0, { rustig: false });
  assert.equal(bewegend.opacity, '0');
});

test('het blad haalt in rustige weergave het kleven en de scrollruimte weg', () => {
  /* DE MUTATIE: haal het prefers-reduced-motion-blok uit beweging.css. Dan
     zet de motor wel de eindstand, maar blijft er 300vh lege ruimte per scene
     staan: een pagina die zes keer zo lang is als hij aan inhoud heeft. */
  const blok = CSS.split('prefers-reduced-motion')[1] || '';
  assert.match(blok, /\.bw-kleef\s*\{[^}]*position:\s*relative/);
  assert.match(blok, /\.bw-scene\s*\{[^}]*min-height:\s*0/);
  assert.match(MOTOR, /omg\.rustig/);
});

/* ============================== grens 1: verbergen bestaat niet ============ */

test('een beweging naar opacity 0 zonder tegenhanger zakt', () => {
  /* DE MUTATIE: haal de opacity-0-controle uit keur(). Dan mag een scene
     inhoud van het scherm halen zonder dat er iets voor in de plaats komt --
     precies de fout die ADAPTIEF.md verbiedt, nu via een animatie in plaats
     van via display:none. */
  const zonder = leer.keur({ soort: 'split', bewegingen: [
    { element: 'tekst', opacity: { van: 1, naar: 0, start: 0.4, eind: 0.6 } }] });
  assert.equal(zonder.deugt, false);
  assert.match(zonder.fouten.join(' '), /wisselt/);

  const met = leer.keur({ soort: 'split', bewegingen: [
    { element: 'tekst', opacity: { van: 1, naar: 0, start: 0.4, eind: 0.6 }, wisselt: 'tekst2' },
    { element: 'tekst2', opacity: { van: 0, naar: 1, start: 0.5, eind: 0.7 } }] });
  assert.equal(met.deugt, true, met.fouten.join(' '));
});

test('elke scene in het register komt door zijn eigen keuring', () => {
  /* DE MUTATIE: zet in het register bij `tekstwissel` de `wisselt` weg. Dan
     staat er een vorm in het huis die zijn eigen grens overtreedt, en de motor
     weigert hem pas in de browser -- als lege scene bij een bezoeker. */
  const soorten = [...BLAD.matchAll(/^\s{4}(\w+):\s*\{$/gm)].map((m) => m[1]);
  assert.ok(soorten.length >= 6, 'geen soorten gevonden in het register: ' + soorten);
  soorten.forEach((soort) => {
    const blok = BLAD.split(new RegExp('^\\s{4}' + soort + ':\\s*\\{$', 'm'))[1].split(/^\s{4}\w+:\s*\{$/m)[0];
    const decl = { soort, bewegingen: [] };
    /* de declaraties uit het register letterlijk lezen, zonder browser */
    const bew = blok.match(/bewegingen:\s*\[([\s\S]*?)\n\s{6}\]/);
    assert.ok(bew, soort + ' heeft geen bewegingen in het register');
    // eslint-disable-next-line no-eval
    decl.bewegingen = eval('[' + bew[1] + ']');
    const hoogte = blok.match(/hoogte:\s*(\d+)/);
    if (hoogte) decl.hoogte = Number(hoogte[1]);
    const uitslag = leer.keur(decl);
    assert.equal(uitslag.deugt, true, soort + ': ' + uitslag.fouten.join(' | '));
  });
});

/* ============================ de kanalen: geen indeling per frame ========== */

test('left, top, width en height zijn geen kanaal, en de weigering zegt waarom', () => {
  /* DE MUTATIE: zet `left` in KANALEN. Dan mag een scene elke frame de pagina
     opnieuw laten indelen; op een bureau ziet niemand het, op een telefoon
     zakt het beeld naar 20 frames. */
  ['left', 'top', 'width', 'height'].forEach((eig) => {
    const u = leer.keur({ soort: 'split', bewegingen: [
      { element: 'beeld', [eig]: { van: 0, naar: 100 } }] });
    assert.equal(u.deugt, false, eig + ' werd toegelaten');
    assert.match(u.fouten.join(' '), /opnieuw in/);
  });
  Object.values(leer.KANALEN).forEach((k) => {
    assert.ok(['transform', 'opacity', 'clip-path'].includes(k.vorm));
  });
});

test('de motor leest eerst alles en schrijft daarna pas', () => {
  /* DE MUTATIE: zet het schrijven in render() in dezelfde lus als het meten.
     Dan dwingt elke scene een herindeling af voor de meting van de volgende,
     en kost een pagina met acht scenes acht herindelingen per frame. */
  const render = MOTOR.split('function render()')[1].split('\n  }')[0];
  const meet = render.indexOf('getBoundingClientRect') >= 0
    ? render.indexOf('voortgangVan') : render.indexOf('voortgangVan');
  const schrijf = render.indexOf('zet(');
  assert.ok(meet >= 0 && schrijf > meet,
    'render() schrijft voordat hij klaar is met lezen');
});

test('er is EEN scrolluisteraar en die is passief', () => {
  /* DE MUTATIE: haal { passive: true } weg. Dan mag de browser niet meer
     alvast doorscrollen terwijl de handler loopt, en voelt de pagina op een
     telefoon stroperig -- zonder dat er iets kapot lijkt. */
  const luisteraars = MOTOR.match(/addEventListener\(\s*['"]scroll['"]/g) || [];
  assert.equal(luisteraars.length, 1);
  assert.match(MOTOR, /addEventListener\(\s*['"]scroll['"][\s\S]{0,80}passive:\s*true/);
  const rafs = MOTOR.match(/requestAnimationFrame\(/g) || [];
  assert.equal(rafs.length, 1, 'meer dan een renderlus in de motor');
});

/* ============================== het budget van de telefoon ================= */

test('dezelfde declaratie geeft op een telefoon een kleinere uitslag', () => {
  /* DE MUTATIE: laat dempingVoor() altijd 1 teruggeven. Dan draait een scene
     die voor een bureau is bedacht met volle uitslag op een toestel dat het
     niet trekt, en is de enige uitweg een tweede declaratie per scherm --
     precies wat deze laag moest voorkomen. */
  const decl = { element: 'beeld', schaal: { van: 1, naar: 1.4 }, x: { van: 300, naar: 0 } };
  const bureau = leer.rekenStand(decl, 1, { vorm: 'bureau' });
  const telefoon = leer.rekenStand(decl, 1, { vorm: 'telefoon' });
  const schaalVan = (s) => Number(s.transform.match(/scale\(([\d.]+)\)/)[1]);
  assert.ok(schaalVan(bureau) > schaalVan(telefoon));
  assert.ok(schaalVan(telefoon) <= leer.BUDGET.telefoon.schaal + 1e-9,
    'telefoon gaat over zijn schaalbudget: ' + schaalVan(telefoon));

  const beginX = leer.rekenStand(decl, 0, { vorm: 'telefoon' }).transform;
  const px = Number(beginX.match(/translate3d\(([-\d.]+)px/)[1]);
  assert.ok(Math.abs(px) <= leer.BUDGET.telefoon.verschuiving + 1e-9);
});

test('een scene die over het hoogtebudget gaat, zakt bij de keuring', () => {
  /* DE MUTATIE: haal de hoogtecontrole uit keur(). Dan kan iemand een scene
     van 900vh maken; dat is drie schermen scrollen voor een animatie, en het
     enige signaal is een bezoeker die afhaakt. */
  const u = leer.keur({ soort: 'hero', hoogte: 900, bewegingen: [] });
  assert.equal(u.deugt, false);
  assert.match(u.fouten.join(' '), /knip hem in twee/);
  assert.equal(leer.sceneHoogte({ hoogte: 300 }, 'telefoon'), leer.BUDGET.telefoon.hoogte);
  assert.equal(leer.sceneHoogte({ hoogte: 300 }, 'bureau'), 300);
});

/* ============================== de merkregels =============================== */

test('de bewegingslaag kent geen ronde hoeken', () => {
  /* DE MUTATIE: geef .bw-toestelrand border-radius:40px, zoals bijna elk
     voorbeeld van dit soort schermen doet. Dat is de vormtaal van een ander
     merk; hier is elke hoek 0 (CLAUDE.md), en check.js regel 58 zegt hetzelfde
     over heel public/. */
  const waarden = [...CSS.matchAll(/border-radius\s*:\s*([^;}\n]+)/g)].map((m) => m[1].trim());
  waarden.forEach((w) => assert.ok(w === '0' || w === '50%', 'ronde hoek: ' + w));
  /* \b, want `background 200ms` bevat letterlijk "round 200ms" -- zonder die
     grens weigert deze toets een overgang op een achtergrond. */
  assert.ok(!/\bround\s+\d/.test(CSS), 'clip-path met ronde hoeken in het blad');
  assert.ok(!/\bround\s+\d/.test(leer.rekenStand({ onthul: { van: 100, naar: 0 } }, 0.5).clipPath));
});

test('op zwart is lopende tekst wit en geen bordeaux', () => {
  /* DE MUTATIE: zet .bw-vol .bw-lopend op var(--burgundy-on-dark). Dat haalt
     3,78:1 op zwart -- genoeg voor een grote kop, te weinig voor lopende tekst
     (CLAUDE.md), en het is precies het soort keuze dat er goed uitziet. */
  const blok = CSS.match(/\.bw-vol \.bw-lopend\s*\{([^}]*)\}/);
  assert.ok(blok, '.bw-vol .bw-lopend staat niet in het blad');
  assert.match(blok[1], /--white/);
  assert.ok(!/burgundy/.test(blok[1]));
});

test('het kleefpaneel is precies een venster hoog en niet MINSTENS een venster', () => {
  /* DE MUTATIE: zet .bw-kleef terug op min-height:100vh. Een sticky element dat
     HOGER is dan het venster plakt niet -- het schuift gewoon mee naar boven.
     De hele scene doet dan niets, zonder foutmelding, en alleen bij de schermen
     waar de kop toevallig over twee regels loopt. Gemeten: 1128px paneel in een
     venster van 800. */
  const kleef = CSS.match(/\.bw-kleef\s*\{([^}]*)\}/);
  assert.ok(kleef, '.bw-kleef staat niet in het blad');
  assert.match(kleef[1], /(^|[^-])height:\s*100vh/m);
  assert.ok(!/min-height:\s*100vh/.test(kleef[1]),
    'min-height:100vh laat het paneel groeien tot het niet meer plakt');
});

test('een kantelende scene zet zijn perspective op de ouder', () => {
  /* DE MUTATIE: zet `perspective(1400px)` terug in de transform van
     .bw-toestelrand, zoals bijna elk voorbeeld doet. De motor schrijft de hele
     transform van dat element, dus de perspective is bij de eerste frame weg
     en een kantelend toestel wordt een scheve rechthoek -- zonder foutmelding,
     en op de eerste frame ziet het er nog goed uit. */
  const kantelers = [...BLAD.matchAll(/kantel:/g)];
  assert.ok(kantelers.length > 0, 'geen enkele soort kantelt');
  assert.ok(!/\.bw-toestelrand\s*\{[^}]*transform:[^;}]*perspective/.test(CSS),
    'perspective staat in de transform van het bewegende element zelf');
  assert.match(CSS, /\.bw-toestel\s*\{[^}]*perspective:/);
});

test('een toestel past binnen de scene waar het in kleeft', () => {
  /* DE MUTATIE: haal max-height van .bw-toestelrand weg. De scene kleeft op
     100vh met overflow:hidden, dus een toestel van 900x600 plus een kop loopt
     op een laptop onder de rand door en wordt afgesneden. */
  const rand = CSS.match(/\.bw-toestelrand\s*\{([^}]*)\}/);
  assert.ok(rand, '.bw-toestelrand staat niet in het blad');
  assert.match(rand[1], /max-height:\s*min\(/);
});

/* ============================== het proefblad ============================== */

test('elke soort uit het register staat op het proefblad', () => {
  /* DE MUTATIE: zet een nieuwe soort in het register en niet op het proefblad.
     Dan is de eerste keer dat iemand die vorm ziet bij een echt lid op een
     echt scherm, en dat is geen plek om erachter te komen dat hij niet deugt. */
  const proef = lees('public/apps/beweging.html');
  const soorten = [...BLAD.matchAll(/^\s{4}(\w+):\s*\{$/gm)].map((m) => m[1]);
  soorten.forEach((s) => {
    assert.match(proef, new RegExp("soort:\\s*'" + s + "'"), 'ontbreekt op het proefblad: ' + s);
  });
});

/* ======================================== het LivingOS-blad ================ */

test('elk onderdeel op het LivingOS-blad bestaat echt, en heet daar zo', () => {
  /* DE MUTATIE: zet op het blad `sleutel: 'link:medias'` of hernoem "Mijn
     leven" in MAPPEN. Dan wijst een blad met echte adressen naar een onderdeel
     dat niet bestaat of anders heet -- en dat merkt niemand, want de link doet
     het gewoon tot het scherm verdwijnt. Dit is precies het soort blad dat
     binnen een half jaar een folder wordt.

     Wat deze toets NIET doet is de teksten keuren: of "Je leven, niet je apps"
     de goede zin is, blijft mensenwerk. */
  const reg = require('../scripts/lib/wereldregister');
  const blad = lees('public/apps/livingos-blad.html');
  const wereld = reg.WERELDEN.find((w) => w.naam === 'LivingOS');
  assert.ok(wereld, 'LivingOS staat niet meer in het wereldregister');

  const sleutels = [...blad.matchAll(/sleutel:\s*'([^']+)'/g)].map((m) => m[1]);
  assert.ok(sleutels.length >= 6, 'geen sleutels op het blad gevonden');
  sleutels.forEach((s) => {
    assert.ok(wereld.items.includes(s), s + ' zit niet in LivingOS');
    const kort = s.split(':')[1];
    const link = reg.LINKS[kort];
    assert.ok(link, s + ' is geen link in het register');
    assert.ok(blad.includes("adres: '" + link.url + "'"),
      s + ' wijst niet naar ' + link.url + ' zoals het register zegt');
  });

  /* Het getal in de kop is GEMETEN en niet overgetypt. Een blad dat "vijftig
     onderdelen" belooft terwijl het er 47 zijn, is precies de belofte zonder
     bron die dit huis nergens accepteert. */
  const woord = { 50: 'ijftig', 40: 'eertig', 60: 'estig' }[wereld.items.length];
  assert.ok(woord && blad.toLowerCase().includes(woord),
    'het blad noemt niet het gemeten aantal onderdelen (' + wereld.items.length + ')');
});

test('elke deur op het blad is een echte link met een raakbaar vlak', () => {
  /* DE MUTATIE: maak van .bw-deur een <span> met een klikhandler, of zet
     min-height op 30px. Het eerste haalt hem uit de toetsenbordvolgorde, het
     tweede maakt hem op een telefoon lastig te raken -- en allebei zie je op
     een muisscherm niets. */
  assert.match(BLAD, /el\('a', 'bw-deur'/);
  assert.match(BLAD, /a\.href = scene\.adres/);
  /* En elke soort die een deur KAN dragen, geeft `adres` ook door aan het blok
     dat op het scherm blijft staan. DE MUTATIE: haal `adres: scene.adres` weg
     bij de tekstwissel. De configuratie noemt dan een adres dat nergens
     verschijnt -- gemeten: 5 deuren op een blad met 6 scenes. */
  const wissel = BLAD.split("tekstwissel:")[1].split(/^\s{4}\w+:\s*\{$/m)[0];
  assert.match(wissel, /adres:\s*scene\.adres/);
  const deur = CSS.match(/\.bw-deur\s*\{([^}]*)\}/);
  assert.ok(deur, '.bw-deur staat niet in het blad');
  const min = deur[1].match(/min-height:\s*(\d+)px/);
  assert.ok(min && Number(min[1]) >= 44, 'de deur is kleiner dan 44px');
});
