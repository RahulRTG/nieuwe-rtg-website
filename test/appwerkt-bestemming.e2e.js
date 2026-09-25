/* BEREIKBAAR IN EEN ECHTE BROWSER -- doorverwijzingen die pas na het laden gebeuren.

   Een synthetisch huis met vier schermen en een eigen register. Een scherm
   verwijst door met location.replace NA het laden, zoals routedossier.html en
   rtgone.html dat doen; de proef moet de LANDING zien en die op capability
   beoordelen. Drie gevallen:
     /apps/a-oud.html  alias -> /apps/a.html        dezelfde capability: BEWEZEN
     /apps/b.html      zonder kantoor -> deur.html   andere capability: NIET_GETEST
     /apps/c.html      idem, maar met kantoor blijft hij staan: verkeerd geadresseerd */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { browserOpties, geenBrowser } = require('./helper');
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

const REG = {
  'apps/a.html': { capability: 'x.a', rol: 'eigenaar' },
  'apps/a-oud.html': { rol: 'alias', naar: '/apps/a.html' },
  'apps/b.html': { capability: 'x.b', rol: 'eigenaar' },
  'apps/c.html': { capability: 'x.c', rol: 'eigenaar' },
  'apps/deur.html': { capability: 'x.deur', rol: 'eigenaar' }
};
const pagina = (lijf) => '<!doctype html><html><body>' + lijf + '</body></html>';
const PAGINAS = {
  '/apps/a.html': pagina('<main><p>Scherm A</p></main>'),
  '/apps/a-oud.html': pagina('<script>setTimeout(function(){location.replace("/apps/a.html")},300)</script>'),
  '/apps/b.html': pagina('<p>B</p><script>setTimeout(function(){location.replace("/apps/deur.html")},300)</script>'),
  '/apps/c.html': pagina('<p>C</p><script>setTimeout(function(){if(!localStorage.getItem("kantoor"))location.replace("/apps/deur.html")},300)</script>'),
  '/apps/deur.html': pagina('<p>Kantoorcode</p>')
};

test('bereikbaar volgt de landing en oordeelt op capability', { skip: geenBrowser(pw) }, async () => {
  const { bezoek } = require('../scripts/appwerkt');
  const B = require('../scripts/lib/bestemming');
  const srv = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(PAGINAS[req.url.split('?')[0]] || pagina('')); });
  await new Promise((k) => srv.listen(0, '127.0.0.1', k));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await pw.chromium.launch(browserOpties(pw));
  try {
    const lid = await browser.newContext();
    const kantoor = await browser.newContext();
    await kantoor.addInitScript(() => { try { localStorage.setItem('kantoor', '1'); } catch (e) {} });
    const oordeel = async (pad) => {
      const b = await bezoek(lid, base, pad);
      const k = await bezoek(kantoor, base, pad);
      return B.beoordeel({ ingang: pad, landing: b.eind, register: REG, persona: 'lid', anderen: [{ persona: 'kantoor', landing: k.eind }] });
    };
    assert.equal((await oordeel('/apps/a-oud.html')).status, 'BEWEZEN', 'een alias naar dezelfde capability is bereikt');
    const b = await oordeel('/apps/b.html');
    assert.equal(b.status, 'NIET_GETEST', 'doorgestuurd naar een andere capability, voor iedereen');
    assert.equal(b.bestemming.landingCap, 'x.deur');
    const c = await oordeel('/apps/c.html');
    assert.equal(c.status, 'GEBLOKKEERD_DOOR_DEFECT', 'de kantoorsessie komt er wel: verkeerd geadresseerd');
    await lid.close(); await kantoor.close();
  } finally {
    await browser.close(); srv.close();
  }
});
