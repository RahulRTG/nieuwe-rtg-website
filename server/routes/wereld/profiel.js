/* Wereld (deelmodule): het profiel met lagen, en de drie vermogens die bij de
   Lifestyle- en Business Pass horen -- geavanceerd zoeken, netwerkanalyse en
   "wie bekeek mijn profiel".

   Krijgt de gedeelde context een keer bij het opstarten vanuit routes/wereld.js;
   afgesplitst toen dat bestand over de 10 kB-grens ging. De naad zit waar hij
   inhoudelijk ook hoort: daar de app zelf (wie ben ik, wat zie ik), hier wie ik
   ben voor een ander en wat ik met het netwerk kan. */
'use strict';

module.exports = ({ app, auth, save, rechten, profiel, netwerk, bezoek,
  koppel, zijnVrienden, keyVanCodenaam, gidsHaal, eist }) => {

  /* ---------- het profiel met lagen ----------

     Lezen en zichtbaarheid zetten, meer niet. INVULLEN kan hier met opzet niet:
     elke laag woont in zijn eigen app (De Salon, RTG Zakelijk, je zaak) en die
     houdt zijn keuring en zijn rem -- zie de kop van kern/wereld/profiel.js. Het
     scherm krijgt per laag de `bron` mee zodat het kan zeggen WAAR je iets
     wijzigt, in plaats van een invoerveld te tonen dat niets opslaat. */
  app.post('/api/wereld/profiel', auth, (req, res) => {
    const tier = req.session.tier;
    if (!rechten.TRAP.includes(tier))
      return res.status(403).json({ error: 'RTG Wereld is er voor leden met een pas.' });
    res.json({
      lagen: profiel.mijnProfiel(req.session.key, tier),
      zichtbaarheden: rechten.ZICHTBAARHEDEN
    });
  });

  app.post('/api/wereld/profiel/zicht', auth, (req, res) => {
    const r = profiel.zetZicht(req.session.key, req.session.tier,
      String(req.body.pad || ''), String(req.body.niveau || ''));
    if (r.error) return res.status(400).json(r);
    save();
    res.json(r);
  });

  /* Het profiel van een ander, op CODENAAM -- nooit op sleutel, want dat is de
     enige identiteit die dit huis naar buiten kent. Per veld geldt wat de
     eigenaar heeft ingesteld; wat je niet mag zien ontbreekt gewoon. */
  app.post('/api/wereld/profiel/van', auth, async (req, res) => {
    const codenaam = String(req.body.codenaam || '').trim().slice(0, 60);
    if (!codenaam) return res.status(400).json({ error: 'Wie?' });
    let doel = null;
    try { const t = await keyVanCodenaam(codenaam); doel = t && t.key; } catch (e) { doel = null; }
    if (!doel) return res.status(404).json({ error: 'Dit lid ken ik niet.' });
    const doelTier = (gidsHaal(doel) || {}).tier || 'rtg';
    /* Het bezoek wordt genoteerd EN we zeggen het tegen de kijker. Er is geen
       sluipstand -- zie de kop van kern/wereld/bezoek.js. Dat dit in het
       antwoord staat is de handhaving van die belofte: het scherm kan het niet
       tonen als de server het niet meegeeft, en het staat er altijd. */
    const bezoekje = bezoek.noteer(req.session.key, doel);
    if (bezoekje.genoteerd) save();
    res.json({
      codenaam,
      lagen: profiel.profielVoor(req.session.key, doel, doelTier),
      bezoekGenoteerd: bezoekje.genoteerd
    });
  });

  /* ---------- de vermogens van de Lifestyle- en Business Pass ----------

     Deze drie stonden in rechten.js als NAAM zonder iets erachter, en dat is
     een belofte in tekst (LAT-regel 6). Nu doen ze wat ze beloven, achter
     dezelfde ene rechtenlijst. `eist` komt uit routes/wereld.js en staat daar
     EEN keer, zodat er niet per deelmodule een eigen poortje ontstaat. */
  // geavanceerd zoeken: vindt ALLEEN wat je mag zien (kern/wereld/netwerk.js)
  app.post('/api/wereld/zoek', auth, eist('zoeken.geavanceerd'), (req, res) => {
    const tierVan = (key) => (gidsHaal(key) || {}).tier || 'rtg';
    res.json(netwerk.zoek(req.session.key, req.body || {}, tierVan));
  });

  // wie kan mij bij deze persoon introduceren
  app.post('/api/wereld/introductie', auth, eist('netwerk.analyse'), async (req, res) => {
    const codenaam = String(req.body.codenaam || '').trim().slice(0, 60);
    if (!codenaam) return res.status(400).json({ error: 'Bij wie?' });
    let doel = null;
    try { const t = await keyVanCodenaam(codenaam); doel = t && t.key; } catch (e) { doel = null; }
    if (!doel) return res.status(404).json({ error: 'Dit lid ken ik niet.' });
    res.json({ codenaam, ...netwerk.introducties(req.session.key, doel) });
  });

  // wie bekeek mijn profiel
  app.post('/api/wereld/bezoekers', auth, eist('inzicht.profielbezoek'), (req, res) => {
    const r = bezoek.bezoekers(req.session.key);
    if (r.opgeruimd) save();          // verlopen bezoeken gaan echt weg
    res.json({ totaal: r.totaal, bezoekers: r.bezoekers });
  });

  /* De weg naar de berichten-app -- de enige plek die hem maakt.

     EN HIJ CONTROLEERT ECHT OF JE DIE PERSOON KENT. Dat stond er eerst niet in:
     de route bouwde een link uit welke codenaam je ook meestuurde, in de
     gedachte dat `/api/comm/begin` er tóch een poort voor heeft. Dat is precies
     de redenering die LAT-regel 7 afwijst -- een grendel hoort aan het doel te
     hangen, en "verderop staat er nog wel een" is geen grendel. Zonder deze
     controle kon je bovendien op codenamen aan het proberen slaan: iedereen
     kreeg een keurige link terug, ook voor iemand met wie je niets hebt.

     Nu loopt hij langs dezelfde vriendengraaf als de chat zelf, dus je krijgt
     het antwoord meteen hier in plaats van na de sprong. Zeggen dat je niet
     verbonden bent is geen lek: dat wist je al, want je typte zelf een codenaam
     die je uit je eigen feed haalde. */
  app.post('/api/wereld/gesprek', auth, async (req, res) => {
    const codenaam = String(req.body.codenaam || '').trim().slice(0, 60);
    if (!codenaam) return res.status(400).json({ error: 'Met wie?' });
    let ander = null;
    try { const t = await keyVanCodenaam(codenaam); ander = t && t.key; } catch (e) { ander = null; }
    if (!ander || ander === req.session.key || !zijnVrienden(req.session.key, ander))
      return res.status(403).json({ error: 'Je bent nog niet verbonden met ' + codenaam + '.' });
    res.json({ url: koppel.naarGesprek(codenaam, req.body.over) });
  });
};
