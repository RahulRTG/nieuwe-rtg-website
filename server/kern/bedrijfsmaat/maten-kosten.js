/* Bedrijfsmaten, deel KOSTEN: kosten, marge, cash, liquiditeit en runway. Vorm en regels staan in ./index.js; dit bestand is alleen gegevens.
   Elk citaat moet letterlijk in zijn bestand staan -- scripts/bedrijfsmaat.js
   controleert dat, en een citaat dat er niet staat telt als niet bestaand. */
'use strict';
const c = (bestand, citaat) => ({ bestand, citaat });
const KOS = 'server/kern/kosten/';

module.exports = [
  { id: 'marge.bruto-rtg', domein: 'marge', wereld: 'rtg-intern', eenheid: 'euro per maand',
    betekenis: 'Ontvangen omzet min de directe kosten van het platform.',
    berekening: 'nog niet vastgesteld', actualiteit: 'periode', privacy: 'huis', minGroep: null, eigenaar: null, graad: 'onbekend',
    afhankelijk: ['omzet.leden-ontvangen', 'kosten.maand-totaal'],
    bron: 'afgeleid', definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { definitie: 'Welke kosten direct zijn (AI, verzoeken, berichten) en welke niet (stroom, huur) is voor de marge niet besloten.',
      projectie: 'Geen functie zet omzet en kosten naast elkaar.', bewijs: 'Volgt uit de projectie.', eigenaar: 'Niemand.' } },

  { id: 'marge.operationeel-rtg', domein: 'marge', wereld: 'rtg-intern', eenheid: 'euro per maand',
    betekenis: 'Brutomarge min de vaste kosten van de organisatie (mensen, huisvesting, diensten).',
    berekening: 'nog niet vastgesteld', actualiteit: 'periode', privacy: 'huis', minGroep: null, eigenaar: null, graad: 'onbekend',
    afhankelijk: ['marge.bruto-rtg', 'personeel.rtg-op-naam'],
    bron: null, definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { bron: 'De vaste kosten van RTG als organisatie (salarissen van het eigen kantoor, huur, abonnementen) worden nergens geregistreerd; de kostenlaag kent alleen platformkosten.',
      definitie: 'Niet besloten.', projectie: 'Niet gebouwd.', bewijs: 'Volgt uit de projectie.', eigenaar: 'Niemand.' } },

  { id: 'marge.per-lid', domein: 'marge', wereld: 'consument', eenheid: 'euro per lid per maand',
    betekenis: 'Unit economics: wat een lid bijdraagt min wat hij kost, opgeteld per pas of cohort en nooit per mens.',
    berekening: 'nog niet vastgesteld', actualiteit: 'periode', privacy: 'leden', minGroep: 10, eigenaar: null, graad: 'onbekend',
    afhankelijk: ['omzet.leden-maand', 'kosten.per-drager'],
    bron: 'afgeleid', definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { definitie: 'Kosten per drager bestaan, opbrengst per drager niet; welke van de twee de noemer is (pas, cohort) is niet besloten.',
      projectie: 'Niet gebouwd.', bewijs: 'Volgt uit de projectie.', groepsgrens: 'Er is nog geen projectie om hem in af te dwingen.', eigenaar: 'Niemand.' } },

  { id: 'kosten.per-drager', domein: 'kosten', wereld: 'rtg-intern', eenheid: 'euro per drager per maand',
    betekenis: 'Wat een lid, zaak of gezin het huis deze maand kostte, per kostensoort, met de graad per regel.',
    berekening: 'tellers per soort x tarief; toegerekende soorten uit de nota met een verdeelsleutel',
    actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: 'kern/kosten', graad: 'vermoed', afhankelijk: [],
    bron: [c(KOS + 'meter.js', 'function meet')], definitie: [c(KOS + 'soorten.js', 'WELKE KOSTEN BESTAAN ER')],
    projectie: [c(KOS + 'overzicht.js', 'function alleDragers')], bewijs: [c(KOS + 'overzicht.js', "graad: 'onbekend'")], groepsgrens: null,
    waarom: { groepsgrens: 'De boardroom ziet de lijst per drager; een totaal per pas of cohort met een groepsgrens bestaat niet. Voor een lens die optelt moet de poort ervoor.' } },

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

  { id: 'cash.rtg-bankpositie', domein: 'cash', wereld: 'rtg-intern', eenheid: 'euro',
    betekenis: 'Het saldo op de rekeningen van RTG zelf.', berekening: 'nog niet vastgesteld',
    actualiteit: 'onbekend', privacy: 'huis', minGroep: null, eigenaar: null, graad: 'onbekend', afhankelijk: [],
    bron: null, definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { bron: 'RTG registreert zijn eigen banksaldo nergens. kern/bankregie en kern/pay gaan over het geld van leden en zaken; de kasvooruitblik (kern/onderneming/kas.js) is een instrument voor een ondernemer, niet voor RTG.',
      definitie: 'Volgt pas als er een bron is.', projectie: 'Idem.', bewijs: 'Idem.', eigenaar: 'Niemand.' } },

  { id: 'liquiditeit.rtg', domein: 'liquiditeit', wereld: 'rtg-intern', eenheid: 'euro',
    betekenis: 'Beschikbaar geld tegenover wat RTG op korte termijn moet betalen, inclusief het tegoed dat leden bij RTG hebben staan.',
    berekening: 'nog niet vastgesteld', actualiteit: 'onbekend', privacy: 'huis', minGroep: null, eigenaar: null, graad: 'onbekend',
    afhankelijk: ['cash.rtg-bankpositie'],
    bron: null, definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { bron: 'Er is geen register van de korte verplichtingen van RTG zelf, en geen kaspositie om ze tegenover te zetten.',
      definitie: 'Niet besloten.', projectie: 'Niet gebouwd.', bewijs: 'Volgt uit de projectie.', eigenaar: 'Niemand.' } },

  { id: 'runway.rtg', domein: 'runway', wereld: 'rtg-intern', eenheid: 'maanden',
    betekenis: 'Hoe lang RTG met de huidige kaspositie en het huidige netto verbruik doorkan.',
    berekening: 'nog niet vastgesteld', actualiteit: 'onbekend', privacy: 'huis', minGroep: null, eigenaar: null, graad: 'onbekend',
    afhankelijk: ['cash.rtg-bankpositie', 'marge.operationeel-rtg'],
    bron: 'afgeleid', definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { definitie: 'Niet besloten (netto of bruto verbruik, welke horizon).',
      projectie: 'De rekenvorm bestaat voor een ondernemer in kern/onderneming/kas.js; voor RTG zelf niet.', bewijs: 'Volgt uit de projectie.', eigenaar: 'Niemand.' } }
];
