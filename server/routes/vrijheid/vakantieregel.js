/* DE PRODUCTIEPOORT VAN DE VAKANTIEREGEL -- de deuren
   (kern/vrijheid/vakantiepoort.js, VRIJHEID.md par. 6a).

   Dezelfde vorm als de terugstortstand en het afdwingen van de beleidsmotor:
   LEZEN mag iedereen in de boardroom, ZETTEN doet de eigenaar op eigen naam met
   een verse passkey. Openen vraagt daarbij een vastgelegde juridische toets
   (wie, wanneer, kenmerk); dichtzetten niet, want dat is de veilige kant op. */
'use strict';

module.exports = (kern) => {
  const { app, boardroomAuth, boardroomWie, vrijheid, zwaarbewijs: zwaar } = kern;
  const poort = () => vrijheid.vakantiepoort;
  const { ARTIKELEN, OPBOUW } = require('../../kern/vrijheid/vakantieregel');

  app.post('/api/office/vrijheid/vakantieregel', boardroomAuth, (req, res) =>
    res.json({ ok: true, ...poort().stand(), artikelen: ARTIKELEN, opbouw: OPBOUW,
      let: 'Dit is geen juridisch oordeel. De regel rekent; pas na een afgeronde juridische toets kan de eigenaar hem vrijgeven.' }));

  app.post('/api/office/vrijheid/vakantieregel/stand', boardroomAuth, async (req, res) => {
    try {
      if (!req.boardroomBaas) return res.status(403).json({ error: 'Alleen de eigenaar zet de productiepoort van de vakantieregel.' });
      const b = req.body || {};
      const stand = String(b.stand || '');
      const bewijs = await zwaar.eis(zwaar.boardroomUser(req), 'eigenaar-vakantieregel', zwaar.sessieSleutel(req), req,
        stand === 'open' ? 'De vakantieregel vrijgeven na de juridische toets' : 'De productiepoort van de vakantieregel sluiten');
      if (bewijs.error) return zwaar.stuur(res, bewijs);
      let r;
      const mis = await vrijheid.vastleggen(() => { r = poort().zet({ stand, door: boardroomWie(req), toets: b.toets }); });
      if (mis) return res.status(mis.status || 503).json(mis);
      return r && r.error ? res.status(r.status || 400).json(r) : res.json(r);
    } catch (e) { console.error('[vakantieregel]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
