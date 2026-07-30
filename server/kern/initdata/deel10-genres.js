/* Boot-datalaag, deel 10/10 (genres): de laatste zes aanmeldingsgenres krijgen
   een type en een demozaak, zodat geen enkel genre meer leeg staat.

   Waarom dat telt: het proefpubliek (test/gezelschap.js) zet voor elk genre met
   een partner een lid neer en laat dat lid daar iets doen. Een genre zonder
   partner wordt dus door niets aangeraakt -- niet door een test, niet door een
   sweep, door niets. Dat is geen fout maar wel een blinde hoek, en die test
   meldt hem sindsdien bij elke run.

   Draait met het ensure-patroon (alleen aanvullen wat er nog niet is), net als
   deel5 en deel9. */
module.exports = (ctx) => {
  const { db, ensureSupplierDefaults } = ctx;

  /* De caps hieronder zijn de bodem; kern/werkvormen.js legt er bij op wat de
     zaak werkelijk doet (een menukaart geeft de horeca-app, een vloot de
     vervoers-app). Zo hoeft dit lijstje niet alles te weten. */
  const GENRE_TYPES = {
    modehuis:     { label: 'Modehuis & atelier', icon: 'winkel', caps: ['retail', 'services', 'location', 'pricing'] },
    vervoer:      { label: 'Vervoer & transfers', icon: 'auto', caps: ['rides', 'location', 'pricing'] },
    care:         { label: 'Zorg aan huis', icon: 'zorg', caps: ['services', 'location', 'pricing'] },
    activiteiten: { label: 'Activiteiten & excursies', icon: 'tickets', caps: ['tickets', 'location', 'pricing'] },
    vakwerk:      { label: 'Vakwerk & klussen', icon: 'werk', caps: ['services', 'location', 'pricing'] }
  };
  for (const [t, def] of Object.entries(GENRE_TYPES)) if (!db.data.supplierTypes[t]) db.data.supplierTypes[t] = def;

  for (const p of require('./deel10-zaken')) {
    if (!db.data.suppliers.find(s => s.code === p.code)) { db.data.suppliers.push(p); ensureSupplierDefaults(p); }
  }
};
