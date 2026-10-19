/* DE POORT VOOR MACHINEPOST VAN BUITEN (eigenaarsbesluit 19 oktober 2026,
   AGENTS.md uitzondering 6: machine-tot-machineverkeer met een eigen
   handtekening).

   /api/werkmail/bezorg en /api/mail/binnen nemen post aan van een mailserver.
   Dat is geen lid en vraagt dus geen account, maar wel bewijs dat het ONZE
   mailserver is: het gedeelde geheim uit RTG_MAILPOORT_GEHEIM, minstens 32
   tekens, in de kop x-rtg-mailpoort, tijd-veilig vergeleken.

   DICHT TENZIJ INGERICHT. Zonder geheim (of met een te kort geheim) gaat de
   deur niet open, en het antwoord is dan hetzelfde 401 als bij een fout
   geheim: een vreemde hoort niet uit het verschil te kunnen lezen hoe dit huis
   is ingericht (dezelfde les als kern/ses-ontvangst.js). De SES-poort heeft
   zijn eigen HMAC per bericht en hangt hier niet aan. */
'use strict';

const crypto = require('crypto');

const KOP = 'x-rtg-mailpoort';
const MIN = 32;

function mailpoort(req, res, next) {
  const geheim = String(process.env.RTG_MAILPOORT_GEHEIM || '');
  const kop = String((req.get && req.get(KOP)) || '');
  if (geheim.length >= MIN && kop.length === geheim.length &&
      crypto.timingSafeEqual(Buffer.from(kop), Buffer.from(geheim))) return next();
  return res.status(401).json({ error: 'Deze buitenpoort is alleen voor de eigen mailserver, met het gedeelde geheim in de kop ' + KOP + '.' });
}

module.exports = { mailpoort, KOP, MIN };
