/* Magnaat V2 ONDERNEMING: DE GETALLEN VAN EEN BEDRIJF DAT GROTER WORDT DAN JIJ.

   V1 eindigt bij een onderneming die jou draagt. Daarna is je eigen tijd de
   grens: meer klanten betekent meer uren, en die heb je niet. V2 geeft je vier
   manieren om daaraan te ontsnappen, en elk heeft een prijs die je voelt voordat
   hij iets oplevert (MAGNAAT.md, V2 Onderneming):

     - PERSONEEL: een medewerker in dienst kost elke week loon, ook in een week
       zonder werk; een freelancer kost alleen de uren die hij maakt, maar meer
       per uur. Geen van beiden werkt aan je eigen project: dat blijft van jou.
     - CONTRACTEN: een vaste klant die elke vier weken werk afneemt, is omzet die
       je kunt plannen -- en uren die je elke vier weken moet leveren.
     - HANDEL: iets inkopen bij een leverancier en doorverkopen. Voorraad is geld
       dat op de plank ligt; de leverancier wil eerst vooraf betaald worden.
     - DE PROGNOSE: wat er de komende vier weken binnenkomt en weggaat, zodat je
       een tekort ziet voordat de betaling mislukt.

   Alles hier is een spelregel van Oudwijk en geen advies. Geld in hele
   eurocenten, tijd in hele minuten. */
'use strict';

/* Wie je kunt aannemen. `tempo` is hoeveel van een uur echt werk wordt: een
   junior doet over een opdracht langer dan jij. Een medewerker in dienst krijgt
   loon voor zijn contracturen, of je hem nu inplant of niet, en heeft een
   werkplek nodig. Een freelancer stuurt elke vrijdag een factuur voor de uren
   die hij die week maakte. */
const TEAMKANDIDATEN = [
  { id: 'kim', naam: 'Kim', rol: 'junior', contract: 'dienst', dagen: [0, 2], minuten: 480, uurloon: 1600, tempo: 70 },
  { id: 'daan', naam: 'Daan', rol: 'ervaren', contract: 'dienst', dagen: [0, 1, 3], minuten: 480, uurloon: 2600, tempo: 100 },
  { id: 'ravi', naam: 'Ravi', rol: 'freelancer', contract: 'inhuur', dagen: [1, 3, 4], minuten: 480, uurloon: 4000, tempo: 100 }
];
const TEAM_MAX = 3;
const OPZEGTERMIJN = 14;                  // een medewerker in dienst werkt en krijgt loon tot het einde van zijn termijn
const INHUUR_TERMIJN = 14;                // een freelancer wil binnen twee weken betaald worden
const LOON_STAKING = 7;                   // wie een week geen loon krijgt, gaat weg -- en het loon blijft verschuldigd
const WERKPLEK = { naam: 'Werkplek bij Broedplaats Oudwijk', leverancier: 'Broedplaats Oudwijk', bedrag: 15000, elke: 28 };

/* Wat je naast je werk kunt verkopen, per aanbod. De eerste bestelling betaal je
   vooraf; daarna geeft de leverancier je `termijn` dagen. `advies` is wat klanten
   er gewoonlijk voor betalen. */
const HANDELSWAAR = {
  websites: { naam: 'Kassatablet met je site erop', leverancier: 'Groothandel Techniek Oudwijk', inkoop: 11000, advies: 18900, minimum: 3, levertijd: 3, termijn: 30 },
  foto: { naam: 'Ingelijste print', leverancier: 'Drukkerij Oudwijk', inkoop: 1800, advies: 4500, minimum: 10, levertijd: 2, termijn: 30 },
  administratie: { naam: 'Bonnenscanner, ingericht', leverancier: 'Kantoorvak Oudwijk', inkoop: 6000, advies: 11000, minimum: 5, levertijd: 3, termijn: 30 }
};
/* DE VRAAG: hoeveel stuks er per week verkocht zouden worden, in duizendsten,
   bij de adviesprijs. Elke betaalde klant brengt mensen mee, tot een plafond.
   Een hogere prijs verkoopt kwadratisch minder; verkopen wat je niet hebt, kan
   niet -- dat is een gemiste verkoop, en die telt. */
const HANDELSVRAAG = { perKlant: 2000, basis: 2000, plafond: 12000, prijsMin: 50, prijsMax: 200, bestelMax: 50 };

/* EEN ONDERHOUDSCONTRACT: een tevreden klant van je onderneming wil vast werk,
   elke vier weken, tegen het uurtarief dat hij van je kent. Je tekent of je
   bedankt; wie een termijn te laat levert, krijgt geen verlenging. */
const KLANTCONTRACT = { minuten: 720, periode: 28, termijnen: 3, naDagen: 10, geldig: 7 };

const PROGNOSE_WEKEN = 4;

module.exports = { TEAMKANDIDATEN, TEAM_MAX, OPZEGTERMIJN, INHUUR_TERMIJN, LOON_STAKING, WERKPLEK, HANDELSWAAR, HANDELSVRAAG,
  KLANTCONTRACT, PROGNOSE_WEKEN };
