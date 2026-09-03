/* ============================================================================
   DE APPBRUG -- een rit uit de ledenapp wordt een vervoersOPDRACHT.

   HET BESLUIT DAT HIERONDER LIGT (3 september 2026, eigenaar). Er waren twee
   ritwerelden die niets van elkaar wisten:

     db.data.rides           de lidkant: /api/ride/request, supplier/ride/*,
                             zes standen uit kern/vervoer.js
     db.data.mobOpdrachten   het dispatchcentrum: /api/supplier/mob/*, tien
                             standen uit ./keten.js, met matching, overboeken
                             en telefoonboekingen

   Nul verwijzingen in beide richtingen. Het gevolg was gemeten in
   scripts/ritproef.js schakel 1: een vervoerder kan een aangevraagde app-rit
   nergens terugvinden -- niet in zijn historie (alleen afgerond), niet in de
   backoffice (alleen betaald, zonder ref) en niet op zijn dispatchbord (dat
   leest de andere lijst). Wat hij krijgt is een melding over de SSE-stroom, en
   is die verbinding weg, dan is de rit alleen nog te bereiken door de ref te
   kennen.

   Pijnlijk detail: de kop van ./dispatch.js belooft dat een telefoonboeking
   "een volwaardige opdracht" is en "dezelfde keten" krijgt als een app-rit. Die
   belofte klopt omgekeerd -- de telefoonboeking kreeg de volle keten, de
   app-rit haalde het bord nooit.

   HET BESLUIT: DE OPDRACHT WORDT DE WAARHEID. Een app-rit komt binnen als
   vervoersopdracht; de rij in `rides` blijft bestaan als projectie voor de 34
   plekken die haar lezen (fiscaal, kantoormetrics, waardering, spaarpot,
   annuleren, de leverancierstaat) en draagt voortaan `opdrachtRef` naar zijn
   opdracht.

   ================== DRIE DINGEN DIE HIER VASTLIGGEN ==================

   1. EEN MISLUKTE OPDRACHT BREEKT DE RIT NIET. `opdrachtMaak` heeft poorten die
      de app-rit tot nu toe niet passeerde: de module moet aanstaan in dat gebied
      (./register.js) en vertrek én bestemming moeten oplosbare PLEKKEN zijn
      (./plekken.js). Een app-rit draagt vaak alleen een tekst ("Haven"), en
      daar kan plekBepaal niets mee. Dan ontstaat er geen opdracht en blijft de
      rit precies zoals hij was -- met `opdrachtReden` erop, zodat het verschil
      leesbaar is in plaats van stil. Een besluit uitvoeren mag geen bestaande
      aanvragen weigeren die het gisteren nog deed.

   2b. DE RITKETEN IS GROVER, DUS DE BRUG LOOPT EEN PAD. `rides` kent zes
      standen, de opdrachtketen tien, en die laatste laat GEEN overslaan toe
      (./keten.js VOLGENDE). Een rit die van `aangevraagd` naar `geaccepteerd`
      gaat, doorloopt in de opdrachtwereld drie gebeurtenissen: geprijsd,
      aangeboden, geaccepteerd. En van `aan-boord` naar `afgerond` zijn het er
      twee: rijdt, voltooid.

      Die tussenstappen zijn geen kunstgrepen. Bij een app-rit staat de prijs
      meteen vast (de offerte zat in de aanvraag) en is hij meteen aangeboden
      aan die ene vervoerder -- de gebeurtenissen zijn dus echt gebeurd, alleen
      niet apart zichtbaar in de grovere ritketen. De brug loopt daarom de
      kortste weg door de HOOFDketen; uitzonderingsstanden (incident,
      no-show, betaalprobleem) doen daar niet aan mee, want die zijn nooit een
      tussenstap maar een besluit.

   2. DE STANDEN WORDEN VERTAALD EN NIET GELIJKGETROKKEN. De twee ketens delen
      vier standen letterlijk en twee onder een andere naam. Het gevaarlijke
      woord is `rijdt`: in `rides` is dat een VEROUDERDE naam voor `aan-boord`
      (RIT_LEGACY mapt hem weg), in de opdrachtketen een EIGEN stand ná
      `ingestapt`. Wie de twee lijsten zonder vertaaltabel aan elkaar knoopt,
      zet een rit die net is ingestapt op "rijdt" of andersom. De tabel staat
      hieronder, uitgeschreven, met de botsing erbij.

   3. DE BRUG LOOPT ÉÉN KANT OP. Deze module schrijft van rit naar opdracht en
      nooit terug. Een tweede richting zou betekenen dat twee lijsten elkaar
      bijwerken, en dan is de vraag "welke is de waarheid" opnieuw open -- het
      besluit was juist dat de opdracht dat is. Wat de lidkant leest, blijft
      voorlopig uit `rides` komen; die lezers omzetten is de volgende stap en
      geen onderdeel van deze brug.

   WAT DIT (NOG) NIET IS. De 34 lezers van `db.data.rides` zijn niet omgezet, dus
   `rides` is vandaag nog een echte lijst en geen projectie. De richting staat
   vast, de migratie niet. Zolang dat zo is, houdt scripts/ritproef.js de
   bevinding in beeld.
   ========================================================================== */
'use strict';

const { STAND_NAAR_OPDRACHT, NIET_OVERBRUGD } = require('./appbruglijst');
module.exports = ({ opdrachtMaak, opdrachtMet, opdrachtNaar, keten }) => {
  const K = keten || require('./keten');

  /* De kortste weg door de HOOFDketen, van waar de opdracht staat naar waar hij
     heen moet. Breedte-eerst over VOLGENDE, en alleen langs standen die in
     KETEN staan: een pad via `incident` zou een storing verzinnen die er niet
     was. Geeft [] als er geen weg is (dan staat de opdracht al voorbij het
     doel, of ligt hij op een uitzondering). */
  function padNaar(van, naar) {
    if (van === naar) return [];
    const inKeten = new Set(K.KETEN);
    const gezien = new Set([van]);
    let rand = [[van, []]];
    for (let diepte = 0; diepte < K.KETEN.length && rand.length; diepte++) {
      const nieuw = [];
      for (const [stand, pad] of rand) {
        for (const volgende of (K.VOLGENDE[stand] || [])) {
          if (!inKeten.has(volgende) || gezien.has(volgende)) continue;
          const p = pad.concat(volgende);
          if (volgende === naar) return p;
          gezien.add(volgende);
          nieuw.push([volgende, p]);
        }
      }
      rand = nieuw;
    }
    return null;
  }


  /* Van de velden van een app-rit naar het lijf dat opdrachtMaak verwacht.

     HET VERTREKPUNT VOLGT DEZELFDE TERUGVAL ALS DE RIT ZELF. kern/lidacties/
     ritten.js neemt de live locatie van het lid en valt terug op de locatie van
     de VERVOERDER als die er niet is -- daar staat de auto, en dat is de
     schatting waarop de offerte al werd gemaakt. Zou de brug alleen `{hier}`
     accepteren, dan kreeg elk lid zonder GPS geen opdracht, terwijl zijn rit wel
     gewoon werd aangevraagd. Twee plekken die hetzelfde beslissen moeten het
     ook hetzelfde beslissen (LAT.md regel 4).

     `naar` alleen als er een ZAAK of een punt achter zit; een vrije tekst is
     geen plek (zie NIET_OVERBRUGD). */
  function lijfVan(ride, body, vanaf) {
    const naar = ride.toCode ? { zaak: ride.toCode }
      : (body && Number.isFinite(body.toLat) && Number.isFinite(body.toLng)
        ? { lat: body.toLat, lng: body.toLng, label: ride.to } : null);
    if (!naar) return { error: NIET_OVERBRUGD['bestemming-als-tekst'] };
    const van = (vanaf && Number.isFinite(vanaf.lat))
      ? { lat: vanaf.lat, lng: vanaf.lng, label: vanaf.label || 'Vertrekpunt' }
      : { hier: true };
    return {
      lijf: {
        ritsoort: ride.plannedFor ? 'gepland' : 'direct',
        van,
        naar,
        reizigers: ride.passengers || 1,
        bagage: ride.luggage || 0,
        vervoerder: ride.supplierCode,
        wanneer: ride.plannedFor || null
      }
    };
  }

  /* Maak de opdracht bij een zojuist aangevraagde rit. Geeft ALTIJD iets terug:
     `{ ok, ref }` of `{ ok: false, reden }` -- nooit een uitzondering, want een
     brug die de aanvraag laat klappen is erger dan geen brug. */
  function opdrachtBijRit(ride, session, body, vanaf) {
    if (!ride || !ride.ref) return { ok: false, reden: 'geen rit' };
    let uit;
    try {
      const v = lijfVan(ride, body, vanaf);
      if (v.error) return { ok: false, reden: v.error };
      uit = opdrachtMaak({ soort: 'lid', key: session.key, session, groep: session.tier,
        org: null, stad: null }, v.lijf);
    } catch (e) {
      return { ok: false, reden: 'de opdrachtlaag gaf een fout: ' + (e && e.message || e) };
    }
    if (!uit || uit.error || !uit.opdracht) {
      return { ok: false, reden: (uit && uit.error) || 'de opdrachtlaag maakte geen opdracht' };
    }
    return { ok: true, ref: uit.opdracht.ref };
  }

  /* De stand van een rit doorzetten naar zijn opdracht. Stil overslaan waar er
     geen opdracht is (zie punt 1) en waar de stand niet vertaalbaar is --
     `geweigerd` bijvoorbeeld heeft in de opdrachtketen een eigen weg
     (annuleren) en hoort niet stilzwijgend op een keten-stand te belanden. */
  function standDoor(ride, nieuweStand) {
    if (!ride || !ride.opdrachtRef) return { ok: false, reden: 'deze rit heeft geen opdracht' };
    const doel = STAND_NAAR_OPDRACHT[String(nieuweStand || '')];
    if (!doel) return { ok: false, reden: 'stand "' + nieuweStand + '" heeft geen tegenhanger in de opdrachtketen' };
    const o = opdrachtMet ? opdrachtMet(ride.opdrachtRef) : null;
    if (!o) return { ok: false, reden: 'de opdracht bestaat niet meer' };
    if (o.status === doel) return { ok: true, stand: doel, stappen: [] };
    const pad = padNaar(o.status, doel);
    if (!pad) return { ok: false, reden: 'geen weg door de opdrachtketen van "' + o.status + '" naar "' + doel + '"' };
    const gezet = [];
    try {
      for (const stap of pad) {
        const uit = opdrachtNaar(ride.opdrachtRef, stap, 'appbrug');
        if (uit && uit.error) return { ok: false, reden: uit.error, stappen: gezet, bleefOp: stap };
        gezet.push(stap);
      }
      return { ok: true, stand: doel, stappen: gezet };
    } catch (e) {
      return { ok: false, reden: 'de opdrachtlaag gaf een fout: ' + (e && e.message || e), stappen: gezet };
    }
  }

  return { opdrachtBijRit, standDoor, padNaar, STAND_NAAR_OPDRACHT, NIET_OVERBRUGD, lijfVan };
};
module.exports.STAND_NAAR_OPDRACHT = STAND_NAAR_OPDRACHT;
module.exports.NIET_OVERBRUGD = NIET_OVERBRUGD;
