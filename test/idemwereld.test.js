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
const fs = require('fs');
const path = require('path');
const { zetWereldKlaar, gedeeldLijf, geldLijf } = require('../scripts/lib/idemwereld');
const wereld = require('../scripts/lib/idemwereld');
const { alleRoutes } = require('../scripts/lib/routes');

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

/* ============================================================================
   WORDT ALLES WAT WORDT GEBOUWD OOK DOORGEGEVEN?

   Hierboven staat wat de wereld OPLEVERT; hieronder of het ook AANKOMT. Dat
   bleek een aparte vraag: `personeelToken` kwam gewoon klaar -- een leraar met
   een geldig token stond in de wereld -- maar werd nergens in een lijf gezet.
   Achttien schoolroutes gaven daardoor "Onbekende school of verkeerd
   personeel-token" terwijl het token bestond, en de melding NIET KLAARGEKOMEN
   zweeg, want het object was er wel.

   Dat is de stilste manier waarop deze proef onderrapporteert: geen fout, geen
   lege sleutel, geen melding. Alleen een kolom `ongemeten` die groter is dan hij
   hoeft te zijn -- en die kolom bepaalt in kern/isolatie/leesset.js wat er onder
   isolatie dichtgaat.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - `personeelToken` weer uit het schoollijf halen  -> A ZAKT (RAAK); dit is de
     bug waar deze toetsen voor zijn geschreven. DE EERSTE VERSIE VING HEM NIET:
     die nam aan dat elke sleutel op -Token een rol-token is en dus niet in een
     lijf hoeft, en `personeelToken` eindigt op -Token. De uitzondering hangt nu
     aan wat de code DOET (belandt hij in `tokens`?) en niet aan hoe hij heet.
   - `leerlingId` uit het schoollijf halen           -> A ZAKT (RAAK).
   - `tokens[genre] = ...` uit de genre-lus halen    -> B ZAKT (RAAK).
   - het voorvoegsel /api/lucht/ naar /api/luchthaven/ -> C ZAKT (RAAK).
   - `alleenRol` weghalen bij /api/overheid/ of /api/gemeente/ -> D ZAKT (RAAK).
   ========================================================================= */

const BRON = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'lib', 'idemwereld.js'), 'utf8');

/* De lijst VERWACHT staat in de bron en wordt niet geexporteerd; hem hier
   overtypen zou betekenen dat een nieuw voorwerp deze toets ontloopt. Hij wordt
   dus uit de bron gelezen, met de sleutelnaam als anker. */
function verwachteSleutels() {
  const blok = BRON.slice(BRON.indexOf('const VERWACHT = ['), BRON.indexOf('function gemist('));
  return [...blok.matchAll(/sleutel:\s*'([^']+)'/g)].map(m => m[1]);
}

/* Een wereld waarin ALLES is gelukt, zodat voorvoegselLijf() zijn volledige
   uitkomst geeft. De waarden zijn herkenbaar aan hun naam, zodat de toets kan
   zien WELKE sleutel waar terechtkwam. */
function volleWereld(sleutels) {
  const w = {};
  for (const k of sleutels) w[k] = 'X-' + k;
  /* De hulpsleutels die geen eigen VERWACHT-regel hebben maar wel voorwaarde
     zijn voor een lijf. Ze staan hier apart zodat zichtbaar blijft dat ze geen
     voorwerp zijn maar een bijproduct. */
  for (const k of ['gezinToken', 'schoolBeheerToken', 'beheerToken', 'lidToken', 'concern',
    'iban2', 'cn1', 'cn2', 'spaarIban', 'pasId', 'anderToken', 'rijkCode'])
    if (!w[k]) w[k] = 'X-' + k;
  return w;
}

test('A. elk gebouwd voorwerp wordt ook ergens doorgegeven', () => {
  const sleutels = verwachteSleutels();
  assert.ok(sleutels.length > 15, 'VERWACHT hoort gevuld te zijn; gelezen: ' + sleutels.length);

  const w = volleWereld(sleutels);
  const gebruikt = JSON.stringify([
    wereld.voorvoegselLijf(w),
    wereld.gedeeldLijf(w),
    wereld.geldLijf(w)
  ]);

  /* WELKE SLEUTELS ALS ROL MEEGAAN IN PLAATS VAN IN EEN LIJF. Die hoeven niet
     in een lijf te staan -- ze worden aan `tokens` toegevoegd en de proef kiest
     ze op rol. Maar de uitzondering moet SMAL zijn: hij geldt alleen voor
     sleutels die aantoonbaar in `tokens` belanden.

     DE EERSTE VERSIE VAN DEZE TOETS LIET HIER DE BUG DOOR waarvoor hij is
     geschreven. Hij nam aan dat elke sleutel op -Token een rol-token was, en
     `personeelToken` eindigt op -Token. Die sleutel gaat NIET naar `tokens`: hij
     hoort in een lijf, en dat is precies wat er ontbrak. Een uitzondering op een
     NAAM in plaats van op wat de code doet, is hoe een toets zijn eigen
     onderwerp mist. */
  const alsRol = new Set();
  for (const m of BRON.matchAll(/tokens\.(\w+)\s*=\s*w\.(\w+)/g)) alsRol.add(m[2]);
  /* En de lus die er meer in een keer zet: de sleutelnaam staat daar in de
     middelste kolom van de tabel waarover hij loopt. */
  const lus = BRON.slice(BRON.indexOf('for (const [genre, sleutel, naam] of ['));
  if (lus) for (const m of lus.slice(0, 600).matchAll(/'(\w+Token)'/g)) alsRol.add(m[1]);

  const ongebruikt = sleutels.filter(k => {
    if (gebruikt.includes('X-' + k)) return false;
    return !alsRol.has(k);
  });

  assert.deepEqual(ongebruikt, [],
    'deze voorwerpen worden gebouwd en nergens doorgegeven: ' + ongebruikt.join(', ') +
    ' -- dat is de stilste manier waarop deze proef onderrapporteert');
});

test('B. een voorvoegsel met een rol wijst naar een token dat de opbouw ook zet', () => {
  const sleutels = verwachteSleutels();
  const w = volleWereld(sleutels);
  const rollen = [...new Set(wereld.voorvoegselLijf(w).map(v => v.rol).filter(Boolean))];
  assert.ok(rollen.length >= 4, 'er horen rol-voorvoegsels te zijn; gevonden: ' + rollen.join(', '));

  for (const rol of rollen) {
    /* `member`, `office`, `supplier`, `boardroom` en de andere basisrollen komen
       uit scripts/lib/proefsleutels.js en worden niet door de wereld gezet. Wat
       deze toets bewaakt zijn de rollen die de WERELD aanmaakt. */
    if (['member', 'office', 'supplier', 'boardroom', 'techniek', 'werkplekbaas', 'scim'].includes(rol)) continue;
    const gezet = new RegExp("tokens\\." + rol + "\\s*=|tokens\\[genre\\]\\s*=|tokens\\['" + rol + "'\\]").test(BRON);
    assert.ok(gezet, 'de rol "' + rol + '" wordt als voorvoegsel doorgegeven maar nergens in ' +
      '`tokens` gezet; dan roept de proef die routes ZONDER token aan');
  }
});

test('C. elk voorvoegsel wijst naar routes die bestaan', () => {
  const sleutels = verwachteSleutels();
  const w = volleWereld(sleutels);
  const paden = alleRoutes().map(r => r.pad);
  const leeg = [];
  for (const v of wereld.voorvoegselLijf(w)) {
    const raak = paden.filter(p => p.startsWith(v.voorvoegsel)).length;
    if (!raak) leeg.push(v.voorvoegsel);
  }
  assert.deepEqual(leeg, [],
    'deze voorvoegsels raken geen enkele route: ' + leeg.join(', ') +
    ' -- een pad dat nergens heen wijst, meet niets en zegt dat niet');
});

test('D. een voorvoegsel dat een rol oplegt, doet dat niet aan twee publieken tegelijk', () => {
  /* DE INVARIANT DIE DEZE HELE RONDE OPLEVERDE. Een voorvoegsel mag de rol
     overnemen -- /api/overheid/ hoort bij het rijk, dus het rijkstoken hoort daar.
     Maar onder datzelfde voorvoegsel wonen 33 routes voor een BURGER, en die
     kregen dat token ook. Alle 33 antwoordden "Niet ingelogd als lid" en stonden
     in de kolom `ongemeten` om een reden die niets met de route te maken had.

     Dat is niet te zien aan de uitslag: een 401 ziet eruit als een route die nu
     eenmaal een andere sleutel wil. Het viel alleen op doordat /api/gemeente/
     dezelfde fout herhaalde en daarbij vijf routes van GEMETEN naar ONGEMETEN
     duwde -- een toevoeging die de meting verslechtert is het ergste wat hier kan
     gebeuren, want hij ziet er van buiten uit als vooruitgang.

     De regel: legt een voorvoegsel een rol op, dan moet hij of maar EEN soort
     actor bedienen, of met `alleenRol` zeggen welke. */
  const sleutels = verwachteSleutels();
  const w = volleWereld(sleutels);
  const routes = alleRoutes().filter(r => r.methode !== 'GET');

  /* De rol per route komt uit de proefuitslag: dat is dezelfde bron als waar de
     proef zelf zijn token op kiest. Ontbreekt hij, dan telt de route niet mee --
     over een route die nooit is aangeroepen valt hier niets te zeggen. */
  let rolVan = {};
  try {
    const proef = require('../IDEMPROEF.json').perRoute || {};
    for (const r of Object.values(proef)) if (r.rol) rolVan[r.pad] = r.rol;
  } catch (e) { rolVan = {}; }
  if (!Object.keys(rolVan).length) return;   // geen uitslag om op te steunen

  const gemengd = [];
  for (const v of wereld.voorvoegselLijf(w)) {
    if (!v.rol || v.alleenRol) continue;
    const rollen = new Set();
    for (const r of routes) if (r.pad.startsWith(v.voorvoegsel) && rolVan[r.pad]) rollen.add(rolVan[r.pad]);
    if (rollen.size > 1) gemengd.push(v.voorvoegsel + ' bedient ' + [...rollen].join(' en '));
  }
  assert.deepEqual(gemengd, [],
    'deze voorvoegsels leggen een rol op aan meer dan een soort actor: ' + gemengd.join('; ') +
    ' -- zet er `alleenRol` bij, anders krijgt het verkeerde publiek het verkeerde token');
});
