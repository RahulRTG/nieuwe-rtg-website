/* Magnaat: UITSTAPPEN -- iemand stopt, en de campagne gaat door.

   Fase C, de overdracht. En hij dicht een gat dat pas zichtbaar wordt in een
   LANGE partij: `spelOpgeven` in ../partij.js beeindigt het hele potje zodra
   iemand ermee ophoudt. Voor schaken klopt dat -- er zijn er twee en de een
   geeft de ander de winst. Voor een campagne van zes over zesendertig maanden
   is het rampzalig: vijf mensen zijn hun partij kwijt omdat er een wegging.

   DAT IS OOK DE VRAAG DIE VERHAAL.md STELDE en die tot nu toe alleen voor het
   BEWAARDE deel beantwoord was ("wat gebeurt er als een speler stopt?"). Voor
   zijn loopbaan staat het antwoord in ../loopbaan.js. Voor zijn BEDRIJF stond
   het nergens.

   DRIE REGELS, en ze volgen alle drie uit de grondwet.

   1. ER WORDT NIETS GESCHAPEN EN NIETS VERNIETIGD. Wie uitstapt neemt zijn kas
      mee uit de telling, maar zijn panden gaan ergens heen: naar een opvolger
      die ervoor BETAALT, of ze worden afgewikkeld zoals bij sluiten. Een zaak
      die verdampt zou de tafel armer maken door iemands vertrek, en een zaak
      die gratis overgaat maakt zijn opvolger rijker door hetzelfde vertrek.
      Allebei is fout, en de geldpompkeuring hoort het te zien.

   2. EEN OPVOLGER BETAALT DE BOEKWAARDE. Niet een prijs die de vertrekker
      verzint: die zou hij op nul kunnen zetten en zo zijn hele bedrijf aan een
      medespeler schenken. Dat is geen overdracht maar een bondgenootschap met
      een andere naam, en het is precies het patroon waar ../handel.js een
      prijsband voor kreeg.

   3. WIE VOOR HEM WERKTE, HOORT HET TE WETEN. Lopende dienstverbanden eindigen
      met de reden `werkgever gestopt` -- dezelfde reden die ../loopbaan.js al
      kent -- en de jaren die iemand er werkte blijven van hem. Zie VERHAAL.md.

   WAT HIJ NIET IS: opgeven. Wie opgeeft zegt "ik verlies"; wie uitstapt zegt
   "ik ben eruit, ga door zonder mij". In een campagne is dat tweede de normale
   gang van zaken -- mensen verhuizen, krijgen een kind, hebben het druk -- en
   het hoort geen straf te zijn voor de vier anderen. */
'use strict';

module.exports = ({ K, wieHeeft, liquideer, verhuis, waarde, rond }) => {
  /* WAT EEN PAND KOST VOOR EEN OPVOLGER. De ondernemingswaarde zoals de rest
     van de motor hem rekent (./waardering.js), en niet een eigen som -- twee
     antwoorden op "wat is dit waard" lopen uiteen zodra iemand aan een van
     beide sleutelt. */
  const prijsVan = (v) => Math.max(0, rond(waarde(v)));

  /* WAT ER TE KIEZEN VALT, voordat je het doet. Zonder dit getal is uitstappen
     een sprong in het duister: je weet niet of je opvolger het kan betalen en
     niet wat er gebeurt als hij het niet kan. */
  function voorstel(st, h, naar) {
    const rij = st.vestigingen[h] || [];
    const totaal = rij.reduce((n, v) => n + prijsVan(v), 0);
    const kas = naar ? (st.geld[naar] || 0) : 0;
    return {
      vestigingen: rij.map(v => ({ id: v.id, naam: v.naam, sector: v.sector, prijs: prijsVan(v) })),
      totaal: rond(totaal),
      naar: naar || null,
      kanBetalen: naar ? kas >= totaal : null,
      /* Wat er gebeurt als er geen opvolger is. Geen straf en geen bonus: het
         is precies wat sluiten ook doet. */
      anders: 'Zonder opvolger worden je zaken afgewikkeld zoals bij sluiten: '
        + 'de halve bouwsom terug, contracten afgekocht, kavels weer vrij.'
    };
  }

  /* UITSTAPPEN. Geeft terug wat er gebeurd is, want een speler die vertrekt
     hoort te zien wat er met zijn levenswerk is gebeurd -- en de rest van de
     tafel hoort het in het log te vinden. */
  function uitstappen(potje, h, naar) {
    const st = potje.staat;
    if (st.uit && st.uit[h]) return { status: 409, error: 'Je bent al uitgestapt.' };
    if (naar && naar === h) return { status: 400, error: 'Aan jezelf overdragen kan niet.' };
    if (naar && !potje.spelers.includes(naar)) return { status: 404, error: 'Die speler zit niet aan tafel.' };
    if (naar && st.uit && st.uit[naar]) return { status: 409, error: 'Die speler is zelf uitgestapt.' };

    const rij = (st.vestigingen[h] || []).slice();
    const som = rij.reduce((n, v) => n + prijsVan(v), 0);
    /* KAN HIJ HET BETALEN? Zo niet, dan gaat de overdracht NIET half door. Half
       overdragen zou de vertrekker met een restje achterlaten dat niemand meer
       beheert -- en dat is precies het soort losse eind waar deze laag voor
       bestaat. */
    if (naar && (st.geld[naar] || 0) < som)
      return { status: 400, error: 'Die speler kan de overname niet betalen: ' + rond(som) + ' nodig.' };

    const gedaan = { overgedragen: [], afgewikkeld: [], opbrengst: 0 };
    for (const v of rij) {
      if (naar) {
        const prijs = prijsVan(v);
        verhuis(st, naar, v.id, prijs);
        gedaan.overgedragen.push({ id: v.id, naam: v.naam, prijs });
      } else {
        /* `liquideer` REKENT en BOEKT NIET: hij geeft de netto-opbrengst terug
           (halve bouwsom, min wat er aan hypotheek op stond) en laat het aan de
           aanroeper om hem bij te schrijven. Zo kan ../bank-maand.js dezelfde
           weg gebruiken en de opbrengst eerst met de schuld verrekenen. Wie dat
           vergeet, laat een zaak verdampen zonder dat er iets voor terugkomt --
           en dat is precies de waardevernietiging die de eerste regel hierboven
           verbiedt. */
        const opbrengst = liquideer(st, h, v.id);
        st.geld[h] += opbrengst;
        gedaan.afgewikkeld.push({ id: v.id, naam: v.naam, opbrengst: rond(opbrengst) });
        gedaan.opbrengst += opbrengst;
      }
    }

    /* DE MENSEN. Wie voor hem werkte staat vanaf nu op straat, met een reden die
       zegt wat er gebeurde -- en die reden reist mee naar de loopbaan. */
    const los = [];
    for (const d of (st.diensten || []).filter(x => x.status === 'loopt' && x.werkgever === h)) {
      d.status = 'geeindigd'; d.tot = st.maand; d.reden = 'werkgever gestopt';
      los.push(d.werknemer);
    }
    /* En zijn eigen baan, als hij er een had: die eindigt ook, met zijn eigen
       reden -- hij stapt eruit, hij is niet ontslagen. */
    for (const d of (st.diensten || []).filter(x => x.status === 'loopt' && x.werknemer === h)) {
      d.status = 'geeindigd'; d.tot = st.maand; d.reden = 'uitgestapt';
    }
    /* Openstaande vacatures van een vertrekker zijn geen aanbod meer. */
    for (const f of (st.functies || []).filter(x => x.status === 'open' && x.werkgever === h))
      f.status = 'ingetrokken';

    (st.uit = st.uit || {})[h] = { maand: st.maand, naar: naar || null,
      overgedragen: gedaan.overgedragen.length, afgewikkeld: gedaan.afgewikkeld.length };
    gedaan.opbrengst = rond(gedaan.opbrengst);
    return { status: 200, ok: true, naar: naar || null, som: rond(som),
      losgelaten: los.length, gedaan };
  }

  /* WIE ER NOG MEEDOET. De eindstand en de beurtvolgorde horen een uitgestapte
     speler over te slaan -- hij staat nog wel op de partij (zijn geschiedenis
     is niet uitgewist), maar hij speelt niet meer mee. */
  const speeltNog = (st, h) => !((st.uit || {})[h]);
  const uitgestapt = (st) => Object.keys(st.uit || {});

  return { prijsVan, voorstel, uitstappen, speeltNog, uitgestapt };
};
