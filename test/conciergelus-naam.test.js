/* De naam van wie een lus-case oppakt (CONCIERGE.md, CON-11). De naam komt uit
   de SESSIE: met de gedeelde kantoorcode is er geen mens, en dan ziet het lid
   een rol; neemt een herleidbaar mens van het kantoor de case, dan ziet het lid
   diens codenaam. De route gaf de sessiesleutel van die mens aan liveCodename,
   die een sessie verwacht -- en zo bleef de naam altijd leeg.

   Draai los: node --test test/conciergelus-naam.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, elevateTier, kantoorAlsPersoon } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-conciergelus-naam-'));
const roep = async (pad, body, token) => {
  const r = await fetch(BASE + '/api' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) });
  let d = null; try { d = await r.json(); } catch (e) {}
  return { status: r.status, d };
};
test.before(async () => { ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } })); });
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

async function caseVan(merk) {
  const t = Date.now() + '' + Math.floor(Math.random() * 1e4);
  const r = await roep('/auth/register', { name: 'Lid ' + t, email: 'cn' + t + '@v.test',
    phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1980-05-05', tier: 'rtg' });
  await elevateTier(BASE, r.d.token, 'lifestyle', (await roep('/office/login', { code: 'RTG-OFFICE' })).d.token);
  const lid = (await roep('/auth/login', { login: 'cn' + t + '@v.test', password: 'geheim123' })).d.token;
  const z = await roep('/member/bureau/lus/intake', { zin: 'Diner morgen om 20 uur in Amsterdam ' + merk, sleutel: 'naam-' + merk + '-0123456789' }, lid);
  return { lid, id: z.d.zaak.id };
}

test('een herleidbaar mens die de case oppakt, staat er met zijn codenaam; de gedeelde code met een rol', async () => {
  const mens = await kantoorAlsPersoon(BASE);
  assert.ok(mens, 'geen kantoormens op naam in de testomgeving');
  const a = await caseVan('mens');
  const rijA = (await roep('/office/bureau', {}, mens)).d.zaken.find((z) => z.id === a.id);
  const n = await roep('/office/bureau/lus/neem', { key: rijA.key, id: a.id }, mens);
  assert.equal(n.status, 200);
  assert.equal(typeof n.d.eigenaar.naam, 'string', 'het lid hoort te zien welke mens zijn case heeft');
  assert.ok(n.d.eigenaar.naam.length > 2);
  assert.doesNotMatch(n.d.eigenaar.naam, /^user-\d+$/, 'een interne sleutel is geen naam');
  const zichtA = (await roep('/member/bureau/lus/zaak', { id: a.id }, a.lid)).d;
  assert.equal(zichtA.eigenaar.naam, n.d.eigenaar.naam);

  const code = (await roep('/office/login', { code: 'RTG-OFFICE' })).d.token;
  const b = await caseVan('code');
  const rijB = (await roep('/office/bureau', {}, code)).d.zaken.find((z) => z.id === b.id);
  const m = await roep('/office/bureau/lus/neem', { key: rijB.key, id: b.id }, code);
  assert.equal(m.status, 200);
  assert.equal(m.d.eigenaar.naam, null, 'de gedeelde kantoorcode is geen mens en krijgt geen naam');
  assert.equal(m.d.eigenaar.rol, 'Lead Rechterhand');
});
