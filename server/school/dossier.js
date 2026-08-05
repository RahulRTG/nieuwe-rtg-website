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

  /* ---------- het zorgdeel bijwerken ----------
     Ondersteuningsbehoefte, plan, individuele leerdoelen en de remedial-
     teaching-sessies staan hier bij elkaar: een leerdoel zonder wie eraan
     werkt is een voornemen. */
  router.post('/school/zorg/zet', (req, res) => {
    const g = poort(req, res, 'zorg'); if (!g) return;
    const l = vind(g.sch, req.body.leerlingId);
    if (!l) return res.status(404).json({ error: 'Deze leerling staat niet in de administratie.' });
    const z = zorgVan(l);
    if (req.body.behoefte !== undefined) z.behoefte = schoon(req.body.behoefte, 200) || null;
    if (req.body.plan !== undefined) z.plan = schoon(req.body.plan, 600) || null;
    if (req.body.doel) {
      z.doelen.unshift({ id: rid(3), tekst: schoon(req.body.doel, 200), vak: schoon(req.body.vak, 40) || null,
        tot: schoon(req.body.tot, 10) || null, at: nu(), door: g.p.naam, behaald: false });
      z.doelen = z.doelen.slice(0, 50);
    }
    if (req.body.doelBehaald) {
      const d = (z.doelen || []).find(x => x.id === String(req.body.doelBehaald));
      if (!d) return res.status(404).json({ error: 'Dat leerdoel staat niet in dit plan.' });
      d.behaald = true; d.behaaldAt = nu();
    }
    if (req.body.notitie) {
      z.notities.unshift({ id: rid(3), tekst: schoon(req.body.notitie, 600), at: nu(), door: g.p.naam });
      z.notities = z.notities.slice(0, 100);
    }
    log(g.sch, g.p, 'zorgdossier-gewijzigd', l.id, schoon(req.body.reden, 120) || 'bijwerken ondersteuningsplan');
    save();
    res.json({ ok: true, zorg: z });
  });

  /* Een remedial-teaching- of ondersteuningssessie noteren. Kort en feitelijk:
     wat is er gedaan, hoe lang, en of het hielp -- geen beoordeling van het kind. */
  router.post('/school/zorg/sessie', (req, res) => {
    const g = poort(req, res, 'zorg'); if (!g) return;
    const l = vind(g.sch, req.body.leerlingId);
    if (!l) return res.status(404).json({ error: 'Deze leerling staat niet in de administratie.' });
    const wat = schoon(req.body.wat, 200);
    if (!wat) return res.status(400).json({ error: 'Noteer wat er in de sessie is gedaan.' });
    const z = zorgVan(l);
    z.sessies.unshift({ id: rid(3), wat, vak: schoon(req.body.vak, 40) || null,
      minuten: Math.min(240, Math.max(5, Number(req.body.minuten) || 30)),
      begeleider: g.p.naam, at: nu(), vervolg: schoon(req.body.vervolg, 200) || null });
    z.sessies = z.sessies.slice(0, 200);
    log(g.sch, g.p, 'zorgsessie', l.id, 'begeleiding genoteerd');
    save();
    res.json({ ok: true, sessies: z.sessies.slice(0, 10) });
  });

  /* Delen met een externe begeleider: expliciet, per persoon, en terug te
     draaien. Zonder deze stap ziet een externe niets -- ook niet met de rol. */
  router.post('/school/zorg/deel', (req, res) => {
    const g = poort(req, res, 'zorg'); if (!g) return;
    const l = vind(g.sch, req.body.leerlingId);
    if (!l) return res.status(404).json({ error: 'Deze leerling staat niet in de administratie.' });
    const p = eigenVeld(g.sch.personeel || {}, req.body.personeelId);
    if (!p) return res.status(404).json({ error: 'Die begeleider staat niet bij deze school.' });
    const z = zorgVan(l);
    const aan = req.body.aan !== false;
    z.gedeeldMet = aan ? [...new Set((z.gedeeldMet || []).concat([p.id]))] : (z.gedeeldMet || []).filter(x => x !== p.id);
    log(g.sch, g.p, aan ? 'zorg-gedeeld' : 'zorg-delen-gestopt', l.id, 'met ' + p.naam);
    save();
    res.json({ ok: true, gedeeldMet: z.gedeeldMet });
  });

  return { zorgVan };
};
