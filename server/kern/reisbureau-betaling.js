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

const { geldrij } = require('./waarde/economischeherkomst');
const { voorAanvraag } = require('./reisbureau-samenstelling');

/* De positie waar RTG de reissom int. Een eigen naam en niet `rtg:reserve`:
   die bak is van de fondsafdracht (opzet/kern-geldnaden.js), en twee
   geldstromen op een positie maken elk saldo onverklaarbaar. */
const KAS = 'rtg:reisbureau';

/* ---------- PUUR: de samenstelling wordt een stel geldrijen ----------
   Geen db, geen pay, geen sessie -- zodat een toets hem kan voeden zonder dat er
   een server draait, en zodat de invariant hieronder aantoonbaar is in plaats
   van beloofd. */
function geldrijenVoor({ trip, personen, boekingId, valuta }) {
  const s = voorAanvraag(trip, personen);
  if (!s.bekend) return { ok: false, waarom: s.waarom, rijen: [], totaalCenten: null };

  const bron = boekingId ? ('payboeking:' + boekingId) : null;
  const rijen = s.regels.map(o => geldrij({
    bedragCenten: o.centen,
    valuta: valuta || 'EUR',
    /* WIE BETAALDE: het lid. Voor elke rij dezelfde, want er is een betaler. */
    economischeHerkomst: 'lid',
    /* AAN WIE HIJ TOEKOMT: per onderdeel verschillend, uit de commerciele bron
       en nergens afgeleid. */
    economischeEigenaar: o.eigenaar,
    /* WAAR HET GELD FEITELIJK HEEN GING: naar RTG. Ook voor het deel van het
       hotel -- dat is de hele reden dat dit veld bestaat. Zou hier `derde`
       staan, dan beweert de rij een uitkering die niet heeft plaatsgevonden. */
    naarWie: 'rtg',
    grond: o.wat || o.soort,
    bronObject: bron,
    relatie: o.leverancier || null,
    /* HET LAND BLIJFT LEEG. `trip.dest` is een plaatsnaam ("Ibiza") en daar
       valt geen landcode uit af te leiden zonder te raden -- dezelfde regel als
       in KAARTEN.md: een ingelezen waarde wordt nooit stilletjes verbeterd. */
    land: null,
    bewijs: 'kern/reisbureau-samenstelling.js, onderdeel van reis ' + String(trip && trip.id || '?')
  }));

  /* DE INVARIANT VAN DEZE SCHAKEL: de herkomstrijen tellen op tot precies het
     bedrag dat het lid betaalde. Niet "ongeveer", en er wordt geen restrij
     bijgemaakt om het kloppend te krijgen -- een restrij zonder eigenaar is
     precies de cent die later aan de verkeerde kant van de streep belandt. */
  const som = rijen.reduce((a, r) => a + (r.bedragCenten || 0), 0);
  if (som !== s.totaalCenten) {
    return {
      ok: false, rijen: [], totaalCenten: null,
      waarom: 'de herkomstrijen tellen op tot ' + som + ' cent en de reissom is ' + s.totaalCenten +
        ' cent. Er wordt niets bijgeboekt om het verschil te dekken.'
    };
  }
  return { ok: true, rijen, totaalCenten: s.totaalCenten, personen: s.personen, waarom: null };
}

function maakReisbetaling({ db, save, payVan, nu }) {
  const klok = nu || (() => new Date().toISOString());
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
    for (const r of metBoeking.rijen) eigen.bak('reisGeldrijen').push({ ref: a.ref, at: stempel, ...r });

    /* En wat er aan derden TOEKOMT, wordt klaargezet en niet uitgevoerd. */
    for (const r of metBoeking.rijen) {
      if (r.economischeEigenaar === 'rtg') continue;
      eigen.bak('reisUitkeringen').push({
        ref: a.ref, at: stempel, centen: r.bedragCenten, valuta: r.valuta,
        aan: r.economischeEigenaar, relatie: r.relatie, grond: r.grond,
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

module.exports = { maakReisbetaling, geldrijenVoor, KAS };
