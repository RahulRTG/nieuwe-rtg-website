/* Backoffice (deelmodule): het bewaarverzoek op een identiteitsdossier.

   De regel van het huis is dat het identiteitsbewijs verdwijnt zodra de
   klantrelatie voorbij is -- direct, zonder nadenken (server/bewaarveger.js).
   Soms is dat te snel: een lid dat zegt binnenkort terug te komen, een lopend
   geschil over een boeking, een verzoek van een toezichthouder. Dan mag het
   dossier nog EEN jaar na dat einde blijven.

   Dat mag alleen als een MENS het vraagt en er een reden bij zet. Daarom is
   dit een eigen deur en geen vinkje: wat hier wordt vastgelegd is wie het
   vroeg, waarom, en wanneer. Zonder verzoek is er niets om te overwegen en
   wist de veger gewoon.

   Afgesplitst uit werk.js omdat dat bestand tegen de 10 KB van keuringsregel
   13 aan zat; de identiteitskluis-routes horen inhoudelijk bij elkaar, maar
   een bestand dat niet meer open kan is geen bestand. */
module.exports = (octx) => {
  const { kern } = octx;
  const { app, accounts, officeAuth, save, schoon, sseToOffice } = kern;

  /* Een verzoek vastleggen of intrekken:
       { userId, reden }            -> vastleggen (de reden is verplicht)
       { userId, intrekken: true }  -> weghalen; de gewone regel geldt weer
     Alleen de eigenaar: dit verlengt de bewaring van het zwaarste wat we van
     iemand hebben, en dat is geen loketbesluit. */
  app.post('/api/office/bewaarverzoek', officeAuth, (req, res) => {
    if (!req.eigenaar) return res.status(403).json({ error: 'Alleen de eigenaar legt een bewaarverzoek vast.' });
    const u = accounts.getUserById(Number((req.body || {}).userId));
    if (!u) return res.status(404).json({ error: 'Account niet gevonden.' });
    const md = accounts.getMemberState(u.id) || {};
    if ((req.body || {}).intrekken === true) {
      delete md.bewaarVerzoek;
      accounts.saveMemberState(u.id, md);
      save();
      try { sseToOffice('sync', { scope: 'verificaties' }); } catch (e) {}
      return res.json({ ok: true, bewaarVerzoek: null });
    }
    const reden = schoon ? schoon((req.body || {}).reden, 200) : String((req.body || {}).reden || '').slice(0, 200);
    /* Een verzoek zonder reden is geen verzoek maar een knop. De reden is het
       enige wat later nog uitlegt waarom dit dossier langer bleef staan. */
    if (!reden || reden.trim().length < 5)
      return res.status(400).json({ error: 'Zet erbij waarom dit dossier langer moet blijven; dat is de hele bedoeling van het verzoek.' });
    /* Wie het vroeg komt uit de INLOG, nooit uit het verzoek: een naam die je
       zelf mag typen is geen spoor maar een suggestie. officeAuth zet
       req.eigenaar; de naam halen we uit het token erachter. */
    let door = 'eigenaar';
    try {
      const h = req.get('authorization') || '';
      const tok = h.startsWith('Bearer ') ? h.slice(7) : null;
      const wie = tok && accounts.verifyToken(tok);
      if (wie) door = accounts.realNameOf(wie) || 'eigenaar';
    } catch (e) {}
    md.bewaarVerzoek = { at: new Date().toISOString(), reden: reden.trim(), door };
    accounts.saveMemberState(u.id, md);
    save();
    try { sseToOffice('sync', { scope: 'verificaties' }); } catch (e) {}
    res.json({ ok: true, bewaarVerzoek: md.bewaarVerzoek });
  });
};
