/* Sportclub, deelbestand "stadion": de plattegrond die de club ZELF tekent
   (tribunevakken met capaciteit en prijs, voorzieningen als horeca, wc,
   entree en ehbo op de kaart), de ticketverkoop per vak (capaciteit bewaakt,
   oplichtende code, afrekenen aan de poort via de kassa), de eenmalige scan
   bij de entree en mijn tickets. Krijgt de gedeelde ctx van ./index.js. */
module.exports = (ctx) => {
  const { crypto, save, schoon, id, nu, club, clubs, seed, vindWedstrijd, VOORZIENINGEN } = ctx;

  function plattegrond(code) {
    seed();
    const c = club(code);
    return { ok: true, vakken: c.plattegrond.vakken, voorzieningen: c.plattegrond.voorzieningen, soorten: VOORZIENINGEN };
  }
  function plattegrondZet(code, data) {
    data = data || {};
    const c = club(code);
    if (Array.isArray(data.vakken)) {
      const vakken = data.vakken.slice(0, 40).map(v => ({
        id: schoon(v.id, 20) || id('vk'), naam: schoon(v.naam, 60) || 'Vak',
        capaciteit: Math.max(1, Math.min(100000, Math.round(Number(v.capaciteit) || 100))),
        prijsCenten: Math.max(0, Math.min(1000000, Math.round(Number(v.prijsCenten) || 0)))
      }));
      if (!vakken.length) return { status: 400, error: 'Een stadion heeft minstens een vak.' };
      c.plattegrond.vakken = vakken;
    }
    if (Array.isArray(data.voorzieningen)) {
      c.plattegrond.voorzieningen = data.voorzieningen.slice(0, 60).map(v => ({
        id: schoon(v.id, 20) || id('vz'), soort: VOORZIENINGEN.includes(v.soort) ? v.soort : 'horeca',
        naam: schoon(v.naam, 60) || 'Voorziening', bij: schoon(v.bij, 20) || null
      }));
    }
    save();
    return plattegrond(code);
  }

  function ticketKoop(code, sess, codenaam, data) {
    data = data || {};
    const c = club(code);
    const w = vindWedstrijd(c, String(data.wedstrijdId || ''));
    if (!w) return { status: 404, error: 'Wedstrijd niet gevonden.' };
    if (!w.thuis) return { status: 409, error: 'Voor uitwedstrijden verkoopt de club hier geen kaarten.' };
    if (w.uitslag) return { status: 409, error: 'Deze wedstrijd is al gespeeld.' };
    const vak = c.plattegrond.vakken.find(x => x.id === String(data.vak || ''));
    if (!vak) return { status: 404, error: 'Kies een vak op de plattegrond.' };
    const aantal = Math.max(1, Math.min(8, Math.round(Number(data.aantal) || 1)));
    const bezet = c.tickets.filter(t => t.wedstrijdId === w.id && t.vak === vak.id && t.status !== 'geannuleerd')
      .reduce((s, t) => s + t.aantal, 0);
    if (bezet + aantal > vak.capaciteit) return { status: 409, error: vak.naam + ' is (bijna) vol: nog ' + Math.max(0, vak.capaciteit - bezet) + ' plaats(en).' };
    const t = { id: id('tk'), code: 'ST-' + crypto.randomBytes(3).toString('hex').toUpperCase(), wedstrijdId: w.id,
      vak: vak.id, aantal, prijsCenten: vak.prijsCenten * aantal, key: sess.key,
      codenaam: schoon(codenaam, 60) || 'Supporter', status: 'gereserveerd', at: nu() };
    c.tickets.unshift(t);
    c.tickets = c.tickets.slice(0, 100000);
    save();
    return { ok: true, ticket: { code: t.code, vak: vak.naam, aantal, prijsCenten: t.prijsCenten,
      wedstrijd: (w.thuis ? 'FC ' : '') + 'RTG - ' + w.tegenstander, datum: w.datum, tijd: w.tijd,
      let: 'Afrekenen aan de poort: contant of RTG Pay bij de kassa.' } };
  }
  function ticketScan(code, ticketCode) {
    const c = club(code);
    const t = c.tickets.find(x => x.code === String(ticketCode || '').trim().toUpperCase());
    if (!t) return { ok: true, geldig: false, reden: 'Deze code kennen we niet.' };
    if (t.status === 'gescand') return { ok: true, geldig: false, reden: 'Al gescand bij de poort.' };
    const w = vindWedstrijd(c, t.wedstrijdId);
    t.status = 'gescand';
    t.gescandAt = nu();
    save();
    const vak = c.plattegrond.vakken.find(x => x.id === t.vak);
    return { ok: true, geldig: true, ticket: { naam: t.codenaam, aantal: t.aantal, vak: vak ? vak.naam : t.vak,
      wedstrijd: w ? 'RTG - ' + w.tegenstander : '?', prijsCenten: t.prijsCenten } };
  }
  function mijnTickets(key) {
    seed();
    const uit = [];
    for (const s of clubs()) {
      const c = club(s.code);
      for (const t of c.tickets.filter(x => x.key === key).slice(0, 10)) {
        const w = vindWedstrijd(c, t.wedstrijdId);
        const vak = c.plattegrond.vakken.find(x => x.id === t.vak);
        uit.push({ code: t.code, club: s.name, wedstrijd: w ? 'RTG - ' + w.tegenstander : '?', datum: w ? w.datum : '',
          tijd: w ? w.tijd : '', vak: vak ? vak.naam : t.vak, aantal: t.aantal, prijsCenten: t.prijsCenten, status: t.status });
      }
    }
    return { ok: true, tickets: uit };
  }

  return { plattegrond, plattegrondZet, ticketKoop, ticketScan, mijnTickets };
};
