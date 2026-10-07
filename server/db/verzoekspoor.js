/* ============================================================================
   HET SPOOR VAN EEN VERZOEK IN EEN VROEGE COMMIT (audit P0-1).

   WAT ER MIS WAS. In PostgreSQL-modus werkt een verzoek op een werkkopie die
   pas aan het eind in EEN transactie wordt gecommit (./postgres-verzoeken.js),
   en daarin zit ook het auditspoor: het handelingsspoor, het command-journaal,
   het inzagejournaal en de voorregel van het kritiekspoor. Twee primitieven
   committen echter MIDDEN in het verzoek, in een eigen transactie:
   ./collectie-postgres.js (de collectietransactie) en
   ./economische-boeking-postgres.js. Hun mutatie stond dus vast VOOR het spoor
   ervan, en als de requestcommit daarna faalde -- of het verzoek eindigde in
   een foutstatus, die de requestcommit helemaal overslaat -- dan bleef de
   mutatie staan en verdween haar spoor. Gemeten: POST /api/pay/kascode gaf 503,
   de kascode stond in PostgreSQL, en het handelingLog was niet veranderd.

   HET BESLUIT, en waarom dit en niet het andere. Er waren twee wegen:
     a) de voorregel van het kritiekspoor VOOR de handler als echte, eigen
        commit wegschrijven, en lib/duurzaam laten falen waar het niet kan
        bevestigen;
     b) elke vroege commit neemt het spoor van het verzoek mee in ZIJN EIGEN
        transactie.
   (a) dekt alleen de kritieke paden, en legt een regel vast die zegt dat iets
   MAG -- niet dat het gebeurde. Een collectietransactie op een pad dat niet op
   de kritieke lijst staat, bleef dan nog steeds zonder spoor vastliggen. (b)
   maakt het een eigenschap van de commit zelf: er bestaat in PostgreSQL geen
   transactie die een mutatie van een verzoek vastlegt zonder dat het spoor van
   dat verzoek in dezelfde transactie staat. Faalt het spoor, dan rolt de
   mutatie mee terug. Dat is de vorm die structureel klopt; (a) is een regel
   die je per pad moet onthouden.

   WAT ER MEEGAAT.
     1. alles wat het verzoek al in een auditcollectie had gezet en nog niet
        gecommit is (de voorregel van het kritiekspoor, inzageregels, ...);
     2. EEN NIEUWE regel in het handelingsspoor met `stand: 'vastgelegd'` en de
        collecties die deze commit raakte. Die regel staat er omdat het
        eindspoor (stand = statuscode, op 'finish') per definitie pas NA deze
        commit bestaat: zonder hem kon een collectietransactie op een gewoon
        pad nog altijd zonder enige regel blijven staan. `vastgelegd` zegt
        precies wat waar is -- de regel en de mutatie zijn samen gecommit -- en
        niets over hoe het verzoek afliep; dat zegt de eindregel.
   Wat hier niet gebeurt: het spoor IN de werkkopie schrijven voordat de commit
   slaagt. De nieuwe regel bestaat alleen in de transactie; mislukt die, dan
   staat er ook niets in de werkkopie dat later zou beweren dat er iets is
   vastgelegd.
   ========================================================================== */
'use strict';

const context = require('./verzoekcontext');
const vak = require('./verzoekvak');
const keten = require('../lib/keten');

/* De auditcollecties van de werkkopie. Een collectie hoort hier als een
   handeling zonder haar regel niet achteraf te herleiden is. */
const SPOREN = Object.freeze(['apiSpoor', 'handelingLog', 'inzageLog', 'securityLog']);
const HANDELING_MAX = 50000;   // dezelfde grens als lib/handelingsspoor.js en pg/verzoeksporen.js

/* De bouwer van de handelingsregel komt van lib/handelingsspoor.js (via
   opzet/lijfpoort.js): EEN vorm voor een regel, en die woont daar. Zonder haak
   (een los toetsstel) gaat alleen het al gezette spoor mee. */
let regelVoor = null;
function haakRegel(fn) { regelVoor = typeof fn === 'function' ? fn : null; }

/* Voor een vroege commit: het spoor dat in DEZELFDE transactie mee moet, of
   null buiten een verzoek. `collecties` zijn de collecties die de commit raakt. */
function voorVroegeCommit(collecties, ruw) {
  const ctx = context.huidige();
  /* Na de requestcommit staat het spoor van dit verzoek al vast; een
     na-commiteffect (de aanwezigheid van de dag) is geen handeling van het lid
     meer en krijgt geen regel. */
  if (!ctx || !ctx.open || ctx.verzoekGecommit) return null;
  const geraakt = [].concat(collecties || []).map(String);
  const wijzigingen = [];
  const verwacht = new Map();
  for (const sleutel of SPOREN) {
    if (geraakt.includes(sleutel)) continue;
    const s = vak.vakStand(ctx, sleutel, ruw);
    let waardeJson = s.waardeJson, bestaat = s.bestaat, gewijzigd = s.gewijzigd;
    if (sleutel === 'handelingLog' && regelVoor && ctx.req) {
      const regel = regelVoor(ctx.req, geraakt);
      if (regel) {
        const lijst = bestaat && waardeJson ? JSON.parse(waardeJson) : [];
        keten.noteerIn(Array.isArray(lijst) ? lijst : [], regel, HANDELING_MAX);
        waardeJson = JSON.stringify(lijst); bestaat = true; gewijzigd = true;
      }
    }
    if (!gewijzigd) continue;
    verwacht.set(sleutel, s.waardeJson);
    wijzigingen.push({ sleutel, basisBestaat: s.basisBestaat, basisJson: s.basisJson,
      waardeBestaat: bestaat, waardeJson });
  }
  return { wijzigingen, verwacht, geschreven: false, ctx };
}

/* Na de vroege commit: wat er mee is gecommit, laat de werkkopie los, zodat
   de requestcommit dezelfde regels niet nog eens aanbiedt.

   Is een vak TIJDENS de transactie veranderd -- een vroege commit die niet
   werd afgewacht (de aanwezigheid van de dag) terwijl het verzoek intussen
   zijn voorregel schreef -- dan blijft het vak staan met zijn oude basis. Dat
   is veilig en geen fout van het verzoek: de requestmerge (pg/verzoeksporen.js)
   neemt alleen toevoegingen over en slaat een regel die de database al draagt
   met dezelfde inhoud over, zodat er niets dubbel en niets verloren gaat. Een
   harde fout hier zou het eerste verzoek van de dag van een lid laten zakken. */
function naVroegeCommit(spoor) {
  if (!spoor || !spoor.geschreven) return;
  for (const [sleutel, json] of spoor.verwacht) vak.laatVakLos(spoor.ctx, sleutel, json);
}

module.exports = { SPOREN, haakRegel, voorVroegeCommit, naVroegeCommit };
