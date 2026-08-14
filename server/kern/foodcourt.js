/* De RTG Food Court: de restaurant-verzamelplek in de leden-app, in de stijl
   van een reserveerplatform (TheFork). Alle restaurants die tafels reserveren
   op een rij; per restaurant een keuken, prijsklasse, een korte omschrijving en
   een eventueel ledenvoordeel. Kies een datum en gezelschap en de Food Court
   toont de vrije tijdsloten; reserveren gaat via het bestaande /api/reserveer
   (de zaak beslist, zoals altijd).

   Geen echte restaurantmerken; RTG-huispartners. Volgt maakFoodcourt(state).

   LET OP DE NAAM. Er is een TWEEDE foodcourt in dit huis, en het is iets
   anders: `kern/gast/foodcourt.js` is het MANDJE BIJ MEER LOKETTEN (je haalt
   bij drie keukens tegelijk af, één mandje, per zaak een rekening). Dit
   bestand is de RESERVEERPLEIN-kant: alle restaurants op een rij met hun vrije
   tijdsloten. Ze delen geen enkele regel code en horen dat ook niet te doen --
   het zijn twee producten die toevallig dezelfde marktnaam dragen. Wie hier
   iets aan de bestelkant zoekt, zit in het verkeerde bestand. */

const KEUKENS = ['Mediterraans', 'Japans', 'Italiaans', 'Frans', 'Spaans (tapas)', 'Visrestaurant', 'Steakhouse', 'Fusion', 'Vegetarisch', 'Grill'];
const PRIJZEN = ['€€', '€€€', '€€€€'];
const LUNCH = ['12:00', '12:30', '13:00', '13:30', '14:00'];
const DINER = ['18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'];

/* De klok is die van de ZAAK. Hier stond de datum in UTC en de tijd in de zone
   van de server -- twee verschillende klokken in dezelfde functie, wat rond
   middernacht een tijdslot van gisteren of morgen opleverde. De zone komt uit
   kern/tijdzone.js, dezelfde die de vakwerk-agenda en de Mall gebruiken. */
const { nuBijZaak } = require('./tijdzone');
const naarMinuten = (t) => Number(String(t).slice(0, 2)) * 60 + Number(String(t).slice(3, 5));

function maakFoodcourt({ db, save, crypto }) {
  const nu = () => new Date().toISOString();
  function hash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // een eetgelegenheid is een partner die tafelreserveringen aanneemt
  function isEetgelegenheid(s) {
    return !!s && (db.capsVan(s)).includes('reservations') && Array.isArray(s.tables) && s.tables.length > 0;
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
    const menu = Array.isArray(s.menu) ? s.menu : [];
    const rs = (db.data.reviewStats || {})[s.code];
    const bezorg = db.data.horeca && db.data.horeca[s.code] && db.data.horeca[s.code].bezorg;
    const zones = bezorg && Array.isArray(bezorg.zones) ? bezorg.zones : [];
    const minimum = (veld) => {
      const waarden = zones.map(z => Number(z && z[veld])).filter(n => Number.isFinite(n) && n > 0);
      return waarden.length ? Math.min(...waarden) : null;
    };
    const fotos = (Array.isArray(s.photos) ? s.photos : []).slice(0, 6);
    if (s.salon && s.salon.foto && !fotos.includes(s.salon.foto) && fotos.length < 6) fotos.push(s.salon.foto);
    return {
      code: s.code, naam: s.name, stad: s.city || null,
      keuken: fc.keuken || 'Restaurant', prijs: fc.prijs || PRIJZEN[0],
      tagline: fc.tagline || 'Reserveer je tafel in een tik.',
      deal: fc.deal || null,
      bio: s.salon && s.salon.bio ? String(s.salon.bio).slice(0, 200) : null,
      fotos,
      open: !(s.settings && s.settings.ordersOpen === false),
      reserverenOpen: !(s.settings && s.settings.reservationsOpen === false),
      capaciteit: capaciteit(s),
      rating: rs && rs.aantal ? { score: Math.round((rs.som / rs.aantal) * 10) / 10, aantal: rs.aantal } : null,
      menuAantal: menu.length,
      categorieen: [...new Set(menu.map(m => m && m.cat).filter(Boolean))].slice(0, 12),
      vanafCenten: minimumMenuPrijs(menu),
      bezorgen: zones.length > 0,
      bezorgOpen: zones.length > 0 && bezorg.open !== false,
      bezorgMinuten: minimum('minuten'),
      bezorgkostenVanaf: minimum('kostenCenten') || (zones.some(z => Number(z && z.kostenCenten) === 0) ? 0 : null),
      minimumVanaf: minimum('minimumCenten'),
      gratisVanaf: minimum('gratisVanafCenten')
    };
  }

  function minimumMenuPrijs(menu) {
    const prijzen = menu.map(m => Number(m && (m.centen != null ? m.centen : Number(m.price) * 100)))
      .filter(n => Number.isFinite(n) && n >= 0);
    return prijzen.length ? Math.round(Math.min(...prijzen)) : null;
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
    const hier = nuBijZaak(s);
    const datum = /^\d{4}-\d{2}-\d{2}$/.test(String(datumIn || '')) ? String(datumIn) : hier.datum;
    if (datum < hier.datum) return { status: 400, error: 'Kies een datum vanaf vandaag.' };
    const personen = Math.min(20, Math.max(1, parseInt(personenIn, 10) || 2));
    const open = !(s.settings && s.settings.reservationsOpen === false);
    const cap = capaciteit(s);
    const bouw = (lijst, dienst) => lijst
      .filter(t => datum > hier.datum || naarMinuten(t) > hier.minuten)
      .map(t => ({ tijd: t, dienst, vol: !open || (bezetOp(s, datum, t) + personen > cap) }));
    return {
      ok: true, restaurant: { code: s.code, naam: s.name, keuken: (s.foodcourt || {}).keuken || 'Restaurant', deal: (s.foodcourt || {}).deal || null },
      datum, personen, open,
      slots: [...bouw(LUNCH, 'lunch'), ...bouw(DINER, 'diner')]
    };
  }

  return { foodcourt: { KEUKENS, LUNCH, DINER, overzicht, tijden, seed, isEetgelegenheid } };
}

module.exports = { maakFoodcourt, LUNCH, DINER };
