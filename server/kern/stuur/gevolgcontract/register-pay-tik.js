/* HET GEVOLGCONTRACT VAN DE TIK -- twee mensen die naast elkaar staan.

   APART VAN ./register-pay-stuur.js, en de naad is de CODE. Sturen wijst een ontvanger
   aan met zijn codenaam; tikken doet dat met een code van zes tekens die vijf minuten
   leeft en die ALLEEN de ontvanger aanwijst. Daar hangt een eigen voorwaarde aan (een
   geldige, niet-eigen tik) en een eigen mislukking (de tik is verlopen) -- en dat zijn
   precies de twee velden waar een gevolgcontract over gaat.

   APART VAN ./register-pay-kascode.js om het scherpste verschil dat deze laag kent: een
   tik VERPLAATST geld, een kascode verleent alleen het RECHT om het te komen halen.
   ========================================================================== */
'use strict';

const TIK = Object.freeze({
  '/api/pay/tik': {
    capability: '/api/pay/tik',
    classificatie: 'persoonsgegeven',
    streefstand: 'het bedrag staat van de eigen wallet af en op de wallet van de getikte ' +
      'ontvanger bij, in een grootboek dat na de handeling nog sluit',
    /* DE CODE WIJST ALLEEN DE ONTVANGER AAN, en dat is de reden dat RECHT_VERLENEN hier in
       `nooit` staat: wie een tik afkijkt kan de eigenaar hooguit BETALEN, nooit iets bij hem
       ophalen. UITGAANDE_AANROEP staat er wel bij, en niet omdat tikken zelf naar buiten
       gaat: bij een tekort laadt zorgSaldo eerst bij, en dat loopt langs de betaal-naad. */
    veroorzaakt: ['GELD_BEWEGEN', 'SCHRIJVEN_EIGEN', 'SCHRIJVEN_ANDERMANS', 'UITGAANDE_AANROEP'],
    nooit: ['EXTERN_BEREIKEN', 'RECHT_VERLENEN', 'IDENTITEIT_WIJZIGEN', 'DERDENCODE_UITVOEREN',
      'ONVERTROUWDE_BYTES', 'BEVEILIGING_VERZWAKKEN', 'BULK_UITVOER', 'PLAFOND_WIJZIGEN'],
    voorwaarden: [
      { wat: 'een ledensessie; een gast komt er niet in', bron: 'geenGast in routes/pay-tegoed.js' },
      { wat: 'eenmalig het paspoort', bron: 'kyc in routes/pay-tegoed.js' },
      { wat: 'een GELDIGE tik die niet de eigen is -- anders 404 of "Dit is je eigen tik"',
        bron: 'kern/pay/tik.js#tikBetaal' },
      { wat: 'een idempotentiesleutel: de geldpoort weigert deze route zonder',
        bron: 'GEMETEN, niet verklaard: een kale oproep gaf 400 "Deze opdracht verplaatst geld ' +
          'en vraagt een idempotentiesleutel"' },
      { wat: 'dekking, of ruimte om bij te laden', bron: 'zorgSaldo in kern/pay/verzoeken.js' }
    ],
    gevolgen: [
      { soort: 'direct', graad: 'vermoed', collectie: 'paySaldi',
        wat: 'het eigen saldo daalt en dat van de getikte ontvanger stijgt',
        reden: 'kern/pay/tik.js boekt beide kanten via stuur; de actuele proef bereikte die code niet' },
      { soort: 'direct', graad: 'vermoed', collectie: 'payBoekingen',
        wat: 'er komt een grootboekregel bij met soort `tik`, die bij beide leden in de ' +
          'tikgeschiedenis staat',
        reden: '`soort: tik` is waar kern/pay/tik.js#tikFeed op filtert; nog niet gemeten met een geldige tik' },
      { soort: 'direct', graad: 'vermoed', collectie: 'payIdem',
        wat: 'de sleutel wordt vastgelegd zodat een tweede tik met dezelfde sleutel niet dubbel boekt',
        reden: 'tikBetaal geeft hem door als `tik:<sleutel>`; de actuele proef strandde voor deze stap' },
      { soort: 'direct', graad: 'vermoed', collectie: 'payIdemAfdruk',
        wat: 'de afdruk van het antwoord wordt bewaard voor die tweede tik',
        reden: 'de geldpoort bewaart de afdruk bij dezelfde sleutel; de tikroute is nog niet succesvol gemeten' },
      /* HIER STONDEN TWEE COLLECTIES DIE NIET VAN DEZE HANDELING WAREN, en die staan er
         sinds de integratieronde niet meer -- maar om een ANDERE reden dan waarom ze fout
         waren. Dat verschil hoort hier te blijven staan, want het gaat over de meter en
         niet over deze route.

         Er stond `betaalOpdrachten` en `capGezondheid`, met graad `gemeten` en een
         verhaal eronder: ze zouden alleen op de EERSTE oproep bewegen, toen de wallet nog
         leeg was en er moest worden bijgeladen. Dat verhaal was plausibel en het was
         ONWAAR -- ik had een meting gezien en er een oorzaak bij bedacht.

         WAT ZE WERKELIJK WAREN. server/opzet/start.js draait elke vijf minuten een
         onderhoudsronde met `betaalWaarheid.ronde()` erin, en die zendt gestrande
         betaalopdrachten opnieuw in; `railInzenden` in server/server.js meldt daarbij de
         stand van `money.payout` aan kern/commercie/capgezondheid.js. Die ronde schrijft
         dus BUITEN elk verzoek om, en de idempotentieproef rekent een stand tussen twee
         oproepen door -- dus landt dat werk bij de route die op dat moment aan de beurt
         is. Gemeten: 14 routes droegen `betaalOpdrachten` en 15 `capGezondheid`,
         waaronder /api/lab2/labs, /api/member/snaps en /api/rtf/leerling/vakken. Geen
         daarvan betaalt iets uit.

         NAGETROKKEN IN DE CODE, want een meting tegenspreken vraagt meer dan een
         vermoeden: kern/pay/tik.js en kern/pay/opladen.js noemen `betaalOpdracht`,
         `capGezondheid` en `maakUitbetaling` geen van drieen. Bijladen is geld dat
         BINNENKOMT; een betaalopdracht is geld dat het huis verlaat. Op /api/bank/sepa
         staan diezelfde twee claims wel, en daar zijn ze waar -- zie ./register-lid.js.

         WAT ERVOOR IN DE PLAATS KOMT: niets. Het bijladen staat al als gevolg `buiten`
         hieronder, en dat is precies de juiste plek: wat er bij de aanbieder gebeurt, is
         geen collectie van dit huis. En de achtergrondronde zelf staat sindsdien stil
         tijdens een meetronde -- zie scripts/idemproef-route.js. */
      { soort: 'afgeleid', graad: 'vermoed',
        wat: 'de tik blijft geldig: hij wordt NIET verbruikt, dus dezelfde code kan binnen zijn ' +
          'vijf minuten door meer mensen gebruikt worden',
        reden: 'kern/pay/tik.js zet `geldigTot` niet op 0 na een betaling -- met opzet, want de code ' +
          'wijst alleen de ontvanger aan en er kan dus enkel geld naar hem toe' },
      { soort: 'buiten', graad: 'vermoed',
        wat: 'is er te weinig saldo, dan wordt er eerst bijgeladen langs de betaalaanbieder',
        uitkomsten: ['niet bijgeladen', 'bijgeladen', 'bijladen mislukt'],
        reden: 'zorgSaldo roept laadOp aan; het antwoord draagt `bijgeladen` zodat het lid ziet dat ' +
          'er meer is gebeurd dan tikken' },
      { soort: 'mislukking', graad: 'vermoed',
        wat: 'ZONDER idempotentiesleutel gebeurt er niets: de geldpoort weigert met 400 voordat de ' +
          'tik wordt opgezocht -- een kale dubbeltik kan hier dus niet twee keer betalen',
        reden: 'de geldpoort staat voor de tikroute; de actuele kale proef had een ongeldige tik en ' +
          'bereikte deze weigering nog niet' },
      { soort: 'mislukking', graad: 'vermoed',
        wat: 'is de tik verlopen of van de aanroeper zelf, dan gaat er niets van de wallet af',
        reden: 'de twee controles in kern/pay/tik.js#tikBetaal staan VOOR de aanroep van `stuur`, ' +
          'dus de 404 en de 400 vallen voordat er geboekt wordt' }
    ],
    onzeker: [
      { wat: 'of de ontvanger het merkt', reden: 'het seintje is best effort en hangt aan een open ' +
        'sessie; dit huis meet niet of het is aangekomen' }
    ],
    raakt: { objecten: ['eigen wallet', 'wallet van de getikte ontvanger', 'het grootboek'] },
    herstel: { bron: 'HERSTELPROEF.json',
      reden: 'niet verklaard maar gemeten; geld terugtikken is een NIEUWE handeling en geen ' +
        'terugweg -- de ontvanger moet die zelf doen' },
    nagekeken: 'Claude (Opus 5), 2026-09-14: de volgorde en codebehandeling uit kern/pay/tik.js; ' +
      'IDEMPROEF.json meldt voor deze route driemaal 404 en dus nog geen succesvolle gevolgmeting; ' +
      'niet door een mens nagelezen'
  }
});

module.exports = { TIK };
