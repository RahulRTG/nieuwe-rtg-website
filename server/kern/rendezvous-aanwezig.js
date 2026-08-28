/* Rendez-vous, deelbestand "aanwezig": DE PRESENCE GRAPH.

   WAT DIT VERANDERT. Locatie was in Rendez-vous een verzameling: een lijst
   steden waar iemand openstaat voor een ontmoeting, en de overlap ertussen.
   Twee mensen die allebei "Parijs" hadden staan, waren een match -- ook als de
   een er in maart is en de ander in oktober. Dat is geen signaal, dat is een
   toevalligheid met een stad erbij.

   Aanwezigheid maakt er een agenda van, en daarmee ontstaat het enige wat in dit
   segment werkelijk schaars is: **twee mensen zijn tegelijk op dezelfde plek**
   (ONTMOETEN.md par. 2.1). Timing wordt onderdeel van compatibiliteit in plaats
   van een praktisch probleem achteraf.

   ---------------------------------------------------------------------------
   DRIE GRENZEN, EN ZE ZITTEN IN DE CONSTRUCTIE EN NIET IN EEN CONTROLE

   1. ZELF OPGEGEVEN, NOOIT AFGELEID. Aanwezigheid komt uitsluitend uit wat een
      lid intikt. Niet uit RTG Travel, niet uit een boeking, niet uit een
      vlucht. Dat is LIFE.md par. 4.6: toestemming reist niet mee -- dat
      Rendez-vous bestaat, geeft het geen toegang tot uw reizen. Wil een lid het
      koppelen, dan is dat een eigen `cap` met eigen vervaldatum op
      kern/levensband, en niet een stille lezing hier.

      Dit bestand kan die grens ook niet per ongeluk overschrijden: het krijgt
      geen enkele reisbron binnen. Het zijn zuivere functies over wat er is
      ingetikt. Een latere koppeling moet er dus expliciet in geduwd worden, en
      dat is precies de drempel die hij hoort te hebben.

   2. GROFMAZIG. Een venster is een STAD en DAGEN. Geen adres, geen tijdstip,
      geen "nu ter plaatse". `datum()` accepteert alleen JJJJ-MM-DD en gooit de
      rest weg; er is dus geen veld waar een tijd in past.

   3. HET OVERLAPBERICHT ZEGT NIET WIE ER WOONT. Een thuisstad telt mee bij het
      berekenen, maar het antwoord zegt alleen "u bent er allebei" -- nooit "hij
      woont daar". Zonder die regel kon iemand twaalf vensters in twaalf steden
      neerleggen en aflezen waar de anderen wonen. Voor de ontmoeting maakt het
      niets uit wie er woont; voor de privacy alles.

   ---------------------------------------------------------------------------
   WAT GEEN SIGNAAL IS. Twee mensen die allebei in Amsterdam WONEN, leveren hier
   niets op. Dat is geen timing maar gewoon dezelfde stad, en dat kon de app al
   (`gedeeldeLocaties`). Er hoort minstens een gedateerd venster bij, anders zou
   elke stadgenoot elke dag als "bijzonder relevant" bovenkomen en betekent het
   woord niets meer. */

const VENSTERS_MAX = 12;
const STAD_MAX = 40;
const DAG = /^\d{4}-\d{2}-\d{2}$/;

const datum = v => (DAG.test(String(v || '')) ? String(v) : null);
const vandaagISO = () => new Date().toISOString().slice(0, 10);
const gelijk = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/* Een venster schoonmaken. `van` en `tot` mogen omgedraaid binnenkomen -- dan
   worden ze omgedraaid en niet geweigerd; een lid dat de velden verwisselt heeft
   geen fout gemaakt die het waard is om zijn invoer voor weg te gooien. */
function schoonVenster(v, schoon) {
  if (!v || typeof v !== 'object') return null;
  const stad = schoon(v.stad, STAD_MAX);
  let van = datum(v.van), tot = datum(v.tot);
  if (!stad || !van || !tot) return null;
  if (van > tot) { const h = van; van = tot; tot = h; }
  return { stad, van, tot, open: v.open === false ? false : true };
}

/* De hele lijst vervangen (geen samenvoegen). Een agenda die alleen maar aangroeit
   is na een half jaar onbruikbaar, en "weghalen" zou dan een eigen bewerking
   moeten worden met een eigen manier om fout te gaan. Vensters die al voorbij
   zijn, vallen er meteen af: ze kunnen per definitie geen overlap meer opleveren
   en ze houden alleen maar een spoor in stand dat niemand meer gebruikt. */
function schoonAanwezig(lijst, schoon, vandaag) {
  const nu = vandaag || vandaagISO();
  if (!Array.isArray(lijst)) return [];
  return lijst.map(v => schoonVenster(v, schoon)).filter(v => v && v.tot >= nu).slice(0, VENSTERS_MAX);
}

// de vensters die vandaag nog meetellen: opengesteld en niet voorbij
const vensters = (p, vandaag) =>
  (Array.isArray(p && p.aanwezig) ? p.aanwezig : []).filter(v => v.open !== false && v.tot >= (vandaag || vandaagISO()));

/* Waar en wanneer zijn twee leden tegelijk?

   Drie manieren waarop dat kan, en twee daarvan tellen:
     - allebei een gedateerd venster in dezelfde stad, met overlappende dagen;
     - de een een venster, de ander woont daar (dan is het venster de overlap);
     - allebei alleen een thuisstad -> telt NIET, zie de kop.

   Het antwoord noemt de stad en de dagen, en verder niets. */
function overlapTussen(a, b, vandaag) {
  const nu = vandaag || vandaagISO();
  const va = vensters(a, nu), vb = vensters(b, nu);
  const thuisA = (a && a.thuis) || '', thuisB = (b && b.thuis) || '';
  const uit = [];
  const zet = (stad, van, tot) => {
    if (van > tot) return;
    const al = uit.find(x => gelijk(x.stad, stad) && x.van === van && x.tot === tot);
    if (!al) uit.push({ stad, van, tot });
  };
  for (const x of va) {
    let raak = false;
    for (const y of vb) {
      if (!gelijk(x.stad, y.stad)) continue;
      zet(x.stad, x.van > y.van ? x.van : y.van, x.tot < y.tot ? x.tot : y.tot);
      raak = true;
    }
    // hij woont daar: dan is uw venster de hele overlap
    if (!raak && thuisB && gelijk(x.stad, thuisB)) zet(x.stad, x.van, x.tot);
  }
  // en andersom: hij reist naar de stad waar u woont
  for (const y of vb) {
    if (thuisA && gelijk(y.stad, thuisA) && !va.some(x => gelijk(x.stad, y.stad))) zet(y.stad, y.van, y.tot);
  }
  return uit.sort((p, q) => p.van.localeCompare(q.van));
}

module.exports = { VENSTERS_MAX, schoonAanwezig, vensters, overlapTussen, datum, vandaagISO };
