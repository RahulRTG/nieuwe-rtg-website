/* RTG Werk OS (deellaag): de brug tussen de POST en het WERK.

   Dit is het punt waarop RTG Mail ophoudt een mailbox te zijn. Een
   offerteaanvraag die binnenkomt is geen bericht maar het begin van een kans;
   een storingsmelding is een ticket. Zolang die omzetting met knippen en
   plakken gebeurt, raakt de helft onderweg kwijt en is er achteraf geen spoor
   van waar iets vandaan kwam.

   DRIE SLOTEN, en ze zitten er alle drie om dezelfde reden -- post is van
   iemand:

   1. TWEE SLEUTELS. De omzetting vraagt zowel de RTG-sessie (de post) als het
      werkruimte-lidtoken (het werk). Wie alleen het tweede heeft, kan geen
      berichten van een ander binnenhalen.
   2. HET MOET DEZELFDE PERSOON ZIJN. Het werkruimtelid moet zijn RTG-account
      hebben gekoppeld (./aansluiting.js) en die koppeling moet naar precies
      deze sessie wijzen. Een beheerder kan dit dus niet namens iemand doen.
   3. HET BERICHT MOET IN ZIJN EIGEN POSTVAK LIGGEN, of in het postvak van een
      team waar hij lid van is. De laag eronder (kern/rtmail-vak.js) bepaalt
      dat, niet deze laag.

   WAT ER MEEGAAT: onderwerp, tekst en de HERKOMST (bericht-id en draad). Wat
   er NIET meegaat: het bericht zelf. De taak of het ticket VERWIJST naar de
   post; hij vervangt hem niet. Dezelfde regel als bij de klantproducten -- een
   verwijzing, nooit een tweede administratie. */
'use strict';

module.exports = (sctx) => {
  const { app, save, nu, werkPoort, eigenVeld, schoon, rid, kern } = sctx;
  const { auth, rtmail, rtmailTeam, rtmailVak } = kern;

  // welk recht hoort bij welke omzetting; onbekende soorten bestaan niet
  const SOORTEN = {
    taak: { recht: 'project', waar: (w) => (w.taken = w.taken || {}) },
    ticket: { recht: 'service', waar: (w) => (w.tickets = w.tickets || {}) },
    kans: { recht: 'klant', waar: (w) => (w.kansen = w.kansen || {}) }
  };

  /* Het bericht ophalen ALS het van deze persoon is. Eerst het eigen postvak,
     dan de teams waar hij in zit -- in die volgorde, want een gedeeld postvak
     is een uitbreiding van je eigen bereik en geen vervanging ervan. */
  function berichtVoor(sessie, id) {
    const alle = ((sctx.db && sctx.db.data && sctx.db.data.rtmail) || {}).berichten || [];
    const m = alle.find(x => x.id === id);
    if (!m) return { error: 'Dat bericht bestaat niet.' };
    const codenaam = (sessie.account && sessie.account.codename) || null;
    if (codenaam && rtmailVak.mijn(m, codenaam)) return { m, via: 'eigen postvak' };
    const lijst = (rtmailTeam ? (rtmailTeam.mijn({ key: sessie.key }) || {}).teams : null) || [];
    for (const t of lijst) {
      if (rtmailVak.mijn(m, t.adres)) return { m, via: 'team ' + t.naam };
    }
    return { error: 'Dit bericht staat niet in uw postvak of in een team waar u in zit.' };
  }

  /* De omzetting zelf. Alles wat de laag maakt draagt `herkomst`, en het
     bericht krijgt de verwijzing terug -- zodat het in de mailapp te zien is
     dat hier al iets van gemaakt is. Twee keer omzetten van hetzelfde bericht
     wordt niet geblokkeerd (soms hoort een mail echt bij twee dingen), maar
     het WORDT geteld en getoond; stil dubbelwerk is de fout die dit hoort te
     voorkomen. */
  app.post('/api/bedrijf/post/omzetten', auth, (req, res) => {
    const soort = String(req.body.soort || '');
    const def = SOORTEN[soort];
    if (!def) return res.status(400).json({ error: 'Kies wat het wordt: ' + Object.keys(SOORTEN).join(', ') + '.' });
    const g = werkPoort(req, res, def.recht); if (!g) return;
    if (!g.l.rtgKey || g.l.rtgKey !== req.session.key) {
      return res.status(403).json({ error: 'Koppel eerst uw RTG-account aan dit werkruimtelid (/api/bedrijf/lid/koppel). Zonder die koppeling kan deze laag niet vaststellen dat de post van u is.' });
    }
    const b = berichtVoor(req.session, String(req.body.berichtId || ''));
    if (b.error) return res.status(404).json({ error: b.error });
    const m = b.m;

    const herkomst = { uit: 'rtmail', berichtId: m.id, draad: m.draad || m.id,
      van: m.van, onderwerp: m.onderwerp, ontvangen: m.at, via: b.via };
    const titel = schoon(req.body.titel, 120) || m.onderwerp || '(geen onderwerp)';
    const tekst = String(m.tekst || '').slice(0, 4000);
    let gemaakt;

    if (soort === 'taak') {
      gemaakt = { id: rid(5), titel, projectId: schoon(req.body.projectId, 20) || null, ouderId: null,
        omschrijving: tekst || null, wie: schoon(req.body.wie, 60) || g.l.naam,
        deadline: schoon(req.body.deadline, 10) || null, prioriteit: 'normaal',
        kolom: 'te doen', wachtOp: [], uren: 0, sprint: null, at: nu(), door: g.l.naam, herkomst };
    } else if (soort === 'ticket') {
      gemaakt = { id: rid(5), onderwerp: titel, prioriteit: schoon(req.body.prioriteit, 20) || 'normaal',
        tekst: tekst || null, klantId: schoon(req.body.klantId, 20) || null,
        melder: m.van, wie: null, status: 'open', storingId: null, reacties: [],
        eersteReactieAt: null, at: nu(), door: g.l.naam, herkomst };
    } else {
      const klant = eigenVeld(g.w.klanten || {}, String(req.body.klantId || ''));
      if (!klant) return res.status(404).json({ error: 'Bij welke klant hoort deze kans? Een kans zonder klant is een notitie.' });
      gemaakt = { id: rid(5), klantId: klant.id, klant: klant.naam, titel,
        product: null, bedragCenten: 0, fase: 'lead',
        eigenaar: schoon(req.body.eigenaar, 60) || g.l.naam,
        verwacht: schoon(req.body.verwacht, 10) || null, historie: [], at: nu(), herkomst };
    }
    def.waar(g.w)[gemaakt.id] = gemaakt;

    // de verwijzing terug op het bericht, zodat de mailapp het kan tonen
    if (!Array.isArray(m.werk)) m.werk = [];
    m.werk.push({ soort, id: gemaakt.id, werkruimte: g.w.id, naam: g.w.naam || null, at: nu() });
    save();
    res.json({ ok: true, soort, gemaakt, eerderGemaakt: m.werk.length - 1,
      let: m.werk.length > 1
        ? 'Let op: van dit bericht is al ' + (m.werk.length - 1) + ' keer eerder iets gemaakt. Dat mag, maar kijk even of u niet dubbel werk doet.'
        : 'De taak verwijst naar het bericht; hij vervangt hem niet. Het bericht blijft waar het staat.' });
  });

  /* Wat er van EEN bericht is gemaakt. Nodig in de mailapp: zonder deze vraag
     zie je in je postvak niet dat een collega er al een ticket van maakte, en
     dan is de omzetting alsnog dubbel werk. */
  app.post('/api/bedrijf/post/herkomst', auth, (req, res) => {
    const g = sctx.lidVan(req, res); if (!g) return;
    const b = berichtVoor(req.session, String(req.body.berichtId || ''));
    if (b.error) return res.status(404).json({ error: b.error });
    const werk = (b.m.werk || []).filter(w => w.werkruimte === g.w.id);
    res.json({ ok: true, berichtId: b.m.id, via: b.via, werk,
      let: werk.length ? null : 'Van dit bericht is in deze werkruimte nog niets gemaakt.' });
  });

  /* De zakelijke context naast een bericht: welke klant is dit, wat loopt er,
     en waar staat de klok. Puur LEZEN uit de bestaande lagen -- deze route
     bewaart niets, want dan was er een tweede klantadministratie.

     Het koppelen gebeurt op het e-mailadres van een contactpersoon. Vindt hij
     niets, dan zegt hij dat ook: een contextpaneel dat bij twijfel iets toont,
     zet een bericht bij de verkeerde klant en dat is erger dan leeg. */
  app.post('/api/bedrijf/post/context', auth, (req, res) => {
    const g = sctx.lidVan(req, res); if (!g) return;
    const b = berichtVoor(req.session, String(req.body.berichtId || ''));
    if (b.error) return res.status(404).json({ error: b.error });
    const van = String(b.m.van || '').toLowerCase();
    const lokaal = van.split('@')[0];
    const klanten = Object.values(g.w.klanten || {});
    const klant = klanten.find(k => (k.contacten || []).some(c =>
      c.email && (String(c.email).toLowerCase() === van || String(c.email).toLowerCase().split('@')[0] === lokaal)));
    if (!klant) {
      return res.json({ ok: true, berichtId: b.m.id, klant: null,
        let: 'Deze afzender staat bij geen enkele klant in deze werkruimte als contactpersoon. Er wordt niets geraden.' });
    }
    const kansen = Object.values(g.w.kansen || {}).filter(k => k.klantId === klant.id && k.fase !== 'verloren' && k.fase !== 'gewonnen');
    const tickets = Object.values(g.w.tickets || {}).filter(t => t.klantId === klant.id && t.status !== 'gesloten');
    const contracten = Object.values(g.w.contracten || {}).filter(c => c.klantId === klant.id);
    res.json({ ok: true, berichtId: b.m.id,
      klant: { id: klant.id, naam: klant.naam, eigenaar: klant.eigenaar || null, producten: klant.producten || [] },
      openKansen: kansen.map(k => ({ id: k.id, titel: k.titel, fase: k.fase, bedragCenten: k.bedragCenten })),
      openTickets: tickets.map(t => ({ id: t.id, onderwerp: t.onderwerp, prioriteit: t.prioriteit, status: t.status })),
      contracten: contracten.map(c => ({ id: c.id, naam: c.naam || c.titel || null, eindigt: c.eindigt || null })),
      werk: (b.m.werk || []).filter(w => w.werkruimte === g.w.id) });
  });

  return {};
};
