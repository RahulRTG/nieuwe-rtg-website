/* Startdata voor de RTG-portaal-backend. Wordt bij de eerste start
   naar server/data/db.json geschreven; verwijder dat bestand om te resetten.

   In PRODUCTIE (zonder RTG_DEMO) start het platform schoon: geen demozaken,
   geen voorbeeldposts in De Salon en geen fictieve reizen op de boekpagina.
   Echte partners komen binnen via de partneraanvraag (met Business Pass),
   echte leden via hun eigen account. De demo-inhoud blijft volledig
   beschikbaar voor lokaal en demogebruik.

   De volledige startset is opgesplitst in vier datamodules: ./leden (Salon,
   facturen, reis), ./partners (partnerkanaal + grootboeken), ./leveranciers
   (typen + voorbeeldzaken), ./livinglab (het RTF Living Lab: één lab met zijn
   tekenbevoegden, apparatuur en buurtvragen -- en met opzet geen verzonnen
   onderzoeksresultaten) en ./media (uitgegeven muziek uit het Klankwerk). */

/* ELKE AANROEP GEEFT EEN EIGEN EXEMPLAAR, en dat is een reparatie en geen
   nettigheid.

   `maakVolledigeSeed()` bouwt met `Object.assign({}, require('./leden'), ...)`.
   Dat geeft een nieuw TOPobject, maar elke waarde eronder is de module-export
   zelf -- en die is gecached. Twee aanroepen van `seed()` deelden dus
   negentien collecties, `suppliers` en `posts` en `dms` incluis.

   DAT BREKE DE BELOFTE VAN DE ZANDBAK, en die staat woordelijk in de kop van
   kern/command/zandbak.js: "er schrijft niets terug, ook door de bouw... niet
   omdat er gefilterd wordt maar omdat het object dat hij ziet die collecties
   niet heeft." Hij zag ze wel degelijk: `zaai()` gaf hem dezelfde arrays die
   db.data gebruikt zodra het proces vers uit de zaaiset is opgestart (zie
   db/index.js: `db.data = seed()`). Een zandbak die een zaak aanmaakte, zette
   die daarmee in de productiecollectie. En twee zandbakken deelden ALTIJD hun
   gegevens, snapshot of niet.

   Het kwam boven water bij het bouwen van kern/spelwereld.js (VERHAAL.md stap
   3), door een toets die vroeg of twee werelden werkelijk los van elkaar staan.

   De reparatie hoort HIER en niet bij de aanroepers: een zaaiset die je niet
   twee keer kunt vragen is geen zaaiset, en drie kopieerregels op drie plekken
   lopen uit elkaar. De set is 26 kB en wordt bij een gewone start EEN keer
   opgehaald, dus een echte kopie kost niets. */
module.exports = function seed() {
  const demo = process.env.NODE_ENV !== 'production' || process.env.RTG_DEMO === '1';
  const vol = structuredClone(maakVolledigeSeed());
  if (demo) return vol;
  return Object.assign(vol, {
    suppliers: [],      // geen fictieve zaken in de ledencatalogus
    posts: [],          // geen voorbeeldposts in De Salon
    partners: [],       // geen demo-partnerkanalen (influencer/bedrijf)
    partnerTrips: [],   // geen fictieve reizen op boeken.html
    invoices: [],
    contacts: [],
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
