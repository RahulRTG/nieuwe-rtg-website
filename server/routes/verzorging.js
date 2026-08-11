/* Domein "verzorging": de beauty-salon en barbier, petcare en de
   kinderopvang met nanny-service, elk achter een eigen cap ('beauty',
   'petcare', 'opvang'); de kern in server/kern/verzorging.js.

   Onderaan staat de LEDENkant van de salon: dezelfde agenda, maar dan van de
   kant van wie er een afspraak maakt, op codenaam.

   ELK PAD STAAT VOLUIT, LETTERLIJK BIJ DE app.post ZELF (scripts/check.js
   regel 45). Dat was hier niet zo: de paden werden gebouwd uit een basis plus
   een staart, en dan ziet scripts/schakelbaar.js er geen enkele van --
   vijfentwintig routes waren zo niet uit te zetten vanuit de boardroom en niet
   per stad te sluiten.

   Een hulpje dat het pad DOORKRIJGT is trouwens niet genoeg, en dat heeft die
   regel me hier verteld: de census leest de bron op de plek van de app.post, en
   `app.post(pad, ...)` is daar even onleesbaar als een som. Wat wel mag
   rondgaan is de POORT, want die staat als naam in de regel en is voor een
   lezer en voor regel 28 gewoon zichtbaar. */
module.exports = (kern) => {
  const { app, db, auth, gegevensStop, liveCodename, supplierAuth, beauty, petcare, opvang, verzorgingLeden } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };

  /* De cap-poort als middleware, een keer per soort zaak. Zo staat bij elke
     route zichtbaar welke twee deuren hij heeft: supplierAuth (wie bent u) en
     de cap (mag deze zaak dit uberhaupt). */
  const cap = (capNaam, domein) => (req, res, next) => {
    if (!db.capsVan(req.supplier).includes(capNaam)) {
      return res.status(403).json({ error: 'Deze zaak is geen ' + domein + '.' });
    }
    next();
  };
  const capBeauty = cap('beauty', 'beauty-salon');
  const capPet = cap('petcare', 'petcare-bedrijf');
  const capOpvang = cap('opvang', 'kinderopvang');
  const zaak = (fn) => (req, res) => stuur(res, fn(req.supplier.code, req.body || {}));

  app.post('/api/supplier/beauty', supplierAuth, capBeauty, zaak((code) => beauty.overzicht(code)));
  app.post('/api/supplier/beauty/boek', supplierAuth, capBeauty, zaak((code, x) => beauty.boek(code, x)));
  app.post('/api/supplier/beauty/status', supplierAuth, capBeauty, zaak((code, x) => beauty.afspraakStatus(code, x.id, x.status)));
  app.post('/api/supplier/beauty/uren', supplierAuth, capBeauty, zaak((code, x) => beauty.uren(code, x)));
  app.post('/api/supplier/beauty/walkin', supplierAuth, capBeauty, zaak((code, x) => beauty.walkIn(code, x)));
  app.post('/api/supplier/beauty/walkin/status', supplierAuth, capBeauty, zaak((code, x) => beauty.walkStatus(code, x.id, x.status)));

  app.post('/api/supplier/petcare', supplierAuth, capPet, zaak((code) => petcare.overzicht(code)));
  app.post('/api/supplier/petcare/checkin', supplierAuth, capPet, zaak((code, x) => petcare.checkIn(code, x)));
  app.post('/api/supplier/petcare/checkuit', supplierAuth, capPet, zaak((code, x) => petcare.checkUit(code, x.id)));
  app.post('/api/supplier/petcare/notitie', supplierAuth, capPet, zaak((code, x) => petcare.notitie(code, x.id, x.tekst)));
  app.post('/api/supplier/petcare/ronde', supplierAuth, capPet, zaak((code, x) => petcare.rondeMaak(code, x.tijd)));
  app.post('/api/supplier/petcare/ronde/hond', supplierAuth, capPet, zaak((code, x) => petcare.rondeHond(code, x.id, x.naam)));
  app.post('/api/supplier/petcare/ronde/klaar', supplierAuth, capPet, zaak((code, x) => petcare.rondeKlaar(code, x.id)));
  app.post('/api/supplier/petcare/trim', supplierAuth, capPet, zaak((code, x) => petcare.trimBoek(code, x)));
  app.post('/api/supplier/petcare/trim/klaar', supplierAuth, capPet, zaak((code, x) => petcare.trimKlaar(code, x.id)));

  app.post('/api/supplier/opvang', supplierAuth, capOpvang, zaak((code) => opvang.overzicht(code)));
  app.post('/api/supplier/opvang/kind', supplierAuth, capOpvang, zaak((code, x) => opvang.kindMeld(code, x)));
  app.post('/api/supplier/opvang/kind/ophaal', supplierAuth, capOpvang, zaak((code, x) => opvang.kindOphaal(code, x)));
  app.post('/api/supplier/opvang/nanny', supplierAuth, capOpvang, zaak((code, x) => opvang.nannyVraag(code, x)));
  app.post('/api/supplier/opvang/nanny/zet', supplierAuth, capOpvang, zaak((code, x) => opvang.nannyZet(code, x)));
  app.post('/api/supplier/opvang/verslag', supplierAuth, capOpvang, zaak((code, x) => opvang.verslagMaak(code, x)));

  /* ---- de ledenkant van de salon (cosmetisch, niet-medisch) ----
     Geen zorgprofiel en geen intake: die horen bij Care en een kapper heeft ze
     niet nodig. Alleen leden; een gast krijgt 403 uit de kern. */
  const lid = (fn) => (req, res) => stuur(res, fn(req.session, liveCodename(req.session), req.body || {}));

  app.post('/api/verzorging', auth, lid((sess, naam, x) => verzorgingLeden.overzicht(naam, x.datum)));
  /* De gegevenspoort hoort HIER en nergens anders in dit bestand: boeken is de
     enige handeling waarbij er iets van het lid bij een derde belandt (de salon
     krijgt de codenaam, de behandeling en het tijdstip -- geen echte naam en
     geen zorgprofiel, zie kern/verzorging/beautyleden.js). Kijken doet dat niet
     en annuleren evenmin, dus daar zou een poort alleen maar wennen aan een
     vraag die niets betekent.

     Hij ontbrak, en dat was niet zichtbaar: zolang de paden hier werden
     opgebouwd zag scripts/check.js regel 16 deze route helemaal niet. Hij kwam
     tevoorschijn zodra de paden voluit kwamen te staan -- dezelfde volgorde als
     bij regel 28 eerder in deze tak. Meten maakt zichtbaar; zichtbaar maakt
     repareerbaar. */
  app.post('/api/verzorging/boek', auth, (req, res) => {
    if (gegevensStop(req, res, 'bestelling')) return;
    stuur(res, verzorgingLeden.boek(req.session, liveCodename(req.session), req.body || {}));
  });
  app.post('/api/verzorging/mijn', auth, lid((sess, naam) => verzorgingLeden.mijn(naam)));
  app.post('/api/verzorging/annuleer', auth, lid((sess, naam, x) => verzorgingLeden.annuleer(naam, x.code, x.id)));
};
