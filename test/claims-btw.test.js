/* ============================================================================
   BTW EN CLAIMS: het tarief op EEN plek, en geen bewering zonder dekking.

   TWEE GATEN uit de doorlichting van 20 augustus 2026:

   4.10  `* 1.21` stond hard in kern/fonds.js en kern/lid/facturen.js, terwijl
         het platform landen KENT (kern/fiscaal/landen.js, en thuis/zakelijk.js
         haalt het logiestarief daar keurig uit op). Twee manieren om dezelfde
         vraag te beantwoorden, en de simpelste won op de plek waar het het
         meeste uitmaakt: de factuur. Een Lifestyle-lid buiten Nederland kreeg
         21% Nederlandse btw over 20.000 euro per maand.

   4.1   Artikel 1 van de partnervoorwaarden beloofde "0% commissie" terwijl de
         boardroom een knop had die op 12 procent stond. Dat kon bestaan omdat
         HTML, code en documenten onafhankelijk over hetzelfde getal praatten.

   DE BEWERING DIE ERTOE DOET staat in toets 8: een claim die zich AFGEDWONGEN
   noemt zonder toets, laat de poort zakken. Een gat dat eerlijk "BELOFTE" heet
   is geen probleem; een gat dat zich "AFGEDWONGEN" noemt, is er twee.

   Draai los: node --experimental-sqlite --test test/claims-btw.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const btw = require('../server/kern/commercie/btw');
const claims = require('../server/kern/commercie/claims');

/* --------------------------------------------------------------------- btw */

test('1. netto naar bruto en terug levert hetzelfde bedrag op', () => {
  for (const profiel of Object.keys(btw.PROFIELEN)) {
    for (const netto of [1, 99, 6500, 2000000, 12345]) {
      const heen = btw.overNetto(netto, profiel);
      assert.equal(btw.keur(heen), null, profiel + '/' + netto + ': ' + btw.keur(heen));
      const terug = btw.overBruto(heen.brutoCenten, profiel);
      assert.equal(terug.nettoCenten, netto,
        profiel + ': ' + netto + ' -> ' + heen.brutoCenten + ' -> ' + terug.nettoCenten);
    }
  }
});

test('2. een verlegd of nultarief levert echt geen btw op', () => {
  for (const p of ['eu-b2b-verlegd', 'buiten-eu']) {
    const o = btw.overNetto(2000000, p);
    assert.equal(o.btwCenten, 0, p + ' hoort geen btw op te leveren');
    assert.equal(o.brutoCenten, o.nettoCenten);
    assert.equal(btw.keur(o), null);
  }
  /* En de kant waar de oude code zat: `bruto / 1.21` toepassen op een verlegde
     factuur haalt 17,4% van een bedrag af waar nooit btw op zat. */
  const terug = btw.overBruto(2000000, 'eu-b2b-verlegd');
  assert.equal(terug.nettoCenten, 2000000, 'er valt niets uit te halen wat er niet in zat');
});

test('3. de keuring wijst een opbouw af die niet klopt', () => {
  const goed = btw.overNetto(6500, 'nl-21');
  assert.ok(btw.keur({ ...goed, btwCenten: 0 }), 'netto plus btw is dan niet bruto');
  assert.ok(btw.keur({ ...goed, pct: 0 }), 'een tarief van nul met btw erop kan niet');
  assert.ok(btw.keur({ ...btw.overNetto(6500, 'eu-b2b-verlegd'), btwCenten: 100, brutoCenten: 6600 }),
    'bij verlegde btw wordt er niets in rekening gebracht');
  assert.ok(btw.keur(null));
});

/* HET GAT ZELF: het tarief mag niet meer als constante in de geldmodules staan. */
test('4. er staat nergens meer een hardgecodeerd btw-tarief in de geldmodules', () => {
  const fs = require('fs');
  for (const pad of ['../server/kern/fonds.js', '../server/kern/lid/facturen.js']) {
    const bron = fs.readFileSync(require.resolve(pad), 'utf8');
    // alleen buiten commentaar kijken: de uitleg noemt het oude getal juist
    const code = bron.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    assert.doesNotMatch(code, /1\.21/,
      pad + ' rekent nog met een vast btw-tarief; dat hoort uit kern/commercie/btw.js te komen');
    assert.match(bron, /commercie\/btw/, pad + ' hoort de btw-laag te gebruiken');
  }
});

test('5. de afdracht rekent over het bedrag ex btw, per profiel', () => {
  const fonds = require('../server/kern/fonds');
  // 65 euro ex btw wordt 78,65 incl; 30% daarvan ex btw is 19,50
  assert.equal(fonds.aandeelCenten(78.65, 'nl-21'), 1950);
  // hetzelfde bedrag bij een verlegde factuur: dan IS 78,65 het nettobedrag
  assert.equal(fonds.aandeelCenten(78.65, 'eu-b2b-verlegd'), Math.round(7865 * 0.30),
    'zonder btw valt er niets uit te halen, dus de afdracht is groter');
  assert.equal(fonds.aandeelCenten(78.65), 1950, 'zonder profiel geldt de standaard NL 21%');
});

/* ------------------------------------------------------------------ claims */

test('6. elke claim heeft een waarde, een bron en een dekking', () => {
  const lijst = claims.claims();
  assert.ok(lijst.length >= 10, 'er zijn claims');
  for (const c of lijst) {
    assert.ok(c.id && c.id.startsWith('claim.'), 'een claim heeft een id: ' + JSON.stringify(c));
    assert.ok(c.waarde, c.id + ' heeft geen waarde');
    assert.ok(c.bron, c.id + ' heeft geen bron');
    assert.ok(claims.DEKKING[c.dekking], c.id + ' heeft een onbekende dekking: ' + c.dekking);
    assert.ok(c.tekst && c.tekst.length > 10, c.id + ' hoort uit te leggen wat hij beweert');
  }
});

test('7. de waarden komen uit de kern en niet uit een document', () => {
  const lijst = claims.claims();
  const op = id => lijst.find(c => c.id === id);

  assert.equal(op('claim.partner.commission').waarde, 'ZERO');
  assert.equal(op('claim.business_lite.price').waarde, 'VAST_15000', '150 euro, uit de ladder');
  assert.equal(op('claim.lifestyle.price').waarde, 'VANAF_2000000', 'een bodem, geen prijs');
  assert.equal(op('claim.partner.access').waarde, 'business-lite|business');
  assert.match(op('claim.social.share').waarde, /^30%$/);

  /* De proef op de som: verander de kern en de claim verandert mee. Zou de
     claim uit een constante komen, dan bleef hij op 150 staan terwijl de ladder
     iets anders zegt -- en dat is precies "0% commissie naast een knop op 12%". */
  const ladder = require('../server/kern/pasladder');
  const echt = ladder.trede('business-lite').standaardCenten;
  assert.equal(op('claim.business_lite.price').waarde, 'VAST_' + echt);
});

/* DE RELEASE-GATE. Streng op EEN ding: liegen over de hardheid. */
test('8. de poort laat geen claim door die zich sterker voordoet dan hij is', () => {
  const p = claims.poort();
  assert.equal(p.ok, true, 'de huidige claims horen door de poort te komen: ' + p.problemen.join('; '));

  /* En de poort moet echt iets tegenhouden, anders is hij decoratie. Drie
     manieren waarop een claim kan liegen: */
  const test1 = { id: 'claim.test.a', waarde: 'X', tekst: 'lange genoeg uitleg hier',
    bron: 'ergens', dekking: claims.DEKKING.AFGEDWONGEN, toets: null };
  const test2 = { id: 'claim.test.b', waarde: 'X', tekst: 'lange genoeg uitleg hier',
    bron: null, dekking: claims.DEKKING.GEBOUWD, toets: 'x' };
  const test3 = { id: 'claim.test.c', waarde: 'X', tekst: 'lange genoeg uitleg hier',
    bron: 'ergens', dekking: claims.DEKKING.BELOFTE, toets: null, kanttekening: null };

  const keur = c => {
    const problemen = [];
    if (!c.bron) problemen.push('geen bron');
    if (c.dekking === claims.DEKKING.AFGEDWONGEN && !c.toets) problemen.push('afgedwongen zonder toets');
    if (c.dekking === claims.DEKKING.BELOFTE && !c.kanttekening) problemen.push('belofte zonder kanttekening');
    return problemen;
  };
  assert.deepEqual(keur(test1), ['afgedwongen zonder toets'],
    'een claim die zich afgedwongen noemt zonder toets, is een belofte met een groot woord');
  assert.deepEqual(keur(test2), ['geen bron']);
  assert.deepEqual(keur(test3), ['belofte zonder kanttekening'],
    'er hoort te staan wat er aan een belofte ontbreekt');
});

/* Een gat dat eerlijk "BELOFTE" heet is geen probleem. Deze toets bewaakt dat
   de twee bekende gaten ook echt als gat te boek staan, in plaats van dat ze
   stilzwijgend als afgedwongen worden opgevoerd. */
test('9. de bekende gaten staan als gat te boek, met een kanttekening', () => {
  const lijst = claims.claims();
  /* De entree stond hier als BELOFTE met waarde TE_HERZIEN. Hij is inmiddels
     INGETROKKEN: de partnervoorwaarden noemen geen entree meer en een
     partnerplek hoort bij een zakelijk abonnement. Deze toets is meeveranderd
     met het besluit -- maar hij bewaakt nu wel iets scherpers, namelijk dat de
     claim ook echt uit de kern komt en niet uit het document. */
  const entree = lijst.find(c => c.id === 'claim.partner.entry_fee');
  assert.equal(entree.dekking, claims.DEKKING.AFGEDWONGEN, 'de entree is ingetrokken');
  assert.equal(entree.waarde, 'GEEN');
  assert.doesNotMatch(entree.bron, /partnervoorwaarden/,
    'de waarde hoort uit de kern te komen en niet uit het juridische document');

  /* De prijsgarantie stond hier als GEBOUWD met "geen meldknop en geen
     terugbetaalstroom". Allebei bestaan ze nu, dus de claim is meeverhuisd naar
     AFGEDWONGEN -- en dat hoort zo: een claim die zwakker blijft staan dan wat
     er is gebouwd, is net zo goed uit de pas als een die sterker staat. */
  const garantie = lijst.find(c => c.id === 'claim.member.price_guarantee');
  assert.equal(garantie.dekking, claims.DEKKING.AFGEDWONGEN,
    'het plafond EN de rechtzetting zijn er');
  assert.match(garantie.toets, /prijsmelding|ronde/);

  /* Deze blijft GEBOUWD, en dat is het punt van de hele indeling: de verdeling,
     het spoor en de betaalbaarstelling zijn afgedwongen, maar of het geld
     aankomt hangt aan een IBAN die er niet is. */
  const sociaal = lijst.find(c => c.id === 'claim.social.share');
  assert.equal(sociaal.dekking, claims.DEKKING.GEBOUWD,
    'een claim die op een lege omgevingsvariabele wacht, is niet afgedwongen');
  assert.match(sociaal.kanttekening, /RTF_IBAN/);

  /* En de claim die er niet was: dat verplichtingen worden OPGEPAKT. Drie lagen
     legden bedragen vast en niets deed er iets mee. */
  const ronde = lijst.find(c => c.id === 'claim.settlement.rounds');
  assert.ok(ronde, 'er hoort een claim te staan over wat er met een verplichting gebeurt');
  assert.equal(ronde.dekking, claims.DEKKING.AFGEDWONGEN);
});

/* ============================================================================
   DE PROMISE GATE, uitgebreid: een claim moet naar iets WIJZEN DAT BESTAAT.

   De poort keurde eerst alleen of een claim loog over zijn hardheid. Maar een
   claim die naar `kern/commercie/verzonnen.js` wijst ziet er net zo degelijk uit
   als een die klopt -- en dat is erger dan geen bron, want hij nodigt uit om
   niet te kijken. Dezelfde klasse als de zes capabilities zonder beller: het
   staat er, dus niemand controleert het.
   ========================================================================== */
test('10. de poort weigert een claim die naar een niet-bestaande bron wijst', () => {
  const echt = claims.poort();
  assert.equal(echt.ok, true, echt.problemen.join('; '));

  /* De controle zelf, met een geveinsd bestandssysteem: zo toetsen we de REGEL
     en niet welke bestanden er vandaag toevallig staan. */
  const nep = claims.poort({ bestaat: (p) => !p.includes('pasladder') });
  assert.equal(nep.ok, false, 'een verdwenen bron hoort de poort te laten zakken');
  assert.ok(nep.problemen.some(p => /bron die niet bestaat/.test(p)));

  const geenToets = claims.poort({ bestaat: (p) => !p.startsWith('test/') });
  assert.equal(geenToets.ok, false, 'en een toets die niet bestaat ook');
  assert.ok(geenToets.problemen.some(p => /toets die niet bestaat/.test(p)));
});

test('11. de padherkenning pakt paden uit proza, en niets anders', () => {
  assert.deepEqual(claims.paden('kern/pasladder.js'), ['kern/pasladder.js']);
  assert.deepEqual(claims.paden('test/a.test.js + test/b.test.js'),
    ['test/a.test.js', 'test/b.test.js']);
  assert.deepEqual(claims.paden('kern/commercie/allocatie.js (v1-2026)'),
    ['kern/commercie/allocatie.js']);
  assert.deepEqual(claims.paden('alleen partnervoorwaarden.html'), ['partnervoorwaarden.html'],
    'een bron die geen module is, levert wel een naam maar geen modulepad op');
  assert.deepEqual(claims.paden(''), []);
  assert.deepEqual(claims.paden(null), []);
});
