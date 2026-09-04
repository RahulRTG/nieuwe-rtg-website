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
  /* PRECIES HIER, zodat de volgorde van FUNCTIES onveranderd blijft: de genres
     stonden in ./cat-leden.js direct na de leden-app en voor De Salon, en bij
     twee functies met hetzelfde pad wint de eerste. Een afsplitsing mag de
     uitkomst niet verschuiven, alleen de plek van de tekst. */
  require('./cat-genres'),
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

/* De UITROLTRAP staat sinds 3 september 2026 in ./fases.js (TAKEN.md 5.57): het
   register zegt WELKE functies er zijn, de ladder in welke VOLGORDE ze opengaan.
   De drie controles die de twee aan elkaar binden zijn meeverhuisd en draaien
   hier, bij het bouwen -- anders kan de ladder stil naast het register komen te
   staan. */
const { FASES, controleer: controleerFases } = require('./fases');
controleerFases(OP_ID);

module.exports = { CATEGORIEEN, DOELGROEPEN, DOELGROEP_IDS, DOELGROEP_OP_ID, LEDEN, LEDEN_RTF, FUNCTIES, OP_ID, KOPPELS, FASES };
