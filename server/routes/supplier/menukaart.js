/* Supplier-submodule "menukaart": De menukaart en prijzen: menu bewerken met de ledenprijsgarantie
   (ledenprijs nooit boven de publieke prijs) en de menukaart voor het lid.
   Verbatim afgesplitst uit routes/supplier.js; alleen de routes, de helpers
   komen via het kern-object binnen. */
module.exports = (kern) => {
  const { alcoholGrensVan, app, auth, isFavoriet, crypto, db, express, findSupplier, geborenVan, i18n, ledenPrijs,
          leeftijdVan, logActivity, managerOnly, media, publicSupplier, save, schoon, sseToOffice, supplierAuth } = kern;



app.post('/api/supplier/price', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return; // dynamische prijzen naar RTG zijn management
  const service = String(req.body.service || '').trim().slice(0, 120);
  const price = Number(req.body.price);
  if (!service || !(price > 0)) return res.status(400).json({ error: 'Vul een dienst en geldige prijs in.' });
  const entry = {
    id: crypto.randomBytes(4).toString('hex'),
    supplierCode: req.supplier.code, supplierName: req.supplier.name, type: req.supplier.type,
    service, price, at: new Date().toISOString()
  };
  db.data.supplierPrices.unshift(entry);
  db.data.supplierPrices = db.data.supplierPrices.slice(0, 200);
  save();
  // backoffice ziet het live binnenkomen
  sseToOffice('sync', { scope: 'prices' });
  sseToOffice('notify', { icon: 'betalen', title: 'Nieuwe dynamische prijs', body: req.supplier.name + ': ' + service + ', € ' + price });
  logActivity(req.supplier.code, req.actor, 'gaf een prijs door: ' + service + ' (€ ' + price + ')');
  res.json({ ok: true, entry });
});

app.post('/api/supplier/menu', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return; // de kaart en de prijzen zijn voor het management
  if (!Array.isArray(req.body.menu)) return res.status(400).json({ error: 'Menu ontbreekt.' });
  req.supplier.menu = req.body.menu.slice(0, 100).map(m => {
    // ledenprijsgarantie: de publieke prijs is het plafond; als er geen aparte
    // publieke prijs is meegegeven, is de opgegeven prijs meteen de publieke.
    const publiek = Math.max(0, Number(m.publiekePrijs != null ? m.publiekePrijs : m.price) || 0);
    return {
    id: String(m.id || crypto.randomBytes(3).toString('hex')),
    cat: schoon(m.cat || 'Overig', 40),
    name: schoon(m.name, 80),
    desc: schoon(m.desc, 200),
    // Alleen een verwijzing uit onze eigen mediastore overleeft een
    // menuwijziging. Zo kan een gerecht nooit een externe volgpixel laden.
    foto: typeof m.foto === 'string' && /^\/media\/[a-zA-Z0-9._-]+$/.test(m.foto) ? m.foto : undefined,
    publiekePrijs: publiek,
    price: ledenPrijs(publiek, m.price),
    allergens: Array.isArray(m.allergens) ? m.allergens.slice(0, 12).map(a => String(a).slice(0, 20)) : [],
    ingredienten: Array.isArray(m.ingredienten) ? m.ingredienten.slice(0, 40).map(a => schoon(a, 40)).filter(Boolean) : [],
    dieet: Array.isArray(m.dieet) ? m.dieet.slice(0, 12).map(a => schoon(a, 24).toLowerCase()).filter(Boolean) : [],
    opties: Array.isArray(m.opties) ? m.opties.slice(0, 12).map((g, gi) => ({
      id:schoon(g && g.id, 30) || 'groep-' + gi,
      naam:schoon(g && g.naam, 50) || 'Kies een optie', verplicht:!!(g && g.verplicht),
      min:Math.max(0, Math.min(10, parseInt(g && g.min, 10) || (g && g.verplicht ? 1 : 0))),
      max:Math.max(1, Math.min(10, parseInt(g && g.max, 10) || 1)),
      keuzes:Array.isArray(g && g.keuzes) ? g.keuzes.slice(0, 30).map((k, ki) => ({
        id:schoon(k && k.id, 30) || 'keuze-' + gi + '-' + ki,
        naam:schoon(k && k.naam, 50) || 'Optie',
        prijsCenten:Math.max(0, Math.min(100000, parseInt(k && k.prijsCenten, 10) || 0)),
        allergenen:Array.isArray(k && k.allergenen) ? k.allergenen.slice(0, 12).map(a => schoon(a, 20)).filter(Boolean) : []
      })) : []
    })).filter(g => g.keuzes.length) : [],
    station: m.station === 'bar' ? 'bar' : 'keuken',
    sectie: ['warm', 'koud', 'snack', 'dessert'].includes(m.sectie) ? m.sectie : 'warm',
    // het vuurplan: eigen bereidingstijd in minuten (0 of leeg = nominale tijd per kant)
    prepMin: Math.min(90, Math.max(0, parseInt(m.prepMin, 10) || 0)) || undefined,
    // 86 en de opgebouwde gerechtenkennis overleven het bewerken van de kaart
    uitverkocht: !!m.uitverkocht || undefined,
    kennis: m.kennis && typeof m.kennis === 'object'
      ? Object.fromEntries(Object.entries(m.kennis).filter(([k]) => ['recept', 'bereiding', 'allergenen', 'pairing'].includes(k)).map(([k, v]) => [k, String(v).slice(0, 1500)]))
      : undefined,
    recept: String(m.recept || '').slice(0, 1500)
    };
  });
  save();
  logActivity(req.supplier.code, req.actor, 'werkte de menukaart bij');
  res.json({ ok: true, menu: req.supplier.menu });
});

app.post('/api/supplier/menu/foto', express.json({ limit: '6mb' }), supplierAuth, async (req, res) => {
  if (!managerOnly(req, res)) return;
  const item = (req.supplier.menu || []).find(m => String(m.id) === String(req.body.id || ''));
  if (!item) return res.status(404).json({ error: 'Dit gerecht staat niet op de kaart.' });
  if (req.body.verwijder === true) {
    delete item.foto; save();
    return res.json({ ok: true, id: item.id, foto: null });
  }
  const img = String(req.body.foto || '');
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(img)) return res.status(400).json({ error: 'Alleen JPG, PNG of WebP.' });
  if (img.length > 1.5 * 1024 * 1024) return res.status(413).json({ error: 'Foto te groot (maximaal ongeveer 1 MB).' });
  const ref = await media.bewaarPubliek(img, 1.5 * 1024 * 1024);
  if (!ref) return res.status(400).json({ error: 'Foto kon niet veilig worden opgeslagen.' });
  item.foto = ref; save();
  logActivity(req.supplier.code, req.actor, 'plaatste een foto bij gerecht "' + item.name + '"');
  res.json({ ok: true, id: item.id, foto: ref });
});


app.post('/api/supplier/menu/get', auth, (req, res) => {
  const s = findSupplier(req.body.code);
  if (!s) return res.status(404).json({ error: 'Leverancier niet gevonden.' });
  const lang = req.body.lang;
  const menu = (s.menu || []).map(m => ({ ...m, name: i18n.localize(m.name, lang), desc: i18n.localize(m.desc, lang), cat: i18n.localize(m.cat, lang) }));
  // leeftijdsinfo voor de bestelflow: mag dit lid hier alcohol bestellen?
  const aInfo = alcoholGrensVan(s);
  const lftM = leeftijdVan(geborenVan(req.session));
  res.json({ supplier: { ...publicSupplier(s, lang), favoriet: isFavoriet(req.session.key, s.code) }, menu,
    alcohol: { grens: aInfo.grens, land: aInfo.land, geverifieerd: lftM != null, mag: lftM == null || lftM >= aInfo.grens } });
});


  // domein-deelmodules (aparte bestanden, zelfde gedeelde kern)
};
