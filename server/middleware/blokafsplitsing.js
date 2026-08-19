/* ============================================================================
   DE MACHINE DIE EEN BLOK UIT EEN PAGINA HAALT EN LOS UITLEVERT.

   Hij staat hier omdat hij TWEE KEER bestond. ./stijlafsplitsing.js en
   ./scriptafsplitsing.js deden hetzelfde werk met een andere tag: dezelfde
   base64url-codering van het paginapad, dezelfde GOED_PAGINA-controle, dezelfde
   sha1-vingerafdruk, dezelfde mtime-cache, dezelfde brotli/gzip op stand 6,
   dezelfde 400/404-antwoorden. Alleen de reguliere uitdrukking, het
   content-type en de bovengrens van de index verschilden.

   Dat is geen dubbele code die toevallig op elkaar lijkt: het is EEN machine.
   En een machine die twee keer staat, wordt maar een keer gerepareerd -- de
   volgende die een randgeval in de padcontrole dichttimmert, doet dat in het
   bestand waar hij toevallig zit.

   WAT ER NIET NAAR HIER IS VERHUISD, en met opzet: de AFWEGING. Waarom een
   stijlblok mag verhuizen zonder dat de cascade schuift, en waarom een
   scriptblok mag verhuizen zonder dat de uitvoervolgorde schuift, zijn twee
   verschillende argumenten die elk in hun eigen bestand horen te staan -- met
   de meting erbij. Ook magVerhuizen() blijft daar: wat een blok onverplaatsbaar
   maakt is per soort anders (@import en relatieve url() bij stijl,
   document.write en currentScript bij script).

   Hier staat dus alleen het GEREEDSCHAP. De redenering staat bij de gebruiker.

   GEEN SERVERGEHEUGEN. De verwijzing beschrijft zichzelf (welk bestand, welk
   blok, welke vingerafdruk) en de server leest dat blok gewoon opnieuw uit de
   bron. Een tabel op de server zou na een herstart leeg zijn, en dan krijgt een
   pagina die al openstond een 404 op haar eigen opmaak -- kaal scherm, geen
   foutmelding. Dezelfde keuze als bij de twee bundels ernaast.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

/* Vanaf welke omvang loont het afsplitsen. Deze grens is gemeten en niet
   gekozen; de meting (en waarom 3000 hier heeft gestaan en is teruggedraaid)
   staat in de kop van ./stijlafsplitsing.js. Hij geldt voor allebei de soorten,
   want de ruil is dezelfde: bytes uit de HTML tegen een extra verzoek. */
const DREMPEL = 5000;

const codeer = (p) => Buffer.from(p, 'utf8').toString('base64url');
const decodeer = (s) => {
  try { return Buffer.from(String(s || ''), 'base64url').toString('utf8'); }
  catch (e) { return ''; }
};

/* Zelfde strengheid als GOED_PAD in ./compressie.js, maar voor de PAGINA: geen
   spaties, geen dubbele punt, geen .., en die (?!\/) zodat //ergens.anders/x.html
   er niet doorheen komt -- dat is voor een browser een volledig adres bij een
   vreemde server. */
const GOED_PAGINA = /^\/(?!\/)[A-Za-z0-9_\-/.]+\.html$/;

const vinger = (tekst) => crypto.createHash('sha1').update(tekst).digest('base64url').slice(0, 12);

const goedePagina = (p) => GOED_PAGINA.test(p) && p.indexOf('..') === -1;

/* ---------------------------------------------------------------------------
   soort = {
     PAD          het adres waarop de blokken worden uitgeleverd
     TAG          de reguliere uitdrukking met (attrs)(inhoud) als groepen
     naam         het woord in de opentag, voor de goedkope voorcontrole
     type         het content-type van het losse bestand
     maxIndex     hoeveel blokken van deze soort we op een pagina accepteren
     aan          staat deze laag aan (env)
     magVerhuizen wat dit soort blok onverplaatsbaar maakt
     verwijzing   hoe de vervangende tag eruitziet
   }
--------------------------------------------------------------------------- */
function maakAfsplitsing(soort) {
  const TAG = new RegExp(soort.TAG.source, 'gi');

  /* ---- de pagina-kant: blok eruit, verwijzing ervoor in de plaats ---- */
  function herschrijfHtml(html, paginaPad) {
    if (!soort.aan) return html;
    if (!goedePagina(String(paginaPad || ''))) return html;
    const open = '<' + soort.naam;
    if (html.indexOf(open) === -1 && html.indexOf(open.toUpperCase()) === -1) return html;
    let index = -1;
    TAG.lastIndex = 0;
    return html.replace(TAG, (heel, attrs, inhoud) => {
      index++;
      if (String(attrs || '').trim() !== '') return heel;   // niet kaal: laten staan
      if (inhoud.length < DREMPEL) return heel;
      if (!soort.magVerhuizen(inhoud)) return heel;
      return soort.verwijzing(soort.PAD + '?f=' + codeer(paginaPad) + '&i=' + index +
        '&v=' + vinger(inhoud));
    });
  }

  /* ---- de uitleverkant: het blok terugzoeken in de bron ---- */
  function blokUit(html, index) {
    let i = -1, gevonden = null;
    TAG.lastIndex = 0;
    html.replace(TAG, (heel, attrs, inhoud) => {
      i++;
      if (i === index) gevonden = { attrs: String(attrs || '').trim(), inhoud };
      return heel;
    });
    return gevonden;
  }

  function uitleveren(publicDir) {
    const cache = new Map(); // pad -> { stempel, blokken: Map(index -> {ruw, gz, br}) }
    return (req, res, next) => {
      if (req.path !== soort.PAD) return next();
      const paginaPad = decodeer(req.query && req.query.f);
      const index = Number(req.query && req.query.i);
      if (!goedePagina(paginaPad)) {
        return res.status(400).type('text/plain').send('/* geen blok gevraagd */');
      }
      if (!Number.isInteger(index) || index < 0 || index > soort.maxIndex) {
        return res.status(400).type('text/plain').send('/* geen blok gevraagd */');
      }
      const bestand = path.join(publicDir, paginaPad);
      if (!bestand.startsWith(publicDir + path.sep)) return res.status(400).type('text/plain').send('/* buiten de map */');

      let st;
      try { st = fs.statSync(bestand); } catch (e) { return next(); }
      const stempel = st.mtimeMs + ':' + st.size;

      let hit = cache.get(paginaPad);
      if (!hit || hit.stempel !== stempel) { hit = { stempel, blokken: new Map() }; cache.set(paginaPad, hit); }
      let blok = hit.blokken.get(index);
      if (!blok) {
        let html;
        try { html = fs.readFileSync(bestand, 'utf8'); } catch (e) { return next(); }
        const gevonden = blokUit(html, index);
        /* Staat het blok er niet meer (de pagina is gewijzigd terwijl er nog een
           oude verwijzing openstond), dan is 404 het eerlijke antwoord: de
           browser heeft dat adres al, en de nieuwe pagina vraagt een nieuwe url. */
        if (!gevonden) return res.status(404).type('text/plain').send('/* blok bestaat niet meer */');
        blok = { ruw: Buffer.from(gevonden.inhoud, 'utf8') };
        hit.blokken.set(index, blok);
      }

      res.setHeader('Content-Type', soort.type);
      res.setHeader('Vary', 'Accept-Encoding');
      /* De vingerafdruk staat in de url: hetzelfde adres is per definitie
         dezelfde inhoud, dus dit mag echt lang blijven staan. Zie de kop van
         ./stijlafsplitsing.js voor waarom dat hier wel mag en in
         ./compressie.js niet. */
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

      const ae = String(req.headers['accept-encoding'] || '');
      const br = /\bbr\b/.test(ae), gz = !br && /\bgzip\b/.test(ae);
      /* Stand 6, net als de twee bundels hiernaast: negen tiende van de winst
         van stand 11 voor een vijftigste van de tijd. Eenmalig per blok, daarna
         uit deze cache. */
      if (br) {
        if (!blok.br) blok.br = zlib.brotliCompressSync(blok.ruw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 6 } });
        res.setHeader('Content-Encoding', 'br');
        return res.end(blok.br);
      }
      if (gz) {
        if (!blok.gz) blok.gz = zlib.gzipSync(blok.ruw, { level: 6 });
        res.setHeader('Content-Encoding', 'gzip');
        return res.end(blok.gz);
      }
      return res.end(blok.ruw);
    };
  }

  return { herschrijfHtml, blokUit, uitleveren };
}

module.exports = { maakAfsplitsing, codeer, decodeer, vinger, DREMPEL, GOED_PAGINA };
