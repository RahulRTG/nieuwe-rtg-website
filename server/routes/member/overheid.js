/* Domein "member", deelmodule overheid: het MijnOverheid-loket van De Overheid
   (kern/overheid.js). De landelijke laag naast de gemeente: Berichtenbox,
   aangifte inkomstenbelasting + toeslagen, voertuigregister & rijbewijs (RDW),
   het ondernemersloket (KVK), sociale zekerheid (UWV/SVB), stemmen en
   rijksbekendmakingen. Alleen routes; de logica woont in kern/overheid.js.
   Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, liveCodename, overheid } = kern;
  const lid = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'Alleen voor leden.' }); return false; }
    return true;
  };
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  // pijler 1: Berichtenbox
  app.post('/api/overheid/berichten', auth, (req, res) => res.json(overheid.berichten(req.session.key)));
  app.post('/api/overheid/bericht/gelezen', auth, (req, res) => stuur(res, overheid.berichtGelezen(req.session.key, String(req.body.id || ''))));

  // pijler 2: Belastingdienst
  app.post('/api/overheid/belasting/bereken', auth, (req, res) => res.json({ ok: true, uitkomst: overheid.berekenIB(req.body.inkomen, req.body.aftrek, req.body.ingehouden) }));
  app.post('/api/overheid/aangifte', auth, (req, res) => { if (!lid(req, res)) return; stuur(res, overheid.aangifteDoe(req.session, liveCodename(req.session), req.body || {})); });
  app.post('/api/overheid/aanslagen/mijn', auth, (req, res) => res.json(overheid.mijnAanslagen(req.session.key)));
  // een aanslag betalen loopt via de geld-drempel van de AI (pad bevat "betaal")
  app.post('/api/overheid/aanslag/betaal', auth, (req, res) => { if (!lid(req, res)) return; stuur(res, overheid.aanslagBetaal(req.session.key, String(req.body.ref || ''))); });
  app.post('/api/overheid/toeslag', auth, (req, res) => { if (!lid(req, res)) return; stuur(res, overheid.toeslagAanvraag(req.session, liveCodename(req.session), req.body || {})); });
  app.post('/api/overheid/toeslagen/mijn', auth, (req, res) => res.json(overheid.mijnToeslagen(req.session.key)));
  app.post('/api/overheid/aangifte/advies', auth, async (req, res) => {
    try { res.json(await overheid.aangifteAdvies(String(req.body.tekst || ''))); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis.' }); }
  });

  // pijler 3: RDW (voertuig & rijbewijs)
  app.post('/api/overheid/voertuigen', auth, (req, res) => res.json(overheid.voertuigen(req.session.key)));
  app.post('/api/overheid/voertuig/meld', auth, (req, res) => { if (!lid(req, res)) return; stuur(res, overheid.voertuigMeld(req.session, req.body || {})); });
  app.post('/api/overheid/voertuig/schors', auth, (req, res) => { if (!lid(req, res)) return; stuur(res, overheid.voertuigSchors(req.session.key, String(req.body.id || ''), req.body.schors !== false)); });
  app.post('/api/overheid/rijbewijs', auth, (req, res) => res.json(overheid.rijbewijs(req.session.key)));
  app.post('/api/overheid/rijbewijs/verleng', auth, (req, res) => { if (!lid(req, res)) return; stuur(res, overheid.rijbewijsVerleng(req.session.key)); });
  // RDW-kentekencheck (dezelfde seam die autoverhuur en RTG OV kunnen aanroepen)
  app.post('/api/overheid/rdw/check', auth, (req, res) => stuur(res, overheid.rdwCheck(String(req.body.kenteken || ''))));

  // pijler 4: KVK ondernemersloket (een lid kan een eenmanszaak inschrijven)
  app.post('/api/overheid/kvk/inschrijven', auth, (req, res) => { if (!lid(req, res)) return; stuur(res, overheid.kvkInschrijven({ key: req.session.key, codenaam: liveCodename(req.session) }, req.body || {})); });
  app.post('/api/overheid/kvk/mijn', auth, (req, res) => res.json(overheid.kvkMijn({ key: req.session.key })));

  // pijler 5: sociale zekerheid (UWV/SVB)
  app.post('/api/overheid/uitkering', auth, (req, res) => { if (!lid(req, res)) return; stuur(res, overheid.uitkeringAanvraag(req.session, liveCodename(req.session), req.body || {})); });
  app.post('/api/overheid/uitkeringen/mijn', auth, (req, res) => res.json(overheid.mijnUitkeringen(req.session.key)));

  // pijler 6: verkiezing/referendum, bezwaar & bekendmakingen
  app.post('/api/overheid/verkiezing', auth, (req, res) => res.json(overheid.verkiezing(req.session.key)));
  app.post('/api/overheid/stem', auth, (req, res) => { if (!lid(req, res)) return; stuur(res, overheid.stem(req.session.key, String(req.body.keuze || ''))); });
  app.post('/api/overheid/bekendmakingen', auth, (req, res) => res.json(overheid.bekendmakingen()));
  app.post('/api/overheid/bezwaar', auth, (req, res) => { if (!lid(req, res)) return; stuur(res, overheid.bezwaarIndienen(req.session, liveCodename(req.session), req.body || {})); });
  app.post('/api/overheid/bezwaren/mijn', auth, (req, res) => res.json(overheid.mijnBezwaren(req.session.key)));
  // de rechtbank: tegen een ongegrond bezwaar zelf in beroep, en de eigen zaken volgen
  app.post('/api/overheid/beroep', auth, (req, res) => { if (!lid(req, res)) return; stuur(res, overheid.beroepIndienen(req.session, String(req.body.ref || ''))); });
  app.post('/api/overheid/zaken/mijn', auth, (req, res) => res.json(overheid.mijnZaken(req.session.key)));

  // pijler 7: provincie (subsidies)
  app.post('/api/overheid/subsidies', auth, (req, res) => res.json(overheid.provincieSubsidies()));
  app.post('/api/overheid/subsidie', auth, (req, res) => { if (!lid(req, res)) return; stuur(res, overheid.subsidieAanvraag({ key: req.session.key, codenaam: liveCodename(req.session) }, req.body || {})); });
  app.post('/api/overheid/subsidies/mijn', auth, (req, res) => res.json(overheid.mijnSubsidies({ key: req.session.key })));

  // pijler 8: waterschap (belasting + meldingen)
  app.post('/api/overheid/waterschap/mijn', auth, (req, res) => res.json(overheid.waterschapMijn(req.session.key)));
  // een waterschapsaanslag betalen loopt via de geld-drempel van de AI (pad bevat "betaal")
  app.post('/api/overheid/waterschap/betaal', auth, (req, res) => { if (!lid(req, res)) return; stuur(res, overheid.waterschapBetaal(req.session.key, String(req.body.ref || ''))); });
  app.post('/api/overheid/water/meld', auth, (req, res) => { if (!lid(req, res)) return; stuur(res, overheid.waterMeld(req.session, liveCodename(req.session), req.body || {})); });
  app.post('/api/overheid/water/meldingen/mijn', auth, (req, res) => res.json(overheid.mijnWaterMeldingen(req.session.key)));
};
