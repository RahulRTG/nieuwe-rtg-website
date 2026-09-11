/* EEN ZAAK BEVESTIGT EEN REGEL (kern/carriereledger/).

   Dit is de herkomst `bevestigd`: een club, bond, label of organisator zegt
   vanaf HAAR EIGEN account dat een regel in het ledger van een mens klopt. Dat
   is iets anders dan `gezien` -- daar heeft RTG een stuk ingezien, hier spreekt
   de partij zelf.

   WAT RTG DAARMEE VASTSTELT, EN WAT NIET, staat in kern/carriereledger/regels.js
   en gaat mee in elk antwoord: vastgesteld wordt DAT deze partij het heeft
   bevestigd. Of die partij daartoe bevoegd is, beoordeelt de lezer. RTG kent
   geen register van bonden en doet niet alsof -- dezelfde regel als in
   kern/vakbewijs.js.

   TWEE GRENZEN.

   1. HET LID LEVERT HET REGELNUMMER AAN. Er is geen route waarmee een zaak het
      ledger van een mens kan doorzoeken; dan zou een club een dossier kunnen
      opbouwen over iedereen die ooit bij haar speelde. Zonder nummer geen
      bevestiging.

   2. ALLEEN EEN MANAGER. Een bevestiging gaat de wereld in op naam van de zaak
      en is niet terug te nemen zonder spoor. Dat is dezelfde lat als de rest van
      wat een zaak naar buiten verklaart.

   TERUGNEMEN KAN, en dat is geen gat maar de andere helft: een bond die zich
   vergist heeft, hoort zijn eigen bevestiging te kunnen intrekken. De
   oorspronkelijke regel blijft staan -- intrekken stopt de toekomst en niet het
   verleden. */
module.exports = (kern) => {
  const { app, carriereledger, supplierAuth, keyVanCodenaam } = kern;
  if (!carriereledger) return;

  const stuur = (res, r) => (r && r.error)
    ? res.status(r.status || 400).json({ error: r.error })
    : res.json(r);

  const managerOf = (req, res) => {
    if (!req.actor || !req.actor.manager) { res.status(403).json({ error: 'Alleen voor management.' }); return null; }
    return req.actor.name || 'manager';
  };
  /* De naam waaronder de bevestiging komt te staan is die van de ZAAK, met de
     medewerker erachter. Alleen de zaaknaam zou verbergen wie het deed; alleen
     de medewerker zou een persoonlijke mening lijken. */
  const namens = (req, mens) => (req.supplier && req.supplier.name ? req.supplier.name : 'een zaak') +
    ' (' + mens + ')';

  const zoek = async (b, res) => {
    const g = keyVanCodenaam ? await keyVanCodenaam(String(b.mens || '').trim()) : null;
    if (!g || !g.key) { res.status(404).json({ error: 'Deze mens bestaat niet. Vraag om de codenaam zoals die in RTG staat.' }); return null; }
    return g.key;
  };

  app.post('/api/supplier/carriere/bevestig', supplierAuth, async (req, res) => {
    const wie = managerOf(req, res); if (!wie) return;
    const b = req.body || {};
    const key = await zoek(b, res); if (!key) return;
    stuur(res, carriereledger.bevestig(key, String(b.id || ''),
      { herkomst: 'bevestigd', door: namens(req, wie), wat: b.wat }));
  });

  app.post('/api/supplier/carriere/intrek', supplierAuth, async (req, res) => {
    const wie = managerOf(req, res); if (!wie) return;
    const b = req.body || {};
    const key = await zoek(b, res); if (!key) return;
    stuur(res, carriereledger.intrek(key, String(b.id || ''),
      { door: namens(req, wie), reden: b.reden }));
  });
};
