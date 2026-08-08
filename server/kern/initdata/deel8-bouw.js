/* Boot-datalaag, deel 8: het bouw-genre (timmerman, loodgieter, elektricien,
   bouwvakker) op de vakwerk-motor, plus de demo-zaak Castell Bouw & Ambacht.
   Draait elke start met het ensure-patroon, dus ook op een bestaande demo-db. */
module.exports = (ctx) => {
  const { db, ensureSupplierDefaults } = ctx;
  if (!db.data.supplierTypes.bouw)
    db.data.supplierTypes.bouw = { label: 'Bouw & installatie', icon: 'werk', caps: ['services', 'location', 'pricing'] };
  const bestaandCastell = db.data.suppliers.find(s => s.code === 'CASTELL');
  if (bestaandCastell) bestaandCastell.geseed = true;  // ook op een database van voor het merkteken
  if (!bestaandCastell) {
    const p = {
      geseed: true,
      code: 'CASTELL', name: 'Castell Bouw & Ambacht', type: 'bouw', city: 'Ibiza',
      vak: 'Timmerman, loodgieter & elektricien',
      loc: { lat: 38.917, lng: 1.41, label: 'Sant Rafel, Ibiza' }, rate: 0.1, menu: [], photos: [],
      services: [
        { id: 'b1', name: 'Timmerman aan huis, per uur', desc: 'Maatwerk, deuren, kozijnen en herstel; eigen gereedschap mee.', price: 68, duurMin: 60, soort: 'dienst' },
        { id: 'b2', name: 'Loodgieter, lekkage of sanitair', desc: 'Opsporen en verhelpen van lekkages, sanitair plaatsen.', price: 85, duurMin: 90, soort: 'dienst' },
        { id: 'b3', name: 'Elektricien, groepenkast of storing', desc: 'Storing zoeken, groepen bijplaatsen, verlichting aanleggen.', price: 85, duurMin: 90, soort: 'dienst' },
        { id: 'b4', name: 'Spoedklus binnen 4 uur', desc: 'Vandaag nog iemand op de stoep, voorrang op de planning.', price: 150, duurMin: 120, soort: 'dienst' },
        { id: 'b5', name: 'Klusdag met twee vaklieden', desc: 'Een hele dag, twee man, voor de grotere klussen op de villa.', price: 980, duurMin: 480, soort: 'dienst' }
      ]
    };
    db.data.suppliers.push(p);
    ensureSupplierDefaults(p);
  }
};
