/* WANNEER MAG DE WERELD GAAN LIEGEN? -- de opstartfase van de verraadsmotor.

   server/lib/verraad.js zegt WAT er wordt nagebootst; dit zegt VANAF WANNEER.
   Dat is een eigen vraag met een eigen antwoord, en hij hoort niet in de motor
   en niet in save(): allebei die bestanden zaten op hun omvangsgrens, en het is
   ook inhoudelijk een derde ding.

   HET PROBLEEM. `schrijf-faalt` laat save() gooien. De opstart schrijft ook --
   zaaien, migraties -- dus met dat verraad aan komt de server niet op: dood na
   409 ms, gemeten, terwijl diezelfde server zonder verraad in 5,7 seconde
   staat. Een proef die al zijn routes moet rijden (scripts/faalproef.js) meet
   dan NIETS. scripts/ketenronde.js draaide er wel mee, omdat een stervende
   server daar een geldige uitkomst is; voor een routeronde is hij fataal.

   DE POORT STAAT OP DE AANROEPPLEK (server/db/index.js save()), en dat is met
   opzet drie keer:

     NIET in verraad.sla(). test/verraad.test.js roept die rechtstreeks aan,
     buiten elke server. Een poort in de motor zou die toetsen in hun geheel op
     false zetten -- dan meet de motortoets de poort en niet de motor.

     NIET op de verzoekcontext. Dat werkt ook (de server komt dan op), maar het
     zet de sabotage stilletjes uit voor elke ACHTERGRONDschrijver: de
     onderhoudsronde, de back-up, de wekkers. Dat is dekking inleveren zonder
     dat iemand het ziet, en stil verlies is precies wat deze motor moet vinden.
     De opstartfase is smaller: na `listen` gedraagt alles zich weer als eerst.

     EN HIJ TELT WAT HIJ OVERSLAAT. Een poort die per ongeluk nooit opengaat,
     laat elke ronde groen melden over een sabotage die nooit heeft toegeslagen
     -- de ergste faalvorm van deze hele opzet, want hij ziet eruit als bewijs.
     Daarom is `overgeslagen` geen intern detail maar een uitleesbaar getal.

   WIE ZET HEM OM: server/opzet/start.js, op de 'listening'-gebeurtenis van de
   server. Niet vlak na de aanroep van luister() -- die keert terug zodra
   app.listen is AANGEROEPEN en niet zodra hij luistert.

   EN WAAROM sla() HIER OOK STAAT. De poort zou anders op elke aanroepplek
   herhaald moeten worden, en de volgende die er een bijzet vergeet hem. Zo is
   er een verschil met betekenis: `verraad.sla` is de kale motor (dat is wat
   test/verraad.test.js meet), `verraadfase.sla` is de motor achter de poort
   (dat is wat de server gebruikt). */
'use strict';

const verraad = require('./verraad');

let verkeerAan = false;
let overgeslagen = 0;

/* De server luistert; vanaf nu telt het verraad. Idempotent: een tweede
   aanroep verandert niets, zodat een herstart-pad hem gerust nog eens zet. */
function zetVerkeerAan() { verkeerAan = true; }

/* Slaat dit verraad NU toe? Tijdens de opstart nooit -- en dan telt hij de
   overslag mee, maar alleen als er uberhaupt iets aanstond: anders telt een
   gewone start mee als onderdrukte sabotage. */
function sla(naam) {
  if (verkeerAan) return verraad.sla(naam);
  if (verraad.ietsAan()) overgeslagen++;
  return false;
}

const stand = () => ({ verkeerAan, overgeslagen });

module.exports = { zetVerkeerAan, sla, stand };
