(() => {
'use strict';
/* RTG Flits op het RTG Design System (TRAVELOS-MIGRATIE.md, batch 4).
   Dezelfde vier aanroepen als ervoor: /api/flits/rond, /meld, /stem en
   /vooruit. Alleen de vorm komt uit /ds/: een rustige lijst voor wat er rond
   u gemeld is, keuzeknoppen om te melden, en de vooruitblik als een eigen
   tekening in SVG (de hoogte van een staaf is een attribuut, geen stijl). */
const $ = s => document.querySelector(s);
const token = (() => { try { return localStorage.getItem('rtg_member_token'); } catch (e) { return null; } })();
const api = (pad, body) => fetch('/api/flits/' + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
let meldT;
const zeg = t => { const m = $('#melding'); m.textContent = t; m.classList.add('toon');
  clearTimeout(meldT); meldT = setTimeout(() => m.classList.remove('toon'), 3200); };
// rustige spraak, alleen als het ertoe doet (nadering); geen gebabbel
const spreek = t => { try { const u = new SpeechSynthesisUtterance(t); u.lang = 'nl-NL'; u.rate = 1.02; speechSynthesis.speak(u); } catch (e) {} };
const el = (tag, klasse, tekst) => { const e = document.createElement(tag); if (klasse) e.className = klasse; if (tekst != null) e.textContent = tekst; return e; };
const km = n => new Intl.NumberFormat(document.documentElement.lang || 'nl', { maximumFractionDigits: 1 }).format(n);

const LAND = 'ES';
/* GEEN VERZONNEN PLEK. Dit scherm meldt flitsers en files ROND JOU; zonder
   locatie weten we niet waar je bent, en dat zegt het scherm dan ook. */
let hier = null;
let rond = null, alarmMelding = null, gesproken = {};

/* Meenemen (shared/uitvoer.js): de meldingen die het netwerk rond u heeft
   staan. De vooruitblik is een berekening en geen melding. */
if (window.RTGUitvoer) RTGUitvoer.bron(() => {
  if (!rond) return null;
  return {
    naam: 'meldingen',
    kolommen: ['soort', 'melding', 'afstand (km)', 'gemeld door', 'bevestigingen', 'datum'],
    rijen: (rond.meldingen || []).map(m => [m.soort, m.naam, m.afstandKm, m.door,
      m.bevestigingen, String(m.at || '').slice(0, 10)])
  };
});

/* ---- gps: snelheid en positie ----
   De schakelaar blijft de baas: shared/plek.js vraagt het een keer met de
   reden erbij; zeg je nee, dan blijft het scherm leeg en zegt het waarom.
   De rauwe watchPosition blijft, want we hebben coords.speed nodig. */
let opPlek = null;
async function gpsStart() {
  if (!('geolocation' in navigator)) return;
  if (window.RTGPlek && !RTGPlek.aan()) {
    const ja = await RTGPlek.vraag({ waarom: 'Voor je snelheid en de flitspalen om je heen moet ik weten waar je bent. Je locatie blijft op je toestel.' });
    if (!ja) return;
  } else if (!window.RTGPlek) {
    /* Zonder contractlaag is er geen stand om op te varen: luid, niet stil. */
    if (window.console) console.warn('[flits] shared/plek.js ontbreekt; zonder contractlaag geen locatie.');
    return;
  }
  navigator.geolocation.watchPosition(p => {
    const eerste = !hier;
    hier = { lat: p.coords.latitude, lng: p.coords.longitude };
    const kmu = p.coords.speed != null ? Math.max(0, Math.round(p.coords.speed * 3.6)) : null;
    if (kmu != null) $('#snelheid').textContent = kmu;
    if (eerste && opPlek) { const f = opPlek; opPlek = null; f(); }
  }, () => {}, { enableHighAccuracy: true });
}
document.addEventListener('DOMContentLoaded', gpsStart);

/* ---- het rondom-beeld en de naderingswaarschuwing ---- */
const afstand = (a, gesproken) => a < 1 ? Math.round(a * 1000) + (gesproken ? ' meter' : ' m') : km(a) + (gesproken ? ' kilometer' : ' km');
function toonAlarm(m) {
  alarmMelding = m;
  const vak = $('#alarm');
  if (!m) { vak.hidden = true; return; }
  $('#alarmIcoon').textContent = m.icoon;
  $('#alarmWat').textContent = m.naam + ' over ' + afstand(m.afstandKm);
  $('#alarmSub').textContent = 'Gemeld door ' + m.door + (m.bevestigingen ? ' · ' + m.bevestigingen + 'x bevestigd' : '');
  vak.hidden = false;
  if (!gesproken[m.id]) { gesproken[m.id] = true; spreek(m.naam + ' over ' + afstand(m.afstandKm, true)); }
}
async function ververs() {
  if (!hier) return;                       // zonder plek is "rond mij" een lege vraag
  const r = await api('rond', { lat: hier.lat, lng: hier.lng, land: LAND });
  if (r.status !== 200) return;
  rond = r.body;
  $('#bron').textContent = rond.bron + '.';
  $('#landRegel').textContent = rond.flitsToegestaan ? '' :
    'In dit land zijn flitsermeldingen wettelijk niet toegestaan; file- en gevaarmeldingen werken gewoon.';
  // meldknoppen (flitser valt weg waar het niet mag)
  const rij = $('#meldrij'); rij.textContent = '';
  for (const s of rond.soorten) {
    if (s.soort === 'wegwerk') continue;                // vier rustige knoppen is genoeg
    if (s.soort === 'flitser' && !rond.flitsToegestaan) continue;
    const b = el('button', 'ds-keuze'); b.type = 'button'; b.dataset.soort = s.soort;
    b.setAttribute('data-ds-actie', s.naam + ' melden');
    b.append(el('span', 'ds-kaart__titel', s.icoon), el('span', null, s.naam));
    b.firstChild.setAttribute('aria-hidden', 'true');
    b.addEventListener('click', async () => {
      if (!hier) return zeg('Ik weet nog niet waar je bent; zet je locatie aan om te kunnen melden.');
      const m = await api('meld', { soort: s.soort, lat: hier.lat, lng: hier.lng, land: LAND });
      if (m.body.error) return zeg(m.body.error);
      zeg(m.body.bevestigd ? 'Dank u: de bestaande melding is bevestigd.' : s.naam + ' gemeld voor het netwerk.');
      ververs();
    });
    rij.appendChild(b);
  }
  // de lijst en het dichtstbijzijnde punt binnen 1,2 km als waarschuwing
  const lijst = $('#lijst'); lijst.textContent = '';
  if (!rond.meldingen.length) lijst.appendChild(el('li', 'ds-meta', 'Nog niets gemeld binnen ' + rond.radiusKm + ' km. Zo hoort het.'));
  for (const m of rond.meldingen.slice(0, 10)) {
    const li = el('li', 'ds-lijst__rij'); li.dataset.melding = m.id || '';
    const ico = el('span', 'ds-lijst__icoon', m.icoon); ico.setAttribute('aria-hidden', 'true');
    const wat = el('span'); wat.append(el('span', 'ds-lijst__titel', m.naam), el('span', 'ds-lijst__tekst', m.door));
    li.append(ico, wat, el('span', 'ds-lijst__tijd', km(m.afstandKm) + ' km'));
    lijst.appendChild(li);
  }
  toonAlarm(rond.meldingen.find(m => m.afstandKm != null && m.afstandKm <= 1.2) || null);
}
$('#stemKlopt').addEventListener('click', async () => { if (!alarmMelding) return;
  await api('stem', { id: alarmMelding.id, klopt: true }); zeg('Dank u.'); ververs(); });
$('#stemWeg').addEventListener('click', async () => { if (!alarmMelding) return;
  const r = await api('stem', { id: alarmMelding.id, klopt: false });
  zeg(r.body.weg ? 'De melding is weggehaald.' : 'Genoteerd.'); ververs(); });

/* ---- de vooruitblik (Ghost Driver-motor), vast voor Ibiza ----
   Een tekening in SVG op de werkelijke breedte (viewBox in pixels, opnieuw
   bij een andere maat): staven van hoogstens 22 px breed, de kans bepaalt
   hoogte en dekking, de kleur is de inkt van het scherm. */
const svgEl = (tag, attrs, tekst) => {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (tekst != null) e.textContent = tekst;
  return e;
};
let uurbeeld = [];
function tekenUren() {
  const uren = $('#uren'); uren.textContent = '';
  uren.toggleAttribute('hidden', !uurbeeld.length);   // een SVG kent geen .hidden
  const W = Math.round(uren.getBoundingClientRect().width) || 240, kol = W / Math.max(1, uurbeeld.length), bw = Math.min(22, kol * 0.6);
  uren.setAttribute('viewBox', '0 0 ' + W + ' 80');
  uurbeeld.forEach((u, i) => {
    const h = Math.max(4, Math.round(u.kans * 0.56)), x = i * kol + kol / 2;
    uren.appendChild(svgEl('rect', { x: (x - bw / 2).toFixed(1), y: 60 - h, width: bw.toFixed(1), height: h,
      fill: 'currentColor', 'fill-opacity': u.kans >= 60 ? '1' : u.kans >= 30 ? '.55' : '.2' }));
    uren.appendChild(svgEl('text', { x: x.toFixed(1), y: 76, 'text-anchor': 'middle', 'font-size': 11, fill: 'currentColor' }, String(u.tijd).slice(0, 2)));
  });
}
window.addEventListener('resize', tekenUren);
async function vooruit() {
  const r = await api('vooruit', { stad: 'Ibiza' });
  if (r.status !== 200) return;
  uurbeeld = r.body.uurbeeld || [];
  tekenUren();
  const drukste = uurbeeld.reduce((a, u) => !a || u.kans > a.kans ? u : a, null);
  const w = (r.body.waarschuwingen || [])[0];
  $('#urenSub').textContent = w
    ? 'Let op rond ' + w.tijd + ': ' + w.kans + '% kans op een opstopping bij ' + w.knooppunt + '.'
    : (drukste ? 'Drukste uur: ' + drukste.tijd + ' (' + drukste.kans + '%).' : '');
}

/* ---- start ---- */
(async () => {
  if (!token) { $('#vPoort').hidden = false; return; }
  /* Zonder plek valt er niets te tonen. We wachten op de eerste fix in plaats
     van een punt te verzinnen; komt hij niet, dan zegt de poort waarom. */
  if (!hier) {
    const gekregen = await new Promise(klaar => {
      opPlek = () => klaar(true);
      setTimeout(() => { if (opPlek) { opPlek = null; klaar(false); } }, 12000);
    });
    if (!gekregen) {
      $('#poortReden').textContent = 'Dit scherm werkt op je locatie: flitsers, files en gevaar rond jou. Zet je locatie aan in het bedieningspaneel en open hem opnieuw.';
      $('#vPoort').hidden = false;
      return;
    }
  }
  const eerste = await api('rond', { lat: hier.lat, lng: hier.lng, land: LAND });
  if (eerste.status !== 200) { $('#poortReden').textContent = eerste.body.error || 'Log eerst in via de app.'; $('#vPoort').hidden = false; return; }
  $('#vRit').hidden = false;
  rond = eerste.body;
  await ververs(); vooruit();
  setInterval(ververs, 20000);
  setInterval(vooruit, 10 * 60 * 1000);
})();
})();
