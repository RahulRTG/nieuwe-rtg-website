/* RTG School: de Misconception Graph -- een fout is geen fout maar een denkfout.

   "antwoord = fout" is de armste vorm van informatie die een schoolsysteem kan
   bewaren. Rijker is WELK DENKPATROON ertoe leidde: 3 x 7 = 10 is geen
   rekenfout maar optellen in plaats van vermenigvuldigen, en dat is een heel
   ander gesprek.

   Hoe dit werkt zonder te raden. Een opgave draagt sinds deze laag een FEIT:
   de bouwstenen waaruit hij is gemaakt (de twee getallen, de bewerking, de
   noemer, de eenheid). Dat feit blijft op de server -- de client krijgt alleen
   de vraag -- en met dat feit is een fout antwoord narekenbaar te duiden. Geen
   model, geen gok: 3 x 7 met antwoord 10 IS 3 + 7, en anders zeggen we niets.

   Drie grenzen die deze laag eerlijk houden:

   1. LIEVER NIETS DAN EEN GOK. Past een fout op geen enkele regel, dan is het
      gewoon een fout en zeggen we dat ook. Een verzonnen denkfout is erger dan
      geen: hij stuurt een kind een verkeerde uitleg in.
   2. EEN DENKFOUT IS EEN AANWIJZING, GEEN DOSSIER. Er wordt niets over de
      missers van een KIND bewaard; wat een klas als geheel laat zien, wordt
      geteld zonder wie erachter zat (zie school/denkfout.js).
   3. DE DUIDING IS GEEN OORDEEL. Elke tekst hieronder legt uit wat er gedacht
      is en waarom het anders werkt -- er staat nergens "fout" of "helaas".

   Aan deze laag hangt EXPLAIN DIFFERENTLY: elke denkfout wijst naar de VORM
   van uitleg die erbij helpt (visueel bij breuken, stap voor stap bij procent).
   Het leerdoel verandert niet; de weg ernaartoe wel. */

/* De catalogus (wat er gedacht is, en waarom het anders werkt) staat in
   ./leerstof-denkfout-lijst.js: dat is data, dit zijn de regels. */
const { DENKFOUTEN } = require('./leerstof-denkfout-lijst');

const getal = v => { const s = String(v == null ? '' : v).trim().replace(',', '.'); return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null; };
const cijfersOm = (a, b) => { const x = String(a), y = String(b); return x.length > 1 && x === y.split('').reverse().join(''); };

/* De regels. Elke regel is narekenbaar: hij zegt alleen iets als het gegeven
   antwoord PRECIES uitkomt op een andere bewerking met dezelfde bouwstenen. */
const REGELS = {
  som(f, g) {
    if (f.op === 'x') { if (g === f.a + f.b) return 'maal.plus-in-plaats-van-maal'; return null; }
    if (f.op === '+') {
      if (g === f.a * f.b) return 'plus.maal-in-plaats-van-plus';
      if (g === f.a - f.b || g === f.b - f.a) return 'plus.min-in-plaats-van-plus';
      return null;
    }
    if (g === f.a + f.b) return 'min.plus-in-plaats-van-min';
    return null;
  },
  tafel(f, g) { return g === f.n + f.t ? 'maal.plus-in-plaats-van-maal' : null; },
  deel(f, g) {
    if (g === f.deeltal * f.deler) return 'delen.maal-in-plaats-van-delen';
    return null;
  },
  procent(f, g) {
    if (g === f.p) return 'procent.percentage-als-antwoord';
    if (g === f.p * f.basis) return 'procent.niet-door-honderd';
    return null;
  },
  negatief(f, g) {
    if (g === Math.abs(f.start) + f.stijging) return 'negatief.min-genegeerd';
    if (g === f.start - f.stijging) return 'negatief.verkeerde-kant';
    return null;
  },
  metriek(f, g) {
    if (g === 1) return 'eenheden.niet-omgerekend';
    if (g === f.factor * 10 || g === f.factor / 10) return 'eenheden.factor-tien-mis';
    return null;
  },
  afronden(f, g) {
    const omlaag = Math.floor(f.n / f.stap) * f.stap, omhoog = omlaag + f.stap;
    const juist = Math.round(f.n / f.stap) * f.stap;
    if (g === (juist === omhoog ? omlaag : omhoog)) return 'afronden.verkeerde-kant';
    return null;
  }
};

/* De regels die niet op een getal uitkomen staan apart: ze vergelijken tekst. */
const TEKSTREGELS = {
  'breuk-som'(f, tekst) {
    const m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(tekst);
    if (!m) return null;
    return Number(m[1]) === f.a + f.b && Number(m[2]) === f.noemer * 2 ? 'breuken.noemer-opgeteld' : null;
  },
  deelrest(f, tekst) {
    return String(tekst).trim() === String(f.heel) ? 'delen.rest-weggelaten' : null;
  },
  dt(f, tekst) {
    const t = String(tekst).trim().toLowerCase();
    if (f.juist === 'hij' && t === String(f.ik).toLowerCase()) return 'dt.t-vergeten';
    if (f.juist === 'ik' && t === String(f.hij).toLowerCase()) return 'dt.t-te-veel';
    return null;
  }
};

/* De duiding zelf. Geeft null als er niets narekenbaars te zeggen valt -- en
   dat is de normale uitkomst, want de meeste fouten zijn gewoon fouten. */
function duiding(feit, juist, gegeven) {
  const tekst = String(gegeven == null ? '' : gegeven).trim();
  if (!feit || !tekst) return null;
  let id = null;
  const g = getal(tekst);
  if (REGELS[feit.soort] && g !== null) id = REGELS[feit.soort](feit, g);
  if (!id && TEKSTREGELS[feit.soort]) id = TEKSTREGELS[feit.soort](feit, tekst);
  /* De twee algemene patronen pas ALS LAATSTE: een specifieke duiding zegt
     meer dan "eentje ernaast", en 3 x 7 = 10 is geen telfout maar een plus. */
  if (!id && g !== null) {
    const j = getal(juist);
    if (j !== null) {
      if (Math.abs(j - g) === 1) id = 'algemeen.eentje-ernaast';
      else if (cijfersOm(j, g)) id = 'algemeen.cijfers-omgedraaid';
    }
  }
  return id ? Object.assign({ id }, DENKFOUTEN[id]) : null;
}

/* Explain Differently: dezelfde stof in de vorm die bij deze denkfout past.
   Valt terug op de eerste uitleg die er is, en op niets als een leerdoel er
   (nog) geen draagt -- liever niets dan dezelfde uitleg nog een keer. */
function andersUitgelegd(doel, denkfout) {
  const uitleg = (doel && doel.uitleg) || [];
  if (!uitleg.length) return null;
  const v = denkfout && denkfout.vorm;
  const gekozen = (v && uitleg.find(u => u.soort === v)) || uitleg[0];
  return { soort: gekozen.soort, tekst: gekozen.tekst };
}

module.exports = { duiding, andersUitgelegd, DENKFOUTEN };
