/* DE SLEUTELRING VAN HET BEARERCODE-V2-ZEGEL (./bearercode-zegel.js).

   Besluit van de eigenaar, 14 oktober 2026: het contract op een v2-record wordt
   een HMAC met een serversleutel die NIET in de betrokken database woont, met
   een sleutelversie (kid) voor gecontroleerde rotatie. Geen nieuwe laag: de
   ring leunt op wat het huis al heeft.

   WAAR DE SLEUTEL WOONT, gemeten op 14 oktober 2026:
   - De records zelf staan als JSON in de top-level collecties van db.data
     (db.json, rtg-SQLite of de PostgreSQL-collectietabel). Wie daar kan
     schrijven, kan een kale sha256 gewoon opnieuw uitrekenen.
   - RTG_SECRET_KEY (de tokenondertekening van server/accounts) MOET in
     productie uit de omgeving komen: server/config/productie.js blokkeert de
     start zonder, juist omdat het bestand secret.key naast de database zou
     staan. Dat is in dit huis het afzonderlijke beveiligingsdomein: de secrets
     manager, niet de datamap en niet de back-up van de database.
   - De standaardring is daarom EEN sleutel, met HKDF afgeleid uit diezelfde
     RTG_SECRET_KEY (zelfde HKDF-vorm als accounts/kluis.js afleidSleutel,
     label 'rtg-doel:bearercode-v2'), met dezelfde bron (lib/sleutelbestand.js
     uitOmgevingOfBestand) als server/accounts. Een afgeleide sleutel voert niet
     terug naar de sessiesleutel. Buiten productie is dat secret.key in de
     datamap -- daar is het dus GEEN apart domein, en dat geldt voor elke
     sleutel van een lokale installatie.
   - RTG_BEARER_RING geeft een EIGEN, afzonderlijk beheerde ring: komma-
     gescheiden, nieuwste eerst (zoals RTG_VAULT_RING), elk item `kid:<64 hex>`
     of het woord `geheim` voor de afgeleide sleutel hierboven. Het eerste item
     zegelt nieuwe records; de rest verifieert alleen. Een kid die uit de ring
     verdwijnt, opent niets meer.

   NOOIT STIL. Een ring die niet te lezen is (verkeerde vorm, dubbele kid, geen
   sleutel) is GEEN ring: dan faalt uitgifte en verificatie met
   `sleutel-ontbreekt`, en er wordt niets geraden. */
'use strict';
const crypto = require('node:crypto');
const path = require('node:path');

const ENV = 'RTG_BEARER_RING';
const KID = /^[a-z0-9][a-z0-9._-]{0,31}$/i;
const LABEL = 'bearercode-v2';

/* De afgeleide sleutel, en een kid die met de bron meeverandert: wie
   RTG_SECRET_KEY vervangt, krijgt een andere kid, en een oud record zegt dan
   `sleutel-ontbreekt` in plaats van `gemanipuleerd`. */
function uitGeheim(geheim) {
  const b = Buffer.isBuffer(geheim) ? geheim : Buffer.from(String(geheim || ''), 'utf8');
  if (!b.length) return null;
  const afleid = doel => Buffer.from(crypto.hkdfSync('sha256', b, Buffer.alloc(0), Buffer.from('rtg-doel:' + doel), 32));
  const k = afleid(LABEL), vinger = afleid(LABEL + '|kid');
  return { kid: 's-' + vinger.toString('hex').slice(0, 8), sleutel: k };
}

/* Tekst -> { actief, sleutels: Map(kid -> Buffer) } of { fout }. */
function leesRing(tekst, geheim) {
  const delen = String(tekst || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!delen.length) return { fout: ENV + ' is leeg' };
  const sleutels = new Map();
  for (const d of delen) {
    let kid, sleutel;
    if (d === 'geheim') {
      const g = geheim ? uitGeheim(geheim) : null;
      if (!g) return { fout: ENV + ' noemt `geheim`, maar er is geen RTG_SECRET_KEY' };
      ({ kid, sleutel } = g);
    } else {
      const m = /^([^:]+):([0-9a-fA-F]{64})$/.exec(d);
      if (!m || !KID.test(m[1])) return { fout: ENV + ': een item is `kid:<64 hex>` of `geheim`' };
      kid = m[1]; sleutel = Buffer.from(m[2], 'hex');
    }
    if (sleutels.has(kid)) return { fout: ENV + ': kid ' + kid + ' staat er dubbel in' };
    sleutels.set(kid, sleutel);
  }
  return { actief: [...sleutels.keys()][0], sleutels };
}

let cache = { sleutel: null, ring: null };
/* De ring van dit proces. Het geheim komt via dezelfde weg als in
   server/accounts (omgeving, anders secret.key in de datamap), zodat een
   server en zijn toetsen dezelfde sleutel dragen. */
function ring() {
  const env = process.env;
  const dataDir = env.RTG_DATA_DIR || path.join(__dirname, '..', 'data');
  const sleutel = [env[ENV] || '', env.RTG_SECRET_KEY || '', dataDir].join('\u0000');
  if (cache.sleutel === sleutel) return cache.ring;
  let geheim = null;
  try {
    geheim = require('../lib/sleutelbestand').uitOmgevingOfBestand(path.join(dataDir, 'secret.key'), 'RTG_SECRET_KEY');
  } catch (e) { geheim = null; }
  const r = leesRing(env[ENV] || 'geheim', geheim);
  cache = { sleutel, ring: r };
  return r;
}

module.exports = { ring, leesRing, uitGeheim, ENV, KID };
