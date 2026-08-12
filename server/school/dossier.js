/* School (deelmodule): het leerlingdossier -- basis, contact- en
   gezinsgegevens, documenten (diploma's, certificaten) en het zorgdeel.

   Het dossier is met opzet GELAAGD en niet een pagina met alles erop:

   - de BASIS (naam, plaatsing, opleiding, overstappen) hoort bij het recht
     'leerling': elke leraar van de school mag weten wie er in het gebouw zit;
   - CONTACT- en gezinsgegevens ook, want zonder telefoonnummer bel je bij een
     ongeluk niemand;
   - het ZORGDEEL (ondersteuningsbehoefte, individuele leerdoelen, remedial
     teaching, notities) staat achter het recht 'zorg', vraagt bij elke blik
     een REDEN, en schrijft een regel in het journaal. Een externe begeleider
     ziet alleen wat expliciet met hem gedeeld is;
   - een SYSTEEMBEHEERDER komt hier niet binnen. Beheer van de omgeving is iets
     anders dan inzage in een kind.

   De reden bij een zorgblik is geen formaliteit maar de enige manier om
   achteraf een vraag te beantwoorden die ouders echt stellen: waarom heeft
   iemand in het dossier van mijn kind gekeken? */
module.exports = (sctx) => {
  const { router, save, rid, nu, schoon, eigenVeld, poort, log, leerlingLijst, leerlingKort } = sctx;

  const vind = (sch, id) => eigenVeld(leerlingLijst(sch), id);
  const zorgVan = (l) => { if (!l.zorg) l.zorg = { behoefte: null, plan: null, doelen: [], sessies: [], notities: [], gedeeldMet: [] }; return l.zorg; };

  /* ---------- het dossier lezen ---------- */
  router.post('/school/dossier', (req, res) => {
    const g = poort(req, res, 'leerling'); if (!g) return;
    const l = vind(g.sch, req.body.leerlingId);
    if (!l) return res.status(404).json({ error: 'Deze leerling staat niet in de administratie.' });
    const uit = { ok: true, leerling: leerlingKort(l), geboren: l.geboren || null, herkomst: l.herkomst || null,
      contact: l.contact || {}, documenten: (l.documenten || []).map(d => ({ id: d.id, soort: d.soort, titel: d.titel, at: d.at, door: d.door })),
      overstappen: l.overstappen || [], zorg: null, zorgToegang: null };

    /* Het zorgdeel: alleen met recht, alleen als er expliciet om gevraagd wordt
       (`zorg: true` -- dat is de tab die je opent, niet iets wat je per ongeluk
       meekrijgt), alleen met reden, en altijd met een journaalregel. */
    const magZorg = !g.directie ? sctx.mag(g.p, 'zorg') : true;
    const magGedeeld = !g.directie && sctx.mag(g.p, 'zorg.gedeeld') && (zorgVan(l).gedeeldMet || []).includes(g.p.id);
    if (!magZorg && !magGedeeld) {
      uit.zorgToegang = 'Het zorgdeel van dit dossier is afgeschermd. Vraag de zorgcoordinator.';
      return res.json(uit);
    }
    if (req.body.zorg !== true) {
      uit.zorgToegang = 'niet opgevraagd -- vraag het zorgdeel apart op (zorg: true) met een reden erbij';
      return res.json(uit);
    }
    const reden = schoon(req.body.reden, 120);
    if (!reden) return res.status(400).json({ error: 'Noteer waarom u het zorgdeel opent. Die reden komt in het journaal en is voor de ouders zichtbaar.', redenNodig: true });
    const z = zorgVan(l);
    uit.zorg = magGedeeld && !magZorg
      ? { gedeeld: true, doelen: z.doelen, sessies: z.sessies } // de externe ziet het plan, niet de notities
      : { behoefte: z.behoefte, plan: z.plan, doelen: z.doelen, sessies: z.sessies, notities: z.notities, gedeeldMet: z.gedeeldMet };
    uit.zorgToegang = 'geopend, met reden vastgelegd';
    log(g.sch, g.p, 'zorgdossier-geopend', l.id, reden);
    res.json(uit);
  });

  /* ---------- contact- en gezinsgegevens ----------
     Verzorgers als lijst, want een kind kan twee huizen hebben en een
     noodnummer dat bij geen van beide hoort. */
  router.post('/school/dossier/contact', (req, res) => {
    const g = poort(req, res, 'leerling.schrijf'); if (!g) return;
    const l = vind(g.sch, req.body.leerlingId);
    if (!l) return res.status(404).json({ error: 'Deze leerling staat niet in de administratie.' });
    const c = req.body.contact || {};
    l.contact = {
      adres: schoon(c.adres, 120) || null, postcode: schoon(c.postcode, 12) || null, plaats: schoon(c.plaats, 60) || null,
      telefoon: schoon(c.telefoon, 24) || null, email: schoon(c.email, 80) || null,
      verzorgers: (Array.isArray(c.verzorgers) ? c.verzorgers : []).slice(0, 6).map(v => ({
        naam: schoon(v && v.naam, 60), relatie: schoon(v && v.relatie, 30) || null,
        telefoon: schoon(v && v.telefoon, 24) || null, email: schoon(v && v.email, 80) || null,
        noodnummer: v && v.noodnummer === true })).filter(v => v.naam)
    };
    log(g.sch, g.p, 'contact-gewijzigd', l.id, 'bijwerken adres- en gezinsgegevens');
    save();
    res.json({ ok: true, contact: l.contact });
  });

  /* ---------- documenten, diploma's en certificaten ----------
     Wat hier staat is een REGISTRATIE (soort, titel, nummer, datum), geen
     bestandsopslag: uploads lopen elders in het huis langs de virusscanner en
     de bewaartermijnen. Een schooldiploma verklaren we hier ook niet -- dat
     doen de officiele instellingen; RTG School legt vast wat er is afgegeven. */
  router.post('/school/document/voeg', (req, res) => {
    const g = poort(req, res, 'document'); if (!g) return;
    const l = vind(g.sch, req.body.leerlingId);
    if (!l) return res.status(404).json({ error: 'Deze leerling staat niet in de administratie.' });
    const SOORTEN = ['diploma', 'certificaat', 'verklaring', 'rapport', 'overig'];
    const soort = String(req.body.soort || 'overig');
    if (!SOORTEN.includes(soort)) return res.status(400).json({ error: 'Kies een soort: ' + SOORTEN.join(', ') + '.' });
    const titel = schoon(req.body.titel, 100);
    if (!titel) return res.status(400).json({ error: 'Geef het document een titel.' });
    const d = { id: rid(4), soort, titel, nummer: schoon(req.body.nummer, 40) || null,
      afgegeven: schoon(req.body.afgegeven, 10) || null, instelling: schoon(req.body.instelling, 80) || null,
      at: nu(), door: g.p.naam };
    l.documenten = (l.documenten || []).concat([d]).slice(-100);
    log(g.sch, g.p, 'document-toegevoegd', l.id, soort + ': ' + titel);
    save();
    res.json({ ok: true, document: d,
      uitleg: 'RTG School registreert wat er is afgegeven; het diploma zelf komt van de officiele instelling.' });
  });

  /* Het zorgdeel bijwerken staat in ./zorg.js: het gevoeligste deel van wat
     een school over een kind bewaart, achter een EIGEN poort ('zorg') en niet
     achter "mag het dossier lezen". zorgVan reist mee, zodat er een plek is
     waar de vorm van een zorgdeel wordt gemaakt. */
  require('./zorg')(sctx, { vind, zorgVan });

  return { zorgVan };
};
