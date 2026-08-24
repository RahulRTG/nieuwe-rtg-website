/* Functieschakelaars (deelmodule): het register zelf: de categorieen, de
   doelgroepen en de volledige functiecatalogus met pad-prefixen. De logica
   (welke functie past op een pad, wie mag wat) staat in server/functies.js.

   Dit is de orkestrator: de config (categorieen, doelgroepen) staat in
   ./doelgroepen en de catalogus is per categoriegroep opgeknipt in ./cat-leden,
   ./cat-apps, ./cat-life, ./cat-partners en ./cat-command. Hier worden ze samengevoegd (in de
   oorspronkelijke volgorde) en volgen de fail-fast-controles op dubbele id's,
   de tegenhangers (KOPPELS) en de uitrolfases (FASES). */
const { CATEGORIEEN, DOELGROEPEN, DOELGROEP_IDS, DOELGROEP_OP_ID, LEDEN, LEDEN_RTF } = require('./doelgroepen');

// De catalogus. standaard: true = de functie staat normaal aan. doelgroepen:
// welke doelgroepen deze functie bedient (en dus apart te schakelen zijn).
const FUNCTIES = [].concat(
  require('./cat-leden'),
  require('./cat-apps'),
  require('./cat-apps2'),
  require('./cat-life'),
  require('./cat-partners'),
  /* De drie Command-schakelaars staan sinds cat-partners.js door zijn
     omvangsgrens ging in een eigen bestand, op precies deze plek zodat de
     volgorde van FUNCTIES onveranderd blijft: bij twee functies met hetzelfde
     pad wint de eerste, en dat gebeurt vier keer in deze catalogus. */
  require('./cat-command'),
  require('./cat-partners2'),
  require('./cat-zaakregie'),
  require('./cat-domeinen'),
  require('./cat-domeinen2'),
  require('./cat-geld'),
  require('./cat-domeinen3'),
  require('./cat-domeinen4'),
  require('./cat-festival'));

const OP_ID = Object.fromEntries(FUNCTIES.map(f => [f.id, f]));
/* FAIL-FAST OP EEN ONBEKENDE CATEGORIE. Het bord groepeert per categorie en
   laat alles vallen wat in geen enkele groep past. Dat is precies een keer
   gebeurd: 91 functies in de kast, 56 op het bord, geen enkele melding. Een
   functie die je niet ziet kun je niet schakelen, en dan is de kast een
   belofte in plaats van een bedieningspaneel. */
{
  const bekend = new Set(CATEGORIEEN);
  const vreemd = [...new Set(FUNCTIES.filter(f => !bekend.has(f.categorie)).map(f => f.categorie))];
  if (vreemd.length) throw new Error('functie-catalogus: onbekende categorie(en): ' + vreemd.join(', ') +
    ' -- zet ze in CATEGORIEEN (functies/register/doelgroepen.js), anders vallen die functies van het bord');
}

/* FAIL-FAST OP EEN PAD DAT TWEE KEER WORDT GECLAIMD.

   functieVoorPad() kiest de LANGSTE prefix en breekt een gelijkspel met de
   volgorde: `len > besteLen` is strikt, dus bij twee even lange claims wint wie
   er het eerst staat. De tweede staat dan wel op het schakelbord en schakelt
   niets.

   Dat was geen theorie. Vier paren claimden hetzelfde pad -- tg-werving naast
   werving, en ov-arrival, ov-instant-reality en ov-rtgone naast arrival,
   instantreality en rtgone. Samen 23 routes achter een knop die loog: wie
   'Invisible Arrival' uitzette zag hem uitgaan terwijl alle vier de routes
   bleven draaien. Een schakelaar die niet schakelt is erger dan een ontbrekende
   schakelaar, want hij wekt vertrouwen.

   Hier fail-fast en niet in de keuring: de keuring draait als iemand hem start,
   dit draait bij elke serverstart. Een bord met een dode knop hoort niet op te
   komen. */
{
  const perPad = new Map();
  for (const f of FUNCTIES) {
    for (const p of (f.paden || [])) {
      const bij = perPad.get(p) || [];
      bij.push(f.id);
      perPad.set(p, bij);
    }
  }
  const dubbel = [...perPad].filter(([, ids]) => ids.length > 1);
  if (dubbel.length) {
    throw new Error('functie-catalogus: pad(en) door meer dan een functie geclaimd: ' +
      dubbel.map(([p, ids]) => p + ' <- ' + ids.join(' + ')).join('; ') +
      ' -- de eerste wint en de rest schakelt niets. Geef ze een eigen pad of haal de dubbel weg.');
  }
}

// fail-fast: een dubbele id zou stil de laatste laten winnen in OP_ID en de
// schakelkast op de verkeerde functie laten werken; dat is eerder misgegaan
if (Object.keys(OP_ID).length !== FUNCTIES.length) {
  const gezien = new Set();
  const dubbel = FUNCTIES.map(f => f.id).filter(id => gezien.has(id) || !gezien.add(id));
  throw new Error('functie-catalogus: dubbele id(s): ' + dubbel.join(', '));
}

/* Tegenhangers: twee functies die samen EEN dienst vormen (de leden-kant en de
   werk-kant). Zet de boardroom de ene kant om, dan volgt de andere kant
   automatisch, zodat er nooit een halve dienst overblijft (vacatures zonder
   sollicitanten, een Salon-feed zonder partner-marketing). De regel is de
   "nog publiek?"-vraag: de tegenhanger volgt of de bron nog ergens aan staat.
   Alleen directe partners volgen (geen kettingreacties), en per-doelgroep
   fijnregeling op de tegenhanger zelf blijft gerespecteerd. */
const KOPPELS = [
  { a: 'salon', b: 'supplier-salon',
    uitleg: 'De ledenfeed en de partner-marketing zijn twee kanten van dezelfde Salon.' },
  { a: 'member-werk', b: 'supplier-apply',
    uitleg: 'Solliciteren zonder vacatures werkt niet, en andersom.' },
  { a: 'werk-rtf', b: 'supplier-apply',
    uitleg: 'RTF-sollicitaties lopen op dezelfde partner-vacatures.' },
  { a: 'foundation-school', b: 'office-school',
    uitleg: 'Het schoolkanaal en de schoolgoedkeuring horen bij elkaar.' },
  { a: 'verificatie', b: 'paspoort',
    uitleg: 'Paspoort delen leunt op de identiteitsverificatie.' },
  { a: 'social', b: 'rtf-contacten',
    uitleg: 'De familiekoppeling draait op de sociale laag.' }
];
for (const k of KOPPELS) if (!OP_ID[k.a] || !OP_ID[k.b])
  throw new Error('functie-catalogus: koppel verwijst naar onbekende functie: ' + k.a + ' <-> ' + k.b);

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
  'member', 'kern-state', 'kern-live', 'kern-meldingen', 'kern-taal', 'kern-gids',
  'kern-rahul', 'kern-waardering'
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
   nog geen geld om. */
const FASE_PARTNERS = [...FASE_ONTMOETEN, 'supplier', 'supplier-apply', 'member-werk'];

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

const FASES = [
  { id: 'start', naam: 'Trede 0 · De smalle snee', aan: FASE_START, mens: false,
    uitleg: 'De kleinste stand die een echte livegang aankan: binnenkomen, je gegevens beheren, je aanmelden voor een pas, de leden-app en De Salon. Bestellen, betalen, partners, personeel en de RTFoundation blijven dicht. De backoffice blijft open, want een pasbesluit wordt door een mens genomen.' },
  { id: 'ontmoeten', naam: 'Trede 1 · Leden onder elkaar', aan: FASE_ONTMOETEN, mens: true,
    mensWaarom: 'Hier gaat het kanaal open waarop het ene lid het andere rechtstreeks bereikt. LIFE.md laat daar geen automaat toe, en praktisch: moderatie en misbruikafhandeling moeten bemenst zijn vóór deze trede open gaat, niet erna.',
    uitleg: 'Vrienden verbinden, directe berichten, gesprekken, ontmoetingen in de buurt en de sociale laag.' },
  { id: 'partners', naam: 'Trede 2 · De partners erbij', aan: FASE_PARTNERS, mens: false,
    uitleg: 'De partner-app gaat open: partners komen binnen, plaatsen vacatures en leden kunnen solliciteren. Er gaat nog geen geld om.' },
  { id: 'bestellen', naam: 'Trede 3 · De vloer draait', aan: FASE_BESTELLEN, mens: false,
    uitleg: 'Bestellen en bezorgen, de kassa, het personeel en de aansturing. Zonder betaalrail: met RTG_BETALEN_UIT=1 weigert elke betaalactie fail-closed.' },
  { id: 'fundament', naam: 'Trede 4 · Het fundament (de wig)', aan: FASE_FUNDAMENT, mens: true,
    mensWaarom: 'Hier gaat het geld aan. GELD.md: de grens is hard, geld verlaat het huis nooit autonoom. Er bestaat geen meting die deze trede vanzelf mag openen.',
    uitleg: 'De wig compleet: één stad, één sector diep, met een echte betaalrail, wallet, partnerfinanciën en uitbetalingen.' },
  { id: 'stad', naam: 'Trede 5 · De stad', aan: FASE_STAD, mens: false,
    uitleg: 'Alles wat een stad levend maakt: tickets, vervoer, kamers, events, de eerste eigen apps en de RTFoundation.' },
  { id: 'alles', naam: 'Trede 6 · Alles open', aan: null, mens: false,
    uitleg: 'De volledige catalogus open, zoals de standaard: elk genre, elke eigen app, elke dienst.' }
];

/* Drie controles op deze lijst, want een fase-lijst die klopt met zichzelf is
   precies wat hierboven een keer misging. */
for (const f of FASES) for (const id of f.aan || [])
  if (!OP_ID[id]) throw new Error('functie-catalogus: trede "' + f.id + '" noemt onbekende functie: ' + id);
// de voordeur zit in ELKE trede
for (const f of FASES) if (f.aan) for (const id of FASE_VOORDEUR)
  if (!f.aan.includes(id)) throw new Error('functie-catalogus: trede "' + f.id + '" sluit de voordeur: ' + id);
// en elke trede bevat zijn voorganger, anders klimt de uitrolregie omlaag
for (let i = 1; i < FASES.length; i++) {
  const vorige = FASES[i - 1].aan, deze = FASES[i].aan;
  if (!vorige || !deze) continue;
  for (const id of vorige) if (!deze.includes(id))
    throw new Error('functie-catalogus: trede "' + FASES[i].id + '" sluit iets wat "' + FASES[i - 1].id + '" opende: ' + id);
}


module.exports = { CATEGORIEEN, DOELGROEPEN, DOELGROEP_IDS, DOELGROEP_OP_ID, LEDEN, LEDEN_RTF, FUNCTIES, OP_ID, KOPPELS, FASES };
