/* HET PERSOONSEIS-REGISTER, deel data: welke stukken dit huis kent en wat elk
   genre van de MENS vraagt. Pure data; de mechaniek (magWerkenHier,
   magHandeling, persoonVanActor) staat in ./persoonseis.js en de uitleg waarom
   dit register bestaat ook.

   Afgesplitst om dezelfde reden als seed/genres-lijst.js: een productbestand
   hoort niet over de 10 KB (keuringsregel 13), en de knip zit hier echt --
   dit is wat een bestuurder of jurist moet kunnen lezen zonder een regel code
   te begrijpen, en dat hoort niet verstopt tussen de vergelijkingen die het
   toepassen.

   Wijzigt hier iets, dan verandert wie er mag werken en wie er mag handelen.
   Dat is geen implementatiedetail maar een besluit; behandel het zo. */
'use strict';

/* De soorten stukken. De tekst is wat een mens LEEST, dus hij noemt het stuk bij
   de naam die hij zelf kent. `bron` zegt waar het vandaan komt, want dat is het
   verschil tussen iets dat wij al hebben en iets dat nog moet komen. */
const SOORTEN = {
  identiteit: {
    naam: 'een vastgestelde identiteit',
    bron: 'verificatie',
    uitleg: 'Uw identiteit is een keer vastgesteld met een identiteitsbewijs en een selfie.' },
  vog: {
    naam: 'een Verklaring Omtrent het Gedrag',
    bron: 'vakbewijs',
    uitleg: 'Een VOG voor het werken met kinderen, met het nummer en de afgiftedatum.' },
  beveiligingspas: {
    naam: 'een legitimatiebewijs beveiliger',
    bron: 'vakbewijs',
    uitleg: 'Het legitimatiebewijs dat bij de vergunning van uw beveiligingsorganisatie hoort.' },
  dienstlegitimatie: {
    naam: 'een dienstlegitimatie',
    bron: 'vakbewijs',
    uitleg: 'De legitimatie die uw korps of eenheid zelf afgeeft.' },
  big: {
    naam: 'een BIG-registratie',
    bron: 'vakbewijs',
    uitleg: 'Uw eigen BIG-nummer, op uw naam en met de geldigheid erbij.' },
  farmacie: {
    naam: 'een farmaceutische bevoegdheid',
    bron: 'vakbewijs',
    uitleg: 'Uw inschrijving als apotheker of uw diploma apothekersassistent.' },
  cosmetisch: {
    naam: 'een bevoegdheid voor cosmetische behandelingen',
    bron: 'vakbewijs',
    uitleg: 'Het stuk waaruit blijkt dat u de behandelingen mag uitvoeren die u aanbiedt.' }
};

/* DE HANDELINGEN die aan een persoon hangen. Elke id hieronder wordt ergens
   werkelijk afgedwongen; de toets houdt dat vast. */
const HANDELINGEN = {
  voorschrijven: 'een recept uitschrijven',
  verwijzen: 'een patient doorverwijzen naar een specialist',
  uitreiken: 'een recept afhandelen en uitreiken'
};

/* HET REGISTER. Per genre: wat het werk vraagt, en wat een handeling vraagt.
   Een genre dat hier niet staat, vraagt niets extra's van de persoon -- en dat
   is voor 55 van de 73 genres het juiste antwoord. Een restaurant hoort geen
   papieren te vragen aan zijn afwasser. */
const EISEN = {
  // -- Kinderopvang: hier is geen functie zonder kinderen in de buurt --
  kinderopvang: { werk: ['identiteit', 'vog'] },

  // -- Veiligheid: wie een post bewaakt en een SOS-knop draagt, is wie hij zegt --
  beveiliging: { werk: ['identiteit', 'beveiligingspas'] },
  politie: { werk: ['identiteit', 'dienstlegitimatie'] },
  brandweer: { werk: ['identiteit', 'dienstlegitimatie'] },
  ambulance: { werk: ['identiteit', 'dienstlegitimatie'] },
  marechaussee: { werk: ['identiteit', 'dienstlegitimatie'] },
  defensie: { werk: ['identiteit', 'dienstlegitimatie'] },
  specials: { werk: ['identiteit', 'dienstlegitimatie'] },

  /* -- Zorg: het WERK vraagt een vastgestelde identiteit, de HANDELING vraagt
     de registratie. De balie van een praktijk hoort gewoon te werken. -- */
  huisarts: { werk: ['identiteit'], handelingen: { voorschrijven: ['big'], verwijzen: ['big'] } },
  specialist: { werk: ['identiteit'], handelingen: { voorschrijven: ['big'], verwijzen: ['big'] } },
  ziekenhuis: { werk: ['identiteit'], handelingen: { voorschrijven: ['big'], verwijzen: ['big'] } },
  apotheek: { werk: ['identiteit'], handelingen: { uitreiken: ['farmacie'] } },
  beautymedical: { werk: ['identiteit'], handelingen: { verwijzen: ['cosmetisch'] } },

  /* -- Verzekeringsadvies: alleen de identiteit, en dat is met opzet minder dan
     hierboven. Het advieswerk zelf hangt aan een Wft-diploma, maar er is in dit
     huis nog geen handeling "adviseren" die door de software loopt -- en een eis
     opschrijven voor een handeling die nergens bestaat, is een belofte in tekst
     zonder belofte in code (LAT-regel 6). Wat hier WEL kan en telt: wie onder een
     AFM-vergunning met de polissen van leden werkt, is een vastgestelde mens en
     geen gedeelde inlog. Komt de adviesstroom er, dan hoort de Wft-eis HIER. -- */
  verzekeringen: { werk: ['identiteit'] }
};

module.exports = { SOORTEN, HANDELINGEN, EISEN };
