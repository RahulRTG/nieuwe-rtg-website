/* RTMAIL, DE LID-KANT: het postvak in de verenigde Berichten-app.

   Afgesplitst van ./rtmail.js omdat dat bestand over de 10 kB van
   keuringsregel 13 liep. De snede loopt langs de scheiding die er inhoudelijk
   al was: hierboven handelt de ZAAK (supplierAuth, een geverifieerde afzender),
   hier LEEST het lid (auth, en het lid antwoordt niet naar de systeem-afzender).

   Hij krijgt dezelfde kern binnen als ./rtmail.js en haalt eruit wat hij nodig
   heeft. De twee hulpjes van de eerste helft gaan MEE in plaats van opnieuw te
   worden gebouwd -- `wie` draagt het adresmodel en `lidCodenaam` de vertaling
   van een sessie naar een codenaam, en twee kopieen daarvan zouden uiteenlopen
   (LAT.md regel 4).

   DAT LidCodenaam ER OOK BIJ MOET, IS HIER MISGEGAAN EN NIET BEDACHT: de eerste
   versie van deze snede gaf alleen `wie` door, en toen zakten vier toetsen op
   een lid-adres dat undefined bleef. Wie hier een derde hulpje bij nodig heeft,
   ziet dat op dezelfde manier. */
'use strict';
/* De klok komt hier RECHTSTREEKS uit ./lib/klok en niet als parameter mee: het
   is een module en dus per proces een. `klokNu` stond in ./rtmail.js als vrije
   naam in het bereik en werd hieronder gewoon gebruikt -- na de knip was dat een
   ReferenceError op de workflow-actie 'agenda', en die werd door geen enkele
   toets aangeraakt. Dezelfde soort fout als bij werkplek-bureaus-b.js; zie
   TAKEN.md 6.17. */
const { nu: klokNu } = require('../lib/klok');

module.exports = (kern, { wie, lidCodenaam }) => {
  const { app, auth, geenGast, rtmail, agenda, leren, facturatie, accounts } = kern;
  /* ---- de lid-kant: het RTMAIL-postvak in de verenigde Berichten-app ----
     Het adres is de codenaam van het lid; leden lezen alleen (RTMAIL bezorgt,
     het lid antwoordt niet naar de systeem-afzender). */
  /* Het adres van een lid: de codenaam op het domein van zijn lidmaatschap.
     De soort wordt AFGELEID uit de pas en de bewezen rollen -- niemand kiest
     zijn eigen domein, want dan was het adres een bewering in plaats van een
     feit. Het linkerdeel blijft de codenaam: een adres reist, en de echte naam
     hoort in de kluis te blijven (server/accounts.js). */
  const lidSoort = wie.lidSoort;
  const lidAdres = wie.lidAdres;
  const mailPubliek = require('../kern/mail-publiek')({ accounts });
  const publiekLid = req => req.session.account ? mailPubliek.geefLid({
    user: req.session.account,
    naam: accounts.realNameOf(req.session.account),
    tier: req.session.tier
  }) : null;

  app.post('/api/member/rtmail/adres', auth, (req, res) => {
    const adres = lidAdres(req);
    if (!adres) return res.json({ adres: null });
    const soort = lidSoort(req);
    const publiekAdres = publiekLid(req);
    res.json({ ok: true, adres, publiekAdres, publiekActief: !!publiekAdres,
      soort, domein: rtmail.DOMEINEN[soort],
      domeinen: rtmail.DOMEINEN,
      uitleg: publiekAdres
        ? 'Je publieke adres gebruikt je naam en je door RTG vastgestelde pasniveau. Intern blijft je postvak op codenaam beschermd.'
        : 'Je interne adres volgt je lidmaatschap. Publieke mail gaat pas open nadat domein en mailprovider zijn gekeurd.' });
  });

  app.post('/api/member/rtmail/inbox', auth, (req, res) => {
    const codenaam = lidCodenaam(req);
    if (!codenaam) return res.json({ adres: null, ongelezen: 0, berichten: [] });
    res.json({ adres: lidAdres(req), publiekAdres: publiekLid(req), soort: lidSoort(req),
      ongelezen: rtmail.ongelezen(codenaam), berichten: rtmail.postvak(codenaam) });
  });
  /* Receipt Vault: RTMAIL is de documenteninbox, maar de factuurmotor blijft
     de enige waarheid. Er wordt hier dus niets gekopieerd; beide schermen lezen
     en classificeren exact hetzelfde document achter dezelfde ledenpoort. */
  app.post('/api/member/rtmail/documenten', auth, (req, res) => {
    if (geenGast(req, res)) return;
    res.json(facturatie.voorLid(req.session.key));
  });
  app.post('/api/member/rtmail/classificeer', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const r = facturatie.classificeer(String((req.body || {}).id || ''), req.session.key,
      (req.body || {}).classificatie);
    res.status(r.status || 200).json(r);
  });
  app.post('/api/member/rtmail/lees', auth, (req, res) => {
    const codenaam = lidCodenaam(req);
    if (!codenaam) return res.status(404).json({ error: 'Geen postvak voor dit account.' });
    const r = rtmail.lees(codenaam, String((req.body && req.body.id) || ''));
    if (r.error) return res.status(404).json({ error: r.error });
    res.json({ ok: true, bericht: r });
  });

  app.post('/api/member/rtmail/workflow', auth, async (req, res) => {
    const b = req.body || {}, codenaam = lidCodenaam(req);
    if (!codenaam) return res.status(404).json({ error: 'Geen RTMAIL-postvak.' });
    const bericht = rtmail.postvak(codenaam, { limit: 200 }).find(m => m.id === String(b.id || ''));
    if (!bericht) return res.status(404).json({ error: 'Bericht niet gevonden.' });
    if (b.actie === 'agenda') {
      const datum = /^\d{4}-\d{2}-\d{2}$/.test(String(b.datum || '')) ? b.datum : new Date(klokNu() + 86400000).toISOString().slice(0, 10);
      const r = await agenda.voegToe('lid:' + req.session.key, { titel: b.titel || bericht.onderwerp, datum, tijd: b.tijd, notitie: 'Vanuit RTMAIL · ' + bericht.id });
      if (r.error) return res.status(400).json(r);
      return res.json({ ok: true, resultaat: r.item, bericht: rtmail.workflow(codenaam, bericht.id, { soort: 'agenda', label: 'In agenda gezet', ref: r.item.id }) });
    }
    if (b.actie === 'project') {
      if (!leren || req.session.tier === 'guest') return res.status(403).json({ error: 'Projecten zijn beschikbaar voor leden.' });
      const r = leren.projectMaak(req.session.key, { titel: b.titel || bericht.onderwerp, wat: b.wat || bericht.tekst.slice(0, 300) });
      if (r.error) return res.status(r.status || 400).json(r);
      const project = r.project || r;
      return res.json({ ok: true, resultaat: project, bericht: rtmail.workflow(codenaam, bericht.id, { soort: 'project', label: 'Samenwerkingsproject gestart', ref: project.id }) });
    }
    res.status(400).json({ error: 'Onbekende workflowactie.' });
  });

};
