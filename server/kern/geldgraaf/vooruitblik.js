/* Geldgraaf, deelbestand "vooruitblik": het verwachte saldo per horizon.

   DIT IS EEN AFGELEIDE MET DE NAAM VERWACHTING, GEEN TWEEDE SALDO (GELD.md
   par. 1, LAT.md regel 4). Het enige echte saldo blijft dat van pay; wat
   hier uitkomt is dat saldo plus wat er naar verwachting bij komt en af
   gaat, en het heet overal zo. Zou dit een "saldo" heten, dan bestaan er
   twee getallen die uit elkaar lopen en toont het geldscherm er vroeg of
   laat de verkeerde van.

   Wat meetelt: de herkende maandelijkse patronen (./patronen.js) en de
   GEDATEERDE verplichtingen en verwachtingen uit de feiten (toezeggingen
   met een datum, verwacht loon). Wat bewust niet meetelt: alles zonder
   datum -- een open wbw-verrekening heeft geen moment, en hem op een
   verzonnen dag inboeken is precies het soort schijnzekerheid dat een
   geldscherm niet mag verkopen. */
'use strict';

const { vandaag, plusDagen, dagenTussen } = require('./hulp');

/* De laatste dag van de lopende maand: dag nul van de volgende maand, in
   UTC op het middaguur zodat een tijdzone er geen dag af kan snoepen. */
function eindeMaandDag(dag) {
  const j = Number(dag.slice(0, 4)), m = Number(dag.slice(5, 7));
  return new Date(Date.UTC(j, m, 0, 12)).toISOString().slice(0, 10);
}

/* Een herhalende post naar zijn eerste relevante beurt schuiven: hooguit een
   tussenpoos in het verleden. Een beurt die langer geleden is, is geen
   achterstand meer maar geschiedenis; een keer achterstand telt wel mee,
   want dat bedrag gaat er vermoedelijk alsnog af (of komt er alsnog bij). */
function eersteBeurt(wanneer, interval) {
  let d = wanneer;
  const nu = vandaag();
  while (dagenTussen(d, nu) > interval) d = plusDagen(d, interval);
  return d;
}

/* Alles wat er tot en met horizonEind naar verwachting in en uit gaat.
   Herhalende posten stappen door tot de rand: op negentig dagen telt een
   maandelijkse post drie keer, en dat is precies het verschil tussen d30 en
   d90 dat het lid wil zien. */
function verwachtTot(patronen, feiten, horizonEind) {
  let inCenten = 0, uitCenten = 0;
  for (const p of patronen) {
    let d = p.volgende; // patronen.js garandeert: hooguit een tussenpoos voorbij
    while (d <= horizonEind) { uitCenten += p.centen; d = plusDagen(d, p.interval); }
  }
  for (const f of feiten) {
    if (!f.wanneer || !Number.isFinite(f.centen)) continue;
    if (f.soort === 'toezegging' && f.richting === 'uit') {
      if (f.herhaling === 'maandelijks') {
        let d = eersteBeurt(f.wanneer, 30);
        while (d <= horizonEind) { uitCenten += f.centen; d = plusDagen(d, 30); }
      } else if (f.wanneer <= horizonEind) {
        /* Ook een verlopen toezegging telt: de datum is voorbij maar het
           bedrag staat nog open en gaat er dus nog af. De uitzondering
           'toezegging-verlopen' (index.js) maakt het zichtbaar. */
        uitCenten += f.centen;
      }
    } else if (f.soort === 'loon-verwacht' && f.richting === 'in') {
      let d = eersteBeurt(f.wanneer, 30);
      while (d <= horizonEind) { inCenten += f.centen; d = plusDagen(d, 30); }
    }
  }
  return { inCenten, uitCenten };
}

/* De gemiddelde maanduitgaven uit de historie, voor de buffer. De lopende
   maand telt niet mee: een halve maand drukt het gemiddelde en laat de
   buffer groter lijken dan hij is -- bij geld is te rooskleurig de
   gevaarlijke kant. Minder dan twee volledige maanden geschiedenis geeft
   eerlijk null, geen getal dat op een week boodschappen rust.

   EN DE OUDSTE MAAND TELT OOK NIET MEE, om precies dezelfde reden. De bron
   levert de laatste paar honderd boekingen (bronnen.js); bij een druk
   grootboek valt de rand van dat venster middenin een maand, en dan is de
   oudste maand net zo goed een halve maand -- alleen niet zichtbaar als
   zodanig. De keuring rekende het na: drie afgesloten maanden met gelijke
   uitgaven gaven een buffer van 3,4 waar 3,0 het echte getal was.

   Dat kost een maand geschiedenis, en dat is de goede ruil: liever een
   buffer die te klein oogt dan een die te groot oogt. Daarom vraagt de
   drempel nu drie maanden in het venster in plaats van twee. */
function maandlasten(feiten) {
  const perMaand = new Map();
  const lopend = vandaag().slice(0, 7);
  for (const f of feiten) {
    if (f.soort !== 'transactie' || f.richting !== 'uit') continue;
    if (!f.wanneer || !Number.isFinite(f.centen)) continue;
    const m = f.wanneer.slice(0, 7);
    if (m === lopend) continue;
    perMaand.set(m, (perMaand.get(m) || 0) + f.centen);
  }
  if (perMaand.size < 3) return null;
  const maanden = [...perMaand.keys()].sort();
  maanden.shift(); // de oudste kan afgekapt zijn door de vensterrand
  let som = 0;
  for (const m of maanden) som += perMaand.get(m);
  return Math.round(som / maanden.length);
}

function bereken({ saldoCenten, patronen, feiten }) {
  const nu = vandaag();
  const horizon = (eind) => {
    const v = verwachtTot(patronen, feiten, eind);
    return { saldoCenten: saldoCenten + v.inCenten - v.uitCenten, inCenten: v.inCenten, uitCenten: v.uitCenten };
  };
  const maandUitCenten = maandlasten(feiten);
  return {
    d7: horizon(plusDagen(nu, 7)),
    d30: horizon(plusDagen(nu, 30)),
    d90: horizon(plusDagen(nu, 90)),
    eindeMaand: horizon(eindeMaandDag(nu)),
    /* "Vaste lasten komende 14 dagen" op het command center: alle verwachte
       uitgaande posten binnen veertien dagen, vast en gedateerd samen. */
    lasten14dCenten: verwachtTot(patronen, feiten, plusDagen(nu, 14)).uitCenten,
    maandUitCenten,
    bufferMaanden: maandUitCenten && maandUitCenten > 0
      ? Math.round((saldoCenten / maandUitCenten) * 10) / 10
      : null
  };
}

module.exports = { bereken };
