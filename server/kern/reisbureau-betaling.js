/* DE GELDGEBEURTENIS VAN EEN REIS -- de schakel tussen de commerciële bron en
   het grootboek, en de eerste echte aanroeper van de herkomstlaag.

   De keten die de eigenaar op 15 september 2026 vastlegde, loopt hier doorheen:

     reiscomponent -> herkomst -> commerciele geldgebeurtenis -> pay-geldrij
       -> economic provenance -> doorbelasting -> bijdragebasis

   EEN BOEKING EN VEEL HERKOMSTRIJEN, en dat is geen implementatiedetail. Het lid
   betaalt EEN bedrag en dat is EEN beweging in het grootboek; waar dat bedrag
   economisch uiteenvalt is een tweede vraag met een ander antwoord. Wie voor elk
   onderdeel een eigen boeking zou maken, verzint bewegingen die niet hebben
   plaatsgevonden -- het hotel heeft op dat moment nog niets ontvangen.

   RTG INT EN KEERT NIET UIT. De vervolgbetaling aan het hotel, de vervoerder en
   de belastingdienst wordt hier KLAARGEZET en nooit uitgevoerd: GELD.md is daar
   onvoorwaardelijk over, en `uitgevoerd: false` blijft staan tot een mens hem
   langs kern/pay uitvoert. Dat is exact het voorbeeld waarop `herkomst:
   'partner'` sneuvelde: de klant betaalt, RTG int, het hotel is de eigenaar, en
   die drie staan op dezelfde rij zonder elkaar te overschrijven.

   EN HIJ WEIGERT LIEVER DAN DAT HIJ RAADT. Een reis zonder samenstelling
   (twee van de drie in de zaaiset) levert hier geen betaling met een onbekende
   herkomst op maar een WEIGERING met de reden. Een geldrij die `onbekend`
   draagt terwijl de reis gewoon niet is uitgesplitst, ziet er in de meter uit
   als een meting en is een gok. */
'use strict';

const { geldrijenVoor } = require('./reisbureau-geldrijen');

/* De positie waar RTG de reissom int. Een eigen naam en niet `rtg:reserve`:
   die bak is van de fondsafdracht (opzet/kern-geldnaden.js), en twee
   geldstromen op een positie maken elk saldo onverklaarbaar. */
const KAS = 'rtg:reisbureau';

function maakReisbetaling({ db, save, crypto, payVan, nu }) {
  const klok = nu || (() => new Date().toISOString());
  /* EEN BEWAARDE RIJ HEEFT EEN EIGEN IDENTITEIT, en dat is hier geen formaliteit.
     Zonder id kan de klaargezette uitkering alleen naar de REIS wijzen en niet
     naar de herkomstrij die hij afwikkelt -- en juist dat is wat een mens nodig
     heeft die straks het deel van het hotel overmaakt en moet kunnen aantonen
     welke cent hij daarmee afboekt. (Het is ook wat scripts/objectmodel.js als
     kenmerk van een bewaarde vorm leest: vier velden en een id. Dat die lezer en
     deze reden samenvallen is geen toeval -- de heuristiek codeert de eigenschap.) */
  const nieuwId = (voorvoegsel) => voorvoegsel + '-' +
    (crypto ? crypto.randomBytes(5).toString('hex').toUpperCase()
            : Math.abs(Date.now() % 1e10).toString(16).toUpperCase());
  const eigen = require('./eigencollectie')({
    db, domein: 'kern/reisbureau-betaling',
    bezit: { reisGeldrijen: 'lijst', reisUitkeringen: 'lijst' }
  });
  /* Laat gebonden, zoals de rest van deze kern: pay wordt in een latere laag
     gemount, en zonder pay hoort dit te weigeren en niet te doen alsof. */
  const pay = () => (payVan && payVan()) || null;

  function aanvraagVan(ref) {
    return (db.data.reisAanvragen || []).find(a => a.ref === String(ref || '')) || null;
  }

  async function betaal(sess, codenaam, ref) {
    const a = aanvraagVan(ref);
    if (!a) return { status: 404, error: 'Aanvraag niet gevonden.' };
    if (a.customerKey !== sess.key) return { status: 404, error: 'Aanvraag niet gevonden.' };
    /* ALLEEN EEN BEVESTIGDE REIS. Een aanvraag is geen verplichting: tot een
       mens van het reisbureau hem bevestigt, staat er niets vast en hoort er
       niets betaald te worden (kern/reisbureau.js: "aangevraagd" tot een mens
       bevestigt). */
    if (a.status !== 'bevestigd') {
      return { status: 409, error: 'Deze reis is nog niet bevestigd door een reisadviseur.' };
    }
    if (a.betaald) return { ok: true, alBetaald: true, betaling: a.betaald };

    const trip = (db.data.partnerTrips || []).find(t => t.id === a.tripId);
    const opbouw = geldrijenVoor({ trip, personen: a.personen, valuta: 'EUR' });
    if (!opbouw.ok) {
      /* WEIGEREN MET DE REDEN, en dat is hier een grens en geen gat. Zonder
         samenstelling is niet vast te stellen wat er aan wie toekomt, en een
         betaling die dat niet weet, kan later niet worden verantwoord. */
      return { status: 409, error: 'Deze reis is nog niet uitgesplitst; RTG kan hem daarom niet innen.',
        hoe: opbouw.waarom };
    }

    const p = pay();
    if (!p) return { status: 503, error: 'De betaallaag is niet beschikbaar.' };

    const b = await p.boekAsync({
      van: 'lid:' + codenaam, naar: KAS, centen: opbouw.totaalCenten,
      soort: 'reis', oms: 'Reis ' + (a.titel || a.tripId), ref: a.ref
    });
    if (!b || b.error) return { status: (b && b.status) || 502, error: (b && b.error) || 'Betaling mislukt.' };

    /* Nu pas de herkomstrijen, MET het boekingsnummer erin: een herkomstrij die
       naar een boeking wijst die niet bestaat, is een bewering zonder bewijs. */
    const metBoeking = geldrijenVoor({ trip, personen: a.personen, boekingId: b.boeking.id, valuta: 'EUR' });
    const stempel = klok();
    /* DE BEWAARDE RIJ WORDT VELD VOOR VELD OPGESCHREVEN EN NIET MET EEN SPREAD,
       en dat is geen stijl. Hier stond `{ ref, at, ...r }`, en daarmee was de
       herkomst onzichtbaar voor de meter die er nu juist voor bestaat:
       scripts/doorbelasting.js leest BEWAARDE vormen statisch, en door een
       spread kijkt geen enkele lezer heen. De hele migratie bewoog de ratel
       daardoor geen streep.

       Het is bovendien dezelfde richting als AI-CONTEXT-01: bij een spread
       passeert elk NIEUW veld vanzelf, bij een verklaarde lijst blijft het
       buiten tot iemand het er bewust bij zet. Bij een AI-context is dat een
       lek; hier is het een blinde vlek in de verantwoording. */
    for (const r of metBoeking.rijen) {
      const rijId = nieuwId('RGH');
      eigen.bak('reisGeldrijen').push({
        id: rijId, ref: a.ref, at: stempel,
        bedragCenten: r.bedragCenten, valuta: r.valuta,
        /* DE PRECIEZE NAMEN BLIJVEN STAAN. Kort `herkomst` zou hier botsen met
           het GELIJKNAMIGE veld in reisbureau-samenstelling.js, en die betekent
           iets anders: daar partner/rtg/extern (waar kwam het onderdeel
           vandaan), hier lid/derde/rtg (van wie kwam de WAARDE). Twee
           betekenissen op een woord binnen een functie is de botsing uit
           SEMANTIEK.json, en die ontstaat het makkelijkst bij het afkorten. */
        economischeHerkomst: r.economischeHerkomst,
        economischeEigenaar: r.economischeEigenaar, naarWie: r.naarWie,
        grond: r.grond, bronObject: r.bronObject, relatie: r.relatie,
        land: r.land, bewijs: r.bewijs
      });
    }

    /* En wat er aan derden TOEKOMT, wordt klaargezet en niet uitgevoerd. Elke
       uitkering wijst naar de HERKOMSTRIJ die hij afwikkelt (`geldrij`) en niet
       alleen naar de reis: anders kan een mens die het deel van het hotel
       overmaakt niet aantonen welke cent hij daarmee afboekt. */
    for (const g of eigen.kijk('reisGeldrijen')) {
      if (g.ref !== a.ref || g.at !== stempel || g.economischeEigenaar === 'rtg') continue;
      eigen.bak('reisUitkeringen').push({
        id: nieuwId('RUK'), geldrij: g.id, ref: a.ref, at: stempel,
        centen: g.bedragCenten, valuta: g.valuta,
        aan: g.economischeEigenaar, relatie: g.relatie, grond: g.grond,
        uitgevoerd: false,
        hoe: 'klaargezet; een mens van het kantoor voert hem uit langs kern/pay (GELD.md)'
      });
    }

    a.betaald = { at: stempel, boeking: b.boeking.id, centen: opbouw.totaalCenten, valuta: 'EUR' };
    save();
    return { ok: true, betaling: a.betaald, rijen: metBoeking.rijen.length };
  }

  /* De herkomstrijen van EEN reis, voor de meter en voor het kantoor. */
  function rijenVan(ref) {
    return eigen.kijk('reisGeldrijen').filter(r => r.ref === String(ref || ''));
  }
  function alleRijen() { return eigen.kijk('reisGeldrijen').slice(); }
  function uitkeringenVan(ref) {
    return eigen.kijk('reisUitkeringen').filter(r => r.ref === String(ref || ''));
  }

  return { reisbetaling: { betaal, rijenVan, alleRijen, uitkeringenVan, KAS } };
}

module.exports = { maakReisbetaling, KAS };
