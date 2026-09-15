/* DE GELDGEBEURTENIS VAN EEN REIS -- de schakel tussen de commerciële bron en
   het grootboek, en de eerste echte aanroeper van de herkomstlaag.

   De keten die de eigenaar op 15 september 2026 vastlegde, loopt hier doorheen:

     reiscomponent -> herkomst -> commerciele geldgebeurtenis -> pay-geldrij
       -> economic provenance -> doorbelasting -> bijdragebasis

   EEN BOEKING EN VEEL HERKOMSTRIJEN. Het lid betaalt EEN bedrag, dus EEN beweging
   in het grootboek; waar dat bedrag economisch uiteenvalt is een tweede vraag.
   Wie per onderdeel een boeking maakt, verzint bewegingen die niet hebben
   plaatsgevonden -- het hotel heeft op dat moment nog niets ontvangen.

   RTG INT EN KEERT NIET UIT. Wat aan derden toekomt wordt KLAARGEZET met
   `uitgevoerd: false` tot een mens hem langs kern/pay uitvoert (GELD.md).

   HIJ GRAAIT NIET IN DE BAK VAN DE BUURMAN. `reisAanvragen` en `partnerTrips`
   zijn van kern/reisbureau.js; deze laag vraagt ze daar op en laat de eigenaar
   zijn eigen rij bijwerken (`markeerBetaald`, die een tweede betaling weigert).
   Een verklaarde eigenaar via kern/eigencollectie.js is dit nog NIET: zes
   bestanden raken elk van beide collecties aan, dus dat zakt vandaag op
   keuringsregel 63. Eigen ronde, met de reden in NORM.json.

   EN HIJ WEIGERT LIEVER DAN DAT HIJ RAADT. Een reis zonder samenstelling levert
   geen betaling met een onbekende herkomst op maar een WEIGERING met de reden:
   een geldrij die `onbekend` draagt terwijl de reis simpelweg niet is
   uitgesplitst, ziet er in de meter uit als een meting en is een gok. */
'use strict';

const { geldrijenVoor } = require('./reisbureau-geldrijen');

/* De positie waar RTG de reissom int. Een eigen naam en niet `rtg:reserve`:
   die bak is van de fondsafdracht (opzet/kern-geldnaden.js), en twee
   geldstromen op een positie maken elk saldo onverklaarbaar. */
const KAS = 'rtg:reisbureau';

function maakReisbetaling({ db, crypto, payVan, reisbureauVan, nu }) {
  const klok = nu || (() => new Date().toISOString());
  /* EEN BEWAARDE RIJ HEEFT EEN EIGEN IDENTITEIT. Zonder id kan de klaargezette
     uitkering alleen naar de REIS wijzen en niet naar de herkomstrij die hij
     afwikkelt -- precies wat een mens nodig heeft die het deel van het hotel
     overmaakt en moet aantonen welke cent hij afboekt. */
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
  const bureau = () => (reisbureauVan && reisbureauVan()) || null;

  async function betaal(sess, codenaam, ref) {
    const rb = bureau();
    if (!rb) return { status: 503, error: 'Het reisbureau is niet beschikbaar.' };
    const a = rb.aanvraagVan(ref);
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

    const trip = rb.tripVan(a.tripId);
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
    /* VELD VOOR VELD EN NIET MET EEN SPREAD. Hier stond `{ ref, at, ...r }`, en
       daarmee was de herkomst onzichtbaar voor scripts/doorbelasting.js: die
       leest BEWAARDE vormen statisch en kijkt niet door een spread heen. Zelfde
       richting als AI-CONTEXT-01 -- bij een spread passeert elk nieuw veld
       vanzelf, bij een verklaarde lijst niet. */
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
        /* DE HERKOMST STAAT OP DE RIJ ZELF EN NIET ALLEEN IN `geldrij`. Dat
           veld is een verwijzing, en scripts/doorbelasting.js zegt in zijn eigen
           grens dat hij die niet volgt -- met de reden: een keten die je niet in
           EEN rij ziet, kun je bij een geschil ook niet in een rij tonen. Een
           uitkering die zegt "dit is voor een derde" zonder erbij te zeggen van
           wie de waarde kwam, is precies zo'n rij. */
        economischeHerkomst: g.economischeHerkomst,
        aan: g.economischeEigenaar, relatie: g.relatie, grond: g.grond,
        uitgevoerd: false,
        hoe: 'klaargezet; een mens van het kantoor voert hem uit langs kern/pay (GELD.md)'
      });
    }

    /* De EIGENAAR schrijft de betaling op zijn eigen rij. Mislukt dat (een
       tweede betaling die er tussendoor kwam), dan zegt hij dat en verzint deze
       laag geen succes. */
    const gezet = rb.markeerBetaald(a.ref, {
      at: stempel, boeking: b.boeking.id, centen: opbouw.totaalCenten, valuta: 'EUR' });
    if (gezet.error) return { status: gezet.status || 409, error: gezet.error };
    return { ok: true, betaling: gezet.betaald, rijen: metBoeking.rijen.length };
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
