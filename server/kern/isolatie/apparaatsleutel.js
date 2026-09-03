/* DE SLEUTEL VAN EEN TOESTEL -- afgeleid uit een passkey, en niet de passkey.

   WAAROM DIT BESTAAT. De drager `apparaat` had een keurige opslagplek
   (db.data.isolatie.apparaat) en geen enkele plek in de code die er ooit een
   sleutel in stopte. Het scherm van een lid bood de laag aan, de route gaf een
   409 terug, en de meter telde hem als "met een bron" -- een gat met een naam.

   DE ENIGE PLEK WAAR RTG EEN TOESTEL KENT is een passkey-inlog: daar bewijst een
   authenticator met echte cryptografie dat hij dezelfde is als de vorige keer.
   Een wachtwoordinlog bewijst dat niet, en een user-agent al helemaal niet -- die
   is door de aanvrager zelf te kiezen, en dan is de drager een veld uit het
   verzoek.

   WAAROM NIET HET CREDENTIAL-ID ZELF. Dat id is over accounts heen te herkennen:
   wie het op twee plekken ziet, weet dat het dezelfde authenticator is. Het gaat
   daarom door dezelfde HKDF-domeinscheiding als de rest van dit huis
   (accounts/kluis.js sleutelVoor), met een eigen doel. De uitkomst is stabiel per
   toestel per huis, en niet terug te rekenen.

   WAT DIT NIET IS. Geen `apparaat` in de zin van kern/toestellen.js (een horloge
   of weegschaal met zijn eigen smalle schrijfsleutel en zonder sessie), en niet
   het veld `apparaat` op een webauthn-credential (dat zegt single- of
   multiDevice). Drie begrippen, een woord; ze mogen niet worden samengevoegd.

   EN EEN EERLIJKE BEPERKING: een multiDevice-passkey (een die met een iCloud- of
   Google-sleutelhanger meereist) dekt MEER dan een toestel. De sleutel is dan de
   sleutelhanger en niet het apparaat. Dat is geen fout in deze afleiding maar een
   eigenschap van passkeys, en het staat hier zodat niemand later denkt dat
   `apparaat` een fysiek toestel garandeert. */
'use strict';

const crypto = require('crypto');

const DOEL = 'isolatie-apparaat';

/* Geeft null als er geen credential is OF als de kluis nog geen geheim heeft.
   Null en geen verzinsel: een sleutel die uit niets is afgeleid, hangt aan
   niets, en een stand die aan niets hangt is erger dan geen stand. */
function sleutelUitCredential(credentialId, sleutelVoor) {
  const id = String(credentialId || '');
  if (!id) return null;
  const basis = typeof sleutelVoor === 'function' ? sleutelVoor(DOEL) : null;
  if (!basis) return null;
  return crypto.createHmac('sha256', basis).update(id).digest('hex').slice(0, 32);
}

module.exports = { sleutelUitCredential, DOEL };
