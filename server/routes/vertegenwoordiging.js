/* RTG Vertegenwoordiging: een mens die handelt namens een mens.

   DRIE DEUREN EN ZE ZIJN NIET DEZELFDE. `mijn`, `grens` en `aanvaard` gaan over
   het eigen dossier van de cliënt en lezen dus de sessiesleutel. `voorstel` en
   `handel` komen van de VERTEGENWOORDIGER en noemen daarom een machtiging die
   niet van hem is -- die wordt in de kern opgezocht op zijn eigen sleutel, en
   nooit op iets uit het lijf. Wie dat omdraait, laat iemand met een geraden id
   in het dossier van een vreemde handelen.

   Elke schrijfroute is ASYNC omdat de kern duurzaam vastlegt: het antwoord
   vertrekt pas als de opslag de commit heeft bevestigd (GELDLAT.md). Een
   vergeten `await` stuurt hier een Promise terug -- en dat is precies de 200 die
   niets betekent.

   De contracten van deze acht staan in server/lib/mutatiecontracten-
   vertegenwoordiging.js en stonden er VOORDAT deze routes werden opgehangen. */
module.exports = (kern) => {
  const { app, vertegenwoordiging, auth } = kern;
  const stuur = (res, r) => (r && r.error)
    ? res.status(r.status || 400).json({ error: r.error })
    : res.json(r);

  /* Een gast heeft geen codenaam en dus geen dossier: hem een leeg team tonen
     zou suggereren dat er iets te beheren valt. */
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest' && !req.session.account) {
      res.status(403).json({ error: 'Maak een gratis account; een machtiging hangt aan een mens en niet aan een bezoek.' });
      return true;
    }
    return false;
  };

  app.post('/api/vertegenwoordiging/bevoegdheden', auth, (req, res) => stuur(res, vertegenwoordiging.lijst()));

  app.post('/api/vertegenwoordiging/mijn', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, vertegenwoordiging.mijn(req.session.key));
  });

  app.post('/api/vertegenwoordiging/simulatie', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, vertegenwoordiging.simulatie(req.session.key, String((req.body || {}).id || '')));
  });

  app.post('/api/vertegenwoordiging/voorstel', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await vertegenwoordiging.voorstel(req.session.key, req.body || {}));
  });

  app.post('/api/vertegenwoordiging/aanvaard', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await vertegenwoordiging.aanvaard(req.session.key, String((req.body || {}).id || '')));
  });

  app.post('/api/vertegenwoordiging/intrek', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    const b = req.body || {};
    stuur(res, await vertegenwoordiging.intrek(req.session.key, String(b.id || ''), b.reden));
  });

  /* HET JEUGDBESTUUR: drie handelingen, drie verschillende mensen. De jongere
     wijst aan, de volwassene aanvaardt de rol, en de voogd tekent mee onder een
     machtiging die de jongere AL heeft aanvaard. Het kantoorbesluit dat de
     voogdij bevestigt staat bewust niet hier maar in routes/office/voogdij.js:
     dit domein kan niet bij kluisAuth, en dat is de bedoeling. */
  app.post('/api/vertegenwoordiging/voogd/vraag', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await vertegenwoordiging.voogdVraag(req.session.key, String((req.body || {}).voogd || '')));
  });

  app.post('/api/vertegenwoordiging/voogd/rol', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await vertegenwoordiging.voogdRolAanvaard(req.session.key, String((req.body || {}).client || '')));
  });

  app.post('/api/vertegenwoordiging/voogd/tekent', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await vertegenwoordiging.voogdTekent(req.session.key, String((req.body || {}).id || '')));
  });

  app.post('/api/vertegenwoordiging/grens', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await vertegenwoordiging.grensZet(req.session.key, (req.body || {}).bevoegdheden));
  });

  app.post('/api/vertegenwoordiging/handel', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    const b = req.body || {};
    stuur(res, await vertegenwoordiging.handel(req.session.key, String(b.id || ''),
      String(b.bevoegdheid || ''), { wat: b.wat, bedragCenten: b.bedragCenten }));
  });
};
