/* WAT ER ONDER EEN STAND NOG WERKT -- de andere helft van de vraag.

   ISOLATIEPROEF.json telt wat er DICHTGAAT. Dat is de halve waarheid, en het is
   de helft die een verkeerd gevoel geeft: hoe meer er dicht is, hoe beter het
   lijkt. Een isolatiestand die niemand durft aan te zetten, beschermt niemand --
   en of iemand hem durft aan te zetten hangt af van wat er nog KAN.

   Apple's Lockdown Mode schakelt het toestel ook niet uit. Dat is geen
   vriendelijkheid: het is de reden dat de stand gebruikt wordt.

   DE LIJST IS MET DE HAND EN DAT IS DE BEDOELING. Een verhaal als "ik kan zien
   wat er van mijn geld af ging" is geen route maar een SAMENHANG van routes, en
   welke verhalen kritiek zijn is een oordeel. Wat de machine hier doet, is per
   verhaal de paden nalopen en zeggen of ze open staan -- niet bedenken welke
   verhalen ertoe doen.

   DRIE UITKOMSTEN, EN DE MIDDELSTE IS DE INTERESSANTE:

     werkt          elk pad van dit verhaal staat open
     werkt beperkt  een deel staat open; de mens kan lezen maar niet handelen
     werkt niet     geen enkel pad staat open

   Een verhaal dat op `werkt beperkt` staat, is precies waar een ontwerpbesluit
   zit: is dat acceptabel, of hoort dit verhaal heel te blijven? Die vraag is
   niet aan deze module. */
'use strict';

/* De verhalen. Per verhaal: wie het doet, wat het is, en de paden die het
   werkelijk aanroept. `moetHeel` markeert de verhalen waarvan dit huis vindt dat
   ze onder ELKE stand compleet horen te blijven -- dat is een belofte, en een
   belofte die zakt hoort zichtbaar te zakken. */
const VERHALEN = Object.freeze([
  { id: 'inloggen', wie: 'lid', wat: 'binnenkomen', moetHeel: true,
    paden: ['/api/login'],
    waarom: 'wie niet kan inloggen, kan ook niets lezen; dan is "lezen loopt door" een zin zonder inhoud' },
  { id: 'hulpdienst', wie: 'iedereen', wat: 'een hulpdienst bereiken', moetHeel: true,
    paden: ['/api/veiligheid/alarm'],
    waarom: 'een hulpdienst stilzetten om een incident in te dammen is nooit de goedkoopste keuze' },
  { id: 'storing-melden', wie: 'iedereen', wat: 'melden dat er iets stuk is', moetHeel: true,
    paden: ['/api/fout/client'],
    waarom: 'dit is het kanaal waarlangs wij HOREN dat er iets mis is' },
  { id: 'geld-lezen', wie: 'lid', wat: 'zien wat er van mijn geld af ging', moetHeel: true,
    paden: ['/api/pay/overzicht', '/api/bank/afschrift', '/api/bank/overzicht'],
    waarom: 'juist wie denkt dat er iets mis is, moet kunnen kijken. Dit is de eerste handeling van ' +
      'een mens die zijn account niet vertrouwt' },
  { id: 'agenda-lezen', wie: 'lid', wat: 'zien wat er vandaag op de agenda staat', moetHeel: false,
    paden: ['/api/agenda/mijn'] },
  { id: 'bericht-lezen', wie: 'lid', wat: 'mijn post lezen', moetHeel: false,
    paden: ['/api/member/rtmail/inbox'] },
  { id: 'geld-sturen', wie: 'lid', wat: 'geld sturen', moetHeel: false,
    paden: ['/api/pay/stuur'],
    waarom: 'hoort onder een gesloten stand juist DICHT te zitten; hij staat hier zodat zichtbaar is ' +
      'dat de stand werkelijk iets doet' },
  { id: 'zelf-beschermen', wie: 'lid', wat: 'mezelf strenger zetten', moetHeel: true,
    paden: ['/api/isolatie/mijn', '/api/isolatie/mijn/zet'],
    waarom: 'de knop waarmee een mens zich beschermt, mag nooit dichtvallen door de bescherming zelf' },
  { id: 'ontsluiten-aanvragen', wie: 'lid', wat: 'vragen om er weer uit te mogen', moetHeel: true,
    paden: ['/api/isolatie/mijn/ontsluiting', '/api/isolatie/mijn/ontsluiting/stap'],
    waarom: 'een stand zonder uitgang is een val, en een val zet niemand aan' }
]);

function maakBruikbaarheid({ isolatie, functies }) {

  /* Per verhaal: staat elk pad open onder deze stand? De methode komt uit het
     verhaal en niet uit een aanname: deze paden zijn allemaal POST, want dat is
     wat dit huis is. */
  function meet(context) {
    const uit = [];
    for (const v of VERHALEN) {
      const paden = v.paden.map(pad => {
        const b = isolatie.besluit({ pad, methode: 'POST', context });
        return { pad, open: b.toegestaan, reden: b.toegestaan ? null : b.reden, uitleg: b.uitleg };
      });
      const open = paden.filter(p => p.open).length;
      const stand = open === paden.length ? 'werkt' : (open ? 'werkt beperkt' : 'werkt niet');
      uit.push({ id: v.id, wie: v.wie, wat: v.wat, moetHeel: v.moetHeel === true,
        stand, open, van: paden.length, paden,
        /* EEN GEBROKEN BELOFTE IS EEN EIGEN UITKOMST en geen regel in een lijst.
           Wie `moetHeel` draagt en niet op `werkt` staat, hoort er als BELOFTE
           GEZAKT uit te komen -- niet als een van de negen rijen. */
        beloftegezakt: v.moetHeel === true && stand !== 'werkt',
        waarom: v.waarom || null });
    }
    return uit;
  }

  /* De samenvatting per stand, voor het register en het scherm. Geen
     percentage: negen verhalen zijn geen steekproef, en 78% van negen zegt
     minder dan de rij zelf. */
  function overStanden(standen) {
    const uit = {};
    for (const stand of standen || ['normaal', 'beschermd', 'isolatie']) {
      const ctx = { standen: { huis: 'normaal', proef: stand } };
      /* De stand wordt als losse drager aangeboden; de join maakt er de
         effectieve stand van, precies zoals in het echt. */
      const rijen = meet({ standen: { huis: stand } });
      uit[stand] = {
        werkt: rijen.filter(r => r.stand === 'werkt').length,
        beperkt: rijen.filter(r => r.stand === 'werkt beperkt').length,
        werktNiet: rijen.filter(r => r.stand === 'werkt niet').length,
        belofteGezakt: rijen.filter(r => r.beloftegezakt).map(r => ({ id: r.id, stand: r.stand,
          dicht: r.paden.filter(p => !p.open).map(p => p.pad) })),
        rijen
      };
      void ctx;
    }
    return uit;
  }

  return { VERHALEN, meet, overStanden };
}

module.exports = { maakBruikbaarheid, VERHALEN };
