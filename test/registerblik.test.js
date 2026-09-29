/* ============================================================================
   DE REGISTERBLIK -- Rahul zoekt het op in RTG's eigen registers.

   Vijf gereedschappen die registers LEZEN (server/kern/registerblik/), en een
   lus die ze gebruikt voor de boardroom. Elke toets hieronder gaat over een
   belofte die zonder hem stil zou breken:

     1. alleen de registers op de lijst worden gelezen, en nooit een bestand dat
        het model noemt;
     2. elk antwoord draagt zijn register, zijn leeftijd en zijn graad, en een
        vervallen meting zakt naar `vermoed`;
     3. de productiestand wordt doorgegeven en nooit samengesteld; ontbreekt hij,
        dan is dat `niet vast te stellen`;
     4. de lus kent alleen deze vijf -- geen `doe`, geen `kaart`, geen `plan`;
     5. de lus gaat door de contextsamensteller en stuurt niets dat niet past;
     6. de boardroom gebruikt de registerblik, en valt terug als het model geen
        gereedschap kan;
     7. CODE-AI-001: de lijst is JSON, geen gereedschap neemt een bestand aan, en
        niets wordt gedeeld met het stuur;
     8-10. de kennisindex: een document is een bewering, noemt zijn registers,
        en is zonder index `niet vast te stellen`.

   Nagetrokken met mutaties (elk zakt minstens een toets):
     a. `leesRegister` leest elk pad dat binnenkomt      -> toets 1 zakt
     b. `graadUitLeeftijd` zegt altijd `gemeten`                 -> toets 2 zakt
     c. de lus geeft ook de stuurgereedschappen mee      -> toets 4 zakt
     d. de lus slaat de contextsamensteller over         -> toets 5 zakt
     e. zoekKennis brengt een document als `gemeten`     -> toets 8 zakt
     f. de kop weegt niet meer zwaarder                  -> toets 9 zakt

   Draai los: node --test test/registerblik.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { kijk, REGISTERBLIK_TOOLS } = require('../server/kern/registerblik/gereedschap');
const { leesRegister, leeftijd, graadUitLeeftijd, REGISTERS } = require('../server/kern/registerblik/bronnen');
const { registerblikVraag } = require('../server/kern/registerblik/lus');

function tijdelijkeWortel(bestanden) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'registerblik-'));
  for (const [rel, inhoud] of Object.entries(bestanden)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), JSON.stringify(inhoud));
  }
  return dir;
}

test('1. alleen de registers op de lijst, en nooit een bestand dat het model noemt', () => {
  const gelezen = [];
  const echt = fs.readFileSync;
  fs.readFileSync = function (p, ...rest) { gelezen.push(String(p)); return echt.call(this, p, ...rest); };
  try {
    kijk('inspecteerRoute', { pad: '../../server/kern/pay/poort.js' });
    kijk('inspecteerRoute', { pad: '/api/../../server/kern/pay/poort.js' });
    kijk('zoekRegister', { term: 'poort.js' });
    kijk('vraagBewijsOp', { post: '../../.env' });
    assert.equal(leesRegister('../../server/kern/pay/poort.js').ok, false);
  } finally { fs.readFileSync = echt; }
  const toegestaan = Object.values(REGISTERS);
  for (const p of gelezen) {
    assert.ok(toegestaan.some(rel => p.endsWith(rel)), 'de registerblik las iets buiten de lijst: ' + p);
  }
  assert.ok(Object.values(REGISTERS).every(rel => rel.endsWith('.json')), 'een register is afgeleide waarheid in JSON, nooit bron');
});

test('2. elk antwoord draagt register, leeftijd en graad; een vervallen meting is vermoed', () => {
  const oud = new Date(Date.now() - 90 * 86400000).toISOString();
  const vers = new Date(Date.now() - 2 * 86400000).toISOString();
  assert.equal(graadUitLeeftijd(leeftijd({ stempel: { op: vers } })), 'gemeten');
  assert.equal(graadUitLeeftijd(leeftijd({ stempel: { op: oud } })), 'vermoed', 'vervallen bewijs is geen bewijs');
  assert.equal(graadUitLeeftijd(leeftijd({})), 'vermoed', 'een meting zonder datum weet niet of het nu nog zo is');
  assert.equal(leeftijd({ stempel: { op: oud }, halfwaardetijdDagen: 120 }).vervallen, false, 'het register mag zijn eigen houdbaarheid zeggen');

  const u = kijk('inspecteerRoute', { pad: '/api/bank/pas/betaal' });
  assert.equal(u.bekend, true, 'een bestaande route is bekend in de registers van deze repo');
  assert.ok(u.bronnen.length >= 2);
  for (const b of u.bronnen) {
    assert.ok(b.register && b.graad, 'elke bron noemt zijn register en graad');
    assert.ok('gemetenOp' in b || b.leeftijd, 'en zijn leeftijd, of waarom die er niet is');
  }
});

test('3. de productiestand wordt doorgegeven, nooit samengesteld', () => {
  const vorige = process.env.RTG_REGISTERWORTEL;
  try {
    process.env.RTG_REGISTERWORTEL = tijdelijkeWortel({});
    const weg = kijk('vraagProductiestandOp');
    assert.equal(weg.stand, 'niet vast te stellen');
    assert.equal(weg.PRODUCTION_STATUS, undefined, 'zonder uitspraak geen stand, ook geen afgeleide');

    process.env.RTG_REGISTERWORTEL = tijdelijkeWortel({ '.release/productie-status.json': {
      gemaakt: new Date().toISOString(), commit: 'abc', PRODUCTION_STATUS: 'NIET_KLAAR',
      blokkades: ['Volledige-suitebewijs ontbreekt.', 'Staging-repetitie ontbreekt.'] } });
    const er = kijk('vraagProductiestandOp');
    assert.equal(er.PRODUCTION_STATUS, 'NIET_KLAAR');
    assert.deepEqual(er.blokkades, ['Volledige-suitebewijs ontbreekt.', 'Staging-repetitie ontbreekt.']);
    assert.equal(er.bron.graad, 'gemeten');
  } finally {
    if (vorige === undefined) delete process.env.RTG_REGISTERWORTEL; else process.env.RTG_REGISTERWORTEL = vorige;
  }
});

/* Een nagemaakt model dat een vaste reeks beurten speelt en bijhoudt wat het kreeg. */
function nepModel(beurten, extra) {
  const gekregen = [];
  let i = 0;
  return Object.assign({ gekregen, messages: { create: async (params) => { gekregen.push(params); return beurten[Math.min(i++, beurten.length - 1)]; } } }, extra);
}
const gereedschapBeurt = (naam, invoer) => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'x' + naam, name: naam, input: invoer }] });
const tekstBeurt = (t) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: t }] });

test('4. de lus kent alleen de vijf leesgereedschappen', async () => {
  const model = nepModel([gereedschapBeurt('inspecteerRoute', { pad: '/api/bank/pas/betaal' }),
    gereedschapBeurt('doe', { pad: '/api/bank/pas/betaal' }), tekstBeurt('De route is verzwakt, gemeten 25 dagen geleden.')]);
  const uit = await registerblikVraag({ anthropic: model, rol: 'je denkt mee met de boardroom.', vraag: 'Hoe staat de pasbetaling ervoor?' });
  assert.equal(uit.stand, 'beantwoord');
  for (const p of model.gekregen) {
    assert.deepEqual(p.tools.map(t => t.name).sort(),
      ['inspecteerRoute', 'vraagBewijsOp', 'vraagProductiestandOp', 'vraagVertrouwenOp', 'zoekKennis', 'zoekRegister']);
  }
  const tweede = model.gekregen[2].messages.at(-1).content[0].content;
  assert.match(tweede, /onbekend gereedschap: doe/, 'een gevraagde doe wordt geweigerd als antwoord, niet uitgevoerd');
  assert.deepEqual(uit.geraadpleegd.map(g => g.gereedschap), ['inspecteerRoute', 'doe']);
  assert.match(model.gekregen[0].system, /Je hebt de registerblik/);
  assert.match(model.gekregen[0].system, /niet vast te stellen/);
});

test('4b. loopt het budget op, dan zegt de lus dat in plaats van iets te verzinnen', async () => {
  const model = nepModel([gereedschapBeurt('vraagVertrouwenOp', {})]);
  const uit = await registerblikVraag({ anthropic: model, vraag: 'Blijf maar zoeken.' });
  assert.equal(uit.tekst, null);
  assert.equal(uit.stand, 'budget-op');
  assert.ok(uit.geraadpleegd.length > 0);
});

test('5. de lus stuurt niets dat niet in het venster past', async () => {
  const model = nepModel([tekstBeurt('mag niet gebeuren')],
    { providerInfo: [{ venster: { tokens: 1024, herkomst: 'verklaard' } }] });
  const uit = await registerblikVraag({ anthropic: model, vraag: 'Waarom zijn we nog niet productieklaar?' });
  assert.equal(uit.stand, 'CONTEXT_PAST_NIET');
  assert.equal(model.gekregen.length, 0, 'het model kreeg niets');
});

test('6. de boardroom gebruikt de registerblik, en valt terug als het model geen gereedschap kan', async () => {
  const maak = (anthropic) => require('../server/kern/afdelingen/kameradvies')({ anthropic,
    AFDELINGEN: { a: { naam: 'Techniek' } }, kamer: () => ({}), taken: () => [], voorstellen: () => ({ voorstellen: [] }) });
  const met = nepModel([gereedschapBeurt('vraagProductiestandOp', {}), tekstBeurt('De productiestand is hier niet vast te stellen.')]);
  const r = await maak(met).boardroomAdvies('Waarom zijn we nog niet productieklaar?');
  assert.equal(r.antwoord, 'De productiestand is hier niet vast te stellen.');
  assert.deepEqual(r.geraadpleegd.map(g => g.gereedschap), ['vraagProductiestandOp']);

  const zonder = nepModel([tekstBeurt('Korte blik zonder registers.')], { kan: (p) => !(p && p.tools) });
  const z = await maak(zonder).boardroomAdvies('Waar kijken we naar?');
  assert.equal(z.antwoord, 'Korte blik zonder registers.');
  assert.equal(zonder.gekregen.length, 1);
  assert.equal(zonder.gekregen[0].tools, undefined, 'de terugval is de korte blik, zonder gereedschap');
});

test('7. CODE-AI-001: alleen registers bij naam, en geen stuurgereedschap', () => {
  /* De registerblik mag lezen wat de meters publiceerden, en niets anders: zijn
     lijst bestaat uit JSON-registers, hij heeft geen gereedschap dat een bestand
     of pad aanneemt, en hij deelt geen enkel gereedschap met het stuur -- lezen
     en uitvoeren blijven twee werelden. */
  const { REGISTERS } = require('../server/kern/registerblik/bronnen');
  const { REGISTERBLIK_TOOLS } = require('../server/kern/registerblik/gereedschap');
  const { TOOLS } = require('../server/kern/stuur/gereedschap');
  assert.ok(Object.values(REGISTERS).every(r => /\.json$/.test(r)), 'een register is JSON, nooit bron');
  assert.deepEqual(REGISTERBLIK_TOOLS.map(t => t.name).sort(),
    ['inspecteerRoute', 'vraagBewijsOp', 'vraagProductiestandOp', 'vraagVertrouwenOp', 'zoekKennis', 'zoekRegister'],
    'er is een registerblik-gereedschap bij of af. Neemt het een bestand aan? Dan hoort het bij de Architect en niet hier.');
  const velden = REGISTERBLIK_TOOLS.flatMap(t => Object.keys(t.input_schema.properties || {}));
  assert.ok(!velden.some(v => /bestand|file|pad_op_schijf|path/i.test(v)), 'geen gereedschap neemt een bestand aan: ' + velden.join(', '));
  const stuur = new Set(TOOLS.map(t => t.name));
  assert.ok(REGISTERBLIK_TOOLS.every(t => !stuur.has(t.name)), 'de registerblik deelt geen gereedschap met het stuur');
});

test('8. zoekKennis vindt het document, noemt de registers, en brengt het als bewering', () => {
  const u = kijk('zoekKennis', { vraag: 'Waarom hebben we MONEY-012 zo gemaakt?' });
  assert.equal(u.vondsten[0].document, 'docs/money-012.md', 'een code als MONEY-012 blijft een heel woord en vindt zijn eigen document');
  assert.equal(u.graad, 'vermoed', 'een document is een bewering en geen meting');
  assert.match(u.let, /toets/);
  assert.ok(u.bron.register === 'KENNISINDEX.json' && u.bron.gemetenOp, 'de index draagt zijn leeftijd');
  const code = kijk('zoekKennis', { vraag: 'CODE-AI-001 grens runtime bron' });
  assert.ok(code.vondsten.some(v => v.noemt.bestanden.includes('test/codegrens.test.js')),
    'een vondst noemt waar de werkelijkheid staat');
  assert.match(kijk('zoekKennis', { vraag: '' }).reden, /vraag/);
});

test('9. zonder index is de kennis niet vast te stellen, en een kop weegt zwaarder dan een terloopse zin', () => {
  const vorige = process.env.RTG_REGISTERWORTEL;
  try {
    process.env.RTG_REGISTERWORTEL = tijdelijkeWortel({});
    assert.equal(kijk('zoekKennis', { vraag: 'terugstorting' }).stand, 'niet vast te stellen');
    process.env.RTG_REGISTERWORTEL = tijdelijkeWortel({ 'KENNISINDEX.json': {
      kop: { stempel: { op: new Date().toISOString(), commit: 'abc' } },
      docs: [{ pad: 'A.md', titel: 'A' }, { pad: 'B.md', titel: 'B' }],
      stukken: [
        { d: 0, k: 'Iets anders', r: 1, t: 'Hier staat terloops het woord zakgeld tussen veel andere woorden over reizen en hotels.' },
        { d: 1, k: 'Zakgeld', r: 1, t: 'Hier staat terloops het woord potje tussen veel andere woorden over reizen en hotels.' }] } });
    const u = kijk('zoekKennis', { vraag: 'zakgeld' });
    assert.equal(u.vondsten[0].document, 'B.md', 'waar een stuk OVER gaat weegt zwaarder dan wat er terloops in staat');
  } finally {
    if (vorige === undefined) delete process.env.RTG_REGISTERWORTEL; else process.env.RTG_REGISTERWORTEL = vorige;
  }
});

test('10. de index knipt op koppen, slaat afdrukken over, en ziet geen kop in een codeblok', () => {
  const { knip, AFDRUKKEN } = require('../scripts/kennisindex');
  const s = knip('# Titel\n\nintro\n\n## Deel\n\n```\n# geen kop\n```\n\ntekst');
  assert.deepEqual(s.map(x => x.k), ['Titel', 'Titel > Deel']);
  assert.ok(AFDRUKKEN.has('BEWIJS.md'), 'een afdruk van een register is niet de bron');
  const idx = require('../KENNISINDEX.json');
  assert.ok(idx.kop.overgeslagen.some(o => o.pad === 'BEWIJS.md'), 'en het register zegt dat hij is overgeslagen');
});
