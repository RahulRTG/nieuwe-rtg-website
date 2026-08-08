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
  const { app, auth, levensgraaf } = kern;

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
};
