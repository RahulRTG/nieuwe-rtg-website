/* RESETCONTRACT: server/db/voorcheck.js -- fase C van de verificatie-runtime.

   647 serverstarts kosten een derde van alle toetstijd. Hergebruik mag pas als
   van elke muteerbare wortel BEWEZEN is dat hij terug kan naar zijn beginstand;
   een gedeelde server die lekt geeft geen fout maar een verkeerd antwoord.
   STATE.json noemt de vier wortels van deze module `herstelbaar` met
   terugNaarVers() als reset, scripts/staat.js leest die belofte na in de bron,
   en dit bestand is het gedragsbewijs erbij.

   Draai los: node --experimental-sqlite --test test/resetcontract-voorcheck.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const wacht = ms => new Promise(r => setTimeout(r, ms));
// Een collectie die zeker boven RTG_SQLITE_GROOT_BYTES uitkomt.
function grootBlok(n) {
  const uit = {};
  for (let i = 0; i < n; i++) uit['t' + i] = { nr: i, gezien: 1000 + i, vul: 'x'.repeat(200) };
  return uit;
}

test('resetcontract: na terugNaarVers() antwoordt de module als een verse kopie', async () => {
  const oudMs = process.env.RTG_SQLITE_GROOT_MS;
  process.env.RTG_SQLITE_GROOT_MS = '60';
  try {
    /* TWEE ECHTE KOPIEEN van dezelfde module. `vers` wordt nooit aangeraakt en
       is dus per definitie de beginstand; `werk` wordt vuilgemaakt en gereset.
       Daarna moeten ze op ELKE invoer hetzelfde antwoorden. Dat is de eigenschap
       die hergebruik van een server veilig maakt, en hij is sterker dan "de
       maten zijn weg": een reset die er twee van de drie wist komt hier boven
       water, en dat deed hij ook -- de eerste versie van deze toets bleef groen
       bij een terugNaarVers() die alleen laatsteCheck leegde (LAT-regel 9). */
    const pad = require.resolve(path.join(WORTEL, 'server/db/voorcheck'));
    delete require.cache[pad]; const vers = require(pad);
    delete require.cache[pad]; const werk = require(pad);
    assert.notEqual(vers, werk, 'dit moeten twee losse kopieen zijn, anders vergelijkt de toets zichzelf');

    const waarde = grootBlok(4000);
    const bytes = werk.GROOT_BYTES + 1;
    /* Een batterij invoeren, met opzet ook vlak na nul: daar valt het verschil
       tussen "alles vergeten" en "alleen de laatste controle vergeten" op. */
    const invoeren = [];
    for (const k of ['sessions', 'saldi', 'iets']) {
      for (const nu of [1, 10, 59, 61, 1000, 5000]) {
        for (const force of [false, true]) invoeren.push([k, nu, force]);
      }
    }
    const antwoorden = (m) => invoeren.map(([k, nu, force]) => m.magOverslaan(k, waarde, force, nu));

    /* Eerst aantonen dat vuilmaken echt iets verandert -- anders is de
       vergelijking hieronder groen om de verkeerde reden. */
    const schoon = antwoorden(werk);
    assert.deepEqual(schoon, antwoorden(vers), 'twee verse kopieen horen gelijk te antwoorden');
    werk.onthoud('sessions', bytes, waarde, 5);
    werk.onthoud('iets', bytes, waarde, 5);
    assert.notDeepEqual(antwoorden(werk), schoon, 'de mutatie moet echt iets doen, anders bewijst de reset niets');

    werk.terugNaarVers();
    assert.deepEqual(antwoorden(werk), antwoorden(vers),
      'na terugNaarVers() hoort deze module op elke invoer te antwoorden als een kopie die nooit iets heeft gezien');

    /* WAT DEZE VERGELIJKING WEL EN NIET DEKT, want dat is nagemeten en niet
       aangenomen. Van de drie maten is alleen laatsteGrootte hier zichtbaar:
       magOverslaan() leest hem als EERSTE en kort af zodra hij leeg is, dus
       laatsteLengte en laatsteCheck komen er dan niet meer aan te pas. Twee
       mutaties bevestigden dat -- een terugNaarVers() die laatsteLengte laat
       staan, en een die laatsteCheck laat staan, bleven allebei groen.

       Die twee worden gedekt door de BRONPOORT: STATE.json noemt terugNaarVers()
       als hun reset, en scripts/staat.js leest die functie uit de bron en eist
       dat ze er alle vier in geschreven worden (zie dekking() daar). Haal
       laatsteLengte.clear() weg en test/staatregister.test.js zakt met de naam
       van die wortel erbij. Waarneembaar gedrag hier, onwaarneembare toestand
       daar -- samen dekken ze alle vier. */

    /* En de timer, die geen enkele vergelijking van antwoorden laat zien.
       vergeet(k) in een lus wist alle maten en laat hem staan; hij vuurt daarna
       alsnog met de save-functie van de VORIGE eigenaar in de hand. In een
       gedeelde server is dat een schrijfactie van de ene toets die tijdens de
       volgende landt: geen fout, een verkeerd antwoord. */
    const gedraaid = [];
    werk.onthoud('sessions', bytes, waarde, 5);
    werk.planNaronde(() => gedraaid.push('vorige eigenaar'));
    werk.terugNaarVers();
    werk.planNaronde(() => gedraaid.push('nieuwe eigenaar'));
    await wacht(werk.GROOT_MS + 120);
    assert.deepEqual(gedraaid, ['nieuwe eigenaar'],
      'de naronde van voor de reset hoort afgezegd te zijn en die van erna hoort te vuren');

    werk.terugNaarVers(); vers.terugNaarVers();
  } finally {
    if (oudMs === undefined) delete process.env.RTG_SQLITE_GROOT_MS; else process.env.RTG_SQLITE_GROOT_MS = oudMs;
  }
});

