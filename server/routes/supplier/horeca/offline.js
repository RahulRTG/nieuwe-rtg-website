/* Offline werk wordt volledig beoordeeld vóór de eerste mutatie. */
module.exports = kern => {
  const { app, save, schoon, supplierAuth, logActivity, sseToSupplier, horeca } = kern;
  const { H, nu, id, heleCenten, uitEuro, totaal } = horeca;
  const samenvoegen = require('../../../kern/horeca/samenvoegen')({ horeca, schoon });
  const WIJZEN = ['contant', 'pin', 'online', 'rekening', 'kamer', 'bon', 'tegoed', 'munt'];
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
    const bonnen = (Array.isArray(req.body.bonnen) ? req.body.bonnen : []).slice(0, 200);
    if (!bonnen.length) return res.status(400).json({ error: 'Er zaten geen bonnen in dit pakket.' });
    // Beoordeel het HELE pakket voordat H() of een bon wordt geschreven.
    // Onbetaald opgenomen werk mag door; betaald registreren blijft geldwerk.
    if (bonnen.some(b => b && b.betaald && b.soort !== 'opgenomen') &&
        require('../../../opzet/betaalstop').weigerIndienUit(res)) return;
    // pas hier de doos: een leeg pakket wordt geweigerd en laat dan niets
    const h = H(req.supplier.code);
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
        centen: x && x.centen != null ? heleCenten(x.centen) : uitEuro(x && x.prijs),
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
        status: 'open', regels, kortingen: [], betalingen: [], fooiCenten: heleCenten(b.fooiCenten),
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

  /* ---------- offline HANDELINGEN ----------

     Bonnen zijn iets NIEUWS: ze bestonden nog niet, dus ze kunnen niet botsen.
     Een handeling is iets anders -- daar wordt BEWERKT, en tussen het moment
     van de handeling en het moment van aankomen kan een collega hetzelfde bord
     al verder hebben gezet. Blind afspelen zet dat dan terug.

     Dus geen herhaling maar een SAMENVOEGING, met één regel die het veilig
     maakt: een stand gaat nooit achteruit. Zie kern/horeca/samenvoegen.js voor
     die regel en voor wat er met opzet niet in zit (geld, en een regel van de
     rekening halen).

     Een geweigerde samenvoeging komt MET de reden terug. Het toestel hoort te
     weten dat zijn plaatselijke werkelijkheid het heeft verloren; stil laten
     vallen zou betekenen dat een medewerker denkt iets te hebben gedaan wat
     nooit is gebeurd. */
  app.post('/api/supplier/horeca/offline/handelingen', supplierAuth, (req, res) => {
    const lijst = Array.isArray(req.body.handelingen) ? req.body.handelingen : [];
    if (!lijst.length) return res.status(400).json({ error: 'Er zaten geen handelingen in dit pakket.' });
    // de doos pas als er iets samen te voegen is; zie /offline/sync hierboven
    const h = H(req.supplier.code);
    const uit = samenvoegen.verwerk(h, lijst, req.actor.name);
    save();
    if (uit.gedaan) {
      logActivity(req.supplier.code, req.actor, 'voegde ' + uit.gedaan + ' offline handeling(en) samen');
      sseToSupplier(req.supplier.code, 'sync', { scope: 'keuken' });
    }
    res.json(Object.assign({ ok: true }, uit, {
      let: 'Een stand gaat nooit achteruit. Wat geweigerd is, staat er met de reden bij: ' +
        'een toestel hoort te weten dat zijn plaatselijke beeld het heeft verloren.'
    }));
  });

};
