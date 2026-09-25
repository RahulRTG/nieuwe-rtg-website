/* Magnaat V3 LEVENDE MARKT: DE GETALLEN VAN EEN STAD WAAR JE NIET ALLEEN BENT.

   Tot V2 was Oudwijk een decor: klanten kwamen op vaste momenten, en wie iets
   verkocht, verkocht alleen. V3 zet er een markt omheen (MAGNAAT.md, V3):
     - CONCURRENTEN: drie bedrijven per aanbod, met een prijs, een kwaliteit en
       een betrouwbaarheid. Ze reageren op jou, en ze maken fouten.
     - CONSUMENTEN: drie soorten kopers (op prijs, op kwaliteit, op gemak) die
       per week kiezen tussen jou en de rest. Je verkoop is een MARKTAANDEEL.
     - LOCATIE: waar je bedrijf zit, bepaalt wie je ziet en wat het kost.
     - WEER EN SEIZOEN: een maand duurt hier vier weken, het weer verschilt per
       dag, en beide sturen de vraag.
   Alles is deterministisch: hetzelfde leven met dezelfde keuzes geeft hetzelfde
   weer, dezelfde fouten van concurrenten en dezelfde verkoop. Geld in centen,
   aandelen en factoren in procenten. */
'use strict';

const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const START_MAAND = 2;             // dag 1 valt begin maart
const MAANDDAGEN = 28;             // een maand in Oudwijk duurt vier weken
const SEIZOENEN = { winter: [11, 0, 1], lente: [2, 3, 4], zomer: [5, 6, 7], herfst: [8, 9, 10] };

/* Het weer: kans in procent per seizoen, en wat het doet met de mensen die de
   deur uit gaan en dus iets zien liggen. */
const WEER = {
  soorten: { zon: 115, bewolkt: 100, regen: 75, storm: 45 },
  kans: { winter: { zon: 15, bewolkt: 35, regen: 35, storm: 15 }, lente: { zon: 35, bewolkt: 35, regen: 25, storm: 5 },
    zomer: { zon: 55, bewolkt: 25, regen: 17, storm: 3 }, herfst: { zon: 20, bewolkt: 35, regen: 35, storm: 10 } }
};

/* Hoeveel stuks heel Oudwijk per week koopt (in duizendsten), en hoe dat per
   seizoen schuift: tablets bij het terrasseizoen, prints voor de feestdagen,
   scanners bij de jaarafsluiting. */
const MARKTVRAAG = {
  websites: { perWeek: 15000, seizoen: { winter: 70, lente: 125, zomer: 130, herfst: 85 } },
  foto: { perWeek: 60000, seizoen: { winter: 160, lente: 85, zomer: 75, herfst: 105 } },
  administratie: { perWeek: 20000, seizoen: { winter: 135, lente: 110, zomer: 65, herfst: 90 } }
};

/* Drie soorten kopers, en hoeveel procent van de stad elk is. Wie op de prijs
   let, kijkt vooral naar de prijs; wie op kwaliteit let, naar je naam; en wie
   koopt wat hij tegenkomt, naar waar je zit. */
const KOPERS = {
  prijs: { naam: 'wie op de prijs let', aandeel: 35 },
  kwaliteit: { naam: 'wie op kwaliteit let', aandeel: 40 },
  gemak: { naam: 'wie koopt wat hij tegenkomt', aandeel: 25 }
};
/* Waar je bedrijf zit: wat het per vier weken kost, wat verhuizen kost, en hoe
   zichtbaar je bent. Buiten Thuis is er ruimte voor je team, dus geen losse
   werkplekken meer. */
const WIJKEN = {
  thuis: { naam: 'Thuis', huur: 0, verhuis: 0, zichtbaar: 30 },
  oost: { naam: 'Broedplaats Oost', huur: 25000, verhuis: 5000, zichtbaar: 100 },
  haven: { naam: 'Havenkwartier', huur: 45000, verhuis: 10000, zichtbaar: 150 },
  centrum: { naam: 'Winkelstraat Centrum', huur: 90000, verhuis: 15000, zichtbaar: 220 }
};

/* De concurrenten per aanbod. `prijsPct` en `tarief` zijn procenten van de
   adviesprijs en van het markttarief; `betrouwbaar` is hoe vaak ze op tijd
   leveren -- de rest van de weken gaat er een klant van ze weg. */
const MARKTTARIEF = { websites: 5500, foto: 4500, administratie: 4000 };
const CONCURRENTEN = {
  websites: [
    { id: 'pixel', naam: 'Pixelwerk', wijk: 'centrum', prijsPct: 110, tarief: 115, kwaliteit: 75, betrouwbaar: 80 },
    { id: 'noord', naam: 'WebStudio Noord', wijk: 'oost', prijsPct: 95, tarief: 95, kwaliteit: 60, betrouwbaar: 70 },
    { id: 'snel', naam: 'SnelSite', wijk: 'haven', prijsPct: 80, tarief: 75, kwaliteit: 40, betrouwbaar: 55 }
  ],
  foto: [
    { id: 'licht', naam: 'Studio Licht', wijk: 'centrum', prijsPct: 115, tarief: 120, kwaliteit: 80, betrouwbaar: 85 },
    { id: 'kader', naam: 'Kader & Co', wijk: 'haven', prijsPct: 100, tarief: 100, kwaliteit: 65, betrouwbaar: 75 },
    { id: 'klik', naam: 'Klikfabriek', wijk: 'oost', prijsPct: 75, tarief: 70, kwaliteit: 35, betrouwbaar: 55 }
  ],
  administratie: [
    { id: 'balans', naam: 'Balans Adviseurs', wijk: 'centrum', prijsPct: 115, tarief: 125, kwaliteit: 85, betrouwbaar: 90 },
    { id: 'boek', naam: 'Boekhoudhuis Oost', wijk: 'oost', prijsPct: 100, tarief: 95, kwaliteit: 60, betrouwbaar: 70 },
    { id: 'goedkoop', naam: 'Admin Direct', wijk: 'haven', prijsPct: 80, tarief: 70, kwaliteit: 40, betrouwbaar: 50 }
  ]
};
/* Hoe concurrenten op jou reageren, elke maandag: wie klanten aan jou verliest
   en duurder is, zakt; wie veel duurder is dan jij terwijl jij niets verkoopt,
   gaat omhoog. Nooit onder de bodem. */
const REACTIE = { stap: 5, bodem: 60, plafond: 130, drempel: 25 };

/* Nieuwe klanten uit de markt: van concurrenten die een fout maakten, en uit het
   seizoen -- en die vinden je vaker naarmate je zichtbaarder zit. Hooguit een
   per week, en nooit als er al twee kansen openstaan. */
const MARKTKLANTEN = {
  namen: {
    websites: ['Kapsalon Kort', 'Restaurant Het Anker', 'Makelaar Van Dijk', 'Bloemist Roos', 'Garage De Wit', 'Sportschool Fit', 'Hotel De Haven', 'Boekhandel Letter'],
    foto: ['Keramiek Aarde', 'Juwelier Goud', 'Slagerij Mals', 'Schoenwinkel Stap', 'Kledingzaak Mode', 'Wijnbar Kurk', 'Brillenhuis Zicht', 'Bakkerij Korst'],
    administratie: ['Klusbedrijf Hamer', 'Hondentrimsalon', 'Pedicure Voet', 'Tuinier Groen', 'Rijschool Rij', 'Fotograaf Beeld', 'Therapeut Rust', 'Timmerman Hout']
  },
  uren: [600, 1500], termijn: [9, 18], speling: [3, 6], laat: [0, 9], seizoenKans: 35, maxOpen: 2,
  reputatie: { perPunt: 3, max: 15 }      // procent die een klant meer wil betalen dan de concurrent, per goede klant
};

module.exports = { MAANDEN, START_MAAND, MAANDDAGEN, SEIZOENEN, WEER, MARKTVRAAG, KOPERS, WIJKEN, MARKTTARIEF, CONCURRENTEN,
  REACTIE, MARKTKLANTEN };
