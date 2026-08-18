/* Startdata voor de RTG-portaal-backend. Wordt bij de eerste start
   naar server/data/db.json geschreven; verwijder dat bestand om te resetten.

   ZONDER RTG_DEMO start het platform schoon: geen demozaken, geen voorbeeld-
   posts in De Salon en geen fictieve reizen op de boekpagina.
   Echte partners komen binnen via de partneraanvraag (met Business Pass),
   echte leden via hun eigen account. De demo-inhoud blijft volledig
   beschikbaar voor lokaal en demogebruik.

   De volledige startset is opgesplitst in vier datamodules: ./leden (Salon,
   facturen, reis), ./partners (partnerkanaal + grootboeken), ./leveranciers
   (typen + voorbeeldzaken), ./livinglab (het RTF Living Lab: één lab met zijn
   tekenbevoegden, apparatuur en buurtvragen -- en met opzet geen verzonnen
   onderzoeksresultaten) en ./media (uitgegeven muziek uit het Klankwerk). */

/* DE DEMO-SEED VOLGT DEZELFDE REGEL ALS DE DEMO-INLOG: UIT, TENZIJ IEMAND HEM
   BEWUST AANZET.

   Hier stond `NODE_ENV !== 'production' || RTG_DEMO === '1'` -- woordelijk de
   regel die voor de demo-INLOG al was afgekeurd (zie server.js bij `const DEMO`).
   Daar was de conclusie: een slot dat opengaat als iemand iets vergeet is geen
   slot. Voor de seed gold precies hetzelfde en het bleef staan: op een echte
   server die geen NODE_ENV had gezet -- het gewone geval -- werd de VOLLEDIGE
   demo ingeladen. Tien verzonnen zaken in de ledencatalogus, zes voorbeeldposts
   in De Salon met naam en al, drie fictieve reizen, twee partnerkanalen, een
   Living Lab en uitgegeven muziek. Wie de site opende zag een vol platform waar
   niets van echt was, en een nieuw lid kon het verschil niet zien.

   Nu: leeg, tenzij RTG_DEMO=1. Dat is dezelfde schakelaar als de demo-inlog, dus
   er is nog maar EEN vraag ("staat de demo aan?") met een antwoord op een plek.
   start.sh zet hem voor de lokale demonstratie; `npm start` en elke server die
   niets weet, beginnen schoon en vullen zich met wat mensen zelf doen. */
module.exports = function seed() {
  const demo = process.env.RTG_DEMO === '1';
  const vol = maakVolledigeSeed();
  if (demo) return vol;
  return Object.assign(vol, {
    suppliers: [],      // geen fictieve zaken in de ledencatalogus
    posts: [],          // geen voorbeeldposts in De Salon
    partners: [],       // geen demo-partnerkanalen (influencer/bedrijf)
    partnerTrips: [],   // geen fictieve reizen op boeken.html
    invoices: [],
    /* En de voorbeeldREIS ook niet. Die bleef hier staan terwijl de facturen al
       weg waren, en werd via db.data.trip alsnog getoond als "de komende reis"
       -- in de system prompt van Rahul en in de partnerlijst per stad. Een
       productie-installatie hoort geen bestemming te kennen die niemand boekte. */
    trip: null,
    contacts: [],
    /* Het Living Lab start in productie leeg: een echt lab hoort door de RTF
       zelf te worden neergezet, met echte tekenbevoegden. De demostand krijgt
       de steiger (lab, tekenaars, apparatuur, buurtvragen) maar nooit verzonnen
       onderzoeksresultaten -- zie de kop van ./livinglab.js. */
    livingLab: { labs: [], studies: [], themas: [], apparatuur: [], audit: [], paspoorten: [] },
    /* Ook de geseede muziek is demo-inhoud: zonder demo begint de zaal leeg
       en vult hij zich met wat leden zelf uitgeven. De Media OS zegt in die
       stand zelf wat er komt en hoe (kern/mediaos/index.js). */
    muziekUitgaven: { lijst: [], reacties: {} },
    /* En de tellers van de creator-laag. Die horen bij de demo-persona's (een
       demo-sessie leest ze rechtstreeks) en hebben op een schoon platform geen
       betekenis: een lid dat nog niets plaatste heeft geen 320 likes. */
    creatorCredit: { rtg: 0, lifestyle: 0, business: 0 },
    creatorLikes: { rtg: 0, lifestyle: 0, business: 0 }
  });
};

function maakVolledigeSeed() {
  return Object.assign(
    {},
    require('./leden'),
    require('./partners'),
    require('./leveranciers'),
    require('./livinglab'),
    require('./media')
  );
}
