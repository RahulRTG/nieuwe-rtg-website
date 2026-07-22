/* RTG Alpine: het wintersport- en seizoensresort (demo Val d'Aurora), de
   derde wereld naast Ibiza en de Zuidas. Pistes met kleuren en liften met
   status, het lawineniveau dat alleen de berggids zet (informatief, en
   vanaf niveau 4 gaan de zwarte pistes uit voorzorg dicht), skipassen,
   materiaalverhuur, de skischool met groepslessen en privelessen, en
   chalets met boekingen zonder overlap.
   Opslag per resort in db.data.alpine[code]. */

const KLEUREN = ['groen', 'blauw', 'rood', 'zwart'];
const MAX_LIJST = 200;
const TIJD = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

module.exports = ({ db, save, crypto, schoon }) => {
  const nu = () => new Date().toISOString();
  const vandaag = () => nu().slice(0, 10);
  const id = p => p + crypto.randomBytes(3).toString('hex');
  const cap = (lijst, max) => { if (lijst.length > max) lijst.length = max; };
  const plusDagen = (datum, dagen) => new Date(new Date(datum + 'T12:00:00Z').getTime() + dagen * 86400000).toISOString().slice(0, 10);

  const demoResort = require('./alpine-demo'); // het voorbeeldresort (pure data)
  const R = () => { if (!db.data.alpine) db.data.alpine = {}; return db.data.alpine; };
  function resortVan(code) {
    const r = R();
    if (!r[code]) { r[code] = demoResort(); save(); }
    return r[code];
  }

  function overzicht(code) {
    const r = resortVan(code);
    const d = vandaag();
    return {
      naam: r.naam, hoogte: r.hoogte, dagpas: r.dagpas, lawine: r.lawine,
      pistes: r.pistes, liften: r.liften, materiaal: r.materiaal,
      instructeurs: r.instructeurs, groepslessen: r.groepslessen, chalets: r.chalets,
      passen: r.passen.slice(0, 20), verhuur: r.verhuur.filter(v => !v.ingeleverd).slice(0, 20),
      privelessen: r.privelessen.filter(l => l.status !== 'gegeven').slice(0, 20),
      chaletBoekingen: r.chaletBoekingen.filter(b => b.tot >= d).slice(0, 20),
      regel: 'Het lawineniveau zet alleen de berggids; vanaf niveau 4 gaan de zwarte pistes uit voorzorg dicht.',
      kpi: {
        pistesOpen: r.pistes.filter(p => p.status === 'open').length,
        pistes: r.pistes.length,
        liftenOpen: r.liften.filter(l => l.status === 'open').length,
        passenActief: r.passen.filter(p => p.tot >= d).length,
        verhuurLopend: r.verhuur.filter(v => !v.ingeleverd).length,
        chaletsBezet: new Set(r.chaletBoekingen.filter(b => b.van <= d && b.tot > d).map(b => b.chaletId)).size,
        lawine: r.lawine
      }
    };
  }

  /* ---- de berg zelf: pistes, liften en het lawineniveau ---- */
  function pisteZet(code, pId, statusWens) {
    const r = resortVan(code);
    const p = r.pistes.find(x => x.id === String(pId || ''));
    if (!p) return { status: 404, error: 'Deze piste bestaat niet.' };
    if (!['open', 'dicht'].includes(statusWens)) return { status: 400, error: 'Kies open of dicht.' };
    if (statusWens === 'open' && p.kleur === 'zwart' && r.lawine >= 4) {
      return { status: 409, error: 'Bij lawineniveau ' + r.lawine + ' blijven de zwarte pistes dicht.' };
    }
    p.status = statusWens; save();
    return { ok: true, piste: p };
  }
  function liftZet(code, lId, statusWens) {
    const r = resortVan(code);
    const l = r.liften.find(x => x.id === String(lId || ''));
    if (!l) return { status: 404, error: 'Deze lift bestaat niet.' };
    if (!['open', 'dicht'].includes(statusWens)) return { status: 400, error: 'Kies open of dicht.' };
    l.status = statusWens; save();
    return { ok: true, lift: l };
  }
  function lawineZet(code, niveau) {
    const r = resortVan(code);
    const n = Math.round(Number(niveau));
    if (!(n >= 1 && n <= 5)) return { status: 400, error: 'Het lawineniveau loopt van 1 tot 5.' };
    r.lawine = n;
    let gesloten = [];
    if (n >= 4) {
      for (const p of r.pistes) if (p.kleur === 'zwart' && p.status === 'open') { p.status = 'dicht'; gesloten.push(p.naam); }
    }
    save();
    return { ok: true, lawine: n, gesloten };
  }

  /* ---- skipassen ---- */
  function pasMaak(code, b) {
    const r = resortVan(code);
    const naam = schoon(b.naam, 60);
    const dagen = Math.round(Number(b.dagen));
    if (!naam) return { status: 400, error: 'Op welke naam staat de pas?' };
    if (!(dagen >= 1 && dagen <= 14)) return { status: 400, error: 'Een pas geldt 1 tot 14 dagen.' };
    const pas = { id: 'SKI-' + crypto.randomBytes(2).toString('hex').toUpperCase(), naam, dagen,
      van: vandaag(), tot: plusDagen(vandaag(), dagen - 1), prijs: dagen * r.dagpas, gemaakt: nu() };
    r.passen.unshift(pas); cap(r.passen, MAX_LIJST); save();
    return { ok: true, pas };
  }

  /* ---- materiaalverhuur ---- */
  function huurMaak(code, b) {
    const r = resortVan(code);
    const naam = schoon(b.naam, 60);
    const dagen = Math.round(Number(b.dagen));
    const items = (Array.isArray(b.items) ? b.items : []).map(x => r.materiaal.find(m => m.id === String(x))).filter(Boolean);
    if (!naam) return { status: 400, error: 'Op welke naam staat de verhuur?' };
    if (!(dagen >= 1 && dagen <= 21)) return { status: 400, error: 'Huren kan 1 tot 21 dagen.' };
    if (!items.length) return { status: 400, error: 'Kies het materiaal.' };
    const v = { id: id('v'), naam, dagen, items: items.map(m => m.naam),
      prijs: Math.round(items.reduce((s, m) => s + m.dagprijs, 0) * dagen * 100) / 100,
      ingeleverd: false, gemaakt: nu() };
    r.verhuur.unshift(v); cap(r.verhuur, MAX_LIJST); save();
    return { ok: true, verhuur: v };
  }
  function huurIn(code, vId) {
    const r = resortVan(code);
    const v = r.verhuur.find(x => x.id === String(vId || ''));
    if (!v) return { status: 404, error: 'Verhuur niet gevonden.' };
    if (v.ingeleverd) return { status: 409, error: 'Dit materiaal is al ingeleverd.' };
    v.ingeleverd = true; save();
    return { ok: true, verhuur: v };
  }

  /* ---- de skischool: groepslessen en privelessen ---- */
  function groepIn(code, b) {
    const r = resortVan(code);
    const les = r.groepslessen.find(l => l.id === String(b.lesId || ''));
    if (!les) return { status: 404, error: 'Deze les staat niet op het bord.' };
    const naam = schoon(b.naam, 60);
    if (!naam) return { status: 400, error: 'Wie doet er mee?' };
    if (les.deelnemers.length >= les.capaciteit) return { status: 409, error: les.naam + ' zit vol.' };
    if (les.deelnemers.find(x => x.toLowerCase() === naam.toLowerCase())) return { status: 409, error: naam + ' staat al op de lijst.' };
    les.deelnemers.push(naam); save();
    return { ok: true, les };
  }
  function priveBoek(code, b) {
    const r = resortVan(code);
    const ins = r.instructeurs.find(x => x.id === String(b.instructeurId || ''));
    if (!ins) return { status: 404, error: 'Deze instructeur werkt hier niet.' };
    const naam = schoon(b.naam, 60);
    const datum = String(b.datum || '').slice(0, 10), tijd = String(b.tijd || '');
    if (!naam) return { status: 400, error: 'Voor wie is de les?' };
    if (!DATUM.test(datum) || !TIJD.test(tijd)) return { status: 400, error: 'Kies een datum en tijd.' };
    const bezet = r.privelessen.find(l => l.instructeurId === ins.id && l.datum === datum && l.tijd === tijd && l.status !== 'gegeven');
    if (bezet) return { status: 409, error: ins.naam + ' staat dan al op de piste met ' + bezet.naam + '.' };
    const l = { id: id('l'), instructeurId: ins.id, instructeur: ins.naam, naam, datum, tijd, prijs: ins.prijs, status: 'geboekt', gemaakt: nu() };
    r.privelessen.unshift(l); cap(r.privelessen, MAX_LIJST); save();
    return { ok: true, les: l };
  }
  function priveKlaar(code, lId) {
    const r = resortVan(code);
    const l = r.privelessen.find(x => x.id === String(lId || ''));
    if (!l) return { status: 404, error: 'Les niet gevonden.' };
    l.status = 'gegeven'; save();
    return { ok: true, les: l };
  }

  /* ---- chalets: boeken zonder overlap ---- */
  function chaletBoek(code, b) {
    const r = resortVan(code);
    const chalet = r.chalets.find(c => c.id === String(b.chaletId || ''));
    if (!chalet) return { status: 404, error: 'Dit chalet bestaat niet.' };
    const naam = schoon(b.naam, 60);
    const van = String(b.van || '').slice(0, 10);
    const nachten = Math.round(Number(b.nachten));
    if (!naam) return { status: 400, error: 'Op welke naam staat het chalet?' };
    if (!DATUM.test(van)) return { status: 400, error: 'Kies een aankomstdatum.' };
    if (!(nachten >= 1 && nachten <= 28)) return { status: 400, error: 'Boeken kan 1 tot 28 nachten.' };
    const tot = plusDagen(van, nachten);
    const botst = r.chaletBoekingen.find(x => x.chaletId === chalet.id && van < x.tot && tot > x.van);
    if (botst) return { status: 409, error: chalet.naam + ' is dan al geboekt (' + botst.van + ' tot ' + botst.tot + ').' };
    const boeking = { id: id('c'), chaletId: chalet.id, chalet: chalet.naam, naam, van, tot, nachten,
      prijs: nachten * chalet.nachtprijs, gemaakt: nu() };
    r.chaletBoekingen.unshift(boeking); cap(r.chaletBoekingen, MAX_LIJST); save();
    return { ok: true, boeking };
  }

  return { alpine: { overzicht, pisteZet, liftZet, lawineZet, pasMaak, huurMaak, huurIn,
    groepIn, priveBoek, priveKlaar, chaletBoek } };
};
