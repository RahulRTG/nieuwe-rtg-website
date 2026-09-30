/* De dubbeltik op elke schrijfroute van de concierge-lus, tegen een echte
   server. Voor elke route: dezelfde aanroep twee keer, en daarna moet de case
   er precies zo bij liggen als na de eerste -- dezelfde stand, evenveel
   mogelijkheden, onderdelen en tijdlijnregels. Dit is de meting achter de
   contracten in server/lib/mutatiecontracten-conciergelus.js; wie een route
   hier weghaalt, haalt het bewijs onder zijn contract weg.

   Twee routes zijn met opzet een tweede handeling en staan daarom apart: een
   tweede toelichting is een tweede bericht van het lid.

   Draai los: node --test test/conciergelus-dubbel.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, elevateTier } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-conciergedubbel-'));
const roep = async (pad, body, token) => {
  const r = await fetch(BASE + '/api' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) });
  let d = null; try { d = await r.json(); } catch (e) {}
  return { status: r.status, d };
};
test.before(async () => { ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } })); });
test.after(() => { if (child) try { child.kill('SIGKILL'); } catch (e) {} try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('elke schrijfroute van de lus laat na twee gelijke aanroepen de stand van een aanroep achter', async () => {
  const kant = (await roep('/office/login', { code: 'RTG-OFFICE' })).d.token;
  const t = Date.now() + '';
  const reg = await roep('/auth/register', { name: 'D ' + t, email: 'd' + t + '@v.test', phone: '06' + t.slice(-8),
    password: 'geheim123', geboortedatum: '1980-05-05', tier: 'rtg' });
  await elevateTier(BASE, reg.d.token, 'lifestyle', kant);
  const lid = reg.d.token;

  const intakeLijf = { zin: 'Diner morgen om 20 uur voor 2 personen in Utrecht.', speelruimteMin: 60, sleutel: 'dubbel-' + t + '-0123456789' };
  const i1 = await roep('/member/bureau/lus/intake', intakeLijf, lid);
  const i2 = await roep('/member/bureau/lus/intake', intakeLijf, lid);
  assert.equal(i2.d.zaak.id, i1.d.zaak.id, 'intake: dezelfde sleutel geeft dezelfde case');
  assert.equal((await roep('/member/bureau/zaken', {}, lid)).d.zaken.length, 1, 'intake: geen tweede case');
  const id = i1.d.zaak.id;
  const key = (await roep('/office/bureau', {}, kant)).d.zaken.find(z => z.id === id).key;

  const stand = async () => {
    const z = (await roep('/office/bureau/lus', { key, id }, kant)).d;
    return JSON.stringify({ s: z.zaak.status, soort: z.zaak.soort, m: z.zaak.mogelijkheden.length, o: z.zaak.onderdelen.length,
      t: z.zaak.tijdlijn.length, v: z.zaak.verrassing, k: z.klaar && z.klaar.id,
      st: z.zaak.onderdelen.map(o => o.stand).join(','), e: z.zaak.eigenaar && z.zaak.eigenaar.naam });
  };
  const tweeKeer = async (naam, doe) => {
    const a = await doe();
    assert.ok(a.status < 500, naam + ': ' + JSON.stringify(a.d));
    const na1 = await stand();
    const b = await doe();
    const na2 = await stand();
    assert.equal(na2, na1, naam + ': de tweede aanroep veranderde de stand');
    return { a, b };
  };
  /* Twee deuren, een invariant (server/lib/idemsleutels-conciergelus.js): binnen
     het venster geeft de poort het eerste antwoord terug met `herhaald`,
     daarbuiten weigert de handler op de toestand. Welke deur het werd hangt af
     van de klok; wat telt is dat het een van de twee is en dat tweeKeer de
     stand ongewijzigd vond. */
  const eenVanTwee = (r, code, naam) => assert.ok((r.status === 200 && r.d.herhaald === true) || r.status === code,
    naam + ': ' + r.status + ' ' + JSON.stringify(r.d));
  const k = (pad, b) => () => roep(pad, Object.assign({ key, id }, b), kant);

  await tweeKeer('verrassing', () => roep('/member/bureau/lus/verrassing', { id, aan: true }, lid));
  await tweeKeer('neem', k('/office/bureau/lus/neem', {}));
  await tweeKeer('weigering', k('/office/bureau/lus/weigering', { reden: 'Het restaurant is vol.' }));
  const { a: ab } = await tweeKeer('aanbod', k('/office/bureau/lus/aanbod', { wat: 'Tafel', zaak: 'KIKUNOI', van: '20:15', duurMin: 90, geldigMin: 30 }));
  const { b: kb } = await tweeKeer('kies', k('/office/bureau/lus/kies', { aanbod: ab.d.aanbod.id }));
  eenVanTwee(kb, 409, 'kies: de tweede keuze stuit op het open voorstel');
  const { b: bb } = await tweeKeer('beslis', () => roep('/member/bureau/lus/beslis', { id, akkoord: true }, lid));
  assert.equal(bb.status, 400, 'beslis: er ligt geen tweede voorstel (geen dedup: het lijf noemt het voorstel niet)');
  const { a: on } = await tweeKeer('onderdeel', k('/office/bureau/lus/onderdeel', { wat: 'Chauffeur', zaak: 'TRANSIT', van: '19:30', duurMin: 20 }));
  await tweeKeer('bevestig', k('/office/bureau/lus/bevestig', { onderdeel: on.d.onderdeel.id }));
  const { a: vt } = await tweeKeer('vertraging', k('/office/bureau/lus/vertraging', { onderdeel: on.d.onderdeel.id, minuten: 15 }));
  const gezien = vt.d.klaar.berichten.map(m => m.id);
  const { b: vs } = await tweeKeer('verstuur', k('/office/bureau/lus/verstuur', { klaar: vt.d.klaar.id, gezien }));
  eenVanTwee(vs, 409, 'verstuur: de berichten zijn al weg');
  const tafel = JSON.parse(JSON.stringify((await roep('/office/bureau/lus', { key, id }, kant)).d.zaak.onderdelen)).find(o => o.wat === 'Tafel');
  await tweeKeer('kapot', k('/office/bureau/lus/kapot', { onderdeel: tafel.id, reden: 'keukenprobleem' }));

  // met opzet een tweede handeling: een tweede toelichting is een tweede bericht van het lid
  const voor = (await roep('/office/bureau/lus', { key, id }, kant)).d.zaak.tijdlijn.length;
  await roep('/member/bureau/lus/toelichting', { id, tekst: 'Graag dichtbij.' }, lid);
  await roep('/member/bureau/lus/toelichting', { id, tekst: 'Graag dichtbij.' }, lid);
  assert.equal((await roep('/office/bureau/lus', { key, id }, kant)).d.zaak.tijdlijn.length, voor + 2);

  // een ander lid bereikt deze case niet: 404 en niet 403
  const t2 = Date.now() + '9';
  const reg2 = await roep('/auth/register', { name: 'E ' + t2, email: 'e' + t2 + '@v.test', phone: '06' + t2.slice(-8),
    password: 'geheim123', geboortedatum: '1980-05-05', tier: 'rtg' });
  await elevateTier(BASE, reg2.d.token, 'lifestyle', kant);
  assert.equal((await roep('/member/bureau/lus/zaak', { id }, reg2.d.token)).status, 404);
  assert.equal((await roep('/member/bureau/lus/beslis', { id, akkoord: true }, reg2.d.token)).status, 404);
});
