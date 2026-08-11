/* RTG Werk OS (deellaag): de bouwlaag -- repositories, issues, releases en
   feature flags.

   Wat dit BEWUST niet is: een eigen Git. Repositories staan hier als
   REGISTRATIE (waar staat hij, wie is de eigenaar, welke omgeving draait
   erop), en het echte werk blijft in het protocol dat er al is. Een eigen
   versiebeheer bouwen omdat je toch bezig bent, is hoe een werkplek een
   jarenproject wordt.

   Vier weigeringen dragen deze module:

   1. NAAR PRODUCTIE MET EEN MENS ERBIJ. Een release naar productie vraagt het
      resultaat van de toetsen EN een goedkeurder met een naam. Geen groene
      toetsen of geen naam is geen release. Dat is dezelfde merkregel als
      elders in dit huis: de AI en de automaat beslissen niets zelf.
   2. EEN FEATURE FLAG KRIJGT EEN OPRUIMDATUM. Vlaggen die eeuwig blijven staan
      zijn de stilste technische schuld die er is: na een jaar durft niemand ze
      nog uit te zetten omdat niemand meer weet wat eronder zit.
   3. EEN BUG UIT EEN KLANTMELDING DRAAGT DIE MELDING MEE. Anders repareert de
      ontwikkelaar iets waarvan de servicedesk nooit hoort dat het klaar is.
   4. EEN TERUGGEDRAAIDE RELEASE BLIJFT STAAN. Wat een uur in productie heeft
      gestaan, is gebeurd; hem uit de lijst halen maakt de volgende evaluatie
      onmogelijk. */
'use strict';

/* Elke toestandswijziging loopt via DE ENE DEUR van de gebeurtenislaag
   (./gebeurtenis.js): het veld wordt gezet EN de gebeurtenis vastgelegd, met
   actor, bron en waar nodig een reden. Buitenom schrijven merkt het vangnet
   alsnog op, maar dan zonder tijdstip -- en op deze vier families geldt dat als
   een defect. Zie de kop van ./gebeurtenis-lezen.js. */
const { werkVeld } = require('./gebeurtenis');

const OMGEVINGEN = ['ontwikkel', 'test', 'acceptatie', 'productie'];
const SOORTEN = ['bug', 'wens', 'schuld', 'beveiliging'];

module.exports = (sctx) => {
  const { app, save, schoon, nu, rid, dag, werkPoort, log, eigenVeld } = sctx;

  const R = (w) => { if (!w.repos) w.repos = {}; return w.repos; };
  const I = (w) => { if (!w.issues) w.issues = {}; return w.issues; };
  const RE = (w) => { if (!w.releases) w.releases = {}; return w.releases; };
  const F = (w) => { if (!w.vlaggen) w.vlaggen = {}; return w.vlaggen; };

  app.post('/api/bedrijf/repo/zet', (req, res) => {
    const g = werkPoort(req, res, 'bouw'); if (!g) return;
    const naam = schoon(req.body.naam, 60);
    if (!naam) return res.status(400).json({ error: 'Hoe heet de repository?' });
    const id = schoon(req.body.repoId, 20) || rid(4);
    const r = eigenVeld(R(g.w), id) || { id, at: nu() };
    r.naam = naam;
    r.url = schoon(req.body.url, 200) || r.url || null;
    r.taal = schoon(req.body.taal, 30) || r.taal || null;
    r.eigenaar = schoon(req.body.eigenaar, 60) || r.eigenaar || g.l.naam;
    r.omgevingen = Array.isArray(req.body.omgevingen)
      ? req.body.omgevingen.map(String).filter(x => OMGEVINGEN.includes(x)) : (r.omgevingen || []);
    R(g.w)[r.id] = r;
    save();
    res.json({ ok: true, repo: r, omgevingen: OMGEVINGEN,
      let: 'Dit is een registratie boven het bestaande versiebeheer, geen eigen Git. Het werk blijft waar het staat.' });
  });

  /* ---------- issues ---------- */
  app.post('/api/bedrijf/issue/maak', (req, res) => {
    const g = werkPoort(req, res, 'bouw'); if (!g) return;
    const titel = schoon(req.body.titel, 120);
    if (!titel) return res.status(400).json({ error: 'Waar gaat dit issue over?' });
    const soort = String(req.body.soort || 'bug');
    if (!SOORTEN.includes(soort)) return res.status(400).json({ error: 'Kies een soort: ' + SOORTEN.join(', ') + '.' });
    const repoId = String(req.body.repoId || '');
    if (repoId && !eigenVeld(R(g.w), repoId)) return res.status(404).json({ error: 'Die repository kennen we niet.' });

    /* Komt dit uit een klantmelding, dan reist die mee -- en het ticket weet
       ervan. Zonder die twee kanten repareert de ontwikkelaar iets waarvan de
       servicedesk nooit hoort dat het klaar is. */
    const ticketId = String(req.body.ticketId || '');
    let ticket = null;
    if (ticketId) {
      ticket = eigenVeld(sctx.TICKETS(g.w), ticketId);
      if (!ticket) return res.status(404).json({ error: 'Dat ticket kennen we niet.' });
    }
    const i = { id: rid(5), titel, soort, repoId: repoId || null, ticketId: ticketId || null,
      omschrijving: schoon(req.body.omschrijving, 4000) || null,
      wie: schoon(req.body.wie, 60) || null, status: 'open',
      taakId: schoon(req.body.taakId, 20) || null, at: nu(), door: g.l.naam };
    I(g.w)[i.id] = i;
    if (ticket) { ticket.issueIds = (ticket.issueIds || []).concat([i.id]); }
    save();
    res.json({ ok: true, issue: i,
      let: ticket ? 'Het ticket van de klant weet nu van dit issue; bij het sluiten kan de servicedesk terugmelden.' : null });
  });

  app.post('/api/bedrijf/issue/stand', (req, res) => {
    const g = werkPoort(req, res, 'bouw'); if (!g) return;
    const i = eigenVeld(I(g.w), String(req.body.issueId || ''));
    if (!i) return res.status(404).json({ error: 'Dat issue kennen we niet.' });
    const status = String(req.body.status || '');
    if (!['open', 'bezig', 'opgelost', 'vervalt'].includes(status))
      return res.status(400).json({ error: 'Kies open, bezig, opgelost of vervalt.' });
    if (status === 'vervalt' && !schoon(req.body.reden, 200))
      return res.status(400).json({ error: 'Waarom vervalt dit issue? Zonder reden verdwijnt een gemeld probleem stilletjes.' });
    werkVeld(g.w, 'issue', i, { status }, { actor: g.l.naam, bron: 'werk/bouw' });
    i.reden = schoon(req.body.reden, 200) || i.reden || null;
    if (status === 'opgelost') { i.opgelostAt = nu(); i.opgelostDoor = g.l.naam; }
    save();
    res.json({ ok: true, issue: i,
      let: i.ticketId && status === 'opgelost' ? 'Meld dit terug op ticket ' + i.ticketId + '; het systeem doet dat niet voor u, want de klant hoort een mens te horen.' : null });
  });

  /* ---------- releases ---------- */
  app.post('/api/bedrijf/release/maak', (req, res) => {
    const g = werkPoort(req, res, 'bouw'); if (!g) return;
    const versie = schoon(req.body.versie, 30);
    if (!versie) return res.status(400).json({ error: 'Welke versie?' });
    const omgeving = String(req.body.omgeving || 'test');
    if (!OMGEVINGEN.includes(omgeving)) return res.status(400).json({ error: 'Kies een omgeving: ' + OMGEVINGEN.join(', ') + '.' });
    const issues = (Array.isArray(req.body.issueIds) ? req.body.issueIds : []).map(String)
      .filter(id => eigenVeld(I(g.w), id));
    const toetsen = req.body.toetsen && typeof req.body.toetsen === 'object' ? {
      gedraaid: Math.max(0, parseInt(req.body.toetsen.gedraaid, 10) || 0),
      gezakt: Math.max(0, parseInt(req.body.toetsen.gezakt, 10) || 0)
    } : null;

    /* Naar productie: groene toetsen EN een mens die tekent. De volgorde van
       deze twee controles is niet willekeurig -- de eerste is te vervalsen
       door niets te draaien, dus die vraagt om een AANTAL en niet om een
       vinkje. */
    if (omgeving === 'productie') {
      if (!toetsen || !toetsen.gedraaid)
        return res.status(400).json({ error: 'Naar productie hoort het resultaat van de toetsen: hoeveel er zijn gedraaid en hoeveel er zakten. Nul gedraaide toetsen is geen groene suite.' });
      if (toetsen.gezakt)
        return res.status(409).json({ error: toetsen.gezakt + ' toets(en) zakten. Naar productie gaat alleen wat groen is.' });
      if (!schoon(req.body.goedgekeurdDoor, 60))
        return res.status(400).json({ error: 'Wie keurt deze release goed? Naar productie gaat niets zonder een mens met een naam.' });
    }
    const r = { id: rid(5), versie, omgeving, issueIds: issues, toetsen,
      goedgekeurdDoor: schoon(req.body.goedgekeurdDoor, 60) || null,
      notitie: schoon(req.body.notitie, 1000) || null,
      teruggedraaid: false, at: nu(), door: g.l.naam };
    RE(g.w)[r.id] = r;
    log(g.w, g.l, 'release', r.id, versie + ' naar ' + omgeving);
    save();
    res.json({ ok: true, release: r });
  });

  app.post('/api/bedrijf/release/terug', (req, res) => {
    const g = werkPoort(req, res, 'bouw'); if (!g) return;
    const r = eigenVeld(RE(g.w), String(req.body.releaseId || ''));
    if (!r) return res.status(404).json({ error: 'Die release kennen we niet.' });
    const reden = schoon(req.body.reden, 300);
    if (!reden) return res.status(400).json({ error: 'Waarom wordt deze release teruggedraaid?' });
    r.teruggedraaid = true; r.terugReden = reden; r.terugAt = nu(); r.terugDoor = g.l.naam;
    log(g.w, g.l, 'release-teruggedraaid', r.id, reden);
    save();
    res.json({ ok: true, release: r,
      let: 'De release blijft in de lijst staan. Wat een uur in productie heeft gestaan is gebeurd; hem wegpoetsen maakt de volgende evaluatie onmogelijk.' });
  });

  app.post('/api/bedrijf/releases', (req, res) => {
    const g = werkPoort(req, res, 'bouw'); if (!g) return;
    const rijen = Object.values(RE(g.w))
      .filter(r => !req.body.omgeving || r.omgeving === String(req.body.omgeving))
      .sort((a, b) => String(b.at).localeCompare(String(a.at)));
    res.json({ ok: true, aantal: rijen.length, releases: rijen.slice(0, 200),
      teruggedraaid: rijen.filter(r => r.teruggedraaid).length, omgevingen: OMGEVINGEN });
  });

  return { OMGEVINGEN, ISSUESOORTEN: SOORTEN, REPOS: R, ISSUES: I, RELEASES: RE, VLAGGEN: F };
};
