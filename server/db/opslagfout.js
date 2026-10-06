/* Opslag, deel "fout naar antwoord": hoe een mislukte requestcommit een HTTP-
   antwoord wordt, en wat de server daarover in zijn log zet.

   GEKNIPT UIT postgres-verzoeken.js op 9 september 2026. Dat bestand stond op
   99% van de 10 kB-lat toen de schrijfpoortreparatie erbij kwam; dit is de naad
   die er in de NOG-lijst met naam bij stond. Het is een echte naad en geen
   snede-om-de-lat: deze code raakt geen enkele toestand van de poort (geen
   `gezond`, geen herstel, geen stromen) -- hij vertaalt alleen een fout naar een
   status, een zin en een logregel. */
'use strict';

const context = require('./verzoekcontext');

/* De namen van de gemuteerde collecties, ontdubbeld en begrensd: dit gaat in een
   foutmelding en die hoort leesbaar te blijven. Zonder die namen zegt "save()
   ontbreekt na een mutatie" alleen DAT er iets schreef, en dan begint het zoeken
   pas -- dat kostte op 9 september een halve middag voor een enkele route. */
function namenVan(wijzigingen) {
  const namen = [...new Set((wijzigingen || []).map(w => w && w.sleutel).filter(Boolean))];
  if (!namen.length) return 'onbekende collectie';
  return namen.slice(0, 6).join(', ') + (namen.length > 6 ? ' (+' + (namen.length - 6) + ')' : '');
}

/* De CLIENT krijgt een nette, nietszeggende zin -- terecht. De SERVER kreeg er
   tot 9 september ook een: een 500 uit deze poort liet geen spoor na van de
   reden, dus "8x 5xx op /api/supplier/backoffice" was wel te tellen en niet te
   verklaren. De reden hoort in het log, één regel, met het pad erbij. */
function meldIntern(req, err) {
  /* Een conflict is voor de client bewust nietszeggend, maar zonder de
     collectie/pad uit de interne fout is een multi-instance-race niet te
     onderzoeken: in productie bleef alleen een kale HTTP 409 over. De fout
     bevat geen waarden, uitsluitend het structurele pad waar twee schrijvers
     elkaar raakten, en hoort daarom wel in het interne bewijslog. */
  if (!err || !['PG_SAVE_ONTBREEKT', 'PG_ONGEZOND', 'PG_GEEN_COMMIT', 'PG_REQUEST_CONFLICT',
    'PG_AUDIT_KETEN_GEBROKEN'].includes(err.code)) return;
  console.error('[opslagpoort] ' + err.code + ' op ' + (req && req.method) + ' ' + (req && req.path)
    + ': ' + String(err.message || '').slice(0, 300));
}

function foutAntwoord(req, res, echtEnd, herstel, ctx, err) {
  meldIntern(req, err);
  const gebroken = !!err && err.code === 'PG_AUDIT_KETEN_GEBROKEN';
  context.sluit(ctx);
  if (res.headersSent) { try { res.destroy(err); } catch (e) {} return; }
  herstel();
  try {
    for (const h of ['content-length', 'content-encoding', 'etag']) res.removeHeader(h);
    res.statusCode = err && err.code === 'PG_REQUEST_CONFLICT' ? 409
      : err && err.code === 'PG_SAVE_ONTBREEKT' ? 500 : 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (res.statusCode === 503 && !gebroken) res.setHeader('Retry-After', '2');
  } catch (e) {}
  /* EEN GEBROKEN AUDITSPOOR IS GEEN DRUKTE (audit P1-4): opnieuw proberen of
     opnieuw laden helpt niet, want het spoor in de database is zelf ongeldig.
     Het antwoord zegt dat, en noemt het journaal; de auditwacht heeft het alarm
     al laten afgaan. */
  if (gebroken) return echtEnd(JSON.stringify({ error: 'Er is niets uitgevoerd: het auditspoor (' +
    (err.journaal || 'onbekend') + ') is gebroken, en zonder sluitend spoor wordt geen handeling vastgelegd. ' +
    'Het beheer is gealarmeerd.', reden: 'auditspoor-gebroken', journaal: err.journaal || null }));
  const tekst = res.statusCode === 409
    ? 'Deze gegevens zijn intussen gewijzigd; laad opnieuw en probeer nogmaals.'
    : res.statusCode === 500
      ? 'Deze handeling wijzigde gegevens zonder de verplichte opslagbevestiging.'
      : 'De opslag kon deze handeling niet duurzaam bevestigen; probeer opnieuw.';
  return echtEnd(JSON.stringify({ error: tekst }));
}

module.exports = { foutAntwoord, namenVan, meldIntern };
