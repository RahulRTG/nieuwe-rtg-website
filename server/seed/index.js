/* Startdata voor de RTG-portaal-backend. Wordt bij de eerste start
   naar server/data/db.json geschreven; verwijder dat bestand om te resetten.

   In PRODUCTIE (zonder RTG_DEMO) start het platform schoon: geen demozaken,
   geen voorbeeldposts in De Salon en geen fictieve reizen op de boekpagina.
   Echte partners komen binnen via de partneraanvraag (met Business Pass),
   echte leden via hun eigen account. De demo-inhoud blijft volledig
   beschikbaar voor lokaal en demogebruik.

   De volledige startset is opgesplitst in drie datamodules: ./leden (Salon,
   facturen, reis), ./partners (partnerkanaal + grootboeken) en ./leveranciers
   (typen + voorbeeldzaken). */

module.exports = function seed() {
  const demo = process.env.NODE_ENV !== 'production' || process.env.RTG_DEMO === '1';
  const vol = maakVolledigeSeed();
  if (demo) return vol;
  return Object.assign(vol, {
    suppliers: [],      // geen fictieve zaken in de ledencatalogus
    posts: [],          // geen voorbeeldposts in De Salon
    partners: [],       // geen demo-partnerkanalen (influencer/bedrijf)
    partnerTrips: [],   // geen fictieve reizen op boeken.html
    invoices: [],
    contacts: []
  });
};

function maakVolledigeSeed() {
  return Object.assign(
    {},
    require('./leden'),
    require('./partners'),
    require('./leveranciers')
  );
}
