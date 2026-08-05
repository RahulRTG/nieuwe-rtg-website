/* Routes voor samen produceren en uitgeven (kern/muziek-samen.js en
   kern/muziek-uitgave.js).

   Twee dingen die hier bewaakt worden en niet in de kern kunnen:
   - een medemaker wordt op CODENAAM uitgenodigd; de vertaling naar een sleutel
     gebeurt hier, want een sleutel hoort niet over de lijn;
   - de RTG-naam onder een uitgave zetten kan ALLEEN via de kantoor-inlog. Dat
     is geen extra slot maar hetzelfde slot als bij de passen: een mens beslist,
     de app niet en Rahul niet. */
module.exports = (kern) => {
  const { app, auth, officeAuth, keyVanCodenaam, muziekNodig, muziekMakerEruit, muziekVerlaat,
          muziekRolZet, muziekMakers, muziekGeefUit, muziekTrekIn, muziekVraagRtg, muziekZaal,
          muziekLuister, muziekUitgaveVan, muziekMooi, muziekReageer, muziekReacties, muziekKantoorLijst,
          muziekKantoorBeslis } = kern;
  if (!muziekNodig) return;
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'RTG Klankwerk is voor leden.' }); return true; }
    return false;
  };
  const id = (req) => String((req.body && req.body.id) || '');

  /* ---- samen produceren ---- */
  app.post('/api/muziek/samen', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, muziekMakers(req.session, id(req)));
  });
  app.post('/api/muziek/samen/nodig', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    const b = req.body || {};
    const codenaam = String(b.codenaam || '').trim();
    if (!codenaam) return res.status(400).json({ error: 'Wie wilt u erbij?' });
    let wie = null;
    try { wie = keyVanCodenaam ? await keyVanCodenaam(codenaam) : null; } catch (e) { wie = null; }
    stuur(res, muziekNodig(req.session, id(req), wie && wie.key, codenaam, b.rol));
  });
  app.post('/api/muziek/samen/eruit', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, muziekMakerEruit(req.session, id(req), (req.body || {}).codenaam));
  });
  app.post('/api/muziek/samen/verlaat', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, muziekVerlaat(req.session, id(req)));
  });
  app.post('/api/muziek/samen/rol', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, muziekRolZet(req.session, id(req), (req.body || {}).rol));
  });

  /* ---- uitgeven en de zaal ---- */
  app.post('/api/muziek/uitgeven', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, muziekGeefUit(req.session, id(req), req.body || {}));
  });
  app.post('/api/muziek/uitgave/in', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, muziekTrekIn(req.session, id(req)));
  });
  app.post('/api/muziek/uitgave/rtg', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, muziekVraagRtg(req.session, id(req)));
  });
  app.post('/api/muziek/zaal', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const b = req.body || {};
    stuur(res, muziekZaal(req.session, { alleenRtg: !!b.alleenRtg, vanMij: !!b.vanMij }));
  });
  app.post('/api/muziek/uitgave/van', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, muziekUitgaveVan(req.session, id(req)));
  });
  app.post('/api/muziek/uitgave', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, muziekLuister(req.session, id(req)));
  });
  app.post('/api/muziek/uitgave/mooi', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, muziekMooi(req.session, id(req), (req.body || {}).aan !== false));
  });
  app.post('/api/muziek/uitgave/reageer', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, muziekReageer(req.session, id(req), (req.body || {}).tekst));
  });
  app.post('/api/muziek/uitgave/reacties', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, muziekReacties(id(req)));
  });

  /* ---- het kantoor: de enige plek waar de RTG-naam eronder kan ---- */
  app.post('/api/office/muziek', officeAuth, (req, res) => stuur(res, muziekKantoorLijst()));
  app.post('/api/office/muziek/beslis', officeAuth, (req, res) => {
    const b = req.body || {};
    stuur(res, muziekKantoorBeslis(String(b.id || ''), b.ja === true, b.reden));
  });
};
