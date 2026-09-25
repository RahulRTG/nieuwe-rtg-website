/* Bedrijfsmaten, deel OPERATIE: capaciteit, personeel en leveranciers. Vorm en regels staan in ./index.js. */
'use strict';
const c = (bestand, citaat) => ({ bestand, citaat });
const KOS = 'server/kern/kosten/';

module.exports = [
  { id: 'capaciteit.partners', domein: 'capaciteit', wereld: 'commercieel', eenheid: 'per domein verschillend',
    betekenis: 'Bezetting en ruimte bij partnerzaken: tafels, kamers, ritten, terreinen.', berekening: 'nog niet vastgesteld',
    actualiteit: 'live', privacy: 'zaken', minGroep: 5, eigenaar: null, graad: 'onbekend', afhankelijk: [],
    bron: [c('server/kern/festival/bezetting.js', 'function bezetting')], definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { definitie: 'Elk domein meet zijn eigen bezetting; een gedeelde betekenis over domeinen heen is gemeten afwezig (PLANNING.md: 0 van 269 velden in alle plandomeinen). Een RTG-breed getal hoort er dus niet te komen, wel een lens per domein.',
      projectie: 'Niet gebouwd.', bewijs: 'Volgt uit de projectie.', groepsgrens: 'Volgt uit de projectie.', eigenaar: 'Niemand.' } },

  { id: 'capaciteit.service', domein: 'capaciteit', wereld: 'rtg-intern', eenheid: 'open zaken per team',
    betekenis: 'Hoeveel werk er bij de serviceteams ligt.', berekening: 'nog niet vastgesteld',
    actualiteit: 'live', privacy: 'personeel', minGroep: 10, eigenaar: null, graad: 'onbekend', afhankelijk: ['support.klokken'],
    bron: [c('server/kern/service/teams.js', 'const TEAMS = {')], definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { definitie: 'Niet besloten; en per team met een of twee mensen is werklast een getal over een mens (KANTOORMACHT.md).',
      projectie: 'Niet gebouwd.', bewijs: 'Volgt uit de projectie.', groepsgrens: 'Volgt uit de projectie.', eigenaar: 'Niemand.' } },

  { id: 'personeel.rtg-op-naam', domein: 'personeel', wereld: 'rtg-intern', eenheid: 'medewerkers',
    betekenis: 'Hoeveel mensen er op naam voor het kantoor van RTG werken.', berekening: 'nog niet vastgesteld',
    actualiteit: 'live', privacy: 'personeel', minGroep: 10, eigenaar: null, graad: 'onbekend', afhankelijk: [],
    bron: [c('server/kern/kantoor/uitnodiging.js', 'function verzilver')], definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { definitie: 'Een kantoorrol op een account is geen dienstverband; het dienstverband bij RTG zelf staat niet in kern/concern/employment.js.',
      projectie: 'Niet gebouwd; de mensdeur telt verzoeken met en zonder naam, geen mensen.', bewijs: 'Volgt uit de projectie.',
      groepsgrens: 'Met drie mensen op kantoor valt elk getal onder de grens; dat is juist.', eigenaar: 'Niemand.' } },

  { id: 'personeel.rtg-werkdruk', domein: 'personeel', wereld: 'rtg-intern', eenheid: 'uren per team per week',
    betekenis: 'Werkdruk van het eigen kantoor, op teamniveau en nooit per mens.', berekening: 'nog niet vastgesteld',
    actualiteit: 'onbekend', privacy: 'personeel', minGroep: 10, eigenaar: null, graad: 'onbekend', afhankelijk: ['personeel.rtg-op-naam'],
    bron: null, definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { bron: 'De urenklok (kern/personeel.js) staat per zaakcode en is voor partnerpersoneel; het eigen kantoor van RTG klokt nergens.',
      definitie: 'Volgt pas als er een bron is.', projectie: 'Idem.', bewijs: 'Idem.', groepsgrens: 'Idem.', eigenaar: 'Niemand.' } },

  { id: 'leveranciers.providers', domein: 'leveranciers', wereld: 'rtg-intern', eenheid: 'euro per leverancier per maand',
    betekenis: 'Wat RTG aan zijn eigen leveranciers (hosting, modellen, berichten) betaalt, uit hun facturen.',
    berekening: 'leveranciersfacturen per periode', actualiteit: 'periode', privacy: 'huis', minGroep: null, eigenaar: 'kern/kosten',
    graad: 'gemeten', afhankelijk: [],
    bron: [c(KOS + 'providerfactuur.js', 'function factuurZet')], definitie: [c(KOS + 'providerfactuur.js', 'function bronVan')],
    projectie: [c('server/routes/kosten-kantoor.js', '/api/office/kosten/leveranciersfacturen')], bewijs: [c(KOS + 'herkomst.js', 'function herkomst')], groepsgrens: null, waarom: {} },

  { id: 'leveranciers.partners-toelating', domein: 'leveranciers', wereld: 'commercieel', eenheid: 'aanvragen per stand',
    betekenis: 'Zaken die zich aanmelden en waar ze staan in de toelating.', berekening: 'nog niet vastgesteld',
    actualiteit: 'live', privacy: 'zaken', minGroep: 5, eigenaar: null, graad: 'onbekend', afhankelijk: [],
    bron: [c('server/kern/aanmeldingen/bewijs.js', 'function bewijsIndien')], definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { definitie: 'De keten is beproefd (npm run toelatingsproef), maar een doorlooptijd of wachtrij als bedrijfsmaat is niet besloten.',
      projectie: 'Niet gebouwd.', bewijs: 'Volgt uit de projectie.', groepsgrens: 'Volgt uit de projectie.', eigenaar: 'Niemand.' } }
];
