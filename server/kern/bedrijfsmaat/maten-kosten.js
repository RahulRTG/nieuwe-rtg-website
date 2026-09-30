/* Bedrijfsmaten, deel KOSTEN: kosten, marge, cash, liquiditeit en runway. Vorm en regels staan in ./index.js; dit bestand is alleen gegevens.
   Elk citaat moet letterlijk in zijn bestand staan -- scripts/bedrijfsmaat.js
   controleert dat, en een citaat dat er niet staat telt als niet bestaand. */
'use strict';
const c = (bestand, citaat) => ({ bestand, citaat });
const KOS = 'server/kern/kosten/';
const PRJ = 'server/kern/bedrijfsmaat/projecties.js', STAND = 'server/kern/bedrijfsmaat/stand.js';
const MRG = 'server/kern/bedrijfsmaat/stand-marge.js';

module.exports = [
  { id: 'marge.bruto-rtg', domein: 'marge', wereld: 'rtg-intern', eenheid: 'eurocent per maand, zonder btw',
    betekenis: 'Ontvangen omzet min de directe kosten van het platform.',
    berekening: 'omzet.leden-ontvangen min de som van de gerekende GEMETEN kostensoorten van de maand (kern/kosten afstemming); verbruik zonder tarief maakt de marge niet uit te rekenen',
    actualiteit: 'periode', privacy: 'huis', minGroep: null, eigenaar: 'kern/bedrijfsmaat', graad: 'gemeten',
    afhankelijk: ['omzet.leden-ontvangen', 'kosten.maand-totaal'],
    bron: 'afgeleid', definitie: [c('server/kern/bedrijfsmaat/definities.js', 'brutomarge: d(1')],
    projectie: [c(PRJ, 'function brutomarge')], bewijs: [c(PRJ, 'if (zonderTarief.length) return { margeCenten: null'), c(STAND, "stand: 'NIET_UIT_TE_REKENEN'")],
    groepsgrens: null,
    gedeeltelijk: 'De ontvangen omzet eronder ziet alleen de betaalschema\'s van aanmeldingen en niet de ledenfacturen in de kluis; zolang dat zo is, zegt deze marge iets over de vorm en weinig over het bedrag.',
    waarom: {} },

  { id: 'marge.per-lid', domein: 'marge', wereld: 'consument', eenheid: 'eurocent per lid per maand',
    betekenis: 'Unit economics: wat een lid bijdraagt min wat hij kost, per pas en nooit per mens (besluit C15).',
    berekening: 'per pas: afgesproken maandbijdrage min de kosten van de leden van die pas, gedeeld door alle leden van die pas',
    actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: 'kern/bedrijfsmaat', graad: 'vermoed',
    afhankelijk: ['omzet.leden-maand', 'kosten.per-drager'],
    bron: 'afgeleid', definitie: [c('server/kern/bedrijfsmaat/definities-later.js', 'margePerLid: d29(15')],
    projectie: [c(MRG, 'function margePerPas()'), c('server/kern/ledenregister.js', 'function omzetPerPas')],
    bewijs: [c(MRG, "niet('Er zijn leden op deze pas zonder lopend contract"), c(MRG, "niet('Verbruik zonder tarief")],
    groepsgrens: [c(MRG, '{ grens, benoemd: true }')],
    gedeeltelijk: 'Alleen de lopende maand: de bijdrage per pas is een stand van vandaag en wordt niet per maand bewaard. De Business Pass rekent alleen mee als elk lid een lopend contract heeft.',
    waarom: {} },

  { id: 'kosten.per-drager', domein: 'kosten', wereld: 'rtg-intern', eenheid: 'euro per drager per maand',
    betekenis: 'Wat een lid, zaak of gezin het huis deze maand kostte, per kostensoort, met de graad per regel.',
    berekening: 'tellers per soort x tarief; toegerekende soorten uit de nota met een verdeelsleutel',
    actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: 'kern/kosten', graad: 'vermoed', afhankelijk: [],
    bron: [c(KOS + 'meter.js', 'function meet')], definitie: [c(KOS + 'soorten.js', 'WELKE KOSTEN BESTAAN ER')],
    projectie: [c(KOS + 'overzicht.js', 'function alleDragers')], bewijs: [c(KOS + 'overzicht.js', "graad: 'onbekend'")],
    groepsgrens: [c('test/stuur-kantoor.test.js', "const TONEN = ['/api/command/puls'")],
    gedeeltelijk: 'Een werklijst per drager voor een mens op naam in de boardroom (besluit 25 september 2026: mens ja, machine nee). Een totaal per pas of cohort met de groepsgrens bestaat nog niet.',
    waarom: {} },

  { id: 'kosten.maand-totaal', domein: 'kosten', wereld: 'rtg-intern', eenheid: 'euro per maand',
    betekenis: 'De kosten van een afgesloten maand; een maand gaat pas dicht als elk verschil een verklaring draagt.',
    berekening: 'periodestand uit meter en nota, met verschillen en verklaringen',
    actualiteit: 'periode', privacy: 'huis', minGroep: null, eigenaar: 'kern/kosten', graad: 'gemeten', afhankelijk: ['kosten.per-drager'],
    bron: [c(KOS + 'meter.js', 'function kijkPeriode')], definitie: [c(KOS + 'periode.js', 'function verschillen')],
    projectie: [c(KOS + 'periode.js', 'function stand')], bewijs: [c(KOS + 'periode.js', 'function verklaar')], groepsgrens: null, waarom: {} },

  { id: 'kosten.vooruitblik', domein: 'kosten', wereld: 'rtg-intern', eenheid: 'euro per maand',
    betekenis: 'Waar de lopende maand uitkomt, met een band die pas verschijnt als de trefzekerheid over afgesloten maanden gemeten is.',
    berekening: 'projectie op het lopende verbruik; trefzekerheid uit vastgelegde voorspellingen tegen de werkelijkheid',
    actualiteit: 'live', privacy: 'huis', minGroep: null, eigenaar: 'kern/kosten', graad: 'vermoed', afhankelijk: ['kosten.maand-totaal'],
    bron: [c(KOS + 'meter.js', 'function kijkPeriode')], definitie: [c(KOS + 'vooruitblik.js', 'WAT WORDT HET DEZE MAAND?')],
    projectie: [c(KOS + 'vooruitblik.js', 'function projectie')], bewijs: [c(KOS + 'vooruitblik.js', 'function trefzekerheid')], groepsgrens: null, waarom: {} },

  { id: 'kosten.herkomst', domein: 'kosten', wereld: 'rtg-intern', eenheid: 'keten tot de leveranciersfactuur',
    betekenis: 'Waar een kostenregel vandaan komt, tot de factuur van de leverancier of tot de mens die hem overnam.',
    berekening: 'herkomstketen per regel', actualiteit: 'periode', privacy: 'huis', minGroep: null, eigenaar: 'kern/kosten',
    graad: 'gemeten', afhankelijk: ['kosten.maand-totaal'],
    bron: [c(KOS + 'providerfactuur.js', 'function factuurZet')], definitie: [c(KOS + 'herkomst.js', 'function herkomst')],
    projectie: [c(KOS + 'herkomst.js', 'function herkomst')], bewijs: [c(KOS + 'providerfactuur.js', 'function bronVan')], groepsgrens: null, waarom: {} },

  { id: 'cash.rtg-bankpositie', domein: 'cash', wereld: 'rtg-intern', eenheid: 'eurocent',
    betekenis: 'Het saldo op de rekeningen van RTG zelf, met het geld van verkochte RTG-bonnen als verplichting ernaast.',
    berekening: 'het saldo van de maand uit kern/bankpositie.js, overgetikt van een afschrift; vrij = saldo min bonnenverplichting',
    actualiteit: 'periode', privacy: 'huis', minGroep: null, eigenaar: 'kern/bankpositie', graad: 'vermoed', afhankelijk: [],
    bron: [c('server/kern/bankpositie.js', 'function zet(')], definitie: [c('server/kern/bedrijfsmaat/definities.js', 'CASH is het saldo')],
    projectie: [c('server/kern/bankpositie.js', 'function stand(')], bewijs: [c('server/kern/bankpositie.js', "graad: 'vermoed', bonnenVerplichting")],
    groepsgrens: null,
    gedeeltelijk: 'Handmatig: een mens tikt het saldo over van een afschrift. Een bankkoppeling is een eigen besluit (C4).',
    waarom: {} }
];
