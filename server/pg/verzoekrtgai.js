/* Conflictvaste samenvoeging van de gedeelde RTG-AI meetstand.

   Iedere instance telt verzoeken lokaal en een trainings- of meettimer bewaart
   die tellers later. Twee gezonde instances wijzigen daardoor bewust dezelfde
   scalars. Een gewone drie-weg-merge kan niet weten dat 12 -> 15 en 12 -> 17
   samen 20 waarnemingen betekent en sloot voorheen de hele verkeerspoort.

   Alleen aantoonbaar monotone tellers worden als delta opgeteld. Besturing
   (fase/roer), onbekende velden en bestaande journaalregels blijven strikt:
   bij twijfel volgt een conflict, nooit een gegokte AI-stand. */
'use strict';

const { voegVeilig } = require('./verzoekmerge');
const json = v => JSON.stringify(v);
const TELLERS = new Set(['waarnemingen', 'fouten', 'rondes', 'roerRondes']);

function conflict(pad, tekst) {
  const e = new Error((tekst || 'De RTG-AI meetstand is niet veilig samen te voegen') +
    (pad ? ' bij ' + pad : '') + '.');
  e.code = 'PG_REQUEST_CONFLICT';
  throw e;
}

function getal(v, pad) {
  const n = v == null ? 0 : Number(v);
  if (!Number.isSafeInteger(n) || n < 0) conflict(pad, 'De RTG-AI teller is ongeldig');
  return n;
}

function telSamen(b, o, h, pad) {
  const bn = getal(b, pad), on = getal(o, pad), hn = getal(h, pad);
  if (on < bn || hn < bn) conflict(pad, 'Een RTG-AI teller is teruggezet');
  return bn + (on - bn) + (hn - bn);
}

function vroegsteSamen(b, o, h) {
  const waarden = [b, o, h].filter(v => v != null).map(Number);
  if (!waarden.length || waarden.some(v => !Number.isFinite(v) || v < 0))
    conflict('rtgai.gestart', 'De RTG-AI starttijd is ongeldig');
  return Math.min(...waarden);
}

function domeinenSamen(basis, ons, hun) {
  const b = basis && typeof basis === 'object' && !Array.isArray(basis) ? basis : {};
  const o = ons && typeof ons === 'object' && !Array.isArray(ons) ? ons : {};
  const h = hun && typeof hun === 'object' && !Array.isArray(hun) ? hun : {};
  const uit = {};
  for (const k of new Set([...Object.keys(b), ...Object.keys(o), ...Object.keys(h)]))
    uit[k] = telSamen(b[k], o[k], h[k], 'rtgai.domeinen.' + k);
  return uit;
}

/* Het journaal staat nieuwste-eerst. Nieuwe kopregels mogen samenkomen en de
   oudste staart mag door de vaste limiet verdwijnen; een bestaande regel
   herschrijven of een volledige keten zonder gedeeld anker aanbieden niet. */
function journaalDelen(basis, variant, naam) {
  const b = Array.isArray(basis) ? basis : [];
  const v = Array.isArray(variant) ? variant : conflict(naam, 'Het RTG-AI journaal is geen lijst');
  const oud = new Map(b.map(r => [json(r), r]));
  let grens = v.findIndex(r => oud.has(json(r)));
  if (grens < 0) grens = v.length;
  const nieuw = v.slice(0, grens), gedeeld = v.slice(grens);
  if (b.length && !gedeeld.length)
    conflict(naam, 'Het RTG-AI journaal deelt geen bestaande regel');
  const verwacht = b.slice(0, gedeeld.length);
  if (gedeeld.some((r, i) => json(r) !== json(verwacht[i])))
    conflict(naam, 'Een bestaande RTG-AI journaalregel is herschreven');
  return { nieuw, gedeeld };
}

function journaalSamen(basis, ons, hun) {
  if (json(ons) === json(hun)) return ons;
  const od = journaalDelen(basis, ons, 'rtgai.journaal/request');
  journaalDelen(basis, hun, 'rtgai.journaal/database');
  /* De lokale nog niet bevestigde kop blijft vóór de volledige actuele
     databasevariant staan. Dat is niet alleen volgorde: na het herbasen wordt
     `hun` de nieuwe basis, zodat een volgende NOTIFY de lokale kop opnieuw als
     zuivere toevoeging herkent. Sorteren op kloktijd zette hem soms midden in
     de basis en maakte de volgende veilige merge onmogelijk. */
  const gezien = new Set(), uit = [];
  for (const r of [...od.nieuw, ...(Array.isArray(hun) ? hun : [])]) {
    const sleutel = json(r);
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel); uit.push(r);
  }
  return uit.slice(0, 200);
}

function voegRtgaiSamen(basis, ons, hun) {
  const b = basis && typeof basis === 'object' && !Array.isArray(basis) ? basis : {};
  const o = ons && typeof ons === 'object' && !Array.isArray(ons) ? ons
    : conflict('rtgai/request', 'De RTG-AI requeststand is geen kaart');
  const h = hun && typeof hun === 'object' && !Array.isArray(hun) ? hun
    : conflict('rtgai/database', 'De RTG-AI databasestand is geen kaart');
  /* Geen `ons === hun`-kortsluiting: beide varianten stammen van dezelfde
     basis maar vertegenwoordigen twee onafhankelijke instances. Twee keer
     exact +2 is dus +4, niet eenmaal +2. De veldmerge hieronder valideert ook
     monotoniciteit en besturingsvelden. */

  const uit = {};
  for (const k of new Set([...Object.keys(b), ...Object.keys(o), ...Object.keys(h)])) {
    if (TELLERS.has(k)) uit[k] = telSamen(b[k], o[k], h[k], 'rtgai.' + k);
    else if (k === 'gestart') uit[k] = vroegsteSamen(b[k], o[k], h[k]);
    else if (k === 'domeinen') uit[k] = domeinenSamen(b[k], o[k], h[k]);
    else if (k === 'journaal') uit[k] = journaalSamen(b[k], o[k], h[k]);
    else {
      const v = voegVeilig(b[k], o[k], h[k], 'rtgai.' + k);
      if (v !== undefined) uit[k] = v;
    }
  }
  return uit;
}

module.exports = { voegRtgaiSamen, telSamen };
