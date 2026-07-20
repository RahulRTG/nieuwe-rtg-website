/* Rechterhand (deelmodule): Cellier -- uw wijnkelder en collectie. Per fles het
   domein/producent, de jaargang, het aantal, de waarde en het drinkvenster; het
   overzicht wijst aan wat 'nu op dronk' is en wat u nog kunt laten liggen, plus
   de kelderwaarde. Een fles schenken telt af. Gemount via index.js. */
module.exports = (ctx) => {
  const { save, rid, nu, schoon, getal, L } = ctx;
  const KLEUREN = ['rood', 'wit', 'rose', 'mousserend', 'versterkt'];
  const jaar = () => new Date().getFullYear();

  function celZet(key, b) {
    const naam = schoon(b.naam, 80);
    if (!naam) return { status: 400, error: 'Welke wijn betreft het?' };
    const l = L(key);
    const rec = {
      naam, domein: schoon(b.domein, 80), kleur: KLEUREN.includes(b.kleur) ? b.kleur : 'rood',
      jaargang: Number(b.jaargang) >= 1900 && Number(b.jaargang) <= jaar() ? Math.round(Number(b.jaargang)) : null,
      aantal: Math.max(0, Math.min(100000, Math.round(Number(b.aantal) || 1))),
      waarde: getal(b.waarde, 1e7), // waarde per fles
      drinkVan: Number(b.drinkVan) >= 1900 && Number(b.drinkVan) <= 2200 ? Math.round(Number(b.drinkVan)) : null,
      drinkTot: Number(b.drinkTot) >= 1900 && Number(b.drinkTot) <= 2200 ? Math.round(Number(b.drinkTot)) : null,
      notitie: schoon(b.notitie, 200)
    };
    if (b.id) { const f = l.cellier.find(x => x.id === b.id); if (!f) return { status: 404, error: 'Deze fles staat niet in uw kelder.' }; Object.assign(f, rec); save(); return { status: 200, ok: true, fles: f }; }
    if (l.cellier.length >= 2000) return { status: 400, error: 'Uw kelder is vol.' };
    const f = Object.assign({ id: rid(), at: nu() }, rec);
    l.cellier.unshift(f); save();
    return { status: 200, ok: true, fles: f };
  }
  function celWeg(key, id) { const l = L(key); l.cellier = l.cellier.filter(x => x.id !== id); save(); return { status: 200, ok: true }; }
  function celSchenk(key, id) {
    const l = L(key); const f = l.cellier.find(x => x.id === id);
    if (!f) return { status: 404, error: 'Deze fles staat niet in uw kelder.' };
    if (f.aantal <= 0) return { status: 400, error: 'Er is geen fles meer van deze wijn.' };
    f.aantal -= 1; save();
    return { status: 200, ok: true, aantal: f.aantal };
  }
  // 'op dronk': binnen het drinkvenster; 'wacht' als het venster nog moet beginnen; 'over tijd' erna
  function venster(f, j) {
    if (!f.drinkVan && !f.drinkTot) return 'onbekend';
    if (f.drinkVan && j < f.drinkVan) return 'laten liggen';
    if (f.drinkTot && j > f.drinkTot) return 'over de top';
    return 'op dronk';
  }
  function cellier(key) {
    const l = L(key), j = jaar();
    const flessen = l.cellier.map(f => Object.assign({}, f, { staat: venster(f, j) }))
      .sort((a, b) => (b.jaargang || 0) - (a.jaargang || 0));
    const totaalFlessen = flessen.reduce((s, f) => s + f.aantal, 0);
    const kelderwaarde = flessen.reduce((s, f) => s + f.aantal * f.waarde, 0);
    return { status: 200, flessen, kleuren: KLEUREN, totaalFlessen, kelderwaarde,
      opDronk: flessen.filter(f => f.staat === 'op dronk' && f.aantal > 0).length };
  }

  return { cellier, celZet, celWeg, celSchenk };
};
