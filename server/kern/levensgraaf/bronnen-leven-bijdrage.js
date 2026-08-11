/* Levensgraaf, deelbestand "bronnen-leven-bijdrage": de derde bron van
   LEVEN.md par. 1.2. Hoort bij ./bronnen-leven.js -- de uitleg over de poort
   en over de vergeten `deel` staat daar, en wordt hier niet herhaald.

   HIER STAAT NOOIT EEN SOM, EN DAT IS DE HELE MODULE.

   LEVEN.md par. 2.4 is de grens waarop dit platform een burgerscore zou worden:
   geen ranglijst, geen percentiel, geen cijfer dat mensen rangschikt, nooit
   invoer voor toegang, prijs, voorrang of aanname. Een optelsom is de eerste
   stap daarheen, en het is een kleine stap. "U gaf dit jaar 240 uur" is een
   getal; twee schermen verder is het "u gaf minder dan gemiddeld" en daarna is
   het een voorwaarde. Dus: losse feiten met een datum, en nergens een totaal,
   een gemiddelde, een percentiel of een cijfer. Wie hier ooit een som wil,
   weerlegt eerst par. 2.4 -- niet dit commentaar.

   EN DIE OPTELSOM IS GEEN THEORIE, HIJ LIGT KLAAR. ./graaf.js geeft elke knoop
   een veld `waarde`, en samenvatting() doet er `reduce((s, k) => s + k.waarde,
   0)` overheen, ook per kamer. Zou een bijdrageknoop het bedrag van een gift of
   het aantal uren in `waarde` zetten, dan staat er binnen EEN scherm "kamer
   bijdrage: 1.240" zonder dat iemand daar een besluit voor heeft hoeven nemen.
   Vandaar dat geen enkele knoop hieronder `waarde` vult; hij blijft nul.

   WAT ER WEL EEN GETAL BLIJFT, EERLIJK GEZEGD. samenvatting() telt ook het
   AANTAL knopen per kamer, en dat kan ik hier niet uitzetten zonder de motor te
   veranderen. Het is geen score en geen rangschikking, maar het is wel een
   getal, en wie er ooit een spiegel op bouwt hoort hier te lezen dat het niets
   meet: een gift van een euro en tien jaar mantelzorg tellen allebei als een.

   WAAROM DE POORT OOK HIER OP 'lid' STAAT, TERWIJL DE GEVOELIGHEID MAAR
   'persoonlijk' IS. Par. 2.4 vraagt "geen zichtbaarheid voor anderen zonder
   uitdrukkelijke toestemming PER ONDERDEEL". Zo'n toestemming per onderdeel
   bestaat in dit huis nog niet (dat is de levenspas, fase 2). Zolang die er
   niet is, is er maar een instelling die de belofte waarmaakt, en dat is de
   strengste. 'persoonlijk' dwingt in ./graaf.js niets af -- alleen 'besloten'
   doet dat -- dus zonder deze regel zou de bijdrage van een mens standaard bij
   de Rechterhand liggen.

   WAT ER NIET IN GAAT, EN WAAROM DAT HIER STAAT IN PLAATS VAN NERGENS:

   - DE GIFTEN UIT MECENAAT (l.mecenaat) staan AL in de graaf, via ./bronnen2.js
     in de kamer filantropie. Ze hier nog eens als bijdrage inleveren zet
     dezelfde gift twee keer in het beeld en telt zijn bedrag twee keer mee in
     samenvatting(). Dat is regel 4 van de lat: twee plekken die een waarheid
     vasthouden lopen uiteen. Hoort een gift ooit ook "bijdrage" te heten, dan
     is dat een LABEL op de bestaande knoop en geen tweede knoop.
   - HET VRIJWILLIGERSREGISTER VAN DE STICHTING (kern/rtfos/vrijwilligers.js)
     kent geen RTG-sleutel. Een vrijwilliger heeft daar met opzet geen account
     maar een eigen code (RTFV-...), en de uren hangen aan die code. Er valt dus
     niets te koppelen, en een koppeling verzinnen zou een mens aan een dossier
     hechten dat hij nooit aan zijn RTG-pas heeft verbonden.
   - MENTORSCHAP bestaat nergens als vastgelegd gegeven. Attenties kent een band
     'mentor' op een relatie (kern/rechterhand/attenties.js), maar dat veld zegt
     niet WIE wie begeleidt. Daar "u bent mentor" van maken is een bewering doen
     namens het lid, en die komt later terug als een regel in zijn levenspas die
     hij nooit heeft geschreven.

   Gemount via ./bronnen-leven.js. */
'use strict';

const H = require('./hulp');
const { PERSOONLIJK, isDatum, lijst, obj, vandaag } = H;

/* Een millisecondenstempel naar 'YYYY-MM-DD', of leeg. RTG iD bewaart `tot` als
   getal (nu() + dagen), en de graaf rekent alleen met kale datums.

   De omweg via getTime() en niet meteen toISOString(): een getal dat wel eindig
   is maar buiten het datumbereik valt (1e20) geeft een Invalid Date, en die
   GOOIT bij toISOString(). ./graaf.js zou dat opvangen en de hele bron als
   `__stuk` melden -- dus een onzinnige waarde in EEN machtiging zou de bijdrage
   van dit lid in zijn geheel doven. Een lege datum is hier het juiste antwoord;
   omvallen is dat niet. */
function dagVan(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return '';
  const d = new Date(n);
  if (Number.isNaN(d.getTime())) return '';
  const kaal = d.toISOString().slice(0, 10);
  return isDatum(kaal) ? kaal : '';
}

const BIJDRAGE = [

  /* ---- Bijdrage: de zorg die u voor een ander op zich nam ----

     De enige bijdrage die in dit huis per RTG-sleutel vastligt, is de
     mantelzorg-machtiging uit RTG iD (kern/rtgid-regie.js): een ander lid heeft
     u gemachtigd om namens hem bij een dienst te kunnen, tijdelijk en
     herroepbaar. Beide kanten staan daar als sleutel, dus dit is te lezen
     zonder ergens een verband te verzinnen.

     ALLEEN DE KANT WAAR U GEEFT. `naarKey === key` betekent: u bent de
     gemachtigde, u doet het werk. De andere kant (`vanKey === key`) is geen
     bijdrage maar het tegendeel -- iemand zorgt voor u -- en dat hoort niet in
     een lijst met wat u bijdroeg te staan.

     ZONDER DE CODENAAM VAN DE ANDER. De machtiging weet wie het is; deze knoop
     hoeft dat niet te weten om te kunnen zeggen dat u dit doet. Wat een laag
     niet nodig heeft, hoort hij niet te dragen -- en dit is bovendien een
     gegeven OVER iemand anders, meestal iemand die hulp nodig heeft.

     GEEN DAK, EN DAAROM GEEN ZWIJGEND DAK. De lijst is er EEN voor het hele
     platform, dus dit is een doorloop -- maar kern/rtgid-regie.js knipt hem bij
     elke nieuwe machtiging op tweehonderd rijen af. Zowel de doorloop als het
     aantal knopen is dus door de schrijvende kant begrensd, en er valt hier
     niets af te kappen waar het scherm over zou moeten liegen. */
  { kamer: 'bijdrage', knopen(l, K, ctx) {
    const db = ctx && ctx.db, key = ctx && ctx.key;
    if (!db || !key) return [];
    const uit = [];
    for (const m of lijst(obj(db.data && db.data.rtgid).machtigingen)) {
      if (!m || m.naarKey !== key || m.ingetrokken) continue;
      const sinds = String(m.gemaakt || '').slice(0, 10);
      const tot = dagVan(m.tot);
      const dienst = String(m.dienst || 'een dienst').slice(0, 60);

      /* DE DATUM STAAT IN DE NAAM, EN DAT IS GEEN LUIHEID. Een knoop draagt
         maar EEN datumveld, en dat veld heet `vervalt`: het betekent "dit
         vraagt aandacht" en het voert de Control Tower. Een bijdrage uit het
         verleden vraagt geen aandacht; die zou daar als achterstallig komen te
         staan en gaan zeuren over iets dat af is. Par. 2.4 vraagt om feiten met
         een datum, dus draagt het feit zijn eigen datum.

         `vervalt` krijgt alleen de LOPENDE machtiging, en dan als wat het
         werkelijk is: een recht dat afloopt (LEVEN.md par. 2.8 -- rechten wonen
         op de relatie en ze verlopen). Een afgelopen machtiging blijft staan
         als kaal feit, zonder datumveld en dus zonder venster. */
      const loopt = tot && tot >= vandaag();
      uit.push(K({ id: 'bijdrage:machtiging:' + m.id, soort: 'bijdrage',
        naam: 'mantelzorg · ' + dienst + (isDatum(sinds) ? ' · sinds ' + sinds : ''),
        kamer: 'bijdrage', bron: 'RTG iD', gevoelig: PERSOONLIJK, deel: 'lid',
        vervalt: loopt ? tot : '', vervaltWat: 'machtiging' }));
    }
    return uit;
  } }
];

module.exports = BIJDRAGE;
