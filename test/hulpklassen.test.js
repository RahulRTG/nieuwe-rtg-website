/* ELKE HULPKLASSE DRAAGT PRECIES DE WAARDE DIE HIJ VERVANGT.

   scripts/hulpklassen-omzet.js ruilt een style="margin-top:0.6rem" in voor
   class="h-mt60". Dat is alleen gedragsneutraal als .h-mt60 ook echt
   margin-top:0.6rem zet. Staat er 0.65rem, of ontbreekt de klasse, dan
   verschuift de opmaak op honderd plekken tegelijk en ziet niemand het -- er is
   geen toets in dit huis die opmaak vergelijkt.

   Deze toets legt de omzettabel naast het stijlblad. Hij is er dus niet om de
   CSS te toetsen maar om de KOPPELING te toetsen: twee bestanden die hetzelfde
   moeten zeggen (LAT.md regel 4, maar dan tussen een script en een stijlblad).

   Draai los: node --experimental-sqlite --test test/hulpklassen.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { KLASSE, normaliseer, zetOm } = require('../scripts/hulpklassen-omzet.js');

const WORTEL = path.join(__dirname, '..');
const CSS = fs.readFileSync(path.join(WORTEL, 'public/shared/rtg-hulpklassen.css'), 'utf8');

test('elke klasse uit de omzettabel bestaat, met exact de waarde die hij vervangt', () => {
  const mist = [];
  for (const [waarde, klasse] of Object.entries(KLASSE)) {
    const regel = new RegExp('\\.' + klasse + '\\s*\\{([^}]*)\\}').exec(CSS);
    if (!regel) { mist.push(klasse + ': staat niet in het stijlblad'); continue; }
    const gezet = normaliseer(regel[1].replace(/!important/g, ''));
    if (gezet !== waarde) mist.push(klasse + ': zet ' + gezet + ', vervangt ' + waarde);
  }
  assert.deepEqual(mist, [],
    'deze hulpklassen zeggen iets anders dan het attribuut dat ze vervangen');
});

test('elke hulpklasse wint van gewone CSS, net als het attribuut deed', () => {
  for (const klasse of Object.values(KLASSE)) {
    const regel = new RegExp('\\.' + klasse + '\\s*\\{([^}]*)\\}').exec(CSS);
    assert.ok(regel && /!important/.test(regel[1]),
      klasse + ' mist !important; dan kan een gewone regel hem verslaan terwijl het ' +
      'style-attribuut altijd won, en verschuift de opmaak stilzwijgend');
  }
});

test('de omzetting laat een samengestelde stijl met rust', () => {
  const bron = '<div style="margin-top:0.5rem;font-size:0.8rem">x</div>';
  assert.equal(zetOm(bron).raak, 0, 'half omzetten zou de regel op twee plekken zetten');
  assert.equal(zetOm(bron).uit, bron);
});

test('de omzetting voegt de klasse toe aan een bestaande class', () => {
  const r = zetOm('<div class="card" style="margin-top:.5rem;">x</div>');
  assert.equal(r.raak, 1);
  assert.equal(r.uit, '<div class="card h-mt50">x</div>');
});

test('en maakt er een als de tag er nog geen heeft', () => {
  const r = zetOm('<span style="flex:1">x</span>');
  assert.equal(r.uit, '<span class="h-flex1">x</span>');
});

test('.5rem en 0.5rem zijn dezelfde waarde', () => {
  assert.equal(normaliseer('margin-top:.5rem;'), 'margin-top:0.5rem');
  assert.equal(normaliseer(' margin-top: 0.5rem '), 'margin-top:0.5rem');
  assert.equal(zetOm('<i style="margin-top:.5rem"></i>').uit, '<i class="h-mt50"></i>');
});

/* DE TEGENPROEF, en die gaat over de ergste fout die dit script kan maken: een
   tweede class-attribuut op dezelfde tag. De browser leest dan de eerste en de
   marge verdwijnt zonder dat er iets zakt. */
test('DE TEGENPROEF: een tag met twee class-attributen blijft ongemoeid', () => {
  const bron = '<div class="a" data-x="1" class="b" style="flex:1">x</div>';
  const r = zetOm(bron);
  assert.equal(r.raak, 0);
  assert.equal(r.overgeslagen, 1);
  assert.equal(r.uit, bron);
});

test('DE TWEEDE TEGENPROEF: een tag die op deze regel niet afgemaakt is, blijft staan', () => {
  const bron = "html += '<div class=\"card\" style=\"flex:1\"' +\n  ' data-id=\"' + id + '\">';";
  assert.equal(zetOm(bron).raak, 0, 'zonder sluitteken op dezelfde regel weet dit script niet wat de tag draagt');
});

/* DE KETEN, en waarom die apart getoetst hoort te worden.

   Het stijlblad lag op EEN van de 259 pagina's. Sinds het via @import in
   rtg-ui.css hangt ligt het op 231 -- maar op geen van die 231 staat de naam in
   de HTML. Een keuring die alleen naar de <link>-tags kijkt noemde daardoor 146
   pagina's kaal terwijl de browser de klassen gewoon laadt. Precies dezelfde
   fout als een meter die een proxy telt in plaats van het ding zelf, en daarom
   staat de zeef nu op EEN plek (scripts/lib/hulpcss.js) waar zowel check.js
   regel 37 als de omzetter uit leest. */
const os = require('os');
const { paginaDraagt, cssDraagt } = require('../scripts/lib/hulpcss.js');

function metBoom(bestanden, doe) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-hulpcss-'));
  try {
    for (const [rel, inhoud] of Object.entries(bestanden)) {
      const p = path.join(dir, rel);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, inhoud);
    }
    return doe(dir);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('een pagina die het stijlblad zelf noemt, draagt het', () => {
  metBoom({ 'a.html': '<link href="/shared/rtg-hulpklassen.css">' }, (dir) =>
    assert.equal(paginaDraagt(fs.readFileSync(path.join(dir, 'a.html'), 'utf8'), path.join(dir, 'a.html'), dir), true));
});

test('EN DIT IS DE REPARATIE: via een @import telt hij ook mee', () => {
  metBoom({
    'a.html': '<link rel="stylesheet" href="/shared/ui.css">',
    'shared/ui.css': "@import url('/shared/rtg-hulpklassen.css');\nbody{margin:0}",
    'shared/rtg-hulpklassen.css': '.h-mt50{margin-top:0.5rem !important;}'
  }, (dir) => assert.equal(paginaDraagt(fs.readFileSync(path.join(dir, 'a.html'), 'utf8'), path.join(dir, 'a.html'), dir), true,
    'de browser laadt hem, dus de keuring hoort hem te zien'));
});

test('DE TEGENPROEF: een pagina zonder de keten draagt hem niet', () => {
  metBoom({
    'a.html': '<link rel="stylesheet" href="/shared/anders.css">',
    'shared/anders.css': 'body{margin:0}'
  }, (dir) => assert.equal(paginaDraagt(fs.readFileSync(path.join(dir, 'a.html'), 'utf8'), path.join(dir, 'a.html'), dir), false,
    'zonder deze regel zou de omzetter marges weghalen op een pagina zonder klassen'));
});

test('DE TWEEDE TEGENPROEF: te diep genest telt als NIET gedekt, niet als wel', () => {
  metBoom({
    'a.css': "@import url('/b.css');", 'b.css': "@import url('/c.css');",
    'c.css': "@import url('/d.css');", 'd.css': '.h-mt50{margin-top:0.5rem !important;}'
  }, (dir) => assert.equal(cssDraagt(path.join(dir, 'a.css'), dir, 0), false,
    'de veilige kant: de omzetter laat het bestand met rust in plaats van te gokken'));
});

test('een stijlblad dat niet bestaat, draagt niets (en gooit niet)', () => {
  metBoom({ 'a.html': '<link rel="stylesheet" href="/weg.css">' }, (dir) =>
    assert.equal(paginaDraagt('<link rel="stylesheet" href="/weg.css">', path.join(dir, 'a.html'), dir), false));
});
