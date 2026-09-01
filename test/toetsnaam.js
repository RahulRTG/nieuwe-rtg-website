/* ============================================================================
   WELKE TOETS IS ER AAN HET WOORD? -- de testidentiteit als runtime-context.

   WAAROM DIT ER IS

   Het routejournaal schrijft `TOETS METHODE /pad <naam>` en het schermjournaal
   `SCHERM /pad <naam>`. Die naam kwam uit RTG_TOETS, en RTG_TOETS werd op EEN
   plek gezet: test/helper.js, op het moment dat die helper een kindserver
   startte. Dat dekt 868 van de 1434 toetsbestanden. De rest start zijn server
   op een andere manier (scripts/lib/proefserver.js, een eigen spawn) of draait
   helemaal in het proces -- en die schreven hun sporen weg als `onbekend`.

   Dat is precies het verschil tussen "deze toets raakt niets aan" en "niemand
   heeft gekeken", en die twee mogen nooit door elkaar lopen: een impactplan dat
   ze verwart, slaat een toets over omdat de meting ontbrak. De attributie hoort
   dus niet bij een helper te hangen maar bij de UITVOERING van een toets.

   ---- WELK PROCES MAG ZICHZELF EEN NAAM GEVEN? ----

   Dit is de plek waar deze module een keer stil fout is geweest, dus staat het
   hier uitgeschreven. `node --test a.js b.js` levert DRIE soorten processen op,
   en ze zien er van binnen bijna hetzelfde uit:

     de regelaar   argv[1] = a.js (het EERSTE patroon), NODE_TEST_CONTEXT leeg
     elk kind      argv[1] = zijn eigen bestand,        NODE_TEST_CONTEXT gezet
     een kleinkind argv[1] = server.js of een script,   NODE_TEST_CONTEXT geerfd

   De eerste versie keek alleen naar argv[1] en zette RTG_TOETS als hij nog leeg
   was. Daardoor gaf de REGELAAR zichzelf de naam van het eerste bestand van de
   scherf -- en omdat de kinderen zijn omgeving erven, zag elk kind die naam al
   staan en liet hem staan. Gemeten met `node --test pasladder delen`: het kind
   dat delen.test.js draaide meldde zich als pasladder.test.js. Een hele scherf
   sporen op naam van een bestand dat er niets mee te maken had, en het
   attributieregister zou dat als GEMETEN hebben opgeschreven.

   Daarom:
     - een KIND met een toetsbestand als argv[1] zet zijn eigen naam, en
       overschrijft daarbij wat hij van de regelaar heeft geerfd;
     - een los gedraaid toetsbestand (`node test/foo.test.js`, geen --test) ook;
     - de REGELAAR zwijgt -- hij draait geen toets, hij verdeelt ze;
     - een KLEINKIND (een server, een script) zwijgt ook en houdt wat hij erfde.
       Dat is juist de bedoeling: die server werkt namens die toets.

   EEN PLEK, EN DEZE. Zetten in helper.js blijft staan waar het staat; het is nu
   de terugval in plaats van de bron, en het levert dezelfde waarde.
   ========================================================================== */
'use strict';

const TOETSBESTAND = /(?:^|[\\/])([^\\/]+\.(?:test|e2e)\.js)$/;

/* Draait DIT proces een toetsbestand, of verdeelt het er alleen? */
function ikDraaiDeToets(argv1, env, execArgv) {
  const m = TOETSBESTAND.exec(String(argv1 || ''));
  if (!m) return null;
  if (env.NODE_TEST_CONTEXT) return m[1];              // een kind van de runner
  if ((execArgv || []).includes('--test')) return null; // de regelaar zelf
  return m[1];                                         // los gedraaid bestand
}

const mij = ikDraaiDeToets(process.argv[1], process.env, process.execArgv);
if (mij) process.env.RTG_TOETS = mij;

/* ---- EN HOE LANG HIJ EROVER DEED ----

   De scherfverdeling weegt op duur (scripts/lib/delen.js) en heeft daarvoor een
   meting per TOETSBESTAND nodig. Die is nergens anders te halen: `node --test`
   draait een hele groep in een aanroep en zijn TAP-uitvoer noemt het bestand
   niet -- alleen de losse beweringen erin. Wie de duur uit die stroom probeert
   af te leiden, gokt. Hier is hij gratis: dit proces IS het toetsbestand, dus
   zijn eigen looptijd is precies de gevraagde grootheid.

   Alleen het proces dat de toets ECHT draait schrijft. De regelaar zou anders
   de duur van de hele scherf op naam van het eerste bestand zetten, en dat is
   geen gewicht maar een leugen die de verdeling scheeftrekt.

   OPT-IN via RTG_TOETSDUUR, want een meting hoort geen bijwerking te zijn.
   O_APPEND, want meerdere toetsprocessen schrijven tegelijk -- net als het
   routejournaal. Een verminkte regel laat een bestand ONGEMETEN, en dat is de
   veilige kant: ongemeten valt in delen.js terug op de tellingverdeling in
   plaats van op een verzonnen gewicht. En nooit een ronde laten zakken: een
   kapotte schrijfactie is een tekort van de meting, geen fout in de code. */
if (mij && process.env.RTG_TOETSDUUR) {
  const begonnen = Date.now();
  process.on('exit', () => {
    try {
      require('fs').appendFileSync(process.env.RTG_TOETSDUUR,
        mij + '\t' + (Date.now() - begonnen) + '\n');
    } catch (e) { /* een meting mag nooit een toets omgooien */ }
  });
}

module.exports = { TOETSBESTAND, ikDraaiDeToets };
