/* Het Privekantoor, deelbestand "graaf": de Life Graph.

   DIT IS EEN PROJECTIE, GEEN TWEEDE DATABASE. Dat is de belangrijkste zin van
   dit bestand. De verleiding bij een levensgraaf is om alles nog een keer op te
   slaan in graafvorm -- knopen en kanten in een eigen tabel, gevuld door de apps
   die schrijven. Dan staat het huis van het lid op twee plekken, en regel 4 van
   de lat zegt precies wat er dan gebeurt: ze lopen uiteen, en meestal zonder dat
   iets klaagt. Een huis dat in Maison is hernoemd zou in de graaf zijn oude naam
   houden, en niemand zou het merken tot iemand de verkeerde deur laat openen.

   Dus: de graaf LEEST db.data.lifestyle[key] en bouwt de knopen elke keer
   opnieuw. Traag genoeg om te merken bij honderdduizend knopen, maar een lid
   heeft er honderden. De waarheid blijft waar hij hoort -- in de app die hem
   beheert -- en de graaf voegt alleen toe wat nergens stond: de VIJF ETIKETTEN
   per stuk informatie.

     bron        uit welke app het komt (en dus wie hem verandert)
     eigenaar    van wie het is: het lid zelf, of iemand in zijn kring
     deel        wie het mag zien: alleen het lid, ook de Rechterhand, ook het
                 concierge-bureau. Dit is een POORT, geen etiket -- graafVoor()
                 filtert erop, en de bureau-kant krijgt nooit meer dan is
                 vrijgegeven
     gevoelig    0 open, 1 persoonlijk, 2 vertrouwelijk, 3 besloten
     vervalt     de datum waarop dit ding aandacht nodig heeft (of leeg)

   Die laatste is waarom de graaf er is. Verzekeringen, taxaties, keuringen,
   paspoorten, visa, drinkvensters: ze staan alle in een eigen app, en elke app
   waarschuwt netjes over ZIJN EIGEN datums. Wat niemand deed is ze bij elkaar
   optellen. Dat doet ./termijnen.js, op deze graaf, en daar komt de
   Control Tower vandaan.

   Gemount via ./index.js. De bronnen zelf staan in ./graaf-bronnen.js. */
'use strict';

/* De gevoeligheidstrap komt uit ./graaf-hulp.js en staat hier NIET nog een keer:
   de bronnen lezen hem daar ook, en twee definities van "besloten" is precies de
   dubbeling die regel 4 van de lat verbiedt. */
const { OPEN, PERSOONLIJK, VERTROUWELIJK, BESLOTEN } = require('./graaf-hulp');

/* Wie mag het zien. Oplopend: wat de bureau-kant mag zien mag de Rechterhand
   ook, wat de Rechterhand mag zien mag het lid altijd. */
const KRING = { lid: 0, rechterhand: 1, kantoor: 2 };

module.exports = (ctx) => {
  const { db, vandaag } = ctx;
  const bronnen = require('./graaf-bronnen');

  /* De enige plek waar een knoop ontstaat. Alles loopt hierdoorheen, en daarom
     kan hier EEN regel staan die overal geldt: besloten (3) betekent alleen het
     lid. Een bron die per ongeluk `deel: 'kantoor'` bij een gezondheidsknoop
     zet, wordt hier teruggezet -- niet gemeld en genegeerd, maar gecorrigeerd,
     want een lek dat een waarschuwing geeft is nog steeds een lek.

     Zonder deze regel op EEN plek zou elke bron hem apart moeten naleven, en
     dat is precies de vorm waarvan regel 4 zegt dat hij uiteenloopt. */
  function knoop(rec) {
    const gevoelig = Math.max(OPEN, Math.min(BESLOTEN, Number(rec.gevoelig) || OPEN));
    let deel = KRING[rec.deel] === undefined ? 'rechterhand' : rec.deel;
    if (gevoelig >= BESLOTEN) deel = 'lid';
    return {
      id: rec.id,
      soort: rec.soort,
      naam: String(rec.naam == null ? '' : rec.naam).slice(0, 120),
      kamer: rec.kamer,
      bron: rec.bron,
      eigenaar: rec.eigenaar || 'lid',
      deel,
      gevoelig,
      vervalt: rec.vervalt || '',
      vervaltWat: rec.vervalt ? (rec.vervaltWat || 'termijn') : '',
      waarde: Math.max(0, Math.round(Number(rec.waarde) || 0)),
      ouder: rec.ouder || null
    };
  }

  /* Het dossier van het lid, zonder het aan te maken. De graaf LEEST alleen:
     wie hem opvraagt hoort geen lege lijsten in de database te schrijven, want
     dan groeit db.data.lifestyle met een rij per lid dat een keer heeft gekeken.
     Vandaar niet L(key) uit de andere modules, maar dit. */
  function dossierVan(key) {
    const alle = db.data && db.data.lifestyle;
    return (alle && alle[key]) || {};
  }

  /* De hele graaf van een lid: elke bron levert zijn knopen, wij plakken ze aan
     elkaar en leiden de kanten af uit `ouder`. Kanten zijn dus geen apart
     gegeven -- ze volgen uit de knopen, en kunnen daarom niet met ze uit de pas
     lopen. */
  function graaf(key) {
    const l = dossierVan(key);
    const knopen = [];
    for (const bron of bronnen.ALLE) {
      let uit;
      /* Een bron die valt mag de hele graaf niet meenemen: dan zou een fout in
         Cellier de Control Tower stilleggen, en dat is precies het soort stille
         uitval waar regel 5 over gaat. We tellen hem, en ./nu.js zet het op het
         scherm -- niet in een log dat niemand leest. */
      /* Een bron krijgt er de SLEUTEL en de database bij. De veertien bronnen
         die het dossier lezen negeren dat derde argument; ./graaf-platform.js
         heeft het nodig, want die leest wat het PLATFORM al van dit lid weet en
         dat staat niet in `l`. Het contract is daarmee uitgebreid en niet
         gebroken. */
      try { uit = bron.knopen(l, knoop, { key, db }) || []; }
      catch (e) { uit = [{ __stuk: bron.kamer }]; }
      for (const k of uit) knopen.push(k);
    }
    const stuk = knopen.filter(k => k.__stuk).map(k => k.__stuk);
    // een bron die op zijn dak stuitte; zie graaf-platform.js
    const afgekapt = knopen.filter(k => k.__afgekapt).map(k => k.__afgekapt);
    const goed = knopen.filter(k => !k.__stuk && !k.__afgekapt);

    const perId = new Map(goed.map(k => [k.id, k]));
    const kanten = [];
    for (const k of goed) {
      if (k.ouder && perId.has(k.ouder)) kanten.push({ van: k.ouder, naar: k.id, band: k.soort });
    }
    return { knopen: goed, kanten, stuk, afgekapt, perId };
  }

  /* De graaf zoals EEN BEPAALDE KRING hem mag zien. Dit is de poort waar de
     privacy-belofte van CLAUDE.md hard wordt: het concierge-bureau werkt op
     codenamen en krijgt nooit de gezondheids- of nalatenschapsknopen te zien,
     ook niet als een verzoek daarnaar verwijst.

     Let op de richting van de vergelijking. `deel` zegt hoe VER iets mag reizen;
     `kring` zegt hoe ver de kijker staat. Zichtbaar is: kring <= deel. */
  function graafVoor(key, kring, voorafG) {
    const g = voorafG || graaf(key);
    const mag = KRING[kring] === undefined ? KRING.lid : KRING[kring];
    const knopen = g.knopen.filter(k => mag <= KRING[k.deel]);
    const zichtbaar = new Set(knopen.map(k => k.id));
    return {
      knopen,
      kanten: g.kanten.filter(e => zichtbaar.has(e.van) && zichtbaar.has(e.naar)),
      stuk: g.stuk, afgekapt: g.afgekapt,
      verborgen: g.knopen.length - knopen.length
    };
  }

  /* Wat er in de graaf staat, samengevat per kamer. Dit voedt het bureaublad
     van de app: een kamer zonder knopen is niet stuk, hij is leeg, en dat is
     iets anders dan "in aanbouw" (zie ./kamers.js). */
  function graafSamenvatting(key, voorafG) {
    const g = voorafG || graaf(key);
    const perKamer = {};
    for (const k of g.knopen) {
      const c = perKamer[k.kamer] || (perKamer[k.kamer] = { knopen: 0, waarde: 0, termijnen: 0 });
      c.knopen++;
      c.waarde += k.waarde;
      if (k.vervalt) c.termijnen++;
    }
    return {
      knopen: g.knopen.length,
      kanten: g.kanten.length,
      waarde: g.knopen.reduce((s, k) => s + k.waarde, 0),
      metTermijn: g.knopen.filter(k => k.vervalt).length,
      besloten: g.knopen.filter(k => k.gevoelig >= BESLOTEN).length,
      perKamer,
      stuk: g.stuk, afgekapt: g.afgekapt
    };
  }

  /* `knoop` gaat mee naar buiten om één reden: de regel "besloten betekent alleen
     het lid" is niet te beproeven via de bronnen, want die houden zich er alle
     veertien netjes aan. Een mutatie die de regel sloopt bleef daardoor
     onopgemerkt -- de vorm waar regel 2 van de lat voor waarschuwt: een
     afgeslagen mutatie is een bevinding, niet een geslaagde toets.
     test/bureau.test.js voert hem nu rechtstreeks een knoop die het
     tegenovergestelde beweert. */
  return { graaf, graafVoor, samenvatting: graafSamenvatting, vandaag, knoop,
    NIVEAUS: { OPEN, PERSOONLIJK, VERTROUWELIJK, BESLOTEN }, KRING };
};
