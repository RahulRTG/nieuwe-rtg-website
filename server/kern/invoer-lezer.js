/* DE LEZERS VAN DE INVOERBALIE (hoort bij kern/invoer.js) -- REIZEN.md fase 2.

   WAT HIER GEBEURT: van een document of een stuk tekst een VOORSTEL maken. Geen
   reisonderdeel, een voorstel -- bevestigen doet de mens (zie de kop van
   invoer.js). Wat hier uitkomt is dus altijd een aanbod om na te kijken.

   DE REGEL DIE ALLES STUURT (REIZEN.md par. 4.4): een ingelezen waarde wordt
   nooit stilletjes verbeterd, en nooit verzonnen. Elk veld draagt daarom vier
   dingen: de WAARDE, HOE hij gelezen is, hoe ZEKER dat is, en WAARUIT hij komt.
   Wat niet gevonden is, komt niet als leeg veld terug maar helemaal niet -- een
   leeg veld leest als "er stond niets", en dat is iets anders dan "wij hebben
   het niet kunnen lezen".

   TWEE LEZERS, EN HET VERSCHIL ERTUSSEN IS DE HELE POINT.

   1. DE BOARDINGPASS (IATA BCBP, formaat M1). Dit is geen gokwerk: de strook in
      elke boardingpass-barcode heeft VASTE POSITIES. Op plaats 30 t/m 32 staat
      het vertrekvliegveld, en nergens anders. Elk veld wordt op zijn eigen vorm
      gecontroleerd (drie letters, vijf tekens vluchtnummer, een dagnummer tussen
      001 en 366); wat niet aan zijn vorm voldoet, komt niet mee. Dat is
      controleerbare extractie zoals CLAUDE.md die bedoelt: geen model, geen
      sleutel, geen netwerk.

      EEN UITZONDERING DIE ER ECHT IS, en die je niet mag wegpoetsen: HET JAAR
      STAAT ER NIET IN. De standaard kent alleen een dagnummer (dag 285), geen
      jaartal. Wij leiden het jaar af naar de eerstvolgende keer dat die dag
      voorkomt, en die afleiding krijgt daarom een lagere zekerheid en de vlag
      `afgeleid`. Een reisdatum die op een aanname berust hoort te worden
      nagekeken, ook al klopt hij meestal.

   2. VRIJE TEKST. Hier is niets vast, dus wordt er weinig beweerd. Datums en een
      bestemming worden alleen gemeld als ze ergens uit te wijzen zijn -- de
      bestemming uitsluitend als hij in de plaatsenlijst van de Reiswijzer staat
      (kern/reis.js), want dan is er iets om naar te wijzen. Een boekingsnummer
      alleen als er een woord voor staat dat zegt dat het er een is; zes hoofd-
      letters op zichzelf zijn geen boekingsnummer, en die gok zou een verkeerd
      kenmerk in een reisdossier zetten.

   ALLES WAT HIERONDER UIT PATRONEN KOMT, ZIT ONDER DE DREMPEL. Dat is geen
   bescheidenheid maar de waarheid: een datum in een e-mail is een datum in een
   e-mail, niet noodzakelijk uw vertrekdatum. */
'use strict';
const klok = require('../lib/klok');

/* Boven deze grens noemen we een veld zeker genoeg om zonder tegenspraak over
   te nemen. Eronder komt het als "na te kijken" terug -- het wordt niet
   weggelaten en ook niet stil overgenomen. */
const DREMPEL = 0.85;

const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli',
  'augustus', 'september', 'oktober', 'november', 'december'];
const MND_KORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

const veld = (waarde, zekerheid, hoe, uitleg, extra) =>
  Object.assign({ waarde, zekerheid, hoe, uitleg }, extra || {});

/* ---------- 1. de boardingpass (BCBP, M1) ---------- */

const stuk = (s, van, tot) => s.slice(van, tot).trim();

/* Dagnummer naar datum. Het jaar staat NIET in de barcode; we kiezen de
   eerstvolgende keer dat die dag voorkomt, gerekend vanaf vandaag met een marge
   van een week terug (wie gisteren vloog, importeert vandaag zijn pas). */
function uitDagnummer(dagnr, vandaag) {
  const nu = vandaag ? new Date(vandaag + 'T00:00:00Z') : klok.datum();
  const grens = new Date(nu.getTime() - 7 * 86400000);
  for (const jaar of [nu.getUTCFullYear(), nu.getUTCFullYear() + 1]) {
    const d = new Date(Date.UTC(jaar, 0, 1) + (dagnr - 1) * 86400000);
    if (d.getUTCFullYear() === jaar && d >= grens) return d.toISOString().slice(0, 10);
  }
  return null;
}

function leesBoardingpass(tekst, vandaag) {
  const s = String(tekst || '').replace(/\r?\n/g, ' ');
  const start = s.indexOf('M1');
  if (start < 0) return null;
  const b = s.slice(start);
  if (b.length < 58 || b[0] !== 'M' || !/[1-9]/.test(b[1])) return null;

  const naam = stuk(b, 2, 22), pnr = stuk(b, 23, 30);
  const van = stuk(b, 30, 33), naar = stuk(b, 33, 36);
  const maat = stuk(b, 36, 39), vlnr = stuk(b, 39, 44);
  const dagnr = stuk(b, 44, 47), stoel = stuk(b, 48, 52);

  // elk veld op zijn eigen vorm; wat niet klopt komt niet mee
  if (!/^[A-Z]{3}$/.test(van) || !/^[A-Z]{3}$/.test(naar)) return null;
  if (!/^\d{3}$/.test(dagnr)) return null;

  const velden = {};
  const uit = 'de boardingpass-strook (IATA BCBP), vaste positie';
  /* Dat dit een VLUCHT is, staat niet in een veld maar in het formaat zelf: een
     M1-strook is een instapkaart. Dat hoort dus ook als veld terug te komen en
     niet alleen als losse eigenschap van de lezer -- anders weet de balie het
     wel en het onderdeel niet, en moet een mens invullen wat de strook al zei. */
  velden.soort = veld('vlucht', 0.99, 'bcbp', 'een M1-strook is per definitie een instapkaart voor een vlucht');
  velden.van = veld(van, 0.99, 'bcbp', uit + ' 31-33');
  velden.naar = veld(naar, 0.99, 'bcbp', uit + ' 34-36');
  if (/^[A-Z0-9]{2,3}$/.test(maat) && /^\d{1,4}[A-Z]?$/.test(vlnr))
    velden.vlucht = veld(maat + vlnr.replace(/^0+/, ''), 0.97, 'bcbp', uit + ' 37-44');
  if (/^[A-Z0-9]{5,7}$/.test(pnr)) velden.kenmerk = veld(pnr, 0.95, 'bcbp', uit + ' 24-30');
  if (/^[A-Z\/ .-]{3,}$/.test(naam) && naam.includes('/'))
    velden.reiziger = veld(naam, 0.95, 'bcbp', uit + ' 3-22');
  if (/^\d{1,3}[A-Z]$/.test(stoel)) velden.stoel = veld(stoel, 0.9, 'bcbp', uit + ' 49-52');

  const dag = uitDagnummer(Number(dagnr), vandaag);
  if (dag) velden.van_datum = veld(dag, 0.8, 'bcbp',
    'dagnummer ' + dagnr + ' uit de strook; het JAAR staat niet in een boardingpass en is afgeleid naar de eerstvolgende keer dat deze dag voorkomt',
    { afgeleid: true });

  return { soort: 'vlucht', hoe: 'bcbp', velden, code: b.slice(0, 60).trim() };
}

/* ---------- 2. vrije tekst ---------- */

function datums(t) {
  const uit = [];
  const zet = (j, m, d, ruw) => {
    if (m < 1 || m > 12 || d < 1 || d > 31) return;
    const iso = String(j) + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    if (!isNaN(Date.parse(iso + 'T00:00:00Z'))) uit.push({ iso, ruw });
  };
  for (const m of t.matchAll(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g)) zet(+m[1], +m[2], +m[3], m[0]);
  for (const m of t.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/g)) zet(+m[3], +m[2], +m[1], m[0]);
  for (const m of t.matchAll(/\b(\d{1,2})\s+([a-zà-ÿ]{3,10})\.?\s+(20\d{2})\b/gi)) {
    const naam = m[2].toLowerCase();
    let mnd = MAANDEN.indexOf(naam);
    if (mnd < 0) mnd = MND_KORT.indexOf(naam.slice(0, 3));
    if (mnd >= 0) zet(+m[3], mnd + 1, +m[1], m[0]);
  }
  return uit.sort((a, b) => a.iso.localeCompare(b.iso));
}

const SOORTWOORDEN = [
  ['vlucht', /\b(boarding\s?pass|boardingkaart|vlucht|flight|gate|vertrekhal)\b/i],
  ['verblijf', /\b(hotel|kamer|room|check-?in|check-?out|nacht(en)?|appartement|villa)\b/i],
  ['vervoer', /\b(huurauto|rental|transfer|taxi|trein|train|shuttle)\b/i],
  ['activiteit', /\b(excursie|tour|ticket|entree|museum|activiteit)\b/i],
  ['tafel', /\b(restaurant|tafel|diner|reservering voor \d+ personen)\b/i]
];

function leesTekst(tekst, plaatsVind) {
  const t = String(tekst || '');
  if (!t.trim()) return null;
  const velden = {};

  for (const [soortnaam, re] of SOORTWOORDEN) {
    const m = re.exec(t);
    if (m) { velden.soort = veld(soortnaam, 0.8, 'patroon', 'het woord "' + m[0] + '" staat in de tekst'); break; }
  }

  const p = plaatsVind ? plaatsVind(t) : null;
  if (p) velden.bestemming = veld(p.plaats, 0.9, 'lijst', 'staat in ' + p.bron);

  const d = datums(t);
  if (d.length) velden.van_datum = veld(d[0].iso, 0.7, 'patroon',
    'de vroegste datum in de tekst ("' + d[0].ruw + '"); dat hoeft niet de vertrekdatum te zijn');
  if (d.length > 1) velden.tot_datum = veld(d[d.length - 1].iso, 0.7, 'patroon',
    'de laatste datum in de tekst ("' + d[d.length - 1].ruw + '")');

  /* Een boekingsnummer alleen als er een woord voor staat dat zegt dat het er
     een is. Zes hoofdletters op zichzelf zijn geen kenmerk, en die gok zou een
     verkeerd nummer in een reisdossier zetten. */
  const k = /\b(?:boekingsnummer|boekingscode|bevestigingsnummer|reserveringsnummer|booking\s?(?:ref(?:erence)?|number)|confirmation|pnr)\b\s*[:#]?\s*([A-Z0-9]{5,10})\b/i.exec(t);
  if (k) velden.kenmerk = veld(k[1].toUpperCase(), 0.9, 'patroon', 'staat achter "' + k[0].split(/[:#\s]/)[0] + '" in de tekst');

  return Object.keys(velden).length ? { soort: (velden.soort || {}).waarde || null, hoe: 'patroon', velden } : null;
}

/* ---------- samen ---------- */

function lees(tekst, { plaatsVind, vandaag } = {}) {
  const pas = leesBoardingpass(tekst, vandaag);
  const vrij = leesTekst(tekst, plaatsVind);
  if (!pas && !vrij) return null;
  /* De boardingpass wint per veld van de vrije tekst: een vaste positie in een
     genormeerde strook is sterker bewijs dan een woord dat toevallig ook in de
     e-mail eronder staat. De vrije tekst vult alleen aan wat de strook niet
     kent -- een bestemming in mensentaal bijvoorbeeld. */
  const velden = Object.assign({}, (vrij || {}).velden, (pas || {}).velden);
  const onzeker = Object.keys(velden).filter(n => velden[n].zekerheid < DREMPEL);
  return {
    // het soort is een gewoon veld geworden; dit is de samenvatting ervan
    soort: (velden.soort || {}).waarde || null,
    hoe: pas ? 'bcbp' : 'patroon',
    code: pas ? pas.code : null,
    velden, onzeker, zeker: !onzeker.length
  };
}

module.exports = { lees, leesBoardingpass, leesTekst, datums, uitDagnummer, DREMPEL };
