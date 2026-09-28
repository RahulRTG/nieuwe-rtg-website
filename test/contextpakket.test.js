/* ============================================================================
   DE CONTEXTSAMENSTELLER -- nooit stil afkappen.

   Een eigen modelserver kapt stil af wat niet in zijn venster past, vanaf het
   begin, en daar staat de grondwet. server/kern/ai/contextpakket.js stelt per
   verzoek een pakket samen dat past, en zegt wat hij heeft ingekort of
   weggelaten; server/local-ai.js weigert wat toch niet past. Elke toets
   hieronder gaat over een regel die zonder hem stil zou verdwijnen.

   Nagetrokken met mutaties (elk zakt minstens een toets):
     a. de gesprek-gatenregel eruit            -> toets 4 zakt
     a2. oude lusstappen mogen weer vervallen  -> toets 9 zakt
     b. `magSamenvatten` genegeerd             -> toets 5 en 9 zakken
     c. onbekende promptdelen niet verplicht   -> toets 6 zakt
     d. de weigering in local-ai.js eruit      -> toets 10 zakt
     e. vensterVan telt ook `aangenomen`       -> toets 11 zakt

   Draai los: node --test test/contextpakket.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { stelContextSamen, schatTokens, vensterVan } = require('../server/kern/ai/contextpakket');
const { chatPakket, gesprekVan } = require('../server/kern/ai/chatpakket');
const { lusPakket } = require('../server/kern/stuur/luspakket');
const RAHUL_KARAKTER = require('../server/kern/ai/karakter');
const { TAALREGELS } = require('../server/kern/rahul/taal');
const LocalAI = require('../server/local-ai');

const tekst = (n, t) => (t || 'x').repeat(n);
const DELEN = [...RAHUL_KARAKTER, ...TAALREGELS, 'Register: rustig.', 'Het lid: Amberen Vos (RTG Pass).',
  'Openstaande betalingen: Hotel (€ 400); Vlucht (€ 900). Wijs daar alleen op als het relevant is.',
  'Je helpt het lid met reisvoorbereiding. Antwoord in het Nederlands.'];
const gesprek = (n, laatste) => {
  const c = [];
  for (let i = 0; i < n; i++) c.push({ from: i % 2 ? 'rahul' : 'member', text: 'beurt ' + i + ' ' + tekst(900) });
  c.push({ from: 'member', text: laatste || 'Wat moet ik inpakken?' });
  return c;
};

test('1. een plafond is geen quota: wat een soort niet nodig heeft, wordt niet gevuld', () => {
  const p = stelContextSamen({ venster: 12288, blokken: [
    { id: 'regel', soort: 'grondwet', verplicht: true, tekst: 'Verzin niets.' },
    { id: 'feit', soort: 'feiten', tekst: 'De reis is op vrijdag.' }] });
  assert.equal(p.ok, true);
  assert.equal(p.verantwoording.gebruikt, schatTokens('Verzin niets.') + schatTokens('De reis is op vrijdag.'));
  assert.equal(p.system, 'Verzin niets.\nDe reis is op vrijdag.');
  assert.deepEqual(p.verantwoording.weggelaten, []);
});

test('2. verplicht gaat altijd mee, ook boven zijn plafond -- en dat staat erbij', () => {
  const groot = tekst(6000);
  const p = stelContextSamen({ venster: 12288, blokken: [{ id: 'grondwet', soort: 'grondwet', verplicht: true, tekst: groot }] });
  assert.equal(p.ok, true);
  assert.ok(p.system.includes(groot));
  assert.equal(p.verantwoording.perSoort.grondwet.boven, true);
});

test('3. past zelfs het verplichte deel niet, dan CONTEXT_PAST_NIET en geen afgekapt pakket', () => {
  const p = stelContextSamen({ venster: 2048, antwoord: 1024, blokken: [
    { id: 'grondwet', soort: 'grondwet', verplicht: true, tekst: tekst(6000) }] });
  assert.equal(p.ok, false);
  assert.equal(p.code, 'CONTEXT_PAST_NIET');
  assert.ok(p.tekort > 0);
  assert.equal(p.system, undefined, 'een weigering levert geen half pakket');
  assert.match(p.uitleg, /LOCAL_AI_CONTEXT/);
});

test('4. het gesprek valt weg van oud naar nieuw, zonder gaten, en begint bij de mens', () => {
  const p = chatPakket({ delen: DELEN, convo: gesprek(12), venster: 8192, antwoord: 1024, toon: { rtg: 'Register: rustig.' } });
  assert.equal(p.ok, true);
  const nummers = p.messages.map(m => /^beurt (\d+)/.exec(m.content)).filter(Boolean).map(m => Number(m[1]));
  for (let i = 1; i < nummers.length; i++) assert.equal(nummers[i], nummers[i - 1] + 1, 'geen gaten in het gesprek');
  assert.equal(p.messages[0].role, 'user');
  assert.equal(p.messages[p.messages.length - 1].content, 'Wat moet ik inpakken?', 'de opdracht blijft altijd');
  assert.ok(p.verantwoording.weggelaten.some(w => w.id === 'gesprek.0'), 'de oudste beurt ging als eerste');

  /* De scherpe vorm: een grote beurt in het midden past niet, de kleine
     ervoor wel. Zonder de gatenregel blijven die oudere beurten staan en praat
     het model tegen een gesprek met een gat erin. */
  const convo = [{ from: 'member', text: 'beurt 0 kort' }, { from: 'rahul', text: 'beurt 1 kort' },
    { from: 'member', text: 'beurt 2 ' + tekst(6000) }, { from: 'rahul', text: 'beurt 3 kort' },
    { from: 'member', text: 'Wat moet ik inpakken?' }];
  const g = chatPakket({ delen: DELEN, convo, venster: 4096, antwoord: 1024, toon: {} });
  const over = g.messages.map(m => /^beurt (\d+)/.exec(m.content)).filter(Boolean).map(m => Number(m[1]));
  assert.deepEqual(over, [3].filter(n => over.includes(n)), 'na een weggevallen beurt valt alles wat ouder is ook weg');
  assert.ok(!over.includes(0) && !over.includes(1));
});

test('5. openstaande betalingen worden ingekort, nooit verzwegen', () => {
  /* Veel betalingen: de regel past niet onder het plafond van de feiten. Hij
     mag korter, maar het model mag nooit lezen dat er niets openstaat. */
  const veel = 'Openstaande betalingen: ' + Array.from({ length: 200 }, (_, i) => 'Factuur ' + i + ' (€ ' + (100 + i) + ')').join('; ') + '.';
  const delen = DELEN.map(d => d.startsWith('Openstaande betalingen: ') ? veel : d);
  const p = chatPakket({ delen, convo: gesprek(0), venster: 4096, antwoord: 1024, toon: {} });
  assert.equal(p.ok, true);
  assert.ok(!p.system.includes(veel), 'de lange regel paste niet en is dus niet heel meegegaan');
  assert.match(p.system, /Er staan betalingen open/, 'hij is ingekort tot een zin die zegt dat ze er zijn');
  assert.ok(p.verantwoording.ingekort.some(w => w.soort === 'feiten'), 'en dat staat in de verantwoording');
  assert.doesNotMatch(p.system, /Er staan geen betalingen open/);
});

test('6. een promptdeel dat niet herkend wordt, is verplichte grondwet', () => {
  /* Lang genoeg om als los blok van welke andere soort ook boven het plafond
     te komen: alleen verplicht houdt hem erin. */
  const nieuw = 'Een regel die morgen in prompt.js komt en die niemand heeft ingedeeld. ' + tekst(4000, 'r');
  const p = chatPakket({ delen: [...DELEN, nieuw], convo: gesprek(0), venster: 4096, antwoord: 1024, toon: {} });
  assert.equal(p.ok, true);
  assert.ok(p.system.includes(nieuw), 'onbekende tekst wordt nooit weggelaten');
});

test('7. het levensverhaal wijkt, behalve als het lid naar Rahul zelf vraagt', () => {
  const verhaal = RAHUL_KARAKTER[RAHUL_KARAKTER.length - 2];
  const gewoon = chatPakket({ delen: DELEN, convo: gesprek(0), venster: 12288, antwoord: 1024, toon: {} });
  const overHem = chatPakket({ delen: DELEN, convo: gesprek(0, 'Waar kom je eigenlijk vandaan, Rahul?'), venster: 12288, antwoord: 1024, toon: {} });
  assert.ok(!gewoon.system.includes(verhaal));
  assert.ok(overHem.system.includes(verhaal));
  assert.ok(gewoon.system.includes(RAHUL_KARAKTER[1]), 'de kern van zijn karakter blijft altijd');
});

test('8. zonder verklaard venster verandert er niets aan wat het model krijgt', () => {
  const convo = gesprek(14);
  const p = chatPakket({ delen: DELEN, convo, venster: null, antwoord: 1024, toon: {} });
  assert.equal(p.system, DELEN.join('\n'));
  assert.deepEqual(p.messages, gesprekVan(convo));
});

test('9. de stuurlus houdt paren heel, kort oude uitkomsten in, en laat de laatste staan', () => {
  const messages = [{ role: 'user', content: 'Zet de tandarts vrijdag om 14:00 in mijn agenda.' }];
  for (let i = 0; i < 4; i++) {
    messages.push({ role: 'assistant', content: [{ type: 'tool_use', id: 't' + i, name: 'doe', input: { pad: '/api/x' } }] });
    messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: 't' + i, content: 'uitkomst ' + i + ' ' + tekst(5900) }] });
  }
  const p = lusPakket({ systeem: 'Huisregels.', messages, tools: [{ name: 'doe' }], venster: 8192, antwoord: 1400 });
  assert.equal(p.ok, true);
  assert.equal(p.messages[0].content, messages[0].content, 'de opdracht blijft');
  const laatste = p.messages[p.messages.length - 1].content[0].content;
  assert.equal(laatste, messages[messages.length - 1].content[0].content, 'de laatste uitkomst blijft letterlijk');
  const gebruikt = new Set(p.messages.filter(m => m.role === 'assistant').flatMap(m => m.content.map(c => c.id)));
  const beantwoord = p.messages.filter(m => m.role === 'user' && Array.isArray(m.content)).flatMap(m => m.content.map(c => c.tool_use_id));
  assert.deepEqual([...gebruikt].sort(), beantwoord.sort(), 'elke tool_result heeft zijn tool_use');
  assert.ok(p.messages.some(m => Array.isArray(m.content) && m.content.some(c => /ingekort door de contextsamensteller/.test(c.content || ''))),
    'een ingekorte uitkomst draagt de markering, zodat het model weet dat er meer was');
  assert.deepEqual([...gebruikt].sort(), ['t0', 't1', 't2', 't3'],
    'geen enkele eerdere stap verdwijnt: wat het model al deed, moet het blijven zien');
});

/* Een nagemaakte modelserver die telt hoeveel verzoeken hem bereiken. */
function modelserver() {
  let aantal = 0;
  const server = http.createServer((req, res) => {
    aantal++;
    req.resume();
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 300, completion_tokens: 2 } }));
    });
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ server, poort: server.address().port, aantal: () => aantal })));
}
const client = (poort, extra) => new LocalAI(Object.assign({ baseURL: 'http://127.0.0.1:' + poort, model: 'm', timeout: 3000 }, extra));

test('10. een verklaard venster: wat niet past gaat niet de deur uit', async () => {
  const s = await modelserver();
  try {
    const c = client(s.poort, { contextVenster: 2048 });
    await assert.rejects(c.messages.create({ max_tokens: 1024, system: tekst(6000), messages: [{ role: 'user', content: 'hoi' }] }),
      (e) => e.code === 'CONTEXT_PAST_NIET');
    assert.equal(s.aantal(), 0, 'de server heeft niets ontvangen');
    assert.equal(c.staat().context.geweigerd, 1);
  } finally { s.server.close(); }
});

test('11. een aangenomen venster telt mee en dwingt niets af (schaduw)', async () => {
  const s = await modelserver();
  try {
    const c = client(s.poort, { contextVenster: '' });
    assert.equal(c.venster.herkomst, 'aangenomen');
    await c.messages.create({ max_tokens: 1024, system: tekst(12000), messages: [{ role: 'user', content: 'hoi' }] });
    assert.equal(s.aantal(), 1, 'zonder verklaring gaat het verzoek gewoon door');
    const st = c.staat();
    assert.equal(st.context.zouNietPassen, 1);
    assert.equal(st.context.geteld, 300, 'de telling van de server wordt naast de schatting gelegd');
    assert.equal(vensterVan({ providerInfo: [{ venster: c.venster }] }), null, 'een aangenomen venster stuurt de samensteller niet');
    assert.equal(vensterVan({ providerInfo: [{ venster: { tokens: 8192, herkomst: 'verklaard' } }, { venster: null }] }), 8192);
  } finally { s.server.close(); }
});

test('12. een onzinnig venster is een configuratiefout, geen stille standaard', () => {
  assert.throws(() => client(1, { contextVenster: '0' }), /LOCAL_AI_CONTEXT/);
  assert.throws(() => client(1, { contextVenster: 'veel' }), /LOCAL_AI_CONTEXT/);
});
