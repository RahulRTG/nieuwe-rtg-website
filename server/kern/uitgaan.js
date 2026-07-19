/* De losse uitgaan-pagina (bars, clubs en beachclubs): alle nachtadressen op een
   rij met hun avonden. Aanmelden loopt via het bestaande /api/event/rsvp; de
   codenaam is de toegang. Een demo-avond per zaak zodat er meteen iets te zien
   is; echte events maakt het kantoor van de zaak zelf.

   Volgt het vaste kern-patroon maakUitgaan(state). */

function maakUitgaan({ db, save, crypto }) {
  const TYPES = { bar: 'Bar', club: 'Club', beachclub: 'Beachclub' };
  const nu = () => new Date().toISOString();
  const overNdagen = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

  // een demo-avond per nachtadres, eenmalig, zodat de gastenlijst iets toont
  function seed() {
    if (!Array.isArray(db.data.suppliers)) return;
    if (db.data._uitgaanSeed) return;
    for (const s of db.data.suppliers) {
      if (!TYPES[s.type]) continue;
      if (!Array.isArray(s.events)) s.events = [];
      if (!s.events.length) {
        s.events.push({
          id: crypto.randomBytes(4).toString('hex'),
          name: 'Sunset Session', date: overNdagen(3), time: '20:00',
          capacity: 120, published: true, guests: [], at: nu()
        });
      }
    }
    db.data._uitgaanSeed = true;
    save();
  }

  function overzicht() {
    seed();
    const zaken = (db.data.suppliers || [])
      .filter(s => TYPES[s.type] && !(s.mall && s.mall.verborgen))
      .map(s => {
        const events = (s.events || []).filter(e => e.published).map(e => {
          const taken = (e.guests || []).reduce((n, g) => n + (g.qty || 0), 0);
          return {
            id: e.id, naam: e.name, datum: e.date || null, tijd: e.time || null,
            capaciteit: e.capacity || 0, vrij: Math.max(0, (e.capacity || 0) - taken)
          };
        });
        return {
          code: s.code, naam: s.name, stad: s.city || null, soort: s.type, soortLabel: TYPES[s.type],
          tagline: (s.mall && s.mall.tagline) || null, events, aantal: events.length
        };
      })
      .filter(z => z.events.length);
    return {
      ok: true, zaken, aantal: zaken.length,
      opmerking: 'Bars, clubs en beachclubs met hun avonden. Meld je aan op de gastenlijst; je codenaam is je toegang.'
    };
  }

  return { uitgaan: { overzicht, seed } };
}

module.exports = { maakUitgaan };
