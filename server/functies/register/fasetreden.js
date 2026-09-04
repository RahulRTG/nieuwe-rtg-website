/* WAT STAAT ER OPEN OP ELKE TREDE -- de inhoud, niet de ladder.

   Dit stond in ./fases.js, en dat bestand ging over de 10 kB toen main er twee
   gaten in de trap bij documenteerde (`ov-suppliers` en `ov-mail-binnen`). De
   naad die dat oplevert is een echte: hier staat WELKE functies er in een trede
   zitten en waarom, en in ./fases.js staat WELKE treden er zijn en of ze
   kloppen. Twee lijsten die om verschillende redenen veranderen -- de eerste als
   een functie van plek verandert, de tweede als er een trede bij komt.

   Draai los: node --test test/functieregister.test.js */
'use strict';

/* ============================================================================
   DE UITROLTRAP -- lanceren is een trede kiezen, niet tientallen schakelaars.

   Alles is gebouwd en staat klaar. Een livegang is daarom een SCOPEVRAAG: wat
   staat er open op dag een, en hoe wordt dat meer. Elke trede somt op wat er
   AAN staat; al het andere gaat dicht. Interne functies blijven altijd open,
   anders sluit de boardroom zichzelf buiten.

   DE TREDEN STAPELEN ECHT, en dat is hier een reparatie en geen ontwerpkeuze.
   Ze deden het namelijk niet. `fundament` en `stad` noemden de leden-app en de
   partnerkant, maar niet de VOORDEUR: tg-inlog, tg-account, tg-gegevens,
   kern-state. Wie op fase 1 klikte, zette daarmee /api/auth op 503 -- niemand
   kon meer inloggen, en de AVG-gegevenspoort ging mee dicht. Gemeten op een
   draaiende server, niet afgeleid: start gaf 200/200/200, fundament en stad
   gaven 503/503/503 op inloggen, /api/ik en /api/gegevens.

   De toets die er stond zag het niet, omdat hij na het omzetten een token
   gebruikte dat hij ERVOOR had opgehaald. Een bestaande sessie bleef werken;
   alleen nieuwe mensen kwamen niet meer binnen. Precies de fout waar de regel
   hieronder voor waarschuwt, maar dan een verdieping hoger: niet een id dat uit
   een lijst viel, maar een hele laag die nooit in een lijst stond.

   Daarom is FASE_VOORDEUR nu een eigen lijst die in ELKE trede zit, en bouwt
   elke trede op zijn voorganger met de spread. Een trede kan daardoor niet meer
   per ongeluk iets sluiten wat een trede eerder open zette.

   EEN REGISTERREGEL OPKNIPPEN RAAKT DEZE LIJST, en dat is een keer stil
   misgegaan. `betalen` dekte '/api/pay' en `supplier` dekte
   '/api/supplier/pay/uitbetaal'; toen die paden hun eigen regel kregen (om er
   een vermogen aan te kunnen hangen, zie ./cat-geld.js) vielen ze uit fase 1 --
   en in de wig kon een lid ineens niet meer betalen. De catalogus klopte, de
   fase-lijst klopte, en samen deugden ze niet. Wie hier een regel opknipt, zet
   de nieuwe id's erbij in elke trede waar de oude in stond.

   DE MENSREM. Twee treden gaan NOOIT vanzelf open, ook niet als elk cijfer
   groen is. Dat is geen voorzichtigheid maar de wet van dit huis:

     GELD.md   "De grens is hard: geld verlaat het huis nooit autonoom."
     LIFE.md   "Alles wat een tweede persoon bereikt -- een uitnodiging, een
                bericht, een reservering op andermans naam, een betaling -- blijft
                maximaal klaarzetten. Er is geen regel, geen instelling en geen
                vertrouwensniveau waarmee dat automatisch wordt."

   Een automaat die `betalen` of `member-dm` vanzelf openzet, overtreedt die twee
   letterlijk. Die treden dragen daarom `mens: true`: de uitrolregie
   (server/kern/command/uitrolregie.js) klimt eronaartoe, meet, en blijft dan
   staan tot een mens bevestigt. De regel om een NIEUWE trede te wegen staat in
   `mens` hieronder en niet in het hoofd van wie hem toevoegt: draagt de trede
   geld dat het huis verlaat, of een kanaal waarop het ene lid het andere
   rechtstreeks bereikt, dan is het antwoord ja.
   ========================================================================== */

/* DE VOORDEUR -- open in ELKE trede, van de smalste tot alles.

   Binnenkomen, weten wie je bent, je gegevens kunnen ophalen en laten wissen,
   je aanmelden voor een pas, en de laag die de leden-app draaiende houdt. Er is
   geen scope waarin dit dicht mag: een platform waarop niemand kan inloggen is
   geen smallere scope maar een storing, en een platform waarop een lid zijn
   AVG-rechten niet kan uitoefenen is niet smal maar onrechtmatig.

   kern-taal hoort er ook bij en wordt makkelijk vergeten: zonder de vertaallaag
   is de app alleen Nederlands, en dat is geen kleinere scope maar een kapotte
   scope voor ieder ander lid. */
const FASE_VOORDEUR = [
  'tg-inlog', 'tg-account', 'tg-pin', 'tg-zegel', 'tg-gegevens', 'tg-aanmeld',
  'verificatie', 'paspoort', 'webauthn',
  'member', 'experience-platform', 'kern-state', 'kern-live', 'kern-meldingen', 'kern-taal', 'kern-gids',
  'kern-rahul', 'kern-waardering',
  /* EN DE POST DIE ERIN VALT (`ov-mail-binnen`, /api/mail/binnen + /api/mail/ses).
     Dat stond tot 2 september 2026 pas in trede 6, en dat is dezelfde vorm als
     het gat bij `ov-suppliers`: `member` opent op trede 0 het RTG Mail-postvak
     (/api/member/rtmail, server/routes/rtmail-vak.js), maar de enige weg waarlangs
     post van BUITEN dat postvak bereikt bleef tot "alles open" dicht. Een postvak
     dat een lid kan openen terwijl er niets in kan vallen, is een deur zonder
     kamer erachter. De aannamekant is niet zorgeloos maar begrensd: de rem per
     minuut, de onbetrouwde baan, de ontvangertoets (een adres zonder postvak
     krijgt 550) en de bijlagescan zitten in kern/mailaanname.js en staan los van
     deze trede.

     Gevonden door scripts/tredeproef.js, die de niet-HTTP ingangen aanklopt: de
     SMTP-ontvanger nam op trede 0 post aan terwijl zijn functie uit stond. */
  'ov-mail-binnen'
];

/* Trede 0. De smalste stand die een echte livegang aankan: de voordeur plus De
   Salon. supplier-salon zit erbij omdat KOPPELS die twee als de twee kanten van
   dezelfde Salon noemt en schakelFase() koppels NIET volgt; hij is stil zolang
   `supplier` dicht staat. */
const FASE_START = [...FASE_VOORDEUR, 'salon', 'supplier-salon'];

/* Trede 1. Leden bereiken elkaar: vrienden, DM, gesprekken, ontmoetingen en de
   sociale laag. MENSREM -- zie de kop. Wat hier open gaat is niet techniek maar
   moderatie en misbruikafhandeling, en die begin je niet in dezelfde week als
   je inlog. rtf-contacten hoort bij social (KOPPELS). */
const FASE_ONTMOETEN = [...FASE_START,
  'member-connect', 'member-dm', 'kern-berichten', 'kern-comm',
  'ontmoetingen', 'social', 'rtf-contacten'];

/* Trede 2. De partnerkant komt binnen: de partner-app, vacatures en
   solliciteren. member-werk en supplier-apply zitten in KOPPELS aan elkaar
   vast -- solliciteren zonder vacatures werkt niet, en andersom. Er gaat hier
   nog geen geld om.

   EN HET PARTNEROVERZICHT (`ov-suppliers`, /api/suppliers). Dat stond tot 2
   september 2026 pas in trede 6, en dat was een gat dat niemand kon zien: de
   partners kwamen op trede 2 binnen en de LIJST met partners bleef tot "alles
   open" dicht. Op trede 3 stond `bestellen` daardoor open terwijl een lid geen
   zaak kon vinden om bij te bestellen -- de code deed precies wat hier stond, en
   wat hier stond kwam niet rond.

   Gevonden door scripts/tredeproef.js, die de rondgang van een lid ECHT loopt
   (een zaak vinden, de kaart lezen, bestellen, betalen) en meldt wanneer een
   stap niet kan draaien omdat wat hem voedt op die trede nog dicht zit. */
const FASE_PARTNERS = [...FASE_ONTMOETEN, 'supplier', 'supplier-apply', 'member-werk', 'ov-suppliers'];

/* Trede 3. De vloer draait: bestellen en bezorgen, de kassa, het personeel en
   de aansturing. Nog steeds zonder betaalrail -- met RTG_BETALEN_UIT=1 weigert
   elke betaalactie fail-closed, dus dit is de complete werkvloer zonder geld. */
const FASE_BESTELLEN = [...FASE_PARTNERS, 'bestellen', 'supplier-pos', 'staff', 'stuur'];

/* Trede 4, de wig compleet: hier gaat het geld aan. MENSREM -- GELD.md, en er
   is geen cijfer dat die grens opheft. */
const FASE_FUNDAMENT = [...FASE_BESTELLEN,
  'betalen', 'dom-pay-wallet', 'supplier-finance', 'dom-partner-uitbetaling'];

/* Trede 5. De stad wordt levend: tickets, vervoer, kamers, events, de eerste
   eigen apps en de RTFoundation (het goede doel hoort erbij). */
const FASE_STAD = [...FASE_FUNDAMENT,
  'tickets', 'ov', 'onderweg', 'supplier-ride', 'supplier-rooms', 'supplier-events',
  'member-snaps', 'spellen', 'wbw', 'kantoorpakket',
  'flits', 'oog', 'contracten', 'verhuur',
  'foundation', 'foundation-school', 'werk-rtf'];

module.exports = { FASE_VOORDEUR, FASE_START, FASE_ONTMOETEN, FASE_PARTNERS,
  FASE_BESTELLEN, FASE_FUNDAMENT, FASE_STAD };
