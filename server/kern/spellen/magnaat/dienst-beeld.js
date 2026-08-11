/* Magnaat: WAT EEN SPELER VAN LOONDIENST ZIET.

   Afgesplitst van ./dienst-acties.js op dezelfde naad als bij het onderzoek
   (./onderzoek-acties.js tegenover ./onderzoek-beeld.js): daar wat een speler
   DOET, hier wat hij ZIET. Twee onderwerpen met een verschillend tempo -- de
   lijst handelingen ligt vast zodra de laag af is, het scherm groeit met elke
   fase mee. De aanleiding was de 10 kB-grens die scripts/check.js bewaakt, en
   die grens is precies een rem hierop: hij dwingt de vraag "waar ligt hier de
   naad" op het moment dat het antwoord nog kort is. */
const D = require('./dienst');

module.exports = ({ vind }) => {
  /* WAT EEN SPELER ZIET. Drie dingen, en het is geen toeval dat het er drie zijn:
     wat er te krijgen is, wat je zelf hebt, en wie er voor je werkt.

     DE VACATURES ZIJN PUBLIEK en dat is een besluit. Een baan die je alleen
     ziet als je al iemand kent, is precies de wereld die VERHAAL.md niet wil --
     daar staat met zoveel woorden "bestaande RTG-connecties of VREEMDEN die bij
     je komen". Wie er solliciteerden is NIET publiek: dat staat in de boeken van
     de werkgever, net als zijn kas. */
  function beeld(st, h, codenaamVan) {
    const naam = (x) => (codenaamVan ? codenaamVan(x) : x);
    const eigen = D.dienstVan(st, h);
    const v = eigen ? vind(st, eigen.vestiging) : null;
    return {
      rollen: D.ROLLIJST.map(r => Object.assign({ sleutel: r }, D.ROLLEN[r])),
      /* Openstaande functies bij anderen, met het loon erbij. Zonder dat bedrag
         is solliciteren een gok en zet iedereen laag in. */
      vacatures: D.functies(st).filter(f => f.status === 'open' && f.werkgever !== h).map(f => {
        const zaak = vind(st, f.vestiging);
        return { id: f.id, werkgever: naam(f.werkgever), rol: f.rol,
          rolnaam: (D.ROLLEN[f.rol] || {}).naam, loon: f.loon, sector: f.sector,
          zaak: zaak ? zaak.naam : null, maand: f.maand,
          verlooptOver: Math.max(0, D.FUNCTIE_MAANDEN - (st.maand - f.maand)),
          gesolliciteerd: f.sollicitaties.some(x => x.speler === h) };
      }),
      // je eigen baan
      baan: eigen ? { id: eigen.id, werkgever: naam(eigen.werkgever), rol: eigen.rol,
        rolnaam: (D.ROLLEN[eigen.rol] || {}).naam, mag: D.ROLLEN[eigen.rol].mag,
        loon: eigen.loon, sinds: eigen.sinds, maanden: eigen.maanden || 0,
        verdiend: eigen.betaaldTotaal || 0, zaak: v ? v.naam : null, vestiging: eigen.vestiging } : null,
      // en wat JIJ als werkgever hebt uitstaan, met de sollicitaties erbij
      mijnFuncties: D.functies(st).filter(f => f.werkgever === h && f.status === 'open').map(f => ({
        id: f.id, vestiging: f.vestiging, rol: f.rol, loon: f.loon,
        sollicitaties: f.sollicitaties.map(x => ({ speler: naam(x.speler), loon: x.loon, maand: x.maand })) })),
      mijnMensen: D.lopend(st).filter(d => d.werkgever === h).map(d => ({
        id: d.id, wie: naam(d.werknemer), rol: d.rol, rolnaam: (D.ROLLEN[d.rol] || {}).naam,
        loon: d.loon, vestiging: d.vestiging, maanden: d.maanden || 0 }))
    };
  }


  return { beeld };
};
