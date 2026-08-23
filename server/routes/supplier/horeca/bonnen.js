/* Horeca OS (deellaag): cadeaubonnen en tegoed, de offline-wachtrij en de
   instellingen (happy hour en arrangementen). Hoort bij horeca/betalen.js;
   inwisselen loopt daar via dezelfde betaalweg.

   OFFLINE IS EEN ECHTE STAND. Bonnen die tijdens een internetstoring op het
   apparaat zijn gemaakt, komen met hun EIGEN tijdstip binnen en met een
   clientId. Dezelfde bon twee keer insturen levert een keer omzet -- en de
   tweede keer wordt GETELD in het antwoord, niet stil genegeerd: een kassa die
   denkt te hebben verkocht wat er niet staat, is erger dan een foutmelding. */
module.exports = (kern) => {
  const { app, save, schoon, supplierAuth, logActivity, horeca } = kern;
  const { H, nu, id, centen, uitEuro, totaal, bonMaak } = horeca;
  const WIJZEN = ['contant', 'pin', 'online', 'rekening', 'kamer', 'bon', 'tegoed', 'munt'];

  /* ---------- bonnen ---------- */
  app.post('/api/supplier/horeca/bon/maak', supplierAuth, (req, res) => {
    const bedrag = req.body.centen != null ? centen(req.body.centen) : uitEuro(req.body.bedrag);
    if (!bedrag) return res.status(400).json({ error: 'Voor welk bedrag?' });
    const b = bonMaak(req.supplier.code, { soort: req.body.soort, centen: bedrag,
      naam: req.body.naam, geldigTot: req.body.geldigTot });
    logActivity(req.supplier.code, req.actor, 'gaf een ' + b.soort + ' uit van ' + (bedrag / 100).toFixed(2));
    res.json({ ok: true, bon: b });
  });

  app.post('/api/supplier/horeca/bon', supplierAuth, (req, res) => {
    const h = H(req.supplier.code);
    const code = String(req.body.bonCode || '').toUpperCase();
    const b = Object.prototype.hasOwnProperty.call(h.bonnen, code) ? h.bonnen[code] : null;
    if (!b) return res.status(404).json({ error: 'Deze bon kennen we niet.' });
    res.json({ ok: true, bon: { code: b.code, soort: b.soort, saldo: b.saldo, uitgegeven: b.uitgegeven,
      geldigTot: b.geldigTot, mutaties: b.mutaties.slice(0, 10) } });
  });

  /* ---------- offline ----------
     Een apparaat dat zonder netwerk doorwerkt, stuurt zijn bonnen later alsnog
     in. Elke bon draagt een clientId; die is de sleutel tegen dubbel boeken.
     Wat al binnen was, wordt GETELD in het antwoord -- stil overslaan zou
     betekenen dat een apparaat denkt te hebben verkocht wat er niet staat.

     TWEE SOORTEN, EN HET VERSCHIL IS NIET COSMETISCH:

     `verkocht` (de oude, en de standaard) -- verkocht EN geserveerd, meestal aan
     de bar en meestal al betaald. De regels landen als `uitgegeven`: er valt
     niets meer te maken. Dat is de bardoos.

     `opgenomen` (nieuw) -- een bestelling die de bediening OPNAM terwijl er geen
     lijn was. De keuken heeft hem nooit gezien, dus die moet hem nog maken. De
     regels landen als `besteld`, mét hun gang, station, stoel en ALLERGIE, en
     ze worden NIET vrijgegeven: dat blijft een tik van de zaal, want tussen het
     opnemen en het terugkeren van de lijn kan de situatie veranderd zijn.

     Die allergie is de reden dat dit twee soorten zijn en geen vlaggetje. Zou
     een opgenomen bestelling als `uitgegeven` binnenkomen, dan is er een bord
     "geserveerd" dat niemand heeft gemaakt -- en de allergie is dan een veld op
     een bon die niemand meer leest. */
  app.post('/api/supplier/horeca/offline/sync', supplierAuth, (req, res) => {
    const h = H(req.supplier.code);
    const bonnen = (Array.isArray(req.body.bonnen) ? req.body.bonnen : []).slice(0, 200);
    if (!bonnen.length) return res.status(400).json({ error: 'Er zaten geen bonnen in dit pakket.' });
    let nieuw = 0, dubbel = 0;
    const gemaakt = [];
    for (const b of bonnen) {
      const clientId = schoon(b && b.clientId, 60);
      if (!clientId) { continue; }
      if (Object.values(h.rekeningen).some(x => x.clientId === clientId)) { dubbel++; continue; }
      const opgenomen = String(b && b.soort || 'verkocht') === 'opgenomen';
      const regels = (Array.isArray(b.regels) ? b.regels : []).slice(0, 60).map(x => ({
        id: id(3), naam: schoon(x && x.naam, 80) || 'Artikel',
        aantal: Math.max(1, Math.min(99, parseInt(x && x.aantal, 10) || 1)),
        centen: x && x.centen != null ? centen(x.centen) : uitEuro(x && x.prijs),
        lijstprijs: null, groep: null,
        /* Bij een OPGENOMEN bestelling reizen gang, station en allergie mee: de
           keuken moet hem nog maken. Bij een VERKOCHTE niet -- daar valt niets
           meer te maken, en velden die niemand meer leest horen er niet te
           staan alsof ze iets betekenen. */
        gang: opgenomen ? Math.max(0, Math.min(9, parseInt(x && x.gang, 10) || 0)) : 0,
        station: opgenomen ? (schoon(x && x.station, 30) || null) : null,
        notitie: opgenomen ? (schoon(x && x.notitie, 120) || null) : null,
        allergie: opgenomen ? (schoon(x && x.allergie, 120) || null) : null,
        stoel: opgenomen ? (schoon(x && x.stoel, 40) || null) : null,
        gastNr: null,
        stand: opgenomen ? 'besteld' : 'uitgegeven',
        at: schoon(b.at, 30) || nu(), door: req.actor.name }));
      if (!regels.length) continue;
      const r = { id: id(5), clientId, kanaal: schoon(b.kanaal, 20) || (opgenomen ? 'tafel' : 'bar'),
        tafel: schoon(b.tafel, 30) || null,
        naam: opgenomen ? 'Offline opgenomen' : 'Offline bon',
        gasten: Math.max(1, Math.min(99, parseInt(b.gasten, 10) || 1)),
        status: 'open', regels, kortingen: [], betalingen: [], fooiCenten: centen(b.fooiCenten),
        offline: true, offlineSoort: opgenomen ? 'opgenomen' : 'verkocht',
        geopendAt: schoon(b.at, 30) || nu(), door: req.actor.name, at: nu() };
      /* Een offline VERKOCHTE bon is meestal al betaald aan de bar; die
         betaling komt mee. Een OPGENOMEN bestelling is per definitie niet
         betaald -- daar moet de gast nog eten. */
      if (b.betaald && !opgenomen) {
        r.betalingen.push({ id: id(3), wijze: WIJZEN.includes(String(b.wijze)) ? String(b.wijze) : 'contant',
          centen: totaal(r).teBetalen, at: r.geopendAt, door: req.actor.name, offline: true });
        r.status = 'betaald'; r.geslotenAt = r.geopendAt;
      }
      h.rekeningen[r.id] = r;
      gemaakt.push({ id: r.id, clientId, centen: totaal(r).teBetalen });
      nieuw++;
    }
    save();
    logActivity(req.supplier.code, req.actor, 'synchroniseerde ' + nieuw + ' offline bon(nen)');
    res.json({ ok: true, nieuw, dubbel, overgeslagen: bonnen.length - nieuw - dubbel, bonnen: gemaakt,
      let: (dubbel ? dubbel + ' bon(nen) waren al binnen en zijn niet opnieuw geboekt. ' : '') +
        'Opgenomen bestellingen staan op "besteld" en zijn NIET vrijgegeven: ' +
        'de zaal beslist zelf wanneer de keuken eraan begint.' });
  });

  /* ---------- happy hour en arrangementen instellen ---------- */
  app.post('/api/supplier/horeca/instel', supplierAuth, (req, res) => {
    const h = H(req.supplier.code);
    if (Array.isArray(req.body.happy)) {
      h.instel.happy = req.body.happy.slice(0, 20).map(x => ({
        naam: schoon(x && x.naam, 40) || 'Happy hour',
        van: schoon(x && x.van, 5) || null, tot: schoon(x && x.tot, 5) || null,
        dagen: Array.isArray(x && x.dagen) ? x.dagen.map(Number).filter(d => d >= 0 && d <= 6) : [],
        groepen: Array.isArray(x && x.groepen) ? x.groepen.slice(0, 10).map(g => schoon(g, 30)).filter(Boolean) : [],
        procent: Math.max(0, Math.min(90, Number(x && x.procent) || 0)) }));
    }
    if (Array.isArray(req.body.arrangementen)) {
      h.instel.arrangementen = req.body.arrangementen.slice(0, 30).map(a => ({
        id: schoon(a && a.id, 20) || id(3), naam: schoon(a && a.naam, 60) || 'Arrangement',
        centen: a && a.centen != null ? centen(a.centen) : uitEuro(a && a.prijs),
        perPersoon: (a && a.perPersoon) !== false,
        bevat: Array.isArray(a && a.bevat) ? a.bevat.slice(0, 20).map(x => schoon(x, 60)).filter(Boolean) : [] }));
    }
    save();
    res.json({ ok: true, instel: h.instel });
  });
};
