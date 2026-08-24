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

/* ============================================================================
   EN WIE HANDELT ER OP DIE METING? -- de keuzeregel van de mutatiemotor.

   De meter hierboven zegt hoeveel bewijs verlopen is. Dat getal betekent pas
   iets als er ook een knop is om het weg te werken, en die was er niet: de
   motor slaat alles over wat al in het register staat, ook als het verlopen is.
   scripts/bewijsvers.js eindigde met "Opnieuw meten: node scripts/mutatie.js",
   en die aanroep deed voor de 874 verlopen uitslagen precies nul werk. Een
   belofte in tekst hoort een belofte in code te zijn (LAT.md regel 6).

   Nu kiest moetOverslaan() dat, en die keuze staat hier los omdat hij anders
   alleen in een ronde van uren te zien zou zijn -- een keuzeregel die niemand
   ooit heeft zien werken (LAT.md regel 10). De drie regimes zijn ECHT
   verschillend, en dat is wat hieronder wordt vastgelegd: verwissel je er twee,
   dan doet de motor of veel te veel werk (uren) of stilletjes niets. */
const motor = require('../scripts/mutatie.js');

test('de motor doet alleen over wat verlopen is -- en slaat zonder die vlag juist het verlopene over', () => {
  const uitslag = {
    'vers.test.js': { soort: 'puur', staat: 'gezakt', toetsSha: 'aa', moduleSha: 'bb' },
    'oud.test.js': { soort: 'puur', staat: 'gezakt' },                    // geen stempel = verlopen
    'stuk.test.js': { soort: 'puur', staat: 'geen toetsen gedraaid' }     // mislukking, geen uitslag
  };
  const verlopenNamen = new Set(['oud.test.js']);

  // 1. zonder vlag: alles overslaan wat een bruikbare uitslag heeft
  assert.equal(motor.moetOverslaan('vers.test.js', { uitslag }), true);
  assert.equal(motor.moetOverslaan('oud.test.js', { uitslag }), true,
    'zonder vlag slaat de motor het verlopen bewijs over -- precies het gat waar --verlopen voor is');
  assert.equal(motor.moetOverslaan('stuk.test.js', { uitslag }), false,
    '"geen toetsen gedraaid" is geen uitslag maar een mislukking en hoort opnieuw geprobeerd te worden');
  assert.equal(motor.moetOverslaan('nieuw.test.js', { uitslag }), false,
    'wat nog nergens staat, wordt altijd gemeten');

  // 2. --verlopen: precies andersom, en ALLEEN wat de meter verlopen noemt
  assert.equal(motor.moetOverslaan('oud.test.js', { uitslag, verlopenNamen }), false,
    'met --verlopen wordt het verlopen bewijs juist wel opnieuw gemeten');
  assert.equal(motor.moetOverslaan('vers.test.js', { uitslag, verlopenNamen }), true,
    'en het verse bewijs blijft staan -- anders is --verlopen gewoon --opnieuw met een andere naam');
  assert.equal(motor.moetOverslaan('nieuw.test.js', { uitslag, verlopenNamen }), true,
    'ook een onbekend bestand blijft staan: --verlopen gaat over het REGISTER, niet over de map');

  // 3. --opnieuw wint van allebei
  assert.equal(motor.moetOverslaan('vers.test.js', { uitslag, verlopenNamen, opnieuw: true }), false);
  assert.equal(motor.moetOverslaan('oud.test.js', { uitslag, opnieuw: true }), false);
});

test('een ondiepe overlever is een tussenstand en geen oordeel, in alle regimes', () => {
  /* WAAR DIT UIT KOMT, EN HET IS ECHT GEBEURD.

     Fase A van de motor probeert EEN plek per operator. Blijft een toets daar
     groen, dan schrijft hij "overleefd" -- en pas de A-diepe ronde erna, met
     acht plekken, gaat daaroverheen. Op de vijf gevallen die ik vandaag terug
     moest halen deed die tweede ronde ze alle vijf alsnog zakken.

     Tussen die twee rondes in afbreken (ctrl-C, een time-out, een gesneuvelde
     container) laat die vijf dus als ONGEVOELIG in MUTATIES.json achter. En
     omdat de voortgang buiten de repo staat en bij een botsing wint, draagt de
     eerstvolgende ronde dat gewoon door: toetsenOngevoeligPct in NORM.json ging
     van 1,2 naar 1,7 zonder dat er een regel code was veranderd. Een ratel die
     de verkeerde kant op gaat door een afgebroken meting bewaakt niets meer.

     Een ondiepe overlever heet daarom `voorlopig`, en dat is geen etiket maar
     een keuze: hij telt in GEEN van de drie regimes als gedaan, ook niet onder
     --verlopen. Daar gaat het om houdbaarheid; hier om werk dat nooit af kwam. */
  const uitslag = {
    'ondiep.test.js': { soort: 'puur', staat: 'overleefd', voorlopig: true, toetsSha: 'aa' },
    'diep.test.js': { soort: 'puur', staat: 'overleefd', toetsSha: 'aa' }
  };
  assert.equal(motor.moetOverslaan('ondiep.test.js', { uitslag }), false,
    'zonder vlag: een ondiepe overlever hoort de diepe ronde alsnog te krijgen');
  assert.equal(motor.moetOverslaan('ondiep.test.js', { uitslag, verlopenNamen: new Set() }), false,
    'ook onder --verlopen, en die staat hier nadrukkelijk NIET in de verlopen-lijst -- ' +
    'een overlever draagt geen bewijs, dus bewijsvers ziet hem niet en zou hem overslaan');
  assert.equal(motor.moetOverslaan('diep.test.js', { uitslag }), true,
    'een overlever DOOR de diepe ronde is wel een oordeel en blijft staan');
  assert.equal(motor.moetOverslaan('ondiep.test.js', { uitslag, opnieuw: true }), false);
});

test('het echte register houdt geen enkele ondiepe overlever meer vast', () => {
  /* De vlag hierboven werkt alleen als er ook echt niets meer met die vlag in
     MUTATIES.json staat. Blijft er een staan, dan is er een ronde afgebroken
     tussen fase A en A-diep en is dat cijfer nog geen oordeel. */
  const register = JSON.parse(fs.readFileSync(path.join(WORTEL, 'MUTATIES.json'), 'utf8')).toetsen;
  const open = Object.entries(register).filter(([, r]) => r && r.voorlopig).map(([k]) => k);
  assert.deepEqual(open, [],
    open.length + ' toets(en) staan als ondiepe overlever in het register; draai ' +
    'node scripts/mutatie.js --puur af, dan gaat de diepe ronde er alsnog overheen:\n  ' +
    open.slice(0, 10).join('\n  '));
  assert.ok(Object.keys(register).length > 100, 'en er hoort een echt register te zijn');
});

test('de lijst waar --verlopen op draait is DEZELFDE lijst die de meter telt', () => {
  /* Twee definities van "verlopen" zouden binnen een week uiteenlopen, en dan
     meet de motor iets anders dan de ratel telt (LAT.md regel 4). Deze toets
     houdt ze op het echte register tegen elkaar: elk bewijs is of verlopen en
     wordt gedaan, of vers en wordt overgeslagen -- nooit allebei en nooit geen
     van beide. */
  const u = bv.meet({ wortel: WORTEL });
  assert.ok(u && u.metBewijs > 100, 'er hoort een echt register te zijn (' + (u && u.metBewijs) + ')');
  const verlopenNamen = new Set(u.lijst.map(x => x.naam));
  assert.equal(verlopenNamen.size, u.verlopen, 'de lijst en het getal gaan over hetzelfde');

  const register = JSON.parse(fs.readFileSync(path.join(WORTEL, 'MUTATIES.json'), 'utf8')).toetsen;
  let gedaan = 0, overgeslagen = 0;
  for (const naam of Object.keys(register)) {
    if (!bv.draagtBewijs(register[naam])) continue;
    if (motor.moetOverslaan(naam, { uitslag: register, verlopenNamen })) overgeslagen++;
    else gedaan++;
  }
  assert.equal(gedaan, u.verlopen, 'de motor doet precies de verlopen bewijzen over');
  assert.equal(overgeslagen, u.vers, 'en slaat precies de verse over');
  assert.ok(gedaan > 0 || overgeslagen > 0, 'en er is echt iets geteld');
});
