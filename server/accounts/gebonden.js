/* Accounts, deel "gebonden": de identiteitskluis met CONTEXT-BINDING.

   ./kluis versleutelt en authenticeert de INHOUD van een veld, maar zegt niets
   over waar die inhoud thuishoort. Wie de database kan bewerken kan een blob dus
   VERPLAATSEN: de versleutelde naam van lid A naar de naamkolom van lid B, of een
   e-mailblob naar de naamkolom. De AEAD merkt daar niets van -- het blob is
   immers ongeschonden -- en het huis leest daarna een echte naam bij de verkeerde
   codenaam. Dat is precies het scenario dat de scheiding tussen codenaam en kluis
   moet voorkomen; zonder binding is die scheiding papier.

   AES-GCM heeft er een veld voor: additional authenticated data. Die gaat mee in
   de authenticatie maar niet in de versleuteling. Wij zetten er de identiteit van
   de PLEK in: tabel, kolom en rij-id. Verplaatst iemand een blob naar een andere
   rij of kolom, dan klopt de AAD niet meer, faalt de authenticatie en komt er
   niets uit. De Rust-kluis (motor/src/kluis.rs) doet dit al met de codenaam als
   AAD; dit is dezelfde garantie aan de Node-kant, gebonden aan de rij-identiteit.

   Vier vormen leven naast elkaar, en dat is bewust -- een bestaande installatie
   moet leesbaar blijven en per rij meegroeien:

     RTGV2:<b64>   versleuteld EN gebonden aan (tabel, kolom, rij-id)   [nieuw]
     RTGV1:<b64>   versleuteld, ongebonden                    [oude member_state]
     <b64>         versleuteld, ongebonden        [oude enc_name/_email/_phone]
     platte tekst  nooit versleuteld geweest      [oudste member_state]

   Een RTGV2-waarde MOET met de juiste AAD opengaan; lukt dat niet, dan is er iets
   verplaatst en geven we niets terug. De oudere vormen gaan ongebonden open
   zolang ze nog niet zijn herzegeld -- `herzegel` doet dat per rij, en gebeurt
   ook automatisch bij de eerstvolgende schrijfactie. */
const crypto = require('crypto');
const S = require('./state');

const MERK1 = 'RTGV1:';   // zie ./kluis encVeld/decVeld
const MERK2 = 'RTGV2:';
const TABEL = 'users';

/* De kolommen van de kluis. `enc_`-kolommen zijn ALTIJD versleuteld; member_state
   mag in een oude database nog platte tekst zijn. Dat onderscheid bepaalt wat er
   gebeurt als ontsleutelen niet lukt: bij een enc_-kolom is dat een fout (null),
   bij member_state kan het gewoon nooit-versleutelde tekst zijn. */
const KOLOMMEN = ['enc_name', 'enc_email', 'enc_phone', 'member_state'];

function aadVan(kolom, id) {
  return Buffer.from('rtg-kluis-v2|' + TABEL + '|' + kolom + '|' + String(id), 'utf8');
}

/* Open een kaal base64-blob. null als de authenticatie faalt -- ook bij een
   verkeerde AAD, en dat is precies waar het hier om gaat. */
function open(b64, aad) {
  try {
    const buf = Buffer.from(b64, 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', S.VAULT, buf.subarray(0, 12));
    if (aad) d.setAAD(aad);
    d.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
  } catch (e) { return null; }
}

/* Versleutel, gebonden aan (kolom, rij-id). Levert een RTGV2-waarde. */
function zegel(kolom, id, tekst) {
  if (tekst == null) return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', S.VAULT, iv);
  c.setAAD(aadVan(kolom, id));
  const ct = Buffer.concat([c.update(String(tekst), 'utf8'), c.final()]);
  return MERK2 + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}

/* Lees een kluiskolom uit een rij. `rij` MOET het id bevatten, want dat is de
   helft van de context: selecteer id altijd mee. */
function lees(kolom, rij) {
  if (!rij) return null;
  const waarde = rij[kolom];
  if (waarde == null) return null;
  const s = String(waarde);
  if (s.startsWith(MERK2)) return open(s.slice(MERK2.length), aadVan(kolom, rij.id));
  if (s.startsWith(MERK1)) return open(s.slice(MERK1.length), null);
  const oud = open(s, null);
  if (oud != null) return oud;
  return kolom.startsWith('enc_') ? null : s; // enc_: onleesbaar; anders platte tekst
}

/* Herzegel alle kluiskolommen van een rij, gebonden aan haar id. Twee rollen:

   1. na een INSERT, want dan is het id pas bekend (SQLite deelt het uit). Tussen
      de INSERT en dit moment staat de rij er ongebonden -- versleuteld, dus geen
      leesbare gegevens -- en een crash ertussen laat een leesbare rij achter die
      bij de eerstvolgende schrijfactie alsnog gebonden raakt. De terugvalweg voor
      oude vormen is hier dus ook de crash-veiligheid.
   2. als migratie voor bestaande rijen, zonder dat er iets hoeft te wijzigen.

   Een kolom die niet opengaat laten we met opzet staan: herzegelen mag nooit
   gegevens vernietigen (dezelfde regel als de sleutelrotatie in de Rust-kluis).
   Geeft het aantal herzegelde kolommen terug. */
function herzegel(db, id) {
  const rij = db.prepare('SELECT id, ' + KOLOMMEN.join(', ') + ' FROM ' + TABEL + ' WHERE id = ?').get(id);
  if (!rij) return 0;
  const zet = [], vals = [];
  for (const kolom of KOLOMMEN) {
    if (rij[kolom] == null) continue;
    if (String(rij[kolom]).startsWith(MERK2)) continue;  // al gebonden
    const klaar = lees(kolom, rij);
    if (klaar == null) continue;                         // onleesbaar: niet aanraken
    zet.push(kolom + ' = ?');
    vals.push(zegel(kolom, id, klaar));
  }
  if (!zet.length) return 0;
  db.prepare('UPDATE ' + TABEL + ' SET ' + zet.join(', ') + ' WHERE id = ?').run(...vals, id);
  return zet.length;
}

/* Migreer de hele tabel: herzegel elke rij die nog niet gebonden is. Bedoeld om
   een bestaande installatie in een keer om te zetten, en veilig om vaker te
   draaien (een al gebonden rij slaat hij over).

   `markeer` is optioneel en krijgt elk gewijzigd id. In Postgres-modus hoort daar
   mirror.markUser in, anders blijft de spiegel op de oude blobs staan: die zijn
   nog wel leesbaar (ongebonden vormen blijven dat), maar dan is de binding daar
   niet rond en dat is precies wat je na een migratie wilt kunnen aantonen. */
function migreer(db, markeer) {
  const ids = db.prepare('SELECT id FROM ' + TABEL).all().map(r => r.id);
  let rijen = 0, kolommen = 0;
  for (const id of ids) {
    const n = herzegel(db, id);
    if (n) {
      rijen++; kolommen += n;
      if (typeof markeer === 'function') markeer(id);
    }
  }
  return { rijen, kolommen };
}

/* Hoeveel rijen zijn al gebonden? Voor het techniekbord en om na een migratie te
   kunnen zien dat de binding echt rond is. Rijen zonder enkele kluiswaarde tellen
   niet mee -- daar valt niets te binden. */
function stand(db) {
  const rijen = db.prepare('SELECT id, ' + KOLOMMEN.join(', ') + ' FROM ' + TABEL).all();
  let gebonden = 0, ongebonden = 0;
  for (const r of rijen) {
    const gevuld = KOLOMMEN.filter(k => r[k] != null);
    if (!gevuld.length) continue;
    if (gevuld.every(k => String(r[k]).startsWith(MERK2))) gebonden++;
    else ongebonden++;
  }
  return { rijen: rijen.length, gebonden, ongebonden };
}

/* De identiteitslezers. Ze horen hier omdat ze niets anders doen dan de kluis
   gebonden uitlezen; de rest van het huis vraagt ze via accounts.realNameOf() en
   hoeft van kolommen en binding niets te weten. realNameOf valt terug op de
   inlognaam zodat een weergave nooit leeg is -- een ontbrekende naam is geen fout
   maar een account dat er (nog) geen heeft. Een verplaatst blob levert hier dus
   de inlognaam op, niet de naam van iemand anders: dat is de hele bedoeling. */
function realNameOf(u) { return u ? (lees('enc_name', u) || u.username || 'Lid') : null; }
function emailOf(u) { return u ? lees('enc_email', u) : null; }
function phoneOf(u) { return u ? lees('enc_phone', u) : null; }

module.exports = {
  zegel, lees, herzegel, migreer, stand, KOLOMMEN, MERK2,
  realNameOf, emailOf, phoneOf
};
