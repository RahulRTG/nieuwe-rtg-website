/* ============================================================================
   EEN SESSIE VERFIJNEN -- drie registers, een regel.

   Drie keer achter elkaar kwam dezelfde vorm boven: de bewakerskaart zegt
   welke SOORT sessie een route vraagt, en de handeling erachter vraagt daar
   iets specifiekers van.

     member   -> member-account    er moet een ACCOUNT achter de pas zitten
     supplier -> zaak-persoonlijk  er moet een PERSOON achter de zaak zitten
     office   -> kantoor-op-naam   er moet iemand ZITTEN, geen gedeelde code
     een lid  -> member-signature  het lid moet aantoonbaar zijn wie het zegt
     member   -> een zwaardere pas  de deur vraagt Lifestyle of Business

   Alle drie zijn ze een verfijning en geen tegenspraak: de soort deur blijft
   dezelfde, alleen wie er aanklopt wordt scherper. En alle drie dragen ze
   dezelfde grens, want zonder die grens gaat het mis op precies dezelfde
   manier: vanaf een ANDERE rol is het geen verfijning maar een ander antwoord,
   en dan weet een routetabel het beter dan de bewakerskaart. Dat is hoe
   `openbaar` ooit `member-zakelijk` werd (zie NOOIT_OPWAARDEREN in
   ./lijfsleutels.js).

   Die regel stond in drie bestanden. Deze module roept ze op volgorde aan en
   is de enige plek waar de proef ze hoeft te kennen; de registers houden hun
   eigen redenering, want die verschilt per geval en hoort bij de data. */
'use strict';

const { accountRolVoor, VOORVOEGSELS: ACCOUNT_V, PADEN: ACCOUNT_P } = require('./accountroutes');
const { persoonsRolVoor, VOORVOEGSELS: PERSOON_V, PADEN: PERSOON_P } = require('./persoonsroutes');
const { kantoorRolVoor, VOORVOEGSELS: KANTOOR_V, PADEN: KANTOOR_P } = require('./kantoorroutes');
const { signatureRolVoor, VOORVOEGSELS: SIGN_V, PADEN: SIGN_P } = require('./signatureroutes');
const { pasRolVoor, VOORVOEGSELS: PAS_V } = require('./pasroutes');

/* Op volgorde, en die volgorde is een VORM en geen voorrang -- maar niet meer
   om de reden die hier eerst stond.

   Er stond: "ze sluiten elkaar uit, want elk register verfijnt een andere
   uitgangsrol". Dat klopte tot er een vijfde bij kwam: `pas` verfijnt net als
   `account` vanaf `member`. Een toets ving dat meteen, en terecht -- alleen
   was het bewaakte kenmerk een PROXY. Wat er werkelijk toe doet is dat geen
   PAD door twee registers wordt geclaimd; dan kan de volgorde nooit beslissen
   wat er gebeurt. Dat is nu wat de toets meet, en elk register draagt daarvoor
   zijn `paden` mee.

   Een uitzondering die daar bewust op staat: /api/member/rendezvous zou zowel
   `signature` als een pas-eis passen. De zwaarste eis wint, dus `signature`
   staat eerder -- en /api/member/rendezvous staat daarom NIET in pasroutes.js. */
const REGISTERS = [
  { naam: 'account',  van: 'member',   naar: 'member-account',   beslis: accountRolVoor,
    paden: [...ACCOUNT_V.map(v => v.pad), ...ACCOUNT_P] },
  { naam: 'persoon',  van: 'supplier', naar: 'zaak-persoonlijk', beslis: persoonsRolVoor,
    paden: [...PERSOON_V.map(v => v.pad), ...PERSOON_P] },
  { naam: 'kantoor',  van: 'office',   naar: 'kantoor-op-naam',  beslis: kantoorRolVoor,
    paden: [...KANTOOR_V.map(v => v.pad), ...KANTOOR_P] },
  /* Deze laatste staat apart: hij verfijnt niet EEN uitgangsrol maar drie
     (member, member-account, member-lifestyle), omdat de ontmoetpoort drie
     dingen tegelijk vraagt en geen van die drie sessies ze alle drie heeft.
     Daarom staat hij ACHTERAAN: de registers hierboven verfijnen elk vanaf
     precies een rol, en dat blijft de regel waarop de volgorde geen voorrang
     is. Deze mag als enige overlappen, en dan wint de specifiekere eis. */
  { naam: 'signature', van: 'een lid', naar: 'member-signature', beslis: signatureRolVoor,
    paden: [...SIGN_V.map(v => v.pad), ...SIGN_P] },
  /* En de eenvoudigste: geen account, geen persoon, geen geverifieerde
     identiteit -- gewoon een andere PAS. Hij staat na `signature` omdat
     /api/member/rendezvous allebei zou passen en de zwaarste eis moet winnen:
     daar is een pas nodig EN een geverifieerd account. */
  { naam: 'pas', van: 'member', naar: 'een zwaardere pas', beslis: pasRolVoor,
    paden: PAS_V.map(v => v.pad) }
];

/* Geeft { rol, register } als er verfijnd wordt, anders { rol: null }.
   `heeftSleutel` is verplicht: verfijnen naar een rol waar geen sessie voor
   is opgehaald zou de proef zonder sleutel laten aankloppen, en dat meet
   niets terwijl het er in de uitslag uitziet als een gemeten route. */
function verfijn(huidigeRol, pad, heeftSleutel) {
  for (const r of REGISTERS) {
    const uit = r.beslis(huidigeRol, pad);
    if (!uit.rol) continue;
    if (!heeftSleutel(uit.rol)) {
      return { rol: null, register: r.naam,
        reden: 'er is geen sessie opgehaald voor `' + uit.rol + '`' };
    }
    return { rol: uit.rol, register: r.naam, reden: null };
  }
  return { rol: null, register: null, reden: 'geen register verfijnt dit pad' };
}

module.exports = { REGISTERS, verfijn };
