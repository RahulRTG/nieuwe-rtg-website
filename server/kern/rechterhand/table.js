/* Rechterhand (deelmodule): Table -- prive-diners en events. Per gelegenheid een
   gastenlijst met dieet/voorkeuren en tafelindeling, een menu per gang, en de
   praktische gegevens (datum, locatie). Alles voor een vlekkeloze avond, netjes
   bewaard en herbruikbaar. Gemount via index.js.

   ALLERGIE EN DIEET ZIJN VAN DE GAST, NIET VAN HET LID. Een allergie of een
   medisch dieet is een gezondheidsgegeven (art. 9 AVG) van iemand zonder account
   die zelf niets heeft ingestemd. Daarom, en test/table-dieet.test.js houdt het
   vast:
     - de allergenen komen uit de vaste lijst van bijlage II (kern/allergenen.js);
       `dieet` is alleen een korte aanvulling;
     - beide vervallen IN DE OPSLAG: de dag na de gelegenheid, of DIEET_DAGEN na
       invoer bij een gelegenheid zonder datum. De gast zelf blijft staan. Elke
       lezing en schrijving veegt dit dossier, de bewaarveger veegt alle
       dossiers (tableVergeetDieet, aangesloten in opzet/start.js);
     - alleen het lid ziet het per gast; wie verder iets krijgt (de maître in
       ./ai.js) krijgt een telling per allergeen zonder namen. */
module.exports = (ctx) => {
  const { save, rid, nu, schoon, isDatum, L, levens } = ctx;
  const klok = require('../../lib/klok');
  const { ALLERGENEN, kiesAllergenen: allergenenUit, LIJSTFOUT } = require('../allergenen');
  const DAG = 86400000, DIEET_DAGEN = 30;

  const heeftDieet = g => !!((g.allergenen && g.allergenen.length) || g.dieet);
  /* Tot en met deze dag blijft het staan (JJJJ-MM-DD). */
  function dieetTot(e, g) {
    if (isDatum(e.datum)) return new Date(Date.parse(e.datum + 'T00:00:00Z') + DAG).toISOString().slice(0, 10);
    const op = Date.parse(g.dieetOp || '') || 0;
    return op ? new Date(op + DIEET_DAGEN * DAG).toISOString().slice(0, 10) : '';
  }
  /* Een dag na "tot en met" is het weg; in UTC gerekend met een dag speling, zodat
     het nergens ter wereld vervalt voor de dag erna daar begonnen is. */
  function verlopen(e, g, t) {
    const tot = dieetTot(e, g);
    return !!tot && t >= Date.parse(tot + 'T00:00:00Z') + DAG;
  }
  function vergeetIn(l, t) {
    let n = 0;
    for (const e of (l && Array.isArray(l.tables) ? l.tables : [])) {
      for (const g of (Array.isArray(e.gasten) ? e.gasten : [])) {
        if (!heeftDieet(g)) { delete g.dieetOp; continue; }
        /* een gast van voor deze regel: de termijn begint nu te lopen */
        if (!g.dieetOp) g.dieetOp = new Date(t).toISOString();
        if (verlopen(e, g, t)) { g.allergenen = []; g.dieet = ''; delete g.dieetOp; n++; }
      }
    }
    return n;
  }
  const veeg = (l) => { if (vergeetIn(l, klok.nu())) save(); return l; };
  /* De bewaarveger: elk dossier met gelegenheden, lezend door de eigen deur
     (kern/levensdossier); wat er gewist wordt is alleen ons eigen veld. */
  function tableVergeetDieet(t) {
    let n = 0;
    const alle = levens.alleLezend();
    for (const key of Object.keys(alle)) n += vergeetIn(alle[key], Number(t) || klok.nu());
    if (n) save();
    return n;
  }

  function ev(l, id) { veeg(l); return l.tables.find(e => e.id === id); }

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
    const allergenen = allergenenUit(b.allergenen);
    if (allergenen === false) return LIJSTFOUT;
    const g = { id: rid(), naam, allergenen: allergenen || [], dieet: schoon(b.dieet, 80), tafel: schoon(b.tafel, 20), notitie: schoon(b.notitie, 120) };
    if (heeftDieet(g)) g.dieetOp = nu();
    e.gasten.push(g);
    vergeetIn(l, klok.nu());
    save();
    return { status: 200, ok: true };
  }
  function tableGastZet(key, b) {
    const l = L(key), e = ev(l, b.eventId);
    const g = e && (e.gasten || []).find(x => x.id === b.gastId);
    if (!g) return { status: 404, error: 'Gast niet gevonden.' };
    const allergenen = allergenenUit(b.allergenen);
    if (allergenen === false) return LIJSTFOUT;
    const had = heeftDieet(g);
    if (allergenen) g.allergenen = allergenen;
    if (b.dieet !== undefined) g.dieet = schoon(b.dieet, 80);
    if (heeftDieet(g) && (!had || allergenen || b.dieet !== undefined)) g.dieetOp = nu();
    vergeetIn(l, klok.nu());
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
    const l = veeg(L(key)), t = new Date().toISOString().slice(0, 10);
    const lijst = l.tables.map(e => Object.assign({}, e, { gastenAantal: (e.gasten || []).length, komend: !!e.datum && e.datum >= t,
      gasten: (e.gasten || []).map(g => Object.assign({}, g, { allergenen: g.allergenen || [] },
        heeftDieet(g) ? { dieetTot: dieetTot(e, g) } : {})) }))
      .sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));
    return { status: 200, events: lijst, allergenen: ALLERGENEN, dieetDagen: DIEET_DAGEN };
  }

  return { tables, tableZet, tableWeg, tableGast, tableGastZet, tableGastWeg, tableMenu, tableMenuWeg, tableVergeetDieet };
};
