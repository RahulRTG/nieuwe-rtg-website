/* Bedrijfsmaten, deel MARKT: campagnes, commerciele groei en geografische groei.
   Vorm en regels staan in ./index.js; dit bestand is alleen gegevens. */
'use strict';
const c = (bestand, citaat) => ({ bestand, citaat });
const REG = 'server/kern/ledenregister.js', DOS = 'server/accounts/dossier.js';

module.exports = [
  { id: 'campagnes.rtg-marketing', domein: 'campagnes', wereld: 'rtg-intern', eenheid: 'euro en bereik per campagne',
    betekenis: 'De campagnes van RTG zelf: wat ze kostten, wie ze bereikten, wat ze opleverden.', berekening: 'nog niet vastgesteld',
    actualiteit: 'onbekend', privacy: 'huis', minGroep: null, eigenaar: null, graad: 'onbekend', afhankelijk: [],
    bron: null, definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { bron: 'Er is geen register van RTG-campagnes of marketinguitgaven, en de kostenlaag kent geen marketingsoort. Het campagnebeeld (uitgelichte Salon-posts) draagt geen uitgave en geen bereik.',
      definitie: 'Volgt pas als er een bron is (en incrementeel effect, niet klikken).', projectie: 'Idem.', bewijs: 'Idem.', eigenaar: 'Niemand.' } },

  { id: 'campagnes.rtf-werving', domein: 'campagnes', wereld: 'rtfoundation', eenheid: 'euro per campagne',
    betekenis: 'Landelijke wervingscampagnes van de RTFoundation en hoe hun opbrengst naar steden gaat.',
    berekening: 'per campagne de opgehaalde bedragen en de verdeelsleutel', actualiteit: 'live', privacy: 'huis', minGroep: null,
    eigenaar: 'kern/rtfos', graad: 'onbekend', afhankelijk: [],
    bron: [c('server/kern/rtfos/campagnes.js', 'function maak')], definitie: [c('server/kern/rtfos/campagnes.js', 'landelijk werven, lokaal besteden')],
    projectie: [c('server/kern/rtfos/campagnes.js', 'function ronde')], bewijs: null, groepsgrens: null,
    waarom: { bewijs: 'Geen graad of peilmoment in het antwoord. Blijft binnen de wereld rtfoundation (C1).' } },

  { id: 'groei.leden-per-pas', domein: 'commerciele-groei', wereld: 'consument', eenheid: 'leden per pas',
    betekenis: 'Hoeveel leden elke pas heeft.', berekening: 'telling per pas uit het ledenregister',
    actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: 'kern/ledenregister', graad: 'onbekend', afhankelijk: [],
    bron: [c(DOS, 'function ledenRegisterRijen')], definitie: [c('server/kern/pasladder.js', 'const LADDER = [')],
    projectie: [c(REG, 'perPas: PAS_VOLGORDE.map')], bewijs: null, groepsgrens: null,
    waarom: { bewijs: 'Geen graad of peilmoment; het register telt tot 20000 rijen en zegt niet of het afkapte.',
      groepsgrens: 'Een pas met drie leden toont drie; naast de telling per land en stad maakt dat mensen aanwijsbaar.' } },

  { id: 'groei.zaken-per-genre', domein: 'commerciele-groei', wereld: 'commercieel', eenheid: 'zaken per genre',
    betekenis: 'Hoeveel actieve partnerzaken er per genre zijn, en hoe dat groeit.', berekening: 'nog niet vastgesteld',
    actualiteit: 'live', privacy: 'zaken', minGroep: 5, eigenaar: null, graad: 'onbekend', afhankelijk: [],
    bron: [c('server/kern/kantoor/metrics.js', 'o.supplierCode')], definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { definitie: 'Wat een ACTIEVE zaak is (toegelaten, verkocht iets, is open) is niet besloten.',
      projectie: 'De prestatielijst telt omzet per zaakcode, geen zaken per genre.', bewijs: 'Volgt uit de projectie.', groepsgrens: 'Volgt uit de projectie.', eigenaar: 'Niemand.' } },

  { id: 'geo.leden-per-land', domein: 'geografische-groei', wereld: 'consument', eenheid: 'leden per land',
    betekenis: 'Waar de leden wonen, per land.', berekening: 'telling per land uit het ledenregister',
    actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: 'kern/ledenregister', graad: 'onbekend', afhankelijk: [],
    bron: [c(REG, 'telOp(perLand, r.land)')], definitie: null, projectie: [c(REG, 'perLand: sorteerTelling(perLand)')], bewijs: null, groepsgrens: null,
    waarom: { definitie: 'Waar het land vandaan komt (opgegeven, gecontroleerd, woon- of verblijfsland) staat niet in de maat.',
      bewijs: 'Geen graad of peilmoment.', groepsgrens: 'De telling toont elk land, ook met een lid.' } },

  { id: 'geo.leden-per-stad', domein: 'geografische-groei', wereld: 'consument', eenheid: 'leden per stad',
    betekenis: 'Waar de leden wonen, per stad.', berekening: 'telling per stad uit het intakeprofiel',
    actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: 'kern/ledenregister', graad: 'onbekend', afhankelijk: [],
    bron: [c(REG, 'telOp(perStad, stad)')], definitie: null, projectie: [c(REG, 'perStad: sorteerTelling(perStad)')], bewijs: null, groepsgrens: null,
    waarom: { definitie: 'De stad komt uit het intakeprofiel; of dat woonplaats is, staat niet vast.',
      bewijs: 'Geen graad of peilmoment.', groepsgrens: 'De telling toont elke stad, ook met een lid -- de scherpste van de drie.' } },

  { id: 'geo.rtf-steden', domein: 'geografische-groei', wereld: 'rtfoundation', eenheid: 'steden met status',
    betekenis: 'In welke steden de RTFoundation actief is, en in welke stand.', berekening: 'stedenboom met status per stad',
    actualiteit: 'live', privacy: 'huis', minGroep: null, eigenaar: 'kern/rtfos', graad: 'onbekend', afhankelijk: [],
    bron: [c('server/kern/rtfos/steden.js', 'function stadMaak')], definitie: [c('server/kern/rtfos/steden.js', "const STATUS = ['verkend'")],
    projectie: [c('server/kern/rtfos/steden.js', 'function boom')], bewijs: null, groepsgrens: null,
    waarom: { bewijs: 'Geen graad of peilmoment in het antwoord.' } }
];
