/* Domein "verzorging": de beauty-salon en barbier, petcare en de
   kinderopvang met nanny-service, elk achter een eigen cap ('beauty',
   'petcare', 'opvang'); de kern in server/kern/verzorging.js.

   Onderaan staat de LEDENkant van de salon: dezelfde agenda, maar dan van de
   kant van wie er een afspraak maakt, op codenaam. */
module.exports = (kern) => {
  const { app, db, auth, liveCodename, supplierAuth, beauty, petcare, opvang, verzorgingLeden,
    opvangwijzer, gegevensStop } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };
  const maak = (basis, capNaam, domein) => (pad, fn) => app.post(basis + pad, supplierAuth, (req, res) => {
    const caps = db.capsVan(req.supplier);
    if (!caps.includes(capNaam)) { res.status(403).json({ error: 'Deze zaak is geen ' + domein + '.' }); return; }
    stuur(res, fn(req.supplier.code, req.body || {}));
  });

  const b = maak('/api/supplier/beauty', 'beauty', 'beauty-salon');
  b('', (code) => beauty.overzicht(code));
  b('/boek', (code, x) => beauty.boek(code, x));
  b('/status', (code, x) => beauty.afspraakStatus(code, x.id, x.status));
  b('/uren', (code, x) => beauty.uren(code, x));
  b('/walkin', (code, x) => beauty.walkIn(code, x));
  b('/walkin/status', (code, x) => beauty.walkStatus(code, x.id, x.status));

  const p = maak('/api/supplier/petcare', 'petcare', 'petcare-bedrijf');
  p('', (code) => petcare.overzicht(code));
  p('/checkin', (code, x) => petcare.checkIn(code, x));
  p('/checkuit', (code, x) => petcare.checkUit(code, x.id));
  p('/notitie', (code, x) => petcare.notitie(code, x.id, x.tekst));
  p('/ronde', (code, x) => petcare.rondeMaak(code, x.tijd));
  p('/ronde/hond', (code, x) => petcare.rondeHond(code, x.id, x.naam));
  p('/ronde/klaar', (code, x) => petcare.rondeKlaar(code, x.id));
  p('/trim', (code, x) => petcare.trimBoek(code, x));
  p('/trim/klaar', (code, x) => petcare.trimKlaar(code, x.id));

  const o = maak('/api/supplier/opvang', 'opvang', 'kinderopvang');
  o('', (code) => opvang.overzicht(code));
  o('/kind', (code, x) => opvang.kindMeld(code, x));
  o('/kind/ophaal', (code, x) => opvang.kindOphaal(code, x));
  o('/nanny', (code, x) => opvang.nannyVraag(code, x));
  o('/nanny/zet', (code, x) => opvang.nannyZet(code, x));
  o('/verslag', (code, x) => opvang.verslagMaak(code, x));

  /* ---- de ledenkant van de salon (cosmetisch, niet-medisch) ----
     Geen zorgprofiel en geen intake: die horen bij Care en een kapper heeft ze
     niet nodig. Alleen leden; een gast krijgt 403 uit de kern. */
  /* Voluit, niet opgebouwd: de schakelkast telt letterlijke paden (scripts/
     check.js regel 45), en vier routes zijn het uitschrijven waard. */
  const lidRoute = (fn) => (req, res) =>
    stuur(res, fn(req.session, liveCodename(req.session), req.body || {}));

  app.post('/api/verzorging', auth, lidRoute((sess, naam, x) => verzorgingLeden.overzicht(naam, x.datum)));
  /* Boeken deelt je codenaam en wens met de zaak: langs de gegevenspoort, net
     als elke andere bestelling. Dit gat werd pas zichtbaar toen de paden
     voluit kwamen te staan -- de opgebouwde vorm was ook voor regel 16
     onzichtbaar geweest. */
  app.post('/api/verzorging/boek', auth, (req, res) => {
    if (gegevensStop(req, res, 'bestelling')) return;
    lidRoute((sess, naam, x) => verzorgingLeden.boek(sess, naam, x))(req, res);
  });
  app.post('/api/verzorging/mijn', auth, lidRoute((sess, naam) => verzorgingLeden.mijn(naam)));
  app.post('/api/verzorging/annuleer', auth, lidRoute((sess, naam, x) => verzorgingLeden.annuleer(naam, x.code, x.id)));

  /* ---- de OUDERkant van de kinderopvang ----
     Kinderopvang bestond hier alleen aan de kant van de opvang; een ouder kon
     er niet bij (HDI.md par. 7.10). Dezelfde vorm als de salon hierboven:
     voluit uitgeschreven paden, op codenaam, en het klaarzetten gaat langs de
     gegevenspoort omdat het uw codenaam en uw wens met de zaak deelt.

     Er is met opzet GEEN route die een kind inschrijft. Dat is de handeling
     waarmee een kind ergens staat, en die hoort een mens te doen die het kind
     heeft gezien (opvang.kindMeld, en die blijft achter supplierAuth). */
  app.post('/api/opvang', auth, lidRoute((sess, naam) => opvangwijzer.overzicht(naam)));
  app.post('/api/opvang/vraag', auth, (req, res) => {
    if (gegevensStop(req, res, 'bestelling')) return;
    lidRoute((sess, naam, x) => opvangwijzer.vraag(sess, naam, x))(req, res);
  });
  app.post('/api/opvang/mijn', auth, lidRoute((sess, naam) => opvangwijzer.mijn(naam)));
  app.post('/api/opvang/weg', auth, lidRoute((sess, naam, x) => opvangwijzer.weg(naam, x.code, x.id)));
};
