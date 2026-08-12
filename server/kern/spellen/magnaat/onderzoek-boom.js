/* Magnaat: DE ONDERZOEKSBOOM -- vijf richtingen, zeven vertalingen.

   VIJF HEFBOMEN EN GEEN VIJFENDERTIG LOSSE UITVINDINGEN. Een restaurant dat op
   procesautomatisering inzet en een vervoerder die zijn voertuigbenutting
   verhoogt, doen ECONOMISCH hetzelfde: meer aan met dezelfde mensen, tegen
   hogere vaste lasten voor techniek. Dat is een hefboom, en de sector geeft hem
   een naam en zijn eigen getallen. Zo blijft de economie narekenbaar -- er zijn
   vijf dingen die een uitvinding kan doen -- terwijl horeca, hospitality en
   mobility echt anders spelen.

   ELKE RICHTING HEEFT EEN KEERZIJDE, en dat is de toelatingseis. Een knoop die
   alleen maar goed is, is geen keuze maar een knop die je indrukt:

     automatisering  meer per medewerker, maar hogere vaste lasten (techniek,
                     onderhoud, licenties)
     kwaliteit       hogere beleving en dus reputatie, maar duurdere inkoop
     energie         lagere vaste lasten, en als enige zonder keerzijde in de
                     exploitatie -- de prijs zit in de UITROL, die hier het
                     duurst is. Dat is de "hoge initiele investering".
     keten           minder verspilling en minder technisch risico: lagere
                     inkoop en een kleinere kans op machinebreuk en brand, maar
                     planning- en volgsystemen die blijven draaien en dus de
                     vaste lasten verhogen
     concept         nieuwe klantsegmenten: meer vraag, hogere vaste lasten, en
                     ONZEKER -- dit is de knoop die het vaakst anders uitpakt
                     dan je dacht

   JE ONDERZOEKT WAT JE DOET. Een tak gaat alleen open voor een sector waarin je
   ook werkelijk een vestiging hebt. Dat is geen rem maar de kern van de keuze:
   een specialist loopt een diepe boom af, een conglomeraat staat overal aan het
   begin. En het maakt de portefeuille een onderzoeksbeslissing.

   DE STAM IS SECTORLOOS. `meten` gaat over je eigen cijfers kennen, en dat is
   voor elk bedrijf hetzelfde. Alles hangt erachter. */

const VELDEN = ['perMedewerker', 'vast', 'inkoop', 'bouw', 'markt', 'kwaliteit', 'risico'];

/* De vorm van elke richting: welk veld omhoog gaat, welk veld de prijs is, wat
   het kost en hoe lang het duurt. De SECTOR levert alleen de naam en de twee
   getallen -- zo kan geen enkele sector stilletjes een andere vorm krijgen. */
const PAD = {
  automatisering: { plus: 'perMedewerker', prijs: 'vast', kosten: 7000, duur: 7, deel: 0.064,
    uitleg: 'Dezelfde mensen kunnen meer aan -- maar techniek en onderhoud verhogen de vaste lasten.' },
  kwaliteit: { plus: 'kwaliteit', prijs: 'inkoop', kosten: 4500, duur: 5, deel: 0.045,
    uitleg: 'Betere beleving, dus een hogere reputatie en meer vraag -- tegen duurdere inkoop.' },
  energie: { plus: 'vast', prijs: null, kosten: 4000, duur: 5, deel: 0.11,
    uitleg: 'Lagere vaste lasten, zonder keerzijde in de exploitatie. De prijs zit in de uitrol.' },
  keten: { plus: 'inkoop', prijs: 'vast', extra: 'risico', kosten: 4500, duur: 4, deel: 0.057,
    uitleg: 'Minder verspilling en minder technisch risico -- tegen planning- en volgsystemen die blijven draaien.' },
  concept: { plus: 'markt', prijs: 'vast', kosten: 7500, duur: 6, deel: 0.049, onzeker: true,
    uitleg: 'Nieuwe klantsegmenten. De opbrengst is onzeker -- dit loopt het vaakst anders dan gedacht.' }
};
const PADEN = Object.keys(PAD);

/* PER SECTOR: [naam, plus, prijs, deel, extra?, vereist?, bouw?].

   `plus` en `prijs` zijn de twee getallen van de hefboom; `deel` is wat
   uitrollen kost als fractie van de bouwsom; `extra` alleen waar het pad er een
   kent (de ketenrichting verlaagt ook het risico, en bij een concern dat zijn
   eigen toelevering bouwt ook de bouwsom); `vereist` staat alleen bij `concept`.

   DE PRIJS IS PER SECTOR GEIJKT EN DE VORM NIET, en dat is een correctie die uit
   de meter kwam. Eerst had elk pad EEN uitrolfractie voor alle zeven sectoren,
   en dat leek eerlijk -- tot scripts/magnaat-onderzoek.js het uitrekende. Een
   energiebesparing van dertig procent is bij een vervoerder honderden euro's per
   maand en bij een winkel een paar tientjes, want wat `vast` per maand kost
   loopt tussen de sectoren een orde van grootte uiteen. Dezelfde prijs vragen
   voor allebei betekent dat de ene sector een koopje krijgt en de andere een
   knoop die zich nooit terugverdient: negentien van de vijfendertig stonden
   buiten de band, tot 581 maanden aan toe.

   EN DAT KOPPELT DEZE TABEL AAN ./sectoren.js, wat een keer is misgegaan en
   waar een toets nu op staat. Toen `vast` daar voor kantoor en industrie werd
   bijgesteld (van 0,08% van de bouwsom naar 0,5%, ijking 4 van fase A opnieuw),
   verdiende hun energieknoop zich ineens in 1,3 maand terug in plaats van in
   zeven -- de besparing werd zes keer zo groot en de prijs bleef staan. Wie aan
   `vast` komt, hoort hier langs te gaan; `test/spelonderzoek.test.js` zakt
   anders, en dat is precies hoe het hoort te knellen.

   Wat WEL gedeeld blijft is de vorm: welk veld omhoog gaat, welk veld de prijs
   is, wat het vereist en of het onzeker is. Een sector kan dus andere getallen
   krijgen maar geen ander soort knoop, en `test/spelonderzoek.test.js` handhaaft
   dat. De getallen hieronder zijn gezet op een terugverdientijd van zeven
   maanden op een op maat gebouwde vestiging in die sector. */
const SECTOREN = {
  horeca: {
    automatisering: ['Procesautomatisering', 1.35, 1.15, 0.061],
    kwaliteit: ['Productkwaliteit', 1.15, 1.016, 0.011],
    energie: ['Energie-efficientie', 0.72, null, 0.011],
    keten: ['Logistiek en verspilling', 0.89, 1.06, 0.052, 0.85],
    concept: ['Conceptinnovatie', 1.16, 1.08, 0.037, null, ['automatisering', 'kwaliteit']]
  },
  hotel: {
    automatisering: ['Housekeeping-automatisering', 1.30, 1.12, 0.016],
    kwaliteit: ['Guest experience', 1.18, 1.041, 0.009],
    energie: ['Energiebeheer', 0.70, null, 0.004],
    keten: ['Roomservice-efficientie', 0.90, 1.05, 0.016, 0.88],
    concept: ['Revenue management', 1.20, 1.05, 0.034, null, ['kwaliteit', 'keten']]
  },
  logistiek: {
    automatisering: ['Hogere voertuigbenutting', 1.28, 1.10, 0.209],
    kwaliteit: ['Predictive maintenance', 1.06, 1.005, 0.008, 0.62],
    energie: ['Zuiniger materieel', 0.74, null, 0.04],
    keten: ['Route-optimalisatie', 0.88, 1.07, 0.13, 0.86],
    concept: ['Laad- en energiebeheer', 1.14, 1.06, 0.055, null, ['energie', 'automatisering']]
  },
  retail: {
    automatisering: ['Kassa- en voorraadautomatisering', 1.32, 1.13, 0.039],
    kwaliteit: ['Winkelbeleving', 1.14, 1.006, 0.012],
    energie: ['Koeling en verlichting', 0.71, null, 0.013],
    keten: ['Inkoopketen', 0.86, 1.08, 0.164, 0.90],
    concept: ['Eigen merk', 1.15, 1.07, 0.037, null, ['keten', 'kwaliteit']]
  },
  'vrije-tijd': {
    automatisering: ['Toegang en planning', 1.30, 1.12, 0.049],
    kwaliteit: ['Belevingsontwerp', 1.20, 1.035, 0.018],
    energie: ['Klimaat en water', 0.73, null, 0.018],
    keten: ['Materiaalbeheer', 0.90, 1.04, 0.034, 0.87],
    concept: ['Nieuw programma', 1.18, 1.09, 0.048, null, ['kwaliteit', 'automatisering']]
  },
  kantoor: {
    automatisering: ['Werkstroomautomatisering', 1.38, 1.16, 0.187],
    kwaliteit: ['Dienstverlening', 1.16, 1.059, 0.015],
    energie: ['Gebouwbeheer', 0.75, null, 0.0066],
    keten: ['Leveranciersregie', 0.88, 1.09, 0.022, 0.90],
    concept: ['Nieuwe dienst', 1.17, 1.08, 0.054, null, ['automatisering', 'kwaliteit']]
  },
  industrie: {
    automatisering: ['Productielijnrobotisering', 1.34, 1.14, 0.035],
    kwaliteit: ['Procesbeheersing', 1.12, 1.007, 0.007, 0.70],
    energie: ['Warmteterugwinning', 0.68, null, 0.013],
    /* De enige plek waar een uitvinding de BOUWSOM raakt: een concern dat zijn
       eigen toelevering regelt, bouwt zijn eigen hallen goedkoper. Dat is de
       ene lange lijn in deze boom -- hij werkt op wat je NOG gaat bouwen en
       vermenigvuldigt dus je uitbreiding in plaats van je exploitatie. */
    keten: ['Toelevering en modulair bouwen', 0.87, 1.05, 0.08, 0.90, null, 0.90],
    concept: ['Nieuwe productlijn', 1.15, 1.07, 0.027, null, ['keten', 'energie']]
  }
};
const SECTORLIJST = Object.keys(SECTOREN);

/* DE STAM. Sectorloos, goedkoop en kort: het is de voorwaarde voor de rest en
   niet zelf de winst. Hij verlaagt de inkoop en de vaste lasten een beetje --
   wie zijn cijfers kent, gooit minder weg. */
const STAM = 'meten';
const BOOM = {
  meten: { naam: 'Meten en sturen', pad: 'stam', sector: null, vereist: [],
    kosten: 2500, duur: 3, implementatie: 0.017,
    uitleg: 'Weten waar je geld heen gaat, is de voorwaarde voor elke richting.',
    effect: { inkoop: 0.97, vast: 0.94 } }
};
for (const [sector, paden] of Object.entries(SECTOREN)) {
  for (const [pad, rij] of Object.entries(paden)) {
    const p = PAD[pad];
    const [naam, plus, prijs, deel, extra, vereist, bouw] = rij;
    const effect = { [p.plus]: plus };
    if (p.prijs && prijs) effect[p.prijs] = prijs;
    if (p.extra && extra) effect[p.extra] = extra;
    if (bouw) effect.bouw = bouw;
    BOOM[sector + '.' + pad] = { naam, pad, sector, uitleg: p.uitleg,
      kosten: p.kosten, duur: p.duur, implementatie: deel, onzeker: !!p.onzeker,
      vereist: [STAM].concat((vereist || []).map(v => sector + '.' + v)), effect };
  }
}
const KNOPEN = Object.keys(BOOM);

/* Welke knopen er voor deze sector bestaan; de stam hoort bij iedereen. */
const boomVoor = (sector) => KNOPEN.filter(k => BOOM[k].sector === null || BOOM[k].sector === sector);

module.exports = { BOOM, KNOPEN, PADEN, PAD, VELDEN, SECTORLIJST, STAM, boomVoor };
