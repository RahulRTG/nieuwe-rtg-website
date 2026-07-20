/* Rechterhand (deelmodule): Logboek -- het onderhoudsboek van uw jacht, jet,
   oldtimer of ander kostbaar bezit. Per object de basisgegevens (soort, merk,
   bouwjaar, registratie) en daaronder de regels: keuringen, servicebeurten,
   reparaties en verzekeringen met datum, kosten en -- belangrijk -- de datum
   waarop het weer aan de beurt is. Het overzicht seint wat binnenkort verloopt.
   Gemount via index.js. */
module.exports = (ctx) => {
  const { save, rid, nu, schoon, isDatum, getal, L } = ctx;
  const SOORTEN = ['jacht', 'vliegtuig', 'helikopter', 'oldtimer', 'auto', 'motor', 'overig'];
  const REGELSOORTEN = ['keuring', 'service', 'reparatie', 'verzekering', 'stalling', 'overig'];
  const vandaag = () => new Date().toISOString().slice(0, 10);

  function O(key) { const l = L(key); if (!l.onderhoud || typeof l.onderhoud !== 'object') l.onderhoud = { objecten: [], regels: [] }; if (!Array.isArray(l.onderhoud.objecten)) l.onderhoud.objecten = []; if (!Array.isArray(l.onderhoud.regels)) l.onderhoud.regels = []; return l.onderhoud; }

  function lbObject(key, b) {
    const naam = schoon(b.naam, 80);
    if (!naam) return { status: 400, error: 'Geef het object een naam.' };
    const o = O(key);
    const rec = { naam, soort: SOORTEN.includes(b.soort) ? b.soort : 'overig', merk: schoon(b.merk, 60),
      bouwjaar: Number(b.bouwjaar) >= 1900 && Number(b.bouwjaar) <= 2100 ? Math.round(Number(b.bouwjaar)) : null,
      registratie: schoon(b.registratie, 40), notitie: schoon(b.notitie, 200) };
    if (b.id) { const x = o.objecten.find(y => y.id === b.id); if (!x) return { status: 404, error: 'Dit object staat niet in uw logboek.' }; Object.assign(x, rec); save(); return { status: 200, ok: true }; }
    if (o.objecten.length >= 200) return { status: 400, error: 'Uw logboek is vol.' };
    o.objecten.unshift(Object.assign({ id: rid(), at: nu() }, rec)); save();
    return { status: 200, ok: true };
  }
  function lbObjectWeg(key, id) { const o = O(key); o.objecten = o.objecten.filter(x => x.id !== id); o.regels = o.regels.filter(r => r.objectId !== id); save(); return { status: 200, ok: true }; }
  function lbRegel(key, b) {
    const o = O(key);
    if (!o.objecten.some(x => x.id === b.objectId)) return { status: 404, error: 'Kies eerst een object.' };
    const wat = schoon(b.wat, 100);
    if (!wat) return { status: 400, error: 'Wat is er gebeurd of gepland?' };
    if (o.regels.length >= 5000) return { status: 400, error: 'Er staan al veel regels in het logboek.' };
    o.regels.push({ id: rid(), objectId: b.objectId, wat, soort: REGELSOORTEN.includes(b.soort) ? b.soort : 'overig',
      datum: isDatum(b.datum) ? b.datum : '', volgende: isDatum(b.volgende) ? b.volgende : '',
      kosten: getal(b.kosten, 1e9), notitie: schoon(b.notitie, 300), at: nu() });
    save();
    return { status: 200, ok: true };
  }
  function lbRegelWeg(key, id) { const o = O(key); o.regels = o.regels.filter(x => x.id !== id); save(); return { status: 200, ok: true }; }

  function logboek(key) {
    const o = O(key), t = vandaag(), grens = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    const naam = id => { const x = o.objecten.find(y => y.id === id); return x ? x.naam : ''; };
    const objecten = o.objecten.map(x => {
      const regels = o.regels.filter(r => r.objectId === x.id);
      const laatste = regels.slice().sort((a, b) => (b.datum || '').localeCompare(a.datum || ''))[0] || null;
      return Object.assign({}, x, { regelAantal: regels.length, laatste,
        kosten: regels.reduce((s, r) => s + r.kosten, 0) });
    });
    const attenties = [];
    for (const r of o.regels) if (r.volgende && r.volgende <= grens)
      attenties.push({ object: naam(r.objectId), wat: r.wat, soort: r.soort, volgende: r.volgende, verlopen: r.volgende < t });
    attenties.sort((a, b) => a.volgende.localeCompare(b.volgende));
    const regels = o.regels.map(r => Object.assign({}, r, { objectNaam: naam(r.objectId) }))
      .sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));
    return { status: 200, objecten, regels, attenties, soorten: SOORTEN, regelsoorten: REGELSOORTEN,
      totaalKosten: o.regels.reduce((s, r) => s + r.kosten, 0) };
  }

  return { logboek, lbObject, lbObjectWeg, lbRegel, lbRegelWeg };
};
