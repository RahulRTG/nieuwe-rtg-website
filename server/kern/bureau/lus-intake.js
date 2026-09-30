/* Het Privekantoor, deelbestand "lus-intake": een zin wordt een case.

   "Mijn vrouw is morgen jarig, we zijn in Amsterdam, ze weet van niets en ik wil
   dat het echt bijzonder wordt." Dat is geen formulier maar het is ook geen
   raadsel: de datum, de gelegenheid, de stad, dat het een verrassing is en voor
   hoeveel mensen het is, staan er gewoon in.

   DIT DEEL GEBRUIKT GEEN MODEL, EN DAT IS EEN KEUZE. Het haalt velden uit de
   zin met regels die je kunt nalezen (CLAUDE.md: regelwerk en controleerbare
   extractie gebruiken geen model). Een model zou meer vinden en af en toe iets
   verzinnen, en een verzonnen allergie of een verkeerde datum in een case is
   precies het soort fout dat je niet terugziet tot het diner.

   WAT HIER NIET ZEKER UIT DE ZIN VOLGT, WORDT EEN VRAAG EN GEEN GOK. `vragen`
   noemt wat ontbreekt. Een half begrepen wens mag er niet uitzien als een goed
   begrepen wens -- dezelfde regel als `genegeerd` in kern/mall/concierge.js. */
'use strict';

const WEEKDAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

const iso = d => d.toISOString().slice(0, 10);

function datumUit(zin, vandaag) {
  const t = zin.toLowerCase();
  const d0 = new Date(vandaag + 'T12:00:00Z');
  const plus = n => { const d = new Date(d0); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  if (/\bovermorgen\b/.test(t)) return plus(2);
  if (/\bmorgen(avond|middag|ochtend)?\b/.test(t)) return plus(1);
  if (/\bvandaag\b|\bvanavond\b/.test(t)) return plus(0);
  for (let i = 0; i < 7; i++) {
    if (new RegExp('\\b' + WEEKDAGEN[i] + '\\b').test(t)) {
      const verschil = (i - d0.getUTCDay() + 7) % 7 || 7;
      return plus(verschil);
    }
  }
  const m = /\b(\d{1,2})[-/](\d{1,2})(?:[-/](\d{4}))?\b/.exec(t);
  if (m) {
    const jaar = m[3] ? Number(m[3]) : d0.getUTCFullYear();
    const d = new Date(Date.UTC(jaar, Number(m[2]) - 1, Number(m[1]), 12));
    if (!Number.isNaN(d.getTime()) && d.getUTCDate() === Number(m[1])) return iso(d);
  }
  return '';
}

function tijdUit(zin) {
  const m = /\b(?:om|rond|vanaf)\s+(\d{1,2})(?:[:.](\d{2}))?\s*(?:uur)?\b/i.exec(zin);
  if (!m) return '';
  const u = Number(m[1]);
  if (u > 23) return '';
  return String(u).padStart(2, '0') + ':' + (m[2] || '00');
}

function personenUit(zin) {
  const t = zin.toLowerCase();
  const m = /\b(?:voor|met)\s+(\d{1,2})\s*(?:personen|pers\.?|mensen|gasten)?\b/.exec(t);
  if (m) return Number(m[1]);
  if (/\bmet (z'n|zijn) (tweeën|tweeen)\b|\bwij tweeën\b|\bmijn (vrouw|man|partner|vriend|vriendin)\b/.test(t)) return 2;
  return null;
}

const GELEGENHEDEN = [
  [/\bjarig\b|\bverjaardag\b/i, 'verjaardag'],
  [/\bjubileum\b|\btrouwdag\b|\bgetrouwd\b/i, 'jubileum'],
  [/\baanzoek\b/i, 'aanzoek'],
  [/\bzakelijk(e)?\b|\bklant(en)?\b/i, 'zakelijk']
];

const HARDE = [
  [/\bnoten\b|\bpinda/i, 'geen noten'], [/\bgluten/i, 'glutenvrij'], [/\blactose/i, 'lactosevrij'],
  [/\bschaaldier/i, 'geen schaaldieren'], [/\bvegan\b|\bveganistisch/i, 'veganistisch'],
  [/\bvegetari/i, 'vegetarisch'], [/\brolstoel/i, 'rolstoeltoegankelijk']
];

const DOMEINEN = [
  [/\b(vlucht|hotel|reis|verblijf|overnachting)\b/i, 'reizen'],
  [/\b(chauffeur|auto|taxi|vervoer|boot|jacht)\b/i, 'vervoer'],
  [/\b(bloemen|cadeau|geschenk|attentie)\b/i, 'kring'],
  [/\b(diner|restaurant|tafel|eten|lunch|feest|avond)\b/i, 'gelegenheden']
];

const VERRASSING = /\bverrass|\bweet (er )?(nergens|niets|van niets)\b|\bmag (het )?niet weten\b|\bsurprise\b/i;

/* Een stad: een woord met een hoofdletter na "in" of "op". Een lijst steden
   zou vollediger zijn en toch Maastricht missen; dit vindt wat er staat en
   verzint niets. */
function plaatsUit(zin) {
  const m = /\b(?:in|op)\s+([A-Z][a-zé'-]+(?:\s[A-Z][a-zé'-]+)?)/.exec(zin);
  return m ? m[1] : '';
}

function intake(zinIn, vandaag) {
  const zin = String(zinIn || '').replace(/[<>]/g, '').trim().slice(0, 1200);
  if (!zin) return { fout: 'Vertel ons in een zin wat u wilt.' };
  const eerste = zin.split(/(?<=[.!?])\s/)[0];
  const gelegenheid = (GELEGENHEDEN.find(([r]) => r.test(zin)) || [])[1] || '';
  const domein = (DOMEINEN.find(([r]) => r.test(zin)) || [])[1] || 'gelegenheden';
  const velden = {
    titel: eerste.slice(0, 120),
    wat: zin,
    domein,
    gelegenheid,
    van: datumUit(zin, vandaag),
    tijd: tijdUit(zin),
    plaats: plaatsUit(zin),
    personen: personenUit(zin),
    verrassing: VERRASSING.test(zin),
    harde: HARDE.filter(([r]) => r.test(zin)).map(([, w]) => w)
  };
  const vragen = [];
  if (!velden.van) vragen.push({ veld: 'van', vraag: 'Op welke dag?' });
  if (!velden.personen) vragen.push({ veld: 'personen', vraag: 'Voor hoeveel personen?' });
  if (!velden.plaats) vragen.push({ veld: 'plaats', vraag: 'Waar bent u dan?' });
  vragen.push({ veld: 'grensCenten', vraag: 'Mogen wij binnen uw vaste grens werken, of wilt u voor deze gelegenheid een ander budget?' });
  return { velden, vragen };
}

module.exports = { intake };
