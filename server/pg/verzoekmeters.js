/* De conflictvaste requestmerge voor de kostenmeter.

   Een kostenrij bevat twee verschillende soorten getallen. Stromen (verzoeken,
   tokens, berichten en transacties) tellen op. Opslag is een stand en bewaart
   een lopend gemiddelde met het aantal peilingen ernaast. Een gewone
   drie-weg-merge kan dat onderscheid niet kennen: twee instances die tegelijk
   een verzoek tellen raken allebei `laatst` en hetzelfde tellerblad en zouden
   dus ten onrechte botsen.

   Alleen `kosten.meters` krijgt deze semantiek. Beleidsvelden, tarieven,
   facturen en periodeafsluitingen blijven via de strenge generieke merge lopen.
   Ook in een meterrow blijven onbekende velden streng: we rekenen uitsluitend
   met de in de centrale kostensoorten geregistreerde meters. */
'use strict';

const { voegVeilig } = require('./verzoekmerge');
const { gemeten, standSoorten } = require('../kern/kosten/soorten');

const MIST = Symbol('mist');
const gelijk = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const heeft = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
const MEETSOORTEN = new Set(gemeten().map(s => s.id));
const STANDSOORTEN = new Set(standSoorten().map(s => s.id));

function conflict(pad, tekst) {
  const e = new Error((tekst || 'De kostenmeter veranderde ongeldig') +
    (pad ? ' bij ' + pad : '') + '; laad opnieuw voordat u deze handeling herhaalt.');
  e.code = 'PG_REQUEST_CONFLICT'; throw e;
}

function getal(v, pad) {
  if (!Number.isFinite(v) || v < 0) conflict(pad, 'De kostenmeter bevat geen geldig niet-negatief getal');
  return Number(v);
}

/* Twee onafhankelijke tellerdelta's boven op dezelfde basis. Afname is geen
   meting maar een correctie en mag daarom nooit ongemerkt als optelling landen. */
function telSamen(b, o, h, pad) {
  if (gelijk(o, b)) return h;
  if (gelijk(h, b)) return o;
  const bn = b === undefined ? 0 : getal(b, pad);
  const on = getal(o, pad), hn = getal(h, pad);
  if (on < bn || hn < bn) conflict(pad, 'Een gelijktijdige kostenmeting verlaagt een teller');
  return Math.round((on + hn - bn) * 1e9) / 1e9;
}

function tijdSamen(b, o, h, pad) {
  if (gelijk(o, h)) return o;
  if (gelijk(o, b)) return h;
  if (gelijk(h, b)) return o;
  const lijst = [o, h].filter(v => typeof v === 'string' && Number.isFinite(Date.parse(v)));
  if (lijst.length !== 2) return voegVeilig(b, o, h, pad);
  return lijst.sort((a, z) => Date.parse(z) - Date.parse(a))[0];
}

function kaartSamen(basis, ons, hun, pad, voeg, telGelijkeWijziging) {
  const b = basis && typeof basis === 'object' && !Array.isArray(basis) ? basis : {};
  const o = ons && typeof ons === 'object' && !Array.isArray(ons) ? ons : {};
  const h = hun && typeof hun === 'object' && !Array.isArray(hun) ? hun : {};
  const uit = {};
  for (const k of new Set([...Object.keys(b), ...Object.keys(o), ...Object.keys(h)])) {
    const hb = heeft(b, k), ho = heeft(o, k), hh = heeft(h, k);
    const bv = b[k], ov = o[k], hv = h[k], kp = pad ? pad + '.' + k : k;
    if (ho === hh && (!ho || gelijk(ov, hv))) {
      if (!ho) continue;
      if (!telGelijkeWijziging || (hb && gelijk(ov, bv))) { uit[k] = ov; continue; }
    }
    if (ho === hb && (!ho || gelijk(ov, bv))) { if (hh) uit[k] = hv; continue; }
    if (hh === hb && (!hh || gelijk(hv, bv))) { if (ho) uit[k] = ov; continue; }
    /* Retentie mag een gelijktijdige verse meting niet wissen. */
    if (!ho && hh) { uit[k] = hv; continue; }
    if (!hh && ho) { uit[k] = ov; continue; }
    if (!ho || !hh) continue;
    uit[k] = voeg(hb ? bv : undefined, ov, hv, kp, k);
  }
  return uit;
}

function peilingenSamen(b, o, h, pad) {
  return kaartSamen(b, o, h, pad, (bv, ov, hv, kp, soort) => {
    if (!STANDSOORTEN.has(soort)) return voegVeilig(bv, ov, hv, kp);
    const n = telSamen(bv, ov, hv, kp);
    if (!Number.isInteger(n)) conflict(kp, 'Het aantal opslagpeilingen is geen geheel getal');
    return n;
  }, true);
}

function standSamen(id, b, o, h, pb, po, ph, pad) {
  if (gelijk(o, b) && po === pb) return h;
  if (gelijk(h, b) && ph === pb) return o;
  const nb = b === undefined ? 0 : getal(pb, pad + '.peilingen');
  const no = getal(po, pad + '.peilingen'), nh = getal(ph, pad + '.peilingen');
  if (![nb, no, nh].every(Number.isInteger) || no < nb || nh < nb)
    conflict(pad, 'De opslagpeilingen lopen niet monotoon');
  const n = no + nh - nb;
  if (!(n > 0)) conflict(pad, 'Het samengevoegde aantal opslagpeilingen is leeg');
  const vb = b === undefined ? 0 : getal(b, pad);
  const v = (getal(o, pad) * no + getal(h, pad) * nh - vb * nb) / n;
  return Math.round(v * 1e9) / 1e9;
}

function rijSamen(basis, ons, hun, pad) {
  const b = basis || {}, o = ons || {}, h = hun || {}, uit = {};
  const peilingen = peilingenSamen(b.peilingen, o.peilingen, h.peilingen, pad + '.peilingen');
  const sleutels = new Set([...Object.keys(b), ...Object.keys(o), ...Object.keys(h)]);
  for (const k of sleutels) {
    const kp = pad + '.' + k;
    if (k === 'pas') continue;
    if (k === 'peilingen') { if (Object.keys(peilingen).length) uit[k] = peilingen; continue; }
    if (k === 'laatst' || k === 'pasGezien') {
      const v = tijdSamen(b[k], o[k], h[k], kp); if (v !== undefined) uit[k] = v; continue;
    }
    if (MEETSOORTEN.has(k)) {
      if (!heeft(o, k) || !heeft(h, k)) {
        const v = voegVeilig(b[k], o[k], h[k], kp); if (v !== undefined) uit[k] = v; continue;
      }
      uit[k] = STANDSOORTEN.has(k)
        ? standSamen(k, b[k], o[k], h[k], b.peilingen && b.peilingen[k] || 0,
          o.peilingen && o.peilingen[k] || 0, h.peilingen && h.peilingen[k] || 0, kp)
        : telSamen(b[k], o[k], h[k], kp);
      continue;
    }
    const v = voegVeilig(b[k], o[k], h[k], kp);
    if (v !== undefined) uit[k] = v;
  }
  /* Een pas hoort bij de nieuwste waarneming. Bij gelijke tijden blijft een
     verschil een conflict; dan is niet aantoonbaar welke binding actueel is. */
  if (sleutels.has('pas')) {
    const kandidaten = [b, o, h].filter(x => x.pas != null && x.pasGezien);
    kandidaten.sort((a, z) => Date.parse(z.pasGezien) - Date.parse(a.pasGezien));
    if (kandidaten.length > 1 && kandidaten[0].pasGezien === kandidaten[1].pasGezien &&
        kandidaten[0].pas !== kandidaten[1].pas) conflict(pad + '.pas', 'Twee passen hebben dezelfde meettijd');
    if (kandidaten.length) uit.pas = kandidaten[0].pas;
    else {
      const v = voegVeilig(b.pas, o.pas, h.pas, pad + '.pas');
      if (v !== undefined) uit.pas = v;
    }
  }
  return uit;
}

function metersSamen(b, o, h) {
  return kaartSamen(b, o, h, 'kosten.meters', (bp, op, hp, pp) =>
    kaartSamen(bp, op, hp, pp, (br, or, hr, rp) => rijSamen(br, or, hr, rp), true), true);
}

function voegKostenSamen(basis, ons, hun) {
  const b = basis || {}, o = ons || {}, h = hun || {}, uit = {};
  for (const k of new Set([...Object.keys(b), ...Object.keys(o), ...Object.keys(h)])) {
    const v = k === 'meters'
      ? metersSamen(b[k], o[k], h[k])
      : voegVeilig(b[k], o[k], h[k], 'kosten.' + k);
    if (v !== undefined && (k !== 'meters' || Object.keys(v).length)) uit[k] = v;
  }
  return uit;
}

module.exports = { voegKostenSamen, telSamen, standSamen };
