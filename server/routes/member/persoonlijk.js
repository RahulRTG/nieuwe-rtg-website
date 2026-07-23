/* Domein "member", deelmodule persoonlijk: alles wat van het lid zelf is.
   Het zorgprofiel en locatie-delen (kern/gastzorg.js), Rahul
   (kern/fluister.js) en de Shared Assets (kern/assets.js). Alleen routes;
   de logica woont in de kern-modules. */
module.exports = (kern) => {
  const { app, auth, liveCodename, verdienPunten, pestgrens,
    zorgVan, zorgZet, locDeel, locStopKlant, locMijn,
    fluisterZeg, fluisterPush, fluisterProfiel, fluisterOnthoud, fluisterVergeet, fluisterFocus, stuurLus,
    sparLijst, sparParkeer, sparStatus,
    assetsOverzicht, assetDocument, assetKoop, assetHerroep, assetWachtlijstZet, assetMijn, assetGebruik, assetUitstap } = kern;

/* ---- de zorgvolle keten (kern/gastzorg.js) ----
   Het zorgprofiel: allergenen, dieet en medische aandachtspunten. Reist
   alleen mee met bestellingen en verblijven als het lid delen aanzet. */
app.post('/api/zorgprofiel', auth, (req, res) => res.json({ ok: true, zorg: zorgVan(req.session.key) }));
app.post('/api/zorgprofiel/zet', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  res.json(zorgZet(req.session.key, req.body));
});
/* Live meekijken met toestemming: het lid wijst een zaak aan; die ziet de
   gps-positie tot de zaak (of het lid zelf) het delen stopzet. */
app.post('/api/locatie/deel', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const r = locDeel(req.session.key, liveCodename(req.session), req.body.supplierCode);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/locatie/stop', auth, (req, res) => {
  const r = locStopKlant(req.session.key, String(req.body.id || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/locatie/mijn', auth, (req, res) => res.json(locMijn(req.session.key)));

/* ---- Fluister: de persoonlijke assistent met geheugen (kern/fluister.js).
   Voor iedereen, over de eigen gegevens; alles is opvraagbaar en wisbaar. */
app.post('/api/fluister', auth, async (req, res) => {
  /* De pestgrens staat VOOR alles: drie waarschuwingen bij pesten, dan een
     vurig slotantwoord en 24 uur weg; daarna opent alleen een excuus de
     deur weer (kern/pestgrens.js). Neemt de poort het gesprek over, dan
     komt er geen gewone AI-beurt en ook geen stuur-lus. */
  const grens = pestgrens.poort(req.session.key, req.body.q);
  if (grens) return res.json({ antwoord: grens.antwoord, pestgrens: true, weg: !!grens.weg });
  // de sessie reist mee zodat Fluister ook kan doen (reserveren, 24 uur plannen)
  const r = await fluisterZeg(req.session.key, liveCodename(req.session), req.body.q, req.session);
  if (r.error) return res.status(r.status).json({ error: r.error });
  /* Rahul aan het stuur: pakten de eigen regels het gesprek NIET op
     (pakte=false), dan mag hij het met het AI-stuur alsnog echt DOEN;
     alles wat het lid zelf kan, met de eigen inlog en de geld-drempel.
     Zonder AI-sleutel bestaat stuurLus niet en blijft alles zoals het was. */
  if (stuurLus && !r.pakte) {
    const lus = await stuurLus(req, {
      vraag: req.body.q,
      // alles wat het lid zelf mag: de hele leden-app EN de RTFoundation
      // (gezin/kinderen). Alleen de zakelijke werk-apps van andere rollen
      // (leverancier/personeel/kantoor/partner) blijven buiten bereik; de
      // API zelf bewaakt verder wie waar recht op heeft (bv. ouder-goedkeuring).
      filter: p => !['/api/supplier', '/api/staff', '/api/office', '/api/partner'].some(w => p.startsWith(w)),
      systeem: require('../../kern/rahul').RAHUL_LEAD +
        'Je helpt een RTG-lid (codenaam ' + liveCodename(req.session) + ', pas: ' + (req.session.tier || 'rtg') + ') in de leden-app. ' +
        'Je regelt niet alleen reizen, bestellen, betalen en de Salon, maar ook de RTFoundation voor het gezin (bijvoorbeeld het babyboek, school, toetsen of het zakgeldpotje) als het lid daar recht op heeft.'
    });
    if (lus && lus.tekst) return res.json({ antwoord: lus.tekst, gedaan: lus.acties.some(a => a.status < 400), stuur: lus.acties });
  }
  res.json(r);
});
app.post('/api/fluister/profiel', auth, (req, res) => {
  // nieuwe seintjes worden meteen ook een melding op het toestel (met dedupe)
  fluisterPush(req.session.key);
  const p = fluisterProfiel(req.session.key);
  // de voorspeller en Balans fluisteren stil mee: alleen een rijpe gewoonte
  // of een echt volle week wordt een seintje in "Rahul ziet", nooit een
  // melding op het toestel
  const vs = kern.voorspel && kern.voorspel.seintjeVoor(kern.voorspel.voorLid(liveCodename(req.session), req.session.key));
  const bs = kern.balans && kern.balans.seintjeVoorBalans(kern.balans.balansVoorLid(liveCodename(req.session), req.session.key));
  p.seintjes = [vs, bs].filter(Boolean).concat(p.seintjes || []).slice(0, 5);
  res.json(p);
});
app.post('/api/fluister/onthoud', auth, (req, res) => {
  const r = fluisterOnthoud(req.session.key, req.body.tekst);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/fluister/vergeet', auth, (req, res) => {
  const r = fluisterVergeet(req.session.key, req.body.wat);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
// de inklap-laag deelt (alleen) tellers van schermgebruik, zodat Fluister leert
app.post('/api/fluister/focus', auth, (req, res) => res.json(fluisterFocus(req.session.key, req.body.scores)));

/* ---- Sparren (kern/fluister/sparren.js): Rahul denkt mee om het idee beter te
   maken, en parkeert een gedachte die je noemt op een druk moment. Op een
   rustig moment (thuis, lege agenda) kaart hij hem uit zichzelf weer aan. */
app.post('/api/spar/lijst', auth, (req, res) => res.json(sparLijst(req.session.key)));
app.post('/api/spar/parkeer', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const r = sparParkeer(req.session.key, req.body.tekst, 'app');
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/spar/status', auth, (req, res) => {
  const st = req.body.status === 'weg' ? 'weg' : 'besproken';
  const r = sparStatus(req.session.key, String(req.body.id || ''), st);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});

/* ---- Toren 3: RTG Shared Assets (kern/assets.js) ----
   Altijd 300 tickets per object; een ticket is 24 uur per jaar, tien jaar
   lang. Access loopt af, Asset heeft restwaarde en stapt uit via een Tik. */
app.post('/api/assets', auth, (req, res) => res.json(assetsOverzicht(req.session.key)));
// het essentiele-informatiedocument: lezen voordat er iets wordt afgerekend
app.post('/api/asset/document', auth, (req, res) => {
  const r = assetDocument(req.body.assetId);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/asset/koop', auth, (req, res) => {
  const r = assetKoop(req.session, liveCodename(req.session), req.body.assetId, req.body.smaak, req.body.aantal, req.body.akkoord === true);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
// veertien dagen bedenktijd: volledige terugbetaling, voor beide smaken
app.post('/api/asset/herroep', auth, async (req, res) => {
  const r = await assetHerroep(req.session, liveCodename(req.session), req.body.ticketId);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/asset/wachtlijst', auth, (req, res) => {
  const r = assetWachtlijstZet(req.session, liveCodename(req.session), req.body.assetId);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/asset/mijn', auth, (req, res) => res.json(assetMijn(req.session.key)));
app.post('/api/asset/gebruik', auth, (req, res) => {
  const r = assetGebruik(req.session, req.body.assetId, req.body.datum);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/asset/uitstap', auth, async (req, res) => {
  const r = await assetUitstap(req.session, liveCodename(req.session), req.body.ticketId);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});

// Toren 4, RTG Care (zorg & welzijn) staat apart, in ./persoonlijk-care.js
require('./persoonlijk-care')(kern);
};
