/* ============================================================================
   DE LIJST BIJ ./mutatiecontracten-proefronde.js -- 116 routes, drie groepen.

   Alleen de opsomming; de drie bouwers, hun bewijsteksten en het verschil in
   bewijskracht staan in dat bestand. Ze staan uit elkaar omdat de uitleg anders
   ondersneeuwt onder honderdzestien regels -- en omdat scripts/check.js een
   bestand van veertien kilobyte terecht te groot vindt.
   ========================================================================== */
'use strict';

const { CONTRACTEN, gemerkt, metSleutel, tweedeHandeling } = require('./mutatiecontracten-proefronde-bouw');

/* ---- 1. ook ZONDER sleutel opgevangen (26) ---- */
gemerkt('POST /api/foundation/school/bijdrage/maak', 'foundation.school.bijdrage.maak');
gemerkt('POST /api/foundation/school/directie/mededeling', 'foundation.school.directie.mededeling');
gemerkt('POST /api/foundation/school/excursie/maak', 'foundation.school.excursie.maak');
gemerkt('POST /api/foundation/school/huiswerk/maak', 'foundation.school.huiswerk.maak');
gemerkt('POST /api/foundation/school/les/geheugen', 'foundation.school.les.geheugen');
gemerkt('POST /api/foundation/school/mededeling', 'foundation.school.mededeling');
gemerkt('POST /api/foundation/school/nieuwsbrief', 'foundation.school.nieuwsbrief');
gemerkt('POST /api/foundation/school/telefoonboom/maak', 'foundation.school.telefoonboom.maak');
gemerkt('POST /api/kantoorpakket/beheer', 'kantoorpakket.beheer');
gemerkt('POST /api/kantoorpakket/deel', 'kantoorpakket.deel');
gemerkt('POST /api/kantoorpakket/opmerking', 'kantoorpakket.opmerking');
gemerkt('POST /api/office/kantoorpakket/beheer', 'office.kantoorpakket.beheer');
gemerkt('POST /api/office/kantoorpakket/deel', 'office.kantoorpakket.deel');
gemerkt('POST /api/office/kantoorpakket/opmerking', 'office.kantoorpakket.opmerking');
gemerkt('POST /api/rtf/baby/entry-maak', 'rtf.baby.entry-maak');
gemerkt('POST /api/rtf/kantoorpakket/maak', 'rtf.kantoorpakket.maak');
gemerkt('POST /api/rtf/leren/project-maak', 'rtf.leren.project-maak');
gemerkt('POST /api/rtf/leren/schrijf-bewaar', 'rtf.leren.schrijf-bewaar');
gemerkt('POST /api/rtf/social/pin/live', 'rtf.social.pin.live');
gemerkt('POST /api/rtf/social/pin/nieuw', 'rtf.social.pin.nieuw');
gemerkt('POST /api/rtf/social/pin/uit', 'rtf.social.pin.uit');
gemerkt('POST /api/rtf/tiener/boek', 'rtf.tiener.boek');
gemerkt('POST /api/supplier/agent/koppel', 'supplier.agent.koppel');
gemerkt('POST /api/supplier/kantoorpakket/beheer', 'supplier.kantoorpakket.beheer');
gemerkt('POST /api/supplier/kantoorpakket/deel', 'supplier.kantoorpakket.deel');
gemerkt('POST /api/supplier/kantoorpakket/opmerking', 'supplier.kantoorpakket.opmerking');

/* ---- 2. alleen MET sleutel gemeten (85) ---- */
metSleutel('POST /api/foundation/school/aandacht', 'foundation.school.aandacht');
metSleutel('POST /api/foundation/school/aanwezigheid/klas', 'foundation.school.aanwezigheid.klas');
metSleutel('POST /api/foundation/school/belasting/klas', 'foundation.school.belasting.klas');
metSleutel('POST /api/foundation/school/bijdrage/overzicht', 'foundation.school.bijdrage.overzicht');
metSleutel('POST /api/foundation/school/denkfout/klas', 'foundation.school.denkfout.klas');
metSleutel('POST /api/foundation/school/excursie/lijst', 'foundation.school.excursie.lijst');
metSleutel('POST /api/foundation/school/hr/vervanging', 'foundation.school.hr.vervanging');
metSleutel('POST /api/foundation/school/hulplijn/bewaking', 'foundation.school.hulplijn.bewaking');
metSleutel('POST /api/foundation/school/hulplijn/klas', 'foundation.school.hulplijn.klas');
metSleutel('POST /api/foundation/school/hulplijn/mijn', 'foundation.school.hulplijn.mijn');
metSleutel('POST /api/foundation/school/klas', 'foundation.school.klas');
metSleutel('POST /api/foundation/school/klas/team', 'foundation.school.klas.team');
metSleutel('POST /api/foundation/school/koppel', 'foundation.school.koppel');
metSleutel('POST /api/foundation/school/les/concept', 'foundation.school.les.concept');
metSleutel('POST /api/foundation/school/les/start', 'foundation.school.les.start');
metSleutel('POST /api/foundation/school/taalbeleid', 'foundation.school.taalbeleid');
metSleutel('POST /api/foundation/school/telefoonboom', 'foundation.school.telefoonboom');
metSleutel('POST /api/foundation/school/toets/bibliotheek', 'foundation.school.toets.bibliotheek');
metSleutel('POST /api/foundation/school/toets/lijst', 'foundation.school.toets.lijst');
metSleutel('POST /api/foundation/school/uitnodiging/antwoord', 'foundation.school.uitnodiging.antwoord');
metSleutel('POST /api/foundation/school/vervanging/briefing', 'foundation.school.vervanging.briefing');
metSleutel('POST /api/kantoorpakket/bewaar', 'kantoorpakket.bewaar');
metSleutel('POST /api/kantoorpakket/open', 'kantoorpakket.open');
metSleutel('POST /api/kantoorpakket/samen', 'kantoorpakket.samen');
metSleutel('POST /api/kantoorpakket/versies', 'kantoorpakket.versies');
metSleutel('POST /api/office/kantoorpakket/bewaar', 'office.kantoorpakket.bewaar');
metSleutel('POST /api/office/kantoorpakket/open', 'office.kantoorpakket.open');
metSleutel('POST /api/office/kantoorpakket/samen', 'office.kantoorpakket.samen');
metSleutel('POST /api/office/kantoorpakket/versies', 'office.kantoorpakket.versies');
metSleutel('POST /api/office/kantoorpakket/weg', 'office.kantoorpakket.weg');
metSleutel('POST /api/rtf/baby/boek', 'rtf.baby.boek');
metSleutel('POST /api/rtf/baby/tijdlijn', 'rtf.baby.tijdlijn');
metSleutel('POST /api/rtf/beroepen', 'rtf.beroepen');
metSleutel('POST /api/rtf/beroepen/mijn', 'rtf.beroepen.mijn');
metSleutel('POST /api/rtf/bieb', 'rtf.bieb');
metSleutel('POST /api/rtf/bieb/catalogus', 'rtf.bieb.catalogus');
metSleutel('POST /api/rtf/bieb/mijn', 'rtf.bieb.mijn');
metSleutel('POST /api/rtf/geloof', 'rtf.geloof');
metSleutel('POST /api/rtf/geloof/catalogus', 'rtf.geloof.catalogus');
metSleutel('POST /api/rtf/geloof/mijn', 'rtf.geloof.mijn');
metSleutel('POST /api/rtf/kantoorpakket/mijn', 'rtf.kantoorpakket.mijn');
metSleutel('POST /api/rtf/leren/herhaal', 'rtf.leren.herhaal');
metSleutel('POST /api/rtf/leren/herhaal-stand', 'rtf.leren.herhaal-stand');
metSleutel('POST /api/rtf/leren/lijsten', 'rtf.leren.lijsten');
metSleutel('POST /api/rtf/leren/projecten', 'rtf.leren.projecten');
metSleutel('POST /api/rtf/leren/schrijf-opdracht', 'rtf.leren.schrijf-opdracht');
metSleutel('POST /api/rtf/leren/schrijfsels', 'rtf.leren.schrijfsels');
metSleutel('POST /api/rtf/leren/sessies', 'rtf.leren.sessies');
metSleutel('POST /api/rtf/leven/beeindigd', 'rtf.leven.beeindigd');
metSleutel('POST /api/rtf/leven/beleid', 'rtf.leven.beleid');
metSleutel('POST /api/rtf/leven/beleid/zet', 'rtf.leven.beleid.zet');
metSleutel('POST /api/rtf/leven/kring', 'rtf.leven.kring');
metSleutel('POST /api/rtf/link/koppelingen', 'rtf.link.koppelingen');
metSleutel('POST /api/rtf/onboarding/status', 'rtf.onboarding.status');
metSleutel('POST /api/rtf/school', 'rtf.school');
metSleutel('POST /api/rtf/school/catalogus', 'rtf.school.catalogus');
metSleutel('POST /api/rtf/school/mijn', 'rtf.school.mijn');
metSleutel('POST /api/rtf/social/connections', 'rtf.social.connections');
metSleutel('POST /api/rtf/social/find', 'rtf.social.find');
metSleutel('POST /api/rtf/social/opdracht', 'rtf.social.opdracht');
metSleutel('POST /api/rtf/social/pin', 'rtf.social.pin');
metSleutel('POST /api/rtf/social/snaps', 'rtf.social.snaps');
metSleutel('POST /api/rtf/social/stories', 'rtf.social.stories');
metSleutel('POST /api/rtf/spel/klasgenoten', 'rtf.spel.klasgenoten');
metSleutel('POST /api/rtf/spel/mijn', 'rtf.spel.mijn');
metSleutel('POST /api/rtf/spel/online', 'rtf.spel.online');
metSleutel('POST /api/rtf/spel/prestaties', 'rtf.spel.prestaties');
metSleutel('POST /api/rtf/spel/sneek-bord', 'rtf.spel.sneek-bord');
metSleutel('POST /api/rtf/spel/sneek-score', 'rtf.spel.sneek-score');
metSleutel('POST /api/rtf/spel/stand', 'rtf.spel.stand');
metSleutel('POST /api/rtf/spel/team-mijn', 'rtf.spel.team-mijn');
metSleutel('POST /api/rtf/spel/toernooi-mijn', 'rtf.spel.toernooi-mijn');
metSleutel('POST /api/rtf/spel/uitslagen', 'rtf.spel.uitslagen');
metSleutel('POST /api/rtf/spel/varianten', 'rtf.spel.varianten');
metSleutel('POST /api/rtf/spel/zichtbaar', 'rtf.spel.zichtbaar');
metSleutel('POST /api/rtf/talent/mijn', 'rtf.talent.mijn');
metSleutel('POST /api/rtf/tiener/potje', 'rtf.tiener.potje');
metSleutel('POST /api/rtf/tiener/toetsen', 'rtf.tiener.toetsen');
metSleutel('POST /api/rtf/toegang', 'rtf.toegang');
metSleutel('POST /api/rtf/welzijn/dagboek', 'rtf.welzijn.dagboek');
metSleutel('POST /api/supplier/kantoorpakket/bewaar', 'supplier.kantoorpakket.bewaar');
metSleutel('POST /api/supplier/kantoorpakket/open', 'supplier.kantoorpakket.open');
metSleutel('POST /api/supplier/kantoorpakket/samen', 'supplier.kantoorpakket.samen');
metSleutel('POST /api/supplier/kantoorpakket/versies', 'supplier.kantoorpakket.versies');
metSleutel('POST /api/supplier/kantoorpakket/weg', 'supplier.kantoorpakket.weg');

/* ---- 3. met opzet een tweede handeling (3) ---- */
tweedeHandeling('POST /api/rtf/baby/moment-ai', 'rtf.baby.moment-ai');
tweedeHandeling('POST /api/rtf/spel/sudoku-nieuw', 'rtf.spel.sudoku-nieuw');
tweedeHandeling('POST /api/rtf/spel/team-nieuw', 'rtf.spel.team-nieuw');

require('./mutatiecontracten-proefronde-rijk');

module.exports = CONTRACTEN;
