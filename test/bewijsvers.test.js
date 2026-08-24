/* IS HET BEWIJS NOG WAAR? -- de houdbaarheid van MUTATIES.json.

   MUTATIES.json is het sterkste bewijs in dit huis: niet "de toets staat groen"
   maar "we hebben hem zien ZAKKEN toen we regel Y in module Z veranderden". 875
   toetsen leunen erop, en test/bewijsgraaf.test.js gebruikt datzelfde register
   als ORAKEL om te bewijzen dat de planner geen gevoelige toets overslaat.

   En het stond zonder enige houdbaarheid opgeschreven. Verandert module Z
   daarna, dan gaat het bewijs over code die er niet meer is en merkt niemand
   dat. Een groene suite met verlopen bewijs is precies de vorm die dit programma
   probeert weg te halen: alles staat groen en niemand weet meer waarom.

   DE REGEL HANGT AAN DE INHOUD EN NIET AAN DE KLOK, en deze toets legt dat vast.
   Een module die een jaar niet is aangeraakt is nog even bewezen als gisteren;
   een module die een uur geleden veranderde niet meer. Een houdbaarheid in dagen
   zou het eerste ten onrechte afkeuren en het tweede ten onrechte goedkeuren.

   Per soort bewijs een eigen regel, want ze gaan over iets anders -- en dat is
   de hele kern van deze laag: verlopen is geen algemene termijn maar een vraag
   die per soort anders wordt beantwoord. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const bv = require('../scripts/bewijsvers.js');

const WORTEL = path.join(__dirname, '..');

/* Een wegwerp-repootje met een eigen MUTATIES.json, zodat de beweringen hieronder
   niet afhangen van wat er toevallig in het echte register staat -- en zodat er
   geen enkele proef aan de echte bron komt. */
function nepRepo(t, toetsen, bestanden) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bewijsvers-'));
  t.after(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} });
  fs.mkdirSync(path.join(dir, 'test'), { recursive: true });
  for (const [rel, inhoud] of Object.entries(bestanden || {})) {
    const vol = path.join(dir, rel);
    fs.mkdirSync(path.dirname(vol), { recursive: true });
    fs.writeFileSync(vol, inhoud);
  }
  fs.writeFileSync(path.join(dir, 'MUTATIES.json'), JSON.stringify({ toetsen }, null, 1));
  return dir;
}

test('een puur bewijs verloopt zodra de gemuteerde module verandert', (t) => {
  const dir = nepRepo(t, {
    'a.test.js': { soort: 'puur', staat: 'gezakt', module: 'server/a.js',
      toetsSha: null, moduleSha: null }
  }, { 'test/a.test.js': 'toets\n', 'server/a.js': 'module\n' });
  /* Eerst de stempels goedzetten, alsof de motor ze net had geschreven. */
  const reg = JSON.parse(fs.readFileSync(path.join(dir, 'MUTATIES.json'), 'utf8'));
  reg.toetsen['a.test.js'].toetsSha = bv.sha(path.join(dir, 'test/a.test.js'));
  reg.toetsen['a.test.js'].moduleSha = bv.sha(path.join(dir, 'server/a.js'));
  fs.writeFileSync(path.join(dir, 'MUTATIES.json'), JSON.stringify(reg, null, 1));

  assert.equal(bv.meet({ wortel: dir }).verlopen, 0, 'met kloppende stempels is er niets verlopen');
  fs.writeFileSync(path.join(dir, 'server/a.js'), 'module, maar anders\n');
  const na = bv.meet({ wortel: dir });
  assert.equal(na.verlopen, 1, 'een gewijzigde module hoort het bewijs te laten verlopen');
  assert.equal(na.redenen.moduleVeranderd, 1, 'en de REDEN hoort erbij te staan, niet alleen het aantal');
});

test('een puur bewijs verloopt ook als de TOETS verandert', (t) => {
  const dir = nepRepo(t, { 'a.test.js': { soort: 'puur', staat: 'gezakt', module: 'server/a.js' } },
    { 'test/a.test.js': 'toets\n', 'server/a.js': 'module\n' });
  const reg = JSON.parse(fs.readFileSync(path.join(dir, 'MUTATIES.json'), 'utf8'));
  reg.toetsen['a.test.js'].toetsSha = bv.sha(path.join(dir, 'test/a.test.js'));
  reg.toetsen['a.test.js'].moduleSha = bv.sha(path.join(dir, 'server/a.js'));
  fs.writeFileSync(path.join(dir, 'MUTATIES.json'), JSON.stringify(reg, null, 1));
  fs.writeFileSync(path.join(dir, 'test/a.test.js'), 'toets, maar met andere beweringen\n');
  const na = bv.meet({ wortel: dir });
  assert.equal(na.verlopen, 1);
  assert.equal(na.redenen.toetsVeranderd, 1,
    'de beweringen kunnen verplaatst zijn; dan zegt de oude meting niets over de nieuwe toets');
});

test('een SERVERbewijs hangt aan de toets en niet aan een module', (t) => {
  /* Bij een servertoets wordt geen bron gemuteerd maar het ANTWOORD van een route
     (de liegpoort). Wat die meting aantoont is dat DEZE toets het merkt, en dat
     blijft waar zolang de toets hetzelfde is. Zou hij ook op elke serverwijziging
     verlopen, dan stond deze meter permanent op 875 en werd hij uitgezet. */
  const dir = nepRepo(t, { 'b.test.js': { soort: 'server', staat: 'gezakt', operator: 'liegpoort /api/' } },
    { 'test/b.test.js': 'toets\n', 'server/a.js': 'module\n' });
  const reg = JSON.parse(fs.readFileSync(path.join(dir, 'MUTATIES.json'), 'utf8'));
  reg.toetsen['b.test.js'].toetsSha = bv.sha(path.join(dir, 'test/b.test.js'));
  fs.writeFileSync(path.join(dir, 'MUTATIES.json'), JSON.stringify(reg, null, 1));

  fs.writeFileSync(path.join(dir, 'server/a.js'), 'een heel andere module\n');
  assert.equal(bv.meet({ wortel: dir }).verlopen, 0,
    'een servermeting hoort NIET te verlopen op een willekeurige serverwijziging');
  fs.writeFileSync(path.join(dir, 'test/b.test.js'), 'andere toets\n');
  assert.equal(bv.meet({ wortel: dir }).verlopen, 1,
    'maar wel als de toets zelf verandert');
});

test('een uitslag ZONDER stempel telt als verlopen, en een uitslag zonder bewijs telt niet mee', (t) => {
  const dir = nepRepo(t, {
    'a.test.js': { soort: 'puur', staat: 'gezakt', module: 'server/a.js' },        // geen stempel
    'c.test.js': { soort: 'puur', staat: 'al rood' },                              // draagt geen bewijs
    'd.test.js': { soort: 'puur', staat: 'geen module gevonden' }                  // idem
  }, { 'test/a.test.js': 'x\n', 'test/c.test.js': 'x\n', 'test/d.test.js': 'x\n', 'server/a.js': 'y\n' });
  const u = bv.meet({ wortel: dir });
  assert.equal(u.totaal, 3);
  assert.equal(u.metBewijs, 1,
    'alleen "gezakt" draagt bewijs. "al rood" en "geen module gevonden" zijn REDENEN waarom er niet ' +
    'gemeten is; die kunnen niet verlopen, en meetellen zou de meter opblazen met iets wat nooit ' +
    'nul kan worden -- dan wordt hij uitgezet en bewaakt hij niets meer.');
  assert.equal(u.verlopen, 1);
  assert.equal(u.redenen.geenStempel, 1,
    'geen stempel is geen "in orde": we weten het niet, en dat hoort de meter te zeggen');
});

test('het ECHTE register is te lezen en de meter zegt er een getal over', () => {
  const u = bv.meet({ wortel: WORTEL });
  assert.ok(u, 'MUTATIES.json hoort leesbaar te zijn');
  assert.ok(u.metBewijs > 100, 'er horen honderden bewezen toetsen te zijn (' + u.metBewijs + ')');
  assert.equal(u.vers + u.verlopen, u.metBewijs, 'elk bewijs is of geldig of verlopen, nooit geen van beide');
  /* GEEN bewering dat het getal nul IS. Dat zou vandaag onwaar zijn en morgen
     een leugen: 874 van de 875 uitslagen dragen geen stempel, want ze zijn
     opgeschreven voordat deze regel bestond. De ratel in NORM.json houdt dat
     getal een kant op; hier staat alleen dat het te BEREKENEN is. */
});
