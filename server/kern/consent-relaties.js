/* ============================================================================
   DE PERMISSION FIREWALL -- hetzelfde consent, maar per PARTIJ in plaats van
   per laag.

   WAAROM DIT GEEN NIEUWE LAAG IS. Het Consent Center (./consent.js) doet al
   precies wat een firewall hoort te doen: het bewaart niets, leest de negen
   lagen die de toestemming zelf beheren, en intrekken gaat terug naar die laag.
   Er staat hier dus geen tweede waarheid en geen tweede intrekknop -- dit
   bestand HERSCHIKT wat consentVan al oplevert.

   WAT ER WEL BIJ KOMT is de vraag die een mens werkelijk stelt. Het bestaande
   scherm groepeert per SOORT toestemming ("partners die uw identiteitsbewijs
   mogen inzien"). Iemand die zich afvraagt wat een bepaalde zaak van hem heeft,
   moet dan negen kopjes langs en zelf onthouden waar hij die naam zag staan.
   Hier staat het andersom: een partij, en daaronder alles wat zij mag.

   DE SLEUTEL IS NIET DE NAAM. `wie` is tekst die een mens leest; groeperen doet
   dit bestand op `partij`, de stabiele sleutel die ./consent.js erbij zet. De
   reden staat daar: `supplierName || supplierCode` zet dezelfde zaak in twee
   groepen zodra de naam een keer ontbreekt, en twee partijen kunnen dezelfde
   naam dragen -- en dan komt "sluit deze relatie" bij de verkeerde aan.

   WAT NIET GEGROEPEERD WORDT, en dat is geen tekortkoming maar een grens: twee
   lagen kennen helemaal geen partij. Uw zorgprofiel reist mee naar iedere zaak
   waar u bestelt (dat is een instelling, geen relatie), en een toestel schrijft
   metingen weg (dat is een ding, geen partij). Die staan apart, met die reden.
   Ze op hun label aan elkaar plakken zou een relatie suggereren die niet
   bestaat.
   ========================================================================== */
'use strict';

/* Wat er met opzet NIET in deze firewall staat, met de reden per regel. Deze
   lijst gaat mee naar het scherm: een overzicht dat "wie heeft toegang tot mij"
   heet en er drie weglaat, geeft zekerheid die er niet is -- dezelfde regel als
   in ./consent-register.js, en dezelfde reden. */
const BUITEN = [
  { naam: 'Uw boardroom',
    reden: 'Dat zijn uw eigen schakelaars en geen partij die iets van u mag. Wat uw werkgever daar dichtzet tijdens werktijd, ziet u op het bord zelf.' },
  { naam: 'Uw privekantoor (de bureau-delegatie)',
    reden: 'Daar machtigt u RTG zelf, per onderwerp en met een plafond. Dat is geen buitenstaander en het staat in het Privekantoor.' },
  { naam: 'Uw werkgever als organisatie',
    reden: 'Een arbeidsrelatie eindigt niet met een knop op dit scherm. Wat uw werkgever van u mag ZIEN staat hier wel, per stuk.' },
  { naam: 'Wie er in het verleden heeft gekeken',
    reden: 'Dat is een journaal en geen toestemming: het staat op uw inzagekaart. Hier staat alleen wat NU openstaat.' }
];

function maakRelaties({ consentVan, consentIntrek }) {

  /* De relaties, gesorteerd op wat het zwaarst weegt: eerst wie het meest mag.
     Niet alfabetisch -- een lijst waarin de partij met acht toestemmingen
     onderaan staat omdat zijn naam met een W begint, verbergt precies wat een
     mens hier zoekt. */
  function relatiesVan(key) {
    const bron = consentVan(key);
    if (!bron || !bron.ok) return bron;
    const perPartij = new Map();
    const losse = [];
    for (const r of bron.toestemmingen || []) {
      if (!r.partij) { losse.push(r); continue; }
      const g = perPartij.get(r.partij) || { partij: r.partij, naam: r.wie, rijen: [] };
      /* De weergavenaam van de EERSTE rij wint, behalve als die leeg was. Zo
         heet de groep naar de zaak en niet naar zijn code, ook als een van de
         lagen de naam niet kende. */
      if (!g.naam && r.wie) g.naam = r.wie;
      g.rijen.push(r);
      perPartij.set(r.partij, g);
    }
    const relaties = [...perPartij.values()].map(g => ({
      partij: g.partij, naam: g.naam || g.partij,
      aantal: g.rijen.length,
      teSluiten: g.rijen.filter(r => r.intrekbaar).length,
      rijen: g.rijen
    })).sort((a, b) => b.aantal - a.aantal || String(a.naam).localeCompare(String(b.naam)));

    return {
      ok: true, relaties, buiten: BUITEN,
      nietGebonden: losse.length ? {
        rijen: losse,
        uitleg: 'Deze staan niet bij een partij, omdat er geen partij is: een zorgprofiel dat meereist is een instelling, en een toestel is een ding. Ze zijn hier los in te trekken.'
      } : null,
      /* De onvolledigheid van de bron reist mee. Zonder dit zou dit scherm
         stiller zijn dan het scherm waar het op leunt, en dat is de verkeerde
         kant op voor een overzicht dat zekerheid moet geven. */
      nietGedekt: bron.nietGedekt, storingen: bron.storingen, voorbehoud: bron.voorbehoud
    };
  }

  /* DE GEVOLGEN, VOORAF. Dit is een simulatie en geen handeling: hij verandert
     niets en zegt wat er zou gebeuren.

     Hij draagt verplicht zijn eigen `nietGerekend`, zoals elke gevolgsimulatie
     in dit huis (MIJNRTG.md grens G4). Een voorbeschouwing die "0 conflicten"
     meldt zonder te zeggen waar zij niet heeft gekeken, koopt vertrouwen dat zij
     niet heeft verdiend. */
  function gevolgenVan(key, partij) {
    const alles = relatiesVan(key);
    if (!alles || !alles.ok) return alles;
    const r = (alles.relaties || []).find(x => x.partij === String(partij || ''));
    if (!r) return { status: 404, error: 'Die relatie kennen wij niet.' };
    return {
      ok: true, partij: r.partij, naam: r.naam,
      sluit: r.rijen.filter(x => x.intrekbaar).map(x => ({ laag: x.laag, wat: x.wat, tot: x.tot })),
      blijft: r.rijen.filter(x => !x.intrekbaar).map(x => ({ laag: x.laag, wat: x.wat,
        reden: 'Deze toestemming beheert de laag zelf en is hier niet in te trekken.' })),
      nietGerekend: [
        'Wat deze partij in het verleden al heeft gezien; dat blijft gezien en staat op uw inzagekaart.',
        'Lopende afspraken, bestellingen of een arbeidsrelatie: die eindigen hier niet.',
        'Gegevens die deze partij op grond van een wettelijke plicht bewaart.'
      ]
    };
  }

  /* SLUITEN gaat rij voor rij langs consentIntrek, en dus langs de laag die de
     toestemming beheert. Er wordt hier niets zelf uitgezet.

     Hij gaat DOOR na een mislukking en meldt per rij wat er gebeurde. Stoppen
     bij de eerste fout zou een half gesloten relatie achterlaten waarvan
     niemand weet welke helft -- en dat is erger dan een lijst met een rode
     regel erin. */
  function relatieSluit(key, partij) {
    const vooraf = gevolgenVan(key, partij);
    if (!vooraf || !vooraf.ok) return vooraf;
    const alles = relatiesVan(key);
    const r = alles.relaties.find(x => x.partij === String(partij || ''));
    const gedaan = [];
    for (const rij of r.rijen) {
      if (!rij.intrekbaar) { gedaan.push({ laag: rij.laag, gelukt: false, reden: 'niet intrekbaar' }); continue; }
      let uit;
      try { uit = consentIntrek(key, { laag: rij.laag, id: rij.id }); }
      catch (e) { uit = { error: 'Deze laag gaf een storing.' }; }
      gedaan.push({ laag: rij.laag, wat: rij.wat,
        gelukt: !!(uit && !uit.error && uit.status !== 404 && uit.status !== 500),
        reden: (uit && uit.error) || null });
    }
    const mis = gedaan.filter(g => !g.gelukt);
    return { ok: true, partij: r.partij, naam: r.naam, gedaan,
      gesloten: gedaan.length - mis.length, mislukt: mis.length,
      /* Eerlijk over de reikwijdte, ook als alles lukte. */
      nietGeraakt: vooraf.nietGerekend };
  }

  return { relatiesVan, gevolgenVan, relatieSluit, BUITEN };
}

module.exports = { maakRelaties, BUITEN };
