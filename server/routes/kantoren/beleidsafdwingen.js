/* Kantoren, deel "beleidsafdwingen": per kantoordeur de schakelaar van de
   beleidsmotor, schaduw of afdwingen (kern/beleidsmotor/afdwingen.js). Besluit
   van de eigenaar, 24 september 2026.

   ZETTEN IS ZWAAR EN VAN DE EIGENAAR: een afgedwongen deur kan medewerkers
   buitensluiten, en dat hoort niet te kunnen uit een sessie die iemand open liet
   staan -- dezelfde vorm als ./werkbetaling.js. Aanzetten weigert de motor zelf
   zolang de deur niet rijp is of ooit oneens was. Lezen mag iedereen in de
   boardroom: de stand staat ook in /api/office/beleidsmotor. */
module.exports = (ctx) => {
  const { app, boardroomAuth, afdelingen, zwaar, boardroomUser, kern } = ctx;
  const motor = () => kern.beleidsmotor && kern.beleidsmotor.afdwingen;

  app.post('/api/office/beleidsmotor/afdwingen', boardroomAuth, (req, res) => {
    if (!motor()) return res.status(503).json({ error: 'De beleidsmotor is niet bedraad in deze server.' });
    res.json({ ok: true, deuren: motor().overzicht() });
  });

  app.post('/api/office/beleidsmotor/afdwingen/zet', boardroomAuth, async (req, res) => {
    try {
      if (!motor()) return res.status(503).json({ error: 'De beleidsmotor is niet bedraad in deze server.' });
      if (!req.boardroomBaas) return res.status(403).json({ error: 'Alleen de eigenaar zet een kantoordeur op afdwingen.' });
      const b = req.body || {};
      const bewijs = await zwaar.eis(boardroomUser(req), 'eigenaar-beleidsmotor-afdwingen', zwaar.sessieSleutel(req), req,
        (b.aan === true ? 'De beleidsmotor laten afdwingen op de deur ' : 'De deur terug naar de schaduw: ') + String(b.deur || ''));
      if (bewijs.error) return zwaar.stuur(res, bewijs);
      const r = motor().zet(String(b.deur || ''), b.aan, 'eigenaar');
      if (r.error) return res.status(r.status || 400).json(r);
      afdelingen.audit('eigenaar', 'Beleidsmotor op de deur ' + r.deur + ': ' + r.stand + '.');
      res.json(r);
    } catch (e) { console.error('[beleidsafdwingen]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
