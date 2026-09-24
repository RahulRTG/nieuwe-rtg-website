/* Magnaat FROM ZERO: WAT JE MAAKT, EN WIE DAAROM BIJ JE KOMT.

   Een kans komt niet uit een knop maar uit wat je doet. Iemand ziet je werk als
   je genoeg uren aan je eigen project hebt gegeven, een tevreden klant beveelt
   je aan, en een ingeschreven onderneming wordt gevonden. Die drie herkomsten
   staan bij elke klant (`komt`).

   DE ECONOMIE STAAT PER PLAATS EN NIET PER AANBOD: de eerste klant betaalt
   altijd te laat, want dat is de kern van de keten en geen toeval. Wat een
   klant wil betalen (`max`) geldt zolang je niet meer dan `voorschot` procent
   vooraf vraagt en hem niet meer dan `speling` dagen langer laat wachten dan
   `termijn`; zijn eerste tegenbod is `bod`. `korting` is het kleinste
   percentage waarvoor hij meteen betaalt, of null als hij dat nooit doet.
   Bedragen in centen, tijd in minuten. */
'use strict';

const PLAATSEN = [
  { komt: { soort: 'project', minuten: 360 }, uren: 840, termijn: 9, speling: 5, bod: 65000, max: 80000, voorschot: 25, laat: 10, korting: 3 },
  { komt: { soort: 'aanbeveling', na: 1 }, uren: 1200, termijn: 14, speling: 4, bod: 90000, max: 115000, voorschot: 25, laat: 0, korting: null },
  { komt: { soort: 'project', minuten: 1200 }, uren: 720, termijn: 10, speling: 3, bod: 50000, max: 68000, voorschot: 50, laat: 4, korting: 2 },
  { komt: { soort: 'onderneming' }, uren: 1800, termijn: 21, speling: 7, bod: 150000, max: 195000, voorschot: 25, laat: 12, korting: 5 },
  { komt: { soort: 'onderneming' }, uren: 1440, termijn: 16, speling: 4, bod: 135000, max: 175000, voorschot: 30, laat: 0, korting: null },
  { komt: { soort: 'aanbeveling', na: 3 }, uren: 960, termijn: 12, speling: 4, bod: 80000, max: 105000, voorschot: 25, laat: 2, korting: 2 }
];

const AANBOD = {
  websites: {
    naam: 'Websites voor zaken in de buurt', project: 'je eigen portfolio-site', software: 'Webbouwer Pro',
    klanten: [
      ['cafe', 'Café De Brug', 'Mo', 'een website met de menukaart en openingstijden'],
      ['fiets', 'Fietsenmaker Snel', 'Ilse', 'een pagina waar je een reparatie aanmeldt'],
      ['yoga', 'Yogastudio Adem', 'Noor', 'een lesrooster dat ze zelf bijhoudt'],
      ['bouw', 'Bouwbedrijf Kok', 'Gert', 'een nieuwe website met projecten en offerteaanvraag'],
      ['tandarts', 'Tandartspraktijk Oost', 'dr. Amrani', 'online afspraken maken'],
      ['bakker', 'Bakkerij Van Dam', 'Sven', 'een bestelpagina voor taarten']
    ]
  },
  foto: {
    naam: 'Productfoto\'s voor webwinkels', project: 'een eigen fotoserie', software: 'Fotobewerking Pro',
    klanten: [
      ['klei', 'Atelier Klei', 'Fenna', 'foto\'s van veertig kommen en schalen'],
      ['thee', 'Theehuis Oost', 'Jun', 'sfeerfoto\'s voor de webwinkel'],
      ['kaars', 'Kaarsenmakerij Licht', 'Ruth', 'productfoto\'s op witte achtergrond'],
      ['meubel', 'Meubelzaak Eik', 'Bram', 'een complete catalogus'],
      ['mode', 'Boetiek Linde', 'Sara', 'foto\'s van de nieuwe collectie'],
      ['wijn', 'Wijnhandel Rood', 'Paul', 'etiketten en flessen voor de site']
    ]
  },
  administratie: {
    naam: 'Administratie voor zzp\'ers', project: 'je eigen sjablonen en werkwijze', software: 'Boekhouden Pro',
    klanten: [
      ['schilder', 'Schildersbedrijf Kok', 'Anton', 'een kwartaal aan bonnetjes op orde'],
      ['kapper', 'Kapsalon Knip', 'Lisa', 'een jaar administratie verwerkt'],
      ['coach', 'Loopbaancoach Anna', 'Anna', 'een factuursjabloon en urenregistratie'],
      ['loodgieter', 'Loodgietersbedrijf Water', 'Kees', 'de administratie van drie mensen'],
      ['fysio', 'Fysiotherapie Oudwijk', 'Mila', 'maandelijkse verwerking'],
      ['kok', 'Cateraar Smaak', 'Yusuf', 'inkoop en facturen gescheiden']
    ]
  }
};

/* Een klant is de plaats (economie) plus de naam die bij het aanbod hoort. */
function klantenVan(aanbodId) {
  const a = AANBOD[aanbodId];
  return a ? a.klanten.map(([id, naam, contact, behoefte], i) => Object.assign({ id, naam, contact, behoefte, plaats: i }, PLAATSEN[i])) : [];
}

/* EEN VERVOLGOPDRACHT: een betaalde klant komt na drie weken terug met
   onderhoud. Hij onderhandelt niet, want hij kent je prijs -- het uurtarief dat
   je de eerste keer hebt afgesproken. Wie zich toen goedkoop verkocht, merkt
   dat hier opnieuw. */
const VERVOLG = { naDagen: 21, uren: 480, termijn: 10, voorschot: 0 };

module.exports = { AANBOD, PLAATSEN, VERVOLG, klantenVan };
