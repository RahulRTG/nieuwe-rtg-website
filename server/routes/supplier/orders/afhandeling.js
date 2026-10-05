/* Orders (deelmodule): de afhandeling: de sectie- en stationsfasen van
   een bon, de orderstatusketen en de terugbetaling. Krijgt de gedeelde
   kern een keer bij het opstarten vanuit routes/supplier/orders.js. */
module.exports = (kern) => {
  const { app, broadcastSync, logActivity, managerOnly, notify, save, sectiesForOrder, sseToOffice,
          sseToSupplier, stationsForOrder, supplierAuth, orderMetRef, afhaalcode } = kern;
  /* Sluit de zaak een bestelling af, weigert of stort terug, dan gaat de
     afhaalcode EERST dicht (kern/afhaalcode.js) en pas daarna verandert de
     order. Lukt het intrekken niet, dan verandert er ook niets: een order die
     "geweigerd" zegt terwijl zijn code nog werkt, is erger dan een 503. */
  const sluitCode = async (o, req, reden) => {
    try { await afhaalcode.sluit({ order: o, actor: 'zaak:' + req.supplier.code, reden }); return true; }
    catch (e) { return false; }
  };
  const CODE_DICHT = ['geserveerd', 'geweigerd', 'opgehaald', 'bezorgd'];
app.post('/api/supplier/order/sectie', supplierAuth, (req, res) => {
  const o = (x => x && x.supplierCode === req.supplier.code ? x : undefined)(orderMetRef(req.body.ref));
  if (!o) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
  const sectie = String(req.body.sectie || '');
  if (!['warm', 'koud', 'snack', 'dessert'].includes(sectie)) return res.status(400).json({ error: 'Onbekende sectie.' });
  const phase = req.body.phase === 'klaar' ? 'klaar' : 'bezig';
  o.secties = o.secties || {};
  o.secties[sectie] = phase;
  if (o.status === 'nieuw') o.status = 'in bereiding';
  const nodig = sectiesForOrder(req.supplier, o);
  const wasKlaar = o.status === 'klaar';
  const keukenWasKlaar = (o.stations || {}).keuken === 'klaar';
  if (nodig.length && nodig.every(x => o.secties[x] === 'klaar')) {
    o.stations = o.stations || {};
    o.stations.keuken = 'klaar';                            // de hele keuken is klaar
    if (!keukenWasKlaar) o.pasAt = new Date().toISOString(); // vanaf nu staat het op de pas
    const stNodig = stationsForOrder(req.supplier, o);
    if (stNodig.every(st => o.stations[st] === 'klaar')) o.status = 'klaar';
  }
  save();
  broadcastSync([o.customerTier], 'orders');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'orders' });
  // de keuken praat met de bediening: bon compleet op de pas -> live belletje
  // op de bedieningspost, de PDA en de kassa (zelfde SSE-kanaal van de zaak)
  if (!keukenWasKlaar && (o.stations || {}).keuken === 'klaar')
    sseToSupplier(req.supplier.code, 'pas', { ref: o.ref, pickup: o.pickup, table: o.table || null });
  sseToOffice('sync', { scope: 'orders' });
  if (o.status === 'klaar' && !wasKlaar && o.customerTier)
    notify(o.customerKey, { icon: '\u2705', title: req.supplier.name, body: 'Uw bestelling is klaar (bon ' + o.pickup + '). Toon bij het ophalen uw afhaal-QR in de app.', scope: 'orders' });
  // Order en eventuele melding zijn al bewaard; dit spoor bezit alleen zichzelf.
  (logActivity.alleenActiviteit || logActivity)(req.supplier.code, req.actor, sectie + ': ' + o.ref + ' ' + (phase === 'klaar' ? 'klaar' : 'in bereiding'));
  res.json({ ok: true, order: o });
});

app.post('/api/supplier/order/station', supplierAuth, (req, res) => {
  const o = (x => x && x.supplierCode === req.supplier.code ? x : undefined)(orderMetRef(req.body.ref));
  if (!o) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
  const station = req.body.station === 'bar' ? 'bar' : 'keuken';
  const phase = req.body.phase === 'klaar' ? 'klaar' : 'bezig';
  o.stations = o.stations || {};
  const keukenWasKlaar = o.stations.keuken === 'klaar';
  o.stations[station] = phase;
  if (station === 'keuken' && phase === 'klaar' && !keukenWasKlaar) o.pasAt = new Date().toISOString();
  if (o.status === 'nieuw') o.status = 'in bereiding';
  const needed = stationsForOrder(req.supplier, o);
  const wasKlaar = o.status === 'klaar';
  if (needed.every(st => o.stations[st] === 'klaar')) o.status = 'klaar';
  save();
  broadcastSync([o.customerTier], 'orders');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'orders' });
  // de keuken praat met de bediening: bon op de pas -> live belletje
  if (!keukenWasKlaar && o.stations.keuken === 'klaar')
    sseToSupplier(req.supplier.code, 'pas', { ref: o.ref, pickup: o.pickup, table: o.table || null });
  sseToOffice('sync', { scope: 'orders' });
  if (o.status === 'klaar' && !wasKlaar && o.customerTier)
    notify(o.customerKey, { icon: '\u2705', title: req.supplier.name, body: 'Uw bestelling is klaar (bon ' + o.pickup + '). Toon bij het ophalen uw afhaal-QR in de app.', scope: 'orders' });
  (logActivity.alleenActiviteit || logActivity)(req.supplier.code, req.actor, (station === 'bar' ? 'bar' : 'keuken') + ': ' + o.ref + ' ' + (phase === 'klaar' ? 'klaar' : 'in bereiding'));
  res.json({ ok: true, order: o });
});

app.post('/api/supplier/order/status', supplierAuth, async (req, res) => {
  const o = (x => x && x.supplierCode === req.supplier.code ? x : undefined)(orderMetRef(req.body.ref));
  if (!o) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
  const allowed = ['nieuw', 'in bereiding', 'klaar', 'geserveerd', 'geweigerd', 'onderweg', 'bezorgd', 'opgehaald'];
  const status = String(req.body.status || '');
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Onbekende status.' });
  // de bezorgketen geldt ook langs deze weg: een levering vertrekt pas als de
  // inpakker (tas + bonnummer) en de bezorger (alles gepakt) hebben afgevinkt
  if (status === 'onderweg' && o.levering && !(o.inpak && o.pakcheck))
    return res.status(409).json({ error: 'Eerst afvinken: de inpakker (tas + bonnummer) en de bezorger (alles gepakt). Dan pas vertrekken.' });
  if (CODE_DICHT.includes(status) && !(await sluitCode(o, req, 'bestelling ' + status)))
    return res.status(503).json({ error: 'De afhaalcode kon niet worden ingetrokken; de status is niet veranderd.' });
  o.status = status;
  // een eindstand laat geen bezorgpunt achter; het adres blijft (NAVIGATIE.md N20)
  if (CODE_DICHT.includes(status) && o.geo) o.geo = null;
  save();
  broadcastSync([o.customerTier], 'orders');
  sseToOffice('sync', { scope: 'orders' });
  if (o.customerTier) notify(o.customerKey, { icon: 'horeca', title: req.supplier.name, body: 'Uw bestelling is nu: ' + status + '.', scope: 'orders' });
  (logActivity.alleenActiviteit || logActivity)(req.supplier.code, req.actor, 'zette ' + o.ref + ' op "' + status + '"');
  res.json({ ok: true, order: o });
});

// tafelreservering bevestigen of weigeren (elke medewerker, op eigen naam)

app.post('/api/supplier/refund', supplierAuth, async (req, res) => {
  if (!managerOnly(req, res)) return; // geld terugstorten is een management-handeling
  const o = (x => x && x.supplierCode === req.supplier.code ? x : undefined)(orderMetRef(req.body.ref));
  if (!o) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
  if (!o.paid) return res.status(409).json({ error: 'Deze bestelling is niet betaald.' });
  /* DE GRENDEL HANGT AAN `refunded` EN NIET MEER AAN `paid`. Hieronder blijft
     `paid` namelijk staan, dus zonder deze regel kon dezelfde bon twee keer
     worden teruggestort -- en dan gaat er twee keer geld terug. */
  if (o.refunded) return res.status(409).json({ error: 'Deze bestelling is al teruggestort.' });
  /* EEN TERUGSTORTING IS EEN TWEEDE GEBEURTENIS, GEEN WISSER VAN DE EERSTE.

     Hier stond `o.paid = false`. De verkoop verdween daarmee uit de maand waarin
     hij plaatsvond: kern/fiscaal/index.js telt op `o.paid`, dus de omzet van een
     AFGESLOTEN maand veranderde met terugwerkende kracht -- ook nadat de
     btw-aangifte erover was gedaan. En het verschil tussen "er is nooit verkocht"
     en "er is verkocht en teruggestort" was uit de cijfers niet meer te lezen.
     Gemeten met scripts/omzetproef.js: 45,00 -> 0,00.

     Een eenmaal geboekte verkoop is historische waarheid. De terugbetaling is een
     NIEUWE economische gebeurtenis die naar die verkoop verwijst, met een eigen
     datum -- want hij valt vaak in een andere maand dan de verkoop. Netto kan het
     nul worden; de geschiedenis blijft heel.

     `paid` zegt dus: er IS betaald. `refunded` zegt: het geld ligt niet meer bij
     de zaak. Wie wil weten of er nu geld staat, leest ze allebei -- en dat doen
     de vier plekken die dat bedoelen sinds deze wijziging ook. */
  if (!(await sluitCode(o, req, 'bestelling teruggestort')))
    return res.status(503).json({ error: 'De afhaalcode kon niet worden ingetrokken; er is niets teruggestort.' });
  o.refunded = true;
  o.refundedAt = new Date().toISOString();
  o.terugbetaling = { bedrag: o.total, op: o.refundedAt, door: (req.actor && req.actor.id) || null };
  o.status = 'terugbetaald';
  if (o.geo) o.geo = null;   // er wordt niets meer bezorgd, dus ook geen punt meer (NAVIGATIE.md N20)
  save();
  logActivity(req.supplier.code, req.actor, 'stortte € ' + o.total + ' terug (' + o.ref + ')');
  broadcastSync([o.customerTier], 'orders');
  sseToOffice('sync', { scope: 'orders' });
  notify(o.customerKey, { icon: 'betalen', title: req.supplier.name + ', terugstorting', body: 'U ontvangt € ' + o.total + ' retour.', scope: 'orders' });
  res.json({ ok: true, order: o });
});

};
