/* Horeca OS (deellaag): de gastenlijst en de deur van een club. Hoort bij
   horeca/club.js (polsbanden en minimum spend), waar dit uit is geknipt toen de
   gastenlijst een tweede schrijver kreeg en het bestand over de 10 kB ging.

   Twee dingen die deze twee routes bij elkaar houden, en die zonder elkaar niet
   kloppen:

   1. OP DE LIJST STAAN IS IETS ANDERS DAN JEZELF AANMELDEN. De club zet namen
      op de lijst; een lid kan er sinds de avondplanner een plek AANVRAGEN. Dat
      onderscheid staat als stand op de regel (kern/horeca/clublaag.js) en is
      hier zichtbaar: aanvragen tellen niet mee in de promotercijfers, en de
      deur laat ze niet binnen.
   2. DE TELLER IS EEN TELLER, GEEN CAMERA. Hij telt in en uit, inclusief
      herbetreding, en zegt hoeveel er nog bij kan. Er wordt niet bijgehouden
      wie er binnen is, alleen hoeveel. */
module.exports = (kern) => {
  const { app, save, schoon, supplierAuth, logActivity, horeca, clublaag } = kern;
  const { nu } = horeca;
  const { C, standVan, magNaarBinnen } = clublaag;
  const vandaag = () => nu().slice(0, 10);

  /* ---------- gastenlijst en promotercodes ---------- */
  app.post('/api/supplier/horeca/club/gastenlijst', supplierAuth, (req, res) => {
    if (Array.isArray(req.body.namen)) clublaag.zetDoorZaak(req.supplier.code, req.body);
    const datum = schoon(req.body.datum, 10) || vandaag();
    const lijst = clublaag.vanDatum(req.supplier.code, datum);
    const perPromoter = {};
    for (const g of lijst) {
      if (standVan(g) === 'aangevraagd') continue;   // een aanvraag is nog geen aanmelding
      const p = g.promoter || 'zonder promoter';
      perPromoter[p] = perPromoter[p] || { aangemeld: 0, binnen: 0 };
      perPromoter[p].aangemeld += g.personen;
      if (g.binnen) perPromoter[p].binnen += g.personen;
    }
    const open = lijst.filter(g => standVan(g) === 'aangevraagd');
    res.json({ ok: true, datum, aantal: lijst.length, gasten: lijst.slice(0, 500), perPromoter,
      teBeslissen: open.length, aanvragen: open.slice(0, 200),
      let: 'Per promoter telt wat er is aangemeld EN wat er echt binnen is; alleen dat eerste zegt niets. '
        + 'Aanvragen van leden tellen pas mee nadat je ze hebt goedgekeurd.' });
  });

  /* De club beslist over een aanvraag van een lid. Zonder deze knop blijft een
     aanvraag eeuwig hangen, en dat is precies het soort halve belofte dat
     iemand om half twee voor een dichte deur zet. */
  app.post('/api/supplier/horeca/club/gastenlijst/beslis', supplierAuth, (req, res) => {
    const r = clublaag.beslis(req.supplier.code, (req.body || {}).regel, schoon(req.body.stand, 20));
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    logActivity(req.supplier.code, req.actor, 'zette een aanvraag op de gastenlijst op ' + r.regel.stand);
    res.json(r);
  });

  /* ---------- de deur: in, uit en terug ---------- */
  app.post('/api/supplier/horeca/club/deur', supplierAuth, (req, res) => {
    const c = C(req.supplier.code);
    const datum = vandaag();
    const d = c.deur[datum] = c.deur[datum] || { binnen: 0, in: 0, uit: 0, herbetreding: 0, geweigerd: 0 };
    const capaciteit = Math.max(1, Math.min(20000, parseInt(req.body.capaciteit, 10) || c.capaciteit || 300));
    c.capaciteit = capaciteit;
    const wat = String(req.body.wat || 'stand');
    const personen = Math.max(1, Math.min(50, parseInt(req.body.personen, 10) || 1));

    if (wat === 'in' || wat === 'terug') {
      /* ALLE WEIGERINGEN STAAN VOOR DE TELLER. Dat is geen stijl: een controle
         die pas na `d.binnen += personen` komt, laat de teller opgehoogd achter
         bij een nee. Hij wordt op die tak niet bewaard, maar hij staat wel in
         db.data, dus de eerstvolgende save() van een heel ander verzoek legt
         hem alsnog vast. Dan staan er mensen binnen die zijn geweigerd. */
      if (d.binnen + personen > capaciteit) {
        d.geweigerd += personen;
        save();
        return res.status(409).json({ error: 'De capaciteit is bereikt (' + d.binnen + ' van ' + capaciteit + ' binnen).',
          vol: true, binnen: d.binnen, capaciteit });
      }
      if (req.body.leeftijdGecontroleerd === false)
        return res.status(409).json({ error: 'Zonder leeftijdscontrole komt er niemand binnen.' });
      /* Afvinken kan alleen op een goedgekeurde regel. Een aanvraag waar de
         club nog niets van heeft gevonden is geen toegang, en de portier hoort
         dat te horen in plaats van een stille no-op te krijgen. */
      const g = req.body.gastId ? c.gastenlijst.find(x => x.id === String(req.body.gastId)) : null;
      if (g && !magNaarBinnen(g)) return res.status(409).json({
        error: 'Deze gast staat op de lijst als "' + standVan(g) + '" en is nog niet goedgekeurd.',
        stand: standVan(g) });

      d.binnen += personen;
      if (wat === 'in') d.in += personen; else d.herbetreding += personen;
      if (g) g.binnen = true;
    } else if (wat === 'uit') {
      d.binnen = Math.max(0, d.binnen - personen);
      d.uit += personen;
    } else if (wat !== 'stand') return res.status(400).json({ error: 'Kies in, uit, terug of stand.' });
    save();
    const lijst = clublaag.vanDatum(req.supplier.code, datum);
    res.json({ ok: true, binnen: d.binnen, capaciteit, vrij: Math.max(0, capaciteit - d.binnen),
      in: d.in, uit: d.uit, herbetreding: d.herbetreding, geweigerd: d.geweigerd,
      verwacht: lijst.filter(g => !g.binnen && magNaarBinnen(g)).reduce((t, g) => t + g.personen, 0),
      let: 'De teller telt hoeveel mensen er binnen zijn, niet wie.' });
  });
};
