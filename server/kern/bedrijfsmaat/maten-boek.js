/* Bedrijfsmaten, deel HET BOEK VAN RTG: wat RTG als organisatie uitgeeft en
   verschuldigd is (besluiten C8 tot en met C12, 27 en 28 september 2026). De bron is
   kern/rtgboek.js, gevuld door het Financien-kantoor op naam; alle vijf dragen
   daarom de graad vermoed. Vorm en regels staan in ./index.js; dit bestand is
   alleen gegevens. */
'use strict';
const c = (bestand, citaat) => ({ bestand, citaat });
const DEF = 'server/kern/bedrijfsmaat/definities.js', SRB = 'server/kern/bedrijfsmaat/stand-rtgboek.js';
const BOEK = c('server/kern/rtgboek.js', 'function zet(');
const HALF = c('server/kern/rtgboek.js', 'totaalCenten: ontbreekt.length ? null');

module.exports = [
  { id: 'marge.operationeel-rtg', domein: 'marge', wereld: 'rtg-intern', eenheid: 'eurocent per maand, zonder btw',
    betekenis: 'Brutomarge min stroom en serverhuur min de vaste kosten van de organisatie (mensen, huisvesting, diensten).',
    berekening: 'ontvangen omzet min platformkosten, min de nota\'s van stroom en serverhuur, min de vaste lasten uit het boek',
    actualiteit: 'periode', privacy: 'huis', minGroep: null, eigenaar: 'kern/rtgboek', graad: 'vermoed',
    afhankelijk: ['marge.bruto-rtg', 'kosten.maand-totaal'],
    bron: [BOEK], definitie: [c(DEF, 'operationeleMarge: dC(8, 1')],
    projectie: [c(SRB, 'const operationeel = ')], bewijs: [HALF], groepsgrens: null,
    gedeeltelijk: 'Personeel is een totaal per maand en nooit per medewerker; zonder volledig boek staat er geen getal.',
    waarom: {} },

  { id: 'liquiditeit.rtg', domein: 'liquiditeit', wereld: 'rtg-intern', eenheid: 'eurocent',
    betekenis: 'Het vrije banksaldo tegenover wat RTG zelf op korte termijn moet betalen; het tegoed van leden staat ernaast.',
    berekening: 'vrij banksaldo van de maand min de korte verplichtingen uit het boek; het ledentegoed los',
    actualiteit: 'periode', privacy: 'huis', minGroep: null, eigenaar: 'kern/rtgboek', graad: 'vermoed',
    afhankelijk: ['cash.rtg-bankpositie'],
    bron: [BOEK, c('server/kern/pay/kijken.js', 'function ledentegoed()')], definitie: [c(DEF, 'liquiditeit: dC(10, 1')],
    projectie: [c(SRB, 'const liquiditeit = ')], bewijs: [HALF], groepsgrens: null,
    gedeeltelijk: 'Het ledentegoed is de stand van nu, niet van het eind van de maand.',
    waarom: {} },

  { id: 'runway.rtg', domein: 'runway', wereld: 'rtg-intern', eenheid: 'maanden',
    betekenis: 'Hoe lang RTG met het vrije banksaldo doorkan, bruto (zonder omzet) en netto (met omzet) naast elkaar.',
    berekening: 'vrij banksaldo gedeeld door het gemiddelde verbruik over drie afgesloten maanden, bruto en netto',
    actualiteit: 'periode', privacy: 'huis', minGroep: null, eigenaar: 'kern/rtgboek', graad: 'vermoed',
    afhankelijk: ['cash.rtg-bankpositie', 'marge.operationeel-rtg'],
    bron: 'afgeleid', definitie: [c(DEF, 'runway: dC(9, 1')],
    projectie: [c(SRB, 'const runway = ')], bewijs: [c(SRB, "waarom: 'Geen netto verbruik")], groepsgrens: null,
    waarom: {} },

  { id: 'cac.per-kanaal', domein: 'cac', wereld: 'rtg-intern', eenheid: 'eurocent per nieuw lid',
    betekenis: 'Wat het kost om via een kanaal een lid te werven.',
    berekening: 'marketinguitgave per kanaal uit het boek gedeeld door de nieuwe leden die dat kanaal opgaven',
    actualiteit: 'periode', privacy: 'huis', minGroep: null, eigenaar: 'kern/rtgboek', graad: 'vermoed',
    afhankelijk: ['acquisitie.kanaal', 'campagnes.rtg-marketing'],
    bron: 'afgeleid', definitie: [c(DEF, 'cac: dC(11, 1')],
    projectie: [c(SRB, 'const perKanaal = ')], bewijs: [c(SRB, "stand: 'TE_KLEINE_GROEP'")],
    groepsgrens: [c(SRB, "g.stand !== 'TOONBAAR'")],
    gedeeltelijk: 'Alleen leden die een kanaal opgaven; wie de vraag oversloeg en zonder campagnelink kwam, telt nergens.',
    waarom: {} },

  { id: 'campagnes.rtg-marketing', domein: 'campagnes', wereld: 'rtg-intern', eenheid: 'eurocent per nieuw lid, per campagne',
    betekenis: 'De campagnes van RTG zelf: wat ze kostten en hoeveel nieuwe leden er met hun code binnenkwamen.',
    berekening: 'de uitgave per campagne uit het boek gedeeld door de nieuwe leden met haar code in dezelfde maand',
    actualiteit: 'periode', privacy: 'huis', minGroep: null, eigenaar: 'kern/rtgcampagne', graad: 'vermoed', afhankelijk: [],
    bron: [c('server/kern/rtgcampagne.js', 'function maak('), c('server/kern/rtgboek.js', 'function zetCampagne(')],
    definitie: [c('server/kern/bedrijfsmaat/definities-later.js', 'campagne: d28(12, 1')],
    projectie: [c(SRB, 'const perCampagne = ')], bewijs: [c('server/kern/rtgboek.js', "reden: p.centen == null ? 'De campagnes zijn geboekt")],
    groepsgrens: [c(SRB, "g.stand !== 'TOONBAAR' || !g.aantal) return Object.assign(basis")],
    gedeeltelijk: 'Alleen wie met de campagnelink binnenkwam: geen klikken, geen bereik en geen attributie, dus een ondergrens.',
    waarom: {} }
];
