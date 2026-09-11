/* HET KANTOOR EN HET CARRIERE LEDGER (kern/carriereledger/).

   Een medewerker kan bij een feit noteren dat hij een STUK heeft gezien. Wat
   dat wel en niet zegt staat in kern/carriereledger/regels.js en gaat mee in
   elk antwoord: RTG legt vast dat een mens het stuk heeft ingezien, en
   valideert niets inhoudelijk -- wij bellen de bond niet en doen niet alsof.

   OP NAAM, om dezelfde reden als bij de rugdekking: `wieKijkt(req)` geeft alleen
   iets als er een echte medewerker achter het kantoortoken hangt. Met de
   gedeelde OFFICE_CODE blijft dat leeg en weigert de kern. Een spoor dat eindigt
   bij een gedeelde code is geen spoor (KANTOORMACHT.md).

   HET KANTOOR LEEST HIER GEEN LEDGERS. Er is met opzet geen route die het ledger
   van een lid opent: dat is "alles over deze mens" en die vraag stelt HDI.md
   par. 5.1 buiten de orde. Bevestigen gaat over EEN regel, waarvan het lid het
   nummer aanlevert. */
module.exports = (octx, gedeeld) => {
  const { kern } = octx;
  const { app, kluisAuth, carriereledger, keyVanCodenaam } = kern;
  const { wieKijkt } = gedeeld;
  const stuur = (res, r) => (r && r.error)
    ? res.status(r.status || 400).json({ error: r.error })
    : res.json(r);

  app.post('/api/office/carriere/ledger/bevestig', kluisAuth, async (req, res) => {
    const b = req.body || {};
    const w = wieKijkt(req) || {};
    const wie = w.naam || w.sleutel || w.id || '';
    const gevonden = keyVanCodenaam ? await keyVanCodenaam(String(b.mens || '').trim()) : null;
    if (!gevonden || !gevonden.key) {
      return res.status(404).json({ error: 'Deze mens bestaat niet. Vraag om de codenaam zoals die in RTG staat.' });
    }
    stuur(res, carriereledger.bevestig(gevonden.key, String(b.id || ''),
      { herkomst: 'gezien', door: wie, wat: b.wat }));
  });
};
