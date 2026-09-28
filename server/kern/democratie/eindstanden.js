/* ============================================================================
   DE STANDEN VAN EEN KWESTIE -- een gesloten vocabulaire (POLITIEK.md par. 4).

   WAAROM GESLOTEN. Een vrije stand of een "anders" is de plek waar een kwestie
   later alsnog wordt weggeboekt: niet te vergelijken, niet te doorzoeken, en
   niet te onderscheiden van een kwestie waar niemand naar keek. Dezelfde reden
   als de REDENEN in kern/livinglab/vraagbesluit.js -- een afgewezen vraag die
   verdwijnt, is niet te onderscheiden van een vraag die nooit is gesteld.

   Er is dus geen `anders`, en `EINDSTAND_VAN` weigert alles wat hier niet
   staat. Een nieuwe eindstand is een grondwetswijziging (DO-02), geen commit
   die een lijst uitbreidt.

   `samen-opgelost` IS EEN VOLWAARDIGE EINDSTAND en geen restcategorie: sommige
   kwesties eindigen nooit bij een politicus, omdat mensen ze samen oplosten
   (POLITIEK.md par. 6). */
'use strict';

/* Waar een behandelronde kan staan zolang hij niet is afgesloten. */
const LOPEND = ['ingebracht', 'in-behandeling', 'wacht-op-bevoegde'];

/* Wat een mens bij het afsluiten MOET meegeven, naast de toelichting. */
const EINDSTANDEN = [
  { stand: 'uitgevoerd', naam: 'Uitgevoerd',
    uitleg: 'Er is gedaan wat besloten is.', eist: [] },
  { stand: 'samen-opgelost', naam: 'Samen opgelost',
    uitleg: 'Mensen hebben het samen opgelost; er kwam geen politicus aan te pas.', eist: [] },
  { stand: 'afgewezen', naam: 'Afgewezen',
    uitleg: 'Een bevoegde heeft nee gezegd. Wie, met welke bevoegdheid, en waarom, staat erbij.',
    eist: ['bevoegdheid'] },
  { stand: 'samengevoegd', naam: 'Samengevoegd',
    uitleg: 'Gaat verder in een andere kwestie; wie hem inbracht, volgt die mee.', eist: ['in'] },
  { stand: 'doorgestuurd', naam: 'Doorgestuurd',
    uitleg: 'Hier is niemand bevoegd. Naar wie hij ging, staat erbij.', eist: ['naar'] },
  { stand: 'onhaalbaar', naam: 'Onhaalbaar',
    uitleg: 'Het kan niet, en de reden staat erbij.', eist: [] },
  { stand: 'ingetrokken', naam: 'Ingetrokken',
    uitleg: 'Wie hem inbracht, stopt er zelf mee.', eist: [], alleenInbrenger: true }
];

const EINDSTAND_VAN = new Map(EINDSTANDEN.map(e => [e.stand, e]));

/* Hoe ver de terugkoppeling aan een ontvanger is. Drie treden, en ze betekenen
   precies dit:
     klaargezet  de uitkomst staat vast en is voor de ontvanger te LEZEN via zijn
                 eigen lijst -- dat is het bewezen leespad, en het bestaat vanaf
                 het moment dat de eindstand vastligt;
     gewekt      er is bovendien een melding in zijn berichten gezet. Dat is een
                 WEK en geen bewijs: berichten zijn begrensd en een lid kan ze
                 dempen (opzet/meldaan.js);
     gezien      hij heeft de uitkomst zelf geopend. */
const TERUGKOPPELING = ['klaargezet', 'gewekt', 'gezien'];

module.exports = { LOPEND, EINDSTANDEN, EINDSTAND_VAN, TERUGKOPPELING };
