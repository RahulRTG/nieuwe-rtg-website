/* Een reactie in De Salon met een herhaalsleutel staat er een keer, ook na een
   herstart (19 oktober 2026). De voltooiproef van tab:salon zag dezelfde tik na
   een crash twee reacties plaatsen: de centrale antwoordkas leeft in het geheugen.
   Dezelfde sleutel met een andere tekst is een conflict.

   Draai los: node --test test/salon-reactie-herhaal.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-salonreactie-'));
let child, BASE;
const roep = async (pad, body, token) => {
  const r = await fetch(BASE + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) });
  let d = null; try { d = await r.json(); } catch (e) {}
  return { status: r.status, d };
};
const start = async () => { ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } })); };
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('dezelfde reactie met dezelfde sleutel staat er na een herstart een keer; een andere tekst is 409', async () => {
  await start();
  const t = Date.now() + '' + Math.floor(Math.random() * 1e4);
  const reg = await roep('/api/auth/register', { name: 'Lid ' + t, email: 'sr' + t + '@v.test',
    phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1980-05-05', tier: 'rtg' });
  const tok = reg.d.token;
  const posts = async () => (((await roep('/api/state', {}, tok)).d || {}).state || {}).posts || [];
  const doel = (await posts()).find((p) => p.canEngage && !p.partner);
  assert.ok(doel, 'geen post om op te reageren in de testomgeving');
  /* De tekst draagt het merk in letters: een cijferreeks als 06 + acht cijfers
     leest kern/veilig.js terecht als telefoonnummer, en dan hing de toets af
     van het tijdstip. */
  const merk = t.replace(/\d/g, (c) => 'abcdefghij'[c]);
  const lijf = { postId: doel.id, text: 'Herhaal ' + merk, idem: 'salon-herhaal-' + t };
  assert.equal((await roep('/api/comment', lijf, tok)).status, 200);
  child.kill('SIGKILL');
  await new Promise((r) => child.once('exit', r));
  await start();
  assert.equal((await roep('/api/comment', lijf, tok)).status, 200);
  const anders = await roep('/api/comment', Object.assign({}, lijf, { text: 'Anders ' + merk }), tok);
  assert.equal(anders.status, 409, 'dezelfde sleutel met een andere tekst hoort een conflict te zijn');
  const p = (await posts()).find((x) => x.id === doel.id);
  assert.equal(p.comments.filter((c) => c.text === 'Herhaal ' + merk).length, 1);
  assert.equal(p.comments.filter((c) => c.text === 'Anders ' + merk).length, 0);
});
