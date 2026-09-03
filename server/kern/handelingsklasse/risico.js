/* HOE ZWAAR WEEGT DEZE HANDELING? -- en waar dat oordeel vandaan komt.

   Dit is de risicokant van ../handelingsklasse.js (TAKEN.md 4.71). De algemene
   regel staat daar en geldt hier onverkort: ER WORDT NIETS GERADEN. Elke waarde
   draagt zijn bron en zijn bewijsgraad, en `onbekend` is een eersteklas uitslag.

   WAAR DE KLASSEN VANDAAN KOMEN, EN WAAROM ER GEEN VIJFDE BRON BIJ MAG

   Er wordt niets nieuws verklaard. Alle vier de bronnen zijn besluiten die dit
   huis AL heeft genomen, elk op een plek waar iemand ze bewust opschreef:

     1. kern/stuur/beleid.js -- LEZEN. Een pad dat daar staat verandert niets.
        Dat is geen risico-inschatting maar een uitspraak over gedrag, en dus de
        enige plek waar `geen` uit volgt.
     2. kern/frictie/bodem.js -- de bodem onder de frictie. `minimum: 'hand'`
        betekent dat dit huis de handeling NOOIT laat automatiseren (een
        pasbesluit, een KYC-besluit); `minimum: 'assist'` dat er een mens bij
        moet zijn (geld dat het huis verlaat). Die twee zijn een grens die al
        gemotiveerd is, met de wet erbij, en ze zijn niet per pad opnieuw te
        onderhandelen.
     3. kern/stuur/beleid.js -- VOORSTEL. Wat de AI alleen mag KLAARZETTEN,
        vraagt per definitie een mens.
     4. HERSTELPROEF.json -- 90 routeparen die ECHT zijn uitgevoerd (heen,
        kijken, terug, kijken) met de inhoud van de opslag vergeleken. Dat is de
        enige gemeten uitspraak over omkeerbaarheid die dit huis heeft.

   Een vijfde bron erbij zetten is geen uitbreiding maar een tweede beleidslaag:
   dan staat er ergens een risico-oordeel dat niet uit een bestaande grens volgt,
   en precies dat is wat 4.71 tegenhoudt. Wie er een bij wil, verplaatst eerst de
   GRENS naar bodem.js of beleid.js, en dan volgt de klasse er vanzelf uit.

   `ongemarkeerd` IS GEEN SYNONIEM VAN `laag`, en dat is de scherpste keuze hier.

   Een schrijfroute waar geen enkele bron iets over zegt, heet niet `laag` en
   niet `gewoon`. Hij heet `ongemarkeerd`: het FEIT is dat geen grens in dit huis
   deze route aanwijst, en dat is iets anders dan de bewering dat hij ongevaarlijk
   is. Zou hij `laag` heten, dan leest een bord straks "3000 handelingen met laag
   risico" terwijl er in werkelijkheid over 3000 handelingen niets is vastgesteld.
   Dat is dezelfde fout als een geraden risicoklasse, alleen vriendelijker
   verpakt.

   ========================================================================== */
'use strict';

/* De klassen, van geen risico naar hoog, met `onbekend` ERBUITEN -- die is geen
   trede op de ladder maar de afwezigheid van een uitslag. Wie ze sorteert of
   optelt, hoort tegen te komen dat `onbekend` er niet in staat. */
const RISICO = Object.freeze(['geen', 'ongemarkeerd', 'verhoogd', 'hoog']);
const ONBEKEND = 'onbekend';

function maakRisico(bodem, beleid) {
  /* LEZEN, KLEIN en VOORSTEL zijn per WERELD (de rol) gedefinieerd; deze module
     gaat over de route en niet over wie er belt.

     HIER STOND "IN ELKE WERELD", EN DAT WAS FOUT -- gemeten en niet bedacht. De
     eerste versie noemde een pad alleen `geen` als het in ELKE rol als lezen
     stond, om te voorkomen dat een schrijfroute "er verandert niets" heet zodra
     een rol hem alleen leest. Klinkt streng, is onbruikbaar: die lijsten zijn
     per rol en een member-pad staat nooit in de supplier-lijst. Over 4729 paden
     leverde het 0 keer `geen`, en een klasse die nooit voorkomt is geen klasse.

     De regel die het WEL doet: hij staat ergens als lezen, en NERGENS als
     schrijven. Zodra een rol via dat pad iets mag veranderen -- KLEIN (een
     kleine omkeerbare handeling) of VOORSTEL (klaarzetten) -- is de uitspraak
     "dit verandert niets" niet houdbaar, ongeacht wat de andere rollen mogen. */
  /* EN HET ZIJN PATRONEN EN GEEN PADEN, en dat is hier de tweede fout die
     gemeten is in plaats van bedacht. De eerste versie deed `.includes(pad)` op
     die lijsten -- dat matcht nooit, want er staan reguliere expressies in. Over
     4729 paden gaf hij 0 keer `geen` en dat leek een strenge regel; het was een
     vergelijking die niets deed. Exact dezelfde fout stond in
     scripts/gezagshandelingen.js, waar hij nul overlap vond die alleen over
     schrijfwijze ging. Een lijst met patronen wordt TEGEN het pad gehouden. */
  const raakt = (tabel, pad) => {
    if (!tabel) return false;
    for (const w of Object.keys(tabel)) {
      for (const regel of (tabel[w] || [])) {
        if (regel instanceof RegExp) { if (regel.test(pad)) return true; }
        else if (String(regel) === pad) return true;
      }
    }
    return false;
  };

  function risicoVan(pad) {
    const p = String(pad || '');
    if (!bodem && !beleid) {
      return { klasse: ONBEKEND, graad: 'onbekend',
        bron: null, reden: 'noch de bodem noch het AI-beleid is te laden; er is niets om op te classificeren' };
    }
    /* 1. De bodem eerst, want dat is de STRENGSTE bron: hij zegt wat nooit
          soepeler mag worden en draagt zijn eigen motivering. */
    const b = bodem && bodem.bodemVoorPad ? bodem.bodemVoorPad(p) : null;
    if (b && b.minimum === 'hand') {
      return { klasse: 'hoog', graad: 'bewezen', bron: 'kern/frictie/bodem.js:' + b.id,
        reden: b.waarom || 'de bodem laat deze handeling nooit automatiseren' };
    }
    if (b && b.minimum === 'assist') {
      return { klasse: 'verhoogd', graad: 'bewezen', bron: 'kern/frictie/bodem.js:' + b.id,
        reden: b.waarom || 'de bodem eist een mens bij deze handeling' };
    }
    /* 2. Wat de AI alleen mag KLAARZETTEN, vraagt een mens -- ook zonder bodem. */
    if (beleid && raakt(beleid.VOORSTEL, p)) {
      return { klasse: 'verhoogd', graad: 'gemeten', bron: 'kern/stuur/beleid.js:VOORSTEL',
        reden: 'het AI-stuur mag dit pad alleen klaarzetten; een mens maakt het af' };
    }
    /* 3. Ergens lezen en nergens schrijven: dan verandert er niets. */
    if (beleid && raakt(beleid.LEZEN, p)
        && !raakt(beleid.KLEIN, p) && !raakt(beleid.VOORSTEL, p)) {
      return { klasse: 'geen', graad: 'gemeten', bron: 'kern/stuur/beleid.js:LEZEN',
        reden: 'dit pad staat als lezen en in geen enkele rol als schrijven; er verandert niets' };
    }
    /* 4. En anders: geen grens in dit huis wijst deze route aan. Dat is een
          FEIT en geen inschatting -- zie de kop over `ongemarkeerd`. */
    return { klasse: 'ongemarkeerd', graad: 'gemeten', bron: 'kern/handelingsklasse.js',
      reden: 'geen bodem, geen voorstel-lijst en geen lees-lijst wijst dit pad aan; ' +
        'dat zegt dat er niets is vastgesteld en niet dat het risico laag is' };
  }

  return { risicoVan };
}

module.exports = { maakRisico, RISICO, ONBEKEND };
