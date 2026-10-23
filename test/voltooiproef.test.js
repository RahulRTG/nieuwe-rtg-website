/* DE VOLTOOIPROEF EN ZIJN REGISTER -- bewijs 3, 5 en 7 voor APPWERKT.

   scripts/voltooiproef.js loopt per onderdeel een scenario af in de
   gecontroleerde testwereld (wegwerpdata, postvanger, sms-sandbox, herstart en
   crash). VOLTOOIPROEF.json levert via scripts/lib/appcontract.js de bewijzen
   voltooibaar, persistent en herstelbaar. Dit bestand bewaakt het INSTRUMENT en
   het REGISTER; de proef zelf duurt te lang voor een gewone toets
   (npm run voltooiproef).

     1. Het instrument draait in de testwereld: eigen datamap, postvanger
        geeist, een NETTE herstart naast een CRASH, en de opslag gelezen buiten
        de server om. Vastleggen eist een schone boom.
     2. Elk scenario hoort bij een onderdeel uit MAPPEN, met dezelfde ingang, en
        de koppeling haalt de meting: het scenario raakt routes van die ingang.
        Een contract met een voltooiproef noemt precies een scenario dat bestaat,
        en elk scenario heeft een contract (anders telt hij stil niet mee).
     3. Het echte register draagt een stempel met commit, spreekt het woordgebruik
        van de bewijsbron, en zijn telling overstemt de rijen niet.
     4. De lezer van APPWERKT leest het echte register zoals het register zelf
        zegt -- en de RATEL: het aantal gesloten bewijzen mag niet dalen. Schuld
        mag krimpen, bewijs mag alleen groeien (PROOF.md par. 0). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const REGISTER = 'VOLTOOIPROEF.json';
const BEWIJZEN = ['voltooibaar', 'persistent', 'herstelbaar'];
/* Het vierde, AFGELEIDE bewijs (18 oktober 2026): uit alle antwoorden die het
   lid kreeg, ook onder de storingen. Een scenario schrijft het niet; zonder
   uitgelokte weigering draagt het geen schakels en `nietBeproefd`. */
const AFGELEID = 'menselijk';
const BEVOEGD = 'bevoegd';
/* DE RATEL: zoveel bewijzen staan op 11 oktober 2026 gesloten (twee
   onderdelen, drie bewijzen). Alleen omhoog; wie hem verlaagt, schrijft erbij
   waarom. */
const GESLOTEN_MINIMUM = 6;

const lees = (rel) => fs.readFileSync(path.join(WORTEL, rel), 'utf8');

test('1. het instrument draait in de testwereld en vraagt een schone boom om vast te leggen', () => {
  const proef = lees('scripts/voltooiproef.js');
  const wereld = lees('scripts/lib/voltooiwereld.js');
  assert.match(proef, /eisSchoneBoom\('de voltooiproef'\)/);
  assert.match(proef, /stempel: huisStempel\(\)/, 'zonder huisstempel kan versheid() niets over dit register zeggen');
  assert.match(proef, /process\.exit\(reg\.sluit \? 0 : 1\)/, 'zonder foutcode op een open bewijs is dit een meting en geen proef');
  assert.match(wereld, /require\('\.\/wegwerpserver'\)/);
  assert.match(wereld, /postvanger\.eis\(gereedschapsomgeving/, 'de proef weigert te meten als er post naar buiten kan');
  assert.match(wereld, /kill\('SIGTERM'\)/, 'een nette herstart (deploy)');
  assert.match(wereld, /kill\('SIGKILL'\)/, 'een crash (stroomstoring)');
  assert.match(wereld, /readOnly: true/, 'de opslag wordt gelezen zonder erin te kunnen schrijven');
  assert.doesNotMatch(proef + wereld, /localhost:3000|127\.0\.0\.1:3000/, 'de ontwikkelserver is van iemand anders');
});

test('1a. bevoegdheid vraagt een gesloten kernworkflow en een expliciete tegenproef', () => {
  const { bevoegdUit } = require('../scripts/voltooiproef');
  const kern = { sluit: true, telling: { gesloten: 4, schakels: 4 } };
  const niets = bevoegdUit(kern, [], null);
  assert.equal(niets.sluit, false);
  assert.match(niets.nietBeproefd, /geen uitgevoerde kruisproef/);

  const dicht = bevoegdUit(kern, [{ nr: 2, soort: 'tegenproef', wat: 'B blijft buiten', stand: 'gesloten' }], null);
  assert.equal(dicht.sluit, true);
  assert.deepEqual(dicht.schakels.map((s) => s.soort), ['bevoegde-workflow', 'tegenproef']);

  const open = bevoegdUit(kern, [{ nr: 2, soort: 'tegenproef', wat: 'B kwam binnen', stand: 'open' }], null);
  assert.equal(open.sluit, false);
  assert.equal(open.telling.open, 1);
  assert.equal(bevoegdUit({ sluit: false, telling: { gesloten: 3, schakels: 4 } }, dicht.schakels.slice(1), null).sluit, false);
  assert.equal(bevoegdUit(kern, dicht.schakels.slice(1), 'afgebroken').sluit, false);
});

test('2. elk scenario hoort bij een onderdeel uit MAPPEN, en het contract en de scenario\'s dekken elkaar', () => {
  const reg = require('../scripts/lib/wereldregister');
  const { CONTRACT } = require('../scripts/lib/appcontract');
  const B = require('../scripts/lib/bewijsbron');
  const { scenarios } = require('../scripts/voltooiproef');
  const lijst = scenarios();
  assert.ok(lijst.length >= 2, 'minder dan twee scenario\'s');
  for (const sc of lijst) {
    const sleutel = sc.functie.slice(sc.functie.indexOf(':') + 1);
    const c = CONTRACT[sc.functie];
    assert.ok(c, sc.functie + ' heeft een scenario maar geen contract: zijn bewijs telt dan stil niet mee');
    if (sc.functie.startsWith('link:')) {
      const bron = reg.LINKS[sleutel];
      assert.ok(bron && bron.url, sc.functie + ' staat niet met een adres in MAPPEN');
      assert.equal(bron.url, sc.ingang, sc.functie + ': het scenario noemt een andere ingang dan MAPPEN');
    } else {
      /* Een tab of OS-app heeft geen eigen adres. Hij telt alleen als de app hem
         echt kent, het contract de echte navigatiestap noemt en zijn eigen delen
         aanwijst die SCHERMROUTES.json kent -- nooit via een verzonnen adres. */
      const los = reg.los(sc.functie);
      assert.ok(los.bestaat, sc.functie + ' kent de app niet als tab of OS-app');
      assert.ok(c.ingang && c.ingang === sc.ingang, sc.functie + ': het contract en het scenario noemen een andere ingang');
      assert.ok(typeof c.via === 'string' && c.via.trim(), sc.functie + ': het contract noemt geen navigatiestap (via)');
      const sr = JSON.parse(fs.readFileSync(path.join(WORTEL, 'SCHERMROUTES.json'), 'utf8'));
      const bekend = new Set(sr.perScherm.map((x) => x.bestand));
      assert.ok(Array.isArray(c.bestanden) && c.bestanden.length, sc.functie + ': het contract wijst geen eigen delen aan');
      for (const b of c.bestanden) assert.ok(bekend.has(b), sc.functie + ': ' + b + ' staat niet in SCHERMROUTES.json');
    }
    assert.ok(sc.belofte && sc.grens && typeof sc.loop === 'function', sc.bestand + ' mist belofte, grens of loop');
    for (const b of BEWIJZEN.concat(AFGELEID)) {
      assert.equal(c[b] && c[b].soort, 'voltooiproef', sc.functie + ': ' + b + ' komt niet uit de voltooiproef');
      assert.equal(c[b].instrument, sc.bestand);
      /* Minstens twee routes van de ingang, of ALLE als het scherm er minder
         heeft: een scherm met één route (het routedossier) kan geen tweede
         leveren, en dan moet het scenario juist die ene raken. */
      const ingang = B.ingangVan(sc.functie.startsWith('link:') ? sc.ingang : null, c);
      const raak = B.gedeeld(B.proefRoutes(sc.bestand), ingang);
      const aantal = ingang.exact.size + ingang.voor.size;
      assert.ok(aantal >= 1, sc.functie + ': de ingang ' + sc.ingang + ' roept geen bekende route aan');
      assert.ok(raak.length >= Math.min(2, aantal), sc.functie + ': het scenario raakt ' + raak.length + ' van de ' + aantal + ' routes van ' + sc.ingang);
    }
  }
  /* De versheid van het register ziet alleen wat het instrument letterlijk
     inleest; een scenario buiten die sluiting kan veranderen zonder dat zijn
     BEWEZEN vervalt. */
  const sl = require('../scripts/lib/stempel').sluiting('scripts/voltooiproef.js');
  assert.ok(sl, 'de sluiting van scripts/voltooiproef.js is onbekend');
  for (const sc of lijst) assert.ok(sl.has(sc.bestand), sc.bestand + ' valt buiten de sluiting: een wijziging erin laat VOLTOOIPROEF.json vers');
  for (const [f, c] of Object.entries(CONTRACT)) {
    for (const b of Object.keys(c)) {
      if (c[b] && c[b].soort === 'voltooiproef') assert.ok(fs.existsSync(path.join(WORTEL, c[b].instrument)), f + ': ' + c[b].instrument + ' bestaat niet');
    }
  }
});

test('3. het echte register is bruikbaar als bewijs en spreekt zichzelf niet tegen', () => {
  const reg = JSON.parse(lees(REGISTER));
  assert.ok(reg.stempel && reg.stempel.commit && reg.stempel.instrument === 'scripts/voltooiproef.js', REGISTER + ' draagt geen bruikbaar stempel');
  assert.ok(reg.apps && Object.keys(reg.apps).length >= 2);
  let gesloten = 0, open = 0;
  for (const [f, a] of Object.entries(reg.apps)) {
    assert.equal(a.post.naarBuiten, 0, f + ': er ging post naar buiten');
    for (const b of BEWIJZEN) {
      const d = a[b];
      assert.ok(d && Array.isArray(d.schakels) && d.schakels.length >= 3, f + '/' + b + ' draagt te weinig schakels om iets te bewijzen');
      for (const s of d.schakels) assert.ok(['gesloten', 'open', 'stuk'].includes(s.stand), f + '/' + b + ' schakel ' + s.nr + ': onbekende stand ' + s.stand);
      const g = d.schakels.filter((s) => s.stand === 'gesloten').length;
      assert.equal(d.telling.gesloten, g, f + '/' + b + ': de telling overstemt de schakels');
      assert.equal(d.sluit, g === d.schakels.length && !a.afgebroken, f + '/' + b + ': `sluit` zegt iets anders dan de rijen');
      (d.sluit ? gesloten++ : open++);
    }
  }
  for (const [f, a] of Object.entries(reg.apps)) {
    const b = a[BEVOEGD];
    assert.ok(b && Array.isArray(b.schakels), f + '/' + BEVOEGD + ' ontbreekt');
    if (b.nietBeproefd) {
      assert.equal(b.schakels.length, 0, f + '/' + BEVOEGD + ': niet beproefd en toch schakels');
      assert.equal(b.sluit, false, f + '/' + BEVOEGD + ': niet beproefd en toch gesloten');
    } else {
      assert.equal(b.schakels.filter((s) => s.soort === 'bevoegde-workflow').length, 1, f + ': precies één positieve kernworkflow');
      assert.ok(b.schakels.some((s) => s.soort === 'tegenproef'), f + ': geen vreemde-actorproef');
      const g = b.schakels.filter((s) => s.stand === 'gesloten').length;
      assert.equal(b.sluit, g === b.schakels.length && !a.afgebroken, f + '/' + BEVOEGD + ': `sluit` spreekt de rijen tegen');
    }
  }
  assert.equal(reg.telling.bewijzenGesloten, gesloten);
  assert.equal(reg.telling.bewijzenOpen, open);
  assert.equal(reg.sluit, open === 0);
  /* Menselijk: of drie afgeleide schakels met dezelfde standen, of geen
     schakels en een reden waarom het niet beproefd is -- nooit allebei, en
     nooit gesloten zonder uitgelokte weigering. */
  for (const [f, a] of Object.entries(reg.apps)) {
    const m = a[AFGELEID];
    assert.ok(m && Array.isArray(m.schakels), f + '/' + AFGELEID + ' ontbreekt');
    if (m.nietBeproefd) {
      assert.equal(m.schakels.length, 0, f + '/' + AFGELEID + ': niet beproefd en toch schakels');
      assert.equal(m.sluit, false, f + '/' + AFGELEID + ': niet beproefd en toch gesloten');
    } else {
      assert.equal(m.schakels.length, 3, f + '/' + AFGELEID + ': drie afgeleide schakels');
      assert.ok(m.weigeringen >= 1, f + '/' + AFGELEID + ': gesloten zonder een enkele weigering');
      const g = m.schakels.filter((s) => s.stand === 'gesloten').length;
      assert.equal(m.sluit, g === 3 && !a.afgebroken, f + '/' + AFGELEID + ': `sluit` zegt iets anders dan de rijen');
    }
  }
  /* Persistent en herstelbaar MOETEN echt herstarten en crashen; een register
     waarin dat niet gebeurde, draagt die bewijzen niet. */
  for (const [f, a] of Object.entries(reg.apps)) {
    assert.ok(a.herstarts.netjes >= 1, f + ': geen nette herstart, dus geen persistent');
    assert.ok(a.herstarts.crash >= 1, f + ': geen crash, dus geen herstelbaar');
  }
});

test('4. de lezer van APPWERKT leest het echte register, en het aantal gesloten bewijzen daalt niet', () => {
  const { bewijsVoor } = require('../scripts/lib/bewijsbron');
  const reg = JSON.parse(lees(REGISTER));
  const VERS = () => ({ vers: true, reden: 'vers gezet in de toets' });
  let bewezen = 0;
  for (const [f, a] of Object.entries(reg.apps)) {
    for (const b of BEWIJZEN) {
      const u = bewijsVoor(f, b, a.ingang, { versheid: VERS });
      assert.ok(u, f + '/' + b + ': de bewijsbron kent geen bron');
      assert.equal(u.status, a[b].sluit ? 'BEWEZEN' : 'GEBLOKKEERD_DOOR_DEFECT', f + '/' + b + ' leest als ' + u.status + ': ' + u.reden);
      if (u.status === 'BEWEZEN') bewezen++;
    }
    const m = bewijsVoor(f, AFGELEID, a.ingang, { versheid: VERS });
    assert.ok(m, f + '/' + AFGELEID + ': de bewijsbron kent geen bron');
    const verwacht = a[AFGELEID].nietBeproefd ? 'NIET_GETEST' : (a[AFGELEID].sluit ? 'BEWEZEN' : 'GEBLOKKEERD_DOOR_DEFECT');
    assert.equal(m.status, verwacht, f + '/' + AFGELEID + ' leest als ' + m.status + ': ' + m.reden);
  }
  assert.ok(bewezen >= GESLOTEN_MINIMUM, 'de ratel: ' + bewezen + ' gesloten bewijzen, het minimum is ' + GESLOTEN_MINIMUM);
});
