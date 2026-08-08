/* Boot-datalaag, deel 9: de vakmannen-golf. Tien alledaagse vakken op de
   vakwerk-motor (autogarage, schoonmaak, hovenier, wasserij, rijschool,
   dierenarts, tandarts, fotograaf, verhuizer, IT-hulp aan huis), elk met een
   demo-zaak uit ./deel9-zaken. Draait elke start met het ensure-patroon.
   Ook: de slotenmaker als extra dienst bij het bouw-genre (Castell). */
module.exports = (ctx) => {
  const { db, ensureSupplierDefaults } = ctx;
  // De genres van dit deel staan in server/seed/genres.js (het genre-register).
  for (const p of require('./deel9-zaken')) {
    const bestaand = db.data.suppliers.find(s => s.code === p.code);
    if (!bestaand) { p.geseed = true; db.data.suppliers.push(p); ensureSupplierDefaults(p); }
    else bestaand.geseed = true;  // ook op een database van voor het merkteken
  }
  // de slotenmaker hoort bij het bouw-genre: een extra dienst bij Castell,
  // ook op databases waar de zaak al bestond
  const castell = db.data.suppliers.find(s => s.code === 'CASTELL');
  if (castell && Array.isArray(castell.services) && !castell.services.some(x => x.id === 'b6')) {
    castell.services.push({ id: 'b6', name: 'Slotenmaker: buitengesloten of slot vervangen',
      desc: 'Zonder schade naar binnen en direct een goed slot erin.', price: 120, duurMin: 60, soort: 'dienst' });
  }
};
