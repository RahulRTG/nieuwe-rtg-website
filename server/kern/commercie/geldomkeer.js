/* WAT "OMKEERBAAR" BETEKENT PER GELDHANDELING EN PER RAIL -- een gesloten tabel.

   Eigenaarsbesluit 2B-aangepast, met de aanvulling van 11 oktober 2026: vanaf de
   omkeerbaarheidsgrens van ./besluit.js gaat een geldhandeling alleen door als zij
   AANTOONBAAR terug te draaien is. Een tweede handtekening maakt dat niet waar, en
   "een teruggave is per definitie onomkeerbaar" ook niet: het wordt per handeling en
   per rail uit de CODE afgeleid, met een grond die je kunt nalopen. Deze tabel is daar
   de ENIGE plek voor; kern/kantoor/geldketen/klaarzet.js leest hem, en een aanroeper
   kan hem niet overschrijven.

   VIER VRAGEN PER RAIL, want "omkeerbaar" is anders een gevoel:
     mechanisme  hoe zou RTG het effect ongedaan maken -- een tegenboeking binnen het
                 huis, een terugvordering bij de ontvanger, een chargeback, of niets
     soort       wat dat oplevert, in de woorden van HERSTELPROEF.json en
                 ../handelingsklasse/omkeerbaar.js: `exact`, `compensatie` of
                 `geen-herstel`. Een tegenboeking laat twee regels in het grootboek
                 achter en is dus COMPENSATIE, nooit exact. De twee worden niet opgeteld.
     wie         wie het ongedaan maken BESLIST. Kan RTG het niet zelf, dan is het niet
                 aan RTG om het omkeerbaar te noemen.
     termijn     binnen welke tijd, of `null` met de reden als de code er niets over zegt

   DE AFLEIDREGEL, en dat is de enige regel in dit bestand die een keuze is:
   omkeerbaar = de ontvanger is een EIGEN positie van RTG, RTG beslist alleen, en het
   mechanisme is een tegenboeking binnen het huis. Alles wat bij een lid, een partner, een
   klant van RTG Bank of buiten het huis landt, vraagt die andere partij (terugvordering)
   of een derde (chargeback, bank) -- en is dus niet door RTG terug te draaien. Wat de tabel
   niet kent, is niet omkeerbaar, met de reden (fail-closed).

   UITKOMST VANDAAG: beide handelingen die door de geldketen lopen, zijn niet omkeerbaar.
   Niet omdat het zo hoort, maar omdat het geld in beide gevallen bij een ander belandt.
   Een handeling die naar een eigen positie van RTG boekt, zou hier wel omkeerbaar heten. */
'use strict';

const SOORTEN = Object.freeze(['exact', 'compensatie', 'geen-herstel']);

/* PER RAIL: wat er technisch kan, met de grond in de code. */
const RAILS = Object.freeze({
  'rtg-pay-intern': Object.freeze({
    wat: 'een boeking tussen twee posities in het grootboek van RTG Pay',
    mechanisme: 'tegenboeking binnen het huis', soort: 'compensatie',
    wie: 'RTG, maar alleen over geld op een EIGEN positie (rtg:*); geld op een lid- of partnerpositie is van die partij',
    termijn: null, termijnReden: 'geen termijn in de code; wel moet het saldo er nog staan (kern/pay/boeking.js#boekAsync weigert anders)',
    grond: 'server/kern/pay/boeking.js#pasToe: debet en credit in een keer; er is geen storno, alleen een nieuwe boeking in omgekeerde richting',
  }),
  'rtg-bank-intern': Object.freeze({
    wat: 'een boeking tussen twee rekeningen in RTG Bank',
    mechanisme: 'terugvordering bij de begunstigde', soort: 'compensatie',
    wie: 'de begunstigde: het geld staat op zijn rekening bij RTG Bank (kern/bank/incasso.js#zet eist rekMeta(naarIban))',
    termijn: null, termijnReden: 'er is geen storno van een interne boeking in server/kern/bank/; de teruggang in kern/bank/uitgang.js gaat over een uitbetaling die de BANK terugstuurt',
    grond: 'server/kern/bank/incasso.js#ronde boekt van t.vanIban naar t.naarIban via boekAsync',
  }),
  'sepa-uit': Object.freeze({
    wat: 'een overboeking naar een rekening buiten het huis',
    mechanisme: 'terugvordering via de bank (recall), met instemming van de begunstigde', soort: 'geen-herstel',
    wie: 'de begunstigde en zijn bank, niet RTG',
    termijn: null, termijnReden: 'de code kent geen recall; een verstuurde opdracht wordt alleen afgestemd (routes/kantoren/bank-afstemming.js)',
    grond: 'server/betaal/uitbetaling.js#startUitbetaling: RTG kan een verstuurde opdracht niet terughalen; een teruggang ' +
      '(betaalopdracht/terugboeking.js) komt alleen als de BANK het geld terugstuurt, en dat start RTG niet zelf',
  }),
  'kaart-provider': Object.freeze({
    wat: 'een betaling via een kaart- of betaalprovider',
    mechanisme: 'een refund is een NIEUWE betaling; een chargeback beslist de kaartuitgever', soort: 'compensatie',
    wie: 'RTG kan een refund starten; een chargeback beslist de uitgever van de kaart',
    termijn: null, termijnReden: 'termijnen zijn die van de provider en staan niet in de code',
    grond: 'server/betaal/naslag.js: refunds.create bij mollie, stripe en adyen',
  }),
  'synthetisch': Object.freeze({
    wat: 'de simulatierail van de testwereld (MAGNAATLAB.md)',
    mechanisme: 'geen: er beweegt geen echt geld, en de afloop `terugboeking` is een scenario van de BETALER', soort: 'geen-herstel',
    wie: 'niemand: alleen met RTG_SIMULATIEBANK=1 en nooit in productie',
    termijn: null, termijnReden: 'niet van toepassing',
    grond: 'server/betaal/synthetisch.js',
  }),
});

/* PER HANDELING die door de geldketen of het voornemen loopt: over welke rail, en waar
   het geld landt. `naar` is de soort ontvanger, uit de code -- niet uit de bedoeling. */
const HANDELINGEN = Object.freeze({
  GELD_TERUGGEVEN: Object.freeze({
    wat: 'de teruggave van een betaalde reis', rail: 'rtg-pay-intern', naar: 'lid',
    grond: 'server/kern/reisbureau-teruggave.js#uitvoeren -> kern/pay/verkoop.js#terugGave: van rtg:reisbureau naar het betaaladres van het lid (rekLid)',
  }),
  GELD_INNEN: Object.freeze({
    wat: 'de incassoronde: vaste betalingen van leden innen', rail: 'rtg-bank-intern', naar: 'klant',
    grond: 'server/kern/bank/incasso.js#ronde: van de rekening van het lid naar de begunstigde van zijn vaste betaling; een ' +
      'eigen positie van RTG kan geen begunstigde zijn (rekMeta in #zet, en kern/bank rekent rtg: tot extern)',
  }),
});

/* DE AFLEIDREGEL, los zodat zij ook in haar ja-tak te toetsen is: vandaag geeft geen
   handeling uit de tabel `true`, en een tak die nooit loopt is anders dode code. */
function afleid(h, r) {
  return !!h && !!r && h.naar === 'rtg' && r.mechanisme === 'tegenboeking binnen het huis';
}

/* Is deze handeling terug te draaien? Altijd met de reden, en alleen `true` als de
   afleidregel in de kop het zegt. Een onbekende handeling of rail is `false`. */
function voor(handeling) {
  const h = HANDELINGEN[String(handeling || '')];
  if (!h) return { omkeerbaar: false, soort: 'geen-herstel', mechanisme: null, rail: null,
    reden: 'Deze handeling staat niet in de tabel van kern/commercie/geldomkeer.js; onbekend is niet omkeerbaar.' };
  const r = RAILS[h.rail];
  if (!r) return { omkeerbaar: false, soort: 'geen-herstel', mechanisme: null, rail: h.rail,
    reden: 'De rail "' + h.rail + '" staat niet in de tabel; onbekend is niet omkeerbaar.' };
  const omkeerbaar = afleid(h, r);
  return { omkeerbaar, soort: r.soort, mechanisme: r.mechanisme, rail: h.rail, naar: h.naar, wie: r.wie,
    termijn: r.termijn, grond: [h.grond, r.grond],
    reden: omkeerbaar
      ? 'Het geld landt op een eigen positie van RTG en RTG kan het alleen terugboeken (' + r.soort + ', geen exact herstel).'
      : 'Het geld landt bij ' + ({ lid: 'een lid', klant: 'een klant van RTG Bank', partner: 'een partner' }[h.naar] || h.naar) +
        '; ongedaan maken is ' + r.mechanisme + ' en dat beslist ' + r.wie.split(',')[0] + ', niet RTG alleen.' };
}

module.exports = { voor, afleid, RAILS, HANDELINGEN, SOORTEN };
