/* Horeca OS (deellaag): gastprofiel en punten (CRM light).

   Een gast is hier een naam met voorkeuren, en niets meer: geen
   bezoekfrequentie-score, geen "waarde per gast"-cijfer. Wat de bediening
   moet weten om iemand goed te helpen -- allergie, voorkeurstafel, wat hij
   meestal drinkt -- en wat er is afgesproken.

   Stond in ./personeel.js en is een eigen deellaag geworden toen dat bestand
   tegen de 10 kB-grens aankroop: een gast is geen personeelszaak. */
module.exports = (kern) => {
  const { app, save, schoon, supplierAuth, horeca } = kern;
  const { H, Hlees, nu } = horeca;
  const vandaag = () => nu().slice(0, 10);

  app.post('/api/supplier/horeca/gast', supplierAuth, (req, res) => {
    /* Alle weigeringen VOOR de eerste schrijvende aanraking. De punten-400
       stond halverwege: de gast was dan al aangemaakt en allergie/voorkeur al
       overschreven -- geweigerd en toch veranderd, precies de gezakte
       ROLLBACK-cel van de staatproef. */
    const naam = schoon(req.body.naam, 60);
    if (!naam) return res.status(400).json({ error: 'Om wie gaat het?' });
    const sleutel = naam.toLowerCase();
    const punten = req.body.punten != null ? Math.round(Number(req.body.punten) || 0) : null;
    if (punten !== null) {
      const bestaand = (Hlees(req.supplier.code).gasten || {})[sleutel];
      if ((bestaand ? bestaand.punten : 0) + punten < 0) {
        return res.status(400).json({ error: 'Een gast kan niet minder dan nul punten hebben.' });
      }
    }

    const h = H(req.supplier.code);
    if (!h.gasten) h.gasten = {};
    const g = h.gasten[sleutel] || (h.gasten[sleutel] = { naam, punten: 0, bezoeken: 0, at: nu() });
    if (req.body.allergie !== undefined) g.allergie = schoon(req.body.allergie, 120) || null;
    if (req.body.voorkeur !== undefined) g.voorkeur = schoon(req.body.voorkeur, 160) || null;
    if (req.body.notitie) g.notities = (g.notities || []).concat([{ tekst: schoon(req.body.notitie, 200), at: nu(), door: req.actor.name }]).slice(-20);
    if (req.body.bezoek === true) { g.bezoeken += 1; g.laatsteBezoek = vandaag(); }
    if (punten !== null) {
      g.punten += punten;
      g.puntenLog = (g.puntenLog || []).concat([{ punten, reden: schoon(req.body.reden, 80) || null, at: nu() }]).slice(-50);
    }
    save();
    res.json({ ok: true, gast: g,
      let: 'Een gastprofiel bewaart wat nodig is om iemand goed te helpen. Er staat geen waarde-per-gast-score in; die maakt van gastvrijheid een rangorde.' });
  });

  app.post('/api/supplier/horeca/gasten', supplierAuth, (req, res) => {
    // Lezen zonder scheppen: een kale lijstvraag laat geen lege doos achter.
    const rijen = Object.values(Hlees(req.supplier.code).gasten || {})
      .sort((a, b) => String(a.naam).localeCompare(String(b.naam)));
    res.json({ ok: true, aantal: rijen.length, gasten: rijen.slice(0, 500),
      metAllergie: rijen.filter(g => g.allergie).length });
  });
};
