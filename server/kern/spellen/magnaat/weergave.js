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
const { SECTOREN } = require('./sectoren');
const { prijsVan } = require('./prijsstand');
const H = require('./handel');
const { PROJECTEN } = require('./foundation');

module.exports = ({ K, codenaamVan, rond, bijrekenen, foundationArbeid, veilingbeeld,
  belangbeeld, belangwaarde, eigenDeel, bankbeeld, kredietprofiel, verzekerbeeld, rndbeeld,
  beheerbeeld, beursbeeld }) => {
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

  function zicht(potje, st, mij) {
    bijrekenen(potje);
    const k = K(st);
    const eigen = (st.vestigingen[mij] || []).map(v => Object.assign({}, v, {
      kavelNaam: k.kavel.get(v.kavel).naam, zone: k.kavel.get(v.kavel).zone,
      capaciteit: capaciteit(v, foundationArbeid(st)), waarde: waarde(v), prijsPer: prijsVan(v.sector, v.prijs),
      /* HOEVEEL MENSEN DEZE ZAAK NODIG HEEFT om vol te draaien. Staat er sinds
         de onderzoekslaag: `automatisering` verhoogt wat een medewerker aankan,
         en bij een volle bezetting merk je daar niets van tot je iemand naar
         huis stuurt. Zonder dit getal is de uitvinding onzichtbaar en betaal je
         de uitrol voor niets. */
      personeelNodig: personeelNodig(v, foundationArbeid(st)),
      // hoeveel van deze zaak nog van jou is; de rest zit bij aandeelhouders
      eigenDeel: Math.round(eigenDeel(st, v.id) * 100),
      // wat deze zaak inkoopt en wat hij zelf kan leveren -- zonder dat is
      // onderhandelen raden over getallen die de motor gewoon kent
      handel: inkoopbeeld(v), vergeven: vergeven(st, v)
    }));
    return {
      stad: k.naam, bron: k.bron, maand: st.maand, duur: st.duur, klaar: st.klaar,
      geld: rond(st.geld[mij] || 0),
      /* DE CONJUNCTUUR IS PUBLIEK. Er is geen versie van dit spel waarin de ene
         ondernemer wel weet dat het slecht gaat en de andere niet -- dat staat in
         de krant. En zonder de vooruitblik ("nog drie maanden recessie") is een
         cyclus geen mechaniek maar pech. */
      cyclus: C.beeld(potje.id, st.maand),
      /* DE KRANT. Publiek, en met de AANKONDIGINGEN erbij: een gebeurtenis die
         je pas merkt als je omzet zakt is pech en geen mechaniek. Wie ziet dat
         de weg door het centrum vier maanden opengaat, kan verhuizen of wachten. */
      nieuws: N.beeld(potje.id, st.maand, [...new Set(k.kavels.map(x => x.zone))]),
      vestigingen: eigen,
      // van de anderen alleen wat aan tafel zichtbaar is: waar ze zitten en
      // hoeveel. Hun cash is van hen -- zie de waarschuwing in de descriptor
      anderen: potje.spelers.filter(sp => sp !== mij).map(sp => ({
        codenaam: codenaamVan(sp), vestigingen: (st.vestigingen[sp] || []).length,
        zaken: (st.vestigingen[sp] || []).map(v => ({
          /* WAT ER OP STRAAT STAAT, en dat is precies wat een tegenpartij nodig
             heeft om een contract voor te stellen: een naam, een sector, een
             maat en een adres. Wat er NIET bij staat is de reden dat dit een
             lijst mocht worden in plaats van een aantal: geen kas, geen
             resultaat, geen reputatiecijfer, geen personeelsbestand. Je kunt
             zien dat er een vervoerder aan de Halkade zit; je kunt niet zien
             hoe het hem vergaat. */
          id: v.id, naam: v.naam, sector: v.sector, omvang: v.omvang,
          kavelNaam: k.kavel.get(v.kavel).naam, zone: k.kavel.get(v.kavel).zone,
          levert: (SECTOREN[v.sector] || {}).levert || null
        })),
        zones: [...new Set((st.vestigingen[sp] || []).map(v => k.kavel.get(v.kavel).zone))]
      })),
      contracten: mijnContracten(st, mij),
      belangen: belangbeeld(st, mij),
      /* De bank ziet je boeken; een medespeler niet. Schuld is de scherpste
         vorm van andermans boeken -- wie weet dat je krap zit, weet wanneer
         hij moet toeslaan. */
      financiering: bankbeeld(st, mij),
      krediet: kredietprofiel(st, mij),
      verzekering: verzekerbeeld(st, mij),
      onderzoek: rndbeeld(st, mij),
      // je manager: zijn regels, wat hij kost, en het log met de reden per besluit
      beheer: beheerbeeld(st, mij),
      // de beurs is PUBLIEK: dat is het hele punt van een markt
      beurs: beursbeeld(st, mij),
      veilingen: veilingbeeld(st, mij),
      vrij: k.kavels.filter(x => !st.kavelBezet[x.id] && !(st.kavelRecht || {})[x.id]).length,
      // waar JIJ mag bouwen zonder te hoeven veilen: een gewonnen kavel
      bouwrecht: Object.entries(st.kavelRecht || {}).filter(([, w]) => w === mij)
        .map(([id]) => ({ id, naam: (k.kavel.get(id) || {}).naam })),
      foundation: { lokaal: rond(st.foundation.lokaal), centraal: rond(st.foundation.centraal),
        gedaan: st.foundation.gedaan.map(g => (PROJECTEN.find(p => p.id === g.id) || {}).naam).filter(Boolean) },
      sinds: st.laatste[mij] || null,
      eindstand: st.klaar ? eindstand(potje) : null
    };
  }
  // een gedeeld scherm en een kijker zien de wereld, niet iemands boeken
  function publiek(potje, st) {
    const k = K(st);
    return { stad: k.naam, maand: st.maand, duur: st.duur, klaar: st.klaar,
      stand: potje.spelers.map(h => ({ codenaam: codenaamVan(h), vestigingen: (st.vestigingen[h] || []).length })),
      // de conjunctuur hoort ook op een gedeeld scherm: hij is van de stad
      cyclus: C.beeld(potje.id, st.maand),
      nieuws: N.beeld(potje.id, st.maand, [...new Set(k.kavels.map(x => x.zone))]),
      foundation: st.foundation.gedaan.length };
  }

  return { zicht, publiek, eindstand };
};
