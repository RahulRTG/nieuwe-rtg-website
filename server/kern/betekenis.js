/* RTG School: meaning preservation -- gaat de betekenis heel de deur uit?

   Een bericht aan een gezin wordt vertaald, en dan gebeurt het klassieke: "uw
   kind moet morgen aanwezig zijn" komt terug als "uw kind zou morgen aanwezig
   moeten zijn". Dezelfde woorden, een andere mededeling. Bij een uitnodiging is
   dat vervelend; bij een verzuimmelding of een medische mededeling is het het
   verschil tussen wel en niet komen.

   Deze module vergelijkt het ORIGINEEL met de TERUGVERTALING en markeert wat er
   is verschoven. Vier dingen die er nooit uit mogen vallen, en dat zijn precies
   de vier waar het misgaat:

     1. ONTKENNING   -- "niet", "geen", "nooit". Eentje eraf en het bericht zegt
                        het tegenovergestelde.
     2. VERPLICHTING -- "moet", "verplicht", "dient". Verzwakt naar "zou",
                        "kan", "mag" en het is een suggestie geworden.
     3. GETALLEN     -- bedragen, aantallen, tijden. Een 8 die een 3 wordt.
     4. DATA         -- 12-09, 2026-09-12, "12 september".

   WAAROM DIT GEEN AI GEBRUIKT. Een model laten beoordelen of een vertaling
   klopt, is het probleem met zichzelf laten nakijken: dezelfde soort fout die
   de vertaling maakte, maakt de beoordeling. Deze controle is een telling en
   een vergelijking -- ze kan niet hallucineren, en ze werkt ook als er geen
   model is. Wat ze NIET kan is nuance beoordelen; daarvoor is er de mens die
   het bericht verstuurt, en die is hier het sluitstuk en geen formaliteit. */
const ONTKENNING = ['niet', 'geen', 'nooit', 'nergens', 'niemand', 'zonder'];
const MOET = ['moet', 'moeten', 'verplicht', 'dient', 'dienen', 'vereist', 'uiterlijk', 'direct', 'onmiddellijk'];
const MAG = ['zou', 'zouden', 'kan', 'kunnen', 'mag', 'mogen', 'graag', 'misschien', 'eventueel', 'liefst'];

const woorden = (t) => String(t == null ? '' : t).toLowerCase().match(/[a-zà-ÿ]+/g) || [];
const telUit = (t, lijst) => woorden(t).filter(w => lijst.includes(w)).length;
/* Getallen: alles wat een cijfer bevat, inclusief bedragen en tijden. Punten en
   komma's tellen mee (12,50 is niet 1250), maar een punt aan het eind van een
   zin niet. */
const getallen = (t) => (String(t == null ? '' : t).match(/\d+(?:[.,]\d+)*/g) || []).map(x => x.replace(/[.,]$/, ''));

const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const datums = (t) => {
  const s = String(t == null ? '' : t).toLowerCase();
  const uit = (s.match(/\b\d{1,4}[-/]\d{1,2}(?:[-/]\d{1,4})?\b/g) || []);
  for (const m of MAANDEN) if (s.includes(m)) uit.push(m);
  return uit;
};

const mist = (a, b) => a.filter(x => !b.includes(x));

/* De vergelijking. Geeft een lijst verschillen; een lege lijst betekent dat
   deze vier dingen heel zijn overgekomen -- niet dat de vertaling goed is. Dat
   onderscheid staat ook in de uitleg, want anders leest een leraar "geen
   verschillen" als "gecontroleerd en akkoord". */
function vergelijk(origineel, terug) {
  const uit = [];
  const nietA = telUit(origineel, ONTKENNING), nietB = telUit(terug, ONTKENNING);
  if (nietA !== nietB) uit.push({ soort: 'ontkenning', wat: 'Er staat een ontkenning meer of minder in de terugvertaling.',
    was: nietA, werd: nietB, ernst: 'hoog' });

  /* Verplichting. Twee manieren waarop ze wegzakt, en de tweede is de
     klassieke: "moet aanwezig zijn" komt terug als "ZOU aanwezig MOETEN zijn".
     Tellen alleen helpt daar niet -- "moeten" staat er nog steeds in -- dus
     wordt er ook gekeken of er verzwakkers BIJ zijn gekomen die er in het
     origineel niet stonden. Precies het voorbeeld uit SCHOOL.md. */
  const moetA = telUit(origineel, MOET), moetB = telUit(terug, MOET);
  const magA = telUit(origineel, MAG), magB = telUit(terug, MAG);
  if (moetA && moetA > moetB) uit.push({ soort: 'verplichting', wat: 'Wat een verplichting was, komt zwakker terug.',
    was: moetA, werd: moetB, ernst: 'hoog' });
  else if (moetA && magB > magA) uit.push({ soort: 'verplichting',
    wat: 'De verplichting is afgezwakt: er staat nu "zou", "kan" of "mag" bij.',
    was: 'moet', werd: 'zou/kan/mag', ernst: 'hoog' });
  if (moetA < moetB && !magA) uit.push({ soort: 'verplichting', wat: 'De terugvertaling klinkt dwingender dan het origineel.',
    was: moetA, werd: moetB, ernst: 'midden' });

  const kwijtGetal = mist(getallen(origineel), getallen(terug));
  if (kwijtGetal.length) uit.push({ soort: 'getal', wat: 'Deze getallen staan niet meer in de terugvertaling: ' + kwijtGetal.join(', ') + '.',
    was: kwijtGetal.join(', '), werd: getallen(terug).join(', ') || 'niets', ernst: 'hoog' });

  const kwijtDatum = mist(datums(origineel), datums(terug));
  if (kwijtDatum.length) uit.push({ soort: 'datum', wat: 'Deze datum komt niet terug: ' + kwijtDatum.join(', ') + '.',
    was: kwijtDatum.join(', '), werd: datums(terug).join(', ') || 'niets', ernst: 'hoog' });

  return uit;
}

/* Een bericht met een hoog verschil gaat niet zomaar de deur uit. Dat is geen
   blokkade van de machine maar een stopteken voor de mens: hij mag alsnog
   versturen, maar dan wel bewust en met zijn naam eronder. */
const moetGezienWorden = (verschillen) => verschillen.some(v => v.ernst === 'hoog');

module.exports = { vergelijk, moetGezienWorden, ONTKENNING, MOET, MAG };
