/* Magnaat: HET EIGEN SCHERM -- alles wat EEN speler van zijn wereld ziet.

   Afgesplitst van ./weergave.js. Dat bestand gaat over de GRENS: wie mag wat
   weten, en hoe je van een ander alleen ziet wat er op straat staat. Die grens
   is af. Dit bestand is de LIJST van wat er aan jouw kant van die grens ligt, en
   die groeit met elke laag mee -- contracten, veilingen, belangen, financiering,
   verzekering, onderzoek, beheer, beurs, overnames, concern. Twee dingen met zo'n
   verschillend tempo horen niet in een bestand, en de 10 kB-grens dwong het.

   ALLES WAT HIER STAAT IS VAN JOU OF VAN DE STAD. De conjunctuur en de krant
   zijn publiek en staan er dus ook; je eigen boeken staan er; van een ander
   staat er alleen wat er op straat te zien is. */
const { SECTOREN } = require('./sectoren');
const { PROJECTEN } = require('./foundation');

const STORING = require('./storing');
const D = require('./dienst');
const ORG = require('./organisatie');
const { UITWEGEN } = require('./storing-acties')({ mijnVestiging: () => null });

module.exports = ({ K, codenaamVan, rond, bijrekenen, foundationArbeid, capaciteit,
  personeelNodig, waarde, prijsVan, eigenDeel, inkoopbeeld, vergeven, mijnContracten,
  veilingbeeld, belangbeeld, bankbeeld, kredietprofiel, verzekerbeeld, rndbeeld,
  beheerbeeld, beursbeeld, overnamebeeld, dienstbeeld, herkomst, C, N, CONCERN, eindstand }) => {
  return function zicht(potje, st, mij) {
    bijrekenen(potje);
    const k = K(st);
    const zoneVan = (v) => { const kav = k.kavel.get(v.kavel); return kav ? kav.zone : null; };
    const eigen = (st.vestigingen[mij] || []).map(v => Object.assign({}, v, {
      kavelNaam: k.kavel.get(v.kavel).naam, zone: k.kavel.get(v.kavel).zone,
      capaciteit: capaciteit(v, foundationArbeid(st)), waarde: waarde(v), prijsPer: prijsVan(v.sector, v.prijs),
      /* WAT ER STUK IS, met de uitwegen erbij die JIJ hier hebt (./storing.js).
         De lijst komt van de motor en niet van het scherm: welke uitweg waar
         hoort is een regel en geen opmaak -- een scherm dat hem zelf verzint,
         verzint hem een keer anders. */
      storingen: STORING.openstaand(v).map(x => ({ soort: x.soort, staat: x.staat, sinds: x.sinds,
        naam: (STORING.SOORTEN[x.soort] || {}).naam || x.soort,
        /* WIE HIER AL AAN GEZETEN HEEFT (./storing-keten.js). Zonder deze regel
           komt een storing op dit scherm uit de lucht vallen, terwijl er een
           vakkracht voor stond die hem meldde -- en dan is de organisatie een
           verzameling losse schermen in plaats van een keten. */
        keten: STORING.KETEN.vanStoring(v, x).map(f => ({ maand: f.maand,
          wie: codenaamVan(f.wie), rol: (D.ROLLEN[f.rol] || {}).naam || f.rol,
          deed: f.deed, spoed: f.spoed || 0 })),
        uitwegen: UITWEGEN(x.soort).filter(u => u.staat !== x.staat)
          .map(u => ({ id: u.id, wat: u.wat, gevolg: u.gevolg })) })),
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
      handel: inkoopbeeld(v), vergeven: vergeven(st, v),
      /* WAT DEZE ZAAK OVER ZICHZELF WEET (./organisatie.js). Twee feiten en
         geen oordeel: wat er voor de zoveelste keer stuk is, en wie de
         besluiten feitelijk nam. Een lezing van het besluitenlog dat er al
         staat -- er wordt niets voor bewaard. */
      organisatie: ORG.beeld(st, v, mij, codenaamVan)
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
        /* OF IEMAND WEG IS, is het ENIGE dat er over een ander bijkwam -- en
           dat is geen inbreuk op de regel hierboven maar de reden dat
           vakantiemodus bestaat (fase C). Wie een contract aanbiedt aan iemand
           die weg is, hoort te weten dat er een regelboek antwoordt en geen
           mens; anders is de manager een verborgen speler.

           Dat hij zijn zaken door een manager laat draaien blijft privé -- dat
           is een keuze en geen aanwezigheid. Alleen "ik ben er even niet" is
           publiek, en alleen omdat de speler dat zelf zegt. */
        vakantie: !!(((st.beheer || {})[sp] || {}).vakantie),
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
      /* LOONDIENST (VERHAAL.md stap 1): wat er te krijgen is, wat je zelf hebt,
         en wie er voor je werkt. Zie ./dienst-acties.js. */
      werk: dienstbeeld ? dienstbeeld(potje, st, mij) : null,
      /* WAAR JE VANDAAN KOMT (../loopbaan-profiel.js). Dit is fase 3: je
         volgende onderneming begint niet met een leeg formulier maar met een
         verleden dat al iets betekent.

         ALLEEN FEITEN, en dat is de grens. Maanden per vak, welke rollen je
         vervulde, wie je kent en waarvan. Geen bonus, geen niveau, geen enkel
         getal waar de motor iets mee doet -- de motor kijkt er niet eens naar.
         Wat het verandert is wat het SCHERM kan zeggen, en wat een ander over
         jou weet. Geschiedenis maakt deuren zichtbaar en schenkt geen waarde. */
      herkomst: herkomst ? herkomst.van(mij) : null,
      // de beurs is PUBLIEK: dat is het hele punt van een markt
      beurs: beursbeeld(st, mij),
      // de biedingen die JOU aangaan; wie waarop biedt is van die twee
      overnames: overnamebeeld(st, mij),
      /* JE CONCERN: wat het hoofdkantoor kost en waaruit dat bedrag bestaat,
         plus wat een zaak erbij zou kosten. Dat laatste getal is waarop een
         groeibesluit wordt genomen; zonder dat is de post een verrassing
         achteraf. Van een ander niets -- hoeveel hoofdkantoor een concurrent
         draagt, staat in zijn boeken. */
      concern: Object.assign(CONCERN.beeld(st.vestigingen[mij] || [], zoneVan),
        { erbij: CONCERN.volgende(st.vestigingen[mij] || [], zoneVan, 'horeca', 'boulevard').erbij }),
      veilingen: veilingbeeld(st, mij),
      vrij: k.kavels.filter(x => !st.kavelBezet[x.id] && !(st.kavelRecht || {})[x.id]).length,
      // waar JIJ mag bouwen zonder te hoeven veilen: een gewonnen kavel
      bouwrecht: Object.entries(st.kavelRecht || {}).filter(([, w]) => w === mij)
        .map(([id]) => ({ id, naam: (k.kavel.get(id) || {}).naam })),
      foundation: { lokaal: rond(st.foundation.lokaal), centraal: rond(st.foundation.centraal),
        gedaan: st.foundation.gedaan.map(g => (PROJECTEN.find(p => p.id === g.id) || {}).naam).filter(Boolean) },
      sinds: st.laatste[mij] || null,
      /* JE EIGEN VORIGE MAAND, met de regels erbij. Hij stond er als `sinds`
         alleen voor het verhaal; de AI-concurrenten lezen hem als CIJFERS -- en
         een mens die zijn overzicht openslaat ziet precies hetzelfde. */
      laatste: st.laatste[mij] || null,
      eindstand: st.klaar ? eindstand(potje) : null
    };
  }
  // een gedeeld scherm en een kijker zien de wereld, niet iemands boeke};
};
