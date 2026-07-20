/* Rechterhand (deelmodule): Cercle -- uw besloten clubs en lidmaatschappen over de
   hele wereld. Per club de stad, uw lidnummer, sinds wanneer u lid bent, de
   dresscode, met welke clubs er reciprociteit is (waar u als gast terecht kunt) en
   hoeveel gastpassen u nog heeft. Het overzicht telt uw clubs en de steden waar u
   thuis bent. Bij uitstek jetset. Gemount via index.js. */
module.exports = (ctx) => {
  const { save, rid, nu, schoon, getal, L } = ctx;

  function C(key) { const l = L(key); if (!Array.isArray(l.cercle)) l.cercle = []; return l.cercle; }
  const jaar = () => new Date().getFullYear();

  function crClub(key, b) {
    const naam = schoon(b.naam, 80);
    if (!naam) return { status: 400, error: 'Welke club betreft het?' };
    const clubs = C(key);
    const rec = { naam, stad: schoon(b.stad, 60), lidnummer: schoon(b.lidnummer, 40),
      sinds: Number(b.sinds) >= 1800 && Number(b.sinds) <= jaar() ? Math.round(Number(b.sinds)) : null,
      dresscode: schoon(b.dresscode, 80), reciprociteit: schoon(b.reciprociteit, 300),
      gastpassen: getal(b.gastpassen, 999), notitie: schoon(b.notitie, 300) };
    if (b.id) { const c = clubs.find(x => x.id === b.id); if (!c) return { status: 404, error: 'Deze club staat niet in uw Cercle.' }; Object.assign(c, rec); save(); return { status: 200, ok: true }; }
    if (clubs.length >= 300) return { status: 400, error: 'Uw Cercle is vol.' };
    clubs.unshift(Object.assign({ id: rid(), at: nu() }, rec)); save();
    return { status: 200, ok: true };
  }
  function crClubWeg(key, id) { const l = L(key); l.cercle = C(key).filter(x => x.id !== id); save(); return { status: 200, ok: true }; }

  function cercle(key) {
    const clubs = C(key).slice().sort((a, b) => String(a.stad).localeCompare(String(b.stad)) || String(a.naam).localeCompare(String(b.naam)));
    const steden = new Set(clubs.map(c => (c.stad || '').toLowerCase()).filter(Boolean));
    return { status: 200, clubs, aantal: clubs.length, steden: steden.size,
      gastpassen: clubs.reduce((s, c) => s + (Number(c.gastpassen) || 0), 0) };
  }

  return { cercle, crClub, crClubWeg };
};
