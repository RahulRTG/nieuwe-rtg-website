/* Magnaat: WAT EEN SPELER VAN LOONDIENST ZIET.

   Afgesplitst van ./dienst-acties.js op dezelfde naad als bij het onderzoek
   (./onderzoek-acties.js tegenover ./onderzoek-beeld.js): daar wat een speler
   DOET, hier wat hij ZIET. Twee onderwerpen met een verschillend tempo -- de
   lijst handelingen ligt vast zodra de laag af is, het scherm groeit met elke
   fase mee. De aanleiding was de 10 kB-grens die scripts/check.js bewaakt, en
   die grens is precies een rem hierop: hij dwingt de vraag "waar ligt hier de
   naad" op het moment dat het antwoord nog kort is. */
const D = require('./dienst');

const P = require('./promotie');

/* DE EERSTVOLGENDE TREDE die bij deze zaak nog vrij is. Alleen zaakrollen: een
   bestuursrol hangt aan het concern en niet aan een vestiging, en die stap is
   een ander gesprek (../bestuur.js). */
function volgendeRol(st, d) {
  /* HIER STOND EEN WACHT op `d.vestiging`, voor wie het concern bestuurt. Die
     was dood: een bestuursrol staat BOVEN aan de ladder van ../promotie.js, dus
     de lus hieronder vindt er sowieso niets boven. Een tak die geen enkele
     toets kan omleggen is een tak die niemand onderhoudt -- dezelfde afweging
     als bij het kavellog. De grens zelf blijft staan, hij zit alleen in de
     ladder en niet in een extra regel. */
  const bezet = new Set(D.dienstenBij(st, d.vestiging).map(x => x.rol));
  for (const rol of ['vakkracht', 'bedrijfsleider'])
    if (P.TRAP[rol] > P.TRAP[d.rol] && !bezet.has(rol)) return rol;
  return null;
}

module.exports = ({ vind, herkomst }) => {
  /* WAT EEN SPELER ZIET. Drie dingen, en het is geen toeval dat het er drie zijn:
     wat er te krijgen is, wat je zelf hebt, en wie er voor je werkt.

     DE VACATURES ZIJN PUBLIEK en dat is een besluit. Een baan die je alleen
     ziet als je al iemand kent, is precies de wereld die VERHAAL.md niet wil --
     daar staat met zoveel woorden "bestaande RTG-connecties of VREEMDEN die bij
     je komen". Wie er solliciteerden is NIET publiek: dat staat in de boeken van
     de werkgever, net als zijn kas. */
  function beeld(st, h, codenaamVan) {
    const naam = (x) => (codenaamVan ? codenaamVan(x) : x);
    /* WAT JE MET DEZE MENS DEELT (../loopbaan-profiel.js). Dit is fase 3 op de
       plek waar hij het meest doet: een vacature van iemand voor wie je eerder
       werkte is niet dezelfde vacature als een van een vreemde.

       HET IS EEN REDEN EN GEEN VOORDEEL. Er verandert niets aan het loon, aan de
       band, aan wie er wordt aangenomen of aan de kans dat je wordt gekozen.
       Wat er verandert is dat je ZIET waar je iemand van kent -- de deur wordt
       zichtbaar, hij gaat niet vanzelf open. */
    const kent = (wie) => {
      if (!herkomst) return null;
      const t = herkomst.tussen(h, naam(wie));
      return t.er ? { hoe: t.hoe, maanden: t.maanden } : null;
    };
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
          /* Ken je deze werkgever al? En heb je dit vak eerder gedaan? Twee
             feiten, en geen van beide beweegt een getal. */
          bekend: kent(f.werkgever),
          ervaring: herkomst && f.sector ? herkomst.ervaringIn(h, f.sector) : 0,
          verlooptOver: Math.max(0, D.FUNCTIE_MAANDEN - (st.maand - f.maand)),
          gesolliciteerd: f.sollicitaties.some(x => x.speler === h) };
      }),
      // je eigen baan
      baan: eigen ? { id: eigen.id, werkgever: naam(eigen.werkgever), rol: eigen.rol,
        rolnaam: (D.ROLLEN[eigen.rol] || {}).naam, mag: D.ROLLEN[eigen.rol].mag,
        loon: eigen.loon, sinds: eigen.sinds, maanden: eigen.maanden || 0,
        verdiend: eigen.betaaldTotaal || 0, zaak: v ? v.naam : null, vestiging: eigen.vestiging,
        /* DE LOONSTROOK, en met opzet sober: periode, werkgever, functie,
           bedrag. Hij is AFGELEID en wordt nergens bewaard -- het loon en de
           maand staan er al, en een tweede voorraad naast een som die klopt is
           een tweede waarheid. Waar hij voor is: salaris verandert daarmee van
           "mijn kas ging omhoog" in "ik heb gewerkt en hiervoor ben ik betaald". */
        strook: (eigen.maanden || 0) > 0 ? { periode: st.maand,
          werkgever: naam(eigen.werkgever), functie: (D.ROLLEN[eigen.rol] || {}).naam || eigen.rol,
          bedrag: Math.round(eigen.loon), zaak: v ? v.naam : null,
          sinds: eigen.sinds, dienstmaanden: eigen.maanden || 0 } : null } : null,
      // en wat JIJ als werkgever hebt uitstaan, met de sollicitaties erbij
      mijnFuncties: D.functies(st).filter(f => f.werkgever === h && f.status === 'open').map(f => ({
        id: f.id, vestiging: f.vestiging, rol: f.rol, loon: f.loon,
        /* EN AAN DE WERKGEVERSKANT: ken je deze sollicitant? Precies dezelfde
           regel, precies dezelfde grens -- je ziet waar je hem van kent, en dan
           beslis je zelf. Een oud-collega wordt niet goedkoper en niet beter. */
        sollicitaties: f.sollicitaties.map(x => ({ speler: naam(x.speler), loon: x.loon,
          maand: x.maand, bekend: kent(x.speler) })) })),
      mijnMensen: D.lopend(st).filter(d => d.werkgever === h).map(d => ({
        id: d.id, wie: naam(d.werknemer), rol: d.rol, rolnaam: (D.ROLLEN[d.rol] || {}).naam,
        bekend: kent(d.werknemer),
        loon: d.loon, vestiging: d.vestiging, maanden: d.maanden || 0,
        /* WELKE TREDE ER VOOR DEZE MENS BOVEN LIGT, en of hij vrij is. Zonder
           dit getal is "promotie aanbieden" een knop die soms werkt: de motor
           weigert een bezette rol terecht, maar een scherm hoort dat te weten
           voordat het iets aanbiedt. Zie ../promotie.js voor de ladder. */
        naar: volgendeRol(st, d),
        /* En of er al een gesprek loopt -- dan hoort er geen tweede knop. */
        inGesprek: (st.promoties || []).some(x => x.dienst === d.id
          && (x.status === 'open' || x.status === 'tegenbod')) }))
    };
  }


  return { beeld };
};
