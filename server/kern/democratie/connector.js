/* ============================================================================
   DE POLITICAL CONNECTOR -- het partijenregister en de voorstellen, aan elkaar
   geknoopt (POLITIEK.md par. 7 en 9, release-trein stap 5).

   Dit staat NAAST de burgerlus en niet erin: de kwestie, het lid, de koppeling
   en het DoeNetwerk kennen geen partij (test/democratie-afhankelijk.test.js
   toets 5). Verdwijnt deze module, dan draait de burgerlus door (proef P1).

   EEN PARTIJ ZIET ALLEEN WAT DE INBRENGER ZELF OPENBAAR MAAKTE. De enige plek in
   deze laag waar een inbrenger instemt dat anderen het onderwerp zien, is het
   starten van een actie (./doe.js vraagt `zichtbaar: true`). Een kwestie met een
   actie is dus openbaar; een kwestie zonder actie bestaat voor een partij niet. */
'use strict';

const { maakPartijen } = require('./partijen');
const { maakVoorstellen } = require('./voorstellen');

function maakConnector({ eigen, vastleggen, crypto, nu, zoek, schrijver, wie, zonderNaam, betrokken }) {
  const iso = () => new Date(nu()).toISOString();
  const partijen = maakPartijen({ kaart: () => eigen.bak('democratiePartijen'), kijk: () => eigen.kijk('democratiePartijen') || {},
    vastleggen, crypto, nu: iso });
  const openbaar = () => [...new Set(Object.values(eigen.kijk('democratieActies') || {}).map(a => a.kwestie))]
    .sort().map(zoek).filter(Boolean);
  const voorstellen = maakVoorstellen({ kaart: () => eigen.bak('democratieVoorstellen'), kijk: () => eigen.kijk('democratieVoorstellen') || {},
    vastleggen, crypto, nu: iso, nuMs: nu, partijen, zoekKwestie: zoek, openbaar, schrijver });

  /* Een lid leest de voorstellen bij een openbare kwestie, of bij een kwestie
     die hij zelf inbracht of volgt. Hetzelfde beeld als het kantoor krijgt. */
  function voorstellenBij(sleutel, id) {
    const k = zoek(id);
    const mag = k && (openbaar().some(o => o.id === k.id) || betrokken(k, sleutel));
    if (!mag) return { status: 404, error: 'Deze kwestie is niet openbaar.' };
    return Object.assign({ ok: true, kwestie: { id: k.id, onderwerp: k.onderwerp, gebied: k.gebied || null } }, voorstellen.bijKwestie(k.id));
  }

  /* Wat een partij door haar eigen deur kan. Elke functie krijgt de partij die
     de sleutel opende, en niets anders over wie er aanroept. */
  const partij = {
    wie: (p) => ({ ok: true, partij: partijen.beeld(p) }),
    kwesties: () => voorstellen.openbareKwesties(),
    plaats: (p, b) => voorstellen.plaats(p, b),
    toelicht: (p, b) => voorstellen.toelicht(p, b.id, b),
    aanname: (p, b) => voorstellen.aanname(p, b.id, b),
    mijn: (p) => voorstellen.mijn(p)
  };

  /* Het kantoor, op naam (DO-09). */
  const opNaam = (door, werk) => { const w = wie(door); return w ? werk(w) : zonderNaam; };
  const register = {
    lijst: () => partijen.lijst(),
    registreer: (door, b) => opNaam(door, (w) => partijen.registreer(w, b)),
    sleutel: (door, b) => opNaam(door, (w) => partijen.vervangSleutel(w, b.id)),
    uitschrijf: (door, b) => opNaam(door, (w) => partijen.uitschrijf(w, b.id, b))
  };

  return { partij, register, voorstellenBij, bijKwestie: voorstellen.bijKwestie, partijVanSleutel: partijen.vanSleutel };
}

module.exports = { maakConnector };
