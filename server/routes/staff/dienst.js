/* Staff (deelmodule): de dienstlaag: Fluister voor de vloer (eigen geheugen
   per personeelslid), in- en uitklokken, het eigen overzicht, verlof en
   ziekmelden en de vertrouwenspersoon. Krijgt de gedeelde context een keer
   bij het opstarten vanuit routes/staff.js. */
module.exports = (actx) => {
  const { DEMO, accounts, app, checkCred, crypto, db, findStaffPartner, hasCred, klokVan, logActivity, managerOnly, notifySupplier, publicPartner, save, schoon, sseClients, sseSend, sseToOffice, sseToSupplier, supplierAuth, trustVan,
    fluisterZeg, fluisterVergeet, fluisterFocus, fluisterProfiel, stuurLus,
    werkbeleidPauzeStand, WERKBELEID_PAUZE_MINUTEN, payrollOS } = actx;
/* Fluister voor de vloer staat in ./dienst-fluister.js: dat stuk praat met een
   modelaanbieder en de rest van deze laag niet, dus de vraag wat er naar buiten
   gaat hoort daar bij elkaar. */
require('./dienst-fluister')({ app, accounts, supplierAuth, fluisterZeg, fluisterVergeet, fluisterFocus, fluisterProfiel, stuurLus });

app.post('/api/staff/clock', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  const lijst = db.data.klok[req.supplier.code] = db.data.klok[req.supplier.code] || [];
  const open = lijst.find(e => e.staffId === req.actor.staffId && !e.out);
  let actie;
  if (open) { open.out = new Date().toISOString(); actie = 'uit'; }
  else { lijst.unshift({ id: crypto.randomBytes(4).toString('hex'), staffId: req.actor.staffId, name: req.actor.name, in: new Date().toISOString(), out: null }); actie = 'in'; }
  db.data.klok[req.supplier.code] = lijst.slice(0, 4000);
  save();
  logActivity(req.supplier.code, req.actor, 'klokte ' + actie);
  sseToSupplier(req.supplier.code, 'sync', { scope: 'klok' });
  res.json({ ok: true, actie, klok: klokVan(req.supplier.code, req.actor.staffId) });
});

/* PAUZE. Zolang je ingeklokt staat houdt het werkbeleid van je werkgever
   functies dicht (kern/lidboard/werkbeleid.js). In je pauze niet: dan is je
   pas weer van jou. De armslag is 45 minuten per dienst, samen voor alle
   pauzes -- de rookpauze en de grote pauze komen uit dezelfde pot.

   Wat hier NIET gebeurt: meten wat je in die minuten doet. De teller loopt op
   pauzeminuten, punt. Zou hij op je gebruik van De Salon lopen, dan hield dit
   systeem precies bij hoeveel minuten je op sociale media zat, en dat is de
   meting waar dat hele beleid tegen beschermt.

   Pauze nemen mag altijd, ook als de 45 minuten op zijn: je pauzerecht is niet
   van RTG. Wat er dan gebeurt is alleen dat het beleid weer geldt. */
app.post('/api/staff/pauze', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  const lijst = db.data.klok[req.supplier.code] = db.data.klok[req.supplier.code] || [];
  const dienst = Array.isArray(lijst) ? lijst.find(e => e.staffId === req.actor.staffId && e.in && !e.out) : null;
  if (!dienst) return res.status(409).json({ error: 'Je staat niet ingeklokt; een pauze hoort bij een dienst.' });
  dienst.pauzes = dienst.pauzes || [];
  const open = dienst.pauzes.find(p => p && p.in && !p.uit);
  let actie;
  if (open) { open.uit = new Date().toISOString(); actie = 'uit'; }
  else { dienst.pauzes.push({ in: new Date().toISOString(), uit: null }); actie = 'in'; }
  save();
  sseToSupplier(req.supplier.code, 'sync', { scope: 'klok' });
  const stand = werkbeleidPauzeStand(req.supplier.code, req.actor.staffId);
  res.json({ ok: true, actie, pauze: stand, budgetMinuten: WERKBELEID_PAUZE_MINUTEN });
});

app.post('/api/staff/mine', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  res.json({
    klok: klokVan(req.supplier.code, req.actor.staffId),
    verlof: (db.data.verlof[req.supplier.code] || []).filter(v => v.staffId === req.actor.staffId).slice(0, 10),
    pauze: werkbeleidPauzeStand(req.supplier.code, req.actor.staffId),
    trust: trustVan(req.supplier.code, req.actor.staffId)
  });
});

app.post('/api/staff/leave/request', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  const soort = req.body.soort === 'ziek' ? 'ziek' : 'verlof';
  const van = schoon(req.body.van, 10), tot = schoon(req.body.tot, 10);
  const geldig = d => /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (soort === 'verlof' && (!geldig(van) || !geldig(tot) || tot < van))
    return res.status(400).json({ error: 'Kies een geldige begin- en einddatum.' });

  /* EEN ZIEKMELDING DRAAGT GEEN REDEN. Die stond hier wel: `reden` werd
     gewoon overgenomen en het HR-scherm van de werkgever toonde hem achter de
     naam. Dat is een gezondheidsgegeven van een werknemer in een
     personeelssysteem, zichtbaar voor de leidinggevende -- precies de lijn die
     de Autoriteit Persoonsgegevens trekt, en precies waar
     kern/payroll/verzuim.js voor is gebouwd. Die laag weigerde het al; deze
     route wist er niets van.

     WEIGEREN EN NIET OPSCHONEN. Wie het veld stilzwijgend leegmaakt, laat de
     invoerder denken dat het is aangekomen -- en de volgende keer probeert hij
     het opnieuw, of belt hij het door. De melding hoort te stuiten, met de
     reden erbij. De app stuurt bij een ziekmelding sowieso geen reden mee, dus
     dit breekt niets; het sluit een deur die openstond. */
  if (soort === 'ziek' && schoon(req.body.reden, 140))
    return res.status(422).json({ error: 'Een ziekmelding draagt geen omschrijving. Wat je hebt, hoort bij de arbodienst; hier staat alleen dat je er niet bent en wat je nog kunt.' });
  const lijst = db.data.verlof[req.supplier.code] = db.data.verlof[req.supplier.code] || [];
  const entry = {
    id: crypto.randomBytes(4).toString('hex'),
    staffId: req.actor.staffId, name: req.actor.name, soort,
    van: soort === 'ziek' ? new Date().toISOString().slice(0, 10) : van,
    tot: soort === 'ziek' ? null : tot,
    reden: schoon(req.body.reden, 140),
    status: soort === 'ziek' ? 'gemeld' : 'nieuw',
    at: new Date().toISOString()
  };
  lijst.unshift(entry);
  db.data.verlof[req.supplier.code] = lijst.slice(0, 2000);

  /* Dezelfde melding ook naar de verzuimlaag van Payroll OS. Die kent de
     doorbetalingspercentages per verlofsoort en weet wanneer het UWV eraan te
     pas komt; zonder deze regel wist de loonrun niet dat iemand ziek was en
     betaalde hij honderd procent door.

     EEN SCHRIJFPAD, TWEE GEZICHTEN -- en dat is met opzet geen tweede invoer.
     `db.data.verlof` hierboven is de goedkeuringsstroom van de zaak-app (nieuw
     -> goedgekeurd/afgewezen); de verzuimlaag is wat de payroll ervan moet
     weten. Zou een mens ze allebei moeten invullen, dan lopen ze uiteen en
     klopt de loondoorbetaling niet met het rooster. */
  if (payrollOS && payrollOS.verzuim) {
    const v = payrollOS.verzuim.meld(req.supplier.code, req.actor.staffId, {
      soort: soort === 'ziek' ? 'ziek' : 'vakantie', van: entry.van, tot: entry.tot
    }, req.actor.name);
    // een bezwaar hier is een fout in ONZE vertaling, niet in de invoer van de
    // medewerker; hij hoort zichtbaar te zijn en de melding niet te blokkeren
    if (v && v.error) console.error('[verzuim] melding niet vastgelegd:', v.error, v.bezwaren || '');
  }
  save();
  if (soort === 'ziek') {
    logActivity(req.supplier.code, req.actor, 'meldde zich ziek');
    notifySupplier(req.supplier.code, { icon: 'zorg', title: 'Ziekmelding', body: req.actor.name + ' heeft zich ziek gemeld. Denk aan de bezetting van vandaag.' });
  } else {
    logActivity(req.supplier.code, req.actor, 'vroeg verlof aan (' + entry.van + ' t/m ' + entry.tot + ')');
    notifySupplier(req.supplier.code, { icon: 'parasol', title: 'Verlofaanvraag', body: req.actor.name + ': ' + entry.van + ' t/m ' + entry.tot + (entry.reden ? ' · ' + entry.reden : '') });
  }
  sseToSupplier(req.supplier.code, 'sync', { scope: 'verlof' });
  res.json({ ok: true, entry });
});

app.post('/api/staff/trust/send', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  const text = schoon(req.body.text, 800);
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  let t = db.data.trustLine.find(x => x.code === req.supplier.code && x.staffId === req.actor.staffId);
  if (!t) {
    t = { id: crypto.randomBytes(4).toString('hex'), code: req.supplier.code, company: req.supplier.name,
          staffId: req.actor.staffId, anon: !!req.body.anon, name: req.actor.name, messages: [], open: true, lastAt: null };
    db.data.trustLine.unshift(t);
    db.data.trustLine = db.data.trustLine.slice(0, 2000);
  }
  if (req.body.anon != null) t.anon = !!req.body.anon;
  t.messages.push({ from: 'staff', text, at: new Date().toISOString() });
  t.messages = t.messages.slice(-60);
  t.open = true;
  t.lastAt = new Date().toISOString();
  save();
  // bewust GEEN logActivity en GEEN notifySupplier: dit blijft buiten de werkgever om
  sseToOffice('sync', { scope: 'trust' });
  res.json({ ok: true, trust: trustVan(req.supplier.code, req.actor.staffId) });
});

app.post('/api/staff/trust/thread', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  res.json({ trust: trustVan(req.supplier.code, req.actor.staffId) });
});

};
