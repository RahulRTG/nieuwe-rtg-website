/* De context-binding van de identiteitskluis: stand opnemen en migreren.

   De kluis versleutelt naam, e-mail, telefoon en het ledendossier al, maar een
   blob zonder binding kan met databasetoegang VERPLAATST worden naar een andere
   rij of kolom -- en dan leest het huis een echte naam bij de verkeerde codenaam.
   Sinds server/accounts/gebonden.js gaat de plek (tabel, kolom, rij-id) als AAD
   mee in de authenticatie, dus verplaatsen levert niets meer op.

   Bestaande rijen migreren automatisch bij hun eerstvolgende schrijfactie. Dit
   script doet het actief, zodat je het niet hoeft af te wachten en na de migratie
   kunt AANTONEN dat de binding rond is.

   Draai:
     npm run kluisbinding              stand opnemen (verandert niets)
     npm run kluisbinding -- --migreer alles herzegelen dat nog ongebonden is

   Veilig om vaker te draaien: al gebonden rijen worden overgeslagen, en een rij
   die niet opengaat blijft met opzet staan (migreren mag nooit gegevens
   vernietigen). Maak eerst een kopie van server/data als je nerveus bent. */
const accounts = require('../server/accounts');
accounts.init();
const S = require('../server/accounts/state');
const gebonden = require('../server/accounts/gebonden');
const mirror = require('../server/accounts/mirror');

const migreren = process.argv.includes('--migreer');

function toon(label, s) {
  console.log('  ' + label.padEnd(14) + s.rijen + ' rijen, ' + s.gebonden + ' gebonden, ' + s.ongebonden + ' ongebonden');
}

console.log('\nContext-binding van de identiteitskluis (' + gebonden.KOLOMMEN.join(', ') + ')\n');
const voor = gebonden.stand(S.db);
toon('nu:', voor);

if (!migreren) {
  if (voor.ongebonden > 0) {
    console.log('\n  ' + voor.ongebonden + ' rij(en) staan nog ongebonden. Die zijn leesbaar en werken gewoon,');
    console.log('  maar hun blobs zijn nog verplaatsbaar. Draai `npm run kluisbinding -- --migreer`');
    console.log('  om ze nu te herzegelen (of laat ze bij hun eerstvolgende schrijfactie meegaan).');
  } else {
    console.log('\n  De binding is rond: elke gevulde kluiskolom is aan haar rij gebonden.');
  }
  process.exit(0);
}

console.log('\n  migreren...');
const uitslag = gebonden.migreer(S.db, mirror.markUser);
console.log('  ' + uitslag.rijen + ' rij(en) herzegeld, ' + uitslag.kolommen + ' kolom(men) gebonden.\n');
const na = gebonden.stand(S.db);
toon('na:', na);

if (na.ongebonden > 0) {
  console.log('\n  LET OP: ' + na.ongebonden + ' rij(en) bleven ongebonden. Dat betekent dat hun waarde niet');
  console.log('  te ontsleutelen was (verkeerde of oudere VAULT-sleutel). Ze zijn NIET aangeraakt;');
  console.log('  zoek eerst uit met welke sleutel ze zijn geschreven voordat je verder gaat.');
  process.exit(1);
}
console.log('\n  Klaar: de binding is rond.\n');
