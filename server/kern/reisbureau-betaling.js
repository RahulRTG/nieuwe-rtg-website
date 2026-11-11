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
const { maakSleutel } = require('../db/economische-identiteit');
const betaaltoestemming = require('./reisbureau-betaaltoestemming');

/* De positie waar RTG de reissom int. Een eigen naam en niet `rtg:reserve`:
   die bak is van de fondsafdracht (opzet/kern-geldnaden.js), en twee
   geldstromen op een positie maken elk saldo onverklaarbaar. */
const KAS = 'rtg:reisbureau';

function maakReisbetaling({ db, save, crypto, payVan, reisbureauVan, nu, bewerkCollectie }) {
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
  const bewaarRijen = require('./reisbureau-betalingsrijen')({ eigen, bewerkCollectie, save });
  const lopend = new Map();

  async function betaal(sess, codenaam, ref, nieuweInningMag) {
    const rb = bureau();
    if (!rb) return { status: 503, error: 'Het reisbureau is niet beschikbaar.' };
    const a = rb.aanvraagVan(ref);
    if (!a || a.keten) return { status: 404, error: 'Aanvraag niet gevonden.' };
    if (a.customerKey !== sess.key) return { status: 404, error: 'Aanvraag niet gevonden.' };
    if (a.betaald) return { ok: true, alBetaald: true, betaling: a.betaald };
    if (lopend.has(ref)) return lopend.get(ref);
    const taak = voerUit(rb, sess, codenaam, ref, nieuweInningMag);
    lopend.set(ref, taak);
    try { return await taak; } finally { lopend.delete(ref); }
  }

  async function voerUit(rb, sess, codenaam, ref, nieuweInningMag) {
    const p = pay();
    if (!p) return { status: 503, error: 'De betaallaag is niet beschikbaar.' };
    const oud = rb.aanvraagVan(ref), adres = oud.inning ? oud.inning.van : codenaam;
    if (!oud.inning) {
      const mag = betaaltoestemming(nieuweInningMag, p);
      if (mag.error) return mag;
    }
    const start = await rb.reserveerInning(ref, { key: sess.key, codenaam: adres });
    if (!start.ok || start.alBetaald) return start;
    const { trip, personen } = start.grond;
    const opbouw = geldrijenVoor({ trip, personen, valuta: 'EUR' });
    if (!opbouw.ok) return { status: 409, error: 'De vastgelegde geldbasis is ongeldig.', hoe: opbouw.waarom };

    const beweging = {
      van: 'lid:' + adres, naar: KAS, centen: opbouw.totaalCenten,
      soort: 'reis', oms: 'Reis ' + (start.titel || trip.id), ref,
      // een reis wordt een keer betaald, ook over een crash of een tweede instantie heen
      economischeSleutel: maakSleutel('pay-handeling', ['reis', ref])
    };
    let b = null;
    if (start.herstel) {
      if (typeof p.boekBekend !== 'function') return { status: 503, error: 'De eerdere betaaluitkomst kan niet veilig worden nagekeken.' };
      try { b = await p.boekBekend(beweging); }
      catch (_) { return { status: 503, error: 'De eerdere betaaluitkomst is onbereikbaar; er wordt niets nieuws geïnd.' }; }
      if (!b || b.ok !== true) {
        if (!b || b.status !== 404 || b.onbekend !== true || b.code !== 'PAY_BOEKING_ONBEKEND')
          return { status: 503, error: 'De eerdere betaaluitkomst wijkt af of is onbekend; er wordt niets nieuws geïnd.' };
        b = null;
      }
    }
    if (!b) {
      const mag = betaaltoestemming(nieuweInningMag, p);
      if (mag.error) return mag;
      if (adres !== codenaam) return { status: 409, error: 'Het betaaladres is gewijzigd; een nieuwe inning vraagt menselijke beoordeling.' };
      b = await p.boekAsync(beweging);
    }
    if (!b || b.error) {
      // Alleen een zekere weigering geeft wijzigen weer vrij. Bij onbereikbare
      // motor of onbekende afloop herhaalt men dezelfde duurzame geldidentiteit.
      if (b && [400, 402, 403].includes(b.status)) await rb.stopInning(ref);
      return { status: (b && b.status) || 502, error: (b && b.error) || 'De betaaluitkomst is onbekend; herhaal deze betaling om haar veilig te herstellen.' };
    }
    const bon = b.boeking;
    if (!bon || !bon.id || bon.van !== 'lid:' + adres || bon.naar !== KAS ||
        bon.centen !== opbouw.totaalCenten || bon.ref !== ref || bon.soort !== 'reis')
      return { status: 502, error: 'De betaallaag bevestigde niet de aangevraagde geldbeweging. Herstel is vereist.' };

    /* Nu pas, MET het boekingsnummer: een rij die naar een niet-bestaande
       boeking wijst, is een bewering zonder bewijs. */
    const metBoeking = geldrijenVoor({ trip, personen, boekingId: bon.id, valuta: 'EUR' });
    const stempel = bon.at || start.inning.at;
    const projectie = await bewaarRijen(ref, bon, metBoeking.rijen, stempel);
    if (!projectie.ok) return projectie;

    /* De EIGENAAR schrijft de betaling op zijn eigen rij; mislukt dat, dan
       verzint deze laag geen succes. */
    /* `van` is het BETAALADRES op de bon: een teruggave gaat daarheen terug en
       zoekt het niet opnieuw op (zie ./reisbureau-teruggave.js). */
    const gezet = await rb.markeerBetaald(ref, {
      at: stempel, boeking: bon.id, centen: opbouw.totaalCenten, valuta: 'EUR', van: adres });
    if (gezet.error) return { status: gezet.status || 409, error: gezet.error };
    return { ok: true, betaling: gezet.betaald, rijen: metBoeking.rijen.length };
  }

  /* ---------- de weg terug: ./reisbureau-teruggave.js ----------
     Afgesplitst op de 10 kB-grens toen er een UITVOERDER bij kwam. Hij krijgt
     de `eigen`-greep van DIT bestand mee en schrijft dus als deze eigenaar,
     niet ernaast (keuringsregel 63). */
  const terug = require('./reisbureau-teruggave').maakTeruggave({
    eigen, bureau, pay, klok, nieuwId, save, rijenVan: (ref) => rijenVan(ref), KAS });

  /* De herkomstrijen van EEN reis, voor de meter en voor het kantoor. */
  function rijenVan(ref) {
    return eigen.kijk('reisGeldrijen').filter(r => r.ref === String(ref || ''));
  }
  function alleRijen() { return eigen.kijk('reisGeldrijen').slice(); }
  function uitkeringenVan(ref) {
    return eigen.kijk('reisUitkeringen').filter(r => r.ref === String(ref || ''));
  }

  return { reisbetaling: { betaal, rijenVan, alleRijen, uitkeringenVan, KAS,
    terugboeken: terug.terugboeken, teruggavenVan: terug.teruggavenVan, teruggavenOpen: terug.teruggavenOpen,
    teruggaveVan: terug.teruggaveVan, teruggaveUitvoeren: terug.uitvoeren, teruggaveAfwijzen: terug.afwijzen } };
}

module.exports = { maakReisbetaling, KAS };
