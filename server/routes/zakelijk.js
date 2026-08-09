/* Domein "zakelijk": RTG Zakelijk, het professionele netwerk van de Lifestyle
   en Business Pass (de LinkedIn-laag van het platform).

   Wat het is: een zakelijk profiel (kop, sector, vaardigheden, ervaring, "open
   voor werk"), een gids waarin leden elkaar vinden (met gedeelde connecties en
   een open-voor-werk-filter), professioneel verbinden (dat rijdt mee op de
   bestaande vriendengraaf, dus DM en bellen werken meteen via de Salon), een
   zakelijke feed met likes en reacties, aanbevelingen per vaardigheid, en het
   KANSENBORD: leden plaatsen opdrachten, samenwerkingen en investeringsvragen,
   en de open vacatures van de RTG-partners lopen er automatisch in mee.

   Privacy: het profiel is OPT-IN (zichtbaar pas na bewust aanmaken) en draait
   op de codenaam plus een zelfgekozen professionele naam. Niemand komt in de
   gids zonder er zelf voor te kiezen. */
module.exports = (kern) => {
  const { app, auth, crypto, db, save, schoon, liveCodename, openVacatures, gidsHaal, talen,
    socialVerbind, connectieTussen, statusVan, zijnVrienden, codenaamVan, sseToCustomer } = kern;

  function Z() {
    if (!db.data.zakelijk) db.data.zakelijk = { profielen: {}, posts: [], kansen: [] };
    if (!db.data.zakelijk.profielen) db.data.zakelijk.profielen = {};
    if (!Array.isArray(db.data.zakelijk.posts)) db.data.zakelijk.posts = [];
    if (!Array.isArray(db.data.zakelijk.kansen)) db.data.zakelijk.kansen = [];
    return db.data.zakelijk;
  }
  const nu = () => new Date().toISOString();
  const rid = (n = 4) => crypto.randomBytes(n).toString('hex');

  /* De poort voor de professionele passen: Lifestyle en Business.

     HIER STOND EEN EIGEN LIJST (`const PRO = ['lifestyle', 'business']`) en die
     is weg. Toen kern/wereld/rechten.js erbij kwam, stond dezelfde waarheid op
     twee plekken: dit domein besliste zelf wie er binnenkomt, en de wereldlaag
     besliste hetzelfde nog een keer. Dat is LAT-regel 4, en het werd voorlopig
     gelijkgehouden door een toets die beide kanten tegen elkaar aanhield -- een
     pleister, met naam, in TAKEN.md 5.22 (e).

     Nu leest dit domein de rechtenmodule. De pleister is daarmee weg: er valt
     niets meer uiteen te lopen, want er is nog maar één lijst. De toets in
     test/wereldlaag.test.js blijft staan en verandert van betekenis -- hij
     bewees eerst dat twee lijsten gelijk waren, en bewijst nu dat de ENE lijst
     ook echt de deur van dit domein bedient. */
  const rechten = require('../kern/wereld/rechten');
  function pro(req, res, next) {
    if (!rechten.zakelijkPro(req.session.tier))
      return res.status(403).json({ error: 'RTG Zakelijk is onderdeel van de Lifestyle en Business Pass.' });
    next();
  }
  const mijnProfiel = (req) => Z().profielen[req.session.key] || null;
  const pasVan = (key) => (gidsHaal(key) || {}).tier || null;

  /* Actieve connecties en gedeelde connecties ("via wie ken ik deze persoon"),
     het netwerkgevoel van de gids.

     DEZE SOM STOND HIER, EN STAAT NU IN kern/wereld/netwerk.js. Toen de
     wereldlaag netwerkanalyse kreeg ("wie kan mij introduceren") was dat exact
     dezelfde berekening op dezelfde graaf. Hem daar opnieuw schrijven zou
     dezelfde waarheid op twee plekken zetten (LAT-regel 4) -- en dat is precies
     wat er hierboven met de PRO-lijst gebeurde. Eén implementatie, twee
     gebruikers: de gids hier, de introducties daar. */
  const netwerk = require('../kern/wereld/netwerk')({ db, codenaamVan, profiel: null });
  const { connectiesVan, gedeeldeConnecties } = netwerk;

  // publieke weergave van een profiel (voor de gids en de feed)
  function publiek(p, mij) {
    const aanb = p.aanbevelingen || {};
    const gedeeld = mij && mij !== p.key ? gedeeldeConnecties(mij, p.key) : [];
    return {
      key: p.key, codenaam: p.codenaam, naam: p.naam, kop: p.kop, sector: p.sector,
      plaats: p.plaats, bio: p.bio, openVoorWerk: !!p.openVoorWerk, pas: pasVan(p.key),
      vaardigheden: (p.vaardigheden || []).map(v => ({ naam: v, aanbevolen: (aanb[v] || []).length,
        doorMij: mij ? (aanb[v] || []).includes(mij) : false })),
      ervaring: p.ervaring || [],
      status: mij && mij !== p.key ? statusVan(mij, connectieTussen(mij, p.key)) : null,
      gedeeld: gedeeld.length,
      gedeeldNamen: gedeeld.slice(0, 3).map(codenaamVan)
    };
  }


  /* De netwerk- en prikbordlaag draaien als submodules op een gedeelde
     context, een keer opgebouwd bij het opstarten. */
  const zctx = { app, auth, crypto, db, save, schoon, liveCodename, openVacatures, gidsHaal, talen,
    socialVerbind, connectieTussen, statusVan, zijnVrienden, codenaamVan, sseToCustomer,
    Z, nu, rid, pro, mijnProfiel, pasVan, connectiesVan, gedeeldeConnecties, publiek };
  require('./zakelijk/netwerk')(zctx);
  require('./zakelijk/prikbord')(zctx);
};
