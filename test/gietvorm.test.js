/* DE GIETVORM MOET DEZELFDE INSTALLATIE OPLEVEREN, NIET EEN SNELLERE BIJNA.

   scripts/vorm.js zet een verse datamap een keer klaar en giet die in elke toets
   die er recht op heeft. Dat scheelt 566 ms per serverstart over 468 van de 673
   toetsbestanden. Maar een vorm die stilletjes IETS ANDERS oplevert dan zelf
   zaaien geeft geen fout -- hij geeft een verkeerd antwoord, en dan is elke
   groene uitslag daarna waardeloos. Vandaar deze toets, en vandaar dat hij twee
   echte servers naast elkaar zet in plaats van de code te lezen.

   DAT IS GEEN THEORETISCH GEVAAR. Deze vergelijking vond bij zijn eerste
   uitvoering een echt verschil: rijkVoertuigen stond op 0 bij een server die
   zelf zaaide en op 6 bij een gegoten server. De vorm had gelijk; de VOLGORDE
   van de boot was fout. kern.overheid.registreerVloot() stond in opzet/
   kernlaag2.js en las daar db.data.suppliers -- op dat moment twaalf zaken, want
   de 65 demozaken komen pas later uit initRealtime(). Een verse installatie had
   dus een leeg RDW-register tot iemand toevallig de huurroute raakte (die roept
   hem nog eens aan, en daarom viel het nooit op). Nu staat hij in
   opzet/opslagstart.js, na de zaai.

   Wat deze toets NIET kan: bewijzen dat er nergens een verschil zit dat zich
   niet in de vorm van een collectie laat zien. Hij vergelijkt de namen, de
   omvang en de VELDNAMEN van alle 142 collecties -- niet de inhoud, want die
   bevat willekeurige id's en die verschillen tussen twee onafhankelijke zaaiingen
   sowieso. Dat is de eerlijke grens van deze meting. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { startServer, stopNet } = require('./helper');
const vorm = require('../scripts/vorm.js');

const WORTEL = path.join(__dirname, '..');

function verseMap() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vormtoets-')); }
function weg(d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} }

/* DE VORM VAN EEN DATAMAP: per collectie de omvang EN de veldnamen.

   Alleen de omvang zou het rijkVoertuigen-verschil hebben gevonden (0 tegen 6)
   en een collectie met evenveel maar ANDERS gevulde rijen niet. De veldnamen
   erbij vangen dat wel, en ze zijn stabiel tussen twee zaaiingen -- in
   tegenstelling tot de waarden, waar willekeurige id's in zitten. */
function vormVan(map) {
  const uit = execFileSync(process.execPath, ['--experimental-sqlite', '-e', `
    const db = require(${JSON.stringify(path.join(WORTEL, 'server', 'db'))});
    db.load();
    const d = db.db.data || {};
    const velden = (rijen) => {
      const s = new Set();
      for (const r of rijen.slice(0, 200)) if (r && typeof r === 'object' && !Array.isArray(r))
        for (const k of Object.keys(r)) s.add(k);
      return [...s].sort().join(',');
    };
    const uit = {};
    for (const k of Object.keys(d).sort()) {
      const v = d[k];
      if (Array.isArray(v)) uit[k] = 'arr:' + v.length + '|' + velden(v);
      else if (v && typeof v === 'object') uit[k] = 'obj:' + Object.keys(v).length + '|' + velden(Object.values(v));
      else uit[k] = typeof v;
    }
    process.stdout.write(JSON.stringify(uit));
    process.exit(0);
  `], {
    cwd: WORTEL, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, RTG_DATA_DIR: map, NODE_ENV: 'test', RTG_DEMO: '1' }
  });
  return JSON.parse(uit);
}

test('de gietvorm levert dezelfde installatie op als zelf zaaien', async (t) => {
  const vers = verseMap();          // deze zaait zelf
  const gegoten = verseMap();       // deze krijgt de vorm
  t.after(() => { weg(vers); weg(gegoten); });

  /* De vorm moet er zijn. Ontbreekt hij, dan is er NIETS te vergelijken en hoort
     deze toets over te slaan in plaats van groen te worden op een lege meting --
     dat is precies de vorm waar LAT-regel 10 voor waarschuwt. */
  await vorm.maakVorm();
  assert.ok(vorm.erIsEenVorm(), 'er hoort na maakVorm() een vorm te staan');

  const a = await startServer({ env: { RTG_DATA_DIR: vers, SMTP_URL: '' }, geenVorm: true });
  const b = await startServer({ env: { RTG_DATA_DIR: gegoten, SMTP_URL: '' } });
  assert.ok(fs.readdirSync(gegoten).includes('store.db'), 'de vorm hoort in de map van b te zijn gegoten');

  /* NET stoppen, niet hard: anders krijgt de write-behind geen kans en
     vergelijken we twee half weggeschreven installaties met elkaar. */
  await stopNet(a.child, 20000);
  await stopNet(b.child, 20000);

  const va = vormVan(vers), vb = vormVan(gegoten);
  const ka = Object.keys(va), kb = Object.keys(vb);
  assert.ok(ka.length > 100, 'er horen ruim honderd collecties te zijn, niet ' + ka.length);
  assert.deepEqual(kb, ka, 'de gegoten installatie hoort exact dezelfde collecties te hebben');
  const anders = ka.filter(k => va[k] !== vb[k]);
  assert.deepEqual(anders.map(k => k + ': zelf ' + va[k] + '  vorm ' + vb[k]), [],
    'een collectie ziet er in de gegoten installatie anders uit dan in een zelfgezaaide. ' +
    'Dat is geen versnelling meer maar een ander product: repareer de OORZAAK ' +
    '(zoals de bootvolgorde van registreerVloot), niet deze toets.');
});

test('er wordt alleen in een LEGE map gegoten, en alleen bij een omgeving zonder eigen keuzes', (t) => {
  const { gietDoel, isLeeg } = require('./helper')._vorm;
  const leeg = verseMap(), vol = verseMap();
  t.after(() => { weg(leeg); weg(vol); });
  fs.writeFileSync(path.join(vol, 'db.json'), '{}');

  assert.equal(isLeeg(leeg), true);
  assert.equal(isLeeg(vol), false);
  assert.equal(isLeeg(path.join(leeg, 'bestaat-niet')), true,
    'een map die nog gemaakt moet worden telt als leeg: de server maakt hem zo');

  const basis = { RTG_DATA_DIR: leeg, SMTP_URL: '' };
  assert.equal(gietDoel({ env: basis }, null), leeg, 'een lege map met een kale omgeving mag gegoten worden');
  assert.equal(gietDoel({ env: { ...basis, RTG_DATA_DIR: vol } }, null), null,
    'in een map waar de toets zelf al iets neerzette hoort NIET gegoten te worden: die toestand ' +
    'is een bewering van de toets en niet van de helper');

  /* Elk van deze keuzes kan veranderen WAT er gezaaid wordt, of hoe het eruitziet.
     Wie hier een sleutel van afhaalt, moet eerst bewijzen dat de vorm er niet
     door verandert -- raden is precies wat deze poort moet voorkomen. */
  for (const [sleutel, waarde] of [['OFFICE_CODE', 'KANTOOR1'], ['DEMO_SUPPLIER', 'KIKUNOI'],
    ['RTG_DEMO', '0'], ['RTG_ENC_KEY', 'x'], ['NODE_ENV', 'production'], ['RTG_OWNER_EMAIL', 'a@b.c']]) {
    assert.equal(gietDoel({ env: { ...basis, [sleutel]: waarde } }, null), null,
      sleutel + ' meegeven hoort de gietvorm uit te sluiten');
  }
  assert.equal(gietDoel({ env: { ...basis, SMTP_URL: 'smtp://echt:25' } }, null), null,
    'een ECHTE smarthost is een keuze; de lege tekenreeks is dat niet');
  assert.equal(gietDoel({ env: basis, script: '/ergens/anders.js' }, null), null,
    'een ander startscript zaait misschien anders');
  assert.equal(gietDoel({ env: basis, geenVorm: true }, null), null, 'en geenVorm zet het uit');
});

test('een omgeving die afwijkt van het recept krijgt geen vorm', () => {
  assert.equal(vorm.omgevingKlopt(process.env), true, 'de eigen omgeving hoort te kloppen');
  for (const sleutel of ['DEMO_SUPPLIER', 'RTG_STORE', 'RTG_KLOK', 'OFFICE_CODE']) {
    assert.equal(vorm.omgevingKlopt({ ...process.env, [sleutel]: 'iets-anders-' + sleutel }), false,
      sleutel + ' verandert wat er gezaaid wordt of hoe het eruitziet; dan hoort er niet gegoten te worden');
  }
});

test('een half gekopieerde vorm wordt nooit gebruikt', (t) => {
  const p = vorm.vormPad();
  const merk = path.join(p, vorm.MERK);
  const bewaar = fs.readFileSync(merk);
  t.after(() => fs.writeFileSync(merk, bewaar, { mode: 0o600 }));
  fs.unlinkSync(merk);
  assert.equal(vorm.erIsEenVorm(), false,
    'zonder merk is er geen vorm. Het merk wordt als LAATSTE geschreven, na de ' +
    'hernoeming, dus wie het ziet weet dat de rest er ook is.');
  const doel = verseMap();
  t.after(() => weg(doel));
  assert.equal(vorm.gietIn(doel), false, 'en er wordt dan ook niet gegoten');
  assert.deepEqual(fs.readdirSync(doel), [], 'de map blijft leeg, niet half gevuld');
});

test('gieten in een map die niet te beschrijven is laat NIETS achter', (t) => {
  /* Een half gevulde map is erger dan een lege: die geeft een server die start
     op onvolledige data en daarna iets anders doet dan hij hoort. Hier wordt het
     kopieren halverwege onmogelijk gemaakt door het doel weg te halen. */
  const doel = verseMap();
  t.after(() => weg(doel));
  const echt = fs.cpSync;
  let n = 0;
  fs.cpSync = function (...a) { if (n++ >= 1) throw new Error('opzettelijke schijffout'); return echt.apply(fs, a); };
  t.after(() => { fs.cpSync = echt; });
  assert.equal(vorm.gietIn(doel), false, 'een mislukte gieting hoort false te geven');
  assert.deepEqual(fs.readdirSync(doel), [],
    'en alles wat er al stond hoort weer weg te zijn: de aanroeper houdt precies wat hij had');
});
