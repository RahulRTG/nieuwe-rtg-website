/* RAHUL AAN HET STUUR BIJ EEN AANGEWEZEN OBJECT -- en wat de Edge daarvan
   ziet, op een echte server (EDGE.md par. 14.4, stap 2).

   Twee besluiten van de eigenaar (12 oktober 2026) worden hier vastgehouden:

     A. Met een model aan beantwoordde kern/fluister elke vrije vraag zelf, en
        kwam de stuurlus (plan, voorstel, bevestiging, actiebewijs) via
        /api/fluister nooit aan de beurt (PAKTEBETEKENIS.json: zelfs onzin gaf
        `pakte: true, viaModel: true`). Nu gaat een vraag EERST naar de
        stuurlus, maar ALLEEN als de server een aangewezen object van deze mens
        zelf vond -- de veiligste variant. Elk ander gesprek blijft gelijk.
     B. Wat de Edge toont, is een taakbeeld uit serverbronnen. Het model mag een
        stap "al geboekt" noemen; de stand komt uit het beleid en uit wat er
        werkelijk is uitgevoerd.

   DE NEP-MODELSERVER (OpenAI-vorm, via LOCAL_AI_URL) doet bij een verzoek MET
   gereedschap eerst een `plan`-aanroep en antwoordt na het gereedschap met
   tekst; zonder gereedschap (het gewone gesprek) zegt hij "Genoteerd.". Zo is
   aan het verzoek zelf te zien welk pad de vraag nam.

   GEMETEN MET DE MUTATIE (12 oktober 2026), elk apart:
     a. de route zet stuurEerst altijd op false        -> 1 en 4 zakken
     b. stuurEerst ook zonder CANONIEK object           -> 3 zakt
     c. het terugvallen naar het gesprek weg            -> 4 zakt
     d. `gedaan` weer op acties.some(status < 400)      -> 6 zakt (en niet 1:
        dat plan heeft een verboden stap en staat dus op 409 -- precies
        waarom 6 er moest komen)
     e. lus.js weer `tekst || 'Gedaan.'`                 -> 4 zakt

   Draai los: node --test test/taakbeeld-model.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { startServer, stop } = require('./helper');

const STIL = 'zeg-niets-proef';
const LEES = 'alleen-lezen-proef';
const LEESPLAN = { doel: 'Uw agenda bekijken', stappen: [{ id: 's1', capability: '/api/agenda/mijn', uitkomst: 'Gedaan en geboekt' }] };
const PLAN = { doel: 'Uw reis naar Rome in uw agenda', stappen: [
  { id: 's1', capability: '/api/agenda/mijn', uitkomst: 'Ik heb de reis al geboekt en betaald' },
  { id: 's2', capability: '/api/agenda/toevoegen', uitkomst: 'De reis in uw agenda gezet' },
  { id: 's3', capability: '/api/verzonnen/boek', uitkomst: 'Vrienden uitgenodigd' }
] };

function nepModel() {
  return new Promise((resolve) => {
    const verzoeken = [];
    const srv = http.createServer((req, res) => {
      const brok = [];
      req.on('data', (c) => brok.push(c));
      req.on('end', () => {
        let body = {}; try { body = JSON.parse(Buffer.concat(brok).toString()); } catch (e) {}
        verzoeken.push(body);
        const metGereedschap = Array.isArray(body.tools) && body.tools.length > 0;
        const naGereedschap = (body.messages || []).some((m) => m.role === 'tool');
        const alles = JSON.stringify(body.messages || []);
        let bericht;
        if (metGereedschap && alles.includes(STIL)) bericht = { content: '' };
        else if (metGereedschap && !naGereedschap)
          bericht = { content: null, tool_calls: [{ id: 'c1', type: 'function',
            function: { name: 'plan', arguments: JSON.stringify(alles.includes(LEES) ? LEESPLAN : PLAN) } }] };
        else if (metGereedschap) bericht = { content: 'Ik heb het gewogen; er is nog niets gedaan.' };
        else bericht = { content: 'Genoteerd.' };
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ choices: [{ message: Object.assign({ role: 'assistant' }, bericht),
          finish_reason: bericht.tool_calls ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 2 } }));
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, verzoeken, base: 'http://127.0.0.1:' + srv.address().port }));
  });
}

let model, server, base, A, B;
const api = (pad, body, token) => fetch(base + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const ctx = (ref) => ({ app: 'Reisbureau', deel: 'Mijn aanvragen', wereld: 'travel',
  verwijzingen: [{ soort: 'reisaanvraag', id: ref }], op: Date.now() });

/* Een vraag zoals de vraagbalk hem stelt (plafond tonen), plus welk pad hij nam. */
async function vraag(lid, q, context) {
  const voor = model.verzoeken.length;
  const r = await api('/api/fluister', context ? { q, plafond: 'tonen', context } : { q, plafond: 'tonen' }, lid.token);
  const nieuw = model.verzoeken.slice(voor);
  return { status: r.status, body: r.body, stuur: nieuw.some((v) => Array.isArray(v.tools) && v.tools.length > 0),
    gesprek: nieuw.some((v) => !v.tools || !v.tools.length) };
}

test.before(async () => {
  model = await nepModel();
  server = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-taak-')),
    LOCAL_AI_URL: model.base, LOCAL_AI_MODEL: 'proefmodel', RTG_EXTERNE_AI_UIT: '1' } });
  base = server.base;
  const u = Date.now().toString(36);
  const lid = async (n, tel) => {
    const reg = await api('/api/auth/register', { name: 'Taak ' + n, email: 'taak-' + n + u + '@voorbeeld.test',
      password: 'geheim-' + n + '-123', geboortedatum: '1988-04-04', phone: tel, pasApp: 'rtg' });
    assert.equal(reg.status, 200);
    return { token: reg.body.token };
  };
  A = await lid('a', '0612340001'); B = await lid('b', '0612340002');
  const reizen = (await api('/api/reisbureau', {}, A.token)).body.reizen;
  for (const L of [A, B]) {
    const b = await api('/api/reisbureau/boek', { tripId: reizen[0].id, personen: 6, vertrek: '2026-11-03' }, L.token);
    assert.equal(b.status, 200);
    L.ref = b.body.aanvraag.ref;
  }
});
test.after(async () => { await stop(server); model.srv.close(); });

test('1. een aangewezen eigen aanvraag gaat eerst naar de stuurlus, en de Edge krijgt een taakbeeld uit serverbronnen', async () => {
  const v = await vraag(A, 'Ik wil met zes vrienden vier dagen naar Rome, maximaal 800 euro per persoon.', ctx(A.ref));
  assert.equal(v.status, 200);
  assert.ok(v.stuur, 'de stuurlus kwam aan de beurt');
  assert.equal(v.body.antwoord, 'Ik heb het gewogen; er is nog niets gedaan.');
  const t = v.body.taak;
  assert.ok(t && t.plan, 'er is een taakbeeld met een plan');
  assert.match(t.begrepen.scherm, /opgezocht door RTG: reisaanvraag/, 'Rahul begreep het aangewezen object');
  assert.deepEqual(t.plan.stappen.map((s) => s.staat), ['BESCHIKBAAR', 'GEBLOKKEERD', 'GEBLOKKEERD']);
  assert.match(t.plan.stappen[1].waarom, /alleen tonen/, 'het plafond van de vraagbalk blokkeert het klaarzetten');
  assert.match(t.plan.stappen[2].waarom, /allowlist/, 'een verzonnen capability is geblokkeerd met de reden');
  assert.equal(t.plan.stappen[0].uitkomst.herkomst, 'model');
  assert.deepEqual(t.uitgevoerd, [], 'het model zei "al geboekt en betaald"; er is niets uitgevoerd');
  assert.equal(v.body.gedaan, false, 'een gewogen plan zet gedaan niet aan');
  assert.ok(!JSON.stringify(v.body.stuur || []).includes('"plan":{'), 'het volle plan reist niet dubbel mee in stuur');
});

test('2. zonder aangewezen object blijft het gewone gesprek precies zoals het was', async () => {
  const v = await vraag(A, 'Goedemiddag Rahul');
  assert.equal(v.body.antwoord, 'Genoteerd.');
  assert.ok(!v.stuur, 'geen stuurlus zonder aangewezen object');
  assert.equal(v.body.taak, undefined);
});

test('3. een verwijzing naar andermans aanvraag maakt de vraag niet tot een stuurvraag', async () => {
  const v = await vraag(A, 'Wat staat hier?', ctx(B.ref));
  assert.ok(!v.stuur, 'BUITEN_BEREIK opent de stuurlus niet');
  assert.equal(v.body.antwoord, 'Genoteerd.');
});

test('4. zegt de stuurlus niets, dan antwoordt het gesprek alsnog', async () => {
  const v = await vraag(A, 'Kun je ' + STIL + ' doen?', ctx(A.ref));
  assert.equal(v.status, 200);
  assert.ok(v.stuur, 'eerst de stuurlus');
  assert.ok(v.gesprek, 'daarna het gesprek');
  assert.equal(v.body.antwoord, 'Genoteerd.', 'de mens krijgt een antwoord en geen lege beurt');
});

test('5. een eigen regel van Rahul gaat voor, ook met een aangewezen object', async () => {
  const v = await vraag(A, 'onthoud dat ik van Rome hou', ctx(A.ref));
  assert.equal(v.status, 200);
  assert.ok(!v.stuur, 'onthouden is van kern/fluister en blijft dat');
  assert.match(v.body.antwoord, /Onthouden/);
});

test('6. een volledig uitvoerbaar plan is nog steeds niets gedaan', async () => {
  /* Het oude `gedaan: acties.some(a => a.status < 400)` gaf hier true: een
     uitvoerbaar plan staat met 200 in de acties. */
  const v = await vraag(A, 'Laat ' + LEES + ' zien', ctx(A.ref));
  assert.ok(v.stuur);
  assert.equal(v.body.taak.plan.uitvoerbaar, true);
  assert.equal(v.body.gedaan, false, 'een gewogen plan zet gedaan niet aan, ook niet als het uitvoerbaar is');
});
