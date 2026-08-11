/* Magnaat: DE WEERGAVE -- wie mag wat weten, en waarop wordt er afgerekend.

   Afgesplitst van ./economie.js. Twee onderwerpen die bij elkaar horen en niet
   bij de klok:

   1. WIE ZIET WAT. Bij het bordspel ligt alles op tafel; bij de economie niet.
      Je eigen boeken zijn van jou. Van een ander zie je wat er OP STRAAT staat
      -- waar hij zit en hoeveel -- en niet zijn kas. Een kijker en een gedeeld
      scherm krijgen de wereld en niemands boeken. Dat is precies de
      waarschuwing die in de oude descriptor al stond voordat de economie
      bestond, en hier wordt hij waargemaakt.
   2. WAAROP WORDT ER AFGEREKEND. De winnaar is het hoogste VERMOGEN (geld plus
      wat je gebouwd hebt), want wie alles in zijn zaken heeft zitten hoort niet
      te verliezen van wie niets deed. De andere dimensies -- banen, reputatie,
      omzet -- staan op de eindstand en tellen NIET mee voor de winst. Ze laten
      zien wat voor ondernemer je was; er een tweede ranglijst van maken zou
      betekenen dat je op zes assen tegelijk aan het optimaliseren bent. */
const { capaciteit, personeelNodig, waarde } = require('./stap');
const C = require('./cyclus');
const N = require('./nieuws');
const CONCERN = require('./concern');
const { SECTOREN } = require('./sectoren');
const { prijsVan } = require('./prijsstand');
const H = require('./handel');
const { PROJECTEN } = require('./foundation');

module.exports = ({ K, codenaamVan, rond, bijrekenen, foundationArbeid, veilingbeeld,
  belangbeeld, belangwaarde, eigenDeel, bankbeeld, kredietprofiel, verzekerbeeld, rndbeeld,
  beheerbeeld, beursbeeld, overnamebeeld, dienstbeeld }) => {
  /* Van wie is deze vestiging? De contractlaag kijkt over de grens tussen
     twee spelers heen en kan dus niet met `mijnVestiging` toe. */
  const vanIemand = (st, id) => {
    for (const [h, rij] of Object.entries(st.vestigingen)) {
      const v = rij.find(x => x.id === id);
      if (v) return { speler: h, v };
    }
    return null;
  };
  const partij = (c, h) => c.leverancier === h || c.afnemer === h;

  /* WAT EEN SPELER VAN CONTRACTEN ZIET. Zijn eigen draden helemaal; van een
     derde alleen het bestaan. Dezelfde grens als bij de boeken. */
  function mijnContracten(st, h) {
    return (st.contracten || []).filter(c => partij(c, h)).map(c => {
      const lev = vanIemand(st, c.leverancierId), afn = vanIemand(st, c.afnemerId);
      return {
        id: c.id, soort: c.soort, status: c.status, rol: c.leverancier === h ? 'leverancier' : 'afnemer',
        leverancierId: c.leverancierId, afnemerId: c.afnemerId,
        tegenpartij: codenaamVan(c.leverancier === h ? c.afnemer : c.leverancier),
        leverancierNaam: lev ? lev.v.naam : null, afnemerNaam: afn ? afn.v.naam : null,
        eenheden: c.eenheden, bedrag: c.bedrag, looptijd: c.looptijd, eis: c.eis,
        boete: c.boete, vooraf: c.vooraf, exclusief: c.exclusief,
        ronde: c.ronde, aanZet: c.status === 'voorgesteld' && c.van !== h,
        startMaand: c.startMaand, eindMaand: c.eindMaand,
        betaald: rond(c.betaald), ontvangen: rond(c.ontvangen), boetes: rond(c.boetes),
        maandenGeleverd: c.maandenGeleverd, maandenTekort: c.maandenTekort,
        afkoopNu: c.status === 'loopt' ? H.afkoopsom(c, st.maand) : null
      };
    });
  }

  /* WAT ER TE KOPEN VALT, per vestiging: welke posten deze zaak inkoopt, hoe
     groot ze zijn bij de huidige omzet, en welke sector ze levert. Zonder dit
     is onderhandelen raden -- en raden over getallen die de motor gewoon kent,
     is precies het soort mist waar dit huis niet aan doet. */
  /* Hoeveel van de capaciteit van deze zaak al vergeven is aan contracten.
     Hoort bij het eigen beeld en nergens anders: het is de vraag "hoeveel kan
     ik nog aan een ander beloven", en die stelt alleen de eigenaar. */
  const vergeven = (st, v) => (st.contracten || [])
    .filter(c => c.status === 'loopt' && c.leverancierId === v.id)
    .reduce((n, c) => n + c.eenheden, 0);

  function inkoopbeeld(v) {
    const laatsteOmzet = v.maanden ? (v.omzetTotaal || 0) / v.maanden : 0;
    return {
      levert: H.levert(v.sector),
      posten: H.koopt(v.sector).map(({ soort, aandeel }) => ({
        soort, aandeel,
        eenheden: Math.round(H.behoefte(v, laatsteOmzet, soort)),
        marktkosten: rond(laatsteOmzet * SECTOREN[v.sector].inkoop * aandeel),
        marktprijs: H.MARKTPRIJS[soort],
        levertSector: H.LEVERANCIERS[soort]
      }))
    };
  }


  /* WAAROP ER WORDT AFGEREKEND staat in ./eindstand.js -- een eigen onderwerp
     dat af is, terwijl dit bestand met elke laag meegroeit. */
  const eindstand = require('./eindstand')({ codenaamVan, rond, waarde, eigenDeel, belangwaarde });

  /* WAT EEN SPELER VAN ZIJN EIGEN WERELD ZIET staat in ./eigenscherm.js -- een
     lijst die met elke laag meegroeit, terwijl de GRENS hierboven af is. */
  /* TWEE INGANGEN NAAR HETZELFDE SCHERM, en dat verschil is nodig geworden met
     de AI-concurrenten. `zicht` rekent eerst de klok bij -- dat is wat een
     mens verwacht als hij zijn scherm opent. `zichtRuw` doet dat NIET, en die
     is voor wie AL IN de maandloop staat: de AI-spelers zetten binnen
     `bijrekenen`, en een scherm dat daar opnieuw `bijrekenen` aanroept loopt
     zichzelf in. Het scherm zelf is in beide gevallen precies hetzelfde -- er
     is geen tweede beeld met andere gegevens, want dan zou een AI iets anders
     zien dan een mens. */
  const zichtRuw = require('./eigenscherm')({ K, codenaamVan, rond, bijrekenen: () => {},
    foundationArbeid, capaciteit, personeelNodig, waarde, prijsVan, eigenDeel, inkoopbeeld,
    vergeven, mijnContracten, veilingbeeld, belangbeeld, bankbeeld, kredietprofiel,
    verzekerbeeld, rndbeeld, beheerbeeld, beursbeeld, overnamebeeld, dienstbeeld, C, N, CONCERN, eindstand });
  const zicht = require('./eigenscherm')({ K, codenaamVan, rond, bijrekenen, foundationArbeid,
    capaciteit, personeelNodig, waarde, prijsVan, eigenDeel, inkoopbeeld, vergeven, mijnContracten,
    veilingbeeld, belangbeeld, bankbeeld, kredietprofiel, verzekerbeeld, rndbeeld,
    beheerbeeld, beursbeeld, overnamebeeld, dienstbeeld, C, N, CONCERN, eindstand });

  function publiek(potje, st) {
    const k = K(st);
    return { stad: k.naam, maand: st.maand, duur: st.duur, klaar: st.klaar,
      stand: potje.spelers.map(h => ({ codenaam: codenaamVan(h), vestigingen: (st.vestigingen[h] || []).length })),
      // de conjunctuur hoort ook op een gedeeld scherm: hij is van de stad
      cyclus: C.beeld(potje.id, st.maand),
      nieuws: N.beeld(potje.id, st.maand, [...new Set(k.kavels.map(x => x.zone))]),
      foundation: st.foundation.gedaan.length };
  }

  return { zicht, zichtRuw, publiek, eindstand };
};
