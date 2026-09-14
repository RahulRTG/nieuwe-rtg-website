/* HET GEVOLGCONTRACT VAN DE MAANDFACTUUR UIT HET EIGEN SALDO.

   EIGEN DEEL OMDAT DE TEGENPARTIJ ANDERS IS. ./register-pay-oplaad.js en
   ./register-pay-stuur.js blijven binnen de wallet van leden; hier gaat geld van een lid
   naar de HUISREKENING van RTG (`extern:treasury`, buiten het gesloten circuit) en zet het
   de afdracht aan de RTFoundation in gang. Dat is het enige walletpad met drie partijen.

   DIT IS OOK HET PAD DAT OP 13 SEPTEMBER 2026 UIT DE LEZEN-LIJST IS GEHAALD. Het stond in
   de LEZEN-allowlist van kern/stuur/beleid-lijsten.js -- die belooft "haalt op en verandert
   niets" -- en was daarmee het enige geldpad van een lid dat het AI-stuur zonder
   bevestiging kon uitvoeren. Zie toets 4b van test/stuur-niveaus.test.js. Dit contract is
   waarom dat is opgevallen: je kunt geen gevolgcontract schrijven zonder te lezen wat een
   handeling doet.
   ========================================================================== */
'use strict';

/* DE GRAAD VAN DE NEGEN COLLECTIES IS OP 13 SEPTEMBER 2026 VAN `gemeten` NAAR `vermoed`
   GEGAAN, en dat is een CORRECTIE VAN MIJN EIGEN BEWERING -- niet een verzachting.

   Bij het schrijven van dit contract stond in IDEMPROEF.json dat de proef hier negen
   collecties zag bewegen, en dat is hier als bewijs gebruikt. Die negen waren VOORWERK: de
   pasladder-ijkoproep en de voorziening schreven ze, en de proef rekende dat aan deze route
   toe (zie de herijking in scripts/lib/idemproef.js). Na de reparatie is `opslag.a` van dit
   pad LEEG, en de stand is wat hij in beide rondes al was: `ongemeten` -- de proef kwam nooit
   bij de muterende code, want zonder openstaande factuur is er niets te betalen.

   DE KEURING HEEFT DAT ZELF GEVONDEN. ./keuring.js weigert een `gemeten` claim die de meting
   niet dekt, en na de hermeting zakte dit contract op alle negen regels. Precies waarvoor die
   poort bestaat, en hij heeft hem tegen de schrijver van het contract gebruikt.

   WAT ER NIET VERANDERT: dat deze handeling geld verplaatst. Dat staat in de BRON en niet in
   de meting -- routes/pay.js roept factuurSaldo aan, en kern/factuursaldo.js schrijft af via
   pay.huisIn, sluit de factuur via settleFactuur en boekt de 30%-afdracht. Ook de
   bevoegdheidsreparatie (van de LEZEN-lijst naar `voorstel`) staat daarop en niet op de
   meting. Wat wegvalt is een derde been dat er nooit was. */
const BRON = 'verklaard uit kern/factuursaldo.js en niet gemeten: de idempotentieproef komt ' +
  'hier niet bij de muterende code (geen openstaande factuur), dus over deze collectie bestaat ' +
  'geen meting.';

const FACTUUR = Object.freeze({
  '/api/pay/saldo': {
    capability: '/api/pay/saldo',
    classificatie: 'persoonsgegeven',
    streefstand: 'de factuur staat op betaald, het bedrag is van de wallet van het lid naar de ' +
      'huisrekening gegaan, en de afdracht aan de RTFoundation is geboekt -- of geen van drieen',
    /* SCHRIJVEN_ANDERMANS staat in NOOIT en dat is een keuze met een reden: het geld gaat naar
       `extern:treasury` en naar de fonds- en sociale afdrachtenboeken, en dat zijn boeken van
       het HUIS en niet de gegevens van een tweede mens. Er komt in deze handeling geen tweede
       lid voor. EXTERN_BEREIKEN ook: broadcastSync tikt alleen de eigen tier aan met
       'payments', er gaat geen mail, sms of push uit. */
    veroorzaakt: ['GELD_BEWEGEN', 'SCHRIJVEN_EIGEN', 'UITGAANDE_AANROEP'],
    nooit: ['SCHRIJVEN_ANDERMANS', 'EXTERN_BEREIKEN', 'RECHT_VERLENEN', 'IDENTITEIT_WIJZIGEN',
      'DERDENCODE_UITVOEREN', 'ONVERTROUWDE_BYTES', 'BEVEILIGING_VERZWAKKEN', 'BULK_UITVOER',
      'PLAFOND_WIJZIGEN'],
    voorwaarden: [
      { wat: 'een ledensessie en eenmalig het paspoort', bron: 'geenGast + onboarding.payGate in routes/pay.js' },
      { wat: 'de zekering `betalingen` staat aan', bron: 'db.data.techniek.zekeringen.betalingen -- de ' +
        'boardroom kan dit pad stilzetten, en dan is het 503 en niet een halve betaling' },
      { wat: 'de betaalkern is wakker', bron: 'payVan() -- late binding, anders 503' },
      { wat: 'een factuur die bestaat, nog niet `paid` is en waarop nog iets openstaat',
        bron: 'kern/factuursaldo.js: 404, 409 en 409 -- het openstaande bedrag is de bijdrage min ' +
          'wat de muntweg al als deelbetaling vulde' },
      { wat: 'geen tweede verzoek voor dezelfde factuur in de lucht',
        bron: 'de `bezig`-set vangt de race binnen het proces; de idem-sleutel vangt de herhaling' }
    ],
    gevolgen: [
      { soort: 'direct', graad: 'vermoed', collectie: 'paySaldi',
        wat: 'het saldo van de wallet van het lid daalt met het openstaande bedrag',
        reden: BRON },
      { soort: 'direct', graad: 'vermoed', collectie: 'payBoekingen',
        wat: 'er komt een grootboekregel bij: van het lid naar de huisrekening',
        reden: BRON },
      { soort: 'direct', graad: 'vermoed', collectie: 'invoices',
        wat: 'de factuur gaat op `paid`, met "Betaald uit RTG Pay-saldo" als hoe',
        reden: BRON + ' Bij een EIGEN account woont de factuur in de identiteitskluis ' +
          '(accounts.getMemberState) en niet in db.data.' },
      { soort: 'direct', graad: 'vermoed', collectie: 'fondsAfdrachten',
        wat: 'de afdracht aan de RTFoundation wordt vastgelegd',
        reden: BRON + ' settleFactuur doet dit voor elke betaalweg gelijk.' },
      { soort: 'direct', graad: 'vermoed', collectie: 'socialeAfdrachten',
        wat: 'de sociale afdracht wordt vastgelegd',
        reden: BRON },
      { soort: 'direct', graad: 'vermoed', collectie: 'economischeRuntime',
        wat: 'de economische runtime houdt de stroom tussen de werelden bij',
        reden: BRON + ' Dit is een teller en geen geld.' },
      { soort: 'direct', graad: 'vermoed', collectie: 'payIdem',
        wat: 'de sleutel (wie + factuurnummer) wordt vastgelegd zodat een tweede poging niet dubbel boekt',
        reden: BRON + ' De sleutel is DETERMINISTISCH (wie + factuurnummer), dus een herhaling na ' +
          'een halve betaling geneest in plaats van dubbel te boeken.' },
      { soort: 'direct', graad: 'vermoed', collectie: 'payIdemAfdruk',
        wat: 'de afdruk van het antwoord wordt bewaard voor die tweede poging',
        reden: BRON },
      { soort: 'direct', graad: 'vermoed', collectie: 'betaalIdem',
        wat: 'dezelfde bescherming aan de kant van de betaal-naad',
        reden: BRON },
      { soort: 'afgeleid', graad: 'vermoed',
        wat: 'is er te weinig saldo, dan laadt de wallet eerst bij en staat dat als `bijgeladen` ' +
          'in het antwoord -- er is dan meer gebeurd dan een factuur betalen',
        reden: 'pay.huisIn roept zorgSaldo aan; het antwoord draagt het getal zodat het lid het ziet' },
      { soort: 'buiten', graad: 'vermoed',
        wat: 'dat bijladen loopt langs de betaalaanbieder',
        uitkomsten: ['niet bijgeladen', 'bijgeladen', 'bijladen mislukt'],
        reden: 'dezelfde naad als /api/pay/oplaad; zonder tekort komt er geen aanbieder aan te pas' },
      /* DE BELANGRIJKSTE RIJ VAN DIT CONTRACT, en hij is gemeten met een moordproef. */
      { soort: 'mislukking', graad: 'vermoed',
        wat: 'een mislukte BEVESTIGING betekent niet dat er niets is afgeschreven: het lid krijgt 503 ' +
          'met "controleer de betaalstatus voordat je het opnieuw probeert", en de opslag kan de ' +
          'mutatie al hebben',
        uitkomsten: ['alles rond', 'niets gebeurd', 'afgeschreven zonder bevestiging'],
        reden: 'kern/factuursaldo.js zegt het zelf: `bijeen` bundelt saves maar draait mutaties NIET ' +
          'terug. Het venster ervoor is gemeten met npm run factuurproef (RTG_VERRAAD=sterf-na-commit, ' +
          'drie rondes, identieke uitslag: saldo afgeschreven, factuur nog open, geen afdracht) en is ' +
          'met de duurzame bundel gedicht -- maar "niet bevestigd" blijft een andere uitkomst dan ' +
          '"niet gebeurd"' },
      { soort: 'mislukking', graad: 'vermoed',
        wat: 'is het bedrag te laag, dan is het een DEELbetaling en blijft de factuur openstaan',
        reden: 'settleFactuur doet de bedragcontrole voor alle drie de betaalwegen gelijk; de muntweg ' +
          'kan een factuur half gevuld hebben achtergelaten' }
    ],
    onzeker: [
      { wat: 'of een 503 bij de bundel geld heeft verplaatst',
        reden: 'dat is precies wat niet bevestigd is; er is geen herstelronde die halve betalingen ' +
          'opruimt, de genezing komt van een herhaling met dezelfde sleutel' }
    ],
    raakt: { objecten: ['eigen wallet', 'eigen maandfactuur', 'de huisrekening van RTG',
      'de afdracht aan de RTFoundation'] },
    herstel: { bron: 'HERSTELPROEF.json',
      reden: 'niet verklaard maar gemeten; een betaalde factuur heeft geen `exact` terugweg -- wat ' +
        'bestaat is een creditnota, en die wist geen factuur (zie kern/commerce/retour*.js)' },
    nagekeken: 'Claude (Opus 5), 2026-09-13: negen collecties, de poorten en het bundelvenster ' +
      'gelezen uit kern/factuursaldo.js -- NIET gemeten (zie de kop); niet door een mens nagelezen'
  }
});

module.exports = { FACTUUR };
