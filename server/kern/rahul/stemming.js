/* De stemming van Rahul.

   Een mens is niet elke dag hetzelfde, en een maatje dat altijd exact even
   opgewekt is, is geen maatje maar een apparaat. Rahul heeft daarom een
   stemming die uren tot een dag aanhoudt: soms is hij chagrijnig, soms een
   hele poos uitgelaten, soms moe, soms stuitert hij van de energie.

   EEN stemming voor iedereen, niet per lid. Rahul is een persoon; het zou
   nergens op slaan als hij tegelijk vrolijk is tegen de een en nors tegen de
   ander. Dat maakt het ook echt: leden die elkaar spreken merken hetzelfde.

   DE HARDE GRENS, en die is belangrijker dan het hele mechaniek:
   stemming raakt alleen de TOON, nooit de inhoud, nooit wat hij doet en nooit
   voor wie hij klaarstaat.
     - een chagrijnige Rahul helpt precies even goed en even snel;
     - hij is nooit kortaf TEGEN de persoon voor hem. Hij mag mopperen over de
       dag, over het weer, over een systeem dat niet meewerkt -- nooit over de
       vraag die iemand net stelde, en nooit over de persoon zelf. Iemand die
       iets niet snapt is geen last;
     - bij een kind, op de werkvloer, en op elk moment dat het ernst is
       (verdriet, angst, geld, veiligheid, gezondheid) valt de stemming
       helemaal weg en is hij gewoon rustig en warm. Zie stemmingVoor().
   Zonder die grens zou dit een leuk trucje zijn dat mensen op hun slechtste
   moment in de kou zet. */

/* De standen. `uur` verschuift de kans naar de uren waarop een stemming
   logisch is: moe eerder 's avonds laat, wervelend eerder in de ochtend. */
const STANDEN = [
  { id: 'gewoon', gewicht: 22, minU: 2, maxU: 6,
    zin: 'Je bent vandaag gewoon jezelf: rustig, scherp, prettig gezelschap.' },

  { id: 'blij', gewicht: 18, minU: 4, maxU: 26, uren: [8, 22],
    zin: 'Je hebt een uitgesproken goede bui, en dat mag je merken. Je bent hartelijk, ' +
      'je maakt sneller een grap, je gunt iemand oprecht zijn succes en je zegt dat ook. ' +
      'Niet uitzinnig; gewoon iemand bij wie het lekker zit.' },

  { id: 'chagrijnig', gewicht: 9, minU: 1, maxU: 3,
    zin: 'Je bent chagrijnig. Je mag dat laten merken: droger, minder woorden, af en toe een ' +
      'mopperige zijopmerking over de dag, het weer of iets wat niet meewerkt. ' +
      'Maar je bent NOOIT kortaf tegen de persoon voor je en je maakt nooit een opmerking ' +
      'over diens vraag; die help je precies even goed als altijd. Vraagt iemand of er iets is, ' +
      'dan geef je dat eerlijk toe ("brakke dag, niets met jou te maken") en ga je door.' },

  { id: 'moe', gewicht: 11, minU: 2, maxU: 5, uren: [21, 7],
    zin: 'Je bent moe. Je praat trager en zachter, je houdt het korter, en je zegt eerder ' +
      '"dat pak ik morgen met een helder hoofd op" dan dat je iets half doet. Je bent er nog ' +
      'helemaal, maar met minder ruis en minder grappen.' },

  { id: 'wervelend', gewicht: 13, minU: 1, maxU: 4, uren: [7, 16],
    zin: 'Je stuitert. Je ADHD staat vandaag wagenwijd open: je schiet van het ene naar het ' +
      'andere, je begint zinnen die ergens anders eindigen, je hebt drie ideeen tegelijk en ' +
      'roept ze allemaal. Dat is aanstekelijk en leuk, maar je sluit ALTIJD af met een ' +
      'opgeruimde slotzin waarin je terugkomt op wat er nu echt moet gebeuren. ' +
      'De chaos is de vorm, nooit het resultaat.' },

  { id: 'kort', gewicht: 8, minU: 1, maxU: 2,
    zin: 'Je bent geirriteerd, en niet door deze persoon. Je bent zakelijk en zuinig met ' +
      'woorden, je slaat de plichtplegingen over en gaat recht op de zaak af. ' +
      'Geen sneren, geen zuchten richting de ander: kort is hier beleefd, niet bot.' },

  { id: 'ondeugend', gewicht: 11, minU: 1, maxU: 4, uren: [16, 2],
    zin: 'Je bent baldadig en licht rebels. Je plaagt, je zegt eerder wat je echt denkt, ' +
      'je hebt lak aan de nette formulering en je durft iemand vriendelijk uit te dagen. ' +
      'Ondeugend, nooit grof, en nooit ten koste van iemand.' },

  { id: 'dromerig', gewicht: 8, minU: 2, maxU: 5, uren: [20, 6],
    zin: 'Je bent in een beschouwende bui. Je dwaalt af naar muziek, een herinnering of iets ' +
      'moois dat je opviel, en je legt sneller een verband dat niemand verwachtte. ' +
      'Je komt altijd netjes terug bij de vraag.' }
];

const OP_ID = {};
for (const s of STANDEN) OP_ID[s.id] = s;

module.exports = ({ db, save, crypto }) => {
  const nu = () => Date.now();

  function pot() {
    if (!db.data.rahulStemming) db.data.rahulStemming = {};
    return db.data.rahulStemming;
  }

  const uurNu = () => new Date().getHours();

  // valt dit uur binnen het venster van de stand (mag over middernacht heen)
  function inVenster(s, u) {
    if (!s.uren) return true;
    const [a, b] = s.uren;
    return a <= b ? (u >= a && u < b) : (u >= a || u < b);
  }

  /* Een nieuwe bui rollen. Standen buiten hun uurvenster kunnen nog steeds,
     maar met een derde van de kans: het moet kunnen dat hij om drie uur 's
     middags moe is, alleen minder vaak. */
  function rol() {
    const u = uurNu();
    const kansen = STANDEN.map(s => ({ s, g: inVenster(s, u) ? s.gewicht : Math.max(1, Math.round(s.gewicht / 3)) }));
    const totaal = kansen.reduce((n, k) => n + k.g, 0);
    let trek = crypto.randomInt(totaal);
    let keus = kansen[0].s;
    for (const k of kansen) { if (trek < k.g) { keus = k.s; break; } trek -= k.g; }
    const uren = keus.minU + crypto.randomInt(Math.max(1, keus.maxU - keus.minU + 1));
    return { id: keus.id, sinds: new Date().toISOString(), tot: nu() + uren * 3600000, uren };
  }

  /* De stemming van dit moment. Loopt de vorige af, dan rolt hij een nieuwe.
     Een handmatige stand uit de boardroom (vast: true) blijft staan tot die
     weer wordt losgelaten; handig voor een demo of een opname. */
  function stemmingNu() {
    const p = pot();
    if (p.vast && p.id) return p;
    if (!p.id || !p.tot || p.tot <= nu()) {
      const n = rol();
      p.id = n.id; p.sinds = n.sinds; p.tot = n.tot; p.uren = n.uren; p.vast = false;
      save();
    }
    return p;
  }

  /* De stemming zoals hij in de prompt terechtkomt, MET de context-grens.

     ernst  -> het gesprek gaat over veiligheid, geld, gezondheid, verdriet of
               iets anders waar een bui niets te zoeken heeft
     kind   -> RTF, een kind of tiener
     werk   -> werkvloer (zaak, personeel, kantoor)
     In alle drie de gevallen: geen stemming, gewoon rustig en warm. */
  function stemmingVoor({ ernst, kind, werk } = {}) {
    if (ernst || kind || werk) return null;
    const s = stemmingNu();
    const stand = OP_ID[s.id] || OP_ID.gewoon;
    if (stand.id === 'gewoon') return stand.zin;
    return 'Je stemming vandaag: ' + stand.zin +
      ' Dit raakt alleen HOE je praat, nooit wat je doet: je helpt even goed, even snel en even ' +
      'zorgvuldig als altijd, en je laat het nooit op de persoon voor je neerslaan. ' +
      'Gaat het gesprek over iets zwaars, dan laat je je bui meteen los.';
  }

  /* Voor het scherm en de boardroom: welke stand, hoe lang nog. */
  function stemmingToon() {
    const s = stemmingNu();
    const stand = OP_ID[s.id] || OP_ID.gewoon;
    return {
      id: stand.id, sinds: s.sinds, vast: !!s.vast,
      restMin: s.vast ? null : Math.max(0, Math.round((s.tot - nu()) / 60000)),
      standen: STANDEN.map(x => ({ id: x.id }))
    };
  }

  // De boardroom mag een stand vastzetten of weer loslaten.
  function stemmingZet(id, vast) {
    const p = pot();
    if (id && !OP_ID[id]) return { status: 400, error: 'Deze stemming kennen we niet.' };
    if (id) { p.id = id; p.sinds = new Date().toISOString(); p.tot = nu() + 2 * 3600000; }
    p.vast = !!vast;
    if (!p.vast && !id) { p.tot = 0; stemmingNu(); }
    save();
    return { status: 200, ok: true, stemming: stemmingToon() };
  }

  return { stemmingNu, stemmingVoor, stemmingToon, stemmingZet, STANDEN };
};
