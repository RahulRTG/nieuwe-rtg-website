/* Accounts, deel "onderhoud": het beheer van de identiteitskluis.

   ./gebonden doet de crypto (zegelen en gebonden lezen). Dit deel doet wat je
   ERMEE moet kunnen: rijen herzegelen, een bestaande installatie migreren, de
   stand opnemen, en de kluissleutel roteren.

   Afgesplitst omdat het een ander onderwerp is dan de binding zelf -- en omdat
   ./gebonden er anders over de 10 KB van keuringsregel 13 heen ging. */
const crypto = require('crypto');
const S = require('./state');
const g = require('./gebonden');

const TABEL = g.TABEL;
const KOLOMMEN = g.KOLOMMEN;

/* WAAROM HIER GEEN S.zin() STAAT.
   De rest van de accounts-laag haalt zijn statements uit de zinnencache in
   ./state, omdat prepare op het warme pad bijna een tiende van de rekentijd
   kostte. Dit bestand doet daar bewust niet aan mee, om twee redenen:

   1. de SQL wordt hier SAMENGESTELD. Regel 47 bouwt de SET-lijst uit de kolommen
      die deze rij toevallig nodig heeft: dat zijn 2^n verschillende zinnen. Een
      cache op de tekst zou daar ongemerkt vol mee lopen, en een cache die groeit
      met je gegevens is een lek met een nette naam.
   2. dit is geen warm pad. Migreren, de stand opnemen en roteren gebeuren met de
      hand of bij het opstarten, een keer per rij, niet per verzoek. Er valt hier
      niets te winnen dat de eerste reden waard is.

   De statements die WEL constant zijn (regel 59: 'SELECT id FROM ' + TABEL)
   zouden veilig te cachen zijn, maar dan zou dit bestand twee regels volgen in
   plaats van een, en dat is de duurdere fout. */
function haalRij(db, id) {
  return db.prepare('SELECT id, ' + KOLOMMEN.join(', ') + ' FROM ' + TABEL + ' WHERE id = ?').get(id);
}

/* Herzegel alle kluiskolommen van een rij, gebonden aan haar id en met de ACTIEVE
   sleutel. Drie rollen:

   1. na een INSERT, want dan is het id pas bekend (SQLite deelt het uit). Tussen
      de INSERT en dit moment staat de rij er ongebonden -- versleuteld, dus geen
      leesbare gegevens -- en een crash ertussen laat een leesbare rij achter die
      bij de eerstvolgende schrijfactie alsnog gebonden raakt. De terugvalweg voor
      oude vormen is hier dus ook de crash-veiligheid.
   2. als migratie voor bestaande, nog ongebonden rijen.
   3. na een sleutelrotatie, om een rij naar de nieuwe sleutel te tillen.

   Een kolom die niet opengaat laten we met opzet staan: herzegelen mag nooit
   gegevens vernietigen (dezelfde regel als de sleutelrotatie in de Rust-kluis).
   Geeft het aantal herzegelde kolommen terug. */
function herzegel(db, id) {
  const rij = haalRij(db, id);
  if (!rij) return 0;
  const zet = [], vals = [];
  for (const kolom of KOLOMMEN) {
    if (rij[kolom] == null) continue;
    const r = g.leesMet(kolom, rij);
    if (r == null) continue;                    // onleesbaar: niet aanraken
    if (r.gebonden && r.idx === 0) continue;    // al gebonden EN op de actieve sleutel
    zet.push(kolom + ' = ?');
    vals.push(g.zegel(kolom, id, r.tekst));
  }
  if (!zet.length) return 0;
  db.prepare('UPDATE ' + TABEL + ' SET ' + zet.join(', ') + ' WHERE id = ?').run(...vals, id);
  return zet.length;
}

/* Migreer de hele tabel: herzegel elke rij die nog werk nodig heeft. Veilig om
   vaker te draaien (een rij die al klaar is wordt overgeslagen).

   `markeer` is optioneel en krijgt elk gewijzigd id. In Postgres-modus hoort daar
   mirror.markUser in, anders blijft de spiegel op de oude blobs staan: die zijn
   nog wel leesbaar (oude vormen en oude sleutels blijven dat), maar dan is de
   binding daar niet rond en dat is precies wat je na een migratie wilt aantonen. */
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

/* De stand. Drie tellingen die je uit elkaar moet houden:

     gebonden     de rij zit aan zijn id vast (en `oudeSleutel` zegt of dat nog op
                  een pre-rotatie sleutel is)
     ongebonden   leesbaar, maar nog in een oude vorm -- herzegelen lost dat op
     onleesbaar   gaat met geen enkele sleutel open. Dat is GEEN migratieachterstand
                  maar een signaal: een verkeerde sleutel, of een blob die iemand
                  heeft verplaatst. Herzegelen raakt die rijen niet aan, dus ze
                  blijven staan tot iemand ernaar kijkt.

   Rijen zonder enkele kluiswaarde tellen niet mee; daar valt niets te binden. */
function stand(db) {
  const rijen = db.prepare('SELECT id, ' + KOLOMMEN.join(', ') + ' FROM ' + TABEL).all();
  let gebonden = 0, ongebonden = 0, onleesbaar = 0, oudeSleutel = 0;
  for (const r of rijen) {
    const gevuld = KOLOMMEN.filter(k => r[k] != null);
    if (!gevuld.length) continue;
    const gelezen = gevuld.map(k => g.leesMet(k, r));
    if (gelezen.some(x => x == null)) { onleesbaar++; continue; }
    if (!gelezen.every(x => x.gebonden)) { ongebonden++; continue; }
    gebonden++;
    if (gelezen.some(x => x.idx !== 0)) oudeSleutel++;
  }
  return { rijen: rijen.length, gebonden, ongebonden, onleesbaar, oudeSleutel, sleutels: g.ring().length };
}

/* ---------- sleutelrotatie ----------

   Een gecompromitteerde kluissleutel moet te vervangen zijn zonder de gegevens te
   verliezen en zonder downtime. Dat gaat zo:

     1. een verse sleutel VOORAAN in de ring (die wordt de actieve);
     2. de ring EERST duurzaam naar schijf, vóór er iets is hersleuteld -- zo wijst
        elk blob altijd naar een sleutel die op schijf staat, ook als het proces er
        middenin omvalt. Dezelfde ordening als motor/src/kluis.rs;
     3. daarna rij voor rij herzegelen naar de nieuwe sleutel.

   Crasht stap 3 halverwege, dan staat een deel op de nieuwe en een deel op de oude
   sleutel. Dat is niet erg: lezen probeert de hele ring, en opnieuw draaien maakt
   het af.

   Wat NIET meeroteert: de zoek-hashes op e-mail en telefoon. Die zijn een HMAC met
   de oorspronkelijke sleutel en staan als opzoeksleutel in de database. Zouden ze
   meebewegen, dan kon niemand meer op zijn e-mailadres inloggen -- en halverwege
   een rotatie zou de helft van de leden buitenstaan. Die sleutel blijft dus gepind
   (S.VAULT, zie ./state) en de rotatie raakt alleen de versleuteling. */
function roteer(db, { schrijfRing, markeer } = {}) {
  if (typeof schrijfRing !== 'function') {
    throw new Error('roteer heeft schrijfRing nodig: de ring moet eerst duurzaam op schijf.');
  }
  const nieuweRing = [crypto.randomBytes(32)].concat(g.ring());
  schrijfRing(nieuweRing);        // stap 2: eerst duurzaam, dan pas hersleutelen
  S.RING = nieuweRing;
  return Object.assign({ sleutels: nieuweRing.length }, migreer(db, markeer));
}

module.exports = { herzegel, migreer, stand, roteer };
