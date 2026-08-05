/* Horeca OS (deellaag): de rekening zelf -- openen, regels erop zetten,
   gangen aansturen en het overzicht van wat er openstaat.

   De rekening is het hart van een horecasysteem en niet de bon: hij gaat open
   als de gasten aanschuiven en blijft leven tot er betaald is. Drie dingen die
   hier bewust zo zijn:

   - EEN REGEL DRAAGT ZIJN EIGEN PRIJS. De prijs wordt vastgelegd op het moment
     van bestellen, inclusief een eventuele happy hour. Verandert de kaart
     daarna, dan verandert de rekening van deze gast niet. Dat is geen detail:
     een biertje dat na het bestellen duurder wordt, is precies waar ruzie aan
     de bar over ontstaat.
   - ALLERGIE IS GEEN NOTITIE. Een allergie staat in een eigen veld en gaat
     ongefilterd mee naar de keuken. In een vrij notitieveld verdwijnt hij
     tussen "zonder ui" en "extra krokant".
   - DE GANG IS EEN EIGENSCHAP VAN DE REGEL, niet van de bon. Alleen zo kan de
     keuken alle hoofdgerechten van tafel 24 tegelijk uitgeven terwijl het
     voorgerecht al weg is. */
module.exports = (kern) => {
  const { app, save, schoon, supplierAuth, logActivity, sseToSupplier, horeca } = kern;
  const { KANALEN, H, nu, id, uitEuro, totaal, openstaand, happyKorting } = horeca;

  const rekVan = (req, res) => {
    const h = H(req.supplier.code);
    const r = Object.prototype.hasOwnProperty.call(h.rekeningen, String(req.body.rekeningId || ''))
      ? h.rekeningen[String(req.body.rekeningId)] : null;
    if (!r) { res.status(404).json({ error: 'Deze rekening kennen we niet.' }); return null; }
    return r;
  };
  const publiek = (r) => Object.assign({}, r, { totalen: totaal(r), openstaand: openstaand(r) });
  kern.horecaRekVan = rekVan;
  kern.horecaPubliek = publiek;

  /* ---------- openen ---------- */
  app.post('/api/supplier/horeca/rekening/open', supplierAuth, (req, res) => {
    const kanaal = String(req.body.kanaal || 'tafel');
    if (!KANALEN.includes(kanaal)) return res.status(400).json({ error: 'Onbekend verkoopkanaal. Kies uit: ' + KANALEN.join(', ') + '.' });
    const h = H(req.supplier.code);
    const tafel = schoon(req.body.tafel, 30) || null;
    // een tafel heeft er hooguit een open: anders staan er twee rekeningen op
    // tafel 12 en betaalt de ene tafel de bestelling van de andere
    if (kanaal === 'tafel' && tafel) {
      const bestaand = Object.values(h.rekeningen).find(r => r.status === 'open' && r.kanaal === 'tafel' && r.tafel === tafel);
      if (bestaand) return res.status(409).json({ error: 'Op ' + tafel + ' staat al een open rekening.', rekeningId: bestaand.id });
    }
    const r = { id: id(5), kanaal, tafel, naam: schoon(req.body.naam, 60) || null,
      gasten: Math.max(1, Math.min(500, parseInt(req.body.gasten, 10) || 1)),
      status: 'open', regels: [], kortingen: [], betalingen: [], fooiCenten: 0,
      gastId: schoon(req.body.gastId, 40) || null, kamer: schoon(req.body.kamer, 20) || null,
      geopendAt: nu(), door: req.actor.name, at: nu() };
    h.rekeningen[r.id] = r;
    save();
    logActivity(req.supplier.code, req.actor, 'opende een rekening op ' + (tafel || kanaal));
    sseToSupplier(req.supplier.code, 'sync', { scope: 'horeca' });
    res.json({ ok: true, rekening: publiek(r) });
  });

  /* ---------- een regel erop ---------- */
  app.post('/api/supplier/horeca/rekening/regel', supplierAuth, (req, res) => {
    const r = rekVan(req, res); if (!r) return;
    if (r.status !== 'open') return res.status(409).json({ error: 'Deze rekening is al ' + r.status + '.' });
    const naam = schoon(req.body.naam, 80);
    if (!naam) return res.status(400).json({ error: 'Wat wordt er besteld?' });
    const prijs = req.body.centen != null ? horeca.centen(req.body.centen) : uitEuro(req.body.prijs);
    if (!prijs && prijs !== 0) return res.status(400).json({ error: 'Vul de prijs in.' });
    const groep = schoon(req.body.groep, 30) || null;
    const happy = happyKorting(req.supplier.code, groep, nu());
    const regel = { id: id(3), naam, aantal: Math.max(1, Math.min(99, parseInt(req.body.aantal, 10) || 1)),
      centen: happy ? Math.round(prijs * (100 - happy.procent) / 100) : prijs,
      lijstprijs: prijs, happy: happy ? happy.naam + ' -' + happy.procent + '%' : null,
      groep, gang: Math.max(0, Math.min(9, parseInt(req.body.gang, 10) || 0)),
      station: schoon(req.body.station, 30) || null,
      notitie: schoon(req.body.notitie, 120) || null,
      allergie: schoon(req.body.allergie, 120) || null,
      gastNr: req.body.gastNr == null ? null : Math.max(1, Math.min(99, parseInt(req.body.gastNr, 10) || 1)),
      stand: 'besteld', at: nu(), door: req.actor.name };
    r.regels.push(regel);
    save();
    sseToSupplier(req.supplier.code, 'sync', { scope: 'horeca' });
    res.json({ ok: true, regel, rekening: publiek(r) });
  });

  // een regel eraf (verkeerd aangeslagen). Alleen zolang de keuken er niet aan
  // begonnen is; daarna is het derving en dat is een andere knop met een reden.
  app.post('/api/supplier/horeca/rekening/regel/weg', supplierAuth, (req, res) => {
    const r = rekVan(req, res); if (!r) return;
    const i = r.regels.findIndex(x => x.id === String(req.body.regelId || ''));
    if (i < 0) return res.status(404).json({ error: 'Die regel staat niet op deze rekening.' });
    if (r.regels[i].stand !== 'besteld')
      return res.status(409).json({ error: 'De keuken is hier al aan begonnen. Haal hem eraf via derving, met een reden.' });
    const weg = r.regels.splice(i, 1)[0];
    save();
    logActivity(req.supplier.code, req.actor, 'haalde ' + weg.naam + ' van de rekening');
    res.json({ ok: true, rekening: publiek(r) });
  });

  /* ---------- gangen ----------
     De bediening zet een gang vrij ("laat maar komen"); de keuken zet de
     regels daarna zelf door op het keukenscherm. Zo bepaalt de zaal het tempo
     van het diner en de keuken het tempo van de bereiding. */
  app.post('/api/supplier/horeca/gang/vrij', supplierAuth, (req, res) => {
    const r = rekVan(req, res); if (!r) return;
    const gang = Math.max(0, Math.min(9, parseInt(req.body.gang, 10) || 0));
    const regels = r.regels.filter(x => x.gang === gang && !x.vrijAt);
    if (!regels.length) return res.status(404).json({ error: 'Er staat niets meer open in gang ' + gang + '.' });
    const om = schoon(req.body.serveerOm, 5) || null;
    for (const x of regels) { x.vrijAt = nu(); x.serveerOm = om; }
    save();
    sseToSupplier(req.supplier.code, 'sync', { scope: 'keuken' });
    res.json({ ok: true, gang, vrijgegeven: regels.length, serveerOm: om, rekening: publiek(r) });
  });

  /* ---------- kijken ---------- */
  app.post('/api/supplier/horeca/rekening', supplierAuth, (req, res) => {
    const r = rekVan(req, res); if (!r) return;
    res.json({ ok: true, rekening: publiek(r) });
  });

  app.post('/api/supplier/horeca/rekeningen', supplierAuth, (req, res) => {
    const h = H(req.supplier.code);
    const status = schoon(req.body.status, 20) || 'open';
    const kanaal = schoon(req.body.kanaal, 20);
    const rijen = Object.values(h.rekeningen)
      .filter(r => r.status === status && (!kanaal || r.kanaal === kanaal))
      .sort((a, b) => String(a.geopendAt).localeCompare(String(b.geopendAt)))
      .slice(0, 300)
      .map(r => ({ id: r.id, kanaal: r.kanaal, tafel: r.tafel, naam: r.naam, gasten: r.gasten,
        regels: r.regels.length, geopendAt: r.geopendAt, totalen: totaal(r), openstaand: openstaand(r) }));
    res.json({ ok: true, aantal: rijen.length, rekeningen: rijen,
      omzetOpen: rijen.reduce((t, r) => t + r.totalen.netto, 0) });
  });
};
