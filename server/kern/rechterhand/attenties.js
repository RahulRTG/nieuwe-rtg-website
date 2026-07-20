/* Rechterhand (deelmodule): Attenties -- uw relatiebeheer. Per relatie de band, de
   belangrijke data (verjaardag, jubileum) en hun voorkeuren; daarnaast de
   giftgeschiedenis, zodat u nooit twee keer hetzelfde geeft. Het overzicht toont
   wie er de komende dertig dagen een attentie verdient. Gemount via index.js. */
module.exports = (ctx) => {
  const { save, rid, nu, schoon, isDatum, getal, L } = ctx;
  const BANDEN = ['familie', 'vriend', 'zakelijk', 'mentor', 'buur', 'overig'];
  // 'MM-DD' of 'YYYY-MM-DD'
  const isDagMaand = d => /^\d{2}-\d{2}$/.test(String(d || '')) || isDatum(d);
  const mmdd = d => String(d || '').length === 10 ? String(d).slice(5) : String(d || '');

  function A(key) { const l = L(key); if (!l.attenties || typeof l.attenties !== 'object') l.attenties = { relaties: [], giften: [] }; if (!Array.isArray(l.attenties.relaties)) l.attenties.relaties = []; if (!Array.isArray(l.attenties.giften)) l.attenties.giften = []; return l.attenties; }

  function atRelatie(key, b) {
    const naam = schoon(b.naam, 80);
    if (!naam) return { status: 400, error: 'Naam van de relatie?' };
    const a = A(key);
    const rec = { naam, band: BANDEN.includes(b.band) ? b.band : 'overig',
      verjaardag: isDagMaand(b.verjaardag) ? mmdd(b.verjaardag) : '',
      jubileum: isDagMaand(b.jubileum) ? mmdd(b.jubileum) : '',
      voorkeuren: schoon(b.voorkeuren, 200), notitie: schoon(b.notitie, 200) };
    if (b.id) { const r = a.relaties.find(x => x.id === b.id); if (!r) return { status: 404, error: 'Niet gevonden.' }; Object.assign(r, rec); save(); return { status: 200, ok: true }; }
    if (a.relaties.length >= 500) return { status: 400, error: 'De lijst is vol.' };
    a.relaties.unshift(Object.assign({ id: rid(), at: nu() }, rec)); save();
    return { status: 200, ok: true };
  }
  function atRelatieWeg(key, id) { const a = A(key); a.relaties = a.relaties.filter(x => x.id !== id); a.giften = a.giften.filter(g => g.relatieId !== id); save(); return { status: 200, ok: true }; }
  function atGift(key, b) {
    const a = A(key);
    if (!a.relaties.some(r => r.id === b.relatieId)) return { status: 404, error: 'Kies eerst een relatie.' };
    const wat = schoon(b.wat, 100);
    if (!wat) return { status: 400, error: 'Wat heeft u gegeven (of wilt u geven)?' };
    if (a.giften.length >= 5000) return { status: 400, error: 'Er staan al veel giften in de geschiedenis.' };
    a.giften.push({ id: rid(), relatieId: b.relatieId, wat, gelegenheid: schoon(b.gelegenheid, 80),
      datum: isDatum(b.datum) ? b.datum : '', bedrag: getal(b.bedrag, 1e8), at: nu() });
    save();
    return { status: 200, ok: true };
  }
  function atGiftWeg(key, id) { const a = A(key); a.giften = a.giften.filter(x => x.id !== id); save(); return { status: 200, ok: true }; }

  // dagen tot de eerstvolgende keer dat een 'MM-DD' terugkomt
  function dagenTot(md) {
    if (!md) return 9999;
    const nu2 = new Date(); const jaar = nu2.getFullYear();
    const [m, d] = md.split('-').map(Number);
    let doel = new Date(jaar, m - 1, d);
    const vandaag0 = new Date(jaar, nu2.getMonth(), nu2.getDate());
    if (doel < vandaag0) doel = new Date(jaar + 1, m - 1, d);
    return Math.round((doel - vandaag0) / 86400000);
  }

  function attenties(key) {
    const a = A(key);
    const naam = id => { const r = a.relaties.find(x => x.id === id); return r ? r.naam : ''; };
    const relaties = a.relaties.map(r => {
      const giften = a.giften.filter(g => g.relatieId === r.id).sort((x, y) => (y.datum || '').localeCompare(x.datum || ''));
      const dv = dagenTot(r.verjaardag), dj = dagenTot(r.jubileum);
      const dagen = Math.min(dv, dj);
      return Object.assign({}, r, { giften, dagenTot: dagen === 9999 ? null : dagen, volgendeSoort: dagen === 9999 ? '' : (dv <= dj ? 'verjaardag' : 'jubileum') });
    }).sort((x, y) => (x.dagenTot == null ? 1 : y.dagenTot == null ? -1 : x.dagenTot - y.dagenTot));
    const aankomend = relaties.filter(r => r.dagenTot != null && r.dagenTot <= 30)
      .map(r => ({ id: r.id, naam: r.naam, soort: r.volgendeSoort, dagenTot: r.dagenTot }));
    const giften = a.giften.map(g => Object.assign({}, g, { relatie: naam(g.relatieId) }));
    return { status: 200, relaties, giften, banden: BANDEN, aankomend };
  }

  return { attenties, atRelatie, atRelatieWeg, atGift, atGiftWeg };
};
