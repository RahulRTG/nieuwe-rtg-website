/* RTG Clubs: twee clubgenres op een kern. De golf- en countryclub (teetimes
   zonder dubbele flights, de pro's met lessen, de maandbeker en de baanstatus
   van de greenkeeper) en de sport- en fitnessclub (leden met clubpas,
   check-in bij de receptie, groepslessen met capaciteit, padel- en
   tennisbanen zonder dubbele boekingen en personal-trainingverzoeken).
   Opslag per club in db.data.golfclub[code] en db.data.fitclub[code]. */

const MAX_LIJST = 200;
const TIJD = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

module.exports = ({ db, save, crypto, schoon }) => {
  const nu = () => new Date().toISOString();
  const vandaag = () => nu().slice(0, 10);
  const id = p => p + crypto.randomBytes(3).toString('hex');
  const pas = p => p + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
  const cap = (lijst, max) => { if (lijst.length > max) lijst.length = max; };
  const bak = (naam, maker) => (code) => {
    if (!db.data[naam]) db.data[naam] = {};
    if (!db.data[naam][code]) { db.data[naam][code] = maker(); save(); }
    return db.data[naam][code];
  };

  /* ---- de golf- en countryclub ---- */
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

  /* ---- de sport- en fitnessclub ---- */
  const LIDSOORTEN = { maand: 89, jaar: 890, dag: 25 };
  function demoFit() {
    return {
      naam: 'Fortia Club', baanUurprijs: 24, lidSoorten: LIDSOORTEN,
      leden: [
        { id: 'f1', naam: 'Lotte Vermeer', soort: 'jaar', pas: 'F-2A41', binnen: false, sinds: '2026-01-12' },
        { id: 'f2', naam: 'Daan Kuipers', soort: 'maand', pas: 'F-9C07', binnen: false, sinds: '2026-05-03' },
        { id: 'f3', naam: 'Amira Sol', soort: 'jaar', pas: 'F-5E88', binnen: false, sinds: '2025-11-20' }
      ],
      lessen: [
        { id: 'g1', naam: 'Yoga bij zonsopkomst', tijd: '08:00', capaciteit: 12, deelnemers: [] },
        { id: 'g2', naam: 'HIIT op het dakterras', tijd: '18:00', capaciteit: 14, deelnemers: [] },
        { id: 'g3', naam: 'Spinning', tijd: '19:00', capaciteit: 10, deelnemers: [] }
      ],
      banen: [
        { id: 'b1', naam: 'Padel 1' }, { id: 'b2', naam: 'Padel 2' }, { id: 'b3', naam: 'Tennis (gravel)' }
      ],
      baanboekingen: [], checkins: [], pt: []
    };
  }
  const fitVan = bak('fitclub', demoFit);

  function fitOverzicht(code) {
    const c = fitVan(code);
    const d = vandaag();
    return {
      naam: c.naam, lidSoorten: c.lidSoorten, baanUurprijs: c.baanUurprijs,
      leden: c.leden.slice(0, 40), lessen: c.lessen,
      banen: c.banen, baanboekingen: c.baanboekingen.filter(b => b.datum >= d).slice(0, 40),
      pt: c.pt.slice(0, 20),
      kpi: {
        leden: c.leden.length,
        binnenNu: c.leden.filter(l => l.binnen).length,
        checkinsVandaag: c.checkins.filter(x => x.moment.slice(0, 10) === d).length,
        lesplekkenVrij: c.lessen.reduce((s, l) => s + Math.max(0, l.capaciteit - l.deelnemers.length), 0),
        banenVandaag: c.baanboekingen.filter(b => b.datum === d).length,
        ptOpen: c.pt.filter(p => p.status === 'aangevraagd').length
      }
    };
  }
  function lidMaak(code, b) {
    const c = fitVan(code);
    const naam = schoon(b.naam, 60);
    const soort = LIDSOORTEN[b.soort] != null ? b.soort : null;
    if (!naam) return { status: 400, error: 'Hoe heet het nieuwe lid?' };
    if (!soort) return { status: 400, error: 'Kies dag, maand of jaar.' };
    if (c.leden.find(l => l.naam.toLowerCase() === naam.toLowerCase())) return { status: 409, error: naam + ' is al lid van de club.' };
    const lid = { id: id('f'), naam, soort, pas: pas('F'), binnen: false, sinds: vandaag() };
    c.leden.unshift(lid); cap(c.leden, 500); save();
    return { ok: true, lid, prijs: LIDSOORTEN[soort] };
  }
  function checkZet(code, lidId, binnen) {
    const c = fitVan(code);
    const lid = c.leden.find(l => l.id === String(lidId || ''));
    if (!lid) return { status: 404, error: 'Dit lid staat niet in het bestand.' };
    if (lid.binnen === !!binnen) return { status: 409, error: lid.naam + ' is al ' + (binnen ? 'binnen' : 'buiten') + '.' };
    lid.binnen = !!binnen;
    if (binnen) { c.checkins.unshift({ lidId: lid.id, naam: lid.naam, moment: nu() }); cap(c.checkins, MAX_LIJST); }
    save(); return { ok: true, lid };
  }
  function lesIn(code, b) {
    const c = fitVan(code);
    const les = c.lessen.find(l => l.id === String(b.lesId || ''));
    if (!les) return { status: 404, error: 'Deze les staat niet op het rooster.' };
    const naam = schoon(b.naam, 60);
    if (!naam) return { status: 400, error: 'Wie doet er mee?' };
    if (les.deelnemers.length >= les.capaciteit) return { status: 409, error: les.naam + ' zit vol.' };
    if (les.deelnemers.find(x => x.toLowerCase() === naam.toLowerCase())) return { status: 409, error: naam + ' staat al op de lijst.' };
    les.deelnemers.push(naam); save();
    return { ok: true, les };
  }
  function fitBaanBoek(code, b) {
    const c = fitVan(code);
    const baan = c.banen.find(x => x.id === String(b.baanId || ''));
    if (!baan) return { status: 404, error: 'Deze baan bestaat niet.' };
    const naam = schoon(b.naam, 60);
    const datum = String(b.datum || '').slice(0, 10), van = String(b.van || ''), tot = String(b.tot || '');
    if (!naam) return { status: 400, error: 'Op welke naam staat de baan?' };
    if (!DATUM.test(datum)) return { status: 400, error: 'Kies een datum.' };
    if (!TIJD.test(van) || !TIJD.test(tot) || tot <= van) return { status: 400, error: 'Kies een geldig tijdvak (van voor tot).' };
    const botst = c.baanboekingen.find(x => x.baanId === baan.id && x.datum === datum && van < x.tot && tot > x.van);
    if (botst) return { status: 409, error: baan.naam + ' is dan al geboekt (' + botst.van + ' tot ' + botst.tot + ').' };
    const uren = (Number(tot.slice(0, 2)) * 60 + Number(tot.slice(3)) - Number(van.slice(0, 2)) * 60 - Number(van.slice(3))) / 60;
    const boeking = { id: id('b'), baanId: baan.id, baan: baan.naam, naam, datum, van, tot,
      prijs: Math.round(uren * c.baanUurprijs * 100) / 100 };
    c.baanboekingen.unshift(boeking); cap(c.baanboekingen, MAX_LIJST); save();
    return { ok: true, boeking };
  }
  function ptVraag(code, b) {
    const c = fitVan(code);
    const naam = schoon(b.naam, 60), doel = schoon(b.doel, 160);
    if (!naam || !doel) return { status: 400, error: 'Wie wil trainen, en met welk doel?' };
    const p = { id: id('p'), naam, doel, status: 'aangevraagd', gemaakt: nu() };
    c.pt.unshift(p); cap(c.pt, MAX_LIJST); save();
    return { ok: true, aanvraag: p };
  }
  function ptStatus(code, ptId, statusWens) {
    const c = fitVan(code);
    const p = c.pt.find(x => x.id === String(ptId || ''));
    if (!p) return { status: 404, error: 'Aanvraag niet gevonden.' };
    if (!['ingepland', 'afgerond'].includes(statusWens)) return { status: 400, error: 'Kies ingepland of afgerond.' };
    p.status = statusWens; save();
    return { ok: true, aanvraag: p };
  }

  return {
    golfclub: { overzicht: golfOverzicht, teeBoek, teeWeg, les: golfLes, lesKlaar: golfLesKlaar, wedstrijdIn, baanZet },
    fitclub: { overzicht: fitOverzicht, lidMaak, checkZet, lesIn, baanBoek: fitBaanBoek, ptVraag, ptStatus }
  };
};
