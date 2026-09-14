/* HET BOEKHOUDEN VAN DE BAAN -- het journaal en de dossiers.

   AFGESPLITST VAN ../geldketen.js op de naad tussen BEWAKEN en VASTLEGGEN. Deze
   module weet niets van geld en niets van de orde van de baan; zij weet hoe een as
   wordt vastgelegd en hoe een stap in de hashketen komt.

   TWEE BAKKEN, EN ZE ZIJN MET OPZET NIET HETZELFDE. Het JOURNAAL is een hashketen
   (lib/keten.js) en mag nooit herschreven worden; een DOSSIER wordt per as
   bijgewerkt terwijl de handeling loopt. Een dossier in de keten zetten zou elke
   bijwerking een ketenbreuk maken; het journaal in een dossier zetten zou de
   onherschrijfbaarheid weggooien.
*/
'use strict';

const keten = require('../../../lib/keten');

const MAX_JOURNAAL = 20000;
const MAX_DOSSIERS = 5000;

function maakBoeken({ bak, tijd }) {
  const journaal = () => bak('geldketenJournaal');
  const dossiers = () => bak('geldketenDossiers');

  const vindDossier = (id) => dossiers().find(d => d.voornemen === String(id || '')) || null;

  /* EEN AS VASTLEGGEN. Altijd een graad en altijd een reden -- ook (juist) als de
     uitslag "nee" is. Een as zonder reden wordt binnen een jaar een vinkje. */
  function leg(dossier, as, uitslag) {
    const rij = Object.assign({ as, at: tijd() }, uitslag);
    dossier.assen = dossier.assen.filter(a => a.as !== as).concat(rij);
    return rij;
  }

  /* HET JOURNAAL. Elke stap van de baan hangt in de hashketen, met de envelop-id
     erbij zodat het spoor en de gebeurtenis naar elkaar wijzen. */
  function noteer(env, wat, gegevens) {
    return keten.noteerIn(journaal(), {
      wat, voornemen: (gegevens && gegevens.voornemen) || null,
      envelop: env ? env.id : null, correlatie: env ? env.correlatie : null,
      oorzaak: env ? env.oorzaak : null,
      gegevens: gegevens || {}, at: tijd()
    }, MAX_JOURNAAL);
  }

  /* ------------------------------------------------------------------------
     KLAARZETTEN. De hele baan tot en met het besluit, en met opzet NIET de
     uitvoering: geld wordt klaargezet en een mens voert uit (GELD.md).
     ---------------------------------------------------------------------- */

  function bewaar(d) {
    const lijst = dossiers();
    const i = lijst.findIndex(x => x.voornemen && x.voornemen === d.voornemen);
    if (i >= 0) lijst[i] = d; else lijst.unshift(d);
    if (lijst.length > MAX_DOSSIERS) lijst.length = MAX_DOSSIERS;
  }

  return { journaal, dossiers, vindDossier, leg, noteer, bewaar,
    top: () => keten.top(journaal()), verifieer: () => keten.verifieer(journaal()) };
}

module.exports = { maakBoeken, MAX_JOURNAAL, MAX_DOSSIERS };
