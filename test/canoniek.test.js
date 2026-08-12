/* ZELFDE BETEKENIS, ANDERE BYTEVORM, ANDERE VEILIGHEIDSUITKOMST.

   DE FOUTKLASSE. Een security-beslissing vergelijkt een identiteit met iets
   bekends: dit token met de intreklijst, deze host met de metadata-adressen, dit
   pad met de webroot. Zo'n vergelijking kijkt naar BYTES. Bestaat er een tweede
   schrijfwijze met dezelfde betekenis, dan bestaat er een tweede uitkomst -- en
   die tweede is de gaatjesroute. De regel is daarom: breng een security-identiteit
   eerst tot EEN canonieke vorm, of weiger niet-canonieke vormen hard.

   Twee gevallen in dit huis, allebei echt gebeurd:

   1. HET SESSIETOKEN (test/tokenvorm.test.js). Buffer.from(x,'base64url')
      negeert tekens buiten het alfabet, dus ' <token>' decodeert naar dezelfde
      bytes en de handtekening klopt -- terwijl de intreklijst de rauwe string
      bewaart en hem niet herkent. Daar is gekozen voor de tweede helft van de
      regel: hard weigeren wat er niet exact uitziet zoals wij het uitgeven.

   2. HET METADATA-ADRES (deze toets). metadataDoel() en onveiligIpLiteral()
      normaliseerden allebei zelf, en liepen uiteen. De lichte poort
      veiligeWebhookUrl(url,{intern:true}) liet het cloud-metadata-endpoint door
      zodra je het als IPv4-mapped IPv6 opschreef. Hier is gekozen voor de eerste
      helft: EEN canonieke vorm, gedeeld door beide poorten.

   EN DE DERDE VORM, die de eerste reparatie niet dekte. new URL() comprimeert
   [::ffff:169.254.169.254] zelf tot [::ffff:a9fe:a9fe]. De functie was daarmee
   gerepareerd terwijl de poort erboven nog lek was, want de hostname die daar
   binnenkomt is al door de parser omgezet. Een canonieke vorm die de vorm van je
   eigen parser niet kent, is geen canonieke vorm -- vandaar dat deze toets zowel
   de functie als de poort aanvalt, en niet alleen de functie.

   Gemuteerd en zien zakken: de ::ffff-hexomzetting uit canoniekHost halen
   (toets 2 en 3 rood), het strippen van de sluitpunt weghalen (toets 1 rood),
   en canoniekHost in metadataDoel vervangen door de oude eigen normalisatie
   (toets 3 rood).
   Draai los: node --test test/canoniek.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const ssrf = require('../server/kern/ssrf.js');

/* Alle schrijfwijzen van het cloud-metadata-adres 169.254.169.254 die een
   parser, een mens of een aanvaller kan produceren. Ze betekenen allemaal
   hetzelfde, dus ze horen allemaal dezelfde uitkomst te geven. */
const METADATA = [
  '169.254.169.254',
  '169.254.169.254.',            // sluitpunt: in DNS dezelfde naam
  '::ffff:169.254.169.254',      // IPv4-mapped IPv6, puntvorm
  '[::ffff:169.254.169.254]',    // idem, met haken zoals in een URL
  '::ffff:a9fe:a9fe',            // idem, hexadecimaal -- wat new URL() ervan maakt
  '[::ffff:a9fe:a9fe]',
  '169.254.169.254'.toUpperCase() // hoofdletters raken cijfers niet, maar de vorm loopt wel langs dezelfde weg
];

test('elke schrijfwijze van hetzelfde adres krijgt dezelfde canonieke vorm', () => {
  for (const vorm of METADATA) {
    assert.equal(ssrf.canoniekHost(vorm), '169.254.169.254',
      vorm + ' hoort tot dezelfde canonieke vorm te worden teruggebracht');
  }
  // en een adres dat er niet op lijkt, verandert niet in iets dat er wel op lijkt
  assert.equal(ssrf.canoniekHost('8.8.8.8'), '8.8.8.8');
  assert.equal(ssrf.canoniekHost('[::1]'), '::1');
  assert.equal(ssrf.canoniekHost('voorbeeld.test'), 'voorbeeld.test');
});

test('metadataDoel ziet het adres in elke schrijfwijze', () => {
  for (const vorm of METADATA) {
    assert.equal(ssrf.metadataDoel(vorm), true,
      vorm + ' is het cloud-metadata-adres en hoort geblokkeerd te worden');
  }
  assert.equal(ssrf.metadataDoel('8.8.8.8'), false, 'een publiek adres blijft gewoon toegestaan');
  assert.equal(ssrf.metadataDoel('::ffff:8.8.8.8'), false, 'ook in mapped vorm');
});

/* DE ECHTE AANVAL, EEN LAAG HOGER. Niet de functie maar de poort: dit is het
   verzoek dat de server werkelijk zou uitvoeren. */
test('de lichte webhook-poort laat het metadata-endpoint in geen enkele vorm door', () => {
  for (const gastheer of ['169.254.169.254', '[::ffff:169.254.169.254]', '[::ffff:a9fe:a9fe]']) {
    const r = ssrf.veiligeWebhookUrl('http://' + gastheer + '/latest/meta-data/iam/security-credentials/', { intern: true });
    assert.equal(r.ok, false,
      'http://' + gastheer + '/ is het cloud-metadata-endpoint; die vorm mag er niet doorheen glippen');
  }
  // de poort blijft bruikbaar waarvoor hij bedoeld is: een interne sidecar mag wel
  assert.equal(ssrf.veiligeWebhookUrl('http://127.0.0.1:1025/hook', { intern: true }).ok, true,
    'een bewuste lokale collector-sidecar blijft toegestaan -- anders is dit geen lichte poort meer');
});

test('de strenge poort weigert het in elke vorm, en dat deed hij al', () => {
  for (const gastheer of ['169.254.169.254', '[::ffff:169.254.169.254]', '[::ffff:a9fe:a9fe]', '2852039166']) {
    assert.equal(ssrf.veiligeExternalUrl('http://' + gastheer + '/x').ok, false,
      gastheer + ' hoort door de strenge poort geweigerd te worden');
  }
});
