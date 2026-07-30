/* Boot-datalaag, deel 9: de vakmannen-golf. Tien alledaagse vakken op de
   vakwerk-motor (autogarage, schoonmaak, hovenier, wasserij, rijschool,
   dierenarts, tandarts, fotograaf, verhuizer, IT-hulp aan huis), elk met een
   demo-zaak uit ./deel9-zaken. Draait elke start met het ensure-patroon.
   Ook: de slotenmaker als extra dienst bij het bouw-genre (Castell). */
module.exports = (ctx) => {
  const { db, ensureSupplierDefaults } = ctx;
  const VAK_TYPES = {
    autogarage: { label: 'Autogarage & werkplaats', icon: 'auto', caps: ['services', 'location', 'pricing'] },
    schoonmaak: { label: 'Schoonmaak & huishouden', icon: 'werk', caps: ['services', 'location', 'pricing'] },
    hovenier: { label: 'Hovenier & tuinen', icon: 'oogst', caps: ['services', 'location', 'pricing'] },
    wasserij: { label: 'Wasserij & stomerij', icon: 'werk', caps: ['services', 'location', 'pricing'] },
    rijschool: { label: 'Rijschool', icon: 'auto', caps: ['services', 'location', 'pricing'] },
    dierenarts: { label: 'Dierenartspraktijk', icon: 'zorg', caps: ['services', 'location', 'pricing'] },
    tandarts: { label: 'Tandartspraktijk', icon: 'zorg', caps: ['services', 'location', 'pricing'] },
    fotograaf: { label: 'Fotografie & film', icon: 'camera', caps: ['services', 'location', 'pricing'] },
    verhuizer: { label: 'Verhuisservice', icon: 'logistiek', caps: ['services', 'location', 'pricing'] },
    ithulp: { label: 'IT-hulp aan huis', icon: 'werk', caps: ['services', 'location', 'pricing'] }
  };
  for (const [t, def] of Object.entries(VAK_TYPES)) if (!db.data.supplierTypes[t]) db.data.supplierTypes[t] = def;
  for (const p of require('./deel9-zaken')) {
    if (!db.data.suppliers.find(s => s.code === p.code)) { db.data.suppliers.push(p); ensureSupplierDefaults(p); }
  }
  // de slotenmaker hoort bij het bouw-genre: een extra dienst bij Castell,
  // ook op databases waar de zaak al bestond
  const castell = db.data.suppliers.find(s => s.code === 'CASTELL');
  if (castell && Array.isArray(castell.services) && !castell.services.some(x => x.id === 'b6')) {
    castell.services.push({ id: 'b6', name: 'Slotenmaker: buitengesloten of slot vervangen',
      desc: 'Zonder schade naar binnen en direct een goed slot erin.', price: 120, duurMin: 60, soort: 'dienst' });
  }
};
