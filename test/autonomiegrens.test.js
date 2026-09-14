/* DE AUTONOMIEGRENS: wat Rahul mag uitvoeren, moet VOORAF te beoordelen zijn.

   ONDERNEMERBEWIJS.json legde een bevinding bloot die geen meetachterstand is
   maar een architectuurvraag: 418 ondernemer-routes (732 huisbreed) hebben geen
   machineleesbare bewakingsgrens -- hun autorisatie zit IN de handler, bij 235
   ervan als een capability-token dat pas tijdens de uitvoering wordt gewogen.
   ROLPROEF.json kan daar niets over zeggen, en dat ziet er in elke telling
   precies hetzelfde uit als "nog niet gemeten".

   Voor een gewoon verzoek is dat werkbaar: een mens drukt op de knop, de
   handler weigert, de mens ziet de reden. Voor een AUTONOME aanroep is het
   fundamenteel te laat. De bewijslaag die bepaalt of iets veilig uitvoerbaar is
   (kern/stuur/beleid.js, dat een capability zonder bewijs uit de lijst laat
   vallen waaruit de AI kiest) moet dat VOOR de uitvoering kunnen vaststellen.
   Een grens die je pas kent nadat je hem bent overgegaan, is geen grens.

   DE REGEL, en hij is met opzet smal: een capability die AUTONOOM gebruikt mag
   worden, moet een machineleesbare bewakingsgrens vóór uitvoering hebben. Niet
   "alle 732 routes moeten om" -- dat zou 235 handlers verbouwen voor een
   risico dat de meeste ervan niet lopen. Migratie wordt alleen afgedwongen waar
   hij waarde heeft: op het snijvlak van de twee lijsten.

   WAAROM NU EN NIET LATER. De overtreding is vandaag NUL: 173 paden zijn voor
   de AI bereikbaar en geen daarvan is blind. Dat is geen geruststelling maar
   een tijdvenster -- precies de formulering die EXECUTIE.md gebruikt voor de
   kruising die er nog niet is. Een regel invoeren die vandaag niets kost, is
   de enige manier om hem ooit zonder ruzie te handhaven.

   Draai los: node --test test/autonomiegrens.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const lees = (n) => JSON.parse(fs.readFileSync(path.join(WORTEL, n), 'utf8'));

/* De twee lijsten, elk uit zijn eigen register. Geen tweede parser: beide
   registers worden gelezen zoals ze zijn opgeschreven. */
function blindePaden(rolproef) {
  const uit = new Set();
  for (const groep of (rolproef.redenenNietBeproefbaar || []))
    for (const sleutel of (groep.routes || []))
      uit.add(sleutel.slice(sleutel.indexOf(' ') + 1));
  return uit;
}
function autonomePaden(kaart) {
  const uit = new Set();
  for (const c of (kaart.capabilities || [])) {
    const b = c.bereik;
    /* `bereik` heeft twee vormen: een kale string (alle rollen gelijk) en een
       map per rol. Alleen de eerste lezen zou 173 paden onzichtbaar maken --
       dezelfde faalvorm als de stempel in scripts/ondernemerbewijs.js. */
    const waarden = typeof b === 'string' ? [b] : (b && typeof b === 'object' ? Object.values(b) : []);
    if (waarden.some(v => v && v !== 'verboden')) uit.add(c.pad);
  }
  return uit;
}
const snijvlak = (kaart, rolproef) => {
  const blind = blindePaden(rolproef);
  return [...autonomePaden(kaart)].filter(p => blind.has(p));
};

test('1. de twee lijsten zijn niet leeg -- anders bewijst deze toets niets', () => {
  const kaart = lees('EXECUTION_MAP.json');
  const rolproef = lees('ROLPROEF.json');
  const autonoom = autonomePaden(kaart);
  const blind = blindePaden(rolproef);
  /* Zonder deze toets zou een leeg register de grens stilzwijgend opheffen: nul
     autonome paden geeft nul overtredingen, en dat leest als "in orde". */
  assert.ok(autonoom.size > 0, 'geen enkel AI-bereikbaar pad gevonden -- leest EXECUTION_MAP.json nog goed?');
  assert.ok(blind.size > 0, 'geen enkel blind pad gevonden -- leest ROLPROEF.json nog goed?');
});

test('2. geen autonoom pad zonder machineleesbare bewakingsgrens', () => {
  const over = snijvlak(lees('EXECUTION_MAP.json'), lees('ROLPROEF.json'));
  assert.deepEqual(over, [],
    'Deze paden mogen autonoom worden aangeroepen terwijl hun autorisatie pas IN de handler blijkt, ' +
    'dus de bewijslaag kan vooraf niet vaststellen of het veilig is:\n  ' + over.join('\n  ') +
    '\nOfwel de route krijgt een bewakerslaag, ofwel hij gaat uit de AI-lijst van kern/stuur/beleid.js.');
});

test('3. TEGENPROEF -- de grens zakt zodra een blind pad autonoom wordt', () => {
  /* Een grens die je nooit hebt zien afgaan, bewaakt niets (LAT-regel 11).
     Hier wordt een blind pad met de hand in de autonome lijst gezet; de
     snijvlakberekening hoort hem dan te noemen. De registers op schijf worden
     niet aangeraakt -- de mutatie leeft alleen in dit geheugen. */
  const rolproef = lees('ROLPROEF.json');
  const blind = [...blindePaden(rolproef)];
  assert.ok(blind.length, 'geen blind pad om mee te muteren');
  const kaart = lees('EXECUTION_MAP.json');
  kaart.capabilities.push({ pad: blind[0], rol: 'member', bereik: { member: 'klein' } });
  const over = snijvlak(kaart, rolproef);
  assert.ok(over.includes(blind[0]),
    'de grens merkte niet op dat een blind pad autonoom werd gemaakt -- dan bewaakt hij niets');
});

test('4. de regel staat opgeschreven waar hij gehandhaafd wordt', () => {
  /* De vorige drie toetsen dwingen het GEDRAG af. Deze dwingt af dat de REDEN
     erbij staat: een grens waarvan niemand de reden kan vinden, wordt bij de
     eerste botsing weggeschreven als gedoe. */
  const eigen = fs.readFileSync(__filename, 'utf8');
  assert.match(eigen, /machineleesbare bewakingsgrens vóór uitvoering/,
    'de regel zelf hoort in dit bestand te staan, in één zin');
});
