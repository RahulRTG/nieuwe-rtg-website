/* ELKE INGELOGDE SESSIE, voor de paar routes die bij IEDER scherm horen
   (eigenaarsbesluit 19 oktober 2026: gebruiken vraagt een account).

   De app-gids achter het ?-knopje en de publieke pushsleutel worden gebruikt
   door de leden-app, de partner-app, het kantoor en de Foundation-schermen.
   `auth` laat alleen leden door; deze vraag laat elke sessie door die het huis
   zelf kent:

     - een account (lid, ook gratis), of een zaak- of kantoorsessie (`role`),
       via dezelfde resolveSession als auth -- in de demo ook een persona;
     - een gezinsprofiel met code en token in het lijf, en dan alleen uit een
       gezin dat aan het account van een ouder hangt (rtf.verifieerProfiel,
       foundation/accountplicht.js).

   Zonder een van die twee: 401.

   Een VRAAG en geen middleware, met opzet: de bewakerskaart
   (scripts/lib/bewakers.js) kruist rollen, en een deur die lid, zaak EN kantoor
   doorlaat zou daar als lek tellen. De handler stelt de vraag en antwoordt zelf
   401 -- een poort in de handler, zoals check.js regel 28 die kent. */
'use strict';

const testomgeving = require('../testomgeving');

function magSessie(req, { resolveSession, rtf }) {
  const kop = (req.get && req.get('authorization')) || '';
  const token = kop.startsWith('Bearer ') ? kop.slice(7) : null;
  const s = token && typeof resolveSession === 'function' ? resolveSession(token) : null;
  if (s && (s.account || s.role || testomgeving.actief(process.env))) return true;
  const b = req.body || {};
  return !!(rtf && b.code && b.token && rtf.verifieerProfiel(b.code, b.token));
}

const NIET_INGELOGD = Object.freeze({ error: 'Niet ingelogd.', accountNodig: true });

module.exports = { magSessie, NIET_INGELOGD };
