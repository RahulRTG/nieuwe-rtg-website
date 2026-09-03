#!/usr/bin/env node
/* WAT KAN DIT SCHERM VEROORZAKEN -- gedrag voor public/.

   CODEWERELD.json splitst het bronbereik in structuur, relatie en gedrag. Voor
   `public/` stond die derde teller op 6,6%: over vrijwel elk scherm was geen
   enkele uitspraak te doen die verder gaat dan "het bestaat" en "het noemt dit
   pad". SCHERMROUTES.json heeft dat tweede opgelost, maar dat is een RELATIE en
   geen gedrag -- die vergissing staat in CODE.md par. 0.3 met naam en toenaam.

   Dit register maakt er wel een gedragsuitspraak van, en het verzint daarvoor
   niets: het STELT SAMEN uit metingen die al bestaan.

     SCHERMROUTES.json  welk scherm noemt welk pad
     ROUTEBRON.json     welke routes bestaan er op dat pad
     SCHRIJFANALYSE.json schrijft die route (ja / nee / onbekend)
     EXECUTION_MAP.json  welke rol hij vraagt, en wat het bewijs waard is
     IDEMPROEF.json      wat een tweede aanroep doet

   DE GRENS, EN HIJ IS SCHERP. Dit is AFGELEID gedrag: wat een scherm via de API
   kan veroorzaken. Het zegt niets over wat het scherm ZELF doet -- localStorage,
   de DOM, een download, een berekening. Een scherm dat hier `schrijft: nee`
   draagt, is dus geen scherm dat niets verandert; het is een scherm dat niets
   verandert AAN DE SERVERKANT. Wie dat verwart, leest een halve meting als een
   hele.

   DE SAMENSTELREGEL IS DE ZWAARSTE UITKOMST, en dat is met opzet dezelfde
   veto-regel die scripts/schrijfanalyse.js al gebruikt: roept een scherm tien
   routes aan waarvan er een schrijft, dan kan dat scherm iets veranderen. Voor
   bewijs geldt het spiegelbeeld: het ZWAKSTE bewijs telt, want een keten is zo
   sterk als zijn zwakste schakel.

   Draaien: npm run schermgedrag -> SCHERMGEDRAG.json */
'use strict';

/* DE WACHT. Dit script rekent en SCHRIJFT bij het laden: er is geen meet()
   die je los kunt aanroepen, alles staat op het hoogste niveau. Een enkele
   laadcontrole (node -e "require('./scripts/schermgedrag')") zou het register dus
   overschrijven met wat die aanroep toevallig meet -- exact de fout waarmee
   ROLPROEF.json van 3377 beproefde routes terugviel naar 292, en het register
   zag er daarna volkomen normaal uit. Vandaar dat requiren hier niets doet.
   Wie de uitslag in code nodig heeft, leest het register. */
if (require.main !== module) return;
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const lees = naam => { try { return JSON.parse(fs.readFileSync(path.join(WORTEL, naam), 'utf8')); } catch (e) { return null; } };

const schermroutes = lees('SCHERMROUTES.json');
const routebron = lees('ROUTEBRON.json');
const schrijf = lees('SCHRIJFANALYSE.json');
const execmap = lees('EXECUTION_MAP.json');
const idem = lees('IDEMPROEF.json');

const ontbreekt = [['SCHERMROUTES.json', schermroutes], ['ROUTEBRON.json', routebron]].filter(([, j]) => !j).map(([n]) => n);
if (ontbreekt.length) {
  console.error('kan niet samenstellen: ' + ontbreekt.join(', ') + ' ontbreekt. Draai eerst die meters.');
  process.exit(1);
}

/* pad -> alle routes (methode + pad) die er echt op bestaan */
const routesOpPad = new Map();
for (const r of routebron.alleRoutes || []) {
  const [methode, ...rest] = r.split(' ');
  const pad = rest.join(' ');
  if (!routesOpPad.has(pad)) routesOpPad.set(pad, []);
  routesOpPad.get(pad).push({ sleutel: r, methode, pad });
}

const schrijftVan = new Map();
for (const r of (schrijf && schrijf.perRoute) || []) schrijftVan.set(r.route, r.schrijft);
const execVan = new Map();
for (const c of (execmap && execmap.capabilities) || []) {
  if (!execVan.has(c.pad)) execVan.set(c.pad, []);
  execVan.get(c.pad).push(c);
}
const idemVan = new Map();
for (const r of (idem && idem.perRoute) || []) idemVan.set((r.methode || 'POST') + ' ' + r.pad, r.idempotentie);

/* De zwaarste uitkomst wint bij schrijven; het zwakste bewijs wint bij bewijs.
   Onbekend is in beide gevallen NIET hetzelfde als de gunstige uitkomst. */
const RANG_SCHRIJFT = { ja: 3, onbekend: 2, nee: 1 };
/* De bewijsladder van dit huis, zwak naar sterk. Alleen waarden die in
   VERTROUWEN.json/EXECUTION_MAP.json ECHT voorkomen staan hier met een plaats;
   de eerste versie van deze tabel bevatte vijf waarden waarvan er twee bestonden
   -- een rangorde uit het hoofd in plaats van uit de data, en dan bepaalt een
   `|| 4` stilletjes de uitkomst.

   Wat hier NIET staat, is niet middelmatig maar het ZWAKST: een onbekende
   bewijswaarde hoort een keten omlaag te trekken en niet te laten zweven. Ze
   worden bovendien apart gemeld, zodat een nieuwe waarde in de bron zichtbaar
   wordt in plaats van opgeslokt. */
const RANG_BEWIJS = { bewezen: 1, verschaald: 2, verzwakt: 3, ongemeten: 4, ONBEPAALD: 5, geschorst: 6 };
const onbekendeBewijswaarden = new Map();
function rangBewijs(waarde) {
  if (RANG_BEWIJS[waarde] != null) return RANG_BEWIJS[waarde];
  onbekendeBewijswaarden.set(waarde, (onbekendeBewijswaarden.get(waarde) || 0) + 1);
  return 99;                                        // onbekend = zwakst, nooit stil middelmatig
}

let commit = 'onbekend';
try { commit = execSync('git rev-parse --short HEAD', { cwd: WORTEL }).toString().trim(); } catch (e) { /* geen git */ }

const basisPaden = new Set(schermroutes.basisPadLijst || []);
const perScherm = [];
for (const s of schermroutes.perScherm || []) {
  const geraakt = [];
  for (const pad of s.exact || []) for (const r of routesOpPad.get(pad) || []) geraakt.push(r.sleutel);

  let schrijftUit = null, bewijsUit = null, rollen = new Set(), herhaling = new Set();
  for (const sleutel of geraakt) {
    const sch = schrijftVan.get(sleutel);
    if (sch && (!schrijftUit || RANG_SCHRIJFT[sch] > RANG_SCHRIJFT[schrijftUit])) schrijftUit = sch;
    const pad = sleutel.split(' ').slice(1).join(' ');
    for (const c of execVan.get(pad) || []) {
      if (c.rol) rollen.add(c.rol);
      const b = c.bewijs || 'onbekend';
      if (!bewijsUit || rangBewijs(b) > rangBewijs(bewijsUit)) bewijsUit = b;
    }
    const h = idemVan.get(sleutel); if (h) herhaling.add(h);
  }

  /* Een scherm zonder een enkele herleide route krijgt GEEN gunstige uitkomst
     maar `niet vast te stellen`. Dat is de helft van de waarde van dit register:
     zeggen waar het ophoudt. */
  const geenGrond = geraakt.length === 0;
  perScherm.push({
    bestand: s.bestand,
    padenGenoemd: (s.exact || []).length,
    voorvoegsels: (s.voorvoegsels || []).length,
    routesGeraakt: geraakt.length,
    schrijft: geenGrond ? 'niet vast te stellen' : (schrijftUit || 'niet vast te stellen'),
    bewijs: geenGrond ? 'niet vast te stellen' : (bewijsUit || 'niet vast te stellen'),
    rollen: [...rollen].sort(),
    herhaling: [...herhaling].sort(),
    /* WAAROM er niets te zeggen valt, per geval. Een lege reden naast `niet
       vast te stellen` laat de lezer raden of de meter faalde of dat er niets
       te meten viel -- en dat zijn twee verschillende dingen. */
    reden: geenGrond
      ? ((s.exact || []).some(p => basisPaden.has(p))
        ? 'het genoemde pad is een STAM van bestaande routes (' + (s.exact || []).filter(p => basisPaden.has(p)).join(', ') + '), geen route op zichzelf'
        : ((s.voorvoegsels || []).length
          ? 'dit scherm bouwt zijn paden op (sjabloon of optelling); daar hoort geen route bij die statisch te vinden is'
          : 'geen van de genoemde paden is een bestaande route'))
      : (schrijftUit ? null : 'de routes van dit scherm staan niet in SCHRIJFANALYSE.json, dus over schrijven is hier niets bekend')
  });
}

const tel = (veld, waarde) => perScherm.filter(s => s[veld] === waarde).length;
const metGrond = perScherm.filter(s => s.routesGeraakt > 0);

const uit = {
  /* Wat voor SOORT bewering doet dit register? `index` = structuur en
     relaties (waar woont wat, wat hangt met wat samen). `meting` = een
     uitspraak over gedrag (schrijft het, klopt het, is het bewezen). Het
     verschil is niet cosmetisch: een index noemt bijna alles en maakt elke
     dekkingsvraag triviaal waar, dus scripts/codewereld.js telt hem apart. */
  soort: 'meting',
  uitleg: 'Wat een scherm in public/ via de API kan veroorzaken: schrijft het, welke rol vraagt het, wat is het bewijs waard, en wat doet een tweede aanroep. Samengesteld uit bestaande metingen -- hier wordt niets nieuws gemeten en niets geraden.',
  stempel: { op: new Date().toISOString().slice(0, 10), commit },
  grond: ['SCHERMROUTES.json', 'ROUTEBRON.json', 'SCHRIJFANALYSE.json', 'EXECUTION_MAP.json', 'IDEMPROEF.json'],
  grens: 'AFGELEID gedrag: wat het scherm via de API kan veroorzaken. NIET wat het scherm zelf doet (localStorage, DOM, een berekening). `schrijft: nee` betekent dus "verandert niets aan de serverkant" en niet "verandert niets".',
  samenstelregel: 'schrijven: de ZWAARSTE uitkomst wint (een van de tien routes schrijft = dit scherm kan iets veranderen). Bewijs: het ZWAKSTE telt, want een keten is zo sterk als zijn zwakste schakel. Onbekend is in beide gevallen niet de gunstige uitkomst.',
  gemeten: {
    schermen: perScherm.length,
    metGrond: metGrond.length,
    zonderGrond: perScherm.length - metGrond.length,
    schrijftJa: tel('schrijft', 'ja'),
    schrijftNee: tel('schrijft', 'nee'),
    schrijftOnbekend: tel('schrijft', 'onbekend'),
    schrijftNietVastTeStellen: tel('schrijft', 'niet vast te stellen'),
    /* De VERDELING en niet een handvol gekozen bakjes. `bewijsGeschorst: 0`
       leest als een geruststelling terwijl die waarde in dit huis simpelweg
       nergens voorkomt; een verdeling kan dat verschil niet verbergen. */
    bewijsVerdeling: perScherm.reduce((m, x) => { m[x.bewijs] = (m[x.bewijs] || 0) + 1; return m; }, {}),
    bewijsBewezen: tel('bewijs', 'bewezen'),
    bewijsVerzwakt: tel('bewijs', 'verzwakt'),
    bewijsNietVastTeStellen: tel('bewijs', 'niet vast te stellen'),
    onbekendeBewijswaarden: [...onbekendeBewijswaarden].map(([waarde, aantal]) => ({ waarde, aantal })),
    zonderRol: metGrond.filter(s => !s.rollen.length).length
  },
  /* De bestanden die dit register wel NOEMT maar waarover het niets zegt. Ze
     staan er met hun reden in -- dat is de helft van de waarde -- maar ze mogen
     niet als dekking tellen. Anders stijgt de gedragsteller doordat een meter
     erbij komt die over een derde van zijn onderwerp zwijgt, en dat is precies
     de fout die CODEWERELD.json twee keer eerder maakte.
     scripts/codewereld.js trekt deze lijst af. */
  zonderUitspraak: perScherm.filter(x => x.routesGeraakt === 0).map(x => x.bestand).sort(),
  perScherm: perScherm.sort((a, b) => b.routesGeraakt - a.routesGeraakt)
};

fs.writeFileSync(path.join(WORTEL, 'SCHERMGEDRAG.json'), JSON.stringify(uit, null, 1) + '\n');
const g = uit.gemeten;
console.log('SCHERMGEDRAG.json geschreven');
console.log('  schermen    ', g.schermen, '| met grond:', g.metGrond, '| zonder grond:', g.zonderGrond);
console.log('  schrijft    ', 'ja', g.schrijftJa + ', nee', g.schrijftNee + ', onbekend', g.schrijftOnbekend + ', niet vast te stellen', g.schrijftNietVastTeStellen);
console.log('  bewijs      ', Object.entries(g.bewijsVerdeling).map(([k, v]) => k + ': ' + v).join(', '));
if (g.onbekendeBewijswaarden.length) console.log('  LET OP: onbekende bewijswaarde(n):', g.onbekendeBewijswaarden.map(x => x.waarde + ' (' + x.aantal + 'x)').join(', '),
  '-- die zijn als ZWAKST gerekend; zet ze in RANG_BEWIJS als ze een plaats horen te hebben');
console.log('  zonder rol  ', g.zonderRol, 'schermen raken alleen routes zonder rol in EXECUTION_MAP');
