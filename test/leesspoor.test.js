/* HET LEESSPOOR: DE KANTEN DIE GEEN REQUIRE ACHTERLAAT.

   scripts/lib/bewijsgraaf.js leidt af wat een toets raakt uit zijn requires. Dat
   is exact voor code die wordt GEIMPORTEERD en blind voor code die wordt
   GELEZEN. Vijfenvijftig toetsbestanden lopen een map af, en test/ast-grens.test.js
   is het scherpste geval: de graaf kende er vier afhankelijkheden, gemeten leest
   hij er 505 -- waarvan 495 onder server/routes/, precies de bestanden waar de
   beveiligingsregel over gaat. Een wijziging in zo'n route selecteerde die toets
   dus niet. Dat is geen traagheid maar een GAT in de planner, en het is precies
   het soort gat dat niemand ziet: de toets draait gewoon niet, en er staat geen
   rode regel over.

   Deze toets bewaakt drie dingen, en het derde is waar het om gaat:

     1. de voorlader schrijft wat er onder de repo wordt gelezen, en NIETS
        daarbuiten (een spoor dat /etc leest, is een lek en geen meting)
     2. het samenvoegen bewaart alleen het VERSCHIL met wat de graaf al weet, en
        het register GROEIT -- er wordt nooit een kant weggehaald
     3. de graaf gebruikt die kanten ook echt: een toets met een waargenomen
        leesbestand hoort geselecteerd te worden als dat bestand verandert

   De mutatie die erbij hoort staat in de laatste toets: zonder register kiest de
   planner deze toets NIET bij een wijziging in server/routes/. Dat is dezelfde
   bewering, van de andere kant -- en zonder haar zou dit alles ook groen staan
   als het register niets deed. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const WORTEL = path.join(__dirname, '..');
const VOORLADER = path.join(WORTEL, 'scripts', 'lib', 'leesspoor.js');

function versSpoor() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-spoor-')), 'spoor.jsonl');
}
function regelsVan(pad) {
  let ruw = '';
  try { ruw = fs.readFileSync(pad, 'utf8'); } catch (e) { return []; }
  return ruw.split('\n').filter(Boolean).map(r => JSON.parse(r));
}

test('de voorlader schrijft wat er ONDER de repo wordt gelezen, en niets daarbuiten', (t) => {
  const spoor = versSpoor();
  t.after(() => { try { fs.rmSync(path.dirname(spoor), { recursive: true, force: true }); } catch (e) {} });
  execFileSync(process.execPath, ['--require', VOORLADER, '-e', `
    const fs = require('fs');
    fs.readFileSync('package.json', 'utf8');          // relatief pad binnen de repo
    fs.readdirSync(${JSON.stringify(path.join(WORTEL, 'scripts', 'ast'))});
    fs.readFileSync('/etc/hostname', 'utf8');          // BUITEN de repo
    try { fs.readFileSync(${JSON.stringify(path.join(WORTEL, 'server', 'data', 'db.json'))}, 'utf8'); } catch (e) {}
  `], { cwd: WORTEL, env: Object.assign({}, process.env, { RTG_LEESSPOOR: spoor, RTG_TOETS: 'proef.test.js' }) });

  const paden = regelsVan(spoor).map(r => r.p);
  assert.ok(paden.includes('package.json'),
    'een RELATIEF pad hoort mee te tellen: de loper draait met de repowortel als werkmap, en dat ' +
    'is de meerderheid van de lezingen. De eerste versie sloeg ze allemaal over.');
  assert.ok(paden.includes('scripts/ast'), 'een maplezing hoort ook in het spoor');
  assert.ok(!paden.some(p => /etc|hostname/.test(p)),
    'een pad BUITEN de repo hoort er niet in: dat is geen afhankelijkheid maar een lek in de meting');
  assert.ok(!paden.some(p => p.startsWith('server/data/')),
    'server/data is de runtime-map van een installatie; die verandert bij elke rit en zou elke toets ' +
    'van elke andere afhankelijk maken');
  assert.ok(regelsVan(spoor).every(r => r.t === 'proef.test.js'), 'elke regel staat op naam van de toets');
});

test('een kindproces schrijft op naam van de TOETS die het startte', (t) => {
  const spoor = versSpoor();
  t.after(() => { try { fs.rmSync(path.dirname(spoor), { recursive: true, force: true }); } catch (e) {} });
  /* Een toets die zijn server ZELF start (niet via test/helper.js, dat RTG_TOETS
     meegeeft) leverde eerst een spoor op naam van "server.js" op: 3515 gelezen
     bestanden die bij geen enkele toets hoorden en dus nergens terechtkwamen. */
  const nep = path.join(path.dirname(spoor), 'zz-nep.test.js');
  fs.writeFileSync(nep, `
    require(${JSON.stringify(VOORLADER)});
    const { execFileSync } = require('child_process');
    execFileSync(process.execPath, ['--require', ${JSON.stringify(VOORLADER)}, '-e',
      "require('fs').readFileSync('package.json','utf8')"], { cwd: ${JSON.stringify(WORTEL)} });
  `);
  execFileSync(process.execPath, [nep], { cwd: WORTEL,
    env: Object.assign({}, process.env, { RTG_LEESSPOOR: spoor, RTG_TOETS: '' }) });
  const namen = new Set(regelsVan(spoor).map(r => r.t));
  assert.ok(namen.has('zz-nep.test.js'),
    'het kind hoort op naam van de toets te schrijven, niet op zijn eigen bestandsnaam; ' +
    'anders belandt het spoor van elke zelfgestarte server in een bak die nergens bij hoort. ' +
    'Gezien: ' + [...namen].join(', '));
});

test('het register groeit en verliest nooit een kant', (t) => {
  const REG = path.join(WORTEL, 'LEESSPOOR.json');
  assert.ok(fs.existsSync(REG), 'er hoort een LEESSPOOR.json te staan; zonder register meet dit niets');
  const r = JSON.parse(fs.readFileSync(REG, 'utf8'));
  assert.ok(r.gemeten.kantenTotaal > 0, 'een register met nul kanten is een kapotte meting, geen schone lei');
  assert.ok(r.rondes >= 1);
  /* Elke kant is een BRONbestand dat de planner kan wegen. Een pad naar een
     tijdelijke map of naar node_modules zou de graaf vervuilen met iets waar
     niemand ooit een wijziging in maakt. */
  for (const [toets, lijst] of Object.entries(r.toetsen)) {
    assert.match(toets, /\.(test|e2e)\.js$/, 'een sleutel hoort een toetsbestand te zijn: ' + toets);
    for (const p of lijst) assert.match(p, /^(server|scripts|public|test)\//,
      toets + ' heeft een kant naar iets buiten de bron: ' + p);
  }
});

test('het spoor VOEGT alleen kanten toe: geen toets verlaat de bak "draait altijd"', () => {
  /* De veilige bak. Een toets in `altijd` wordt door de planner nooit
     overgeslagen, en dat oordeel hoort UITSLUITEND uit de statische sluiting te
     komen. Zou een waarneming meetellen, dan zou een toets met nul requires maar
     wel gemeten lezingen uit die bak KLIMMEN -- van "draait altijd" naar "draait
     soms", op grond van een ondergrens. Dan haalt de meting een garantie weg in
     plaats van er een toe te voegen.

     Ik had dat zelf eerst fout: de kanten stonden erbij voordat het oordeel viel.
     Deze bewering is de reden dat het opviel. */
  const { graaf } = require('../scripts/lib/bewijsgraaf.js');
  const met = graaf();
  const zonder = graaf({ zonderSpoor: true });
  assert.deepEqual(met.altijd, zonder.altijd,
    'het leesspoor hoort de bak "draait altijd" ONGEMOEID te laten. Wordt hij kleiner, dan slaat de ' +
    'planner voortaan toetsen over omdat een MEETRONDE toevallig een pad niet nam.');
  for (const [naam, d] of met.perToets) {
    const z = zonder.perToets.get(naam);
    assert.equal(d.soort, z.soort, naam + ': het soort hoort niet van een waarneming af te hangen');
    assert.equal(d.volledig, z.volledig, naam + ': volledigheid is een statische vraag');
    assert.ok(d.bestanden.length >= z.bestanden.length,
      naam + ': het spoor mag alleen kanten TOEVOEGEN (' + d.bestanden.length + ' tegen ' + z.bestanden.length + ')');
  }
});

test('de graaf gebruikt de waargenomen kanten -- en zonder register mist hij ze', () => {
  const { graaf } = require('../scripts/lib/bewijsgraaf.js');
  const reg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'LEESSPOOR.json'), 'utf8'));
  /* Een toets uit het register pakken en er een bestand van kiezen dat hij
     aantoonbaar LAS. Geen verzonnen voorbeeld: dit is gemeten. */
  const [toets, lijst] = Object.entries(reg.toetsen).sort((a, b) => b[1].length - a[1].length)[0];
  const bestand = lijst.find(p => p.startsWith('server/'));
  assert.ok(bestand, 'de zwaarste toets in het register hoort een serverbestand te hebben gelezen');

  const met = graaf();
  const zonder = graaf({ zonderSpoor: true });
  const raaktMet = (met.perBestand.get(bestand) || []).includes(toets);
  const raaktZonder = (zonder.perBestand.get(bestand) || []).includes(toets);
  const altijdZonder = zonder.altijd.includes(toets);

  assert.equal(raaktMet, true,
    toets + ' leest ' + bestand + ' aantoonbaar, dus een wijziging daarin hoort hem te selecteren');
  /* DE MUTATIE, en zonder haar bewijst het bovenstaande niets: als de graaf hem
     OOK zonder register al koos, dan doet dit hele register er niet toe. */
  assert.equal(raaktZonder || altijdZonder, false,
    'zonder het register hoort ' + toets + ' NIET bij ' + bestand + ' gekozen te worden. ' +
    'Wordt hij dat wel, dan sluit dit register een gat dat er niet was en meet deze toets niets.');
});
