/* De losse verblijf-pagina (hotels, appartementen en villa's): alle overnachters
   op een rij, met hun vrije kamers en de vanaf-prijs per nacht. Reserveren loopt
   via het bestaande /api/verblijf (het huis bevestigt; nooit de belofte dat een
   boeking al rond is). Alleen een leeslaag; de logica woont in kern/verblijf.js.

   Volgt het vaste kern-patroon maakLogies(state). */

function maakLogies({ db }) {
  const TYPES = { hotel: 'Hotel', apartment: 'Appartement', villa: "Villa's & fincas" };

  function overzicht() {
    const huizen = (db.data.suppliers || [])
      .filter(s => TYPES[s.type] && Array.isArray(s.rooms) && s.rooms.some(r => r.available) &&
        !(s.mall && s.mall.verborgen) && (!s.settings || s.settings.ordersOpen !== false))
      .map(s => {
        const vrij = s.rooms.filter(r => r.available);
        const prijzen = vrij.map(r => Math.max(0, Number(r.price) || 0));
        return {
          code: s.code, naam: s.name, stad: s.city || null, soort: s.type, soortLabel: TYPES[s.type],
          tagline: (s.mall && s.mall.tagline) || null,
          kamers: vrij.map(r => ({ id: r.id, naam: r.name, omschrijving: r.desc || null, prijs: Math.max(0, Number(r.price) || 0) })),
          vanaf: prijzen.length ? Math.min(...prijzen) : null
        };
      });
    return {
      ok: true, huizen, aantal: huizen.length, valuta: 'EUR',
      opmerking: "Verblijven bij RTG-partners: hotels, appartementen en villa's. Je vraagt een verblijf aan; het huis bevestigt. Prijzen per nacht, in euro."
    };
  }

  return { logies: { overzicht } };
}

module.exports = { maakLogies };
