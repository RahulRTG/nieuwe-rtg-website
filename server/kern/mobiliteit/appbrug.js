/* ============================================================================
   DE APPBRUG -- een rit uit de ledenapp wordt een vervoersOPDRACHT.

   HET BESLUIT DAT HIERONDER LIGT (3 september 2026, eigenaar). Er waren twee
   ritwerelden die niets van elkaar wisten:

     db.data.rides           de lidkant: /api/ride/request, supplier/ride/*,
                             zes standen uit kern/vervoer.js
     db.data.mobOpdrachten   het dispatchcentrum: /api/supplier/mob/*, tien
                             standen uit ./keten.js, met matching, overboeken
                             en telefoonboekingen

   Nul verwijzingen in beide richtingen. Gemeten in scripts/ritproef.js schakel
   1: een vervoerder kon een aangevraagde app-rit nergens terugvinden -- niet in
   zijn historie (alleen afgerond), niet in de backoffice (alleen betaald,
   zonder ref) en niet op zijn dispatchbord (dat leest de andere lijst). Wat hij
   kreeg was een melding over de SSE-stroom; was die verbinding weg, dan was de
   rit alleen nog te bereiken door de ref te kennen.

   Pijnlijk detail: de kop van ./dispatch.js belooft dat een telefoonboeking
   "dezelfde keten" krijgt als een app-rit. Die belofte klopt omgekeerd -- het
   was de app-rit die het bord nooit haalde.

   HET BESLUIT: DE OPDRACHT WORDT DE WAARHEID. Een app-rit komt binnen als
   vervoersopdracht; de rij in `rides` blijft bestaan voor de plekken die haar
   lezen (scripts/ritmigratie.js deelt ze in) en draagt voortaan `opdrachtRef`.

   ================== DRIE DINGEN DIE HIER VASTLIGGEN ==================

   1. EEN MISLUKTE OPDRACHT BREEKT DE RIT NIET. `opdrachtMaak` kan weigeren: een
      vervoersmodule die in dat gebied uitstaat, een vertrekpunt dat niet is op
      te lossen. Dan ontstaat er geen opdracht en blijft de rit precies zoals hij
      was -- met `opdrachtReden` erop, zodat het verschil leesbaar is in plaats
      van stil. Een besluit uitvoeren mag geen aanvragen weigeren die het
      gisteren nog deed.

      Een rit ZONDER bestemming is geen mislukking meer: als de vervoerder die
      soort aanneemt (ZAAK_OPTIES.rittenZonderDoel), krijgt de opdracht een
      bestemming die expliciet `onbekend` heet. Neemt hij hem niet aan, dan is
      de rit al geweigerd voordat deze brug aan de beurt komt. Zie MAATSTAF.md
      par. 7.5b.

   2b. DE RITKETEN IS GROVER, DUS DE BRUG LOOPT EEN PAD. `rides` kent zes
      standen, de opdrachtketen tien, en die laat GEEN overslaan toe (./keten.js
      VOLGENDE). `aangevraagd` -> `geaccepteerd` is daar drie gebeurtenissen
      (geprijsd, aangeboden, geaccepteerd) en `aan-boord` -> `afgerond` twee
      (rijdt, voltooid).

      Geen kunstgrepen: bij een app-rit staat de prijs meteen vast en is hij
      meteen aangeboden aan die ene vervoerder -- de gebeurtenissen zijn echt
      gebeurd, alleen niet apart zichtbaar in de grovere ritketen. De brug loopt
      de kortste weg door de HOOFDketen; uitzonderingsstanden (incident,
      no-show, betaalprobleem) doen niet mee, want die zijn nooit een tussenstap
      maar een besluit.

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
  function lijfVan(ride, body, vanaf, magZonderDoel) {
    /* Een bestemming die de reiziger nog niet noemt is een NORMALE taxirit, en
       geen ontbrekend gegeven -- mits deze vervoerder die soort aanneemt
       (ZAAK_OPTIES.rittenZonderDoel). Dan krijgt de opdracht een expliciet
       onbekende bestemming: geen afstand, geen vaste prijs, wel een plek op het
       dispatchbord. Neemt hij die soort NIET aan, dan is de rit hier al
       geweigerd door kern/lidacties/ritten.js en komen we hier niet. */
    const naar = ride.toCode ? { zaak: ride.toCode }
      : (body && Number.isFinite(body.toLat) && Number.isFinite(body.toLng)
        ? { lat: body.toLat, lng: body.toLng, label: ride.to }
        : (magZonderDoel ? { onbekend: true } : null));
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
  function opdrachtBijRit(ride, session, body, vanaf, magZonderDoel) {
    if (!ride || !ride.ref) return { ok: false, reden: 'geen rit' };
    let uit;
    try {
      const v = lijfVan(ride, body, vanaf, magZonderDoel);
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
