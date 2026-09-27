/* Member-submodule: de CADEAUKAART. Een kaart met saldo bij EEN zaak, in de app
   gekocht en aan de kassa van diezelfde zaak in te wisselen.

   Afgesplitst uit ./boeken.js, waar hij tussen de boekingen en bestellingen
   stond. Twee redenen, en de tweede is de echte: een kaart is geen boeking, en
   sinds hij echt betaald wordt is het geen paar regels meer maar een
   geldhandeling met een betaalpad, een volgorde en een herhaalgrendel.

   DE CODE (pay.giftcard_value_code) staat in kern/cadeaukaart.js: 128 bits,
   alleen als hash bewaard, en kaal alleen in het antwoord op de koop en op een
   rotatie. Het overzicht toont hem nooit meer.

   Gemount vanuit routes/member.js. */

module.exports = (kern) => {
  const { app, auth, findSupplier, schoon, notifySupplier, sseToSupplier,
    cadeaukaart, PERSONAS, pay } = kern;
  const codenaamVan = req => (req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename);

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
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    const s = findSupplier(req.body.supplierCode);
    if (!s) return res.status(404).json({ error: 'Partner niet gevonden.' });
    const bedrag = Math.round(Number(req.body.bedrag));
    if (!(bedrag >= 10 && bedrag <= 5000)) return res.status(400).json({ error: 'Kies een bedrag tussen € 10 en € 5.000.' });
    const codename = codenaamVan(req);
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
    const r = await cadeaukaart.uitgeef({ supplierCode: s.code, supplierName: s.name, bedrag, kocht: codename,
      customerKey: req.session.key, issuer: 'rtg.lid.cadeaukaart', idem });
    if (r.herhaald) return res.json(r);
    notifySupplier(s.code, { icon: 'attenties', title: 'Cadeaukaart verkocht', body: codename + ' kocht via de app een cadeaukaart van € ' + bedrag + '.' });
    sseToSupplier(s.code, 'sync', { scope: 'pos' });
    const kaart = Object.assign({}, r.kaart, { code: r.code });
    res.json({ ok: true, eenmalig: true, kaart, betaaldCenten: betaald.centen, bijgeladen: betaald.bijgeladen || 0 });
  });

  app.post('/api/giftcards/mine', auth, async (req, res) => {
    res.json({ kaarten: await cadeaukaart.mijn(req.session.key) });
  });

  /* Een nieuwe code voor een kaart die dit lid kocht: de oude is daarna dood,
     de nieuwe staat alleen in dit antwoord. */
  app.post('/api/giftcard/roteer', auth, async (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    const id = String(req.body.id || '').slice(0, 40);
    const r = await cadeaukaart.roteer({ vind: g => g.id === id && g.customerKey === req.session.key,
      door: 'lid:' + codenaamVan(req), idem: req.body.idem });
    if (!r.ok) return res.status(r.status || 400).json(r);
    res.json(r);
  });
};
