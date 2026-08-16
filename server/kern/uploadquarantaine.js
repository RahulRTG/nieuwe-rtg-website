/* Uploadquarantaine: onbekende bytes bestaan eerst alleen in een afgescheiden,
   niet-geserveerde werkmap. De eigen scanner en, in productie, een losstaande
   ClamAV-engine keuren exact dat bestand. Alleen na twee schone oordelen mag de
   normale route verder. De werkelijke malware bewaren we bewust niet: een hash
   en melding zijn forensisch nuttig, een terugvindbaar virusbestand niet. */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { maakClamd } = require('./clamd');
const { nu } = require('../lib/klok');

const MAX_BYTES = 16 * 1024 * 1024;
const MAX_BODY_BYTES = 32 * 1024 * 1024;
const MAX_URLS = 24;
const DATA_URL = /^data:([\w.+-]+\/[\w.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/;

class UploadGeweigerd extends Error {
  constructor(reden, oordeel) {
    super(reden || 'Upload geweigerd.');
    this.name = 'UploadGeweigerd';
    this.code = 'RTG_UPLOAD_GEWEIGERD';
    this.oordeel = oordeel || null;
  }
}

function decodeer(dataUrl) {
  const m = DATA_URL.exec(String(dataUrl || ''));
  if (!m || m[2].length % 4 === 1) throw new UploadGeweigerd('De upload is geen geldige base64-data-URL.');
  const padding = m[2].endsWith('==') ? 2 : (m[2].endsWith('=') ? 1 : 0);
  const geschat = Math.max(0, Math.floor(m[2].length * 3 / 4) - padding);
  if (geschat > MAX_BYTES) throw new UploadGeweigerd('Een upload mag hooguit 16 MB zijn.');
  const buf = Buffer.from(m[2], 'base64');
  // Buffer.from is bewust tolerant. Een terug-encode voorkomt dat verborgen,
  // niet-base64 tekens of verkeerd geplaatste padding toch bytes opleveren.
  if (!buf.length || buf.toString('base64') !== m[2]) throw new UploadGeweigerd('De upload bevat ongeldige base64.');
  return { buf, mime: m[1] };
}

function maakUploadquarantaine({ dir, antivirus, clamd }) {
  if (!dir) throw new Error('De uploadquarantaine heeft een datamap nodig.');
  if (!antivirus || typeof antivirus.verwerk !== 'function') throw new Error('De uploadquarantaine heeft De Ontsmetter nodig.');
  const map = path.join(path.resolve(dir), 'quarantaine');
  const buiten = clamd === undefined ? maakClamd({ maxBytes: MAX_BYTES }) : clamd;
  fs.mkdirSync(map, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(map, 0o700); } catch (e) {}

  // Een procescrash kan alleen een niet-vrijgegeven werkbestand achterlaten.
  // Bij de volgende start verdwijnt alles ouder dan een uur; niets hiervan gaat
  // mee in de back-up en er bestaat geen HTTP-route naar deze map.
  const grens = nu() - 60 * 60 * 1000;
  try {
    for (const naam of fs.readdirSync(map)) {
      const p = path.join(map, path.basename(naam));
      try { if (fs.statSync(p).isFile() && fs.statSync(p).mtimeMs < grens) fs.unlinkSync(p); } catch (e) {}
    }
  } catch (e) {}

  async function keurDataUrl(dataUrl, meta) {
    const { buf, mime } = decodeer(dataUrl);
    const naam = crypto.randomBytes(18).toString('hex') + '.in';
    const bestand = path.join(map, naam);
    fs.writeFileSync(bestand, buf, { flag: 'wx', mode: 0o600 });
    try {
      // Lees terug uit de quarantaine: het oordeel hoort bij exact de bytes die
      // op de grens stonden, niet bij een tweede afgeleide variabele.
      const staged = fs.readFileSync(bestand);
      const oordeel = antivirus.verwerk(staged, Object.assign({ mime, naam: '(quarantaine)' }, meta || {}));
      if (!oordeel || oordeel.verdict === 'besmet')
        throw new UploadGeweigerd('Dit bestand is geweigerd door de beveiliging (mogelijke malware).', oordeel);

      if (buiten) {
        const clam = await buiten.scanBestand(bestand);
        if (!clam || clam.verdict !== 'schoon') {
          const extern = { verdict: 'besmet', redenen: ['ClamAV: ' + String(clam && clam.naam || 'malware')],
            bytes: staged.length, sha256: crypto.createHash('sha256').update(staged).digest('hex'), entropie: oordeel.entropie || 0 };
          if (typeof antivirus.registreerExtern === 'function') antivirus.registreerExtern(extern, Object.assign({ mime }, meta || {}));
          throw new UploadGeweigerd('Dit bestand is geweigerd door de externe virusscanner.', extern);
        }
      }
      return { ok: true, verdict: oordeel.verdict, sha256: oordeel.sha256, bytes: staged.length };
    } finally {
      // Geen collectie met malware om later per ongeluk te openen of te delen.
      try { fs.unlinkSync(bestand); } catch (e) {}
    }
  }

  async function keurBody(body, meta) {
    const urls = [];
    let totaal = 0;
    function loop(waarde, diepte) {
      if (diepte > 6 || waarde == null) return;
      if (typeof waarde === 'string') {
        if (waarde.length > 16 && /^data:[^,\s]{1,200};base64,/i.test(waarde)) {
          if (urls.length >= MAX_URLS) throw new UploadGeweigerd('Te veel bestanden in één verzoek.');
          const d = decodeer(waarde);
          totaal += d.buf.length;
          if (totaal > MAX_BODY_BYTES) throw new UploadGeweigerd('De uploads in dit verzoek zijn samen te groot.');
          urls.push(waarde);
        }
        return;
      }
      if (Array.isArray(waarde)) {
        for (let i = 0; i < waarde.length && i < 200; i++) loop(waarde[i], diepte + 1);
        return;
      }
      if (typeof waarde === 'object') for (const sleutel of Object.keys(waarde).slice(0, 500)) loop(waarde[sleutel], diepte + 1);
    }
    loop(body, 0);
    for (const url of urls) await keurDataUrl(url, meta);
    return { ok: true, aantal: urls.length };
  }

  return { keurDataUrl, keurBody, map, extern: !!buiten };
}

module.exports = { maakUploadquarantaine, UploadGeweigerd, decodeer, MAX_BYTES };
