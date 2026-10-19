/* De tand van ONTWERPSYSTEEM.md: gaat hij echt dicht?

   Een grendel die nooit zakt is niet te onderscheiden van een grendel die
   niets meet. Daarom zet elke toets hieronder één verboden ding neer -- een
   nieuw erfenisblad, een extra !important, een nieuw <style>-blok, een thema
   dat een eigenschap zet, een component dat een kale selector raakt -- en eist
   dat precies dat wordt tegengehouden. De laatste toets draait de echte
   controle op de echte boom. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const os_ = require('../scripts/ontwerpsysteem.js');

const WORTEL = path.join(__dirname, '..');
const DS = path.join(WORTEL, 'public', 'ds');
const leeg = () => ({ bladen: {}, blokken: {}, injectie: {}, paginas: {} });
const norm = (extra = {}) => ({ bladen: {}, blokken: {}, injectie: {}, uitzonderingen: [], ...extra });

test('een nieuw stijlblad buiten public/ds/ wordt tegengehouden', () => {
  const m = leeg(); m.bladen['public/shared/rtg-nog-een-laag.css'] = { bytes: 10, important: 0, hex: 0 };
  const { fouten } = os_.ratelFouten(m, norm());
  assert.equal(fouten.length, 1);
  assert.match(fouten[0], /nieuw stijlblad buiten public\/ds/);
});

test('een stijlblad in public/ds/ valt niet onder de erfenisratel', () => {
  const m = leeg(); m.bladen['public/ds/componenten/knop.css'] = { bytes: 10, important: 0, hex: 0 };
  assert.deepEqual(os_.ratelFouten(m, norm()).fouten, []);
});

test('erfenis mag krimpen maar niet groeien, per veld', () => {
  const lat = norm({ bladen: { 'public/shared/x.css': { bytes: 100, important: 3, hex: 2 } } });
  const m = leeg(); m.bladen['public/shared/x.css'] = { bytes: 90, important: 4, hex: 1 };
  const { fouten, ruimer } = os_.ratelFouten(m, lat);
  assert.deepEqual(fouten, ['public/shared/x.css: important 3 -> 4 (erfenis mag alleen krimpen)']);
  assert.equal(ruimer.length, 2);
});

test('een scherm zonder <style>-blok krijgt er geen', () => {
  const m = leeg(); m.blokken['public/apps/nieuw.html'] = { blokken: 1, bytes: 20, important: 0, hex: 0 };
  assert.match(os_.ratelFouten(m, norm()).fouten[0], /nieuw <style>-blok/);
});

test('een script dat nog geen stijl injecteerde, gaat dat niet doen', () => {
  const m = leeg(); m.injectie['public/shared/iets.js'] = 1;
  assert.match(os_.ratelFouten(m, norm()).fouten[0], /injecteert stijl/);
  assert.equal(os_.telInjectie("var s=document.createElement('style');"), 1);
  assert.equal(os_.telInjectie("l.href='/shared/x.css';"), 1);
});

test('een uitzondering vraagt reden en vervaldatum, en verloopt', () => {
  const m = leeg(); m.bladen['public/shared/y.css'] = { bytes: 1, important: 0, hex: 0 };
  assert.deepEqual(os_.ratelFouten(m, norm({ uitzonderingen: [{ pad: 'public/shared/y.css', reden: 'overgang', vervalt: '2999-01-01' }] })).fouten, []);
  assert.match(os_.ratelFouten(m, norm({ uitzonderingen: [{ pad: 'public/shared/y.css' }] })).fouten.join(), /zonder pad, reden of vervaldatum/);
  assert.match(os_.ratelFouten(m, norm({ uitzonderingen: [{ pad: 'public/shared/y.css', reden: 'x', vervalt: '2000-01-01' }] })).fouten.join(), /verlopen/);
});

test('vastleggen zet de lat strakker en neemt nooit iets nieuws op', () => {
  const lat = norm({ bladen: { 'public/shared/x.css': { bytes: 100, important: 3, hex: 2 } } });
  const m = leeg();
  m.bladen['public/shared/x.css'] = { bytes: 80, important: 3, hex: 0 };
  m.bladen['public/shared/nieuw.css'] = { bytes: 1, important: 0, hex: 0 };
  const uit = os_.normUit(m, lat);
  assert.deepEqual(uit.bladen, { 'public/shared/x.css': { bytes: 80, important: 3, hex: 0 } });
});

/* Het contract, op een kopie van public/ds/ waarin telkens één ding misgaat. */
function kopieMet(wijzig) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ds-'));
  fs.cpSync(DS, map, { recursive: true });
  wijzig(map);
  const fouten = os_.contractFouten({ paginas: {} }, map);
  fs.rmSync(map, { recursive: true, force: true });
  return fouten.join('\n');
}

test('het echte public/ds/ voldoet aan zijn contract', () => {
  assert.deepEqual(os_.contractFouten({ paginas: {} }, DS), []);
});

test('contract: een regel buiten een cascadelaag', () => {
  assert.match(kopieMet(d => fs.appendFileSync(path.join(d, 'componenten/knop.css'), '\n.ds-knop{color:var(--ds-inkt)}\n')), /buiten een cascadelaag/);
});

test('contract: accolades die niet sluiten', () => {
  assert.match(kopieMet(d => fs.appendFileSync(path.join(d, 'componenten/knop.css'), '\n@layer rtg.component{.ds-knop{color:var(--ds-inkt)}\n')), /accolades sluiten niet/);
});

test('contract: !important', () => {
  assert.match(kopieMet(d => fs.appendFileSync(path.join(d, 'componenten/knop.css'), '\n@layer rtg.component{.ds-knop{color:var(--ds-inkt)!important}}\n')), /!important/);
});

test('contract: de ene !important van reset.css is de enige', () => {
  assert.match(fs.readFileSync(path.join(DS, 'reset.css'), 'utf8'), /\[hidden\] \{ display: none !important; \}/, 'hidden wint van elk component');
  assert.match(kopieMet(d => fs.appendFileSync(path.join(d, 'reset.css'), '\n@layer rtg.reset{.ds-scherm a{color:inherit!important}}\n')), /reset\.css: bevat !important/);
  assert.match(kopieMet(d => fs.appendFileSync(path.join(d, 'componenten/knop.css'), '\n@layer rtg.component{.ds-scherm [hidden] { display: none !important; }}\n')), /knop\.css: bevat !important/);
});

test('contract: een kleurwaarde buiten tokens.css', () => {
  assert.match(kopieMet(d => fs.appendFileSync(path.join(d, 'componenten/knop.css'), '\n@layer rtg.component{.ds-knop{color:#123456}}\n')), /kleurwaarde buiten tokens/);
  assert.match(kopieMet(d => fs.appendFileSync(path.join(d, 'componenten/knop.css'), '\n@layer rtg.component{.ds-knop{color:rgb(1,2,3)}}\n')), /kleurwaarde buiten tokens/);
});

test('contract: fysieke richting breekt rechts-naar-links', () => {
  assert.match(kopieMet(d => fs.appendFileSync(path.join(d, 'componenten/knop.css'), '\n@layer rtg.component{.ds-knop{margin-left:4px}}\n')), /fysieke eigenschap margin-left/);
  assert.match(kopieMet(d => fs.appendFileSync(path.join(d, 'componenten/knop.css'), '\n@layer rtg.component{.ds-knop{text-align:left}}\n')), /text-align/);
});

test('contract: afronding alleen via een radius-token', () => {
  assert.match(kopieMet(d => fs.appendFileSync(path.join(d, 'componenten/knop.css'), '\n@layer rtg.component{.ds-knop{border-radius:7px}}\n')), /afronding 7px/);
});

test('contract: een thema zet alleen themabare tokens', () => {
  assert.match(kopieMet(d => fs.appendFileSync(path.join(d, 'thema/travel.css'), '\n@layer rtg.thema{[data-rtg-world="travel"]{color:var(--ds-inkt)}}\n')), /thema zet eigenschap color/);
  assert.match(kopieMet(d => fs.appendFileSync(path.join(d, 'thema/travel.css'), '\n@layer rtg.thema{[data-rtg-world="travel"]{--ds-radius-inhoud:0}}\n')), /niet in contract.themabaar/);
});

test('contract: een component raakt alleen zijn eigen klassen', () => {
  assert.match(kopieMet(d => fs.appendFileSync(path.join(d, 'componenten/knop.css'), '\n@layer rtg.component{button{cursor:pointer}}\n')), /selector "button"/);
});

test('contract: een component leest geen primitief token', () => {
  assert.match(kopieMet(d => fs.appendFileSync(path.join(d, 'componenten/knop.css'), '\n@layer rtg.component{.ds-knop{color:var(--ds-p-bordeaux)}}\n')), /primitief token/);
});

test('contract: een @import van buiten public/ds/ haalt erfenis binnen', () => {
  assert.match(kopieMet(d => fs.appendFileSync(path.join(d, 'rtg-ds.css'), '\n@import url("../shared/rtg-heritage.css");\n')), /van buiten public\/ds/);
});

test('contract: een script van het systeem spuit geen stijl en haalt geen erfenis binnen', () => {
  assert.match(kopieMet(d => fs.appendFileSync(path.join(d, 'shell.js'), "\nvar s=document.createElement('style');\n")), /zet zelf stijl/);
  assert.match(kopieMet(d => fs.appendFileSync(path.join(d, 'shell.js'), "\nel.style.color='red';\n")), /zet zelf stijl/);
  assert.match(kopieMet(d => fs.appendFileSync(path.join(d, 'shell.js'), "\nl.href='/shared/rtg-heritage.css';\n")), /buiten public\/ds/);
});

test('contract: elk schermtype, component en wereld uit het contract bestaat', () => {
  assert.match(kopieMet(d => fs.rmSync(path.join(d, 'schermen/canvas.css'))), /schermtype canvas/);
  const contract = JSON.parse(fs.readFileSync(path.join(DS, 'contract.json'), 'utf8'));
  assert.deepEqual(contract.schermtypen, ['cover', 'collectie', 'taak', 'detail', 'gesprek', 'canvas', 'status']);
  assert.equal(contract.talen.length, 19);
});

test('contract: een ds-scherm zonder browsertoets, met erfenis of met een vreemde injecteur', () => {
  const pagina = (extra) => ({ paginas: { 'public/apps/nep.html': { ds: true, erfenis: 0, stijlblok: false, injecteert: [], bladen: [], ...extra } } });
  assert.match(os_.contractFouten(pagina({}), DS).join(), /zonder browsertoets/);
  assert.match(os_.contractFouten(pagina({ erfenis: 1, bladen: ['public/shared/rtg-heritage.css'] }), DS).join(), /erfenisblad/);
  assert.match(os_.contractFouten(pagina({ injecteert: ['public/shared/ios.js'] }), DS).join(), /ios\.js, dat zelf stijl injecteert/);
});

test('rtg-ds.css laadt elk bestand van het systeem precies één keer', () => {
  const ingang = fs.readFileSync(path.join(DS, 'rtg-ds.css'), 'utf8');
  const geladen = [...ingang.matchAll(/@import url\("([^"]+)"\)/g)].map(m => m[1]).sort();
  const bestaand = [];
  (function loop(map, voor) {
    for (const n of fs.readdirSync(map)) {
      const v = path.join(map, n);
      if (fs.statSync(v).isDirectory()) loop(v, voor + n + '/');
      else if (n.endsWith('.css') && n !== 'rtg-ds.css') bestaand.push(voor + n);
    }
  })(DS, '');
  assert.deepEqual(geladen, bestaand.sort());
  assert.match(ingang, /@layer rtg\.reset, rtg\.tokens, rtg\.thema, rtg\.component, rtg\.scherm;/);
});

test('de echte boom: geen schendingen van ratel of contract', () => {
  const r = spawnSync(process.execPath, [path.join(WORTEL, 'scripts/ontwerpsysteem.js'), '--controle'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});
