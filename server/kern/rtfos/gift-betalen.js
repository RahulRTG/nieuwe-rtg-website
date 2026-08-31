/* Foundation OS, deel "gift-betalen": de bevestigde gift, en de enige plek in
   deze laag waar geld beweegt.

   ER KOMT GEEN TWEEDE BETAALWEG BIJ, en dat is de hele opzet. De RTFoundation
   heeft een wallet zoals een leverancier er een heeft, dus een gift is precies
   wat een betaling aan een zaak ook is: `pay.partnerIn` boekt van de wallet van
   het lid naar `partner:<code>`. Uitbetalen naar de eigen bankrekening doet de
   stichting daarna zelf, langs dezelfde weg als elke andere zaak
   (/api/supplier/pay/uitbetaal). Dit bestand bouwt daar niets voor: het zou een
   tweede uitbetaalpad zijn voor dezelfde handeling.

   VIER DINGEN DIE HIER GEBEUREN, in deze volgorde, en de volgorde is de veiligheid:

   1. HET VOORNEMEN WORDT OPNIEUW GEREKEND. Wat de browser meestuurt is invoer en
      geen uitkomst: het bedrag, de vorm en de vraag of er iets tegenover staat
      gaan opnieuw door ./gift-voornemen.js. Een client die "aftrekbaar: true"
      meestuurt, verandert daar niets mee.

   2. PAS DAARNA BEWEEGT ER GELD, met een idempotentiesleutel. Twee keer klikken
      is een gift, niet twee.

   3. DE BRON ONTSTAAT NA DE BOEKING EN NIET ERVOOR. Een bron zonder geld is een
      belofte in de boekhouding van de stichting; geld zonder bron is een gift
      die niemand kan verantwoorden. Van die twee is de eerste erger, dus boekt
      dit eerst en registreert het daarna -- en als de registratie mislukt, staat
      dat in het antwoord in plaats van dat het verdwijnt.

   4. DE HERKOMSTCONTROLE ZET HET GELD STIL waar dat hoort. Dat doet ./herkomst.js
      via de bron; dit bestand bepaalt niets over drempels en herhaalt ze niet.

   WAT HIER NIET IN ZIT: geen incasso, geen periodieke afschrijving, geen
   terugboeking op verzoek van de gever. Dat zijn eigen handelingen met eigen
   grenzen; een gift terugdraaien loopt langs de stichting en niet langs een knop.
   Zie GIFT.md par. 5. */
'use strict';

module.exports = (ctx, { standVan, voorbereidVan, bronUitGift, termijnAf }) => {
  const { schoon, naarCenten, nu, audit } = ctx;

  async function bevestig(b) {
    b = b || {};
    const codenaam = schoon(b.codenaam, 40);
    if (!codenaam) return { status: 401, error: 'Hiervoor is een eigen RTG-account nodig.' };

    /* 1. Opnieuw rekenen. Alles wat hierna gebruikt wordt, komt uit DIT
          antwoord en niet uit het verzoek. */
    const v = voorbereidVan(b);
    if (!v.ok) return v;

    const g = standVan();
    const ontvanger = g.ontvanger;
    if (!ontvanger || ontvanger.soort !== 'wallet' || !ontvanger.code) {
      return { status: 409, error: 'Er is geen wallet van de stichting ingesteld. Zonder die code landt er niets.' };
    }
    const pay = ctx.pay;
    if (!pay || typeof pay.partnerIn !== 'function') {
      /* NIET STIL DOORLOPEN. Zonder betaallaag is er geen gift; een lege tak zou
         hier een "ok" opleveren voor iets dat niet gebeurd is. */
      return { status: 503, error: 'RTG Pay is nu niet bereikbaar. Er is niets afgeschreven; probeer het straks opnieuw.' };
    }

    const centen = naarCenten(v.voornemen.euro);
    if (!centen) return { status: 400, error: 'Welk bedrag wil je geven?' };

    /* 2. Het geld. De sleutel hangt aan de gever en aan wat hij meegaf; zonder
          eigen sleutel valt hij terug op iets dat per gift verschilt maar per
          klik hetzelfde is. */
    const idem = schoon(b.idem, 60) || ('gift-' + codenaam + '-' + centen + '-' + (v.voornemen.project || '') + '-' + nu().slice(0, 10));
    const oms = v.voornemen.soort === 'sponsoring'
      ? 'Sponsoring RTFoundation'
      : ('Gift RTFoundation' + (v.voornemen.project ? ' -- ' + v.voornemen.project : ''));

    const betaald = await pay.partnerIn({
      supplierCode: ontvanger.code, codenaam, centen, oms, soort: 'gift', idem
    });
    if (!betaald || betaald.error) return betaald || { status: 502, error: 'De betaling is niet gelukt.' };

    /* 3. De bron, zodat donateur.js en herkomst.js hem oppakken. Mislukt dit,
          dan is het geld WEL weg -- dat wordt gemeld en niet weggeslikt. */
    let bron = null, bronFout = null;
    try {
      bron = bronUitGift({
        stad: schoon(b.stad, 20) || null,
        /* UIT HET HERREKENDE VOORNEMEN en niet uit het verzoek: daar stond
           `schoon(b.projectId)`, en dat is precies hoe een verzonnen id in de
           boekhouding van de stichting belandde. */
        projectId: v.voornemen.projectId || null,
        soort: v.voornemen.soort,
        centen, gever: codenaam, anoniem: v.voornemen.anoniem,
        kenmerk: 'online gift', door: codenaam
      });
    } catch (e) { bronFout = String((e && e.message) || e); }

    /* Hoort deze gift bij een meerjarig plan, teken hem dan af als termijn.
       NA de boeking en na de bron: een termijn die als voldaan staat terwijl er
       niets is betaald, is precies het verkeerde soort fout. */
    let termijn = null;
    if (b.planId) {
      const p = termijnAf ? termijnAf(codenaam, schoon(b.planId, 20), bron ? bron.id : null) : null;
      termijn = p ? { plan: p.id, jaren: p.jaren } : null;
    }

    audit(codenaam, 'gift.bevestigd', bron ? bron.id : 'zonder-bron', v.voornemen.euro + ' euro');

    return { ok: true,
      gegeven: v.voornemen.euro,
      soort: v.voornemen.soort,
      stuk: v.voornemen.stuk,
      /* De transactiekosten komen van de ONTVANGER af, precies zoals bij elke
         andere ontvangst in dit huis (kern/pay/partner.js). Dat staat er dus
         bij: er komt niet het volle bedrag bij de stichting binnen, en een
         scherm dat "100% gaat naar" zou beweren, zou liegen. */
      kosten: betaald.kosten || 0,
      bron: bron ? bron.id : null,
      termijn,
      beoordeeldVooraf: v.voornemen.beoordeeldVooraf,
      bronFout,
      zegt: v.zegt.concat(bronFout
        ? ['Let op: je gift is afgeschreven, maar de registratie bij de stichting is niet gelukt. Meld dit met dit bedrag en de datum; het geld is niet weg.']
        : []) };
  }

  return { bevestig };
};
