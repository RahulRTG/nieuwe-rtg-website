/* De sport- en fitnessclub: leden met clubpas, check-in bij de receptie,
   groepslessen met capaciteit, padel- en tennisbanen zonder dubbele
   boekingen en personal-trainingverzoeken. Opslag in db.data.fitclub[code]. */

const { MAX_LIJST, TIJD, DATUM, maakHulp } = require('../genrehulp');
const LIDSOORTEN = { maand: 89, jaar: 890, dag: 25 };

module.exports = ({ db, save, crypto, schoon }) => {
  const { nu, vandaag, id, pas, cap, bak } = maakHulp({ db, save, crypto });

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

  return { fitclub: { overzicht: fitOverzicht, lidMaak, checkZet, lesIn, baanBoek: fitBaanBoek, ptVraag, ptStatus } };
};
