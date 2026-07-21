/* De golf- en countryclub: teetimes zonder dubbele flights, de pro's met
   lessen, de maandbeker en de baanstatus van de greenkeeper.
   Opslag in db.data.golfclub[code]. */

const { MAX_LIJST, TIJD, DATUM, maakHulp } = require('../genrehulp');

module.exports = ({ db, save, crypto, schoon }) => {
  const { nu, vandaag, id, cap, bak } = maakHulp({ db, save, crypto });

  function demoGolf() {
    const over7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    return {
      naam: 'Club de Golf Sa Roca', holes: 18, par: 72, greenfee: 95, baanStatus: 'open',
      pros: [
        { id: 'p1', naam: 'Iker Sans', les: 'Priveles, 60 min', prijs: 80 },
        { id: 'p2', naam: 'Maud Verhoef', les: 'Korte spel-clinic, 90 min', prijs: 65 }
      ],
      wedstrijden: [
        { id: 'w1', naam: 'Maandbeker', datum: over7, vorm: 'strokeplay', max: 36, inschrijvingen: [] }
      ],
      teetimes: [], lessen: []
    };
  }
  const golfVan = bak('golfclub', demoGolf);

  function golfOverzicht(code) {
    const c = golfVan(code);
    const d = vandaag();
    return {
      naam: c.naam, holes: c.holes, par: c.par, greenfee: c.greenfee, baanStatus: c.baanStatus,
      pros: c.pros, wedstrijden: c.wedstrijden,
      teetimes: c.teetimes.filter(t => t.datum >= d).slice(0, 40),
      lessen: c.lessen.filter(l => l.status !== 'gegeven').slice(0, 30),
      kpi: {
        teetimesVandaag: c.teetimes.filter(t => t.datum === d).length,
        spelersVandaag: c.teetimes.filter(t => t.datum === d).reduce((s, t) => s + t.spelers, 0),
        lessenOpen: c.lessen.filter(l => l.status !== 'gegeven').length,
        inschrijvingen: c.wedstrijden.reduce((s, w) => s + w.inschrijvingen.length, 0)
      }
    };
  }
  function teeBoek(code, b) {
    const c = golfVan(code);
    if (c.baanStatus !== 'open') return { status: 409, error: 'De baan is nu ' + c.baanStatus + '; er kan geen teetime bij.' };
    const naam = schoon(b.naam, 60);
    const datum = String(b.datum || '').slice(0, 10), tijd = String(b.tijd || '');
    const spelers = Math.round(Number(b.spelers));
    if (!naam) return { status: 400, error: 'Op welke naam staat de flight?' };
    if (!DATUM.test(datum)) return { status: 400, error: 'Kies een datum.' };
    if (!TIJD.test(tijd)) return { status: 400, error: 'Kies een starttijd.' };
    if (!(spelers >= 1 && spelers <= 4)) return { status: 400, error: 'Een flight is 1 tot 4 spelers.' };
    const bezet = c.teetimes.find(t => t.datum === datum && t.tijd === tijd);
    if (bezet) return { status: 409, error: 'De tee van ' + tijd + ' is al vergeven aan ' + bezet.naam + '.' };
    const t = { id: id('t'), naam, datum, tijd, spelers, prijs: spelers * c.greenfee, gemaakt: nu() };
    c.teetimes.unshift(t); c.teetimes.sort((a, x) => (a.datum + a.tijd).localeCompare(x.datum + x.tijd));
    cap(c.teetimes, MAX_LIJST); save();
    return { ok: true, teetime: t };
  }
  function teeWeg(code, teeId) {
    const c = golfVan(code);
    const voor = c.teetimes.length;
    c.teetimes = c.teetimes.filter(t => t.id !== String(teeId || ''));
    if (c.teetimes.length === voor) return { status: 404, error: 'Teetime niet gevonden.' };
    save(); return { ok: true };
  }
  function golfLes(code, b) {
    const c = golfVan(code);
    const pro = c.pros.find(p => p.id === String(b.proId || ''));
    if (!pro) return { status: 404, error: 'Deze pro staat niet op de club.' };
    const naam = schoon(b.naam, 60);
    const datum = String(b.datum || '').slice(0, 10), tijd = String(b.tijd || '');
    if (!naam) return { status: 400, error: 'Voor wie is de les?' };
    if (!DATUM.test(datum) || !TIJD.test(tijd)) return { status: 400, error: 'Kies een datum en tijd.' };
    const bezet = c.lessen.find(l => l.proId === pro.id && l.datum === datum && l.tijd === tijd && l.status !== 'gegeven');
    if (bezet) return { status: 409, error: pro.naam + ' staat dan al op de mat voor ' + bezet.naam + '.' };
    const l = { id: id('l'), proId: pro.id, pro: pro.naam, naam, datum, tijd, prijs: pro.prijs, status: 'geboekt', gemaakt: nu() };
    c.lessen.unshift(l); cap(c.lessen, MAX_LIJST); save();
    return { ok: true, les: l };
  }
  function golfLesKlaar(code, lesId) {
    const c = golfVan(code);
    const l = c.lessen.find(x => x.id === String(lesId || ''));
    if (!l) return { status: 404, error: 'Les niet gevonden.' };
    l.status = 'gegeven'; save();
    return { ok: true, les: l };
  }
  function wedstrijdIn(code, b) {
    const c = golfVan(code);
    const w = c.wedstrijden.find(x => x.id === String(b.wedstrijdId || ''));
    if (!w) return { status: 404, error: 'Deze wedstrijd staat niet op de kalender.' };
    const naam = schoon(b.naam, 60);
    if (!naam) return { status: 400, error: 'Wie schrijft zich in?' };
    if (w.inschrijvingen.length >= w.max) return { status: 409, error: w.naam + ' zit vol (' + w.max + ' spelers).' };
    if (w.inschrijvingen.find(i => i.naam.toLowerCase() === naam.toLowerCase())) return { status: 409, error: naam + ' staat al op de lijst.' };
    const hcp = Number(b.handicap);
    const i = { naam, handicap: Number.isFinite(hcp) ? Math.round(hcp * 10) / 10 : null, gemeld: nu() };
    w.inschrijvingen.push(i); save();
    return { ok: true, wedstrijd: w };
  }
  function baanZet(code, statusWens) {
    const c = golfVan(code);
    if (!['open', 'onderhoud', 'gesloten'].includes(statusWens)) return { status: 400, error: 'Kies open, onderhoud of gesloten.' };
    c.baanStatus = statusWens; save();
    return { ok: true, baanStatus: c.baanStatus };
  }

  return { golfclub: { overzicht: golfOverzicht, teeBoek, teeWeg, les: golfLes, lesKlaar: golfLesKlaar, wedstrijdIn, baanZet } };
};
