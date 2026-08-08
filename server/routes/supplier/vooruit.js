/* Leverancier-submodule "Vooruit": de Control Tower van een RTG-kantoor.

   Dezelfde motor als aan de ledenkant (kern/levensgraaf), dezelfde vier vensters,
   hetzelfde venster dat nergens bestond: achterstallig. Alleen de eigenaar
   verschilt -- hier is dat de leverancierscode, niet de sessiesleutel van een lid.

   WAAROM DIT ER IS. Een partner heeft precies het probleem dat een lid heeft: er
   komen dingen op hem af met een datum, en ze staan verspreid over zijn eigen
   schermen. Boekingen in het boekingenscherm, afspraken in de agenda. Elk scherm
   waarschuwt netjes over zijn eigen datums en niemand telt ze op. Dat is een
   motor die er al staat, dus hem hier NIET aansluiten zou een keuze zijn geweest.

   NIEMAND TYPT HIER IETS IN. Dat is het punt van deze laag en het geldt aan
   beide kanten: elke regel komt uit iets wat de zaak al deed. Vandaar dat
   `bronnen` meegaat in het antwoord -- het scherm kan daarmee laten zien waar
   een datum vandaan komt in plaats van te vragen of het klopt.

   WIE HET MAG ZIEN. `supplierAuth` en verder niets: dit zijn de datums van de
   zaak zelf, geen personeelsgegevens en geen ledendossier. De klant staat er met
   zijn CODENAAM bij (zie kern/levensgraaf/bronnen-zaak.js), niet met een naam.

   Gemount vanuit routes/supplier.js. */
module.exports = (kern) => {
  const { app, supplierAuth, levensgraaf } = kern;

  app.post('/api/supplier/vooruit', supplierAuth, (req, res) => {
    try {
      const code = req.supplier.code;
      const Z = levensgraaf.zaak;
      const g = Z.graaf(code);
      const t = Z.tower(code, g);
      const sam = Z.samenvatting(code, g);
      res.json({
        status: 200,
        achterstallig: t.achterstallig,
        vensters: t.vensters,
        later: t.later,
        totaal: t.totaal,
        // waar het vandaan komt, zodat het scherm kan tonen dat NIEMAND dit heeft
        // ingetypt -- dezelfde belofte als op /api/member/vooruit
        bronnen: [...new Set(g.knopen.filter(k => k.vervalt).map(k => k.bron))].sort(),
        knopen: sam.knopen,
        afgekapt: sam.afgekapt || [],
        // een bron die omviel hoort zichtbaar te zijn, ook hier (lat, regel 5)
        stuk: sam.stuk || []
      });
    } catch (e) {
      res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' });
    }
  });
};
