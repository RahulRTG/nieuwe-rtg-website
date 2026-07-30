/* Beheer van de identiteitskluis: stand opnemen, migreren en de sleutel roteren.

   De kluis versleutelt naam, e-mail, telefoon en het ledendossier. Twee dingen
   horen daarbij die je moet kunnen zien en kunnen doen:

   1. CONTEXT-BINDING. Een blob zonder binding kan met databasetoegang verplaatst
      worden naar een andere rij of kolom -- en dan leest het huis een echte naam
      bij de verkeerde codenaam. Sinds server/accounts/gebonden.js gaat de plek
      (tabel, kolom, rij-id) als AAD mee, dus verplaatsen levert niets meer op.
   2. SLEUTELROTATIE. Een gecompromitteerde sleutel moet te vervangen zijn zonder
      de gegevens te verliezen. De kluis houdt daarvoor een keyring: zegelen gaat
      met de nieuwste sleutel, lezen probeert ze allemaal.

   Bestaande rijen migreren automatisch bij hun eerstvolgende schrijfactie. Dit
   script doet het actief, zodat je het niet hoeft af te wachten en kunt AANTONEN
   dat de kluis rond is.

   Draai:
     npm run kluisbeheer               stand opnemen (verandert niets)
     npm run kluisbeheer -- --migreer  herzegel alles wat nog werk nodig heeft
     npm run kluisbeheer -- --roteer   verse sleutel erbij en alles hersleutelen

   Veilig om vaker te draaien: rijen die al klaar zijn worden overgeslagen, en een
   rij die niet opengaat blijft met opzet staan (migreren mag nooit gegevens
   vernietigen). Maak eerst een kopie van server/data als je nerveus bent.

   Let op bij rotatie: de nieuwe sleutel komt in server/data/vault.ring te staan.
   Bij meerdere instances moet die ring op ELKE instance gelijk zijn -- zet hem daar
   dus ook (RTG_VAULT_RING, komma-gescheiden hex, nieuwste eerst), net als
   RTG_VAULT_KEY. Zonder de ring kan een andere instance de verse blobs niet lezen.
   De zoek-hashes op e-mail en telefoon roteren NIET mee; die blijven op de
   oorspronkelijke sleutel, anders kan niemand meer op zijn e-mailadres inloggen. */
const accounts = require('../server/accounts');
accounts.init();
const S = require('../server/accounts/state');
const gebonden = require('../server/accounts/gebonden');
const onderhoud = require('../server/accounts/onderhoud');
const mirror = require('../server/accounts/mirror');

const migreren = process.argv.includes('--migreer');
const roteren = process.argv.includes('--roteer');

function toon(label, s) {
  console.log('  ' + label.padEnd(8) + s.rijen + ' rijen | ' + s.gebonden + ' gebonden, ' +
    s.ongebonden + ' ongebonden, ' + s.onleesbaar + ' onleesbaar | ' +
    s.oudeSleutel + ' op een oude sleutel | ' + s.sleutels + ' sleutel(s) in de ring');
}

function waarschuwOnleesbaar(s) {
  if (!s.onleesbaar) return false;
  console.log('\n  LET OP: ' + s.onleesbaar + ' rij(en) gaan met GEEN enkele sleutel open.');
  console.log('  Dat is geen migratieachterstand maar een signaal: een ontbrekende sleutel uit');
  console.log('  de ring, of een blob die iemand heeft verplaatst. Ze zijn NIET aangeraakt.');
  console.log('  Zoek dat eerst uit voordat je verder gaat.');
  return true;
}

console.log('\nIdentiteitskluis (' + gebonden.KOLOMMEN.join(', ') + ')\n');
const voor = onderhoud.stand(S.db);
toon('nu:', voor);

if (!migreren && !roteren) {
  const stuk = waarschuwOnleesbaar(voor);
  if (voor.ongebonden > 0) {
    console.log('\n  ' + voor.ongebonden + ' rij(en) staan nog ongebonden: leesbaar en werkend, maar hun');
    console.log('  blobs zijn nog verplaatsbaar. Draai `npm run kluisbeheer -- --migreer`.');
  }
  if (voor.oudeSleutel > 0) {
    console.log('\n  ' + voor.oudeSleutel + ' rij(en) staan nog op een oudere sleutel uit de ring.');
    console.log('  Draai `npm run kluisbeheer -- --migreer` om de rotatie af te maken.');
  }
  if (!stuk && !voor.ongebonden && !voor.oudeSleutel) {
    console.log('\n  De kluis is rond: elke gevulde kolom is gebonden en staat op de actieve sleutel.');
  }
  process.exit(stuk ? 1 : 0);
}

let uitslag;
if (roteren) {
  console.log('\n  roteren: verse sleutel erbij, ring naar schijf, dan hersleutelen...');
  uitslag = onderhoud.roteer(S.db, { schrijfRing: accounts.schrijfKluisRing, markeer: mirror.markUser });
  console.log('  ring staat op ' + uitslag.sleutels + ' sleutel(s) in ' + accounts.RING_FILE);
} else {
  console.log('\n  migreren...');
  uitslag = onderhoud.migreer(S.db, mirror.markUser);
}
console.log('  ' + uitslag.rijen + ' rij(en) herzegeld, ' + uitslag.kolommen + ' kolom(men) bijgewerkt.\n');

const na = onderhoud.stand(S.db);
toon('na:', na);
const stuk = waarschuwOnleesbaar(na);
if (na.ongebonden || na.oudeSleutel) {
  console.log('\n  Er staat nog werk open (' + na.ongebonden + ' ongebonden, ' + na.oudeSleutel + ' op een oude sleutel).');
  process.exit(1);
}
if (stuk) process.exit(1);
console.log('\n  Klaar: de kluis is rond.\n');
