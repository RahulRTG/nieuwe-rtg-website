/* De postdatum-lezer: welke datums staan er in een bericht?

   WAT DIT WEL EN NIET IS. Dit leest tekst en wijst datums aan. Het zet NIETS in
   een agenda en NIETS in een tower. Wat hier uitkomt heet een VOORSTEL, en een
   mens bevestigt het -- met de zin waar het uit komt ernaast. Die scheiding is
   niet cosmetisch: een datum die uit taal is geraden en er ongezien in glijdt,
   staat op een dag op de verkeerde dag, en dan is hij erger dan afwezig.

   Precies om die reden staat de factuurvervaldatum uit RTG Facturen NIET in de
   levensgraaf: die is daar proza ("Vervalt 1 augustus 2026") en zou een termijn
   op een taalregel laten rusten. Hier mag het wel, want hier eindigt het bij een
   knop en niet bij een melding.

   DE DRIE VORMEN DIE HIJ HERKENT, en waarom niet meer:

     2026-08-14        ISO. Geen twijfel mogelijk.
     14 augustus 2026  een GESCHREVEN maand, Nederlands of Engels, in beide
                       volgordes (ook "August 14, 2026").
     20-08-2026        cijfers -- maar ALLEEN als er geen twijfel is over wat de
                       dag is en wat de maand.

   DIE LAATSTE REGEL IS DE BELANGRIJKSTE VAN DIT BESTAND. "03/04/2026" is in
   Nederland 3 april en in Amerika 4 maart, en post van een hotelketen komt uit
   allebei die werelden. Er is geen betrouwbare manier om te weten welke van de
   twee bedoeld is, en een lezer die het toch kiest, heeft in ongeveer de helft
   van de twijfelgevallen gelijk. Dus kiest hij niet: staat er geen getal boven
   de twaalf, dan wordt die datum OVERGESLAGEN -- met de reden erbij, zodat het
   scherm kan zeggen dat er iets is laten liggen. Stil weglaten zou hetzelfde
   scherm "dit was alles" laten zeggen terwijl dat niet zo is.

   EEN JAARTAL DAT ER NIET STAAT wordt de eerstvolgende keer dat die dag valt.
   Dat is een gok, maar een zichtbare: de zin staat ernaast en de mens bevestigt.

   Puur: geen database, geen klok behalve wat er als `vandaag` binnenkomt. Zo is
   hij te beproeven met twee strings in plaats van een postvak. */
'use strict';

/* Maandnamen, Nederlands en Engels, voluit en afgekort. Een tabel en geen regex
   met alternatieven: die tabel is ook het antwoord (welk nummer), en twee lijsten
   die hetzelfde moeten weten lopen uiteen (lat, regel 4). */
const MAANDEN = {};
[['januari', 'january', 'jan'], ['februari', 'february', 'feb'], ['maart', 'march', 'mrt', 'mar'],
 ['april', 'apr'], ['mei', 'may'], ['juni', 'june', 'jun'], ['juli', 'july', 'jul'],
 ['augustus', 'august', 'aug'], ['september', 'sept', 'sep'], ['oktober', 'october', 'okt', 'oct'],
 ['november', 'nov'], ['december', 'dec']
].forEach((namen, i) => namen.forEach(n => { MAANDEN[n] = i + 1; }));
const MAANDWOORD = Object.keys(MAANDEN).sort((a, b) => b.length - a.length).join('|');

// hoe ver vooruit een datum nog geloofwaardig is; daarbuiten is het eerder een
// referentienummer dat toevallig op een datum lijkt dan een afspraak
const HORIZON_DAGEN = 730;
const MAX_PER_BERICHT = 6;

const twee = n => String(n).padStart(2, '0');
const isoVan = (j, m, d) => j + '-' + twee(m) + '-' + twee(d);

/* Bestaat deze dag echt? 31 februari komt door elke vormcontrole heen en valt
   pas om als iemand hem gebruikt (lat, regel 8). Heen en terug rekenen is de
   enige controle die dat vangt. */
function echteDag(j, m, d) {
  if (!(j >= 1970 && j <= 2999) || !(m >= 1 && m <= 12) || !(d >= 1 && d <= 31)) return null;
  const iso = isoVan(j, m, d);
  const dt = new Date(iso + 'T12:00:00Z');
  return (!Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === iso) ? iso : null;
}

const dagenTussen = (van, tot) =>
  Math.round((new Date(tot + 'T12:00:00Z') - new Date(van + 'T12:00:00Z')) / 86400000);

/* Een dag-en-maand zonder jaartal: de eerstvolgende keer dat hij valt, gerekend
   vanaf vandaag. Vandaag zelf telt mee -- "de levering komt op 8 augustus" op 8
   augustus gaat over vandaag en niet over volgend jaar. */
function eerstvolgende(vandaag, m, d) {
  const jaarNu = Number(vandaag.slice(0, 4));
  for (const j of [jaarNu, jaarNu + 1]) {
    const iso = echteDag(j, m, d);
    if (iso && iso >= vandaag) return iso;
  }
  // 29 februari bestaat niet elk jaar; dan de eerstvolgende die wel bestaat
  for (let j = jaarNu; j <= jaarNu + 8; j++) {
    const iso = echteDag(j, m, d);
    if (iso && iso >= vandaag) return iso;
  }
  return null;
}

/* De zin waar een vondst in staat, zodat een mens kan zien WAAROM dit wordt
   voorgesteld. Zonder die zin is een voorstel een getal uit het niets, en dan
   kan niemand het beoordelen -- ook de bevestigknop niet. */
function zinRond(tekst, index) {
  const links = Math.max(
    tekst.lastIndexOf('.', index), tekst.lastIndexOf('\n', index),
    tekst.lastIndexOf('!', index), tekst.lastIndexOf('?', index));
  let rechts = tekst.length;
  for (const teken of ['.', '\n', '!', '?']) {
    const p = tekst.indexOf(teken, index);
    if (p >= 0 && p < rechts) rechts = p;
  }
  return tekst.slice(links + 1, rechts + 1).replace(/\s+/g, ' ').trim().slice(0, 200);
}

/* De tijd bij een datum: alleen uit DEZELFDE zin. Een tijdstip drie alinea's
   verderop hoort bij iets anders, en een verkeerde tijd op de goede dag is
   vervelender dan geen tijd. */
function tijdIn(zin) {
  let m = zin.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (m) return twee(+m[1]) + ':' + m[2];
  m = zin.match(/\b(?:om|at)\s+([01]?\d|2[0-3])\s*(?:uur|u|h)\b/i);
  if (m) return twee(+m[1]) + ':00';
  return null;
}

/* ALLE VONDSTEN, met hun plek in de tekst. Drie patronen, in deze volgorde
   geprobeerd; de eerste die past wint, en de tekens die hij opgebruikt worden
   niet nog een keer bekeken. Zo wordt "2026-08-14" niet ook nog als "08-14"
   gelezen. */
function vondsten(tekst, vandaag) {
  const raak = [], over = [];
  const patroon = new RegExp(
    '\\b(\\d{4})-(\\d{2})-(\\d{2})\\b' +                                   // 1-3   ISO
    '|\\b(\\d{1,2})\\s*(?:e|ste|de|th|st|nd|rd)?\\s+(' + MAANDWOORD + ')' + // 4-5   14 augustus
      '\\.?\\s*(\\d{4})?\\b' +                                             // 6     jaartal
    '|\\b(' + MAANDWOORD + ')\\s+(\\d{1,2})\\s*(?:,\\s*(\\d{4}))?\\b' +    // 7-9   August 14, 2026
    '|\\b(\\d{1,2})[-./](\\d{1,2})(?:[-./](\\d{2,4}))?\\b',                // 10-12 cijfers
    'gi');
  let m;
  while ((m = patroon.exec(tekst)) !== null) {
    const plek = m.index;
    if (m[1]) { neem(echteDag(+m[1], +m[2], +m[3]), m[0], plek, 'onmogelijke datum'); continue; }
    if (m[4]) { metMaand(+m[4], MAANDEN[m[5].toLowerCase()], m[6], m[0], plek); continue; }
    if (m[7]) { metMaand(+m[8], MAANDEN[m[7].toLowerCase()], m[9], m[0], plek); continue; }
    if (m[10]) {
      const a = +m[10], b = +m[11];
      /* DE TWIJFELREGEL. Staan er twee getallen die allebei een maand kunnen
         zijn, dan is niet uit te maken wat de dag is -- en dan kiezen we niet. */
      if (a <= 12 && b <= 12) { over.push({ ruw: m[0].trim(), waarom: 'dag-of-maand' }); continue; }
      if (a > 12 && b > 12) { over.push({ ruw: m[0].trim(), waarom: 'geen datum' }); continue; }
      const dag = a > 12 ? a : b, maand = a > 12 ? b : a;
      metMaand(dag, maand, m[12], m[0], plek);
    }
  }
  return { raak, over };

  function metMaand(dag, maand, jaarRuw, ruw, plek) {
    if (!maand) return;
    if (jaarRuw) {
      const j = +jaarRuw < 100 ? 2000 + +jaarRuw : +jaarRuw;
      return neem(echteDag(j, maand, dag), ruw, plek, 'onmogelijke datum');
    }
    neem(eerstvolgende(vandaag, maand, dag), ruw, plek, 'onmogelijke datum');
  }
  function neem(isoDatum, ruwe, plek, waaromNiet) {
    const iso = isoDatum;
    // het aanhalen zonder de leestekens die het patroon nog meepakte
    const ruw = String(ruwe).trim().replace(/[.,\s]+$/, '');
    if (!iso) { over.push({ ruw, waarom: waaromNiet }); return; }
    const dagen = dagenTussen(vandaag, iso);
    if (dagen < 0) { over.push({ ruw, waarom: 'al geweest' }); return; }
    if (dagen > HORIZON_DAGEN) { over.push({ ruw, waarom: 'te ver weg' }); return; }
    raak.push({ datum: iso, ruw, plek });
  }
}

/* De lezer zelf. Geeft terug wat er te bevestigen valt, en wat er is laten
   liggen -- dat tweede hoort erbij: een lijst die zwijgt over wat hij oversloeg,
   laat het scherm "dit was alles" zeggen terwijl dat niet zo is. */
function lees(tekst, { vandaag } = {}) {
  const t = String(tekst == null ? '' : tekst);
  /* `vandaag` moet een ECHTE dag zijn en niet alleen de vorm ervan hebben.
     Hier stond eerst een vormcontrole, en die liet "2026-13-45" door -- waarna
     elke vergelijking ("is dit al geweest?") op een onzin-dag rustte en de lezer
     alles voorstelde. Precies regel 8 van de lat, en dezelfde fout die eerder in
     de graaf zat. */
  if (!echteDag(Number(String(vandaag).slice(0, 4)), Number(String(vandaag).slice(5, 7)),
    Number(String(vandaag).slice(8, 10)))) return { datums: [], overgeslagen: [], afgekapt: 0 };
  const { raak, over } = vondsten(t, vandaag);
  const gezien = new Set();
  const datums = [];
  let afgekapt = 0;
  for (const r of raak) {
    const zin = zinRond(t, r.plek);
    const tijd = tijdIn(zin);
    const sleutel = r.datum + '|' + (tijd || '');
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    if (datums.length >= MAX_PER_BERICHT) { afgekapt++; continue; }
    datums.push({ datum: r.datum, tijd, zin, ruw: r.ruw });
  }
  datums.sort((a, b) => a.datum.localeCompare(b.datum));
  return { datums, overgeslagen: over, afgekapt };
}

module.exports = { lees, MAANDEN, HORIZON_DAGEN, MAX_PER_BERICHT };
