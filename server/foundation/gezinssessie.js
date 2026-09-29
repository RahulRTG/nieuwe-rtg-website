/* De gezinssessie roteren en intrekken (CODECREDENTIALS.json:
   foundation.family_profile_token_buiten_harde_poort). De sessie zelf woont in
   ./gezinstoken.js; hier staan alleen de twee deuren waarmee een mens hem
   beheert.

   - /gezin/sessie/roteer: de HOUDER ruilt zijn eigen sessie in voor een nieuwe.
     De oude valt meteen weg en de nieuwe staat een keer in dit antwoord. Niemand
     roteert de sessie van een ander: dan had de beheerder de sleutel van zijn
     kind in handen.
   - /gezin/sessie/intrek: zonder profielId meldt de houder DEZE sessie af
     (idempotent: nog eens afmelden geeft gesloten 0 en geen fout). Met
     een profielId (of 'alle') sluit de BEHEERDER elke sessie van dat profiel of
     van het hele gezin tegelijk -- de epoch omhoog, ook op apparaten die niemand
     meer ziet. Wie daarna weer binnen wil, logt in met de gezinscode en zijn
     eigen pincode. Intrekken beperkt alleen, en staat daarom in
     middleware/foundation-veilige-uitgangen.js.

   Beide routes beslissen zelf over een herhaling en staan in
   lib/idemsleutels-nooit-gezinstoken.js (roteren ook in
   lib/eenmalig-geheim-routes.js): een tweede roteer met de oude sessie vindt
   hem niet meer (403), en een antwoordcache mag een nieuwe sessie nooit
   herhalen. */
'use strict';

module.exports = (ctx) => {
  const { router, save, gezinVan, beheerderVan, tokenUit, eigenVeld, gezinstoken } = ctx;
  const OPNIEUW = 'Log opnieuw in bij je gezin.';

  router.post('/gezin/sessie/roteer', (req, res) => {
    const g = gezinVan(req, res); if (!g) return;
    const token = gezinstoken.roteer(g, tokenUit(req));
    if (!token) return res.status(403).json({ error: OPNIEUW });
    save();
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, token });
  });

  router.post('/gezin/sessie/intrek', (req, res) => {
    const g = gezinVan(req, res); if (!g) return;
    const doel = req.body && req.body.profielId != null ? String(req.body.profielId) : '';
    if (!doel) {
      /* Afmelden is idempotent: een sessie die al weg is, is afgemeld. Het
         antwoord zegt alleen of DEZE aanroep er een sloot. */
      const gesloten = gezinstoken.intrek(g, tokenUit(req)) ? 1 : 0;
      if (gesloten) save();
      return res.json({ ok: true, gesloten });
    }
    if (!beheerderVan(g, req, res)) return;
    const profielen = doel === 'alle' ? Object.values(g.profielen || {}) : [eigenVeld(g.profielen, doel)].filter(Boolean);
    if (!profielen.length) return res.status(404).json({ error: 'Profiel niet gevonden.' });
    for (const p of profielen) gezinstoken.sluit(p);
    save();
    res.json({ ok: true, gesloten: profielen.length });
  });
};
