/* DE VERKLARINGEN, apart van de machinerie in ./idem-contract.js.

   Gesplitst om dezelfde reden als de vijfendertig ./idemsleutels-*.js: een
   bestand dat groeit met elke capability hoort niet ook nog de motor te
   dragen. Hier staan uitsluitend uitspraken over bestaande handlers; de
   betekenis van de standen staat in ./idem-contract.js.

   REGEL: elke verklaring beschrijft wat de code VANDAAG doet. Wijkt zij af van
   de handler, dan is dat een gebrek in de verklaring en geen verbetering --
   test/idemcontract.test.js houdt beide tegen elkaar. */
'use strict';

/* ------------------------------------------------------------------------
   DE VERKLARINGEN.

   Elke verklaring beschrijft wat de code VANDAAG doet. Wijkt een verklaring af
   van de handler, dan is dat een gebrek in de verklaring en niet een
   verbetering -- test/idemcontract.test.js houdt beide tegen elkaar. */
const CONTRACTEN = {
  /* server/kern/bank/passen.js, uitgeven(). De handler bouwt zijn identiteit
     met de hand: metIdem('pasuit:' + iban + ':' + idem, 'pasuit|' + iban + '|' +
     soort, ...). De rekening en de soort bepalen de handeling; de naam is vrije
     tekst en doet niet mee. Dat staat daar al als commentaar -- hier staat het
     zo dat een ander transport het kan lezen. */
  'bank.pas.uitgeven': {
    identiteit: {
      modus: 'CLIENT_KEY_AUTHORITATIVE',
      velden: ['iban', 'soort'],
      canoniek: { iban: 'exact', soort: 'exact' },
      /* `soort` draagt in de handler de standaard 'debit'. Een lijf zonder
         soort en een lijf met soort:'debit' zijn daardoor nu al dezelfde
         opdracht; zonder deze regel zou het contract SMALLER zijn dan de code. */
      standaarden: { soort: 'debit' },
      /* DE REPRESENTATIE HOORT BIJ HET CONTRACT, want zij wordt BEWAARD.
         ./idem.js schrijft de afdruk weg naast de sleutel (`a[sleutel] =
         afdruk`) en vergelijkt een latere poging daarmee. Zou dit contract een
         nettere vorm kiezen, dan botst elke sleutel die op dit moment in de
         database staat met de nieuwe vorm -- en een lid dat zijn haperende
         aanvraag opnieuw stuurt, krijgt 409 "al gebruikt voor een ander
         verzoek" op een handeling die hij nooit twee keer deed. Deze vorm
         levert daarom byte voor byte op wat de handler vandaag schrijft. */
      vorm: { voorvoegsel: 'pasuit', scheiding: '|', waarde: 'ruw' },
      buiten: {
        naam: 'vrije tekst: een andere paskaartnaam maakt er geen andere pas van',
        codenaam: 'komt uit de sessie en niet uit het lijf',
        idem: 'is de sleutel zelf'
      }
    },
    herhaling: 'ZELFDE_SLEUTEL_VEREIST',
    levering: 'HERPROBEREN_MAG'
  },

  /* server/kern/directpay/verzoek.js, verzoekMaak(). De sleutel hangt aan de
     ZAAK en niet aan de medewerker; de identiteit is het BEDRAG en verder
     niets (`if (al && al.bedrag !== cent) return 409`).

     DE ONTVANGER IS ERBIJ GEKOMEN, en dat was een BESLUIT en geen bijvangst.
     Tot september 2026 vergeleek de handler alleen het bedrag, en stond
     `naarCodename` hier in `teSmal` met de meting erbij: zelfde sleutel,
     zelfde bedrag, ANDERE ontvanger gaf 200 met `herhaald: true` en het
     verzoek van de EERSTE ontvanger terug --

       A: 200 ref BVA52D48EF50 naarCodename ANNA-001
       B: 200 ref BVA52D48EF50 naarCodename ANNA-001  herhaald: true

     -- waarbij de tweede ontvanger niets kreeg en de balie "gelukt" las. Dat is
     op besluit van de eigenaar gerepareerd; `teSmal` is daarmee leeg en die
     bak hoort pas terug als er weer iets in staat.

     `opaqueId` is hier de eerlijke canonicalisatie en niet `exact`: de
     schrijfregel bewaart `schoon(naarCodename, 40)`, wat de randen eraf haalt.
     Een codenaam is een sleutel en geen woord, dus er gaat GEEN hoofdletterregel
     overheen -- twee codenamen die alleen in kapitalisatie verschillen zijn twee
     codenamen. */
  'supplier.betaalverzoek': {
    identiteit: {
      modus: 'CLIENT_KEY_AUTHORITATIVE',
      velden: ['centen', 'naarCodename'],
      canoniek: { centen: 'geldbedrag', naarCodename: 'opaqueId' },
      standaarden: {},
      /* Geen vorm: deze handler bewaart geen afdrukstring maar vergelijkt het
         bewaarde verzoek veld voor veld (`al.bedrag !== cent`). Er is dus geen
         opgeslagen representatie die stuk kan gaan -- en daarom ook geen vorm om
         te declareren. `null` is hier een uitspraak en geen gat. */
      vorm: null,
      buiten: {
        omschrijving: 'vrije tekst',
        actorName: 'de medewerker; de sleutel hangt bewust aan de zaak',
        idem: 'is de sleutel zelf'
      },
    },
    herhaling: 'ZELFDE_SLEUTEL_VEREIST',
    levering: 'HERPROBEREN_MAG'
  },

  /* server/kern/bank/ledenbank.js, ledenAkkoord(). De afdruk was met de hand
     'bankakkoord|' + c, en IDEMIDENTITEIT.json noemde dat `voegtNietsToe`: de
     enige naam erin is de codenaam, en die staat al in de sleutel. Dat is hier
     geen gat maar de handeling zelf -- een akkoord is er EEN per lid, de sleutel
     wordt uit de codenaam AFGELEID en niet door de client gekozen, en er bestaat
     geen tweede parameter die een ander akkoord zou maken. Tot 18 oktober 2026
     stond dat alleen als vorm in de code; nu staat het als uitspraak hier, zodat
     een ander transport het kan lezen. De vorm levert byte voor byte de oude
     afdruk op: die staat in de database naast elke bestaande sleutel. */
  'bank.akkoord': {
    identiteit: {
      modus: 'DERIVED_IDENTITY',
      velden: ['codenaam'],
      canoniek: { codenaam: 'exact' },
      standaarden: {},
      vorm: { voorvoegsel: 'bankakkoord', scheiding: '|', waarde: 'ruw' },
      buiten: {
        tier: 'beslist alleen of er daarna een zakelijke rekening bij komt; dat is een eigen handeling met een eigen sleutel (open())'
      }
    },
    /* store[c] = store[c] || nu(): een tweede akkoord verandert niets. */
    herhaling: 'VEILIG',
    levering: 'HERPROBEREN_MAG'
  },

  /* server/kern/pay/partner-uitbetaal.js, partnerUitbetaal(). Ook hier stond de
     afdruk met de hand ('uit|' + supplierCode) en heette hij `voegtNietsToe`,
     en ook hier is dat een uitgeschreven besluit en geen gat: een uitbetaling
     heeft geen parameters buiten de partner zelf -- het gaat altijd om het
     beschikbare saldo -- en het bedrag verschilt legitiem per moment, dus het
     hoort er met opzet NIET in. De client kiest de sleutel. */
  'pay.partner.uitbetaal': {
    identiteit: {
      modus: 'CLIENT_KEY_AUTHORITATIVE',
      velden: ['supplierCode'],
      canoniek: { supplierCode: 'exact' },
      standaarden: {},
      vorm: { voorvoegsel: 'uit', scheiding: '|', waarde: 'ruw' },
      buiten: {
        bedrag: 'het beschikbare saldo op het moment zelf; verschilt legitiem per poging',
        idem: 'is de sleutel zelf'
      }
    },
    herhaling: 'ZELFDE_SLEUTEL_VEREIST',
    /* MENS_ERBIJ en niet HERPROBEREN_MAG, ook al ontdubbelt de handler een
       herhaling met dezelfde sleutel: dit geld verlaat het huis, en dat gebeurt
       nooit vanzelf (GELD.md, AFBOUWPROGRAMMA.md par. 1 grens 3). Een transport
       dat hier zelf opnieuw aflevert, is een automaat die een uitbetaling
       herhaalt. */
    levering: 'MENS_ERBIJ'
  }
};

module.exports = { CONTRACTEN };
