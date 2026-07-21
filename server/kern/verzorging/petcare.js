/* Petcare: het pension met hokken, uitlaatrondes en de trimsalon, met
   dieet- en dagnotities per gast. Bij medische zorgen verwijzen we
   altijd naar de dierenarts; wij behandelen niet zelf.
   Opslag in db.data.petcare[code]. */

const { MAX_LIJST, TIJD, DATUM, maakHulp } = require('../genrehulp');
const HOKKEN = 8, MAX_RONDE = 6;

module.exports = ({ db, save, crypto, schoon }) => {
  const { nu, vandaag, id, cap, bak } = maakHulp({ db, save, crypto });

  function demoPension() {
    const over3 = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    return {
      naam: 'Amics Petcare', hokken: HOKKEN,
      gasten: [
        { id: 'd1', dier: 'hond', naam: 'Bruno', baasje: 'Fam. Vermeer', hok: 1, dieet: 'Twee keer per dag, graanvrij.', tot: over3, notities: [], sinds: vandaag() },
        { id: 'd2', dier: 'kat', naam: 'Mimi', baasje: 'Amira Sol', hok: 2, dieet: '', tot: over3, notities: [], sinds: vandaag() }
      ],
      rondes: [{ id: 'r1', tijd: '09:00', honden: ['Bruno'], status: 'gepland' }],
      trim: []
    };
  }
  const pensionVan = bak('petcare', demoPension);

  function petOverzicht(code) {
    const p = pensionVan(code);
    return {
      naam: p.naam, hokken: p.hokken, gasten: p.gasten, rondes: p.rondes.slice(0, 20),
      trim: p.trim.filter(t => t.status !== 'klaar').slice(0, 20),
      verwijzing: 'Bij medische zorgen verwijzen we altijd naar de dierenarts; wij behandelen niet zelf.',
      kpi: {
        gasten: p.gasten.length, hokkenVrij: p.hokken - p.gasten.length,
        rondesVandaag: p.rondes.filter(r => r.status === 'gepland').length,
        trimOpen: p.trim.filter(t => t.status !== 'klaar').length
      }
    };
  }
  function petCheckIn(code, b) {
    const p = pensionVan(code);
    if (p.gasten.length >= p.hokken) return { status: 409, error: 'Het pension zit vol; alle ' + p.hokken + ' hokken zijn bezet.' };
    const naam = schoon(b.naam, 40), baasje = schoon(b.baasje, 60);
    const dier = ['hond', 'kat', 'anders'].includes(b.dier) ? b.dier : 'hond';
    if (!naam || !baasje) return { status: 400, error: 'Hoe heet het dier, en van wie is het?' };
    const bezet = new Set(p.gasten.map(g => g.hok));
    let hok = 1; while (bezet.has(hok)) hok += 1;
    const g = { id: id('d'), dier, naam, baasje, hok, dieet: schoon(b.dieet, 120), tot: String(b.tot || '').slice(0, 10), notities: [], sinds: vandaag() };
    p.gasten.push(g); save();
    return { ok: true, gast: g };
  }
  function petCheckUit(code, gId) {
    const p = pensionVan(code);
    const voor = p.gasten.length;
    p.gasten = p.gasten.filter(g => g.id !== String(gId || ''));
    if (p.gasten.length === voor) return { status: 404, error: 'Deze gast logeert hier niet.' };
    save(); return { ok: true };
  }
  function petNotitie(code, gId, tekst) {
    const p = pensionVan(code);
    const g = p.gasten.find(x => x.id === String(gId || ''));
    if (!g) return { status: 404, error: 'Deze gast logeert hier niet.' };
    const t = schoon(tekst, 160);
    if (!t) return { status: 400, error: 'Schrijf een korte notitie.' };
    g.notities.unshift({ tekst: t, om: nu() }); cap(g.notities, 20); save();
    return { ok: true, gast: g };
  }
  function rondeMaak(code, tijd) {
    const p = pensionVan(code);
    if (!TIJD.test(String(tijd || ''))) return { status: 400, error: 'Kies een starttijd voor de ronde.' };
    const r = { id: id('r'), tijd: String(tijd), honden: [], status: 'gepland' };
    p.rondes.unshift(r); cap(p.rondes, 40); save();
    return { ok: true, ronde: r };
  }
  function rondeHond(code, rId, naam) {
    const p = pensionVan(code);
    const r = p.rondes.find(x => x.id === String(rId || ''));
    if (!r) return { status: 404, error: 'Ronde niet gevonden.' };
    const n = schoon(naam, 40);
    if (!n) return { status: 400, error: 'Welke hond loopt mee?' };
    if (r.status !== 'gepland') return { status: 409, error: 'Deze ronde is al gelopen.' };
    if (r.honden.length >= MAX_RONDE) return { status: 409, error: 'Een ronde is maximaal ' + MAX_RONDE + ' honden.' };
    if (r.honden.includes(n)) return { status: 409, error: n + ' loopt al mee.' };
    r.honden.push(n); save();
    return { ok: true, ronde: r };
  }
  function rondeKlaar(code, rId) {
    const p = pensionVan(code);
    const r = p.rondes.find(x => x.id === String(rId || ''));
    if (!r) return { status: 404, error: 'Ronde niet gevonden.' };
    r.status = 'gelopen'; save();
    return { ok: true, ronde: r };
  }
  function trimBoek(code, b) {
    const p = pensionVan(code);
    const naam = schoon(b.naam, 40), baasje = schoon(b.baasje, 60);
    const datum = String(b.datum || '').slice(0, 10), tijd = String(b.tijd || '');
    if (!naam || !baasje) return { status: 400, error: 'Welk dier komt er, en van wie is het?' };
    if (!DATUM.test(datum) || !TIJD.test(tijd)) return { status: 400, error: 'Kies een datum en tijd.' };
    const bezet = p.trim.find(t => t.datum === datum && t.tijd === tijd && t.status !== 'klaar');
    if (bezet) return { status: 409, error: 'De trimtafel is dan bezet (' + bezet.naam + ').' };
    const t = { id: id('t'), naam, baasje, datum, tijd, wens: schoon(b.wens, 120), status: 'gepland', gemaakt: nu() };
    p.trim.unshift(t); cap(p.trim, MAX_LIJST); save();
    return { ok: true, afspraak: t };
  }
  function trimKlaar(code, tId) {
    const p = pensionVan(code);
    const t = p.trim.find(x => x.id === String(tId || ''));
    if (!t) return { status: 404, error: 'Afspraak niet gevonden.' };
    t.status = 'klaar'; save();
    return { ok: true, afspraak: t };
  }

  return { petcare: { overzicht: petOverzicht, checkIn: petCheckIn, checkUit: petCheckUit, notitie: petNotitie,
    rondeMaak, rondeHond, rondeKlaar, trimBoek, trimKlaar } };
};
