/* De personeelslaag: geklokte uren (klok), de vertrouwelijke lijn naar de
   RTG-vertrouwenspersoon (trust) en het weekrooster. SHIFT_NAMES is pure data;
   de functies dragen db + accounts en komen uit maakPersoneel(state).

   De vertrouwenslijn is strikt vertrouwelijk: de werkgever ziet er niets van
   (geen activiteit, geen melding); alleen de backoffice leest en antwoordt. */

const SHIFT_NAMES = ['Ochtend 07:00-15:00', 'Avond 15:00-23:00', 'Vrij'];

function maakPersoneel({ db, accounts }) {
  const urenVan = ms => Math.round(ms / 360000) / 10; // uren met een decimaal

  function klokVan(code, staffId) {
    const nu = Date.now();
    const week = new Date(nu - 6 * 86400000).toISOString().slice(0, 10);
    const vandaag = new Date().toISOString().slice(0, 10);
    const mijn = (db.data.klok[code] || []).filter(e => e.staffId === staffId);
    const duur = e => (e.out ? new Date(e.out) : new Date()) - new Date(e.in);
    return {
      open: !!mijn.find(e => !e.out),
      vandaagUren: urenVan(mijn.filter(e => e.in.slice(0, 10) === vandaag).reduce((s, e) => s + duur(e), 0)),
      weekUren: urenVan(mijn.filter(e => e.in.slice(0, 10) >= week).reduce((s, e) => s + duur(e), 0))
    };
  }

  function trustVan(code, staffId) {
    const t = db.data.trustLine.find(x => x.code === code && x.staffId === staffId);
    return t ? { anon: t.anon, messages: t.messages.slice(-30) } : { anon: false, messages: [] };
  }

  function scheduleFor(code) {
    const staff = accounts.listStaff(code).map(accounts.publicStaff);
    const days = [];
    const now = new Date();
    const dayNames = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
    for (let d = 0; d < 7; d++) {
      const date = new Date(now.getTime() + d * 86400000);
      const doy = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
      days.push({
        date: date.toISOString().slice(0, 10),
        label: (d === 0 ? 'Vandaag' : d === 1 ? 'Morgen' : dayNames[date.getDay()]),
        staff: staff.map((m, i) => ({
          id: m.id, name: m.name, role: m.role,
          // managers vaker overdag; iedereen om de paar dagen vrij
          shift: SHIFT_NAMES[(m.id * 3 + doy + (m.role === 'manager' ? 0 : i)) % 3]
        }))
      });
    }
    return { days, shifts: SHIFT_NAMES };
  }

  return { urenVan, klokVan, trustVan, scheduleFor };
}

module.exports = { SHIFT_NAMES, maakPersoneel };
