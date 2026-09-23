/* Kantoren, deel "werkbetaling": de schakelaar waarmee RTG de weg "Werk OS-uitgave
   via RTG Bank" aan- of uitzet (kern/werkbetaling.js). Standaard uit.

   ZETTEN IS ZWAAR EN VAN DE EIGENAAR. Aanzetten opent een geldweg voor elke
   werkruimte; dat hoort niet te kunnen uit een sessie die iemand open liet staan,
   en niet door wie alleen de sleutel van de kamer kreeg -- dezelfde vorm als de
   terugstortstand (./bank-bevoegd.js). Lezen mag iedereen in de boardroom. */
module.exports = (ctx) => {
  const { app, boardroomAuth, afdelingen, zwaar, boardroomUser, kern } = ctx;

  app.post('/api/office/werkos/bankpad', boardroomAuth, (req, res) =>
    res.json(Object.assign({ ok: true }, kern.werkBankpadStand())));

  app.post('/api/office/werkos/bankpad/zet', boardroomAuth, async (req, res) => {
    try {
      if (!req.boardroomBaas) return res.status(403).json({ error: 'Alleen de eigenaar zet de weg via RTG Bank aan of uit.' });
      const bewijs = await zwaar.eis(boardroomUser(req), 'eigenaar-werkbankpad', zwaar.sessieSleutel(req), req,
        'De Werk OS-uitgave via RTG Bank aan- of uitzetten');
      if (bewijs.error) return zwaar.stuur(res, bewijs);
      const u = boardroomUser(req);
      const r = kern.werkBankpadZet({ aan: req.body && req.body.aan, wie: (u && u.codename) || 'eigenaar' });
      if (r.error) return res.status(r.status || 400).json({ error: r.error });
      afdelingen.audit('eigenaar', 'Werk OS-uitgave via RTG Bank ' + (r.aan ? 'aangezet' : 'uitgezet') + '.');
      res.json(r);
    } catch (e) { console.error('[werkbankpad]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
