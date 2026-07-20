/* Rechterhand (deelmodule): Garde-robe -- uw digitale garderobe. Per stuk het
   type, het merk, de kleur, de maat en waar het hangt of ligt (welke woning,
   welke kast). Daarnaast uw vaklui: de kleermaker, schoenmaker en stomerij met
   contact. Het overzicht telt per categorie, zodat u ziet wat u heeft en waar.
   Gemount via index.js. */
module.exports = (ctx) => {
  const { save, rid, nu, schoon, L } = ctx;
  const CATEGORIEEN = ['pak', 'colbert', 'overhemd', 'schoenen', 'jas', 'trui', 'broek', 'horloge', 'accessoire', 'overig'];
  const VAKKEN = ['kleermaker', 'schoenmaker', 'stomerij', 'juwelier', 'overig'];

  function W(key) { const l = L(key); if (!l.garderobe || typeof l.garderobe !== 'object') l.garderobe = { stukken: [], vaklui: [] }; if (!Array.isArray(l.garderobe.stukken)) l.garderobe.stukken = []; if (!Array.isArray(l.garderobe.vaklui)) l.garderobe.vaklui = []; return l.garderobe; }

  function gwStuk(key, b) {
    const naam = schoon(b.naam, 80);
    if (!naam) return { status: 400, error: 'Wat voor stuk betreft het?' };
    const g = W(key);
    const rec = { naam, categorie: CATEGORIEEN.includes(b.categorie) ? b.categorie : 'overig',
      merk: schoon(b.merk, 60), kleur: schoon(b.kleur, 40), maat: schoon(b.maat, 30),
      waar: schoon(b.waar, 80), notitie: schoon(b.notitie, 200) };
    if (b.id) { const s = g.stukken.find(x => x.id === b.id); if (!s) return { status: 404, error: 'Dit stuk staat niet in uw garderobe.' }; Object.assign(s, rec); save(); return { status: 200, ok: true, stuk: s }; }
    if (g.stukken.length >= 2000) return { status: 400, error: 'Uw garderobe is vol.' };
    const s = Object.assign({ id: rid(), at: nu() }, rec);
    g.stukken.unshift(s); save();
    return { status: 200, ok: true, stuk: s };
  }
  function gwStukWeg(key, id) { const g = W(key); g.stukken = g.stukken.filter(x => x.id !== id); save(); return { status: 200, ok: true }; }
  function gwVakman(key, b) {
    const naam = schoon(b.naam, 80);
    if (!naam) return { status: 400, error: 'Naam van de vakman of het atelier?' };
    const g = W(key);
    const rec = { naam, vak: VAKKEN.includes(b.vak) ? b.vak : 'overig', plaats: schoon(b.plaats, 60), telefoon: schoon(b.telefoon, 30), notitie: schoon(b.notitie, 160) };
    if (b.id) { const v = g.vaklui.find(x => x.id === b.id); if (!v) return { status: 404, error: 'Niet gevonden.' }; Object.assign(v, rec); save(); return { status: 200, ok: true }; }
    if (g.vaklui.length >= 200) return { status: 400, error: 'De lijst is vol.' };
    g.vaklui.push(Object.assign({ id: rid(), at: nu() }, rec)); save();
    return { status: 200, ok: true };
  }
  function gwVakmanWeg(key, id) { const g = W(key); g.vaklui = g.vaklui.filter(x => x.id !== id); save(); return { status: 200, ok: true }; }

  function garderobe(key) {
    const g = W(key);
    const perCategorie = {};
    for (const s of g.stukken) perCategorie[s.categorie] = (perCategorie[s.categorie] || 0) + 1;
    const stukken = g.stukken.slice().sort((a, b) => a.categorie.localeCompare(b.categorie) || String(a.naam).localeCompare(String(b.naam)));
    return { status: 200, stukken, vaklui: g.vaklui, categorieen: CATEGORIEEN, vakken: VAKKEN, aantal: g.stukken.length, perCategorie };
  }

  return { garderobe, gwStuk, gwStukWeg, gwVakman, gwVakmanWeg };
};
