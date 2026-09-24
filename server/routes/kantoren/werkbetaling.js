/* Kantoren, deel "werkbetaling": de schakelaar waarmee RTG de weg "Werk OS-uitgave
   via RTG Rekening" aan- of uitzet (kern/werkbetaling.js). Standaard uit.

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
      if (!req.boardroomBaas) return res.status(403).json({ error: 'Alleen de eigenaar zet de weg via RTG Rekening aan of uit.' });
      const bewijs = await zwaar.eis(boardroomUser(req), 'eigenaar-werkbankpad', zwaar.sessieSleutel(req), req,
        'De Werk OS-uitgave via RTG Rekening aan- of uitzetten');
      if (bewijs.error) return zwaar.stuur(res, bewijs);
      const u = boardroomUser(req);
      const r = kern.werkBankpadZet({ aan: req.body && req.body.aan, wie: (u && u.codename) || 'eigenaar' });
      if (r.error) return res.status(r.status || 400).json({ error: r.error });
      afdelingen.audit('eigenaar', 'Werk OS-uitgave via RTG Rekening ' + (r.aan ? 'aangezet' : 'uitgezet') + '.');
      res.json(r);
    } catch (e) { console.error('[werkbankpad]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });

  /* REKENINGEN VOOR ENTITEITEN (kern/bank/entiteit.js): een nieuw soort klant, een
     rechtspersoon, dus standaard DICHT en alleen de eigenaar met de passkey. */
  app.post('/api/office/bank/entiteitrekening', boardroomAuth, (req, res) =>
    res.json(Object.assign({ ok: true }, kern.entiteitRekeningStand())));

  app.post('/api/office/bank/entiteitrekening/zet', boardroomAuth, async (req, res) => {
    try {
      if (!req.boardroomBaas) return res.status(403).json({ error: 'Alleen de eigenaar zet rekeningen voor entiteiten open of dicht.' });
      const bewijs = await zwaar.eis(boardroomUser(req), 'eigenaar-entiteitrekening', zwaar.sessieSleutel(req), req,
        'Rekeningen op naam van een entiteit open- of dichtzetten');
      if (bewijs.error) return zwaar.stuur(res, bewijs);
      const r = kern.entiteitRekeningZet({ open: req.body && req.body.open, wie: 'eigenaar' });
      if (r.error) return res.status(r.status || 400).json({ error: r.error });
      afdelingen.audit('eigenaar', 'Rekeningen voor entiteiten ' + (r.open ? 'opengezet' : 'dichtgezet') + '.');
      res.json(r);
    } catch (e) { console.error('[entiteitrekening]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
