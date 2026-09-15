/* DE GELDGEBEURTENIS VAN EEN REIS -- de eigenaar van de herkomstrijen.

   Dit bestand DOET en BEWAART; het rekent niet. De twee berekeningen wonen puur
   ernaast: ./reisbureau-geldrijen.js (de splitsing) en ./reisbureau-terugboeking
   .js (de spiegel). Hun redenen staan in hun eigen kop en niet hier.

   VIER REGELS DIE HIER GELDEN:

   - EEN BOEKING EN VEEL HERKOMSTRIJEN. Het lid betaalt EEN bedrag, dus EEN
     beweging. Wie per onderdeel boekt, verzint bewegingen die niet hebben
     plaatsgevonden -- het hotel heeft dan nog niets ontvangen.
   - RTG INT EN KEERT NIET UIT. Wat aan derden toekomt en wat terugkomt naar het
     lid, staat KLAAR met `uitgevoerd: false` tot een mens het uitvoert (GELD.md).
   - HIJ GRAAIT NIET IN DE BAK VAN DE BUURMAN: `reisAanvragen` en `partnerTrips`
     komen via kern/reisbureau.js. Een VERKLAARDE eigenaar is dat nog niet -- zes
     bestanden raken elk van beide aan, dus dat zakt op keuringsregel 63. Eigen
     ronde, met de reden in NORM.json.
   - HIJ WEIGERT LIEVER DAN DAT HIJ RAADT. Een reis zonder samenstelling levert
     een weigering met de reden en geen geldrij met een onbekende herkomst. */
'use strict';

const { geldrijenVoor } = require('./reisbureau-geldrijen');
const { spiegelVoor } = require('./reisbureau-terugboeking');

/* De positie waar RTG de reissom int. Een eigen naam en niet `rtg:reserve`:
   die bak is van de fondsafdracht (opzet/kern-geldnaden.js), en twee
   geldstromen op een positie maken elk saldo onverklaarbaar. */
const KAS = 'rtg:reisbureau';

function maakReisbetaling({ db, save, crypto, payVan, reisbureauVan, nu }) {
  const klok = nu || (() => new Date().toISOString());
  /* Een bewaarde rij heeft een eigen identiteit: zonder id kan een uitkering
     alleen naar de REIS wijzen en niet naar de cent die hij afwikkelt. */
  const nieuwId = (voorvoegsel) => voorvoegsel + '-' +
    (crypto ? crypto.randomBytes(5).toString('hex').toUpperCase()
            : Math.abs(Date.now() % 1e10).toString(16).toUpperCase());
  const eigen = require('./eigencollectie')({
    db, domein: 'kern/reisbureau-betaling',
    bezit: { reisGeldrijen: 'lijst', reisUitkeringen: 'lijst', reisTeruggaven: 'lijst' }
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
    /* Alleen een BEVESTIGDE reis: tot een mens hem bevestigt staat er niets
       vast en hoort er niets betaald te worden. */
    if (a.status !== 'bevestigd') {
      return { status: 409, error: 'Deze reis is nog niet bevestigd door een reisadviseur.' };
    }
    if (a.betaald) return { ok: true, alBetaald: true, betaling: a.betaald };

    const trip = rb.tripVan(a.tripId);
    const opbouw = geldrijenVoor({ trip, personen: a.personen, valuta: 'EUR' });
    if (!opbouw.ok) {
      /* Een grens en geen gat: een betaling die niet weet wat aan wie toekomt,
         is later niet te verantwoorden. */
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

    /* Nu pas, MET het boekingsnummer: een rij die naar een niet-bestaande
       boeking wijst, is een bewering zonder bewijs. */
    const metBoeking = geldrijenVoor({ trip, personen: a.personen, boekingId: b.boeking.id, valuta: 'EUR' });
    const stempel = klok();
    /* VELD VOOR VELD EN NIET MET EEN SPREAD: scripts/doorbelasting.js leest
       bewaarde vormen statisch en kijkt niet door `...r` heen. Zelfde richting
       als AI-CONTEXT-01. */
    for (const r of metBoeking.rijen) {
      const rijId = nieuwId('RGH');
      eigen.bak('reisGeldrijen').push({
        id: rijId, ref: a.ref, at: stempel,
        bedragCenten: r.bedragCenten, valuta: r.valuta,
        /* De PRECIEZE namen: kort `herkomst` botst met het gelijknamige veld in
           reisbureau-samenstelling.js, dat iets anders betekent. */
        economischeHerkomst: r.economischeHerkomst,
        economischeEigenaar: r.economischeEigenaar, naarWie: r.naarWie,
        grond: r.grond, bronObject: r.bronObject, relatie: r.relatie,
        land: r.land, bewijs: r.bewijs
      });
    }

    /* Klaargezet en niet uitgevoerd; elke uitkering wijst naar de HERKOMSTRIJ
       die hij afwikkelt en niet alleen naar de reis. */
    for (const g of eigen.kijk('reisGeldrijen')) {
      if (g.ref !== a.ref || g.at !== stempel || g.economischeEigenaar === 'rtg') continue;
      eigen.bak('reisUitkeringen').push({
        id: nieuwId('RUK'), geldrij: g.id, ref: a.ref, at: stempel,
        centen: g.bedragCenten, valuta: g.valuta,
        /* Op de rij ZELF en niet alleen in `geldrij`: dat is een verwijzing, en
           een keten die je niet in EEN rij ziet, kun je bij een geschil ook niet
           in een rij tonen. */
        economischeHerkomst: g.economischeHerkomst,
        aan: g.economischeEigenaar, relatie: g.relatie, grond: g.grond,
        uitgevoerd: false,
        hoe: 'klaargezet; een mens van het kantoor voert hem uit langs kern/pay (GELD.md)'
      });
    }

    /* De EIGENAAR schrijft de betaling op zijn eigen rij; mislukt dat, dan
       verzint deze laag geen succes. */
    const gezet = rb.markeerBetaald(a.ref, {
      at: stempel, boeking: b.boeking.id, centen: opbouw.totaalCenten, valuta: 'EUR' });
    if (gezet.error) return { status: gezet.status || 409, error: gezet.error };
    return { ok: true, betaling: gezet.betaald, rijen: metBoeking.rijen.length };
  }

  /* ---------- de weg terug ----------
     De SPIEGEL wordt puur berekend (./reisbureau-terugboeking.js) en hier alleen
     bewaard: twee schrijvers op een verklaarde bak is wat keuringsregel 63
     tegenhoudt. Er wordt GEEN geld verplaatst -- er ontstaat een teruggaveRECHT
     dat een mens uitvoert, net als bij kern/horeca/correctie.js. */
  function terugboeken(ref, { reden, geldrijIds } = {}) {
    const rb = bureau();
    if (!rb) return { status: 503, error: 'Het reisbureau is niet beschikbaar.' };
    const a = rb.aanvraagVan(ref);
    if (!a) return { status: 404, error: 'Aanvraag niet gevonden.' };
    if (!a.betaald) return { status: 409, error: 'Deze reis is niet betaald; er valt niets terug te draaien.' };

    const bestaand = rijenVan(a.ref);
    const uit = spiegelVoor({ rijen: bestaand, kiesIds: geldrijIds || null, reden,
      boekingId: a.betaald.boeking });
    if (!uit.ok) return { status: 409, error: 'Deze terugboeking kan niet.', hoe: uit.waarom };

    const stempel = klok();
    for (const x of uit.rijen) {
      const r = x.rij;
      eigen.bak('reisGeldrijen').push({
        id: nieuwId('RGH'), ref: a.ref, at: stempel, spiegelVan: x.spiegelVan,
        bedragCenten: r.bedragCenten, valuta: r.valuta,
        economischeHerkomst: r.economischeHerkomst,
        economischeEigenaar: r.economischeEigenaar, naarWie: r.naarWie,
        grond: r.grond, bronObject: r.bronObject, relatie: r.relatie,
        land: r.land, bewijs: r.bewijs
      });
    }
    /* Het RECHT, en niet de betaling. */
    eigen.bak('reisTeruggaven').push({
      id: nieuwId('RTG'), ref: a.ref, at: stempel,
      centen: uit.terugCenten, valuta: 'EUR', volledig: uit.volledig,
      economischeHerkomst: 'rtg', aan: 'lid', grond: String(reden).slice(0, 200),
      uitgevoerd: false,
      hoe: 'teruggaveRECHT; een mens van het kantoor voert hem uit langs kern/pay (GELD.md)'
    });
    save();
    return { ok: true, teruggedraaid: uit.rijen.length, centen: uit.terugCenten, volledig: uit.volledig };
  }

  /* De herkomstrijen van EEN reis, voor de meter en voor het kantoor. */
  function rijenVan(ref) {
    return eigen.kijk('reisGeldrijen').filter(r => r.ref === String(ref || ''));
  }
  function alleRijen() { return eigen.kijk('reisGeldrijen').slice(); }
  function uitkeringenVan(ref) {
    return eigen.kijk('reisUitkeringen').filter(r => r.ref === String(ref || ''));
  }

  return { reisbetaling: { betaal, terugboeken, rijenVan, alleRijen, uitkeringenVan,
    teruggavenVan: (ref) => eigen.kijk('reisTeruggaven').filter(r => r.ref === String(ref || '')), KAS } };
}

module.exports = { maakReisbetaling, KAS };
