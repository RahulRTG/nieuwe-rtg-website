/* Het nagekeken contract van de sessiestroom (6 oktober 2026,
   kern/sessiestroom.js): een live-stroom of video draagt geen sessie meer in
   het adres. Het scherm ruilt zijn sessie (in de kop) voor een kortlevend
   ticket dat alleen in het adres van de stroom staat. Elke oproep geeft een
   ander ticket en is dus met opzet niet herhaalbaar (lib/eenmalig-geheim-routes.js).
   Eigen bestand, zodat parallelle migraties elkaars lijst niet raken. */
'use strict';
const OP = '2026-10-06';
const AF = { door: 'Claude, kern/sessiestroom.js, opzet/stroomtoegang.js en school/bellen.js gelezen en beproefd', op: OP };
const CONTRACTEN = {
  'POST /api/stroom/ticket': { mutatieId: 'sessiestroom.ticket', herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: { klasse: 'AUTHENTICATED',
      uitleg: 'de sessie uitsluitend uit de kop Authorization; de gevraagde soort (lid, zaak, kantoor, theater-kijk) ' +
        'stelt dezelfde vraag als haar deur, en een sessie die die deur niet opent krijgt 401' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Elke oproep geeft een nieuw ticket van hoogstens vijf minuten dat zijn stroom een keer (of, voor een video, ' +
      'begrensd) opent. Een herhaling die het vorige ticket teruggaf zou een geheim uit een cache heronthullen; daarom ' +
      'staat de route ook in lib/eenmalig-geheim-routes.js.',
    bewijs: { gemeten: 'test/sessiestroom.test.js: een ticket opent elke stroom precies een keer, een geldige sessie in ' +
      '?token= wordt geweigerd, en een sessie die na de uitgifte uitlogt opent niets -- tegen een echte server', op: OP },
    afgetekend: AF },
  'POST /api/foundation/school/belkanaal/ticket': { mutatieId: 'school.belkanaal.ticket', herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'klasCode',
      uitleg: 'de klas (en het gezin) uit het lijf plus het leraar- of gezinstoken van DIE klas in de kop; een kind of ' +
        'een gezin buiten de klas krijgt 403' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Elke oproep geeft een nieuw eenmalig ticket van een minuut voor het belkanaal van deze klas; een cache zou ' +
      'een ingewisseld ticket teruggeven.',
    bewijs: { gemeten: 'test/schoolbel.test.js: een ticket opent het kanaal een keer en alleen voor zijn eigen gezin, ' +
      'een kind krijgt er geen, en een token in het adres wordt geweigerd', op: OP },
    afgetekend: AF }
};
module.exports = { CONTRACTEN };
