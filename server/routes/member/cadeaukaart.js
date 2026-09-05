/* Member-submodule: de CADEAUKAART. Een kaart met saldo bij EEN zaak, in de app
   gekocht en aan de kassa van diezelfde zaak in te wisselen.

   Afgesplitst uit ./boeken.js, waar hij tussen de boekingen en bestellingen
   stond. Twee redenen, en de tweede is de echte: een kaart is geen boeking, en
   sinds hij echt betaald wordt is het geen paar regels meer maar een
   geldhandeling met een betaalpad, een volgorde en een herhaalgrendel.

   Gemount vanuit routes/member.js. */
const moneyCredentialBlokkade = require('../../middleware/money-credential-productiepoort').blokkade;

module.exports = (kern) => {
  const { app, auth, db, save, findSupplier, schoon, notifySupplier, sseToSupplier,
    gcCode, PERSONAS, pay } = kern;

  /* EEN CADEAUKAART KOPEN KOSTTE NIETS, EN DAT IS HIER GEREPAREERD.

     Deze route maakte een kaart met saldo aan, meldde de zaak "Cadeaukaart
     verkocht" en sloeg hem op -- en er werd nergens iets geind. De kaart is aan
     de kassa van diezelfde zaak in te wisselen (/api/supplier/giftcard/redeem)
     en telt in kern/fiscaal als een verplichting op zijn balans. Een lid kon dus
     gratis een kaart van 5.000 euro maken, hem uitgeven bij de zaak, en de zaak
     bleef met de schuld zitten.

     Kopen loopt nu via pay.partnerIn: het geld gaat van de wallet van het lid
     naar de rekening van de zaak, met autolaad eromheen zoals elk ander
     geld-moment hier. Dat is ook boekhoudkundig het juiste beeld -- de zaak
     ontvangt geld en houdt er een verplichting aan over, precies wat
     kern/boekhoudkennis.js de ondernemer vertelt.

     De KASSA-variant (/api/supplier/giftcard/sell) blijft ongemoeid en hoort
     dat ook: daar staat de klant aan de balie en rekent hij aan de kassa af.
     Daar is de betaling het werk van de kassa, niet van deze code. */
  app.post('/api/giftcard/buy', auth, async (req, res) => {
    const dicht = moneyCredentialBlokkade('pay.giftcard_value_code');
    if (dicht) return res.status(dicht.status).json(dicht);
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    const s = findSupplier(req.body.supplierCode);
    if (!s) return res.status(404).json({ error: 'Partner niet gevonden.' });
    const bedrag = Math.round(Number(req.body.bedrag));
    if (!(bedrag >= 10 && bedrag <= 5000)) return res.status(400).json({ error: 'Kies een bedrag tussen € 10 en € 5.000.' });
    const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
    /* EERST BETALEN, DAN DE KAART. Andersom zou een mislukte betaling een
       geldige kaart achterlaten -- precies de fout die hierboven beschreven
       staat, alleen dan bij vlagen in plaats van altijd. */
    const idem = schoon(req.body.idem, 60) || null;
    const betaald = await pay.partnerIn({
      supplierCode: s.code, codenaam: codename, centen: bedrag * 100,
      soort: 'cadeaukaart', oms: 'Cadeaukaart ' + s.name, idem
    });
    if (betaald.error) return res.status(betaald.status || 400).json({ error: betaald.error });
    /* DE BETALING WAS IDEMPOTENT, DE KAART NIET -- en dat is precies de
       double-write die GELDLAT.md beschrijft. Een herhaling met dezelfde sleutel
       kreeg van pay.partnerIn netjes het bewaarde antwoord terug (er werd dus
       maar EEN keer afgeschreven) en liep daarna gewoon door naar het aanmaken
       van een TWEEDE kaart. Betalen voor een en er twee krijgen, met een
       dubbeltik. Gevonden doordat de toets hieronder het aantal kaarten telde in
       plaats van alleen de status.

       De sleutel gaat daarom mee op de kaart. Vindt hij hem niet terwijl de
       betaling wel herhaald is, dan is de vorige poging gestorven vóór het
       aanmaken -- dan hoort de kaart er alsnog te komen, en niet twee keer. */
    if (idem) {
      const bestaand = (db.data.giftcards || []).find(g => g.customerKey === req.session.key && g.idem === idem);
      if (bestaand) return res.json({ ok: true, kaart: bestaand, herhaald: true });
    }
    const kaart = { code: gcCode(), supplierCode: s.code, supplierName: s.name, bedrag, saldo: bedrag, idem,
      kocht: codename, customerKey: req.session.key, at: new Date().toISOString(), verzilveringen: [] };
    db.data.giftcards.unshift(kaart);
    db.data.giftcards = db.data.giftcards.slice(0, 20000);
    save();
    notifySupplier(s.code, { icon: 'attenties', title: 'Cadeaukaart verkocht', body: codename + ' kocht via de app een cadeaukaart van € ' + bedrag + '.' });
    sseToSupplier(s.code, 'sync', { scope: 'pos' });
    res.json({ ok: true, kaart, betaaldCenten: betaald.centen, bijgeladen: betaald.bijgeladen || 0 });
  });

  app.post('/api/giftcards/mine', auth, (req, res) => {
    const dicht = moneyCredentialBlokkade('pay.giftcard_value_code');
    if (dicht) return res.status(dicht.status).json(dicht);
    res.json({ kaarten: (db.data.giftcards || []).filter(g => g.customerKey === req.session.key).slice(0, 20) });
  });
};
