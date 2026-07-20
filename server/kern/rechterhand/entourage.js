/* Rechterhand (deelmodule): Entourage -- uw vaste reisgezelschap. De mensen die u
   meeneemt, met hun band, hun voorkeuren, hun dieet en de geldigheid van hun
   paspoort. Zo stelt u in een oogwenk een gezelschap samen, en het overzicht seint
   welke paspoorten binnenkort verlopen. Gemount via index.js. */
module.exports = (ctx) => {
  const { save, rid, nu, schoon, isDatum, L } = ctx;
  const BANDEN = ['partner', 'familie', 'vriend', 'zakelijk', 'kind', 'overig'];
  const vandaag = () => new Date().toISOString().slice(0, 10);

  function E(key) { const l = L(key); if (!Array.isArray(l.entourage)) l.entourage = []; return l.entourage; }

  function enPersoon(key, b) {
    const naam = schoon(b.naam, 80);
    if (!naam) return { status: 400, error: 'Naam van de persoon?' };
    const lijst = E(key);
    const rec = { naam, band: BANDEN.includes(b.band) ? b.band : 'overig', telefoon: schoon(b.telefoon, 40),
      dieet: schoon(b.dieet, 80), paspoortTot: isDatum(b.paspoortTot) ? b.paspoortTot : '',
      voorkeuren: schoon(b.voorkeuren, 200), notitie: schoon(b.notitie, 200) };
    if (b.id) { const p = lijst.find(x => x.id === b.id); if (!p) return { status: 404, error: 'Niet gevonden.' }; Object.assign(p, rec); save(); return { status: 200, ok: true }; }
    if (lijst.length >= 300) return { status: 400, error: 'De lijst is vol.' };
    lijst.unshift(Object.assign({ id: rid(), at: nu() }, rec)); save();
    return { status: 200, ok: true };
  }
  function enPersoonWeg(key, id) { const l = L(key); l.entourage = E(key).filter(x => x.id !== id); save(); return { status: 200, ok: true }; }

  function entourage(key) {
    const lijst = E(key).slice().sort((a, b) => a.band.localeCompare(b.band) || String(a.naam).localeCompare(String(b.naam)));
    const t = vandaag(), grens = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    const attenties = lijst.filter(p => p.paspoortTot && p.paspoortTot <= grens)
      .map(p => ({ id: p.id, naam: p.naam, paspoortTot: p.paspoortTot, verlopen: p.paspoortTot < t }))
      .sort((a, b) => a.paspoortTot.localeCompare(b.paspoortTot));
    return { status: 200, gezelschap: lijst, banden: BANDEN, aantal: lijst.length, attenties };
  }

  return { entourage, enPersoon, enPersoonWeg };
};
