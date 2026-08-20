/* RTG Vonk, deelbestand "halfweg": MEET HALFWAY.

   Vonk had de tafel-in-het-midden al: bij een match wordt automatisch een zaak
   rond het geografische midden van de twee woonplaatsen gereserveerd. Dat is
   efficient en het blijft staan. Wat eraan ontbrak is KEUZE en CONTEXT.

   DRIE PLEKKEN, GELIJK REIZEN, BLIND KIEZEN (ONTMOETEN.md par. 3.6). Vonk zet
   drie mogelijkheden klaar rond het midden -- van verschillende soort, want
   koffie is geen diner -- en beiden kiezen zonder te zien wat de ander koos.
   Dezelfde keuze: rond. Verschillende keuze: allebei zien nu allebei de keuzes
   en een van de twee kan met een tik meegaan. Geen onderhandeling van vijftig
   berichten.

   WAAROM BLIND. Wie als eerste kiest, zet anders de toon; de tweede gaat mee uit
   beleefdheid en niemand weet meer wat de ander eigenlijk wilde. Dat is dezelfde
   redenering als bij de wederzijdse like. Zodra beiden hebben gekozen is de
   blindheid klaar -- dan is het geen stem over een mens maar een afspraak over
   een cafe, en beide keuzes zichtbaar maken helpt om eruit te komen.

   ---------------------------------------------------------------------------
   DE PLEK KENT DE CONTEXT, EN HIER DRAAIT EEN DEFAULT OM

   Een lid kan eisen stellen aan de PLEK: rolstoeltoegankelijk, prikkelarm,
   halal, kosher, vegan, zonder alcohol. Die eisen gelden voor allebei -- wat de
   een nodig heeft, geldt voor de plek waar ze samen komen.

   > **Een zaak die niets heeft verklaard, voldoet NIET.**

   Dat is het omgekeerde van de voorkeurstaal in ./wensen.js, waar een leeg veld
   juist geen tegenstelling is. Het verschil is het gevolg. Een partner die niets
   over kinderen zei kost u een gesprek; een zaak die niets over een drempel zei
   kost u de avond, en dat overkomt precies de mensen die het al moeilijker
   hebben. Bij mensen is twijfel dus een open punt, bij drempels een nee.

   WAT DAT VANDAAG BETEKENT, EERLIJK GEZEGD. Vrijwel geen enkele zaak in dit huis
   heeft `geschikt` ingevuld -- er is nog geen leveranciersscherm waar een
   ondernemer dat opgeeft, en dat is een gat en geen ontwerp. Zolang dat zo is,
   levert een harde eis weinig of geen opties op. Dat is de goede kant om fout te
   gaan: liever "wij weten het niet" dan een rolstoelgebruiker naar een trap
   sturen. `waarom` in het antwoord zegt met zoveel woorden hoeveel zaken op de
   eis afvielen, zodat het gat zichtbaar is in plaats van als lege lijst te
   verschijnen.

   BUDGET WORDT GEREKEND, NIET GEVRAAGD AAN DE ZAAK. De prijsklasse komt uit de
   menuprijzen die er al staan (mediaan), en niet uit een sterretje dat iemand
   zelf koos. Zonder menu is er geen klasse, en dan telt de eis niet mee in
   plaats van te gokken. Het budget van een lid staat NOOIT op zijn profiel; het
   leeft alleen hier (ONTMOETEN.md par. 3.6). */

/* De eisen zelf wonen bij de ZAAK en niet hier: kern/geschikt.js. Vonk is een
   afnemer van die woordenlijst, niet de eigenaar ervan -- zie de kop daar. */
const G = require('../geschikt');
const EISEN = G.EISEN;

/* De soorten uitje, en welke zaaktypen ze bedienen. De typen komen uit de
   bestaande leverancierslaag; hier wordt niets nieuws verzonnen. */
const SOORTEN = [
  { id: 'koffie', label: 'koffie', types: ['restaurant', 'hotel'] },
  { id: 'borrel', label: 'een borrel', types: ['bar', 'club', 'hotel'] },
  { id: 'diner', label: 'diner', types: ['restaurant'] }
];

// prijsklassen; `egaal` is "maakt niet uit" en legt dus geen plafond op
const BUDGETTEN = ['laag', 'midden', 'hoog', 'egaal'];
const KLASSE_MAX = { laag: 15, midden: 35, hoog: Infinity };
const RANG = { laag: 1, midden: 2, hoog: 3 };

const eisIds = G.IDS;

/* Wat een lid van de PLEK vraagt. Staat los van `kenmerken` in ./wensen.js, en
   dat is met opzet: "ik drink geen alcohol" is iets anders dan "de plek moet
   zonder alcohol kunnen". Iemand die niet drinkt kan zich prima in een bar
   vermaken. Het een uit het ander afleiden zou een gok zijn die eruitziet als
   een feit (LIFE.md par. 4.3). */
function zetDatewens(oud, data) {
  const p = { eisen: [], budget: 'egaal', soorten: [], ...(oud || {}) };
  if (!data || typeof data !== 'object') return p;
  if (Array.isArray(data.eisen)) p.eisen = EISEN.filter(e => data.eisen.includes(e.id)).map(e => e.id);
  if (BUDGETTEN.includes(data.budget)) p.budget = data.budget;
  if (Array.isArray(data.soorten)) p.soorten = SOORTEN.filter(s => data.soorten.includes(s.id)).map(s => s.id);
  return p;
}

// de prijsklasse van een zaak uit zijn menu; null als er niets te rekenen valt
function klasseVan(s) {
  const prijzen = (s.menu || []).map(m => Number(m.price)).filter(p => isFinite(p) && p > 0).sort((a, b) => a - b);
  if (!prijzen.length) return null;
  const mediaan = prijzen[Math.floor(prijzen.length / 2)];
  return mediaan <= KLASSE_MAX.laag ? 'laag' : mediaan <= KLASSE_MAX.midden ? 'midden' : 'hoog';
}

// het strengste van twee budgetten; 'egaal' legt niets op
function budgetPlafond(a, b) {
  const r = [a, b].filter(x => x && x !== 'egaal').map(x => RANG[x]).filter(Boolean);
  return r.length ? Math.min(...r) : null;
}

/* De drie plekken.

   `mid` is het geografische midden, `afstandM` een meter en `reisMin` een
   schatting -- allebei aangeleverd, want deze module rekent niet zelf aan
   aardbollen. `waarom` telt wat er per reden afviel, zodat een lege of korte
   lijst zichzelf verklaart. */
function drieOpties({ a, b, suppliers, mid, afstandM, reisMin }) {
  const wa = a.datewens || {}, wb = b.datewens || {};
  const eisen = [...new Set([...(wa.eisen || []), ...(wb.eisen || [])])].filter(e => eisIds.has(e));
  const plafond = budgetPlafond(wa.budget, wb.budget);
  const gewild = [...new Set([...(wa.soorten || []), ...(wb.soorten || [])])];
  const waarom = { eis: 0, budget: 0, soort: 0, zonderPlek: 0 };

  const kandidaten = [];
  for (const s of Object.values(suppliers || {})) {
    if (!(s.tables || []).length) continue;
    if (s.settings && s.settings.reservationsOpen === false) continue;
    if (!s.loc || !isFinite(s.loc.lat) || !isFinite(s.loc.lng)) { waarom.zonderPlek++; continue; }

    // de eisen: alleen wat de zaak ZELF heeft verklaard telt (zie de kop)
    if (eisen.length && !G.voldoet(s, eisen)) { waarom.eis++; continue; }

    const klasse = klasseVan(s);
    if (plafond && klasse && RANG[klasse] > plafond) { waarom.budget++; continue; }

    const soorten = SOORTEN.filter(x => x.types.includes(s.type))
      .filter(x => !gewild.length || gewild.includes(x.id));
    if (!soorten.length) { waarom.soort++; continue; }

    const naarA = afstandM(a, s.loc), naarB = afstandM(b, s.loc);
    if (naarA == null || naarB == null) { waarom.zonderPlek++; continue; }
    kandidaten.push({
      s, klasse, soorten,
      /* "Gelijke reistijd" is de belofte, dus het verschil weegt zwaarder dan de
         som: een plek om de hoek bij de een en een uur rijden voor de ander is
         geen halverwege. */
      scheef: Math.abs(naarA - naarB),
      midAf: afstandM({ lat: mid.lat, lng: mid.lng }, s.loc),
      reisA: reisMin(naarA), reisB: reisMin(naarB)
    });
  }

  kandidaten.sort((x, y) => (x.scheef - y.scheef) || (x.midAf - y.midAf));

  /* HOOGUIT EEN PER SOORT, en dus hooguit drie. Anders krijgt een lid drie keer
     diner en is "kiezen" een woord zonder inhoud.

     Er wordt bewust NIET aangevuld tot drie met nog een restaurant. Dat leek
     eerst gastvrijer, maar het maakt de belofte onwaar: bij twee soorten in de
     buurt hoort een lid twee opties te zien en niet een derde die hetzelfde is.
     `waarom` verklaart een korte lijst; een korte lijst is geen storing. */
  const uit = [], gebruikt = new Set();
  for (const k of kandidaten) {
    const soort = k.soorten.find(x => !gebruikt.has(x.id));
    if (!soort) continue;
    gebruikt.add(soort.id);
    uit.push(maakOptie(k, soort));
    if (uit.length === SOORTEN.length) break;
  }
  return { opties: uit, waarom };
}

function maakOptie(k, soort) {
  return {
    id: soort.id + ':' + k.s.code, soort: soort.id, soortLabel: soort.label,
    supplierCode: k.s.code, supplierName: k.s.name,
    plek: (k.s.loc && k.s.loc.label) || k.s.city || '',
    klasse: k.klasse, reisMinA: k.reisA, reisMinB: k.reisB,
    middenAfstandKm: k.midAf == null ? null : Math.round(k.midAf / 100) / 10
  };
}

// de lijstjes zoals een scherm ze nodig heeft
const tafelkaart = () => ({
  eisen: G.lijst(), soorten: SOORTEN.map(s => ({ id: s.id, label: s.label })),
  budgetten: BUDGETTEN.slice()
});

module.exports = { EISEN, SOORTEN, BUDGETTEN, zetDatewens, klasseVan, budgetPlafond,
  drieOpties, tafelkaart };
