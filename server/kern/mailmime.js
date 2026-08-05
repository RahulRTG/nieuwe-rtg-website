/* MIME: een binnengekomen bericht uitpakken. Puur tekstwerk, geen toestand.

   Afgesplitst van ./mailinkomend.js toen dat over de tien kilobyte ging, en op
   een echte naad: alles hier is een FUNCTIE VAN ZIJN INVOER. Geen database,
   geen netwerk, geen tijd -- dus ook los te beproeven met een string erin en
   een string eruit. Dat is precies wat je wilt bij een ontleder: de moeilijke
   gevallen zijn rare berichten, niet rare omstandigheden.

   TWEE REGELS DIE HIER GELDEN:

   1. WAT WIJ NIET BEGRIJPEN, VERZINNEN WE NIET. Een onbekende codering levert
      een leesbare melding op, geen half ontcijferde tekst.
   2. PLATTE TEKST BOVEN HTML. Niet uit smaak: RTMAIL rendert platte tekst en
      voert HTML nooit uit, dus de plattetekst-variant is de enige die klopt
      met wat de lezer ziet. */
'use strict';

const MAX = 2 * 1024 * 1024;   // een binnenkomend bericht boven 2 MB nemen we niet aan

// een kop-blok naar een object; doorgevouwen regels (RFC 5322) worden hersteld
function koppenVan(kop) {
  const uit = {};
  const regels = String(kop).split(/\r?\n/);
  let huidig = null;
  for (const r of regels) {
    if (/^[ \t]/.test(r) && huidig) { uit[huidig] += ' ' + r.trim(); continue; }
    const i = r.indexOf(':');
    if (i < 0) continue;
    huidig = r.slice(0, i).toLowerCase().trim();
    uit[huidig] = (uit[huidig] ? uit[huidig] + ', ' : '') + r.slice(i + 1).trim();
  }
  return uit;
}

// =?UTF-8?B?...?= en =?...?Q?...?= terugvertalen; onbekend blijft staan zoals het is
function ontcijferKop(s) {
  return String(s == null ? '' : s).replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (heel, set, wijze, data) => {
    try {
      if (/^b$/i.test(wijze)) return Buffer.from(data, 'base64').toString(/utf-?8/i.test(set) ? 'utf8' : 'latin1');
      const q = data.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
      return Buffer.from(q, 'binary').toString(/utf-?8/i.test(set) ? 'utf8' : 'latin1');
    } catch (e) { return heel; }
  });
}

function ontcijferLijf(data, codering, charset) {
  const c = String(codering || '').toLowerCase();
  const set = /utf-?8/i.test(charset || '') ? 'utf8' : 'latin1';
  try {
    if (c === 'base64') return { ok: true, tekst: Buffer.from(data.replace(/\s+/g, ''), 'base64').toString(set) };
    if (c === 'quoted-printable') {
      const q = data.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
      return { ok: true, tekst: Buffer.from(q, 'binary').toString(set) };
    }
    if (!c || c === '7bit' || c === '8bit' || c === 'binary') return { ok: true, tekst: data };
  } catch (e) { /* valt hieronder door */ }
  return { ok: false, waarom: 'de codering "' + c + '" begrijpt deze laag niet; de tekst is niet omgezet' };
}

const grensVan = (ct) => (/boundary\s*=\s*"?([^";]+)"?/i.exec(ct || '') || [])[1] || null;
const charsetVan = (ct) => (/charset\s*=\s*"?([^";]+)"?/i.exec(ct || '') || [])[1] || null;
const adresVan = (s) => (/<([^>]+)>/.exec(s || '') || [null, String(s || '').trim()])[1] || '';

/* Een MIME-boom platslaan tot: de beste tekst, en een lijst bijlagen. "Beste"
   is text/plain boven text/html -- niet uit smaak maar omdat RTMAIL platte
   tekst rendert en HTML hier nooit wordt uitgevoerd. */
function delen(kop, lijf, diep) {
  const ct = kop['content-type'] || 'text/plain';
  const grens = grensVan(ct);
  if (!grens || (diep || 0) > 4) {
    const uit = ontcijferLijf(lijf, kop['content-transfer-encoding'], charsetVan(ct));
    const naam = (/filename\s*=\s*"?([^";]+)"?/i.exec(kop['content-disposition'] || '') || [])[1] || null;
    if (naam || /^application\//i.test(ct)) {
      return { tekst: '', bijlagen: [{ naam: naam || '(zonder naam)', soort: ct.split(';')[0].trim(), bytes: lijf.length }] };
    }
    return { tekst: uit.ok ? uit.tekst : '[' + uit.waarom + ']', bijlagen: [], html: /^text\/html/i.test(ct) };
  }
  const stukken = String(lijf).split(new RegExp('--' + grens.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  let plat = '', html = '';
  const bijlagen = [];
  for (const s of stukken) {
    const t = s.replace(/^\r?\n/, '');
    if (!t.trim() || /^--/.test(t)) continue;
    const scheiding = t.search(/\r?\n\r?\n/);
    if (scheiding < 0) continue;
    const k = koppenVan(t.slice(0, scheiding));
    const l = t.slice(scheiding).replace(/^\r?\n\r?\n/, '');
    const d = delen(k, l, (diep || 0) + 1);
    bijlagen.push(...d.bijlagen);
    if (d.html) html = html || d.tekst;
    else plat = plat || d.tekst;
  }
  return { tekst: plat || html, bijlagen };
}

module.exports = { MAX, koppenVan, ontcijferKop, ontcijferLijf, grensVan, charsetVan, adresVan, delen };
