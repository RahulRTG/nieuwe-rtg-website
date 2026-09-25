/* Bedrijfsmaten, deel GROEI: acquisitie, CAC, activatie, cohort, retentie, churn.
   Vorm en regels staan in ./index.js; dit bestand is alleen gegevens. */
'use strict';
const c = (bestand, citaat) => ({ bestand, citaat });
const REG = 'server/kern/ledenregister.js', CTR = 'server/kern/commercie/contract.js';
const AANMAAK = c('server/accounts/users.js', 'created_at');

module.exports = [
  { id: 'acquisitie.nieuwe-leden', domein: 'acquisitie', wereld: 'consument', eenheid: 'leden per week',
    betekenis: 'Hoeveel mensen er per week lid werden.', berekening: 'nog niet vastgesteld',
    actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: null, graad: 'onbekend', afhankelijk: [],
    bron: [AANMAAK], definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { definitie: 'Een account is geen lid: een gast (tier guest) heeft er een, en een pasaanvraag is geen lidmaatschap. Wanneer iemand als NIEUW LID telt is niet besloten.',
      projectie: 'Niet gebouwd.', bewijs: 'Volgt uit de projectie.', groepsgrens: 'Volgt uit de projectie.', eigenaar: 'Niemand.' } },

  { id: 'acquisitie.via-werkgever', domein: 'acquisitie', wereld: 'consument', eenheid: 'leden per werkgever',
    betekenis: 'Aanwas via de wervingslink van een werkgever: welk bedrijf hoeveel leden bracht, nooit wie.',
    berekening: 'telling per zaakcode van de uitnodiging waarmee een lid binnenkwam',
    actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: 'kern/ledenregister', graad: 'onbekend', afhankelijk: [],
    bron: [c(REG, 'r.via && r.via.code')], definitie: [c(REG, 'AANWAS PER BEDRIJF')],
    projectie: [c(REG, 'perBedrijf: sorteerTelling(perBedrijf)')], bewijs: null, groepsgrens: null,
    waarom: { bewijs: 'Geen graad en geen peilmoment in het antwoord.',
      groepsgrens: 'De telling per bedrijf toont ook een 1: een werkgever die een medewerker aanbracht, is daarmee aan te wijzen.' } },

  { id: 'acquisitie.kanaal', domein: 'acquisitie', wereld: 'consument', eenheid: 'leden per kanaal',
    betekenis: 'Via welke campagne, verwijzing of link iemand binnenkwam.', berekening: 'nog niet vastgesteld',
    actualiteit: 'onbekend', privacy: 'leden', minGroep: 10, eigenaar: null, graad: 'onbekend', afhankelijk: ['campagnes.rtg-marketing'],
    bron: null, definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { bron: 'Geen enkele route legt een herkomstkanaal vast (nul treffers in server/ op utm, verwijzer, referral of acquisitiekanaal). Alleen de werkgeverslink wordt onthouden.',
      definitie: 'Volgt pas als er een bron is.', projectie: 'Idem.', bewijs: 'Idem.', groepsgrens: 'Idem.', eigenaar: 'Niemand.' } },

  { id: 'cac.per-kanaal', domein: 'cac', wereld: 'rtg-intern', eenheid: 'euro per nieuw lid',
    betekenis: 'Wat het kost om via een kanaal een lid te werven.', berekening: 'marketinguitgaven per kanaal / nieuwe leden per kanaal',
    actualiteit: 'onbekend', privacy: 'huis', minGroep: null, eigenaar: null, graad: 'onbekend',
    afhankelijk: ['acquisitie.kanaal', 'acquisitie.nieuwe-leden', 'campagnes.rtg-marketing'],
    bron: 'afgeleid', definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { definitie: 'Niet besloten welke uitgaven meetellen.', projectie: 'Niet gebouwd.', bewijs: 'Volgt uit de projectie.', eigenaar: 'Niemand.' } },

  { id: 'activatie.eerste-waarde', domein: 'activatie', wereld: 'consument', eenheid: 'aandeel van een cohort',
    betekenis: 'Het aandeel nieuwe leden dat binnen een termijn een eerste geslaagde uitkomst had (een boeking, rit of bestelling die afliep).',
    berekening: 'nog niet vastgesteld', actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: null, graad: 'onbekend',
    afhankelijk: ['cohort.aanmeldweek', 'uitkomst.rit-afgerond'],
    bron: [AANMAAK, c('server/kern/kantoor/metrics.js', 'r.finishedAt')], definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { definitie: 'Wat activatie is, is niet besloten: welke uitkomst telt, in welke wereld, binnen welke termijn. De gebeurtenissen bestaan wel -- dit is het goedkoopste gat van de funnel.',
      projectie: 'Niet gebouwd.', bewijs: 'Volgt uit de projectie.', groepsgrens: 'Volgt uit de projectie.', eigenaar: 'Niemand.' } },

  { id: 'cohort.aanmeldweek', domein: 'cohort', wereld: 'consument', eenheid: 'leden per cohort',
    betekenis: 'Leden gegroepeerd naar het moment waarop ze binnenkwamen, zodat gedrag per groep te volgen is.',
    berekening: 'nog niet vastgesteld', actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: null, graad: 'onbekend',
    afhankelijk: ['acquisitie.nieuwe-leden'],
    bron: [AANMAAK], definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { definitie: 'Niet besloten waarop een cohort begint: het account, de eerste betaling of het pasbesluit.',
      projectie: 'Niet gebouwd.', bewijs: 'Volgt uit de projectie.', groepsgrens: 'Bij livegang zijn weekcohorten klein; zonder de groepspoort wordt een cohort een mens.', eigenaar: 'Niemand.' } },

  { id: 'retentie.actief-na-30-dagen', domein: 'retentie', wereld: 'consument', eenheid: 'aandeel van een cohort',
    betekenis: 'Het aandeel van een cohort dat na dertig dagen nog gebruikmaakt van RTG.', berekening: 'nog niet vastgesteld',
    actualiteit: 'onbekend', privacy: 'leden', minGroep: 10, eigenaar: null, graad: 'onbekend', afhankelijk: ['cohort.aanmeldweek'],
    bron: null, definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { bron: 'Er is geen duurzaam spoor van het laatste gebruik per lid. Sessies leven in het geheugen (kern/sessies.js) en toestellen.laatstGezien gaat over een apparaat, niet over een lid.',
      definitie: 'Volgt pas als er een bron is (en wat telt als gebruik).', projectie: 'Idem.', bewijs: 'Idem.', groepsgrens: 'Idem.', eigenaar: 'Niemand.' } },

  { id: 'retentie.contract-verlengd', domein: 'retentie', wereld: 'consument', eenheid: 'contracten per periode',
    betekenis: 'Hoeveel contractuele lidmaatschappen bij hun verlengmoment werden verlengd.', berekening: 'nog niet vastgesteld',
    actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: null, graad: 'onbekend', afhankelijk: [],
    bron: [c(CTR, 'function verleng')], definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { definitie: 'Niet besloten; en de meeste betalende leden hebben een pas zonder contract (AFSPRAAK.md), dus deze maat ziet alleen de contractuele treden.',
      projectie: 'Niet gebouwd.', bewijs: 'Volgt uit de projectie.', groepsgrens: 'Volgt uit de projectie.', eigenaar: 'Niemand.' } },

  { id: 'churn.contract-opgezegd', domein: 'churn', wereld: 'consument', eenheid: 'contracten per periode',
    betekenis: 'Opzeggingen van contractuele lidmaatschappen.', berekening: 'nog niet vastgesteld',
    actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: null, graad: 'onbekend', afhankelijk: [],
    bron: [c(CTR, 'function zegOp'), c(CTR, 'function beeindig')], definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { definitie: 'Churn is nergens gedefinieerd. De standen OPZEGGEND en GEEINDIGD bestaan; of opzeggen of eindigen telt, en over welke noemer, is niet besloten.',
      projectie: 'Niet gebouwd.', bewijs: 'Volgt uit de projectie.', groepsgrens: 'Volgt uit de projectie.', eigenaar: 'Niemand.' } },

  { id: 'churn.pas-verlaagd', domein: 'churn', wereld: 'consument', eenheid: 'leden per periode',
    betekenis: 'Leden die naar een lagere pas of naar gast gingen.', berekening: 'nog niet vastgesteld',
    actualiteit: 'onbekend', privacy: 'leden', minGroep: 10, eigenaar: null, graad: 'onbekend', afhankelijk: [],
    bron: null, definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { bron: 'accounts.setTier overschrijft de pas (UPDATE users SET tier) en bewaart de vorige stand nergens. Een verlaging is achteraf niet te zien.',
      definitie: 'Volgt pas als er een bron is.', projectie: 'Idem.', bewijs: 'Idem.', groepsgrens: 'Idem.', eigenaar: 'Niemand.' } }
];
