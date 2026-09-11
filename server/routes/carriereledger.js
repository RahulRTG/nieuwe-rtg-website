/* HET CARRIERE LEDGER (kern/carriereledger/): de loopbaan van een mens als
   chronologische reeks, per regel bewijsbaar.

   Wat een LID met zijn eigen ledger doet staat hier. Bevestigen doet een ander
   -- een medewerker van RTG in routes/office/carriereledger.js, een club of bond
   vanaf haar eigen zaakaccount in routes/supplier/carriereledger.js. Dat is geen
   indeling om de omvang: wie zijn eigen regels kan bevestigen, heeft een ledger
   waarin `gezien` niets betekent.

   /toon HEEFT MET OPZET GEEN `auth`. Dat is de hele functie van de deelcode: een
   sponsor of een visumloket hoort een regel te kunnen lezen zonder een
   RTG-account te nemen. Wat hij ziet is EEN feit met zijn bevestigingen en het
   voorbehoud eromheen -- nooit het ledger. De code zelf is het bewijs, hij
   verloopt, en het lid kan hem stoppen.

   EN HIJ HEET `PUBLIC` IN HET MUTATIECONTRACT, NIET `OBJECT_SCOPED`. Dat besluit
   woont hier omdat het over deze route gaat, en het is een correctie op een
   eerdere keuze van mij.

   Er stond eerst `OBJECT_SCOPED`, met het argument dat de toegang aan een object
   uit het verzoek hangt -- het veld `code` wijst precies EEN gedeeld feit aan,
   en twee codes geven een ander antwoord -- en dat `PUBLIC` ("zonder enige
   sleutel") hier feitelijk onwaar is. Dat argument klopt inhoudelijk, en is toch
   de verkeerde keuze:

     1. De ROUTER leidt `PUBLIC` af, want er hangt geen bewakerslaag voor, en
        scripts/mutatiecontract.js meldt het verschil. Een verklaarde klasse die
        strenger is dan wat de deur werkelijk afdwingt, maakt van dat register een
        verlanglijst -- dezelfde reden waarom de kantoorwegen van deze laag
        `AUTHENTICATED` heten en niet `CAPABILITY_GATED`.
     2. De route staat AL in scripts/lib/publiek.js, met een reden. Twee registers
        die iets anders zeggen over dezelfde route zijn erger dan een onvolmaakte
        naam: dan wint op een dag de losse van de twee.

   Wat de naam niet vangt, hoort er hardop bij: er IS een geheim, het staat alleen
   in het LIJF in plaats van in een kop -- 128 bits, alleen als hash op schijf,
   vergeleken met timingSafeEqual, verlopend en te stoppen door het lid
   (kern/bearercode.js). En de rem die `PUBLIC` eist hangt ervoor: 300 verzoeken
   per IP per minuut (middleware/remmen.js). */
module.exports = (kern) => {
  const { app, carriereledger, auth } = kern;
  const stuur = (res, r) => (r && r.error)
    ? res.status(r.status || 400).json(Object.assign({ error: r.error },
      r.waarom ? { waarom: r.waarom } : {}))
    : res.json(r);
  const lid = (req, res) => {
    if (!req.session.key) { res.status(403).json({ error: 'Dit is voor leden met een eigen account.' }); return null; }
    return req.session.key;
  };

  app.post('/api/carriere/ledger/mijn', auth, (req, res) => {
    const k = lid(req, res); if (!k) return;
    stuur(res, carriereledger.mijn(k));
  });

  app.post('/api/carriere/ledger/zet', auth, (req, res) => {
    const k = lid(req, res); if (!k) return;
    stuur(res, carriereledger.zet(k, req.body || {}));
  });

  app.post('/api/carriere/ledger/intrek', auth, (req, res) => {
    const k = lid(req, res); if (!k) return;
    const b = req.body || {};
    stuur(res, carriereledger.intrek(k, String(b.id || ''), { door: 'het lid', reden: b.reden }));
  });

  app.post('/api/carriere/ledger/deel', auth, (req, res) => {
    const k = lid(req, res); if (!k) return;
    const b = req.body || {};
    stuur(res, carriereledger.deel(k, String(b.id || ''), { dagen: b.dagen, voor: b.voor }));
  });

  app.post('/api/carriere/ledger/delen', auth, (req, res) => {
    const k = lid(req, res); if (!k) return;
    res.json({ status: 200, delen: carriereledger.mijnDelen(k) });
  });

  app.post('/api/carriere/ledger/stopdelen', auth, (req, res) => {
    const k = lid(req, res); if (!k) return;
    stuur(res, carriereledger.stopDelen(k, String((req.body || {}).id || '')));
  });

  app.post('/api/carriere/regel/toon', (req, res) =>
    stuur(res, carriereledger.toon(String((req.body || {}).code || ''))));
};
