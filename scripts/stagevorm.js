#!/usr/bin/env node
/* ============================================================================
   DE STAGEVORM -- is "Moment" een gedeeld object, of een projectie?

   DE VRAAG KOMT UIT STAGE.md par. 0. Het voorstel voor RTG Stage rust op een
   bewering die aantrekkelijk klinkt:

     "De nieuwe fundamentele eenheid moet Moment worden. Niet post, niet video,
      niet event, niet ticket. Er gebeurt iets rondom een mens of organisatie,
      op een bepaald moment, met mogelijke acties."

   Dat KAN waar zijn. Of het waar IS, is een meting, en dit huis heeft die vraag
   al twee keer verkeerd zien beantwoorden: `Asset` klonk net zo vanzelfsprekend
   over tafel, kamer, podium en leaseauto (OBJECTMODEL.json), en de carrierelus
   klonk vanzelfsprekend over vijftien talentdomeinen (CARRIEREVORM.json). Allebei
   sneuvelden ze toen iemand ze tegen de code hield.

   DAAROM DEZELFDE METHODE EN NIET EEN TWEEDE. Dit bestand leest niet zelf; het
   hergebruikt `lees()`, `wring()` en `domeinVan()` uit scripts/objectmodel.js.
   Twee meters met elk een eigen parser geven binnen een maand twee getallen over
   hetzelfde (LAT.md regel 4), en dan is de vergelijking met de Asset-meting
   waardeloos -- want daar rust de conclusie juist op.

   ER WORDT DRIE KEER GEMETEN, EN DE DRIE ANTWOORDEN ZIJN NIET HETZELFDE.

   A. DE NAAM. Is `moment` vrij? Dit is dezelfde vraag die SEMANTIEK.json over
      123 namen stelde, nu over de naam die het HELE nieuwe onderwerp zou gaan
      dragen. Een centrale naam die al vijf betekenissen draagt, is de
      `VERMOGENS`-botsing opnieuw -- en die kost het meest op precies de plek
      waar hij het minst opvalt. Er wordt op DATAVORMEN geteld en niet op het
      Nederlandse woord: `wring()` haalt eerst commentaar en tekenreeksen eruit,
      anders telt "op dit moment" in een uitleg mee. (Zonder die wringer: 499
      bestanden. Dat getal meet de taal, niet de code.)

   B. DE VORM. Delen de publieke domeinen werkelijk velden, na aftrek van de
      envelop? Zelfde rekenwijze als CARRIEREVORM.json, zodat de uitkomsten naast
      elkaar te leggen zijn. Een hoog percentage domeineigen velden betekent: een
      Moment-OBJECT met een `extra`-veld voor al het onderscheidende, en dan heeft
      wie erop bouwt acht keer werk in plaats van een keer.

   C. DE HAAK. Dit is de enige van de drie die over BOUWEN gaat in plaats van
      over benoemen. De momentmotor bestaat namelijk al in embryo:
      `kern/mediaos/wekken.js` wordt door de domeinen aangeroepen via de laat
      gebonden haak `nieuwWerk(key, soort, titel)`. De vraag is dus niet of hij
      gebouwd moet worden maar HOEVER hij reikt: welke publieke domeinen roepen
      hem vandaag aan, en welke hebben wel een publieke gebeurtenis en geen haak.

   WAT DEZE METER MET OPZET NIET MEET, en dat hoort er hard bij te staan:

   - Of de momentmotor als PROCES kan bestaan. Dat is een andere vraag dan of de
     DATA een vorm deelt, en KETENVORM.json is precies waarom die twee uit elkaar
     moeten (0 van 13 gedeelde actoren, terwijl de ketens wel degelijk werkten).
     Voor de procesvraag is de vorm een ketenproef, niet deze meter.
   - Of een gedeelde NAAM een gedeelde BETEKENIS is. Meting A wijst botsingen
     aan; of twee `momenten` werkelijk hetzelfde zijn, beslist een mens die de
     twee bestanden opent. Daarom staat bij elke treffer WAAR hij vandaan komt.
   - Wat er bij runtime ontstaat. Er wordt gelezen wat er in de bron STAAT.

   Draai: node scripts/stagevorm.js            (leesbaar)
          node scripts/stagevorm.js --json     (voor de ratel)
          npm run stagevorm:vast               (schrijft STAGEVORM.json)
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const om = require('./objectmodel.js');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');

/* DE PUBLIEKE DOMEINEN: waar er vandaag iets gebeurt dat een ANDER mag zien.
   Met opzet RUIM, om dezelfde reden als bij carrierevorm: een domein dat er ten
   onrechte bij staat verlaagt hooguit de gedeeldheid, terwijl een domein dat
   ontbreekt juist een gedeelde vorm verbergt. En de lijst staat hier en niet in
   STAGE.md, want een lijst in een document loopt achter op de code zodra iemand
   een domein hernoemt. */
const DOMEINEN = /^server\/(kern\/)?(podium|theater|clips|muziek|mediaos|salon|festival|sportclub|creator|events|galerij)\b/;

/* EEN BESTAND IS GEEN DOMEIN. `om.domeinVan` geeft per bestand in kern/ de map
   terug, en dat klopt voor kern/podium/ maar niet voor kern/muziek-uitgave.js --
   dan zouden Klankwerk en Clips als zeven losse domeinen meetellen en ZAKT de
   gedeeldheid door een schrijfwijze in plaats van door een bevinding. De
   platte bestanden worden daarom op hun stam samengenomen. */
function stageDomein(module) {
  const d = om.domeinVan(module);
  const m = /^kern\/([a-z]+)(?:-|$)/.exec(d);
  return m ? 'kern/' + m[1] : d;
}

/* ---------------------------------------------------------------------------
   A. DE NAAM -- draagt `moment` al betekenissen?
   ------------------------------------------------------------------------ */
/* De kandidaat-kernbegrippen uit het voorstel. Per stuk wordt geteld op hoeveel
   plekken hij als DATAVORM voorkomt: een veld of variabele die aan een literaal
   wordt toegekend. Dat is precies genoeg om "hier woont een ding met deze naam"
   te betekenen, en te precies om het Nederlandse woord te vangen. */
const KANDIDATEN = ['moment', 'momenten', 'presence', 'broadcast', 'drop', 'capsule', 'stage'];

function namen() {
  const paden = om.BRONNEN.reduce((a, m) => om.bestanden(m, a), []);
  const uit = new Map(KANDIDATEN.map(k => [k, []]));
  for (const p of paden) {
    const s = om.wring(fs.readFileSync(path.join(WORTEL, p), 'utf8'));
    for (const k of KANDIDATEN) {
      /* `naam: {`, `naam: [`, `naam = {`, `naam = [` -- een toekenning aan een
         literaal. Een aanroep (`moment(`) of een vergelijking telt niet mee. */
      const re = new RegExp('\\b' + k + '\\s*[:=]\\s*[\\[{]', 'g');
      if (re.test(s)) uit.get(k).push(p);
    }
  }
  return KANDIDATEN.map(k => ({
    naam: k,
    plekken: uit.get(k).length,
    /* De domeinen zijn de ONDERGRENS van het aantal betekenissen: twee vormen in
       hetzelfde domein zijn meestal hetzelfde ding, twee in verschillende
       domeinen meestal niet. Meestal, dus een mens kijkt na. */
    domeinen: [...new Set(uit.get(k).map(stageDomein))].sort(),
    waar: uit.get(k).slice(0, 12)
  })).sort((a, b) => b.plekken - a.plekken);
}

/* ---------------------------------------------------------------------------
   B. DE VORM -- delen de publieke domeinen velden?
   ------------------------------------------------------------------------ */
function vorm() {
  const g = om.lees();
  const envelop = new Set(JSON.parse(fs.readFileSync(path.join(WORTEL, 'OBJECTMODEL.json'), 'utf8')).envelop);

  const perDomein = new Map();
  let vormen = 0;
  for (const v of g.vormen) {
    if (!DOMEINEN.test(v.module)) continue;
    vormen++;
    const d = stageDomein(v.module);
    if (!perDomein.has(d)) perDomein.set(d, new Set());
    for (const f of v.velden) if (!envelop.has(f)) perDomein.get(d).add(f);
  }

  const domeinen = [...perDomein.keys()].sort();
  const veldDom = new Map();
  for (const d of domeinen) {
    for (const f of perDomein.get(d)) {
      if (!veldDom.has(f)) veldDom.set(f, []);
      veldDom.get(f).push(d);
    }
  }

  const n = domeinen.length;
  const helft = Math.ceil(n / 2);
  const lijst = [...veldDom.entries()]
    .map(([veld, waar]) => ({ veld, domeinen: waar.length, waar }))
    .sort((a, b) => b.domeinen - a.domeinen || a.veld.localeCompare(b.veld));
  const eigen = lijst.filter(x => x.domeinen === 1).length;

  return {
    vormen,
    domeinen: n,
    velden: lijst.length,
    inAlleDomeinen: lijst.filter(x => x.domeinen === n).length,
    inMinstensDeHelft: lijst.filter(x => x.domeinen >= helft).length,
    helftDrempel: helft,
    veldenDomeineigen: eigen,
    domeineigenPct: lijst.length ? Math.round((eigen / lijst.length) * 1000) / 10 : 0,
    perDomein: domeinen.map(d => ({ domein: d, velden: perDomein.get(d).size })),
    gedeeld: lijst.filter(x => x.domeinen >= 2).slice(0, 20)
  };
}

/* ---------------------------------------------------------------------------
   C. DE HAAK -- hoever reikt de momentmotor die er al is?
   ------------------------------------------------------------------------ */
/* DE TWEE HAKEN waarmee een domein de Media OS wekt (kern/mediaos/wekken.js):

     nieuwWerk(key, soort, titel)        begint bij een MAKER met een ledensleutel
     mediaNieuwMoment(id, soort, titel)  begint bij een AANWEZIGHEID

   Allebei worden ze INGESPOTEN, en dan heten ze in het domein soms korter
   (`nieuwMoment`). Daarom staan alle drie de namen hier: een meter die alleen de
   naam aan de gevende kant kent, ziet de ontvangende kant niet.

   Die tweede kwam er op 13 september bij, omdat de eerste een festival en een
   club niet kan bedienen: die hebben geen ledensleutel. Beide tellen hier mee --
   een meter die alleen de oude haak kent, zou een domein dat wel degelijk wekt
   als onaangesloten melden, en dan daalt een getal door een hernoeming in plaats
   van door een feit. */
function haak() {
  const paden = om.BRONNEN.reduce((a, m) => om.bestanden(m, a), []);
  const roept = new Map();
  const publiek = new Set();
  for (const p of paden) {
    if (!DOMEINEN.test(p)) continue;
    publiek.add(stageDomein(p));
    const s = om.wring(fs.readFileSync(path.join(WORTEL, p), 'utf8'));
    if (/\b(nieuwWerk|nieuwMoment|mediaNieuwMoment)\s*\(/.test(s)) {
      const d = stageDomein(p);
      if (!roept.has(d)) roept.set(d, []);
      roept.get(d).push(p);
    }
  }
  const alle = [...publiek].sort();
  const met = alle.filter(d => roept.has(d));
  /* De soorten die de meldingsvoorkeur kent. Uit de BRON en niet overgetypt:
     een lijst in twee bestanden loopt uiteen (LAT.md regel 4).

     EN HIER NIET DOOR DE WRINGER. `wring()` haalt juist de TEKENREEKSEN eruit,
     en deze lijst BESTAAT uit tekenreeksen -- de eerste versie las hem gewrongen
     en gaf een lege lijst terug. Dat is de gevaarlijke faalvorm: geen fout, geen
     waarschuwing, een nul op het scherm waar geen nul is. Voor het zoeken naar
     namen is de wringer goed (commentaar mag niet meetellen), voor het LEZEN van
     een waarde is hij verkeerd. */
  const bron = fs.readFileSync(path.join(WORTEL, 'server/kern/mediaos/eigen.js'), 'utf8');
  const m = /MELD_SOORTEN\s*=\s*\[([^\]]*)\]/.exec(bron);
  const soorten = m ? m[1].split(',').map(s => s.replace(/['"\s]/g, '')).filter(Boolean) : [];
  return {
    publiekeDomeinen: alle.length,
    metHaak: met.length,
    zonderHaak: alle.filter(d => !roept.has(d)),
    soorten,
    waar: met.map(d => ({ domein: d, bestanden: roept.get(d) }))
  };
}

function meet() {
  return { gemeten: { naam: namen(), vorm: vorm(), haak: haak() } };
}

module.exports = { meet, DOMEINEN, stageDomein };

if (require.main === module) {
  const r = meet();
  const { naam, vorm: v, haak: h } = r.gemeten;
  /* GEEN process.exit() NA GROTE UITVOER. Node sluit dan af terwijl de pipe nog
     leegloopt: geldige tekst, kapotte JSON, exitcode 0. Dezelfde fout die
     scripts/meetkeuring.js bij carrierevorm.js vond. */
  if (process.argv.includes('--json')) { console.log(JSON.stringify(r)); process.exitCode = 0; return; }
  if (process.argv.includes('--vastleggen')) {
    fs.writeFileSync(path.join(WORTEL, 'STAGEVORM.json'), JSON.stringify(Object.assign({
      stempel: stempel({ instrument: 'scripts/stagevorm.js' }),
      uitleg: 'Gemeten met scripts/stagevorm.js, op de lezer van scripts/objectmodel.js. De vraag staat in STAGE.md par. 0. Drie metingen die niet hetzelfde zeggen: A de naam, B de datavorm, C het bereik van de bestaande wekhaak.',
      grens: 'Wat deze meter NIET aantoont: dat er geen gedeeld PROCES is. Hij kijkt naar bewaarde VORMEN en naar namen in de bron, niet naar werkwoorden, volgorde of uitkomst -- KETENVORM.json laat zien dat die twee vragen verschillende antwoorden geven. Meting A wijst naambotsingen aan en bewijst niet dat twee gelijknamige vormen hetzelfde BETEKENEN; dat beslist een mens die beide bestanden opent. Meting C telt of een domein de wekhaak aanroept, niet of het dat ZOU MOETEN: een domein zonder publieke gebeurtenis hoort terecht in de lijst zonder haak.',
      vastgelegd: new Date().toISOString().slice(0, 10)
    }, r), null, 2) + '\n');
    console.log('STAGEVORM.json geschreven.');
  }
  console.log('A. DE NAAM -- is het nieuwe kernbegrip vrij?');
  for (const k of naam) {
    console.log('   ' + k.naam.padEnd(10) + String(k.plekken).padStart(3) + ' plekken, ' +
      k.domeinen.length + ' domeinen' + (k.domeinen.length ? '  ' + k.domeinen.join(' ') : ''));
  }
  console.log('\nB. DE VORM -- ' + v.vormen + ' vormen in ' + v.domeinen + ' publieke domeinen');
  console.log('   velden na aftrek van de envelop : ' + v.velden);
  console.log('   in ALLE domeinen                : ' + v.inAlleDomeinen);
  console.log('   in minstens de helft (' + v.helftDrempel + ')        : ' + v.inMinstensDeHelft);
  console.log('   in precies EEN domein           : ' + v.veldenDomeineigen + ' (' + v.domeineigenPct + '%)');
  console.log('\nC. DE HAAK -- de momentmotor die er al is');
  console.log('   publieke domeinen        : ' + h.publiekeDomeinen);
  console.log('   roepen nieuwWerk() aan   : ' + h.metHaak + '  (' + h.waar.map(x => x.domein).join(' ') + ')');
  console.log('   zonder haak              : ' + h.zonderHaak.length + '  (' + h.zonderHaak.join(' ') + ')');
  console.log('   momentsoorten vandaag    : ' + h.soorten.join(', '));
}
