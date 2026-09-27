/* Nagekeken contracten van de vier restdeuren uit RELEASEKANDIDAAT.md B9:
   de OV-incheckcode (kern/ov/incheckcode.js), de bezorgcode
   (kern/modebezorg/bezorgcode.js), de festivalpas (kern/festival/pas-toegang.js)
   en de incheckcode van een Foundation-activiteit (kern/rtfos/activiteiten-deur.js).
   Uitgeven en tonen zijn ROTEREN en dus nooit dezelfde uitkomst; intrekken is
   een stand die een tweede keer niets meer verandert. */
'use strict';
const AF = { door: 'Claude, de vier credentialkernen en hun routes gelezen en beproefd', op: '2026-09-27' };
const ROTEER = (mutatieId, toegang, waarom, gemeten) => ({ mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'nietHerhaalbaar' }, toegang, stand: 'INTENTIONALLY_NON_IDEMPOTENT',
  waarom: waarom + ' Een herhaling die de vorige code teruggaf zou een geheim uit een cache heronthullen; daarom staat de route in lib/eenmalig-geheim-routes.js.',
  bewijs: { gemeten, op: '2026-09-27' }, afgetekend: AF });
const LID = { klasse: 'AUTHENTICATED', uitleg: 'het lid uit de sessie; de code hangt aan zijn eigen sleutel' };
const CONTRACTEN = {
  'POST /api/ov/code': ROTEER('ov.incheckcode.tonen', LID,
    'Elke oproep maakt een nieuwe 128-bit incheckcode bij de gekozen vervoerder en trekt de vorige in.',
    'test/ovincheckcode.test.js 5 en 8: na een nieuwe code start de vorige geen rit meer (404)'),
  'POST /api/ov/code/intrek': { mutatieId: 'ov.incheckcode.intrekken', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' }, toegang: LID, stand: 'PROTECTED',
    bewijs: { gemeten: 'test/ovincheckcode.test.js 5 en 8: na intrekken start de code geen rit; een tweede oproep laat dat zo', op: '2026-09-27' },
    afgetekend: AF },
  'POST /api/mode/bezorg/code': ROTEER('mode.bezorgcode.nieuw',
    { klasse: 'AUTHENTICATED', uitleg: 'het lid uit de sessie; de ref moet een lopende bezorging van DIT lid zijn, anders 404' },
    'Elke oproep maakt een nieuwe bezorgcode, trekt de vorige in en telt tegen het plafond van tien.',
    'test/bezorgcode.test.js 5 en 6 en test/modebezorg.test.js 6: de vorige code telt als fout, de nieuwe levert af'),
  'POST /api/festival/gast/pas/toon': ROTEER('festival.pas.tonen',
    { klasse: 'AUTHENTICATED', uitleg: 'het lid uit de sessie; de pas moet op zijn codenaam staan, anders 404' },
    'Tonen maakt een nieuwe 128-bit pascode en trekt de vorige in.',
    'test/festivalpas.test.js 3 en test/festival-routes.test.js 31: de vorige code kent de poort niet meer (404)'),
  'POST /api/rtfos/activiteit/incheckcode': ROTEER('rtfos.activiteit.incheckcode',
    { klasse: 'AUTHENTICATED', uitleg: 'de kantoordeur; daarna eist de kern project.beheren in de stad van de activiteit (403)' },
    'Een nieuwe incheckcode trekt de vorige in.',
    'test/activiteitincheck.test.js 3 en test/rtfos-uitvoering.test.js: de vervangen code kent de deur niet meer (404)')
};
module.exports = { CONTRACTEN };
