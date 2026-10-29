/* Bewuste tweede handelingen uit Deep Green ronde 3.

   De algemene antwoordkas mag deze routes niet tot een technische replay
   reduceren. Iedere activering berekent, exporteert, remt of registreert een
   nieuw auditmoment; waar een expliciete domeinsleutel bestaat, bewaakt de
   domeinkern die zelf. */
'use strict';

const tweede = waarom => ({ nietIdempotent: true, waarom });
const SLEUTELS = {
  'POST /api/supplier/mep/daily': tweede('iedere activering rekent de actuele dag opnieuw; het vorige automatische voorstel wordt door de kern onuitvoerbaar'),
  'POST /api/supplier/rooster/voorstel': tweede('iedere activering maakt bewust een nieuw roosteradvies uit de actuele bezetting'),
  'POST /api/supplier/rtmail/export': tweede('iedere export is een afzonderlijke gegevensuitgifte met een eigen auditregel'),
  'POST /api/command/uitrol/pauze': tweede('iedere bewuste remactie is een afzonderlijk operationeel auditmoment'),
  'POST /api/foundation/school/overdracht/pakket': tweede('iedere pakketweergave is afzonderlijke dossierinzage en hoort in het schooljournaal'),
  'POST /api/office/balie/zoek': tweede('iedere zoekopdracht is afzonderlijke inzage in persoonsgegevens en vereist een eigen duurzaam spoor'),
  'POST /api/office/techniek/integraties/noodstop': tweede('iedere druk handhaaft de runtime opnieuw en blijft als afzonderlijke veiligheidsactie auditeerbaar')
};

module.exports = { SLEUTELS };
