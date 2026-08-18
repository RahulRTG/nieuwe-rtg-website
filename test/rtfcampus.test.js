/* De ene RTF Campus mag niet langzaam weer uiteenvallen in losse voordeuren.
   Deze toets bewaakt dat de Campus haar volledige, leeftijdsgefilterde aanbod
   uit de centrale App-Bibliotheek haalt en elk onderdeel in dezelfde schil
   opent. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { APPS, CATEGORIEEN } = require('../server/kern/rtfbieb');

const PAD = path.join(__dirname, '..', 'public', 'apps', 'foundation', 'campus.html');
const campus = fs.readFileSync(PAD, 'utf8');

test('1. de Campus laadt de hele beveiligde catalogus, ook als die meerdere paginas heeft', () => {
  assert.match(campus, /fetch\('\/api\/rtf\/bieb\/catalogus'/);
  assert.match(campus, /pagina,per:48/);
  assert.match(campus, /do\{[^]*biebPagina\(s,p\+\+\)[^]*\}while\(p<=d\.paginas\)/);
});

test('2. iedere cataloguscategorie landt in een zichtbare Campuswereld', () => {
  const bron = /const WERELD=(\{[^\n]+\});/.exec(campus);
  assert.ok(bron, 'de Campuswereld-indeling ontbreekt');
  const werelden = vm.runInNewContext('(' + bron[1] + ')');
  const gekoppeld = new Set(Object.values(werelden).flatMap(w => w.cats));
  const mist = CATEGORIEEN.map(c => c.id).filter(id => !gekoppeld.has(id));
  assert.deepEqual(mist, [], 'deze cataloguscategorieen zijn niet verbonden met de Campus');

  /* EN DE ANDERE KANT OP, want die ontbrak en dat is de helft die stukgaat.

     Hierboven staat: elke categorie heeft een wereld. Wat er niet stond is:
     elke wereld wijst een categorie aan die BESTAAT. Die asymmetrie is geen
     detail -- verdwijnt er een categorie uit de catalogus, dan blijft de
     Campuswereld ernaar verwijzen en toont hij een lege of kapotte tegel,
     terwijl deze toets vrolijk groen blijft. Nagemeten: een categorie uit
     server/kern/rtfappcatalogus-data.js halen werd niet opgemerkt.

     Nu wel, en daarmee bijt de toets op de fout die hij zegt te bewaken. */
  const bestaat = new Set(CATEGORIEEN.map(c => c.id));
  const wees = [...gekoppeld].filter(id => !bestaat.has(id));
  assert.deepEqual(wees, [], 'deze Campuswerelden wijzen naar een categorie die niet in de catalogus staat');
});

test('3. Game Hall en Magnaat zijn echte catalogusonderdelen achter dezelfde leeftijdspoort', () => {
  const spel = APPS.filter(a => a.categorie === 'spelen');
  assert.deepEqual(spel.map(a => a.sleutel).sort(), ['magnaat', 'speelhal']);
  for (const app of spel) {
    assert.equal(app.doelgroep, 'kind');
    assert.match(campus, new RegExp(app.sleutel === 'magnaat' ? 'open=magnaat' : 'speelhal\\.html'));
  }
});

test('4. apps openen binnen dezelfde Campus-schil', () => {
  assert.match(campus, /<iframe id="frame"/);
  assert.match(campus, /function open\(url, naam\)/);
  assert.match(campus, /bindOpen\(document\.getElementById\('ecoGrid'\)\)/);
});
