/* Rechterhand (deelmodule): Maison -- huishouden en staf. Het huishoudelijk
   personeel met rol en contact, de lopende taken (met wie en wanneer, af te
   vinken), en een logboek van wat er speelt in en om huis. Gemount via index.js. */
module.exports = (ctx) => {
  const { save, rid, nu, schoon, isDatum, L } = ctx;

  function maisonStaf(key, b) {
    const naam = schoon(b.naam, 60);
    if (!naam) return { status: 400, error: 'Naam van het personeelslid?' };
    const m = L(key).maison;
    if (b.id) { const s = m.staf.find(x => x.id === b.id); if (!s) return { status: 404, error: 'Niet gevonden.' }; s.naam = naam; s.rol = schoon(b.rol, 40); s.telefoon = schoon(b.telefoon, 30); save(); return { status: 200, ok: true }; }
    if (m.staf.length >= 100) return { status: 400, error: 'De lijst is vol.' };
    m.staf.push({ id: rid(), naam, rol: schoon(b.rol, 40), telefoon: schoon(b.telefoon, 30), at: nu() });
    save();
    return { status: 200, ok: true };
  }
  function maisonStafWeg(key, id) {
    const m = L(key).maison;
    m.staf = m.staf.filter(x => x.id !== id);
    m.taken = m.taken.map(t => t.voor === id ? Object.assign(t, { voor: '' }) : t); save();
    return { status: 200, ok: true };
  }
  function maisonTaak(key, b) {
    const wat = schoon(b.wat, 100);
    if (!wat) return { status: 400, error: 'Wat moet er gebeuren?' };
    const m = L(key).maison;
    if (m.taken.length >= 300) return { status: 400, error: 'Er staan al veel taken.' };
    const voor = b.voor && m.staf.some(s => s.id === b.voor) ? b.voor : '';
    m.taken.push({ id: rid(), wat, voor, dag: isDatum(b.dag) ? b.dag : '', klaar: false, at: nu() });
    save();
    return { status: 200, ok: true };
  }
  function maisonTaakKlaar(key, b) {
    const m = L(key).maison; const t = m.taken.find(x => x.id === b.id);
    if (!t) return { status: 404, error: 'Taak niet gevonden.' };
    t.klaar = b.klaar === true; save();
    return { status: 200, ok: true };
  }
  function maisonTaakWeg(key, id) { const m = L(key).maison; m.taken = m.taken.filter(x => x.id !== id); save(); return { status: 200, ok: true }; }
  function maisonLog(key, b) {
    const tekst = schoon(b.tekst, 300);
    if (!tekst) return { status: 400, error: 'Wat wilt u noteren?' };
    const m = L(key).maison;
    if (m.logboek.length >= 500) m.logboek.pop();
    m.logboek.unshift({ id: rid(), tekst, at: nu() }); save();
    return { status: 200, ok: true };
  }
  function maisonLogWeg(key, id) { const m = L(key).maison; m.logboek = m.logboek.filter(x => x.id !== id); save(); return { status: 200, ok: true }; }

  function maison(key) {
    const m = L(key).maison;
    const naam = id => { const s = m.staf.find(x => x.id === id); return s ? s.naam : ''; };
    const taken = m.taken.map(t => Object.assign({}, t, { voorNaam: naam(t.voor) }))
      .sort((a, b) => (a.klaar === b.klaar ? (a.dag || '').localeCompare(b.dag || '') : a.klaar ? 1 : -1));
    return { status: 200, staf: m.staf, taken, openTaken: taken.filter(t => !t.klaar).length, logboek: m.logboek.slice(0, 60) };
  }

  return { maison, maisonStaf, maisonStafWeg, maisonTaak, maisonTaakKlaar, maisonTaakWeg, maisonLog, maisonLogWeg };
};
