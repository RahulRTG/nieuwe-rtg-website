/* DE TWEE CONSTITUTIONELE BESLUITEN ONDER DE BEDRIJFSMAATLAAG.

   Genomen door de eigenaar op 25 september 2026, vóór de meter werd gebouwd --
   in die volgorde, omdat een meter die RTG en de RTFoundation samen waarneemt
   eerst moet weten dat hij dat mag, en onder welke voorwaarde.

   Ze staan hier als GEGEVENS zodat het register ze kan dragen en een toets ze
   kan vasthouden. De formulering is opgeschreven door Claude op aanwijzing van
   de eigenaar; een mens heeft haar nog niet op deze woorden nagelezen. */
'use strict';

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
      'weigert een maat zonder wereld of met een onbekende. De firewall is in deze ronde niet aangeraakt.'
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
      'de ingang /api/office/doe op naam, en test/stuur-kantoor.test.js.'
  })
]);

module.exports = { BESLUITEN };
