/* Magnaat Economische Motor -- de vaste gegevens en de rekenhulpen.

   Alles hier is economie van de motor zelf en geldt voor elke wereld die hem
   gebruikt. Wat per wereld verschilt (welke bedrijven, met welk kapitaal en
   welke kredietruimte) staat NIET hier maar in het profiel dat de consument
   meegeeft -- zie ./index.js. */
'use strict';

/* Drie versies, en ze betekenen elk iets anders:
     STAAT_VERSIE  de vorm van de projectie in de wereld (wereld.economie).
                   Een andere waarde betekende vroeger: gooi alles weg en begin
                   opnieuw. Met een journaal dat blijft bestaan mag dat niet meer
                   stil; zie ./staat.js.
     MOTOR_VERSIE  de code die boekt; draagt elke gebeurtenis.
     REGEL_VERSIE  de economische regels (vraag, kosten, belasting ...); draagt
                   elke gebeurtenis. Ronde A1 veranderde geen enkele regel, dus
                   dit is nog de eerste. */
const STAAT_VERSIE = 1;
const MOTOR_VERSIE = '2';
const REGEL_VERSIE = '1';

const STARTDATUM = '2027-01-01';
const MAX_HISTORIE = 180;
/* Het venster voor het scherm. Het journaal zelf kent GEEN grens: dit is een
   projectie van de nieuwste gebeurtenissen, geen bewaartermijn (M-018). */
const MAX_RECENT = 100;

const SCHOKKEN = [
  { id: 'geen', naam: 'Normale marktdag', uitleg: 'Geen buitengewone verstoring.', vraag: 1, aanbod: 1, arbeid: 1 },
  { id: 'vraagpiek', naam: 'Internationale vraagpiek', uitleg: 'De vraag groeit sneller dan de beschikbare servicecapaciteit.', vraag: 1.28, aanbod: 1, arbeid: .94 },
  { id: 'leveranciersuitval', naam: 'Leveranciersuitval', uitleg: 'Een ketenpartner kan tijdelijk maar een deel van de bestellingen leveren.', vraag: 1.02, aanbod: .52, arbeid: 1 },
  { id: 'arbeidstekort', naam: 'Krappe arbeidsmarkt', uitleg: 'Vacatures zijn moeilijker te vullen en lonen staan onder opwaartse druk.', vraag: 1.04, aanbod: .94, arbeid: .43 }
];

/* De macro-actoren die in elke wereld bestaan. Het zijn economische rollen
   (wie consumeert, wie levert, wie leent uit, wie heft, wie ontvangt opleiding
   en bijdragen) en geen bedrijven; hun beginkas komt uit het profiel.

   DE NAAM IS GEMETEN EN NIET GEKOZEN. Deze lijst heette eerst SECTOREN, en die
   naam is in Magnaat World al bezet door iets anders: de bedrijfssectoren
   (restaurant, hotel, winkel) in ../spellen/magnaat/sectoren.js. Precies bij
   ronde A2, als World op deze motor gaat draaien, hadden die twee elkaar
   ontmoet. SEMANTIEK.json sloeg erop uit, net als op drie andere namen uit deze
   ronde (PROFIEL, GEBEURTENIS, ACTIVITEITEN); die zijn om dezelfde reden uniek. */
const MACROACTOREN = ['huishoudens', 'leverancier', 'bank', 'overheid', 'rtf'];

/* Wat een actor kan VERRICHTEN (zie `verricht` in ./besluiten.js). De motor
   kent de soort werk en de kwaliteit; welke opdracht of missie daarachter zat,
   kent alleen de consument. */
const WERKACTIVITEITEN = ['productiviteit', 'service', 'controle', 'impact', 'innovatie'];

/* Wat een gebeurtenis in het journaal economisch IS. De postings eronder
   zeggen wat hij boekhoudkundig deed; dit zegt wat er gebeurde. */
const ECONOMISCHE_GEBEURTENISSEN = {
  OPENING: 'OPENING', VOORRAAD_OPENING: 'VOORRAAD_OPENING', VOORRAAD_MIGRATIE: 'VOORRAAD_MIGRATIE',
  LENING: 'LENING', VERKOOP: 'VERKOOP', VOORRAAD_INKOOP: 'VOORRAAD_INKOOP', KOSTPRIJS: 'KOSTPRIJS',
  LOON: 'LOON', OPLEIDING: 'OPLEIDING', IMPACT: 'IMPACT', RENTE: 'RENTE', BELASTING: 'BELASTING',
  UITKERING: 'UITKERING', ONBEKEND: 'ONBEKEND'
};

const rond = n => Math.round(Number(n) || 0);
const begrens = (n, min, max) => Math.min(max, Math.max(min, Number(n) || 0));
const geld = n => rond(n);
const som = waarden => waarden.reduce((t, n) => t + rond(n), 0);

function datumOpDag(dag) {
  const datum = new Date(STARTDATUM + 'T12:00:00.000Z');
  datum.setUTCDate(datum.getUTCDate() + dag);
  return datum.toISOString().slice(0, 10);
}

function kopieBedrijf(id, bron) {
  return Object.assign({
    id, schuld: 0, omzetVandaag: 0, kostenVandaag: 0, winstVandaag: 0,
    verkopenVandaag: 0, capaciteitVandaag: 0, vraagVandaag: 0,
    productiviteit: bron.basisProductiviteit, benutting: 0, levergraad: 100
  }, bron);
}

module.exports = {
  STAAT_VERSIE, MOTOR_VERSIE, REGEL_VERSIE, STARTDATUM, MAX_HISTORIE, MAX_RECENT,
  SCHOKKEN, MACROACTOREN, WERKACTIVITEITEN, ECONOMISCHE_GEBEURTENISSEN,
  rond, begrens, geld, som, datumOpDag, kopieBedrijf
};
