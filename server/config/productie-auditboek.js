/* Productiekeuring van het AUDITBOEK (server/kern/auditboek, AUDITBOEK.md).

   Het boek leeft in PostgreSQL; zijn bewijskracht komt van een anker BUITEN die
   database. Draait productie op PostgreSQL, dan is een boek zonder extern anker
   een boek dat zijn eigen beheerder niet kan tegenspreken -- dat is geen stand
   waarin de app mag starten. De regels:
     1  minstens twee write-once ankerbestemmingen (mappen of https-sinks), zodat
        een uitgevallen of vervalste sink niet het hele bewijs is;
     2  de PUBLIEKE ankersleutel staat in de repository (deploy/audit-anker.pub),
        zodat de app kan verifiëren zonder ooit te kunnen tekenen;
     3  de PRIVE-sleutel hoort NIET in het app-proces (alleen de ankerdienst
        tekent): staat hij toch in de omgeving van de app, dan blokkeert dat. */
'use strict';
const fs = require('fs');
const path = require('path');

function keurAuditboek(env, fouten, root = path.join(__dirname, '..', '..')) {
  if (!env.DATABASE_URL && !env.RTG_AUDIT_DATABASE_URL) return;
  const lijst = v => String(v || '').split(',').map(x => x.trim()).filter(Boolean);
  const aantal = lijst(env.RTG_AUDIT_ANKER_DIRS).length + lijst(env.RTG_AUDIT_ANKER_URLS).length;
  if (aantal < 2) fouten.push('Auditboek: minstens twee externe ankerbestemmingen vereist (RTG_AUDIT_ANKER_DIRS en/of RTG_AUDIT_ANKER_URLS); er zijn er ' + aantal + '. Een boek zonder extern anker bewijst niets tegen zijn eigen beheerder.');
  const pub = env.RTG_AUDIT_ANKER_PUBLIC_KEY_FILE || path.join(root, 'deploy', 'audit-anker.pub');
  try {
    const t = fs.readFileSync(pub, 'ascii');
    if (!/^-----BEGIN PUBLIC KEY-----/.test(t)) throw new Error();
  } catch (e) { fouten.push('Auditboek: de publieke ankersleutel ontbreekt of is ongeldig (' + path.basename(pub) + '); zie deploy/TRUST.md.'); }
  if (env.RTG_AUDIT_ANKER_SIGN_KEY) fouten.push('Auditboek: RTG_AUDIT_ANKER_SIGN_KEY staat in de omgeving van de app. Alleen de ankerdienst mag tekenen; een app die kan tekenen kan zijn eigen boek herschrijven en opnieuw verankeren.');
}
module.exports = { keurAuditboek };
