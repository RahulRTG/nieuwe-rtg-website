/* Domein "uitvoering": UITVOERENDE MEDIA -- de partituur, de aanspraak en de
   uitvoering (kern/uitvoering/, uitgelegd in UITVOEREND.md).

   Alles achter de gewone leden-inlog, en een gast komt er niet in -- zelfde
   deur als de Media OS eronder, want deze laag leest dezelfde catalogus.

   Er staat hier bewust GEEN kantoorkant. Melden, goedkeuren en verwijderen
   blijven bij het domein dat het stuk bezit; een tweede deur naar dezelfde
   handeling is een tweede plek die kan afwijken (LAT.md regel 4). */
module.exports = (kern) => {
  const { app, auth, uitvoering } = kern;
  if (!uitvoering) return;
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'Uitvoerende media is voor leden.' }); return true; }
    return false;
  };
  const sess = (req) => req.session;

  /* ---- de partituur: de kant van de maker ---- */
  app.post('/api/uitvoering/partituren', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, uitvoering.partituren(sess(req)));
  });
  app.post('/api/uitvoering/partituur/maak', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, uitvoering.partituurMaak(sess(req), req.body || {}));
  });
  app.post('/api/uitvoering/partituur/zet', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, uitvoering.partituurZet(sess(req), req.body || {}));
  });
  app.post('/api/uitvoering/partituur/onderdeel', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, uitvoering.onderdeel(sess(req), req.body || {}));
  });

  /* ---- uitvoeren: de kant van de kijker ----
     Een WEIGERING is hier een gewone uitslag en geen fout: hij draagt een
     reden en hetzelfde bewijsblok als een geslaagde uitvoering. Hij gaat wel
     met zijn eigen status de lijn op (403 zonder aanspraak, 409 als het
     gevraagde niet binnen de regels van de maker past), zodat een scherm het
     verschil ziet zonder in de tekst te hoeven lezen. */
  app.post('/api/uitvoering/voer', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const r = uitvoering.voerUit(sess(req), req.body || {});
    if (r && r.geweigerd) return res.status(r.status || 409).json(r);
    stuur(res, r);
  });

  /* ---- het aanbod: de aankoop die een aanspraak laat ontstaan ----
     Twee stappen en met opzet geen een: eerst de BON (wat betaal ik, aan wie,
     en wat krijg ik), dan de KOOP. GELD.md par. 3: alles wat een ander raakt is
     maximaal klaarzetten, en bevestigen doet de mens.

     `idem` hoort van de CLIENT te komen en per koopintentie hetzelfde te zijn.
     Daarmee is de hele keten idempotent: dezelfde idem geeft dezelfde boeking,
     en dezelfde boeking geeft dezelfde aanspraak (kern/uitvoering/aanbod.js). */
  app.post('/api/uitvoering/bon', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, uitvoering.bon(sess(req), req.body || {}));
  });
  app.post('/api/uitvoering/koop', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await uitvoering.koop(sess(req), req.body || {}));
  });

  /* ---- de aanspraak ----
     Lezen doet het lid zelf; verlenen en intrekken doet de MAKER, en alleen
     voor een code die een van zijn eigen partituren werkelijk vraagt (de
     controle staat in kern/uitvoering/index.js). Een lid verleent zichzelf
     nooit iets.

     ASYNC: de gids die een codenaam aan een sleutel koppelt is async. Wie hier
     de await vergeet, stuurt een Promise de lijn op. */
  app.post('/api/uitvoering/aanspraken', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, uitvoering.aanspraken(sess(req)));
  });
  app.post('/api/uitvoering/aanspraak/verleen', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await uitvoering.verleen(sess(req), req.body || {}));
  });
  app.post('/api/uitvoering/aanspraak/intrek', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await uitvoering.intrek(sess(req), req.body || {}));
  });
};
