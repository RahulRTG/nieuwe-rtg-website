/* Functieschakelaars (deelmodule): het register zelf: de categorieen, de
   doelgroepen en de volledige functiecatalogus met pad-prefixen. De logica
   (welke functie past op een pad, wie mag wat) staat in server/functies.js.

   Dit is de orkestrator: de config (categorieen, doelgroepen) staat in
   ./doelgroepen en de catalogus is per categoriegroep opgeknipt in ./cat-leden,
   ./cat-apps, ./cat-life en ./cat-partners. Hier worden ze samengevoegd (in de
   oorspronkelijke volgorde) en volgen de fail-fast-controles op dubbele id's,
   de tegenhangers (KOPPELS) en de uitrolfases (FASES). */
const { CATEGORIEEN, DOELGROEPEN, DOELGROEP_IDS, DOELGROEP_OP_ID, LEDEN, LEDEN_RTF } = require('./doelgroepen');

// De catalogus. standaard: true = de functie staat normaal aan. doelgroepen:
// welke doelgroepen deze functie bedient (en dus apart te schakelen zijn).
const FUNCTIES = [].concat(
  require('./cat-leden'),
  require('./cat-apps'),
  require('./cat-life'),
  require('./cat-partners'),
  require('./cat-zaakregie'),
  require('./cat-domeinen'),
  require('./cat-domeinen2'),
  require('./cat-geld'),
  require('./cat-domeinen3'),
  require('./cat-domeinen4'));

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

/* Uitrolfases: de gefaseerde uitrol als voorinstelling. Alles is gebouwd en
   staat klaar; lanceren is daardoor letterlijk een fase kiezen in plaats van
   tientallen losse schakelaars omzetten. Elke fase somt op wat er AAN staat;
   al het andere gaat dicht (interne functies blijven altijd open, anders
   sluit de boardroom zichzelf buiten). De fases stapelen: stad = fundament
   plus de stadslaag; alles = de volledige catalogus. */
/* EEN REGISTERREGEL OPKNIPPEN RAAKT DEZE LIJST, en dat is een keer stil
   misgegaan. `betalen` dekte '/api/pay' en `supplier` dekte
   '/api/supplier/pay/uitbetaal'; toen die paden hun eigen regel kregen (om er
   een vermogen aan te kunnen hangen, zie ./cat-geld.js) vielen ze uit fase 1 --
   en in de wig kon een lid ineens niet meer betalen. De catalogus klopte, de
   fase-lijst klopte, en samen deugden ze niet. Wie hier een regel opknipt, zet
   de nieuwe id's erbij in elke fase waar de oude in stond. */
const FASE_FUNDAMENT = [
  // de wig: een stad, een sector diep - leden bestellen en betalen bij
  // partners, de zaak draait op kassa en personeel, identiteit is op orde
  'member', 'bestellen', 'betalen', 'dom-pay-wallet', 'verificatie', 'webauthn', 'paspoort',
  'salon', 'member-dm', 'member-connect', 'member-werk',
  'supplier', 'supplier-pos', 'supplier-salon', 'supplier-apply', 'supplier-finance',
  'dom-partner-uitbetaling', 'staff', 'stuur'
];
const FASE_STAD = [...FASE_FUNDAMENT,
  // de stad wordt levend: tickets, vervoer, kamers, events, de sociale laag,
  // de eerste eigen apps en de RTFoundation (het goede doel hoort erbij)
  'tickets', 'ov', 'onderweg', 'supplier-ride', 'supplier-rooms', 'supplier-events',
  'ontmoetingen', 'social', 'member-snaps', 'spellen', 'wbw', 'kantoorpakket',
  'flits', 'oog', 'contracten', 'verhuur',
  'foundation', 'foundation-school', 'werk-rtf', 'rtf-contacten'
];
const FASES = [
  { id: 'fundament', naam: 'Fase 1 · Het fundament (de wig)', aan: FASE_FUNDAMENT,
    uitleg: 'Eén stad, één sector diep: leden bestellen en betalen bij partners, de zaak draait op kassa, Salon en personeel, en de identiteitslaag staat. Al het andere blijft dicht tot u verder draait.' },
  { id: 'stad', naam: 'Fase 2 · De stad', aan: FASE_STAD,
    uitleg: 'Het fundament plus alles wat een stad levend maakt: tickets, vervoer, kamers, events, de sociale laag, de eerste eigen apps en de RTFoundation.' },
  { id: 'alles', naam: 'Fase 3 · Alles open', aan: null,
    uitleg: 'De volledige catalogus open, zoals de standaard: elk genre, elke eigen app, elke dienst.' }
];
for (const f of FASES) for (const id of f.aan || [])
  if (!OP_ID[id]) throw new Error('functie-catalogus: fase "' + f.id + '" noemt onbekende functie: ' + id);

module.exports = { CATEGORIEEN, DOELGROEPEN, DOELGROEP_IDS, DOELGROEP_OP_ID, LEDEN, LEDEN_RTF, FUNCTIES, OP_ID, KOPPELS, FASES };
