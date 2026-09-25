/* Bedrijfsmaten, deel PRODUCT: succesvolle uitkomst, productgebruik, support,
   productkwaliteit, performance. Vorm en regels staan in ./index.js. */
'use strict';
const c = (bestand, citaat) => ({ bestand, citaat });
const SVC = 'server/kern/service/', SLO = 'server/kern/command/slo.js';

module.exports = [
  { id: 'uitkomst.service-zonder-herhaling', domein: 'uitkomst', wereld: 'consument', eenheid: 'aandeel opgeloste zaken',
    betekenis: 'Hoeveel problemen zijn opgelost zonder dat de melder zijn verhaal opnieuw hoefde te doen.',
    berekening: 'opgeloste zaken zonder door de structuur afgedwongen herhaling, gedeeld door opgeloste zaken met een menselijke overdracht',
    actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: 'kern/service', graad: 'gemeten', afhankelijk: ['support.klokken'],
    bron: [c(SVC + 'loop.js', 'function noteer')], definitie: [c(SVC + 'kwaliteit.js', 'DE MAAT DIE HIER TELT')],
    projectie: [c(SVC + 'kwaliteit.js', 'function meting')], bewijs: [c(SVC + 'kwaliteit.js', 'nietTeZeggen: true')],
    groepsgrens: [c(SVC + 'kwaliteit.js', 'const MINIMUM = 10')], waarom: {} },

  { id: 'uitkomst.rit-afgerond', domein: 'uitkomst', wereld: 'consument', eenheid: 'ritten per periode',
    betekenis: 'Ritten die de keten tot het einde liepen.', berekening: 'nog niet vastgesteld',
    actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: null, graad: 'onbekend', afhankelijk: [],
    bron: [c('server/kern/kantoor/metrics.js', 'r.finishedAt')], definitie: [c('server/kern/vervoer.js', 'const RIT_KETEN')],
    projectie: null, bewijs: null, groepsgrens: null,
    waarom: { projectie: 'De prestatielijst telt ritten per zaak en een gemiddelde duur, geen afgeronde ritten per periode.',
      bewijs: 'Volgt uit de projectie.', groepsgrens: 'Volgt uit de projectie.', eigenaar: 'Niemand.' } },

  { id: 'uitkomst.klantwaarde', domein: 'uitkomst', wereld: 'consument', eenheid: 'aandeel geslaagde bedoelingen',
    betekenis: 'Klantwaarde als geslaagde uitkomst over de werelden heen, niet als aandacht of engagement.',
    berekening: 'nog niet vastgesteld', actualiteit: 'onbekend', privacy: 'leden', minGroep: 10, eigenaar: null, graad: 'onbekend',
    afhankelijk: ['uitkomst.service-zonder-herhaling', 'uitkomst.rit-afgerond'],
    bron: 'afgeleid', definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { definitie: 'Wat een geslaagde uitkomst is, verschilt per wereld en is per wereld niet besloten. Een samengesteld cijfer erover is met opzet niet de bedoeling (INT-04); het blijven naast elkaar staande maten.',
      projectie: 'Niet gebouwd.', bewijs: 'Volgt uit de projectie.', groepsgrens: 'Volgt uit de projectie.', eigenaar: 'Niemand.' } },

  { id: 'gebruik.ai', domein: 'gebruik', wereld: 'rtg-intern', eenheid: 'aanroepen en tokens per dag, lokaal en extern apart',
    betekenis: 'Hoeveel het huis de modellen gebruikt, met lokaal en extern gescheiden.',
    berekening: 'teller per dag in de AI-meter; lokaal verbruik buiten tarief en grens', actualiteit: 'live', privacy: 'huis',
    minGroep: null, eigenaar: 'server/ai-meter', graad: 'gemeten', afhankelijk: [],
    bron: [c('server/ai-meter.js', 'function boek(')], definitie: [c('server/kern/kosten/soorten.js', "id: 'ai-invoer'")],
    projectie: [c('server/ai-meter.js', 'function stand')], bewijs: [c('server/ai-meter.js', 'function boekLokaal')], groepsgrens: null, waarom: {} },

  { id: 'gebruik.verzoeken-per-drager', domein: 'gebruik', wereld: 'consument', eenheid: 'verzoeken per drager per maand',
    betekenis: 'Hoe intensief een lid, zaak of gezin het platform gebruikt, gemeten als serververzoeken.',
    berekening: 'teller per drager in de kostenmeter', actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: 'kern/kosten',
    graad: 'gemeten', afhankelijk: [],
    bron: [c('server/kern/kosten/meter.js', 'function meet')], definitie: [c('server/kern/kosten/soorten.js', "id: 'verzoek'")],
    projectie: [c('server/kern/kosten/meter.js', 'function dragers')], bewijs: [c('server/kern/kosten/soorten.js', "meetweg: 'gemeten'")], groepsgrens: null,
    waarom: { groepsgrens: 'Per drager en voor de factuur; een optelling per pas of cohort met een groepsgrens bestaat niet.' } },

  { id: 'gebruik.per-functie', domein: 'gebruik', wereld: 'consument', eenheid: 'gebruikers per functie per periode',
    betekenis: 'Welke functies werkelijk worden gebruikt.', berekening: 'nog niet vastgesteld',
    actualiteit: 'onbekend', privacy: 'leden', minGroep: 10, eigenaar: null, graad: 'onbekend', afhankelijk: [],
    bron: null, definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { bron: 'Er is geen runtime-telling per functie. De kostenmeter telt verzoeken per drager, niet per functie; de routedekking bestaat alleen onder de toetsen.',
      definitie: 'Volgt pas als er een bron is.', projectie: 'Idem.', bewijs: 'Idem.', groepsgrens: 'Idem.', eigenaar: 'Niemand.' } },

  { id: 'support.klokken', domein: 'support', wereld: 'consument', eenheid: 'minuten per zaak, vier klokken',
    betekenis: 'Reactie-, doorloop- en hersteltijd van een servicezaak, met de tijd dat op de melder werd gewacht eraf.',
    berekening: 'vier klokken uit de zaak-tijdlijn; wacht-op-melder wordt afgetrokken', actualiteit: 'live', privacy: 'leden',
    minGroep: 10, eigenaar: 'kern/service', graad: 'gemeten', afhankelijk: [],
    bron: [c(SVC + 'loop.js', 'function noteer')], definitie: [c(SVC + 'klok.js', 'DE VIER KLOKKEN VAN EEN SERVICEZAAK')],
    projectie: [c(SVC + 'klok.js', 'function klokken')], bewijs: [c(SVC + 'kwaliteit.js', 'nietTeZeggen: true')],
    groepsgrens: [c(SVC + 'kwaliteit.js', 'const MINIMUM = 10')], waarom: {} },

  { id: 'kwaliteit.foutsignalen', domein: 'kwaliteit', wereld: 'rtg-intern', eenheid: 'signalen per vingerafdruk',
    betekenis: 'Fouten die schermen melden, gebundeld op vingerafdruk.', berekening: 'telling per afdruk en per scherm',
    actualiteit: 'live', privacy: 'huis', minGroep: null, eigenaar: 'kern/service', graad: 'gemeten', afhankelijk: [],
    bron: [c(SVC + 'foutsignaal.js', 'function meld')], definitie: [c(SVC + 'foutsignaal.js', 'function afdruk')],
    projectie: [c(SVC + 'foutsignaal.js', 'function lijst')], bewijs: [c(SVC + 'foutsignaal.js', 'gebruikersWaarom')], groepsgrens: null, waarom: {} },

  { id: 'kwaliteit.incidenten', domein: 'kwaliteit', wereld: 'rtg-intern', eenheid: 'incidenten met impact',
    betekenis: 'Storingen als object met een nummer, een impact en een verloop.', berekening: 'incidentkaart met gewogen impact',
    actualiteit: 'live', privacy: 'huis', minGroep: null, eigenaar: 'kern/command', graad: 'gemeten', afhankelijk: [],
    bron: [c('server/kern/command/incident.js', 'function maak')], definitie: [c('server/kern/command/incident.js', 'HET INCIDENT ALS OBJECT')],
    projectie: [c('server/kern/command/incident.js', 'function kaart')], bewijs: [c('server/kern/command/incident-impact.js', 'NIET_TE_METEN')], groepsgrens: null, waarom: {} },

  { id: 'kwaliteit.functie-bestaat', domein: 'kwaliteit', wereld: 'rtg-intern', eenheid: 'beloften per bewijsstand',
    betekenis: 'Of een belofte uit de werelden aantoonbaar werkt voor de persona die haar ziet (BETROUWBAARHEID.md).',
    berekening: 'per onderdeel de strengste van de gemeten bewijzen', actualiteit: 'bij-meting', privacy: 'huis', minGroep: null,
    eigenaar: 'scripts/appwerkt', graad: 'gemeten', afhankelijk: [],
    bron: [c('APPWERKT.json', '"perBewijs"')], definitie: [c('BETROUWBAARHEID.md', 'Een functie bestaat pas als')],
    projectie: [c('APPWERKT.json', '"telling"')], bewijs: [c('APPWERKT.json', '"stempel"')], groepsgrens: null, waarom: {} },

  { id: 'performance.beschikbaarheid', domein: 'performance', wereld: 'rtg-intern', eenheid: 'aandeel verzoeken zonder 5xx',
    betekenis: 'Beschikbaarheid tegen het servicedoel, met foutbudget.', berekening: 'aandeel verzoeken zonder 5xx over dertig dagen',
    actualiteit: 'live', privacy: 'huis', minGroep: null, eigenaar: 'kern/command', graad: 'gemeten', afhankelijk: [],
    bron: [c(SLO, 'function maakSlo')], definitie: [c('SLO.json', 'aandeel verzoeken zonder 5xx')],
    projectie: [c(SLO, 'function doelStand')], bewijs: [c('SLO.json', '"minimumVerzoeken"')], groepsgrens: null, waarom: {} },

  { id: 'performance.snelheid', domein: 'performance', wereld: 'rtg-intern', eenheid: 'seconden, p90 en p99',
    betekenis: 'Hoe snel leesendpoints antwoorden, tegen het servicedoel.', berekening: 'kwantielen van rtg_duur_seconden',
    actualiteit: 'live', privacy: 'huis', minGroep: null, eigenaar: 'kern/command', graad: 'gemeten', afhankelijk: [],
    bron: [c(SLO, 'function kwantielGrens')], definitie: [c('SLO.json', 'p90 van rtg_duur_seconden')],
    projectie: [c(SLO, 'function doelStand')], bewijs: [c('SLO.json', '"minimumDekking"')], groepsgrens: null, waarom: {} }
];
