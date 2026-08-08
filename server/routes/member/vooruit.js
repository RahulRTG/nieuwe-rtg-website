/* Member-submodule: "Vooruit" -- uw termijnen, voor ELKE pas.

   Dit is dezelfde Control Tower die het Privekantoor gebruikt, maar zonder pas-
   poort ervoor. Dat is met opzet en het is de kern van deze route: een gratis lid
   heeft ook een paspoort dat verloopt en een bestelling die komt, en dat is
   precies zo'n datum die je vergeet en op de verkeerde dag tegenkomt.

   WAT HET VERSCHIL DAN NOG IS. De motor is voor iedereen; wat je met een datum
   KUNT is dat niet. Een Lifestyle-lid krijgt hier meer regels omdat hij meer
   dossiers heeft (Maison, Hangar, Cellier), en hij heeft daarnaast het hele
   kantoor eromheen: mandaat, zaken, orkestratie, de twintig kamers. Wie hier
   binnenkomt zonder die pas ziet zijn eigen datums en verder niets -- geen
   uitgeklede versie met sloten erop, maar precies wat er voor hem is.

   ER STAAT GEEN TIER-CONTROLE IN DE MOTOR, en dat hoeft ook niet: de bronnen die
   het lifestyle-dossier lezen geven vanzelf niets terug voor wie dat dossier niet
   heeft. De poort zit dus op de ROUTES die er meer mee doen
   (routes/member/bureau.js), niet op het lezen van je eigen datums.

   Een gast (de gratis app zonder pas) mag hier ook binnen. Hij kan bestellen en
   hij kan een paspoort hebben gescand; dat zijn zijn datums, en er is geen reden
   om ze voor hem te verbergen. Wat hij niet heeft, ziet hij niet -- en het scherm
   zegt dat dan met zoveel woorden in plaats van leeg te blijven.

   Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, db, geenGast, levensgraaf, postdatum, rtmail, codenaamVan } = kern;
  const wie = require('../../kern/rtmail-wie')({ db, rtmail, codenaamVan });
  const { agendaLidSleutel } = require('../../kern/agenda');

  /* Een lid vraagt zijn EIGEN termijnen op, dus de kring is 'lid'. Dat staat er
     expliciet en niet als weggelaten argument: een standaardwaarde die toevallig
     goed uitpakt is geen besluit (zie routes/member/bureau.js). */
  app.post('/api/member/vooruit', auth, (req, res) => {
    try {
      const key = req.session.key;
      const g = levensgraaf.graaf(key);
      const t = levensgraaf.tower(key, g);
      const sam = levensgraaf.samenvatting(key, g);
      res.json({
        status: 200,
        achterstallig: t.achterstallig,
        vensters: t.vensters,
        later: t.later,
        totaal: t.totaal,
        /* Waar het vandaan komt, zodat het scherm kan laten zien dat NIEMAND dit
           heeft ingetypt. Dat is het hele punt van deze laag. */
        bronnen: [...new Set(g.knopen.filter(k => k.vervalt).map(k => k.bron))].sort(),
        knopen: sam.knopen,
        afgekapt: sam.afgekapt || [],
        // een bron die omviel hoort zichtbaar te zijn, ook hier
        stuk: sam.stuk || []
      });
    } catch (e) {
      res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' });
    }
  });

  /* ---------- Uit uw post: datums die zichzelf aandienen ----------

     De tower vult zich vanzelf met wat u HIER doet. De meeste datums in een
     mensenleven komen per post binnen, en die staan daarna nergens meer. Deze
     drie routes lezen uw eigen postvak en zetten wat ze vinden klaar als
     VOORSTEL -- met de zin erbij, en pas na uw knop in de agenda.

     Waarom niet automatisch: zie de kop van kern/postdatum.js. Een gast heeft
     geen postvak, dus die komt hier niet langs. */
  const adresVan = (req) => wie.lidAdres(req);
  const mijnAgenda = (req) => agendaLidSleutel(req.session.key);

  app.post('/api/member/vooruit/post', auth, (req, res) => {
    if (geenGast(req, res)) return;
    res.json(Object.assign({ status: 200 }, postdatum.voorstellen(adresVan(req), mijnAgenda(req))));
  });
  app.post('/api/member/vooruit/post/neem', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const r = postdatum.neem(adresVan(req), mijnAgenda(req), req.body || {});
    if (r.error) return res.status(400).json(r);
    res.json(r);
  });
  app.post('/api/member/vooruit/post/negeer', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const r = postdatum.negeer(mijnAgenda(req), (req.body || {}).id);
    if (r.error) return res.status(400).json(r);
    res.json(r);
  });
};
