/* Routes "luchthaven": RTG Airport (kern/luchthaven.js).
   - Het luchthavenpersoneel (supplier LUCHT, roster-login): vluchtleiding,
     platform (de draai), toren (klaring), bagagekelder en security.
   - Leden: het vertrek/aankomstbord, een vlucht boeken, inchecken (boarding
     pass op codenaam) en de eigen boekingen met kofferstatus.
   Operationele routes achter supplierAuth + type luchthaven; ledenroutes
   achter de gewone sessie-auth. */
module.exports = (kern) => {
  const { app, auth, supplierAuth, liveCodename, lucht, gegevensStop } = kern;
  const rem = require('../rem');
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const veilig = async (res, werk) => {
    try { stuur(res, await werk()); }
    catch (e) { res.status(503).json({ error: 'De boarding-passopslag is niet beschikbaar; er is niets gewijzigd.' }); }
  };
  function poort(req, res, next) {
    if (!lucht.isLucht(req.supplier)) return res.status(403).json({ error: 'Alleen voor het luchthavenpersoneel.' });
    next();
  }
  const wie = req => (req.actor && req.actor.name) || 'operations';
  const sleutel = req => ((req.supplier && req.supplier.code) ||
    (req.session && req.session.key) || 'anoniem') + '|' + String(req.ip || '');
  const passRem = rem({ windowMs: 60000, limit: 30, key: sleutel });
  const loungeRem = rem({ windowMs: 60000, limit: 20, key: sleutel });
  const lidPassRem = rem({ windowMs: 60000, limit: 8, key: sleutel });
  function luchtzijdePoort(req, res, next) {
    const toegestaan = lucht.isLucht(req.supplier) || !!(req.supplier && req.supplier.settings && req.supplier.settings.luchtzijde === true);
    if (!toegestaan) return res.status(403).json({ error: 'Deze boarding-passcontrole is alleen beschikbaar voor de luchthaven of een expliciet toegestane luchthavenzaak.' });
    next();
  }

  /* ---- de operatie ---- */
  app.post('/api/lucht/cockpit', supplierAuth, poort, (req, res) => res.json(lucht.cockpit()));
  app.post('/api/lucht/bord', supplierAuth, poort, (req, res) => res.json(lucht.bord(req.body || {})));
  app.post('/api/lucht/vlucht/maak', supplierAuth, poort, (req, res) => stuur(res, lucht.vluchtMaak(wie(req), req.body || {})));
  app.post('/api/lucht/vlucht/status', supplierAuth, poort, async (req, res) => stuur(res, await lucht.vluchtStatus(wie(req), String(req.body.id || ''), String(req.body.status || ''))));
  app.post('/api/lucht/vlucht/vertraag', supplierAuth, poort, (req, res) => stuur(res, lucht.vluchtVertraag(wie(req), String(req.body.id || ''), req.body.minuten, req.body.reden)));
  app.post('/api/lucht/vlucht/gate', supplierAuth, poort, (req, res) => stuur(res, lucht.vluchtGate(wie(req), String(req.body.id || ''), String(req.body.gate || ''))));
  app.post('/api/lucht/draai/taak', supplierAuth, poort, (req, res) => stuur(res, lucht.draaiTaak(wie(req), String(req.body.id || ''), String(req.body.taak || ''))));
  app.post('/api/lucht/toren/klaring', supplierAuth, poort, (req, res) => stuur(res, lucht.torenKlaring(wie(req), String(req.body.id || ''), String(req.body.baan || ''))));
  app.post('/api/lucht/bagage', supplierAuth, poort, (req, res) => res.json(lucht.bagage(req.body || {})));
  app.post('/api/lucht/bagage/zet', supplierAuth, poort, (req, res) => stuur(res, lucht.bagageZet(wie(req), String(req.body.tag || ''), String(req.body.status || ''))));
  app.post('/api/lucht/security/zet', supplierAuth, poort, (req, res) => stuur(res, lucht.securityZet(wie(req), String(req.body.id || ''), req.body || {})));
  // het charterloket (privejets en helikopters): operations beslist, nooit de AI
  app.post('/api/lucht/charters', supplierAuth, poort, (req, res) => res.json(lucht.charterLijst()));
  app.post('/api/lucht/charter/beslis', supplierAuth, poort, (req, res) => stuur(res, lucht.charterBeslis(wie(req), String(req.body.id || ''), req.body.akkoord === true)));
  // de Koninklijke Vleugel: vips onder protocolnaam, met het vaste protocol
  app.post('/api/lucht/vip/lijst', supplierAuth, poort, (req, res) => res.json(lucht.vipLijst()));
  app.post('/api/lucht/vip/maak', supplierAuth, poort, (req, res) => stuur(res, lucht.vipMaak(wie(req), req.body || {})));
  app.post('/api/lucht/vip/taak', supplierAuth, poort, (req, res) => stuur(res, lucht.vipTaak(wie(req), String(req.body.id || ''), String(req.body.stap || ''))));
  // de lounges: binnen op de boarding pass; royal alleen met vip-protocol
  app.post('/api/lucht/lounge', supplierAuth, poort, (req, res) => res.json(lucht.loungeStand()));
  app.post('/api/lucht/lounge/in', supplierAuth, poort, loungeRem, (req, res) =>
    veilig(res, () => lucht.loungeIn(wie(req), String(req.body.lounge || ''), String(req.body.code || '').slice(0, 80))));
  app.post('/api/lucht/lounge/uit', supplierAuth, poort, (req, res) => stuur(res, lucht.loungeUit(wie(req), String(req.body.id || ''))));
  app.post('/api/lucht/ai', supplierAuth, poort, async (req, res) => {
    try { res.json(await lucht.luchtAI(String(req.body.vraag || ''))); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });

  /* ---- de luchtzijde-partners: elke zaak op de luchthaven ----
     De boarding pass aan de deur (de gast toont zijn code) en de vertaalknop
     van de kassa: teksten van de bon of menukaart naar elke actieve taal. */
  app.post('/api/supplier/lucht/pass', supplierAuth, luchtzijdePoort, passRem, (req, res) =>
    veilig(res, () => lucht.passCheck(String(req.body.code || '').slice(0, 80), {
      partnerCode: req.supplier.code, actor: wie(req)
    })));
  const vertaler = require('../translate');
  app.post('/api/supplier/vertaal', supplierAuth, async (req, res) => {
    try {
      const naar = kern.talen.taalVan(req.body.naar);
      const teksten = (Array.isArray(req.body.teksten) ? req.body.teksten : []).slice(0, 60).map(t => String(t || '').slice(0, 200));
      const uit = [];
      for (const t of teksten) uit.push((await vertaler.translate(t, naar)).text);
      res.json({ ok: true, naar, teksten: uit });
    } catch (e) { res.status(500).json({ error: 'Vertalen lukte even niet. Probeer het opnieuw.' }); }
  });

  /* ---- de leden: het bord, boeken, inchecken, mijn reizen ---- */
  const lid = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'Alleen voor leden.' }); return false; }
    return true;
  };
  app.post('/api/member/vluchten/bord', auth, (req, res) => res.json(lucht.bord(req.body || {})));
  app.post('/api/member/vluchten/boek', auth, async (req, res) => { if (!lid(req, res)) return; if (gegevensStop(req, res, 'vlucht')) return; stuur(res, await lucht.boek(req.session, liveCodename(req.session), String(req.body.id || ''), req.body || {})); });
  app.post('/api/member/vluchten/incheck', auth, lidPassRem, (req, res) => {
    if (!lid(req, res)) return;
    veilig(res, () => lucht.incheck(req.session, String(req.body.id || ''), req.body || {}));
  });
  app.post('/api/member/vluchten/pass/roteer', auth, lidPassRem, (req, res) => {
    if (!lid(req, res)) return;
    veilig(res, () => lucht.passRoteer(req.session, String(req.body.id || ''), req.body.rotatie));
  });
  app.post('/api/member/vluchten/pass/intrek', auth, lidPassRem, (req, res) => {
    if (!lid(req, res)) return;
    veilig(res, () => lucht.passIntrek(req.session, String(req.body.id || ''), req.body.rotatie));
  });
  app.post('/api/member/vluchten/mijn', auth, (req, res) =>
    veilig(res, () => lucht.mijnVeilig(req.session.key)));
  // een charter aanvragen (privejet of helikopter); operations bevestigt of wijst af
  app.post('/api/member/vluchten/charter', auth, (req, res) => { if (!lid(req, res)) return; if (gegevensStop(req, res, 'reservering')) return; stuur(res, lucht.charterVraag(req.session, liveCodename(req.session), req.body || {})); });
};
