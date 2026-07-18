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
    socialVerbind, connectieTussen, statusVan, zijnVrienden, verbActief, codenaamVan, sseToCustomer } = kern;

  function Z() {
    if (!db.data.zakelijk) db.data.zakelijk = { profielen: {}, posts: [], kansen: [] };
    if (!db.data.zakelijk.profielen) db.data.zakelijk.profielen = {};
    if (!Array.isArray(db.data.zakelijk.posts)) db.data.zakelijk.posts = [];
    if (!Array.isArray(db.data.zakelijk.kansen)) db.data.zakelijk.kansen = [];
    return db.data.zakelijk;
  }
  const nu = () => new Date().toISOString();
  const rid = (n = 4) => crypto.randomBytes(n).toString('hex');

  // voor de professionele passen: Lifestyle en Business (gast en basis-pas niet)
  const PRO = ['lifestyle', 'business'];
  function pro(req, res, next) {
    if (!PRO.includes(req.session.tier))
      return res.status(403).json({ error: 'RTG Zakelijk is onderdeel van de Lifestyle en Business Pass.' });
    next();
  }
  const mijnProfiel = (req) => Z().profielen[req.session.key] || null;
  const pasVan = (key) => (gidsHaal(key) || {}).tier || null;

  // actieve connecties van een lid; daarmee tellen we gedeelde connecties
  // ("via wie ken ik deze persoon"), het netwerkgevoel van de gids
  function connectiesVan(key) {
    return db.data.connections.filter(c => (c.a === key || c.b === key) && verbActief(c))
      .map(c => (c.a === key ? c.b : c.a));
  }
  function gedeeldeConnecties(mij, ander) {
    const set = new Set(connectiesVan(mij));
    return connectiesVan(ander).filter(k => set.has(k));
  }

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
    socialVerbind, connectieTussen, statusVan, zijnVrienden, verbActief, codenaamVan, sseToCustomer,
    Z, nu, rid, PRO, pro, mijnProfiel, pasVan, connectiesVan, gedeeldeConnecties, publiek };
  require('./zakelijk/netwerk')(zctx);
  require('./zakelijk/prikbord')(zctx);
};
