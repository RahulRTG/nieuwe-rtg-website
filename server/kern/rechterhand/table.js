/* Rechterhand (deelmodule): Table -- prive-diners en events. Per gelegenheid een
   gastenlijst met dieet/voorkeuren en tafelindeling, een menu per gang, en de
   praktische gegevens (datum, locatie). Alles voor een vlekkeloze avond, netjes
   bewaard en herbruikbaar. Gemount via index.js. */
module.exports = (ctx) => {
  const { save, rid, nu, schoon, isDatum, L } = ctx;

  function ev(l, id) { return l.tables.find(e => e.id === id); }

  function tableZet(key, b) {
    const naam = schoon(b.naam, 80);
    if (!naam) return { status: 400, error: 'Geef de gelegenheid een naam.' };
    const l = L(key);
    const meta = { naam, datum: isDatum(b.datum) ? b.datum : '', tijd: /^\d{2}:\d{2}$/.test(b.tijd || '') ? b.tijd : '',
      locatie: schoon(b.locatie, 100), notitie: schoon(b.notitie, 300) };
    if (b.id) { const e = ev(l, b.id); if (!e) return { status: 404, error: 'Deze gelegenheid bestaat niet.' }; Object.assign(e, meta); save(); return { status: 200, ok: true, event: e }; }
    if (l.tables.length >= 100) return { status: 400, error: 'U heeft veel gelegenheden staan.' };
    const e = Object.assign({ id: rid(), at: nu(), gasten: [], menu: [] }, meta);
    l.tables.unshift(e); save();
    return { status: 200, ok: true, event: e };
  }
  function tableWeg(key, id) { const l = L(key); l.tables = l.tables.filter(e => e.id !== id); save(); return { status: 200, ok: true }; }

  function tableGast(key, b) {
    const l = L(key), e = ev(l, b.eventId);
    if (!e) return { status: 404, error: 'Deze gelegenheid bestaat niet.' };
    const naam = schoon(b.naam, 60);
    if (!naam) return { status: 400, error: 'Naam van de gast?' };
    if (!Array.isArray(e.gasten)) e.gasten = [];
    if (e.gasten.length >= 400) return { status: 400, error: 'De gastenlijst is vol.' };
    e.gasten.push({ id: rid(), naam, dieet: schoon(b.dieet, 80), tafel: schoon(b.tafel, 20), notitie: schoon(b.notitie, 120) });
    save();
    return { status: 200, ok: true };
  }
  function tableGastZet(key, b) {
    const l = L(key), e = ev(l, b.eventId);
    const g = e && (e.gasten || []).find(x => x.id === b.gastId);
    if (!g) return { status: 404, error: 'Gast niet gevonden.' };
    if (b.dieet !== undefined) g.dieet = schoon(b.dieet, 80);
    if (b.tafel !== undefined) g.tafel = schoon(b.tafel, 20);
    if (b.notitie !== undefined) g.notitie = schoon(b.notitie, 120);
    save();
    return { status: 200, ok: true };
  }
  function tableGastWeg(key, b) {
    const l = L(key), e = ev(l, b.eventId);
    if (!e) return { status: 404, error: 'Niet gevonden.' };
    e.gasten = (e.gasten || []).filter(x => x.id !== b.gastId); save();
    return { status: 200, ok: true };
  }
  function tableMenu(key, b) {
    const l = L(key), e = ev(l, b.eventId);
    if (!e) return { status: 404, error: 'Deze gelegenheid bestaat niet.' };
    const gerecht = schoon(b.gerecht, 100);
    if (!gerecht) return { status: 400, error: 'Welk gerecht?' };
    if (!Array.isArray(e.menu)) e.menu = [];
    if (e.menu.length >= 30) return { status: 400, error: 'Het menu is compleet.' };
    e.menu.push({ id: rid(), gang: schoon(b.gang, 30) || 'gang', gerecht, wijn: schoon(b.wijn, 60) });
    save();
    return { status: 200, ok: true };
  }
  function tableMenuWeg(key, b) {
    const l = L(key), e = ev(l, b.eventId);
    if (!e) return { status: 404, error: 'Niet gevonden.' };
    e.menu = (e.menu || []).filter(x => x.id !== b.itemId); save();
    return { status: 200, ok: true };
  }
  function tables(key) {
    const l = L(key), t = new Date().toISOString().slice(0, 10);
    const lijst = l.tables.map(e => Object.assign({}, e, { gastenAantal: (e.gasten || []).length, komend: !!e.datum && e.datum >= t }))
      .sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));
    return { status: 200, events: lijst };
  }

  return { tables, tableZet, tableWeg, tableGast, tableGastZet, tableGastWeg, tableMenu, tableMenuWeg };
};
