/* Magnaat Van Nul (V1): DE GETALLEN VAN EEN LEVEN DAT BIJ NUL BEGINT.

   Een mens met € 63 op de rekening en een baan. Alles hier is een spelregel en
   geen advies: de bedragen zijn gekozen zodat de eerste maand krap is, een
   eigen project mogelijk maar niet gratis, en een factuur die te laat wordt
   betaald echt pijn doet (MAGNAAT.md, V1 From Zero).

   GELD IS EEN GEHEEL AANTAL EUROCENTEN, zoals overal in Magnaat (M-020). Dit
   bestand kent alleen bedragen; wat ermee gebeurt staat in ./dag.js en
   ./acties.js, en elke euro loopt door het grootboek (./boek.js). */
'use strict';

const REGELVERSIE = '1';
const DAG_MS = 180000;             // een speldag duurt drie echte minuten
const MAX_DAGEN_PER_KEER = 120;    // een vangnet, zoals in World: de rest volgt bij de volgende aanraking
const START_DAG = 20;              // je begint vijf dagen voor je loon
const START_KAS = 6300;            // € 63
const MAAND = 30;

const BAAN = {
  werkgever: 'Groothandel Koster', functie: 'Magazijnmedewerker',
  loon: 165000,                    // netto per maand, op dag 25: net genoeg, niet ruim
  urenPerDag: 8,
  overwerk: { uren: 4, loon: 6000 }   // een extra dienst in het weekend
};

/* Wat het leven kost. Huur en vaste lasten op de eerste van de maand, de rest
   per dag. Rood staan kost rente op de eerste van de maand. */
const KOSTEN = {
  huur: 95000, vasteLasten: 30000, levenPerDag: 1200,
  roodRentePromille: 15,           // 1,5% van het negatieve saldo per maand
  kvk: 8225                        // inschrijving bij de Kamer van Koophandel
};

/* Vrije uren per dag: wat er overblijft naast je baan en je slaap. */
const UREN = { werkdag: 4, weekend: 12 };
const isWeekend = (dag) => dag % 7 === 6 || dag % 7 === 0;

const BETAALTERMIJN = 14;          // dagen
const HERINNERING_BETAALT_NA = 2;  // dagen na een herinnering
const LENING = { max: 50000, termijnen: 2 };   // familie, renteloos, in twee maanden terug

/* WAT JE KUNT AANBIEDEN, en de klanten die daarbij horen. Een klant heeft een
   budget (wat hij maximaal wil betalen), een stijl (hoe hard hij onderhandelt)
   en een betaalgedrag (hoeveel dagen te laat). De eerste klant betaalt altijd
   te laat: dat is de kern van de keten, niet het toeval. */
const AANBOD = {
  websites: {
    naam: 'Websites voor lokale ondernemers', software: 'Websitebouwer', softwareKosten: 1900,
    klanten: [
      { id: 'bakkerij', naam: 'Bakkerij Van Dam', behoefte: 'een eenvoudige website met openingstijden', budget: 100000, stijl: 80, laat: 12, uren: 24 },
      { id: 'fysio', naam: 'Fysiotherapie Oudwijk', behoefte: 'een pagina waarop patiënten een afspraak maken', budget: 180000, stijl: 90, laat: 0, uren: 36 },
      { id: 'buurthuis', naam: 'Buurthuis De Linde', behoefte: 'een website met een agenda', budget: 70000, stijl: 100, laat: 3, uren: 16 }
    ]
  },
  fotografie: {
    naam: 'Productfotografie voor webwinkels', software: 'Fotobewerking', softwareKosten: 2400,
    klanten: [
      { id: 'keramiek', naam: 'Atelier Klei', behoefte: 'foto’s van veertig kommen en schalen', budget: 90000, stijl: 80, laat: 12, uren: 20 },
      { id: 'fietsen', naam: 'Fietsenmaker Snel', behoefte: 'foto’s van de nieuwe e-bikes', budget: 150000, stijl: 90, laat: 0, uren: 28 },
      { id: 'thee', naam: 'Theehuis Oost', behoefte: 'sfeerfoto’s voor de webwinkel', budget: 60000, stijl: 100, laat: 3, uren: 12 }
    ]
  },
  administratie: {
    naam: 'Administratie voor zzp’ers', software: 'Boekhoudpakket', softwareKosten: 1500,
    klanten: [
      { id: 'schilder', naam: 'Schildersbedrijf Kok', behoefte: 'de kwartaaladministratie op orde', budget: 80000, stijl: 80, laat: 12, uren: 18 },
      { id: 'kapper', naam: 'Kapsalon Knip', behoefte: 'een jaar aan bonnetjes verwerkt', budget: 140000, stijl: 90, laat: 0, uren: 30 },
      { id: 'coach', naam: 'Loopbaancoach Anna', behoefte: 'een factuursjabloon en een urenregistratie', budget: 50000, stijl: 100, laat: 3, uren: 10 }
    ]
  }
};

/* RTG-FUNCTIES VERSCHIJNEN PAS ALS ZE RELEVANT WORDEN. Dit is de lijst, met
   het moment waarop ze relevant worden; ./acties.js en ./dag.js zetten ze aan,
   met de reden erbij. Het zijn spelmechanieken: in Magnaat roept niets een
   echte RTG-functie aan (de grens uit server/kern/magnaatwereld.js). */
const RTG = {
  geld: { naam: 'RTG Geld', waarom: 'je hebt een rekening en een loon' },
  berichten: { naam: 'Berichten', waarom: 'je eerste mogelijke klant wil iets van je horen' },
  offertes: { naam: 'Offertes', waarom: 'een klant vraagt wat het kost' },
  zakelijk: { naam: 'RTG Zakelijk', waarom: 'je hebt een onderneming ingeschreven' },
  facturen: { naam: 'Facturen', waarom: 'je werk is af en je wilt betaald worden' },
  budget: { naam: 'Budget en vaste lasten', waarom: 'je staat rood' }
};

module.exports = { REGELVERSIE, DAG_MS, MAX_DAGEN_PER_KEER, START_DAG, START_KAS, MAAND, BAAN, KOSTEN,
  UREN, isWeekend, BETAALTERMIJN, HERINNERING_BETAALT_NA, LENING, AANBOD, RTG };
