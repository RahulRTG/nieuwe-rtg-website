/* RTG Office: in en uit -- de export langs de uitgangspoort, en XLSX inlezen
   (OFFICE.md punt 23 en 25, par. 9 fase 1 en 2).

   DE EXPORT GEBEURDE IN DE BROWSER, EN LAS DE CLASSIFICATIE DAAROM NIET. Een
   strikt document ging als kaal .html de deur uit, zonder dat het spoor van het
   document er iets van wist. Nu loopt elke export hier langs: de server vraagt
   de uitgangspoort (./uitgangspoort.js), zet de classificatie IN het bestand
   (eigenschap en koptekst bij XLSX en DOCX, een metaregel en een balk bij HTML,
   een kopregel bij TXT, een titel bij SVG, en bij CSV -- dat geen plek heeft --
   in de bestandsnaam), en schrijft een regel `geexporteerd` in het
   documentspoor met wie, welk formaat en welke classificatie.

   Er wordt hier niets beslist over WIE mag exporteren: wie het document mag
   openen, mag het ook downloaden, zoals voorheen. Dat strikt de export zou
   moeten sluiten is nooit besloten, en dus wordt het hier niet verzonnen
   (zie de kop van ./uitgangspoort.js).

   TROUW. Elk antwoord draagt een `trouw`-lijst: wat er NIET (of anders) is
   meegekomen. Leeg is een uitspraak ("alles kwam mee"), geen ontbrekend veld. */
'use strict';

const { poort } = require('./uitgangspoort');
const { schrijfXlsx } = require('./xlsx-schrijf');
const { leesXlsx } = require('./xlsx-lees');
const { htmlNaarDocx } = require('./docx-schrijf');
const { MAX_BYTES } = require('./basis');
const M = require('../../../public/shared/rekenmotor.js');
const { kolNaam } = require('./formuletaal');

const FORMATEN = {
  tekst: ['docx', 'html'], blad: ['xlsx', 'csv'], presentatie: ['txt'], schets: ['svg'], bord: ['csv']
};
const MIME = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  html: 'text/html', csv: 'text/csv', txt: 'text/plain', svg: 'image/svg+xml'
};
const INDELING = { titel: 'Titelblad', punten: 'Punten', twee: 'Twee kolommen', citaat: 'Citaat', cijfer: 'Cijfer' };
const MAX_SVG = 500000;
const MAX_UITGAAND = 60;   // exportregels per document, in een eigen ring
const MAX_XLSX = 420000;   // in bytes, na base64: past onder de ruime grens van de bewaarroute

const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* Een veld dat met = + - @ begint, voert een rekenprogramma uit als formule
   (=HYPERLINK(...) in een kaarttitel). Een apostrof ervoor maakt het tekst. */
const csvVeld = v => {
  const s = String(v == null ? '' : v);
  return '"' + (/^[=+\-@\t\r]/.test(s) ? "'" + s : s).replace(/"/g, '""') + '"';
};
const bestandsnaam = (titel, label, ext) => (String(titel || 'document').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').trim().slice(0, 100) || 'document') +
  (label !== 'Intern' ? ' (' + label + ')' : '') + '.' + ext;

module.exports = ({ save, schoon }, basis) => {
  const { docMet, magLezen, naamVan, schrijfAudit, schoonInhoud, grootteVan } = basis;

  function bouw(d, formaat, data, label) {
    const inh = d.inhoud || {};
    if (formaat === 'xlsx') return schrijfXlsx({ titel: d.titel, inhoud: inh, label });
    if (formaat === 'docx') return htmlNaarDocx({ titel: d.titel, html: inh.tekst, label });
    if (formaat === 'html') return { trouw: [], buffer: Buffer.from('<!doctype html><meta charset="utf-8">' +
      '<meta name="rtg-classificatie" content="' + esc(label) + '"><title>' + esc(d.titel) + '</title>' +
      '<body style="font-family:Georgia,serif;max-width:42em;margin:3em auto;line-height:1.7;color:#1a1a19;">' +
      '<p style="font:12px sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#4D4A45;border-bottom:1px solid #DEDBD5;padding-bottom:.5em;">Classificatie: ' +
      esc(label) + '</p>' + String(inh.tekst || ''), 'utf8') };
    if (formaat === 'txt') return { trouw: [], buffer: Buffer.from('Classificatie: ' + label + '\n\n' +
      (inh.dias || []).map((x, i) => 'Dia ' + (i + 1) + ' (' + (INDELING[x.indeling] || 'Punten') + '): ' + x.titel + '\n' + x.tekst +
        (x.notitie ? '\n[notitie] ' + x.notitie : '')).join('\n\n'), 'utf8') };
    if (formaat === 'csv' && d.soort === 'blad') {
      const cellen = inh.cellen || {};
      const motor = M.maak({ ruw: (b, k, r) => cellen[kolNaam(k) + (r + 1)] || '' });
      const regels = [];
      for (let r = 0; r < (inh.rijen || 20); r++) {
        const rij = [];
        for (let k = 0; k < (inh.kolommen || 8); k++) rij.push(csvVeld(M.tekstVan(motor.cel(k, r))));
        regels.push(rij.join(','));
      }
      return { buffer: Buffer.from(regels.join('\n'), 'utf8'),
        trouw: [{ wat: 'CSV draagt geen formules, opmaak of eigenschappen: de waarden gaan mee, de classificatie staat in de bestandsnaam', aantal: 1 }] };
    }
    if (formaat === 'csv') {
      const regels = [['lijst', 'kaart', 'notitie', 'label', 'wie', 'voor', 'klaar'].map(csvVeld).join(',')];
      for (const l of inh.lijsten || []) for (const k of l.kaarten || []) {
        regels.push([l.titel, k.titel, k.notitie, k.label, k.wie, k.voor, k.klaar ? 'ja' : 'nee'].map(csvVeld).join(','));
      }
      return { buffer: Buffer.from(regels.join('\n'), 'utf8'),
        trouw: [{ wat: 'CSV draagt geen eigenschappen: de classificatie staat in de bestandsnaam', aantal: 1 }] };
    }
    // svg: de tekening wordt in de browser getekend en hier gemarkeerd, niet nagebouwd
    const svg = String((data && data.svg) || '');
    if (!/^(<\?xml[^>]*>\s*)?<svg\b/.test(svg) || svg.length > MAX_SVG) return { fout: 'Stuur de tekening mee als SVG.' };
    return { trouw: [], buffer: Buffer.from(svg.replace(/<svg\b([^>]*)>/, (m, a) =>
      '<svg' + a + '><title>' + esc(d.titel) + '</title><desc>Classificatie: ' + esc(label) + '</desc>' +
      '<metadata><rtg:classificatie xmlns:rtg="urn:rtg:office">' + esc(label) + '</rtg:classificatie></metadata>'), 'utf8') };
  }

  /* ---- exporteren: elk formaat, elke soort, langs dezelfde poort ---- */
  function exporteer(key, did, data, kring) {
    const d = docMet(did);
    if (!d) return { status: 404, error: 'Document niet gevonden.' };
    if (!magLezen(d, key, kring)) return { status: 403, error: 'Dit document is niet met u gedeeld.' };
    const formaat = String((data && data.formaat) || '');
    const kan = FORMATEN[d.soort] || [];
    if (!kan.includes(formaat)) {
      return { status: 400, kan, error: kan.length
        ? 'Dit document gaat eruit als ' + kan.map(f => f.toUpperCase()).join(' of ') + '.'
        : 'Een formulier exporteert u als uitslag; dat doet de beheerder bij Uitslag.' };
    }
    const oordeel = poort(d, 'export');
    if (!oordeel.mag) return { status: 403, code: oordeel.code, error: oordeel.reden };
    const r = bouw(d, formaat, data, oordeel.label);
    if (r.fout) return { status: 400, error: r.fout };
    // eigen ring, zodat exports het beheerspoor nooit verdringen (zie spoorVan in ./basis.js)
    if (!Array.isArray(d.uitgaand)) d.uitgaand = [];
    d.uitgaand.unshift({ om: new Date().toISOString(), door: naamVan(key), actie: 'geexporteerd', formaat, classificatie: oordeel.classificatie });
    if (d.uitgaand.length > MAX_UITGAAND) d.uitgaand.length = MAX_UITGAAND;
    save();
    return { status: 200, naam: bestandsnaam(d.titel, oordeel.label, formaat), mime: MIME[formaat], formaat,
      classificatie: oordeel.classificatie, label: oordeel.label, bytes: r.buffer.length,
      bestand: r.buffer.toString('base64'), trouw: r.trouw };
  }

  /* ---- XLSX inlezen: een NIEUW rekenblad, nooit over een bestaand heen ---- */
  function importeer(key, data, kring, maak) {
    const b64 = String((data && data.bestand) || '');
    if (!b64) return { status: 400, error: 'Kies een XLSX-bestand.' };
    if (!/^[A-Za-z0-9+/=\s]+$/.test(b64)) return { status: 400, error: 'Het bestand kwam beschadigd binnen.' };
    const buf = Buffer.from(b64, 'base64');
    if (buf.length > MAX_XLSX) return { status: 413, error: 'Dit bestand is te groot voor een rekenblad hier (maximaal ' + Math.round(MAX_XLSX / 1000) + ' kB).' };
    let gelezen;
    try { gelezen = leesXlsx(buf); }
    catch (e) { if (e && e.zipFout) return { status: 422, error: e.message }; throw e; }
    const inhoud = schoonInhoud('blad', gelezen.inhoud);
    if (grootteVan(inhoud) > MAX_BYTES) return { status: 413, error: 'Dit werkblad is te groot voor een rekenblad hier; kort het in.' };
    const titel = schoon(data.titel, 120) || gelezen.naam || 'Ingelezen rekenblad';
    const gemaakt = maak(key, { soort: 'blad', titel }, kring);
    if (gemaakt.error) return gemaakt;
    const d = docMet(gemaakt.id);
    d.inhoud = inhoud;
    schrijfAudit(d, key, 'ingelezen', { formaat: 'xlsx', cellen: Object.keys(inhoud.cellen).length });
    save();
    return { status: 200, ok: true, id: d.id, soort: 'blad', titel: d.titel,
      cellen: Object.keys(inhoud.cellen).length, trouw: gelezen.trouw };
  }

  return { exporteer, importeer };
};

module.exports.FORMATEN = FORMATEN;
