/* DE BESLUITEN ONDER DE BEDRIJFSMAATLAAG: twee constitutionele (C1, C2) en negen
   over wat er gemeten wordt en hoe (C3 tot en met C11). Wat daarna kwam (C12 en
   verder) staat in ./besluiten-later.js, in dezelfde vorm.

   Genomen door de eigenaar op 25 september 2026, vóór de meter werd gebouwd --
   in die volgorde, omdat een meter die RTG en de RTFoundation samen waarneemt
   eerst moet weten dat hij dat mag, en onder welke voorwaarde.

   Ze staan hier als GEGEVENS zodat het register ze kan dragen en een toets ze
   kan vasthouden. De formulering is opgeschreven door Claude op aanwijzing van
   de eigenaar; een mens heeft haar nog niet op deze woorden nagelezen.

   `stand` zegt of een besluit al een handhaver heeft. Een besluit dat nog
   gebouwd moet worden staat hier toch: anders lijkt een lege plek in de meter
   een vergeten vraag, terwijl het een genomen besluit is dat op werk wacht. */
'use strict';

/* Wie C3 tot en met C11 handhaaft, sinds 27 september 2026. */
const HANDHAVING = {
  C3: 'kern/bedrijfsmaat/klantwaarde.js (vier maten, geen totaal), kern/reisbureau-thuis.js en afgerondOp in ' +
    'kern/rtfos/casus-keten.js; test/klantwaarde.test.js en test/reisbureau-thuis.test.js.',
  C4: 'kern/bankpositie.js (handmatig, bron verplicht, graad vermoed, bonnen op nul met reden); test/bankpositie.test.js. ' +
    'De eigen bon zelf en een bankkoppeling zijn nog niet gebouwd.',
  C5: 'kern/aanmeldingen/naargast.js (lid nu of aan het eind, kantoor met reden, drie regels standaard uit); ' +
    'test/naargast.test.js.',
  C6: 'kern/aanmeldkanaal.js (een telling per maand, nooit per lid); test/aanmeldkanaal.test.js. ' +
    'De vraag staat na de registratie op het welkomstscherm (routes/auth/account.js, een keer per account).',
  C7: 'kern/streefbeeld.js (voorstel uit drie maanden, tekenen op de vingerafdruk, een dimensie buiten is nee); ' +
    'test/streefbeeld.test.js. Er is nog niets dat autonoom handelt.',
  C8: 'kern/rtgboek.js en kern/bedrijfsmaat/stand-rtgboek.js; test/rtgboek.test.js. Posten per maand met een bron, op naam, personeel als totaal; stroom en serverhuur blijven in de huisrekening.',
  C9: 'kern/rtgboek.js en kern/bedrijfsmaat/stand-rtgboek.js; test/rtgboek.test.js. Bruto en netto naast elkaar; geen netto verbruik geeft geen getal.',
  C10: 'kern/rtgboek.js en kern/bedrijfsmaat/stand-rtgboek.js; test/rtgboek.test.js. Het ledentegoed komt uit kern/pay (ledentegoed) en wordt niet afgetrokken.',
  C11: 'kern/rtgboek.js en kern/bedrijfsmaat/stand-rtgboek.js; test/rtgboek.test.js. Per kanaal, langs de groepspoort van het aanmeldkanaal; vriend heeft geen post.'
};

const BESLUITEN = Object.freeze([
  Object.freeze({
    id: 'C1',
    naam: 'Eén waarnemende laag',
    besloten: '25 september 2026, door de eigenaar',
    herkomst: 'mens',
    regel: 'RTG en de RTFoundation mogen door dezelfde intelligentielaag worden waargenomen. ' +
      'Iedere waarneming en iedere voorgestelde handeling behoudt haar economische wereld. ' +
      'kern/economie/firewall.js wordt niet omzeild of versoepeld. RTF-informatie kan buiten haar ' +
      'economische wereld hoogstens tot een constatering of een voorstel leiden.',
    kort: 'Eén waarnemend brein is niet één portemonnee.',
    handhaving: 'Elke bedrijfsmaat draagt precies één wereld uit kern/economie/werelden.js; de meter ' +
      'weigert een maat zonder wereld of met een onbekende (test/bedrijfsmaat.test.js). De firewall is in deze ronde niet aangeraakt.',
    stand: 'gebouwd'
  }),
  Object.freeze({
    id: 'C2',
    naam: 'Het kantoor als AI-rol, uitsluitend tonen',
    besloten: '25 september 2026, door de eigenaar',
    herkomst: 'mens',
    regel: 'office wordt een AI-rol, uitsluitend op de bestaande gezagstrede tonen (lezen). ' +
      'Geen nieuwe gezagsladder en geen muterende kantoormacht.',
    kort: 'Het kantoor kijkt mee; het stuur verandert er niets.',
    handhaving: 'kern/stuur/beleid-lijsten.js (office alleen in LEZEN, lege KLEIN en VOORSTEL), ' +
      'de ingang /api/office/doe op naam, en test/stuur-kantoor.test.js.',
    stand: 'gebouwd'
  }),
  ...[
    ['C3', 'Klantwaarde per wereld',
      'Een geslaagde uitkomst per wereld, vier maten naast elkaar en geen totaal: LivingOS een rit of ' +
      'bestelling afgerond, TravelOS een reis die thuis is (een nieuwe stand, gezet door het kantoor of ' +
      'het lid), WorkOS een definitieve loonrun, FoundationOS een afgeronde casus met een tijdstip.',
      'Waarde per wereld, nooit een cijfer over alles.'],
    ['C4', 'Het banksaldo van RTG uit meer dan een bron',
      'Eerst handmatig met het afschrift als herkomst (graad vermoed), een bankkoppeling later als eigen ' +
      'besluit. RTG gaat eigen cadeaubonnen verkopen; geld van een verkochte bon telt als cash en als ' +
      'verplichting. De bon zelf draagt de e-geldvraag van TOKEN.md; bonnen van zaken blijven van de zaak.',
      'Wat op de bank staat is niet allemaal vrij geld.'],
    ['C5', 'Van een betaalde pas naar gast langs drie wegen',
      'Het lid zelf, het kantoor met de hand, en automatisch met regels die per situatie te kiezen zijn. ' +
      'Voorstel van Claude, nog te bevestigen: elke automatische regel staat standaard dicht, een lid ' +
      'zonder vastgelegd contract gaat nooit automatisch, en facturen en bewijsstukken blijven.',
      'Weggaan kan, en niemand verdwijnt stil.'],
    ['C6', 'Het herkomstkanaal bij aanmelding',
      'Een optionele vraag bij aanmelding en een campagnecode in de link; alleen geteld langs de ' +
      'groepspoort, nooit per lid zichtbaar, dertien maanden bewaard en weg bij vergetelheid.',
      'Weten waar leden vandaan komen, niet wie.'],
    ['C7', 'De streefstand',
      'De machine stelt per dimensie een streefstand met tolerantie voor uit afgesloten maanden; hij geldt ' +
      'pas na de handtekening van de eigenaar. Zonder getekende streefstand gebeurt er niets autonoom.',
      'De machine stelt voor, de eigenaar tekent.'],
    ['C8', 'De vaste kosten van RTG, ingevoerd door Financien',
      'Het Financien-kantoor voert in zijn eigen kamer per maand de vaste lasten, de marketinguitgaven per kanaal ' +
      'en de korte verplichtingen van RTG in, elk met een bron en op naam.',
      'Wat RTG zelf kost, staat bij de mensen die het betalen.'],
    ['C9', 'De runway netto en bruto naast elkaar',
      'Het vrije banksaldo gedeeld door het verbruik over drie afgesloten maanden, een keer met en een keer zonder de ' +
      'ontvangen omzet; geen van beide wint.',
      'Hoe lang het duurt, en hoe lang als de omzet wegvalt.'],
    ['C10', 'Liquiditeit telt alleen eigen schulden',
      'Het vrije banksaldo min de eigen korte verplichtingen; het tegoed van leden staat er los naast en wordt niet ' +
      'afgetrokken.',
      'Het ledentegoed is een getal ernaast, geen aftrekpost.'],
    ['C11', 'CAC per kanaal',
      'De marketinguitgave per kanaal gedeeld door de nieuwe leden via dat kanaal in dezelfde maand, langs de groepspoort.',
      'Welk kanaal werkt, en niet een gemiddelde over alles.']
  ].map(([id, naam, regel, kort]) => Object.freeze({ id, naam, besloten: '27 september 2026, door de eigenaar',
    herkomst: 'mens', regel, kort, handhaving: HANDHAVING[id], stand: 'gebouwd' })),
  ...require('./besluiten-later')
]);

module.exports = { BESLUITEN };
