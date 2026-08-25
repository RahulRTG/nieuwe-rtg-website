/* DE CEL EN DE POORT, zonder server: de invarianten die je aan de code zelf
   kunt zien. Ze staan apart van test/appstore.test.js omdat ze in milliseconden
   draaien en omdat ze iets ANDERS bewaken: daar gaat het om wat er over de lijn
   gebeurt, hier om wat er in de bron NIET mag staan.

   Draai los: node --test test/appstore-cel.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { keur, BUDGET } = require('../server/kern/appstore/keuring');
const { neem, versiehash } = require('../server/kern/appstore/bundel');
const { lees } = require('../server/kern/appstore/manifest');
const { MACHTIGINGEN, NIET_GEBOUWD } = require('../server/kern/appstore/machtigingen');

const lees_ = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const AV = { scan: () => ({ verdict: 'schoon', redenen: [] }), definities: () => [] };
const B = (pad, s) => ({ pad, buf: Buffer.from(s) });
const MAN = { start: 'index.html', icoon: null };

test('1. de cel krijgt precies EEN sandbox-vlag, en camera noch microfoon', () => {
  const s = lees_('public/apps/appcel.html');
  const kader = /<iframe\b[^>]*>/.exec(s);
  assert.ok(kader, 'het kader staat in de markup en niet in een script, zodat de lijst er als een waarde staat');
  const sandbox = /\bsandbox="([^"]*)"/.exec(kader[0]);
  assert.ok(sandbox, 'en het draagt een sandbox');
  assert.equal(sandbox[1], 'allow-scripts',
    'elke vlag erbij geeft de cel iets terug wat hij niet hoort te hebben; de vlag die de herkomst teruggeeft, geeft hem de sessie van het lid');
  /* Overal elders in dit huis krijgt een kader RTGMedia.kader() mee, dat camera
     en microfoon doorgeeft. Hier is het omgekeerde de bedoeling: dat zijn geen
     rechten die een lid ooit heeft verleend -- de machtigingencatalogus kent ze
     niet eens -- dus staat er een LEEG allow, hardop, op de plek waar iemand het
     zou willen aanvullen. */
  assert.match(kader[0], /\ballow=""/, 'het kader geeft geen enkel apparaatrecht door aan een derde');
  /* Ook nergens anders in het bestand, ook niet in een string die iemand later
     als tweede plek gebruikt. Dit is grens 1 en die kent geen uitzondering. */
  assert.ok(!/allow-same-origin/.test(s), 'de vlag die de herkomst teruggeeft komt in dit bestand niet voor');
  assert.ok(/e\.source\s*!==\s*frame\.contentWindow/.test(s),
    'de brug gelooft alleen het venster dat hij zelf heeft gemaakt -- een naamloze herkomst heeft geen naam om op te controleren');
});

test('2. de cel-CSP zet alles dicht en doet er stuk voor stuk iets bij', () => {
  const s = lees_('server/routes/appstore/cel.js');
  for (const eis of ["default-src 'none'", "connect-src 'none'", "form-action 'none'",
    "base-uri 'none'", "object-src 'none'", 'sandbox allow-scripts']) {
    assert.ok(s.includes(eis), 'de cel-CSP mist ' + eis);
  }
  assert.ok(!/script-src[^;]*unsafe-inline/.test(s), 'scripts krijgen nooit unsafe-inline in de cel');
  assert.ok(/immutable/.test(s), 'de hash staat in het pad, dus de bundel is voorgoed te bewaren -- dat is de snelheidsbelofte');
  assert.ok(/Cross-Origin-Resource-Policy', 'cross-origin'/.test(s),
    'de cel moet de CORP van opzet/koppen.js loslaten: een naamloze herkomst is voor de browser een andere herkomst, en same-origin blokkeert dan de eigen bundel van de app');
});

test('3. de brug raakt de identiteitskluis niet, ook niet met een omweg', () => {
  const s = lees_('server/kern/appstore/brug.js');
  assert.ok(!/require\(.*accounts/.test(s), 'de brug heeft geen verwijzing naar de identiteitskluis, zodat een naam er niet KAN uitkomen');
  assert.ok(!/\bemail\b|\btelefoon\b|geboortedatum/.test(s.replace(/\/\*[\s\S]*?\*\//g, '')),
    'buiten het commentaar komen die velden er niet in voor');
});

test('4. de poort vindt de verboden vormen, met bestand en regel', () => {
  const kwaad = [
    ['fetch("/x")', 'fetch()'], ['new WebSocket("x")', 'WebSocket'], ['eval("1")', 'eval()'],
    ['new Function("a")', 'new Function()'], ['document.write("x")', 'document.write()'],
    ['parent.postMessage({},"*")', 'parent/top'], ['import("./x.js")', 'dynamische import()'],
    ['navigator.sendBeacon("/x")', 'navigator.sendBeacon'], ['importScripts("x")', 'importScripts()'],
    ['document.cookie = "a=1"', 'document.cookie'], ['navigator.serviceWorker.register("x")', 'navigator.serviceWorker']
  ];
  for (const [code, naam] of kwaad) {
    const r = keur({ antivirus: AV, manifest: MAN, bestanden: [B('index.html', '<html></html>'), B('a.js', '\n' + code + ';\n')] });
    assert.equal(r.door, false, code + ' hoort tegengehouden te worden');
    const b = r.bevindingen.find(x => x.wat === naam);
    assert.ok(b, code + ' -> verwachtte bevinding "' + naam + '", kreeg: ' + r.bevindingen.map(x => x.wat).join(', '));
    assert.equal(b.bestand, 'a.js');
    assert.equal(b.regel, 2, 'met het juiste regelnummer');
    assert.ok(b.hoe && b.hoe.length > 20, 'en met de weg eruit');
  }
});

test('5. een gewone, correcte app komt er gewoon doorheen', () => {
  const r = keur({ antivirus: AV, manifest: MAN, bestanden: [
    B('index.html', '<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>x</title>' +
      '<link href="s.css" rel="stylesheet"></head><body><p id="a">0</p><script src="app.js"></script></body></html>'),
    B('app.js', 'document.getElementById("a").addEventListener("click", function () {\n  RTG.roep("opslag.lijst");\n});\n'),
    B('s.css', 'body{color:#111;background:url(pixel.png);}'),
    B('pixel.png', 'x')
  ] });
  assert.equal(r.door, true, 'onterecht tegengehouden: ' + r.bevindingen.map(b => b.wat + '@' + b.bestand).join(', '));
});

test('6. de bundel laat geen pad buiten zichzelf toe', () => {
  for (const pad of ['../x.js', '/etc/passwd', 'a/../../b.js', 'a\\b.js', 'x.exe', 'x.wasm', 'a/b/c/d/e.js', 'X.JS']) {
    assert.equal(neem([{ pad, inhoud: 'x' }]).ok, false, 'pad "' + pad + '" hoort geweigerd te worden');
  }
  assert.equal(neem([{ pad: 'a/b/c.js', inhoud: 'x' }]).ok, true, 'drie mappen diep mag wel');
});

test('7. dezelfde bytes geven dezelfde hash, andere bytes een andere', () => {
  const een = neem([{ pad: 'a.js', inhoud: 'x' }, { pad: 'b.js', inhoud: 'y' }]).bestanden;
  const twee = neem([{ pad: 'b.js', inhoud: 'y' }, { pad: 'a.js', inhoud: 'x' }]).bestanden;
  assert.equal(versiehash(een), versiehash(twee), 'de volgorde van insturen doet er niet toe');
  const drie = neem([{ pad: 'a.js', inhoud: 'y' }, { pad: 'b.js', inhoud: 'x' }]).bestanden;
  assert.notEqual(versiehash(een), versiehash(drie), 'dezelfde bytes op een ander pad zijn een andere app');
});

test('8. het manifest weigert onbekende velden en noemt de reden bij een machtiging die niet bestaat', () => {
  const goed = { sleutel: 'x-app', naam: 'App X', versie: '1.0.0', categorie: 'leven',
    uitleg: 'Een app die iets doet en dat hier in gewone taal uitlegt.' };
  assert.equal(lees(goed).ok, true);
  assert.equal(lees(Object.assign({ homepage: 'https://x.nl' }, goed)).ok, false, 'geen URL-velden in een manifest');
  for (const soort of Object.keys(NIET_GEBOUWD)) {
    const r = lees(Object.assign({ machtigingen: [soort + '.iets'] }, goed));
    assert.equal(r.ok, false);
    assert.equal(r.fouten[0].wat.includes(NIET_GEBOUWD[soort]), true, 'de reden bij "' + soort + '" hoort in de fout te staan');
  }
});

test('9. het budget houdt tegen wat de telefoon van een lid zou laten wachten', () => {
  const groot = keur({ antivirus: AV, manifest: MAN, bestanden: [
    B('index.html', '<html></html>'), B('a.js', 'x'.repeat(BUDGET.script + 1)) ] });
  assert.equal(groot.door, false);
  assert.ok(groot.bevindingen.some(b => /scriptcode/.test(b.wat)));
});

test('10. een ontbrekende virusscanner laat de poort DICHT gaan, niet open', () => {
  const r = keur({ antivirus: null, manifest: MAN, bestanden: [B('index.html', '<html></html>')] });
  assert.equal(r.door, false, 'een controle die er niet is, is geen stilzwijgend ja');
  assert.match(r.bevindingen[0].wat, /virusscanner/);
});

test('11. elke machtiging draagt zowel wat hij geeft als wat hij nooit geeft', () => {
  for (const m of MACHTIGINGEN) {
    assert.ok(m.geeft && m.geeft.length > 10, m.id + ' zegt wat hij geeft');
    assert.ok(m.nooit && m.nooit.length > 10, m.id + ' zegt ook wat hij NOOIT geeft -- een toestemmingsscherm dat alleen het eerste zegt, is een verkooppraatje');
  }
});
