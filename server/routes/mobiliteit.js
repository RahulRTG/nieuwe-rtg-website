/* Domein "mobiliteit": het Mobility OS. Vier ingangen op een kern:

     /api/mob/...           de reiziger (leden-inlog)
     /api/staff/mob/...     de chauffeur/bemanning (PDA-inlog)
     /api/supplier/mob/...  de vervoerder en de dispatcher (zaak-inlog)
     /api/office/mob/...    RTG zelf: het moduleregister en de storingsknop

   Vier ingangen, EEN motor. Elke statusovergang loopt via dezelfde functie
   (kern/mobiliteit/voortgang.js), of hij nu door een chauffeur op de PDA, een
   dispatcher achter een scherm of een reiziger in de app in gang wordt gezet.
   Een tweede weg om een rit op 'voltooid' te zetten zou de keten precies zo
   lang laten kloppen als de discipline van de volgende route.

   WIE WAT MAG staat hier en niet in de kern: de kern rekent, de route bewaakt.
   De reiziger komt alleen bij zijn eigen ritten, de chauffeur alleen bij de rit
   van zijn eigen zaak, de dispatcher alleen bij zijn eigen vervoerder, en het
   moduleregister alleen achter de kantoordeur.

   Dit bestand draagt de REIZIGER en de CHAUFFEUR; de vervoerder, de dispatcher
   en RTG zelf staan in ./mobiliteit/werkkant.js, onderaan gemount op dezelfde
   kern. Die knip zit er om de omvangregel, en de naad valt waar hij hoort:
   boven wie een rit vraagt, onder wie hem uitvoert. */
module.exports = (kern) => {
  const { app, auth, supplierAuth, accounts, schoon, gegevensStop,
    mobAanbod, mobMijn, mobVraag, mobAnnuleer,
    plekLijst, favZet, favLijst,
    opdrachtMet, opdrachtBeeld, opdrachtNaar, opdrachtPositie,
    dispatchBeeld, pendelReserveer, pendelVoorMedewerker,
    beleidLees, besteedDezeMaand } = kern;

  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error, ...r }) : res.json(r);
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'RTG Vervoer is voor leden.' }); return true; }
    return false;
  };
  // waar staat deze reiziger, voor het moduleregister
  const waarVan = req => ({ stad: schoon(req.body.stad, 40) || null, land: schoon(req.body.land, 2) || null,
    groep: req.session.tier, key: req.session.key });

  /* ---------------- de reiziger ---------------- */
  app.post('/api/mob/aanbod', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, mobAanbod(waarVan(req)));
  });
  app.post('/api/mob/plekken', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, plekLijst(req.body.bij, req.session, req.body || {}));
  });
  /* De gegevenspoort staat hier en niet lager: er komt een chauffeur van een
     ANDER bedrijf naar je toe, en die moet je kunnen bereiken als hij je niet
     vindt. Dezelfde poort als bij een tafel of een charter ('reservering'
     vraagt om een telefoonnummer). */
  app.post('/api/mob/vraag', auth, (req, res) => {
    if (geenGast(req, res)) return;
    if (gegevensStop(req, res, 'reservering')) return;
    stuur(res, mobVraag(req.session, req.body || {}));
  });
  app.post('/api/mob/mijn', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, mobMijn(req.session));
  });
  app.post('/api/mob/annuleer', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, mobAnnuleer(req.session, req.body || {}));
  });
  app.post('/api/mob/favoriet', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, req.body && req.body.lijst ? favLijst(req.session) : favZet(req.session, req.body || {}));
  });

  /* Het volgspoor van je eigen rit. Bewust een eigen route en niet een veld in
     /mijn: de app vraagt dit elke paar seconden op tijdens een rit, en dan wil
     je niet elke keer de hele geschiedenis en de favorieten meesturen. */
  app.post('/api/mob/volg', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const o = opdrachtMet(schoon(req.body.ref, 30));
    if (!o) return res.status(404).json({ error: 'Opdracht niet gevonden.' });
    if (o.reiziger !== req.session.key) return res.status(403).json({ error: 'Dit is uw rit niet.' });
    res.json({ ok: true, opdracht: opdrachtBeeld(o, true), positie: o.positie || null });
  });

  /* De pendel van je werkgever. Wie hier binnenkomt moet er ECHT werken: de
     personeelskoppeling wordt op het moment zelf nagevraagd, niet uit iets wat
     de app meestuurt. Zonder die controle kan elk lid met een bedrijfscode de
     dienstregeling en de bezetting van een vreemd bedrijf lezen. */
  const werktDaar = (req, res) => {
    const code = schoon(req.body.werkgever, 20);
    if (!code) { res.status(400).json({ error: 'Geef de code van uw werkgever op.' }); return null; }
    const lidId = Number(String(req.session.key || '').replace('user-', ''));
    let posities = [];
    try { posities = accounts.staffPositions(lidId) || []; } catch (e) { posities = []; }
    if (!posities.some(p => String(p.supplier_code).toUpperCase() === code.toUpperCase())) {
      res.status(403).json({ error: 'U staat niet als medewerker bij dit bedrijf.' });
      return null;
    }
    return code.toUpperCase();
  };
  app.post('/api/mob/pendel', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const code = werktDaar(req, res); if (!code) return;
    stuur(res, pendelVoorMedewerker(code, req.session, req.body.datum));
  });
  app.post('/api/mob/pendel/reserveer', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const code = werktDaar(req, res); if (!code) return;
    stuur(res, pendelReserveer(req.session, req.body || {}));
  });

  /* Het reisbeleid van je werkgever, met wat je deze maand al hebt besteed.
     Bewust VOOR het boeken op te vragen: een medewerker die pas bij het
     afwijzen hoort dat hij over zijn budget is, heeft al een rit gepland die
     niet doorgaat. Dezelfde dienstverbandcontrole als de pendel. */
  app.post('/api/mob/beleid', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const code = werktDaar(req, res); if (!code) return;
    const r = beleidLees(code);
    stuur(res, Object.assign({}, r, { werkgever: code, besteed: besteedDezeMaand(code, req.session.key) }));
  });

  /* ---------------- de chauffeur en de bemanning (PDA) ---------------- */
  /* Een chauffeur zet de status van een rit van ZIJN zaak. De eigendomstoets
     staat hier omdat de kern geen sessies kent; zonder hem zet een chauffeur
     van bedrijf A de rit van bedrijf B op no-show. */
  const ritVanZaak = (req, res) => {
    const o = opdrachtMet(schoon(req.body.ref, 30));
    if (!o) { res.status(404).json({ error: 'Opdracht niet gevonden.' }); return null; }
    if (o.vervoerder !== req.supplier.code) { res.status(403).json({ error: 'Deze rit hoort bij een andere vervoerder.' }); return null; }
    return o;
  };
  app.post('/api/staff/mob/status', supplierAuth, (req, res) => {
    const o = ritVanZaak(req, res); if (!o) return;
    stuur(res, opdrachtNaar(o.ref, schoon(req.body.status, 30), 'chauffeur', { reden: req.body.reden }));
  });
  app.post('/api/staff/mob/positie', supplierAuth, (req, res) => {
    const o = ritVanZaak(req, res); if (!o) return;
    stuur(res, opdrachtPositie(o.ref, { lat: req.body.lat, lng: req.body.lng }, 'chauffeur'));
  });
  app.post('/api/staff/mob/mijn', supplierAuth, (req, res) => {
    stuur(res, dispatchBeeld(req.supplier.code, { vervoerder: req.supplier.code }));
  });
  /* De werkkant (vervoerder, dispatcher, RTG) staat in ./mobiliteit/werkkant.js
     en krijgt dezelfde kern plus het gedeelde `stuur`-hulpje. Gesplitst om de
     omvangregel, niet om de samenhang: het is een motor. */
  require('./mobiliteit/werkkant')(kern, { stuur });
  /* De kaartverkoop en de CDT staan in ./mobiliteit/vervoerbewijs.js. Ze horen
     bij dezelfde motor maar hebben allebei een grond BUITEN de code: een
     overeenkomst met de vervoerder, en de Nederlandse taxiwet. */
  require('./mobiliteit/vervoerbewijs')(kern, { stuur });
};
