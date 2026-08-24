/* DE WERELD VAN DE IDEMPOTENTIEPROEF (TAKEN.md 4.30), los van een server.

   scripts/lib/idemwereld.js zet voor de idemproef een echte wereld klaar --
   rekening, saldo, pas, vaste betaling, twee klompjes -- zodat de geldroutes
   werk DOEN in plaats van 404 te geven. Een route die niets doet, kun je niet
   betrappen op een tweede keer doen.

   WAT HIER HET ZWAARST WEEGT, en dat zijn twee dingen die precies tegengesteld
   voelen maar hetzelfde bewaken:

     1. Een route waarvan de wereld het benodigde stuk NIET heeft opgeleverd,
        krijgt GEEN half lijf. Anders reist er een `id: null` mee en strandt de
        route op een andere plek dan zonder deze laag -- de meting verschuift dan
        zonder dat iemand het ziet.
     2. `soort` en `id` gaan NOOIT in het gedeelde lijf. `bank/pas/uitgeven`
        bedoelt met `soort` een paskaartsoort en `bank/rekening/open` een
        rekeningsoort; een gedeelde waarde zou drieduizend andere routes een
        ander lijf geven en alle registers in een keer laten schuiven.

   Draai los: node --test test/idemwereld.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { zetWereldKlaar, gedeeldLijf, geldLijf } = require('../scripts/lib/idemwereld');

/* Een nepserver: elk pad geeft terug wat het echte huis teruggeeft, maar dan
   zonder huis. Alleen de vorm doet ertoe -- de echte ronde meet de rest. */
function nepPost(antwoorden, journaal) {
  return async (pad, lijf, tok) => {
    if (journaal) journaal.push({ pad, lijf, tok });
    const a = antwoorden[pad];
    return { status: 200, data: typeof a === 'function' ? a(lijf, tok) : (a || { ok: true }) };
  };
}
const VOLLEDIG = {
  '/api/bank/akkoord': (l, tok) => ({ rekening: { iban: tok === 'ander' ? 'NL00TWEE' : 'NL00EEN' } }),
  '/api/login': { token: 'ander' },
  '/api/pay/overzicht': (l, tok) => ({ codenaam: tok === 'ander' ? 'Gouden Ibis' : 'Amberen Vos' }),
  '/api/bank/rekening/open': { rekening: { iban: 'NL00SPAAR' } },
  '/api/bank/pas/uitgeven': { pas: { id: 'PAS1' } },
  '/api/bank/terugkerend/zet': { terugkerend: { id: 'TK1' } },
  '/api/pay/verzoek': (l, tok) => ({ verzoeken: [{ id: tok === 'ander' ? 'VZAANMIJ' : 'VZVANMIJ' }] }),
  '/api/pay/kascode': { code: 'ABC123' },
  '/api/pay/tikcode': { code: 'TIK999' },
  '/api/state': { state: { invoices: [{ id: 'RTG-2026-0001', status: 'paid' }, { id: 'RTG-2026-0002', status: 'open' }] } }
};

test('de keten levert alle stukken op die de geldroutes nodig hebben', async () => {
  const { wereld, extra, perRoute } = await zetWereldKlaar({
    post: nepPost(VOLLEDIG), tokens: { member: 'lid', office: 'kantoor' } });
  assert.equal(wereld.iban, 'NL00EEN');
  assert.equal(wereld.iban2, 'NL00TWEE', 'het tweede lid heeft een eigen rekening');
  assert.equal(wereld.spaarIban, 'NL00SPAAR');
  assert.equal(wereld.pasId, 'PAS1');
  assert.equal(wereld.terugkerendId, 'TK1');
  assert.equal(wereld.tikcode, 'TIK999');
  assert.equal(wereld.factuurId, 'RTG-2026-0002', 'de OPENSTAANDE factuur, niet de eerste de beste');
  assert.equal(Object.keys(perRoute).length, 20, 'twintig geldroutes krijgen een eigen lijf');
  assert.deepEqual(extra, { iban: 'NL00EEN', aan: 'Gouden Ibis', codenaam: 'Gouden Ibis',
    naarCodenaam: 'Gouden Ibis', code: 'ABC123' });
});

test('de tikcode komt van de ANDER, want je eigen tik weigert de kern', () => {
  /* `pay/tik` betaalt naar de eigenaar van de code. Met een eigen tikcode geeft
     de kern terecht "Dit is je eigen tik", en met de KASCODE (een andere
     codesoort) een 404 -- zo bleef die route staan op ongemeten. */
  const journaal = [];
  const nep = nepPost(VOLLEDIG, journaal);
  return zetWereldKlaar({ post: nep, tokens: { member: 'lid', office: 'kantoor' } }).then(({ perRoute }) => {
    const tik = journaal.find(x => x.pad === '/api/pay/tikcode');
    assert.ok(tik, 'er wordt een tikcode gehaald');
    assert.equal(tik.tok, 'ander', 'en wel bij het tweede lid');
    assert.equal(perRoute['/api/pay/tik'].code, 'TIK999');
    assert.notEqual(perRoute['/api/pay/tik'].code, 'ABC123', 'niet de kascode');
  });
});

test('TWEE klompjes, want betalen en intrekken vragen tegengestelde kanten', () => {
  /* Je kunt geen verzoek intrekken dat je zelf moet betalen. Met een klompje
     bleef de andere route op 404 staan -- gemeten, dat was de eerste vorm. */
  const p = geldLijf({ cn2: 'X', verzoekAanMij: 'A', verzoekVanMij: 'B' });
  assert.deepEqual(p['/api/pay/verzoek/betaal'], { id: 'A' });
  assert.deepEqual(p['/api/pay/verzoek/intrek'], { id: 'B' });
});

test('DE HALVE-LIJF-REGEL: een route zonder zijn stuk krijgt niets in plaats van null', () => {
  /* Dit is de belangrijkste van dit stel. Zou `pas/betaal` een lijf met
     `id: null` krijgen, dan strandt hij op "de pas bestaat niet" in plaats van
     op wat er zonder deze laag zou gebeuren -- en dan meet de proef iets anders
     dan hij denkt te meten, zonder dat het ergens uitkomt. */
  const zonderPas = geldLijf({ iban: 'NL00EEN', iban2: 'NL00TWEE', cn2: 'X' });
  assert.equal(zonderPas['/api/bank/pas/betaal'], undefined, 'geen pas -> geen lijf');
  assert.equal(zonderPas['/api/bank/pas/sluit'], undefined);
  assert.ok(zonderPas['/api/bank/overboek'], 'maar wat er wel is, gaat gewoon door');
  assert.equal(zonderPas['/api/bank/spaardoel'], undefined, 'geen spaarrekening -> geen spaardoel');
});

test('`soort` en `id` blijven uit het GEDEELDE lijf', () => {
  /* Een gedeelde `soort` zou bank/rekening/open en bank/pas/uitgeven met elkaar
     verwarren en meteen drieduizend andere routes een ander lijf geven. Ze horen
     per route, en daar staan ze ook. */
  const g = gedeeldLijf({ iban: 'NL00EEN', cn2: 'X', code: 'C', pasId: 'PAS1', spaarIban: 'NL00SPAAR' });
  assert.equal(g.soort, undefined);
  assert.equal(g.id, undefined);
  assert.equal(g.pasId, undefined, 'ook niet onder een andere naam');
  const p = geldLijf({ iban: 'NL00EEN', spaarIban: 'NL00SPAAR', pasId: 'PAS1', iban2: 'NL00TWEE', cn2: 'X' });
  assert.equal(p['/api/bank/pas/uitgeven'].soort, 'debit', 'een paskaartsoort');
  assert.equal(p['/api/bank/rekening/open'].soort, 'spaar', 'en een rekeningsoort, allebei op hun eigen plek');
});

test('DE KREDIETROUTES WORDEN NIET OPENGEBROKEN', () => {
  /* Die geven 503 met "hiervoor is een vergunning nodig die nog niet is
     vastgelegd" -- een bewuste, eerlijke stop. Een proef die zijn eigen
     meetobject openbreekt om een getal te halen, meet niets meer. Ze horen
     ongemeten te blijven, en dus mag hier geen lijf voor ze staan. */
  const p = geldLijf({ iban: 'NL00EEN', iban2: 'NL00TWEE', spaarIban: 'NL00SPAAR', pasId: 'PAS1',
    terugkerendId: 'TK1', cn2: 'X', verzoekAanMij: 'A', verzoekVanMij: 'B' });
  for (const pad of ['/api/bank/krediet', '/api/bank/krediet/aanvraag', '/api/bank/krediet/aflossing']) {
    assert.equal(p[pad], undefined, pad + ' hoort niet in de lijst te staan');
  }
});

test('de bank gaat LIVE voor er iets anders gebeurt', async () => {
  /* In een verse database staat de leden-bank niet live, en dan geven 31
     bankroutes een 403 -- voor alle stappen hieronder. De volgorde is dus de
     inhoud, niet een detail. */
  const journaal = [];
  await zetWereldKlaar({ post: nepPost(VOLLEDIG, journaal), tokens: { member: 'lid', office: 'kantoor' } });
  assert.equal(journaal[0].pad, '/api/office/bank/leden');
  assert.deepEqual(journaal[0].lijf, { aan: true });
  assert.equal(journaal[0].tok, 'kantoor', 'en dat kan alleen het kantoor');
  const opStap = journaal.findIndex(x => x.pad === '/api/bank/storten');
  const opRekening = journaal.findIndex(x => x.pad === '/api/bank/pas/uitgeven');
  assert.ok(opStap > 0 && opRekening > opStap, 'eerst saldo, dan de pas erop');
});

test('een wereld die niets oplevert laat de proef meten als vanouds', async () => {
  /* Geen uitzondering, geen halve waarheid: geeft het huis niets terug, dan
     krijgt de proef geen verzonnen waarden. Wat overblijft is alleen wat NIETS
     uit de wereld nodig had -- `rekening/open` vraagt om een geldige
     rekeningsoort en verder niets, en die mag gewoon blijven staan. */
  const { extra, perRoute } = await zetWereldKlaar({ post: async () => ({ status: 500, data: {} }),
    tokens: { member: 'lid', office: 'kantoor' } });
  assert.deepEqual(extra, {});
  assert.deepEqual(Object.keys(perRoute), ['/api/bank/rekening/open']);
});

test('de halve-lijf-regel kijkt ook IN lijsten en posten', () => {
  /* Een platte controle liet `aan: [null]` erdoor -- een lijst is immers geen
     null -- en dan reisde er alsnog een lege ontvanger mee. Gemeten toen de
     toets hierboven een route te veel vond. */
  const p = geldLijf({ iban: 'NL00EEN' });   // geen tweede lid, dus geen cn2 en geen iban2
  assert.equal(p['/api/pay/verzoek'], undefined, 'aan: [null] is geen geldig lijf');
  assert.equal(p['/api/bank/bulk'], undefined, 'en posten[].naarIban: null ook niet');
  assert.equal(p['/api/bank/salaris'], undefined);
});
