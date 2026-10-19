/* ============================================================================
   HET KAATSMODEL -- een lokale modelserver die teruggeeft wat hij kreeg.

   WAAROM. Een AI-route (/api/metier/ai/brief, /api/bieb/ai, /api/chat/send)
   stelt een prompt samen uit wat de server over het lid weet en stuurt die naar
   een model. Zonder model antwoordt hij 503, en dan is de bevoegdheidsvraag niet
   gesteld: komt er bij lid B iets van lid A in de prompt? Dat is precies de
   foutklasse die een echt model ONZICHTBAAR maakt -- het herformuleert, en een
   lek in de context valt in de tekst niet meer op.

   WAT HET DOET. Het spreekt het OpenAI-compatibele protocol dat server/local-ai.js
   verwacht (POST /v1/chat/completions) en antwoordt met de letterlijke inhoud van
   alle berichten die het kreeg. Wat de server in B's prompt zette, staat daarmee
   in B's antwoord, en de IDOR-proef kan er A's merkwoord in zoeken.

   WAT HET NIET IS: een model. Het beoordeelt niets en verzint niets; een route
   die op de INHOUD van een modelantwoord leunt (een classificatie, een JSON-vorm)
   krijgt onzin terug en faalt eerlijk. Alleen voor de wegwerpserver van een
   proef, en alleen op loopback (dezelfde grens als server/local-ai.js).
   ========================================================================== */
'use strict';
const http = require('http');

function tekstVan(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((d) => (d && typeof d.text === 'string' ? d.text : '')).join('\n');
  return '';
}

function start() {
  return new Promise((klaar) => {
    let verzoeken = 0;
    const srv = http.createServer((req, res) => {
      let lijf = '';
      req.on('data', (d) => { lijf += d; if (lijf.length > 4e6) req.destroy(); });
      req.on('end', () => {
        if (req.method === 'GET' && /\/models$/.test(req.url)) {
          res.writeHead(200, { 'content-type': 'application/json' });
          return res.end(JSON.stringify({ data: [{ id: 'kaats' }] }));
        }
        let b = {}; try { b = JSON.parse(lijf || '{}'); } catch (e) {}
        verzoeken++;
        const tekst = (b.messages || []).map((m) => (m.role || '') + ': ' + tekstVan(m.content)).join('\n');
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ id: 'kaats-' + verzoeken, object: 'chat.completion', model: b.model || 'kaats',
          choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: tekst } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
      });
    });
    srv.listen(0, '127.0.0.1', () => {
      const poort = srv.address().port;
      klaar({ url: 'http://127.0.0.1:' + poort, verzoeken: () => verzoeken, stop: () => srv.close(),
        omgeving: { LOCAL_AI_URL: 'http://127.0.0.1:' + poort, LOCAL_AI_MODEL: 'kaats', LOCAL_AI_MODEL_KORT: 'kaats' } });
    });
  });
}

module.exports = { start, tekstVan };
