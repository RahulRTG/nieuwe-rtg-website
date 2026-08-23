/* Startdata voor de RTG-portaal-backend. Wordt bij de eerste start
   naar server/data/db.json geschreven; verwijder dat bestand om te resetten.

   In elke echte omgeving start het platform schoon: geen voorbeeldzaken,
   geen voorbeeldposts in De Salon en geen fictieve reizen op de boekpagina.
   Echte partners komen binnen via de partneraanvraag (met Business Pass),
   echte leden via hun eigen account. Synthetische inhoud bestaat uitsluitend
   in de geïsoleerde Magnaat-testomgeving.

   De volledige startset is opgesplitst in vier datamodules: ./leden (Salon,
   facturen, reis), ./partners (partnerkanaal + grootboeken), ./leveranciers
   (typen + voorbeeldzaken), ./livinglab (het RTF Living Lab: één lab met zijn
   tekenbevoegden, apparatuur en buurtvragen -- en met opzet geen verzonnen
   onderzoeksresultaten) en ./media (uitgegeven muziek uit het Klankwerk). */

module.exports = function seed() {
  const demo = require('../testomgeving').actief(process.env);
  const vol = maakVolledigeSeed();
  if (demo) return vol;
  return Object.assign(vol, {
    suppliers: [],      // geen fictieve zaken in de ledencatalogus
    posts: [],          // geen voorbeeldposts in De Salon
    partners: [],       // geen demo-partnerkanalen (influencer/bedrijf)
    partnerTrips: [],   // geen fictieve reizen op boeken.html
    invoices: [],
    contacts: [],
    creatorCredit: {},
    creatorLikes: {},
    trip: { dest: '', dates: '', days: 0, items: [] },
    /* Het Living Lab start in productie leeg: een echt lab hoort door de RTF
       zelf te worden neergezet, met echte tekenbevoegden. De demostand krijgt
       de steiger (lab, tekenaars, apparatuur, buurtvragen) maar nooit verzonnen
       onderzoeksresultaten -- zie de kop van ./livinglab.js. */
    livingLab: { labs: [], studies: [], themas: [], apparatuur: [], audit: [], paspoorten: [] },
    /* Ook de geseede muziek is demo-inhoud: in productie begint de zaal leeg
       en vult hij zich met wat leden zelf uitgeven. De Media OS zegt in die
       stand zelf wat er komt en hoe (kern/mediaos/index.js). */
    muziekUitgaven: { lijst: [], reacties: {} }
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
