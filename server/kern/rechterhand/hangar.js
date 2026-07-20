/* Rechterhand (deelmodule): Hangar -- uw privevliegtuigen en charters. Per toestel
   het type, de registratie, de thuishaven en het aantal stoelen; daaronder de
   vluchten met vlieguren en bemanning. Het overzicht toont per toestel de laatst
   bekende positie (de aankomst van de recentste vlucht, anders de thuishaven), de
   eerstvolgende vlucht en de totale vlieguren. Bij uitstek jetset. Gemount via
   index.js. */
module.exports = (ctx) => {
  const { save, rid, nu, schoon, isDatum, getal, L } = ctx;
  const TYPES = ['jet', 'turboprop', 'helikopter', 'charter', 'overig'];
  const vandaag = () => new Date().toISOString().slice(0, 10);

  function H(key) { const l = L(key); if (!l.hangar || typeof l.hangar !== 'object') l.hangar = { toestellen: [], vluchten: [] }; if (!Array.isArray(l.hangar.toestellen)) l.hangar.toestellen = []; if (!Array.isArray(l.hangar.vluchten)) l.hangar.vluchten = []; return l.hangar; }

  function hgToestel(key, b) {
    const naam = schoon(b.naam, 80);
    if (!naam) return { status: 400, error: 'Geef het toestel een naam.' };
    const h = H(key);
    const rec = { naam, type: TYPES.includes(b.type) ? b.type : 'jet', registratie: schoon(b.registratie, 40),
      basis: schoon(b.basis, 60), stoelen: getal(b.stoelen, 500), notitie: schoon(b.notitie, 200) };
    if (b.id) { const t = h.toestellen.find(x => x.id === b.id); if (!t) return { status: 404, error: 'Dit toestel staat niet in uw hangar.' }; Object.assign(t, rec); save(); return { status: 200, ok: true }; }
    if (h.toestellen.length >= 100) return { status: 400, error: 'Uw hangar is vol.' };
    h.toestellen.unshift(Object.assign({ id: rid(), at: nu() }, rec)); save();
    return { status: 200, ok: true };
  }
  function hgToestelWeg(key, id) { const h = H(key); h.toestellen = h.toestellen.filter(x => x.id !== id); h.vluchten = h.vluchten.filter(v => v.toestelId !== id); save(); return { status: 200, ok: true }; }
  function hgVlucht(key, b) {
    const h = H(key);
    if (!h.toestellen.some(t => t.id === b.toestelId)) return { status: 404, error: 'Kies eerst een toestel.' };
    const van = schoon(b.van, 60);
    if (!van) return { status: 400, error: 'Van welke luchthaven vertrekt u?' };
    if (h.vluchten.length >= 5000) return { status: 400, error: 'Er staan al veel vluchten in het logboek.' };
    h.vluchten.push({ id: rid(), toestelId: b.toestelId, van, naar: schoon(b.naar, 60),
      datum: isDatum(b.datum) ? b.datum : '', tijd: /^\d{2}:\d{2}$/.test(b.tijd || '') ? b.tijd : '',
      uren: Math.max(0, Math.min(1000, Math.round((Number(b.uren) || 0) * 10) / 10)), bemanning: schoon(b.bemanning, 100), notitie: schoon(b.notitie, 200), at: nu() });
    save();
    return { status: 200, ok: true };
  }
  function hgVluchtWeg(key, id) { const h = H(key); h.vluchten = h.vluchten.filter(x => x.id !== id); save(); return { status: 200, ok: true }; }

  function hangar(key) {
    const h = H(key), t = vandaag();
    const toestellen = h.toestellen.map(x => {
      const vl = h.vluchten.filter(v => v.toestelId === x.id);
      const gedaan = vl.filter(v => v.datum && v.datum <= t).sort((a, b) => (b.datum + (b.tijd || '')).localeCompare(a.datum + (a.tijd || '')))[0];
      const positie = gedaan && gedaan.naar ? gedaan.naar : x.basis;
      return Object.assign({}, x, { uren: Math.round(vl.reduce((s, v) => s + v.uren, 0) * 10) / 10, positie, vluchtAantal: vl.length });
    });
    const naam = id => { const x = h.toestellen.find(y => y.id === id); return x ? x.naam : ''; };
    const vluchten = h.vluchten.map(v => Object.assign({}, v, { toestel: naam(v.toestelId) }))
      .sort((a, b) => (b.datum + (b.tijd || '')).localeCompare(a.datum + (a.tijd || '')));
    const komend = vluchten.filter(v => v.datum && v.datum >= t).sort((a, b) => (a.datum + (a.tijd || '')).localeCompare(b.datum + (b.tijd || '')))[0] || null;
    return { status: 200, toestellen, vluchten, komend, types: TYPES, totaalUren: Math.round(h.vluchten.reduce((s, v) => s + v.uren, 0) * 10) / 10 };
  }

  return { hangar, hgToestel, hgToestelWeg, hgVlucht, hgVluchtWeg };
};
