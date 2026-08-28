/* DE MUTATIESEMANTIEK OVER DE ROUTES -- en of de meter werkelijk uitslaat.

   Het besluit staat in CREATE.md par. 10: niet alles idempotent MAKEN, maar van
   alles UITSPREKEN wat een tweede aanroep doet. Deze meter legt wat er is
   VERKLAARD naast wat er is GEMETEN.

   De verleiding is een meter die netjes telt en nooit iets vindt. Deze toets
   houdt daarom de vier dingen vast waarop hij waardeloos wordt:

     1. de TEGENSPRAAK -- verklaard als idempotent terwijl de proef een tweede
        effect zag. Dat is de duurste fout die hier bestaat, want een taakloper
        gelooft de verklaring en niet de meting;
     2. een klasse die niet bestaat wordt gemeld en niet stil genegeerd;
     3. een verklaring lekt niet van de ene route naar de volgende;
     4. de afdruk loopt niet achter op de code.

   Draai los: node --test test/mutatiesemantiek.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const M = require('../scripts/mutatiesemantiek');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mutsem-'));
/* Elke proef krijgt zijn EIGEN map. Eerst deelden ze er een, en toen las elke
   toets ook de routebestanden van de vorige -- dan meet je de optelsom en niet
   het geval dat je voor je had. */
let n = 0;
const schrijf = (naam, inhoud) => {
  const map = path.join(TMP, 'p' + (++n));
  fs.mkdirSync(map, { recursive: true });
  fs.writeFileSync(path.join(map, naam), inhoud);
  return map;
};
const proef = (rijen) => ({ gemeten: { routesMetRol: rijen.length, beoordeeld: rijen.length, ongemeten: 0 }, perRoute: rijen });

test('1 - een tegenspraak tussen verklaring en meting wordt gemeld', () => {
  /* Het geval waar deze meter voor bestaat: iemand schrijft "idempotent" op,
     de proef zag een tweede effect. Zonder deze melding gelooft een taakloper
     de verklaring, en dan wordt een handeling twee keer gedaan. */
  const map = schrijf('a.js', "app.post('/api/x', auth, f);   /* mutatie: idempotent -- zogenaamd */\n");
  const r = M.meet({ mappen: [map], idemproef: proef([
    { methode: 'POST', pad: '/api/x', idempotentie: 'onbeschermd', reden: 'tweede antwoord verschilde' }
  ]) });
  assert.equal(r.gemeten.tegenspraken, 1);
  assert.match(r.tegenspraken[0].tegenspraak, /verklaard als idempotent/);
  assert.equal(r.tegenspraken[0].pad, '/api/x');
  assert.ok(r.tegenspraken[0].regel, 'met het regelnummer, anders is het een zoekopdracht');
});

test('2 - en andersom ook: onherhaalbaar verklaard, geen tweede effect gezien', () => {
  const map = schrijf('b.js', "app.post('/api/y', auth, f);   /* mutatie: nietHerhaalbaar -- zogenaamd */\n");
  const r = M.meet({ mappen: [map], idemproef: proef([
    { methode: 'POST', pad: '/api/y', idempotentie: 'beschermd', reden: 'geen tweede effect' }
  ]) });
  assert.equal(r.gemeten.tegenspraken, 1);
  assert.match(r.tegenspraken[0].tegenspraak, /zonder tweede effect/);
});

test('3 - een klopppende verklaring geeft GEEN tegenspraak', () => {
  const map = schrijf('c.js',
    "app.post('/api/goed', auth, f);   /* mutatie: idempotent -- lezen */\n"
    + "app.post('/api/ook', auth, f);   /* mutatie: nietHerhaalbaar -- telt op */\n");
  const r = M.meet({ mappen: [map], idemproef: proef([
    { methode: 'POST', pad: '/api/goed', idempotentie: 'beschermd', reden: '' },
    { methode: 'POST', pad: '/api/ook', idempotentie: 'onbeschermd', reden: '' }
  ]) });
  assert.equal(r.gemeten.tegenspraken, 0);
  assert.equal(r.gemeten.verklaard, 2);
});

test('4 - een klasse die niet bestaat wordt gemeld, niet genegeerd', () => {
  const map = schrijf('d.js', "app.post('/api/z', auth, f);   /* mutatie: misschien -- verzonnen */\n");
  const r = M.meet({ mappen: [map], idemproef: proef([]) });
  assert.equal(r.gemeten.onbekendeKlassen, 1);
  assert.match(r.onbekendeKlassen[0].wat, /bestaat niet/);
  assert.match(r.onbekendeKlassen[0].wat, /idempotent/, 'met de echte klassen erbij, zodat niemand hoeft te raden');
  assert.equal(r.gemeten.verklaard, 0, 'en hij telt NIET mee als verklaard');
});

test('5 - een verklaring lekt niet naar de volgende route', () => {
  /* Zonder een bereik zou de verklaring van de ene route de volgende gratis
     dekken, en dan meet dit script zijn eigen ruimhartigheid. */
  const map = schrijf('e.js',
    "/* mutatie: idempotent -- hoort bij de eerste */\n"
    + "app.post('/api/een', auth, f);\n"
    + "\n\n\n\n"
    + "app.post('/api/twee', auth, f);\n");
  const r = M.meet({ mappen: [map], idemproef: proef([]) });
  const paden = r.verklaard.map(x => x.pad);
  assert.deepEqual(paden, ['/api/een'], 'alleen de eerste route hoort verklaard te zijn');
});

test('6 - de markering mag achter de route of erboven', () => {
  const map = schrijf('f.js',
    "app.post('/api/achter', auth, f);   /* mutatie: idempotent -- achter */\n"
    + "/* mutatie: hooguitEens -- erboven */\n"
    + "app.post('/api/boven', auth, (req, res) => {\n");
  const r = M.meet({ mappen: [map], idemproef: proef([]) });
  const van = Object.fromEntries(r.verklaard.map(x => [x.pad, x.klasse]));
  assert.equal(van['/api/achter'], 'idempotent');
  assert.equal(van['/api/boven'], 'hooguitEens');
  const achter = r.verklaard.find(x => x.pad === '/api/achter');
  assert.match(achter.waarom, /achter/, 'de reden hoort mee te komen');
});

test('7 - de echte meting vindt de verklaringen van de App Store', () => {
  const r = M.meet();
  assert.ok(r.gemeten.verklaard >= 20, 'de App Store-routes horen verklaard te zijn, gevonden: ' + r.gemeten.verklaard);
  assert.equal(r.gemeten.onbekendeKlassen, 0, 'er hoort geen verzonnen klasse in de boom te staan');
  assert.equal(r.gemeten.tegenspraken, 0, 'en geen verklaring die de meting tegenspreekt');
  const paden = r.verklaard.map(x => x.pad);
  assert.ok(paden.includes('/api/appstore/verleen'));
  assert.ok(!paden.includes('/api/appstore/brug'),
    'de brug krijgt met opzet GEEN klasse op de route: die hangt aan de methode erin');
});

test('8 - de rand van het platform staat apart geteld', () => {
  /* Aan de rand is `onbekend` al verboden en is de verklaring structureel. Die
     bij de routes optellen zou de dekking mooier maken dan hij is. */
  const r = M.meet();
  assert.equal(r.gemeten.randVerklaard, 6, 'de zes methodes van de brug');
  for (const m of r.rand) assert.ok(m.klasse && m.klasse !== 'onbekend', m.naam + ' hoort een echte klasse te dragen');
  assert.ok(!r.verklaard.some(x => x.pad === 'bericht.zet'), 'de rand hoort niet tussen de routes te staan');
});

test('9 - MUTATIESEMANTIEK.json is een AFDRUK en geen los verhaal', () => {
  /* Zelfde regel als OBJECTMODEL.json en MAKERS.json, en om dezelfde reden: dit
     getal wordt geciteerd, dus een afdruk die stilletjes veroudert is erger dan
     geen afdruk. */
  const vast = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'MUTATIESEMANTIEK.json'), 'utf8'));
  const vers = M.meet();
  assert.deepEqual(vast.gemeten, vers.gemeten,
    'MUTATIESEMANTIEK.json loopt achter op de code -- draai: node scripts/mutatiesemantiek.js --vastleggen');
});

test('10 - de 2959 onbereikbare routes blijven zichtbaar', () => {
  /* Het getal dat ertoe doet mag niet uit beeld raken. Zou dit script alleen
     tellen wat er is verklaard, dan ziet twintig van drieduizend eruit als
     vooruitgang in plaats van als een begin. */
  const r = M.meet();
  assert.ok(r.gemeten.onbereikbaarVoorDeProef > 2000,
    'de onbereikbare routes horen in de uitslag te staan, niet weggelaten');
  assert.ok(r.gemeten.routesMetRol > r.gemeten.verklaard * 10,
    'en de verhouding hoort eerlijk te zijn');
});

test.after(() => { fs.rmSync(TMP, { recursive: true, force: true }); });
