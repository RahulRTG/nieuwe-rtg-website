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

  const garantie = lijst.find(c => c.id === 'claim.member.price_guarantee');
  assert.equal(garantie.dekking, claims.DEKKING.GEBOUWD, 'het plafond is er, de rechtzetting niet');
  assert.match(garantie.kanttekening, /rechtgezet|terugbetaal/);

  const sociaal = lijst.find(c => c.id === 'claim.social.share');
  assert.equal(sociaal.dekking, claims.DEKKING.GEBOUWD,
    'de verdeling is afgedwongen, maar de uitbetaling wacht op RTF_IBAN -- ' +
    'een claim die op een lege omgevingsvariabele wacht, is niet afgedwongen');
});
