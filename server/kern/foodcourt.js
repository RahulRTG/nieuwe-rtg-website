/* De RTG Food Court: de restaurant-verzamelplek in de leden-app, in de stijl
   van een reserveerplatform (TheFork). Alle restaurants die tafels reserveren
   op een rij; per restaurant een keuken, prijsklasse, een korte omschrijving en
   een eventueel ledenvoordeel. Kies een datum en gezelschap en de Food Court
   toont de vrije tijdsloten; reserveren gaat via het bestaande /api/reserveer
   (de zaak beslist, zoals altijd).

   Geen echte restaurantmerken; RTG-huispartners. Volgt maakFoodcourt(state). */

const KEUKENS = ['Mediterraans', 'Japans', 'Italiaans', 'Frans', 'Spaans (tapas)', 'Visrestaurant', 'Steakhouse', 'Fusion', 'Vegetarisch', 'Grill'];
const PRIJZEN = ['€€', '€€€', '€€€€'];
const LUNCH = ['12:00', '12:30', '13:00', '13:30', '14:00'];
const DINER = ['18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'];

function maakFoodcourt({ db, save, crypto }) {
  const nu = () => new Date().toISOString();
  const vandaag = () => new Date().toISOString().slice(0, 10);
  function hash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // een eetgelegenheid is een partner die tafelreserveringen aanneemt
  function isEetgelegenheid(s) {
    return !!s && ((db.data.supplierTypes[s.type] || {}).caps || []).includes('reservations') && Array.isArray(s.tables) && s.tables.length > 0;
  }

  function seed() {
    if (!db.data.suppliers || !Array.isArray(db.data.suppliers)) return;
    let veranderd = false;
    for (const s of db.data.suppliers) {
      if (!isEetgelegenheid(s) || s.foodcourt) continue;
      const h = hash(s.code || s.name || 'x');
      s.foodcourt = {
        keuken: KEUKENS[h % KEUKENS.length],
        prijs: PRIJZEN[(h >>> 3) % PRIJZEN.length],
        tagline: 'Reserveer je tafel in een tik.',
        // een enkel restaurant biedt de leden iets extra's van het huis (aanbod van de partner zelf)
        deal: (h % 3 === 0) ? 'Glas cava van het huis bij aankomst (leden)' : null
      };
      veranderd = true;
    }
    if (veranderd) save();
  }

  function capaciteit(s) { return (s.tables || []).reduce((n, t) => n + (t.seats || 0), 0); }
  function bezetOp(s, datum, tijd) {
    return (db.data.reserveringen || [])
      .filter(r => r.supplierCode === s.code && r.datum === datum && r.tijd === tijd && r.status !== 'geannuleerd' && r.status !== 'geweigerd')
      .reduce((n, r) => n + (r.personen || 0), 0);
  }

  function kaart(s) {
    const fc = s.foodcourt || {};
    return {
      code: s.code, naam: s.name, stad: s.city || null,
      keuken: fc.keuken || 'Restaurant', prijs: fc.prijs || PRIJZEN[0],
      tagline: fc.tagline || 'Reserveer je tafel in een tik.',
      deal: fc.deal || null,
      open: !(s.settings && s.settings.reservationsOpen === false),
      capaciteit: capaciteit(s)
    };
  }

  function overzicht() {
    seed();
    const eet = (db.data.suppliers || []).filter(isEetgelegenheid).map(kaart);
    // keukens als filter, en de open zaken eerst
    const keukens = [...new Set(eet.map(e => e.keuken))].sort();
    eet.sort((a, b) => (b.open - a.open) || a.naam.localeCompare(b.naam));
    return { ok: true, restaurants: eet, keukens, aantal: eet.length, valuta: 'EUR' };
  }

  /* De vrije tijdsloten voor een restaurant op een datum en gezelschap. Lunch en
     diner; een slot is vol als de zitplaatsen op zijn. Alleen vandaag of later,
     en op vandaag geen tijden meer die al voorbij zijn. */
  function tijden(code, datumIn, personenIn) {
    const s = (db.data.suppliers || []).find(x => x.code === String(code || '') && isEetgelegenheid(x));
    if (!s) return { status: 404, error: 'Restaurant niet gevonden.' };
    const datum = /^\d{4}-\d{2}-\d{2}$/.test(String(datumIn || '')) ? String(datumIn) : vandaag();
    if (datum < vandaag()) return { status: 400, error: 'Kies een datum vanaf vandaag.' };
    const personen = Math.min(20, Math.max(1, parseInt(personenIn, 10) || 2));
    const open = !(s.settings && s.settings.reservationsOpen === false);
    const cap = capaciteit(s);
    const nuTijd = new Date().toTimeString().slice(0, 5);
    const bouw = (lijst, dienst) => lijst
      .filter(t => datum > vandaag() || t > nuTijd)
      .map(t => ({ tijd: t, dienst, vol: !open || (bezetOp(s, datum, t) + personen > cap) }));
    return {
      ok: true, restaurant: { code: s.code, naam: s.name, keuken: (s.foodcourt || {}).keuken || 'Restaurant', deal: (s.foodcourt || {}).deal || null },
      datum, personen, open,
      slots: [...bouw(LUNCH, 'lunch'), ...bouw(DINER, 'diner')]
    };
  }

  return { foodcourt: { KEUKENS, overzicht, tijden, seed, isEetgelegenheid } };
}

module.exports = { maakFoodcourt, FOODCOURT_KEUKENS: KEUKENS };
