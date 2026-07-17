/* Domein "supplier" (deelmodule): contract. Draait op de gedeelde kern. */
module.exports = (kern) => {
  const { accounts, app, crypto, db, logActivity, keyVanCodenaam, managerOnly, notify, save, schoon, sseToCustomer, sseToSupplier, supplierAuth } = kern;

/* ================== contracten: opstellen en ondertekenen ==================
   Elke zaak kan een contract maken (verhuur, personeel of algemeen), gericht
   aan een lid (op codenaam) of aan een eigen personeelslid (staffId). Beide
   partijen tekenen digitaal: getypte naam + akkoord + tijdstempel. Eenmaal
   getekend verandert er niets meer aan de tekst: dat is het bewijs. */
function contractPubliek(c) {
  return { ref: c.ref, soort: c.soort, supplierCode: c.supplierCode, supplierName: c.supplierName,
    titel: c.titel, tekst: c.tekst, velden: c.velden || [],
    partij: c.partij.kind === 'lid' ? { kind: 'lid', codename: c.partij.codename } : { kind: 'staff', naam: c.partij.naam },
    status: c.status, tekenZaak: c.tekenZaak || null, tekenPartij: c.tekenPartij || null,
    huurRef: c.huurRef || null, at: c.at };
}

app.post('/api/supplier/contract/maak', supplierAuth, async (req, res) => {
  if (!managerOnly(req, res)) return;
  const s = req.supplier;
  const soort = ['verhuur', 'personeel', 'algemeen'].includes(req.body.soort) ? req.body.soort : 'algemeen';
  const titel = schoon(req.body.titel, 80);
  const tekst = schoon(req.body.tekst, 4000);
  if (!titel) return res.status(400).json({ error: 'Geef het contract een titel.' });
  if (!tekst || tekst.length < 20) return res.status(400).json({ error: 'Zet de voorwaarden in het contract (minstens een paar regels).' });
  const velden = (Array.isArray(req.body.velden) ? req.body.velden : []).slice(0, 20)
    .map(v => ({ label: schoon(v.label, 40), waarde: schoon(v.waarde, 120) })).filter(v => v.label);
  // ontvanger: een lid op codenaam, of een eigen personeelslid
  let partij;
  if (req.body.staffId != null) {
    const m = accounts.getStaffById(Number(req.body.staffId));
    if (!m || String(m.supplier_code).toUpperCase() !== s.code) return res.status(404).json({ error: 'Dit personeelslid kennen we niet bij uw zaak.' });
    partij = { kind: 'staff', staffId: m.id, naam: m.name };
  } else {
    const lid = await keyVanCodenaam(req.body.codenaam);
    if (!lid) return res.status(404).json({ error: 'Geen lid gevonden met die codenaam. Vraag de klant naar de exacte codenaam uit de app.' });
    partij = { kind: 'lid', key: lid.key, codename: lid.codename };
  }
  let huurRef = null;
  if (soort === 'verhuur' && req.body.huurRef) {
    const h = (b => b && b.kind === 'huur' && b.supplierCode === s.code ? b : undefined)(kern.boekingMetRef(String(req.body.huurRef)));
    if (h) { huurRef = h.ref; if (partij.kind === 'lid' && !req.body.codenaam) partij = { kind: 'lid', key: h.customerKey, codename: h.customerCodename }; }
  }
  const c = {
    ref: 'RTG-C-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    soort, supplierCode: s.code, supplierName: s.name, titel, tekst, velden, partij, huurRef,
    status: 'wacht', tekenZaak: null, tekenPartij: null, at: new Date().toISOString()
  };
  db.data.contracten.unshift(c);
  db.data.contracten = db.data.contracten.slice(0, 20000);
  save();
  logActivity(s.code, req.actor, 'stelde een contract op (' + soort + ') voor ' + (partij.codename || partij.naam));
  if (partij.kind === 'lid') { notify(partij.key, { icon: '\u{1F4DD}', title: s.name + ' \u2013 contract', body: titel + ': klaar om te ondertekenen in uw app.', scope: 'contract' }); sseToCustomer(partij.key, 'sync', { scope: 'contract' }); }
  sseToSupplier(s.code, 'sync', { scope: 'contract' });
  res.json({ ok: true, contract: contractPubliek(c) });
});

app.post('/api/supplier/contracten', supplierAuth, (req, res) => {
  const s = req.supplier;
  // managers zien alle contracten van de zaak; personeel alleen dat van henzelf
  const lijst = db.data.contracten.filter(c => c.supplierCode === s.code &&
    (req.actor.manager || (c.partij.kind === 'staff' && c.partij.staffId === req.actor.staffId)))
    .slice(0, 200).map(contractPubliek);
  res.json({ contracten: lijst });
});

/* Ondertekenen vanuit de zaak-app of de PDA: een manager tekent namens de
   zaak; het aangeschreven personeelslid tekent zijn eigen kant. */
app.post('/api/supplier/contract/teken', supplierAuth, (req, res) => {
  const s = req.supplier;
  const c = db.data.contracten.find(x => x.ref === String(req.body.ref || '') && x.supplierCode === s.code);
  if (!c) return res.status(404).json({ error: 'Contract niet gevonden.' });
  if (c.status === 'geweigerd') return res.status(409).json({ error: 'Dit contract is geweigerd.' });
  const naam = schoon(req.body.naam, 60);
  if (!naam || req.body.akkoord !== true) return res.status(400).json({ error: 'Typ uw naam en vink akkoord aan om te tekenen.' });
  const zijde = (c.partij.kind === 'staff' && c.partij.staffId === req.actor.staffId) ? 'partij' : (req.actor.manager ? 'zaak' : null);
  if (!zijde) return res.status(403).json({ error: 'Dit contract staat niet op uw naam.' });
  if (zijde === 'zaak' && c.tekenZaak) return res.status(409).json({ error: 'De zaak heeft al getekend.' });
  if (zijde === 'partij' && c.tekenPartij) return res.status(409).json({ error: 'U heeft al getekend.' });
  const teken = { naam, at: new Date().toISOString() };
  if (zijde === 'zaak') c.tekenZaak = teken; else c.tekenPartij = teken;
  if (c.tekenZaak && c.tekenPartij) c.status = 'getekend';
  save();
  logActivity(s.code, req.actor, 'tekende contract ' + c.ref);
  if (c.partij.kind === 'lid') sseToCustomer(c.partij.key, 'sync', { scope: 'contract' });
  sseToSupplier(s.code, 'sync', { scope: 'contract' });
  res.json({ ok: true, contract: contractPubliek(c) });
});

};
