/* ============================================================================
   DE TOESTELREKENLAAG, SERVERKANT -- vier deuren, en ze rekenen geen van alle.
   TOESTEL.md par. 3.3 en 9.3.

   De server doet hier vier dingen en niet meer:

     GET /toestel/cel                de afgesloten rekencel, met een EIGEN CSP
     GET /toestel/cel.js             haar script (de cel heeft geen origin, zie CEL_HTML)
     GET /toestel/manifest.json      de ondertekende lijst artefacten
     GET /toestel/artefact/<sha256>  de bytes van een artefact, met Range

   Hij controleert geen handtekening en kiest geen uitvoerder: dat doet de
   browser, want alleen de browser weet wat er op dit toestel kan. En hij
   tekent nooit: de private modelsleutel woont offline bij een mens.

   DE CEL heeft als enige pagina van het huis 'wasm-unsafe-eval' (besluit 1,
   25 september 2026), en altijd samen met connect-src 'none'. De ouder plaatst
   haar als <iframe sandbox="allow-scripts">: zonder allow-same-origin is haar
   origin ondoorzichtig, dus bij de ouder, bij OPFS en bij de cookies kan zij
   niet, en de browser houdt elk netwerkverzoek tegen. "Dit toestel nooit
   verlaten" is daarmee een grens van de browser en geen belofte van deze code.
   blob: staat in script-src omdat een uitvoerder (de ONNX-runtime) als
   ondertekend artefact binnenkomt en niet uit de repo: dit huis heeft nul
   afhankelijkheden (scripts/check.js regel 14), en de runtime is net zo goed
   onbetrouwbare rekentechnologie als een model. test/toestel-routes.test.js
   houdt de combinatie vast.

   DE ARTEFACTEN staan in de datamap en niet in git: een model is tientallen
   tot honderden MB, en de ONNX-runtime alleen al 14 MB. Het adres IS de hash,
   dus het antwoord is onveranderlijk en mag eeuwig in een cache.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { stuurBestand } = require('../web/bestanden');

const CEL_CSP = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval' blob:; connect-src 'none'; " +
  "img-src 'none'; style-src 'none'; font-src 'none'; media-src 'none'; worker-src 'none'; " +
  "frame-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'; object-src 'none'";

/* Klassiek script, geen module: een module vanuit een ondoorzichtige origin
   vraagt CORS, een klassiek script niet. En het script komt van /toestel/cel.js
   en niet van /shared/: het huis zet op elk statisch bestand
   Cross-Origin-Resource-Policy: same-origin, en de cel HEEFT geen origin. Die
   kop is voor dit ene bestand cross-origin -- openbare code zonder geheimen --
   en blijft voor al het andere wat hij was. Gevonden door test/toestel.e2e.js:
   ERR_BLOCKED_BY_RESPONSE.NotSameOrigin, en een cel die nooit "klaar" zei. */
const CEL_HTML = '<!doctype html><meta charset="utf-8"><title>RTG toestelcel</title>' +
  '<script src="/toestel/cel.js"></script>';
const CEL_JS = path.join(__dirname, '..', '..', 'public', 'shared', 'toestel', 'cel.js');

function map() {
  return process.env.RTG_TOESTEL_DIR ||
    path.join(process.env.RTG_DATA_DIR || path.join(__dirname, '..', 'data'), 'toestel');
}

module.exports = (kern) => {
  const { app } = kern;

  app.get('/toestel/cel', (req, res) => {
    res.set('Content-Security-Policy', CEL_CSP);
    res.set('Cache-Control', 'no-store');
    res.set('Cross-Origin-Resource-Policy', 'same-origin');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(CEL_HTML);
  });

  app.get('/toestel/cel.js', (req, res) => {
    let code;
    try { code = fs.readFileSync(CEL_JS, 'utf8'); } catch (e) { return res.status(500).json({ error: 'Het celscript ontbreekt op deze omgeving.' }); }
    res.set('Content-Type', 'application/javascript; charset=utf-8');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Cache-Control', 'no-cache');
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(code);
  });

  /* Geen manifest is een eersteklas uitslag en geen leeg manifest: dan zegt
     de server dat er op deze omgeving niets is uitgerold, en waarom. */
  app.get('/toestel/manifest.json', (req, res) => {
    const fp = path.join(map(), 'manifest.json');
    let tekst;
    try { tekst = fs.readFileSync(fp, 'utf8'); } catch (e) {
      return res.status(404).json({ artefacten: [], reden:
        'Op deze omgeving is geen ondertekend manifest uitgerold; er is dus niets dat een toestel mag laden.' });
    }
    let m;
    try { m = JSON.parse(tekst); } catch (e) {
      return res.status(500).json({ artefacten: [], reden: 'Het manifest op deze omgeving is geen geldige JSON.' });
    }
    res.set('Cache-Control', 'no-cache');
    res.json({ versie: m.versie || 1, artefacten: Array.isArray(m.artefacten) ? m.artefacten : [] });
  });

  app.get('/toestel/artefact/:sha', (req, res, next) => {
    const sha = String(req.params.sha || '');
    if (!/^[0-9a-f]{64}$/.test(sha)) return res.status(400).json({ error: 'Een artefact heet naar zijn sha256 (64 hex-tekens).' });
    const fp = path.join(map(), 'artefacten', sha);
    let st;
    try { st = fs.statSync(fp); } catch (e) { return res.status(404).json({ error: 'Dit artefact staat niet op deze omgeving.' }); }
    if (!st.isFile()) return res.status(404).json({ error: 'Dit artefact staat niet op deze omgeving.' });
    res.set('Content-Type', 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('X-Content-Type-Options', 'nosniff');
    return stuurBestand(req, res, fp, st, next);
  });
};

module.exports.CEL_CSP = CEL_CSP;
