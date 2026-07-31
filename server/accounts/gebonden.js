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
   verplaatst en geven we niets terug. De oudere vormen gaan ongebonden open zolang
   ze nog niet zijn herzegeld.

   Het beheer (herzegelen, migreren, de stand, de sleutelrotatie) staat in
   ./onderhoud.js; dit bestand is alleen de crypto. */
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

/* De keyring: nieuwste sleutel eerst, de oorspronkelijke VAULT-sleutel achteraan.
   S.RING wordt bij init gezet; valt hij weg (oude aanroepvorm, een test die alleen
   state zet), dan is de ring simpelweg [VAULT]. */
function ring() {
  return (S.RING && S.RING.length) ? S.RING : [S.VAULT];
}

function openMet(sleutel, b64, aad) {
  try {
    const buf = Buffer.from(b64, 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', sleutel, buf.subarray(0, 12));
    if (aad) d.setAAD(aad);
    d.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
  } catch (e) { return null; }
}

/* Open een kaal base64-blob met de keyring. Geeft { tekst, idx } terug, waarbij
   idx de plek in de ring is: 0 = de actieve sleutel. null als geen sleutel de
   authenticatie haalt -- ook bij een verkeerde AAD, en dat is precies waar het
   hier om gaat.

   Proberen op volgorde in plaats van een versienummer in het blob: de AEAD zegt
   zelf of een sleutel klopt, dus een versiebyte zou alleen sneller zijn, geen
   veiliger. En het scheelt een derde blobformaat plus de migratie ernaartoe. */
function openRing(b64, aad) {
  const r = ring();
  for (let i = 0; i < r.length; i++) {
    const tekst = openMet(r[i], b64, aad);
    if (tekst != null) return { tekst, idx: i };
  }
  return null;
}

// alleen de tekst; voor de plekken die de sleutelversie niet hoeven te weten
function open(b64, aad) {
  const r = openRing(b64, aad);
  return r ? r.tekst : null;
}

/* Versleutel, gebonden aan (kolom, rij-id), met de ACTIEVE sleutel. Levert een
   RTGV2-waarde. */
function zegel(kolom, id, tekst) {
  if (tekst == null) return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', ring()[0], iv);
  c.setAAD(aadVan(kolom, id));
  const ct = Buffer.concat([c.update(String(tekst), 'utf8'), c.final()]);
  return MERK2 + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}

/* Lees een kluiskolom uit een rij. `rij` MOET het id bevatten, want dat is de
   helft van de context: selecteer id altijd mee. */
function lees(kolom, rij) {
  const r = leesMet(kolom, rij);
  return r ? r.tekst : null;
}

/* Zelfde als lees(), maar meldt ook HOE de waarde erin staat: `idx` is de plek in
   de keyring (0 = actieve sleutel, -1 = niet versleuteld) en `gebonden` of hij aan
   zijn rij vastzit. Herzegelen gebruikt dat om te zien wat er nog werk nodig heeft:
   ongebonden, of gebonden-maar-op-een-oude-sleutel. */
function leesMet(kolom, rij) {
  if (!rij) return null;
  const waarde = rij[kolom];
  if (waarde == null) return null;
  const s = String(waarde);
  if (s.startsWith(MERK2)) {
    const r = openRing(s.slice(MERK2.length), aadVan(kolom, rij.id));
    return r ? { tekst: r.tekst, idx: r.idx, gebonden: true } : null;
  }
  if (s.startsWith(MERK1)) {
    const r = openRing(s.slice(MERK1.length), null);
    return r ? { tekst: r.tekst, idx: r.idx, gebonden: false } : null;
  }
  const r = openRing(s, null);
  if (r) return { tekst: r.tekst, idx: r.idx, gebonden: false };
  // enc_: onleesbaar; anders nooit-versleutelde platte tekst
  return kolom.startsWith('enc_') ? null : { tekst: s, idx: -1, gebonden: false };
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
  zegel, lees, leesMet, KOLOMMEN, MERK1, MERK2, TABEL, ring,
  realNameOf, emailOf, phoneOf
};
