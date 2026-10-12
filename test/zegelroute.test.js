/* RTG Zegel-routes (server.js): een lid maakt een zegel voor een partner, de
   partner haalt de publieke sleutel op en verifieert OFFLINE (met server/lib/
   zegel.controleer). Getoetst: selectieve onthulling (alleen ware, gevraagde
   feiten; geen ruwe gegevens), onkoppelbare pseudoniemen per partner, en dat een
   feit dat niet klopt (onder 18) niet te bewijzen valt.
   Draai los: node --test test/zegelroute.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, elevateTier, kantoorAlsPersoon } = require('./helper');
const { controleer } = require('../server/lib/zegel');
const fs = require('fs');
const os = require('os');
const path = require('path');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zegelrt-')); }
async function api(base, pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json() };
}
async function registreer(base, extra) {
  const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  // zelf-registreren geeft altijd RTG; een echt Business-lid (dat de pas-claim
  // 'business' in het zegel oplevert) ontstaat pas na een menselijk akkoord.
  // Dus: als RTG registreren en langs de office-akkoordflow optillen.
  const gewenst = (extra && extra.tier) || 'business';
  const body = Object.assign({
    name: 'Zegel Lid', email: u + '@x.nl', phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01'
  }, extra, { tier: 'rtg', pasApp: 'rtg' });
  delete body.paspoort;
  const token = (await api(base, '/api/auth/register', body)).body.token;
  if (gewenst === 'business' || gewenst === 'lifestyle') {
    const office = (await api(base, '/api/office/login', { code: 'RTG-OFFICE' })).body.token;
    await elevateTier(base, token, gewenst, office);
  }
  /* HET PASPOORT LATEN ZIEN. Een leeftijd in het zegel is sinds 12 oktober 2026
     een GEZIENE leeftijd (kern/betrouwbaarheid.js `leeftijdGezien`): een
     kantoormens op naam keurt het bewijs goed en neemt de datum van het document
     over. `paspoort`:
       undefined  -> de opgegeven datum staat ook op het document (de gewone weg)
       null       -> wel goedgekeurd, maar de keurder nam geen datum over
       false      -> niet laten controleren
       'JJJJ-MM-DD' -> het document zegt iets anders dan het lid opgaf */
  const paspoort = extra && Object.prototype.hasOwnProperty.call(extra, 'paspoort') ? extra.paspoort : undefined;
  if (paspoort !== false) {
    assert.equal((await api(base, '/api/verify/upload', { image: PNG }, token)).status, 200, 'bewijs ingediend');
    const kantoor = await kantoorAlsPersoon(base, 'RTG-OFFICE');
    assert.ok(kantoor, 'een kantoormens op naam');
    const rij = (await api(base, '/api/office/verifications', {}, kantoor)).body.pending.find(x => x.email === body.email);
    assert.ok(rij, 'de verificatie staat in de wachtrij');
    const keur = { userId: rij.id, decision: 'approve' };
    if (paspoort !== null) keur.geboortedatum = paspoort === undefined ? body.geboortedatum : paspoort;
    assert.equal((await api(base, '/api/office/verify', keur, kantoor)).status, 200, 'goedgekeurd');
  }
  return token;
}
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('1. lid maakt zegel, partner verifieert offline; geen ruwe gegevens', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const lid = await registreer(base);
    assert.ok(lid, 'lid geregistreerd');

    // de partner-app haalt eenmalig de publieke sleutel op (daarna offline)
    const sleutel = (await (await fetch(base + '/api/zegel/sleutel')).json()).sleutel;
    assert.ok(sleutel, 'publieke sleutel opgehaald');

    // het lid maakt een zegel voor KIKUNOI: 18+, geldig lid, welke pas
    const mk = await api(base, '/api/zegel/maak', { partner: 'KIKUNOI', claims: ['leeftijd18', 'lid', 'pas'], geldigMin: 5 }, lid);
    assert.equal(mk.status, 200);
    const token = mk.body.token;
    assert.ok(token, 'zegel-token ontvangen');

    // OFFLINE verifiëren met alleen de publieke sleutel
    const r = controleer(token, sleutel);
    assert.equal(r.geldig, true, 'zegel is geldig');
    assert.equal(r.claims.leeftijd18, true);
    assert.equal(r.claims.lid, true);
    assert.equal(r.claims.pas, 'business');
    assert.match(r.sub, /^pw_/, 'onderwerp is een pseudoniem');

    // er zitten GEEN ruwe gegevens in het token
    const payload = Buffer.from(token.split('.')[0], 'base64url').toString();
    /* De geboortedatum als DATUM zoeken en niet als jaartal: een kaal /1990/
       sloeg ook aan op een tijdstempel als exp 1790199078 -- een vals alarm dat
       afhing van de klok. */
    assert.doesNotMatch(payload, /Zegel Lid|1990-01-01|01-01-1990|@x\.nl/, 'geen naam/geboortedatum/e-mail in het zegel');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('2. onkoppelbaar: hetzelfde lid krijgt per partner een ander pseudoniem', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const lid = await registreer(base);
    const bijKiku = (await api(base, '/api/zegel/maak', { partner: 'KIKUNOI', claims: ['lid'] }, lid)).body.sub;
    const bijSakura = (await api(base, '/api/zegel/maak', { partner: 'SAKURA', claims: ['lid'] }, lid)).body.sub;
    assert.ok(bijKiku && bijSakura);
    assert.notEqual(bijKiku, bijSakura, 'twee venues kunnen het lid niet matchen');
    // maar bij dezelfde partner blijft het stabiel
    const bijKiku2 = (await api(base, '/api/zegel/maak', { partner: 'KIKUNOI', claims: ['lid'] }, lid)).body.sub;
    assert.equal(bijKiku, bijKiku2, 'zelfde partner = herkenbaar');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('4. leverancier doet een officiele ID-check: server verifieert en logt', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    // lid maakt een zegel voor KIKUNOI (18+, lid)
    const lid = await registreer(base);
    const token = (await api(base, '/api/zegel/maak', { partner: 'KIKUNOI', claims: ['leeftijd18', 'lid'] }, lid)).body.token;
    assert.ok(token);

    // de zaak logt in en controleert het zegel via de eigen ID-check
    const roster = (await api(base, '/api/supplier/roster', { code: 'KIKUNOI' })).body;
    const staff = roster.staff.find(x => x.role !== 'manager') || roster.staff[0];
    const sup = (await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: staff.id, pin: '5678' })).body.token;
    assert.ok(sup, 'leverancier ingelogd');

    const ok = await api(base, '/api/supplier/zegel/check', { token }, sup);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.geldig, true, 'geldig zegel');
    assert.equal(ok.body.claims.leeftijd18, true);

    // een onzin-token wordt afgewezen
    const nee = await api(base, '/api/supplier/zegel/check', { token: 'rommel.zooi' }, sup);
    assert.equal(nee.body.geldig, false);

    // zonder leverancier-login mag het niet
    const zonder = await api(base, '/api/supplier/zegel/check', { token }, null);
    assert.equal(zonder.status, 401);
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('3. selectieve onthulling: een onwaar feit valt niet te bewijzen', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    // een lid van 19 (geboren 2007) vraagt 21+ aan: dat is niet waar, dus het
    // kan niet worden bewezen; 18+ en lidmaatschap wel.
    const lid = await registreer(base, { geboortedatum: '2007-01-01' });
    const mk = await api(base, '/api/zegel/maak', { partner: 'KIKUNOI', claims: ['leeftijd21', 'leeftijd18', 'lid'] }, lid);
    assert.equal(mk.status, 200);
    assert.equal(mk.body.claims.leeftijd21, undefined, '21+ zit NIET in het zegel (niet waar, niet te bewijzen)');
    assert.equal(mk.body.claims.leeftijd18, true, '18+ kan wel');
    assert.equal(mk.body.claims.lid, true, 'lidmaatschap wel');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

/* DE TEGENPROEF: geen enkele weg van een NIET GEZIENE geboortedatum naar een
   ondertekende leeftijd. Elke rij is een manier waarop het vroeger wel lukte.
   Het zegel wordt OFFLINE gelezen zoals een partner het leest, want dat is de
   belofte die hier telt -- niet wat de route in zijn antwoord zet. */
test('5. een niet geziene geboortedatum levert nooit een leeftijd in het zegel', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const sleutel = (await (await fetch(base + '/api/zegel/sleutel')).json()).sleutel;
    async function zegelVan(token) {
      const mk = await api(base, '/api/zegel/maak', { partner: 'KIKUNOI', claims: ['leeftijd18', 'leeftijd21', 'lid'] }, token);
      assert.equal(mk.status, 200);
      const r = controleer(mk.body.token, sleutel);
      assert.equal(r.geldig, true, 'het zegel zelf blijft geldig');
      return { claims: r.claims, nietBewezen: mk.body.nietBewezen || {} };
    }

    // a. zelf ingetypt, nooit gecontroleerd
    const a = await zegelVan(await registreer(base, { tier: 'rtg', paspoort: false }));
    assert.equal(a.claims.leeftijd18, undefined, 'opgegeven datum: geen 18+');
    assert.equal(a.claims.leeftijd21, undefined, 'opgegeven datum: geen 21+');
    assert.equal(a.claims.lid, true, 'lid blijft wel te bewijzen');
    assert.match(a.nietBewezen.leeftijd18, /niet gecontroleerd/, 'het lid hoort waarom');

    // b. paspoort goedgekeurd, maar de keurder nam de datum niet over
    const b = await zegelVan(await registreer(base, { tier: 'rtg', paspoort: null }));
    assert.equal(b.claims.leeftijd18, undefined, 'A3 zonder documentdatum: geen 18+');
    assert.match(b.nietBewezen.leeftijd18, /zelf opgaf/);

    // c. het lid gaf zich ouder op dan het document zegt
    const c = await zegelVan(await registreer(base, { tier: 'rtg', geboortedatum: '1990-01-01', paspoort: '2012-05-05' }));
    assert.equal(c.claims.leeftijd18, undefined, 'het document wint van de opgave');
    assert.equal(c.nietBewezen.leeftijd18, undefined, 'gezien en onwaar is iets anders dan niet bewezen');

    // d. een demo-persona zonder account
    const demo = (await api(base, '/api/login', { tier: 'rtg' })).body.token;
    assert.ok(demo, 'demo-sessie');
    const d = await zegelVan(demo);
    assert.equal(d.claims.leeftijd18, undefined, 'demo-persona: geen 18+');
    assert.match(d.nietBewezen.leeftijd18, /eigen RTG-account/);

    // e. de tegenproef: gezien en oud genoeg komt er wel in
    const e = await zegelVan(await registreer(base, { tier: 'rtg', geboortedatum: '1990-01-01' }));
    assert.equal(e.claims.leeftijd18, true, 'gezien en 18+: wel');
    assert.deepEqual(e.nietBewezen, {}, 'en dan valt er niets uit te leggen');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
