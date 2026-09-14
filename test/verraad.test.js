/* DE VERRAADSMOTOR (server/lib/verraad.js) -- de wereld laten liegen.

   WAT HIER OP HET SPEL STAAT. Dit gereedschap kan op twee manieren nutteloos
   worden, en allebei zonder dat iemand het merkt:

   1. HIJ STAAT AAN EN SLAAT NOOIT TOE. Dan draait er een ronde die "geen
      bevindingen" meldt terwijl er niets is verraden. Dat is de gevaarlijkste
      uitkomst die dit ding kan geven, want hij leest als bewijs van
      weerbaarheid.
   2. HIJ IS NIET NA TE SPELEN. Een verraad dat willekeurig toeslaat geeft een
      fout die niemand kan navertellen, en een toets die maar soms zakt wordt
      binnen een week uitgezet.

   Tegen allebei staat hier een toets: de teller die bijhoudt hoe vaak er
   werkelijk is verraden, en de seed die een ronde exact herhaalbaar maakt.

   De motor draait bij het LADEN zijn instelling uit, dus een andere instelling
   is een ander proces -- net als bij de klok, en om dezelfde reden: een
   schakelaar die halverwege een verzoek van waarde verandert, geeft een fout
   die niemand kan navertellen.

   Draai los: node --test test/verraad.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { CATALOGUS, lees, maakTeller, sla, actief, ietsAan, ingebouwd } = require('../server/lib/verraad');

const WORTEL = path.join(__dirname, '..');
const inProces = (env, code) => execFileSync(process.execPath, ['-e', code],
  { encoding: 'utf8', env: { ...process.env, ...env }, cwd: WORTEL }).trim();
function valtOm(env, code) {
  try { inProces(env, code); return null; } catch (e) { return String(e.stderr || e.message); }
}

/* ---------- de catalogus ---------- */

/* TWEE WOORDENLIJSTEN, EN ZE ZIJN EEN KEER DOOR ELKAAR GELOPEN.

   `raakt` hoort een SCHAKEL van de bewijsmatrix te noemen; `contract` een
   CRASHCONTRACT uit scripts/lib/crashtaxonomie.js. Op 13 september stond er
   ATOMIC in `raakt` bij de twee nieuwe doden -- het juiste woord uit de
   verkeerde lijst. De toets hieronder vond dat, maar pas in CI en met een
   regex die alleen kon zeggen dat er GEEN matrixwoord stond.

   Daarom nu drie beweringen in plaats van een: er staat een matrixwoord, er
   staat GEEN contractwoord in `raakt` (dat is precies de gemaakte fout), en
   een `contract` dat er staat komt uit de taxonomie zelf -- gelezen en niet
   overgetypt, anders ontstaat de tweede lijst opnieuw. */
const SCHAKELS = ['STATE', 'IDEMPOTENCY', 'FAILURE', 'ROLLBACK'];
const CONTRACTEN = Object.keys(require('../scripts/lib/crashtaxonomie.js').CONTRACTEN);

test('elk verraad noemt wat het nabootst en welke schakel het raakt', () => {
  for (const v of CATALOGUS) {
    assert.ok(v.naam && /^[a-z-]+$/.test(v.naam), 'naam ontbreekt of is raar: ' + v.naam);
    assert.ok(v.wat && v.wat.length > 20, v.naam + ' legt niet uit wat hij nabootst');
    assert.ok(v.raakt && SCHAKELS.some(s => v.raakt.includes(s)),
      v.naam + ' zegt niet welke schakel van de bewijsmatrix hij raakt');
  }
});

test('`raakt` draagt geen crashcontract -- dat is de andere lijst', () => {
  for (const v of CATALOGUS) for (const c of CONTRACTEN)
    assert.ok(!v.raakt.includes(c), v.naam + ' zet het crashcontract ' + c + ' in `raakt`. ' +
      'Die hoort in `contract`: een matrixschakel en een crashcontract zijn twee ' +
      'woordenlijsten, en door elkaar claimt de matrix dekking die er niet is.');
});

test('een `contract` komt uit de crashtaxonomie en niet uit de pen van wie het opschreef', () => {
  const met = CATALOGUS.filter(v => v.contract);
  assert.ok(met.length >= 1, 'de drie doden horen hun crashcontract te noemen');
  for (const v of met)
    assert.ok(CONTRACTEN.includes(v.contract),
      v.naam + ' noemt contract ' + v.contract + ', dat de taxonomie niet kent. ' +
      'Bekend zijn: ' + CONTRACTEN.join(', '));
});

/* DE ZELFIJKING. Een toets die je niet hebt zien zakken is geen toets, en deze
   drie hierboven zijn alledrie op een met opzet verkeerde regel losgelaten. */
test('zelfijking: een regel met de fout van 13 september zakt aantoonbaar', () => {
  const fout = { naam: 'verzonnen', wat: 'x'.repeat(30), waar: null, raakt: 'ATOMIC -- geen spoor' };
  assert.ok(!SCHAKELS.some(s => fout.raakt.includes(s)), 'de eerste toets hoort hierop te zakken');
  assert.ok(CONTRACTEN.some(c => fout.raakt.includes(c)), 'en de tweede ook');
  assert.ok(!CONTRACTEN.includes('ONZIN'), 'en een verzonnen contract hoort niet in de lijst');
});

test('namen zijn uniek -- twee verraden met dezelfde naam maken de instelling dubbelzinnig', () => {
  const namen = CATALOGUS.map(v => v.naam);
  assert.equal(new Set(namen).size, namen.length);
});

test('de catalogus toont ook wat NIET is ingebouwd', () => {
  /* Een lijst die alleen laat zien wat af is, verbergt hoeveel er nog moet --
     en dan leest "de Verraadsmotor bestaat" als "de Verraadsmotor is klaar". */
  assert.ok(ingebouwd() >= 1, 'er hoort er minstens een echt ingebouwd te zijn');
  assert.ok(ingebouwd() < CATALOGUS.length, 'de catalogus hoort ook voornemens te tonen');
  for (const v of CATALOGUS) {
    if (!v.waar) continue;
    assert.ok(v.waar.includes('/') || v.waar.includes('.js'),
      v.naam + ' zegt "ingebouwd" zonder een vindplaats te noemen');
  }
});

/* ---------- de instelling lezen ---------- */

test('zonder RTG_VERRAAD staat er niets aan en slaat er niets toe', () => {
  assert.equal(ietsAan(), false, 'deze testrun hoort zelf geen verraad aan te hebben');
  assert.equal(sla('schrijf-verloren'), false);
  assert.equal(actief('schrijf-verloren'), false);
});

test('een naam zonder kans betekent altijd', () => {
  const uit = lees('schrijf-verloren');
  assert.equal(uit.aan.get('schrijf-verloren'), 1);
  assert.deepEqual(uit.onbekend, []);
});

test('meerdere verraden met eigen kansen', () => {
  const uit = lees('schrijf-verloren:0.3, schrijf-faalt:1');
  assert.equal(uit.aan.get('schrijf-verloren'), 0.3);
  assert.equal(uit.aan.get('schrijf-faalt'), 1);
});

test('een TYPEFOUT is een fout en geen stilte', () => {
  /* Dit is de belangrijkste weigering van de module. Een verkeerd gespelde naam
     die stil wordt genegeerd, levert een ronde op waarin niets wordt verraden en
     alles groen staat -- en dat leest als weerbaarheid. */
  assert.deepEqual(lees('schrijf-verlooren').onbekend, ['schrijf-verlooren']);
  const fout = valtOm({ RTG_VERRAAD: 'schrijf-verlooren' }, "require('./server/lib/verraad')");
  assert.ok(fout, 'een onbekend verraad hoort te gooien');
  assert.match(fout, /kent deze niet/);
});

test('een kans buiten 0..1 wordt geweigerd', () => {
  assert.equal(lees('schrijf-faalt:2').onbekend.length, 1);
  assert.equal(lees('schrijf-faalt:-1').onbekend.length, 1);
  assert.equal(lees('schrijf-faalt:appel').onbekend.length, 1);
});

/* ---------- herhaalbaar ---------- */

test('dezelfde seed geeft dezelfde reeks -- een fout is na te spelen', () => {
  const a = maakTeller(42), b = maakTeller(42);
  const eenA = [a(), a(), a(), a(), a()];
  const eenB = [b(), b(), b(), b(), b()];
  assert.deepEqual(eenA, eenB);
});

test('een andere seed geeft een andere reeks', () => {
  const a = maakTeller(42), b = maakTeller(43);
  assert.notDeepEqual([a(), a(), a()], [b(), b(), b()]);
});

test('de teller blijft tussen nul en een', () => {
  const t = maakTeller(7);
  for (let i = 0; i < 200; i++) { const w = t(); assert.ok(w >= 0 && w < 1, 'buiten bereik: ' + w); }
});

test('twee rondes met dezelfde seed slaan even vaak toe', () => {
  const code = "const v=require('./server/lib/verraad');" +
    "let n=0;for(let i=0;i<100;i++) if(v.sla('schrijf-verloren')) n++;console.log(n)";
  const een = inProces({ RTG_VERRAAD: 'schrijf-verloren:0.5', RTG_VERRAAD_SEED: '99' }, code);
  const twee = inProces({ RTG_VERRAAD: 'schrijf-verloren:0.5', RTG_VERRAAD_SEED: '99' }, code);
  assert.equal(een, twee);
  assert.ok(Number(een) > 20 && Number(een) < 80, 'een halve kans hoort ergens in het midden uit te komen: ' + een);
});

/* ---------- aan staan is niet hetzelfde als toegeslagen ---------- */

test('de motor houdt bij hoe vaak hij WERKELIJK heeft toegeslagen', () => {
  /* Zonder deze teller is een ronde met "geen bevindingen" niet te
     onderscheiden van een ronde waarin niets is verraden. Dat is het verschil
     tussen weerbaarheid en een schakelaar die niets deed. */
  const uit = inProces({ RTG_VERRAAD: 'schrijf-verloren', RTG_VERRAAD_SEED: '1' },
    "const v=require('./server/lib/verraad');v.sla('schrijf-verloren');v.sla('schrijf-verloren');" +
    "console.log(JSON.stringify(v.telling()))");
  assert.deepEqual(JSON.parse(uit), { 'schrijf-verloren': 2 });
});

test('een verraad met kans nul staat AAN maar slaat nooit toe, en dat is zichtbaar', () => {
  const uit = inProces({ RTG_VERRAAD: 'schrijf-verloren:0' },
    "const v=require('./server/lib/verraad');" +
    "for(let i=0;i<50;i++) v.sla('schrijf-verloren');" +
    "console.log(v.actief('schrijf-verloren')+' '+JSON.stringify(v.telling()))");
  assert.equal(uit, 'true {}', 'aan staan zonder ooit toe te slaan hoort uit de telling te blijken');
});

/* ---------- de weigering in productie ---------- */

test('de motor weigert in productie', () => {
  const fout = valtOm({ RTG_VERRAAD: 'schrijf-verloren', NODE_ENV: 'production' },
    "require('./server/lib/verraad')");
  assert.ok(fout, 'in productie hoort dit te gooien');
  assert.match(fout, /productie/);
});

test('in productie zonder RTG_VERRAAD gebeurt er niets bijzonders', () => {
  assert.equal(inProces({ NODE_ENV: 'production', RTG_VERRAAD: '' },
    "const v=require('./server/lib/verraad');console.log(v.ietsAan())"), 'false');
});

/* ---------- werkelijk ingebouwd op het schrijfpunt ---------- */

test('schrijf-faalt laat de database echt omvallen op save()', () => {
  /* Ingebouwd op het ene punt waar alle schrijfacties doorheen gaan. Zou dit
     alleen in de catalogus staan, dan was de motor een lijst goede voornemens. */
  /* De poort van ../lib/verraadfase.js moet hier met de hand open: in een los
     proces luistert er geen server, en dan verraadt save() met opzet niets.
     Deze toets meet de MOTOR in save() en niet de opstartfase -- die heeft een
     eigen toets in test/verraadfase.test.js. */
  const uit = inProces({ RTG_VERRAAD: 'schrijf-faalt', RTG_DATA_DIR: '/tmp/rtg-verraad-proef' },
    "require('./server/lib/verraadfase').zetVerkeerAan();" +
    "const db=require('./server/db');let stuk=null;" +
    "db.db.writable=true;try{db.save()}catch(e){stuk=e.message};console.log(stuk)");
  assert.match(uit, /schrijf-faalt/);
});

test('schrijf-verloren keert normaal terug -- de aanroeper merkt niets', () => {
  /* En dat is precies de aanval: geen fout, geen melding, en de gegevens weg.
     Wie hier een uitzondering verwacht, meet het verkeerde. */
  const uit = inProces({ RTG_VERRAAD: 'schrijf-verloren', RTG_DATA_DIR: '/tmp/rtg-verraad-proef2' },
    "require('./server/lib/verraadfase').zetVerkeerAan();" +   // zie de toets hierboven
    "const db=require('./server/db');db.db.writable=true;" +
    "let stuk=null;try{db.save()}catch(e){stuk=e.message};" +
    "console.log(stuk+' '+JSON.stringify(require('./server/lib/verraad').telling()))");
  assert.match(uit, /^null /, 'de aanroeper hoort geen fout te zien');
  assert.match(uit, /"schrijf-verloren":1/, 'maar er is wel degelijk verraden');
});

test('zonder verraad schrijft save() gewoon -- op een ECHT geladen database', () => {
  /* Dit controlegeval stond eerst rood, en om de goede reden: save() op een
     database die nooit is geladen valt sowieso om ("Cannot convert undefined or
     null to object"). De twee toetsen hierboven kwamen daar niet aan toe, want
     het verraad slaat toe VOORDAT de echte schrijfactie begint -- en dat is
     precies waar hij hoort te zitten.

     Zonder deze derde toets zou dat verschil onzichtbaar blijven: dan bewijzen
     de eerste twee alleen dat er iets omvalt, niet dat het verraad de oorzaak
     was. Dus hier eerst laden, en dan schrijven. */
  const uit = inProces({ RTG_DATA_DIR: '/tmp/rtg-verraad-proef3' },
    "const db=require('./server/db');(async()=>{await db.load();" +
    "let stuk=null;try{db.save()}catch(e){stuk=e.message};" +
    "console.log(stuk+' '+JSON.stringify(require('./server/lib/verraad').telling()))})()");
  assert.equal(uit, 'null {}');
});

test('MET verraad komt het OPSTARTEN er nu doorheen -- en daarna slaat hij wel toe', () => {
  /* DEZE TOETS IS OMGEKEERD, EN DAT IS DE HELE WINST. Hij stond hier als:
     "MET verraad valt het OPSTARTEN al om -- load() schrijft zelf ook". Die
     bevinding was echt en staat nog steeds: db.load() roept zelf save() aan en
     niets vangt dat af, dus met een falende schijf kwam de server niet eens op.

     Dat maakte `schrijf-faalt` onbruikbaar voor elke ronde die ROUTES moet
     rijden: scripts/faalproef.js kreeg zijn wegwerpserver niet op (dood na 409
     ms) en kon de FAILURE-kolom dus maar over een van zijn twee sabotages
     vullen. Niet omdat het systeem slecht faalde, maar omdat het instrument er
     niet bij kon.

     server/lib/verraadfase.js zet daarom een poort op de aanroepplek: tijdens de
     opstart verraadt save() niets, na 'listening' weer alles -- ook voor
     achtergrondschrijvers. De opstart komt er dus door, en de sabotage werkt
     daarna gewoon. Beide helften staan hieronder, want alleen de eerste zou
     ook slagen als de motor kapot was. */
  /* EEN VERSE DATAMAP, en dat is hier geen netheid. Op een map die al bestaat
     hoeft load() niets te migreren, en dan telt `overgeslagen` nul -- de toets
     zou dan afhangen van wat een vorige ronde had laten staan. */
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-verraad-opstart-'));
  const uit = inProces({ RTG_VERRAAD: 'schrijf-faalt', RTG_DATA_DIR: map },
    "const f=require('./server/lib/verraadfase');" +
    "const db=require('./server/db');(async()=>{let opstart=null,erna=null;" +
    "try{await db.load()}catch(e){opstart=e.message};" +
    "f.zetVerkeerAan();" +
    "try{db.db.writable=true;db.save()}catch(e){erna=e.message};" +
    "console.log(JSON.stringify({opstart,erna,stand:f.stand()}))})()" +
    ".catch(e=>console.log(JSON.stringify({fataal:e.message})))");
  const r = JSON.parse(uit);
  assert.equal(r.opstart, null, 'de opstart komt er doorheen');
  assert.match(String(r.erna), /schrijf-faalt/, 'en daarna verraadt hij wel degelijk');
  assert.ok(r.stand.overgeslagen > 0, 'de overgeslagen opstartschrijfacties zijn geteld');
  fs.rmSync(map, { recursive: true, force: true });
});

/* ============================================================================
   DE VIERDE DOOD -- `sterf-voor-bericht`, en waarom hij een eigen toets krijgt.

   De drie doden ervoor gaan over de UITKOMST: is er een spoor, staat het vast,
   legt een herhaling er iets bovenop. Deze gaat over de MENS: de handeling staat
   vast en de betrokkene hoort er nooit van. Een route kan atomair EN herstelbaar
   zijn en hier alsnog zakken, en juist daarom mag hij nooit met de andere drie
   worden samengevat.

   Deze toetsen bewaken de twee manieren waarop hij stilletjes waardeloos wordt:
   het injectiepunt verdwijnt (dan heet de grens onmeetbaar en zakt er niets
   meer), of hij verhuist naar NA de schrijfactie (dan meet hij de milde kant en
   heet dat de dure). */
test('sterf-voor-bericht staat in de catalogus, is INGEBOUWD en draagt een crashcontract', () => {
  const v = CATALOGUS.find(x => x.naam === 'sterf-voor-bericht');
  assert.ok(v, 'het verraad hoort in de catalogus te staan');
  assert.ok(v.waar, 'en INGEBOUWD te zijn -- `waar: null` is een voornemen, geen faalmoment');
  assert.match(v.waar, /meldaan/, 'in de schrijver van de persoonlijke melding');
  assert.equal(v.contract, 'RECOVERABLE',
    'de uitkomst staat vast; wat ontbreekt is dat iemand het te horen krijgt');
});

test('de injectie staat VOOR het wegschrijven en niet erna', () => {
  /* Op de BRON, want dit is een uitspraak over volgorde en die is niet uit
     gedrag af te lezen zonder een echte crash. Staat de injectie na de save,
     dan meet de proef de milde kant (de melding bestaat, alleen de bezorging
     ontbrak) en noemt die de dure. */
  const fs = require('node:fs');
  const src = fs.readFileSync(require('node:path').join(__dirname, '..', 'server', 'opzet', 'meldaan.js'), 'utf8');
  const injectie = src.indexOf("sterf-voor-bericht");
  const opbouw = src.indexOf('const n = {');
  const wegschrijven = src.indexOf('db.data.notifications[handle].unshift');
  assert.ok(injectie > 0, 'de injectie hoort in meldaan.js te staan');
  assert.ok(opbouw > 0 && wegschrijven > 0, 'en de melding wordt daar opgebouwd en weggeschreven');
  assert.ok(injectie < opbouw, 'de injectie komt VOOR het opbouwen van de melding');
  assert.ok(injectie < wegschrijven, 'en zeker voor het wegschrijven ervan');
});

test('zonder RTG_VERRAAD slaat hij nooit toe -- de haak kost niets in productie', () => {
  /* De motor leest RTG_VERRAAD bij het laden. In deze toetsronde staat hij uit,
     dus elke sla() hoort false te geven -- ook die van de nieuwe. */
  assert.equal(sla('sterf-voor-bericht'), false);
  assert.equal(actief('sterf-voor-bericht'), false);
});
