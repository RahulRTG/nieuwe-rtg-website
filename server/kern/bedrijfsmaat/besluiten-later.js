/* DE BESLUITEN VAN NA 27 SEPTEMBER 2026 onder de bedrijfsmaatlaag (C12 en verder).
   Zelfde vorm en zelfde voorbehoud als ./besluiten.js: de formulering is
   opgeschreven door Claude op aanwijzing van de eigenaar, en een mens heeft haar
   nog niet op deze woorden nagelezen. Een lijst per dag, want `besloten` is een
   datum en geen versie. */
'use strict';

const HANDHAVING = {
  C12: 'kern/rtgcampagne.js (het register), kern/rtgboek.js (de uitgave per campagne) en kern/aanmeldkanaal.js (een ' +
    'geregistreerde code telt onder haar kanaal); test/rtgcampagne.test.js.',
  C13: 'kern/beslisgeheugen.js (gronden van toen, uitkomst per maat bij het lezen, intrekken met reden, geen voorstel); ' +
    'test/beslisgeheugen.test.js.',
  C14: 'kern/cadeaubon.js (de schakelaar, standaard dicht, en de verplichting die kern/bankpositie.js leest) en ' +
    'RTG_CADEAUBON in kern/bevoegdheid/lijst-afhankelijk.js; test/cadeaubon.test.js. Verkopen, inwisselen en afrekenen ' +
    'zijn met opzet niet gebouwd: die vragen eerst een e-geldvergunning of vrijstelling.',
  C15: 'kern/bedrijfsmaat/stand-marge.js (per pas, alle leden in de noemer, groepspoort met secundaire onderdrukking) en ' +
    'omzetPerPas in kern/ledenregister.js; test/margeperlid.test.js.',
  C16: 'kern/ledenregister.js (land en stad langs de groepspoort, met de zin dat ze opgegeven zijn); test/bedrijfsmaatbewijs.test.js.',
  C17: 'kern/bedrijfsmaat/stand-groei.js (toegelaten en een verzoek door de eigen deur in de maand); test/bedrijfsmaatgroei.test.js.',
  C18: 'kern/bedrijfsmaat/stand-groei.js (het verloop van de contracten: verlengd tegen verlengd plus geeindigd); test/bedrijfsmaatgroei.test.js.',
  C19: 'kern/bedrijfsmaat/stand-groei.js (subtotalen van facturen met betaalwijze rtg); test/bedrijfsmaatgroei.test.js.'
};

const dag = (besloten, rijen) => rijen.map(([id, naam, regel, kort]) => Object.freeze({ id, naam,
  besloten: besloten + ', door de eigenaar', herkomst: 'mens', regel, kort, handhaving: HANDHAVING[id], stand: 'gebouwd' }));

module.exports = Object.freeze([
  ...dag('28 september 2026', [
    ['C12', 'Een campagne is een code onder een kanaal',
      'Een campagne is een benoemde linkcode met een begin en een einde, onder precies een aanmeldkanaal. Financien boekt per ' +
      'campagne wat die kostte, als deel van de kanaalpost; het effect is het aantal nieuwe leden met die code, langs de ' +
      'groepspoort. Geen klikken en geen attributiemodel.',
      'Welke campagne werkt, zonder een lid te volgen.'],
    ['C13', 'Het beslisgeheugen: besluit plus uitkomst',
      'Per besluit wie besloot, op welke gronden (de bedrijfsmaten met hun graad op dat moment) en wat er verwacht werd; na een ' +
      'vaste termijn per maat wat die werkelijk deed. Een geheugen dat alleen leest, zeven jaar bewaard, en de machine stelt ' +
      'er nog niets uit voor.',
      'Terugkijken op een besluit met de getallen van toen.'],
    ['C14', 'De cadeaubon van RTG, ook te besteden bij zaken',
      'RTG verkoopt een eigen cadeaubon die bij RTG en bij de zaken op het platform te besteden is. Dat is elektronisch ' +
      'geld: de schakelaar in de boardroom is die positie, staat standaard dicht, en ook open vraagt de uitgifte een ' +
      'e-geldvergunning over de eigen rails. Het geld van een verkochte bon telt als verplichting op de bank.',
      'Een bon bij derden is geld, en dat staat er als positie en niet als instelling.']
  ]),
  ...dag('29 september 2026', [
    ['C15', 'De marge per lid, per pas en over alle leden',
      'De marge per lid wordt per pas gerekend: de afgesproken maandbijdrage van die pas min wat de leden van die pas het huis ' +
      'kostten, gedeeld door alle leden van die pas, ook wie niets gebruikte. Onder tien leden geen getal, en niet per cohort: ' +
      'dan zou de kostenlaag een identiteit moeten opzoeken.',
      'Wat een pas oplevert, zonder een lid te bekijken.'],
    ['C16', 'Land en stad van een lid',
      'Het land komt uit het account en de stad uit de woonplaats in de intake, allebei door het lid opgegeven en niet ' +
      'gecontroleerd; geteld langs de groepspoort, met kleine landen en plaatsen samen onder Overige.',
      'Waar leden wonen, zonder dat een plaatsnaam iemand verraadt.'],
    ['C17', 'Zaken per genre: toegelaten en actief',
      'Een zaak telt in een maand als zij toegelaten is en in die maand iets via RTG deed (een verzoek door haar eigen deur); ' +
      'per genre, onder vijf zaken geen getal.',
      'Gebruik, geen aanmeldingen.'],
    ['C18', 'Een contract is verlengd als het na zijn einddatum doorloopt',
      'Stilzwijgend of uitdrukkelijk; de maat is het aandeel verlengd van de contracten die in de maand op hun beslismoment ' +
      'kwamen, onder tien geen getal.',
      'Behoud meten zonder het lid iets extra te vragen.'],
    ['C19', 'Transactievolume: bruto via RTG Pay, zonder btw',
      'Wat zaken in de maand via RTG Pay ontvingen, zonder btw, in de wereld commercieel en nooit als omzet van RTG; onder ' +
      'vijf zaken geen getal.',
      'Geld van de zaken, naast de andere geldmaten te leggen.']
  ])
]);
