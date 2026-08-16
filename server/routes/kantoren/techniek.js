/* Kantoren, deel "techniek": de Techniek-controlekamer in de boardroom. Brengt de
   diepe systemen van het huis samen op één bord -- zichtbaar en bedienbaar vanuit
   de office-inlog, zonder dat je naar de aparte technische pagina hoeft:

     - HET GROOTBOEK: sluiten de twee grootboeken (RTG Pay + RTG Bank) op de cent
       (som = 0)? En draait de Rust-motor mee (schaduw/cutover), met een drift-
       vergelijking (JS-vingerafdruk vs motor-vingerafdruk)?
     - DE WACHT: het immuunsysteem -- de live-meters, de automatische L7-lastafworp
       (met een knop om hem met de hand aan/uit te zetten), quarantaine en de open
       raadkamer-voorstellen.

   Alleen lezen op de office-inlog; de lastafworp met de hand schakelen is een
   beschermings-ingreep en loopt daarom via de boardroom (de eigenaar). Het volle
   technische bord (zekeringen, health-checks, AI-fix) blijft op /apps/techniek.html. */
module.exports = (ctx) => {
  const { app, boardroomAuth, veilig, kern } = ctx;
  const pay = kern.pay, bank = kern.bank, wacht = kern.wacht;

  // De gecureerde momentopname voor de Techniek-kamer. De diepe systemen (geld,
  // immuunsysteem) zijn boardroom-territorium, dus achter de boardroom-poort (de
  // eigenaar, of wie hij toegang gaf) -- net als de boardroom zelf.
  app.post('/api/office/techniek', boardroomAuth, async (req, res) => {
    try {
      // --- de twee grootboeken: sluiten ze op de cent? ---
      let payG = null, bankG = null;
      try { const s = pay && pay.sluitcontrole && pay.sluitcontrole(); if (s) payG = { klopt: s.klopt, som: s.som, modus: pay.geldModus }; } catch (e) {}
      try { const g = bank && bank.gezondheid && bank.gezondheid(); if (g && g.sluit) bankG = { klopt: g.sluit.klopt, som: g.sluit.som, modus: bank.geldModus, depositoCenten: g.depositoCenten, kredietCenten: g.kredietCenten, aantalRekeningen: g.aantalRekeningen }; } catch (e) {}

      // --- de Rust-motor: draait hij mee, en klopt de drift-vergelijking? ---
      let motor = { aan: false };
      try {
        const payStand = (pay && pay.schaduw && pay.schaduw.aan) ? await pay.schaduw.stand() : null;
        const bankStand = (bank && bank.motorStand) ? await bank.motorStand.stand() : null;
        const aan = !!(payStand) || (bank && bank.geldModus === 'motor') || (pay && pay.geldModus === 'motor');
        motor = { aan, modus: (pay && pay.geldModus) || 'schaduw', pay: payStand, bank: bankStand };
      } catch (e) { motor = { aan: false, fout: 'motor onbereikbaar' }; }

      // --- De Wacht: het immuunbord (meters, lastafworp, quarantaine, raadkamer) ---
      let dewacht = null;
      try { if (wacht && wacht.bord) dewacht = wacht.bord(); } catch (e) {}

      res.json({ ok: true, grootboek: { pay: payG, bank: bankG }, motor, wacht: dewacht });
    } catch (e) {
      res.status(500).json({ error: 'De techniek-status kon niet worden opgehaald.' });
    }
  });

  // De automatische lastafworp met de hand aan- of uitzetten -- een beschermings-
  // ingreep, dus via de boardroom (de eigenaar).
  app.post('/api/office/techniek/lastafworp', boardroomAuth, (req, res) => veilig(res, () => {
    if (!wacht || !wacht.zetLastafworp) return { status: 503, error: 'De Wacht draait niet.' };
    const r = wacht.zetLastafworp(req.body && req.body.aan === true);
    return { status: 200, ok: true, uitleg: r && r.uitleg };
  }));

  require('./integraties')(ctx);
};
