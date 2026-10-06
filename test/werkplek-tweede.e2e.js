/* DE TWEEDE STAP VAN DE WERKPLEKINLOG IN EEN ECHTE BROWSER (N19).

   test/werkplek-tweede.test.js bewijst de server: met de tweede factor aan geeft
   /api/supplier/mijn/login op het wachtwoord alleen een bewijs. Dat helpt een
   medewerker niets als zijn scherm dat bewijs niet kan omruilen: dan staat hij
   na een juist wachtwoord voor een dichte deur. Deze toetsen lopen de twee
   schermen die de route aanroepen, met een echte authenticatorcode:

     - de personeels-app (personeel-03.js, personeel-03b.js): na het wachtwoord
       een codeveld, een verkeerde code zegt het, de juiste opent de werkplek,
       en een verlopen bewijs brengt terug naar het wachtwoord, met de reden;
     - de leverancier-app (leverancier-06a.js): het gesprek met Rahul, daarna
       het codeformulier. De juiste code geeft de werksessie; een verlopen
       bewijs of een weggehaalde werkplek brengt het gesprek terug met de echte
       reden; de aanmeldweg (kassacode) landt op de zaak waar het lid zich net
       aanmeldde, en een herstelcode zegt hoeveel er over zijn, ook na de
       sectorwissel die de pagina opnieuw laadt.

   Het codeveld is in beide gevallen het veld van de techniekpagina:
   inputmode numeric, autocomplete one-time-code en een aria-label.

   Elke toets met een eigen lid, behalve waar Nora Prins uit de zaaiset (Sal de
   Mar en Vora Beach Club) de gewone weg draagt; de server en de browser worden
   gedeeld, elke toets krijgt een eigen browsercontext.

   Draai los: node --test test/werkplek-tweede.e2e.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser,
  letOpFouten, wachtTot, wachtOpZichtbaar } = require('./helper');
const { totpCode } = require('../server/kern/totp');

const pw = laadPlaywright();
const ZONDER_BROWSER = geenBrowser(pw);
const NORA = 'nora@rtg.example', NORA_WW = 'werk';
const WW = 'geheim12', WW_NIEUW = 'geheim-nieuw-34';
let srv, dir, browser, nora, managerKikunoi, managerPonto;

async function post(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(srv.base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const kort = (b) => JSON.stringify(b).slice(0, 160);

/* Een TOTP-code werkt een keer (server/kern/totp.js), en het venster kent er
   drie; het aanzetten maakt er een op. Dit geeft telkens een ongebruikte.

   NOOIT DE CODE VAN DE VORIGE STAP. De server neemt een code aan van de stap
   ervoor, deze en de volgende; de code van de vorige stap is dus nog maar tot
   de volgende stapgrens geldig, en dat kan een paar milliseconden zijn. Onder
   belasting viel een toets daar een keer precies tussen ("Die code klopt
   niet" op de juiste code). Deze stap en de volgende blijven minstens dertig
   seconden geldig; zijn die op, dan een herstelcode uit de reserve. */
function codeBron(geheim, eerste, reserve) {
  const gebruikt = new Set([eerste]), rest = (reserve || []).slice();
  return () => {
    for (const d of [30000, 0]) {
      const c = totpCode(geheim, Date.now() + d, 30);
      if (!gebruikt.has(c)) { gebruikt.add(c); return c; }
    }
    if (rest.length) return rest.shift();
    throw new Error('geen ongebruikte code meer in dit venster');
  };
}
function foutCode(geheim) {
  const geldig = new Set([-30000, 0, 30000].map(d => totpCode(geheim, Date.now() + d, 30)));
  let c = '000000';
  for (let i = 0; geldig.has(c); i++) c = String(100000 + i);
  return c;
}

/* De tweede factor aanzetten op een account waarvoor we een ledentoken hebben. */
async function zetTweedeAan(token, wachtwoord) {
  const begin = await post('/api/mijn/tweefactor/begin', { huidig: wachtwoord }, token);
  assert.ok(begin.body.geheim, 'tweede factor beginnen: ' + kort(begin.body));
  const eerste = totpCode(begin.body.geheim, Date.now(), 30);
  const aan = await post('/api/mijn/tweefactor/bevestig', { code: eerste }, token);
  assert.equal(aan.status, 200, 'tweede factor aan: ' + kort(aan.body));
  // de eerste herstelcode blijft buiten de reserve: toets 4 gebruikt hem zelf
  const herstelcodes = aan.body.herstelcodes || [];
  return { geheim: begin.body.geheim, code: codeBron(begin.body.geheim, eerste, herstelcodes.slice(1)), herstelcodes };
}
async function managerVan(code) {
  const roster = await post('/api/supplier/roster', { code });
  const man = (roster.body.staff || []).find(x => x.role === 'manager');
  assert.ok(man, 'de zaak ' + code + ' heeft een manager');
  const ml = await post('/api/supplier/login', { code, staffId: man.id, pin: '1234' });
  assert.ok(ml.body.token, 'de manager van ' + code + ' logt in: ' + kort(ml.body));
  return { token: ml.body.token, zaak: roster.body.supplier.name };
}
/* Een eigen lid met tweede factor en een werkplek bij Sal de Mar: registreren,
   door de manager uitgenodigd, zelf aangemeld met de kassacode. De naam komt
   uit de letters van het e-mailadres, en dezelfde naam geeft de zaak niet
   twee keer uit: kies adressen die in hun LETTERS verschillen. */
async function werknemer(email) {
  const naam = 'Werk ' + email.split('@')[0].replace(/[^a-z]+/g, ' ').trim();
  const reg = await post('/api/auth/register', { name: naam, email, password: WW, geboortedatum: '1990-01-01' });
  assert.ok(reg.body.token, 'registratie: ' + kort(reg.body));
  const inv = await post('/api/supplier/staff/invite', { name: naam, func: 'Bediening' }, managerKikunoi.token);
  assert.equal(inv.status, 200, 'uitnodiging: ' + kort(inv.body));
  const join = await post('/api/supplier/staff/join', { bedrijf: managerKikunoi.zaak,
    kassacode: inv.body.invite.kassacode, login: email, password: WW });
  assert.equal(join.status, 200, 'aanmelding bij de zaak: ' + kort(join.body));
  return Object.assign({ email, token: reg.body.token, staffId: join.body.staffId }, await zetTweedeAan(reg.body.token, WW));
}
/* Het wachtwoord wijzigen tussen stap een en twee. De sessiegrens (N12) moet
   aantoonbaar NA het uitgiftemoment van het bewijs liggen: wacht op de
   volgende kloktik na het antwoord van stap een. */
async function wachtwoordWeg(lid, uitgegeven) {
  while (Date.now() <= uitgegeven) await new Promise(r => setTimeout(r, 1));
  const wissel = await post('/api/auth/password', { huidig: WW, nieuw: WW_NIEUW }, lid.token);
  assert.equal(wissel.status, 200, 'wachtwoord wijzigen: ' + kort(wissel.body));
}

async function codeveldKlopt(page, selector) {
  const v = await page.evaluate((s) => {
    const el = document.querySelector(s);
    return el && { inputmode: el.getAttribute('inputmode'), autocomplete: el.getAttribute('autocomplete'),
      aria: el.getAttribute('aria-label') };
  }, selector);
  assert.ok(v, selector + ' staat er');
  assert.equal(v.inputmode, 'numeric');
  assert.equal(v.autocomplete, 'one-time-code');
  assert.ok(v.aria && v.aria.length > 3, 'het veld draagt een aria-label');
}
async function nieuweContext() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
  });
  return ctx;
}
/* Het antwoord van stap een van de werkplekinlog (met een wachtwoord, zonder bewijs). */
const isStapEen = (r) => r.url().endsWith('/api/supplier/mijn/login') && !/"bewijs"/.test(r.request().postData() || '');
const isStapTwee = (r) => r.url().endsWith('/api/supplier/mijn/login') && /"bewijs"/.test(r.request().postData() || '');

/* De personeels-app tot aan het codeveld. Geeft het moment waarop stap een antwoordde. */
async function personeelTotCode(page, email, wachtwoord) {
  await page.goto(srv.base + '/apps/personeel.html');
  await page.locator('#liUser').fill(email);
  await page.locator('#liPass').fill(wachtwoord);
  const stap1 = page.waitForResponse(isStapEen);
  await page.locator('#loginForm button[type="submit"]').click();
  const een = await (await stap1).json();
  const moment = Date.now();
  assert.equal(een.tweedeFactorNodig, true, 'de server vraagt de code');
  await wachtOpZichtbaar(page, '#tcCode');
  return moment;
}
/* De leverancier-app: het gesprek met Rahul tot aan het codeformulier. */
async function gesprekTotCode(page, email, wachtwoord) {
  await page.goto(srv.base + '/apps/leverancier.html', { waitUntil: 'domcontentloaded' });
  await page.fill('.rp-rij input', email);
  await page.press('.rp-rij input', 'Enter');
  await page.waitForFunction(() => document.querySelector('.rp-rij input').type === 'password');
  await page.fill('.rp-rij input', wachtwoord);
  const stap1 = page.waitForResponse(isStapEen);
  await page.press('.rp-rij input', 'Enter');
  const een = await (await stap1).json();
  const moment = Date.now();
  assert.equal(een.tweedeFactorNodig, true, 'de server vraagt de code');
  await wachtOpZichtbaar(page, '#liCode');
  return moment;
}

test.before(async () => {
  if (ZONDER_BROWSER) return;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werk2-e2e-'));
  srv = await startServer({ env: { RTG_DATA_DIR: dir, SMTP_URL: '', RTG_AI_UIT: '1' } });
  const lid = await post('/api/auth/login', { login: NORA, password: NORA_WW });
  assert.ok(lid.body.token, 'Nora logt in als lid: ' + kort(lid.body));
  nora = await zetTweedeAan(lid.body.token, NORA_WW);
  managerKikunoi = await managerVan('KIKUNOI');
  managerPonto = await managerVan('PONTO');
  browser = await pw.chromium.launch(browserOpties(pw));
});
test.after(async () => {
  // eerst de browser dicht, dan de server, dan de map
  if (browser) await browser.close();
  if (srv) await stop(srv);
  if (dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }
});

test('1. de werkplekinlog vraagt in beide schermen de code, en de juiste opent de werkplek',
  { skip: ZONDER_BROWSER, timeout: 180000 }, async () => {
  const ctx = await nieuweContext();
  const fouten = [];
  try {
    /* ---- de personeels-app ---- */
    const pda = await ctx.newPage();
    letOpFouten(pda, fouten);
    await personeelTotCode(pda, NORA, NORA_WW);
    await codeveldKlopt(pda, '#tcCode');
    assert.equal(await pda.evaluate(() => localStorage.getItem('rtg_pda_token')), null, 'nog geen werksessie');

    await pda.locator('#tcCode').fill(foutCode(nora.geheim));
    await pda.locator('#codeForm button[type="submit"]').click();
    await wachtTot(pda, () => /klopt niet/i.test(document.querySelector('#tcErr').textContent), null,
      { wat: 'de melding dat de code niet klopt' });
    await pda.locator('#tcCode').fill(nora.code());
    await pda.locator('#codeForm button[type="submit"]').click();
    await wachtTot(pda, () => localStorage.getItem('rtg_pda_token'), null, { wat: 'de werksessie in de personeels-app' });
    await wachtOpZichtbaar(pda, '#gate', { weg: true });

    /* ---- de leverancier-app ---- */
    const lev = await ctx.newPage();
    letOpFouten(lev, fouten);
    await gesprekTotCode(lev, NORA, NORA_WW);
    await codeveldKlopt(lev, '#liCode');
    assert.equal(await lev.evaluate(() => localStorage.getItem('rtg_sup_token')), null, 'nog geen werksessie');
    assert.equal(await lev.evaluate(() => getComputedStyle(document.getElementById('gateGesprek')).display), 'none',
      'het gesprek wacht zolang de code gevraagd wordt');
    // een verkeerde code zegt het en laat het formulier staan
    await lev.locator('#liCode').fill(foutCode(nora.geheim));
    await lev.locator('#codeForm button[type="submit"]').click();
    await wachtTot(lev, () => /klopt niet/i.test(document.querySelector('#codeFout').textContent), null,
      { wat: 'de melding dat de code niet klopt (leverancier)' });
    // terug brengt het gesprek terug, met de reden, en geen "onjuiste inloggegevens"
    await lev.locator('#codeTerug').click();
    await wachtOpZichtbaar(lev, '#gateGesprek');
    await wachtTot(lev, () => /afgebroken/i.test(document.querySelector('.rp-zin').textContent), null,
      { wat: 'Rahul zegt dat de inlog is afgebroken' });
    assert.equal(await lev.evaluate(() => document.getElementById('codeForm').hidden), true);
    // het gesprek staat weer bij het wachtwoord: opnieuw, en nu de juiste code
    await lev.fill('.rp-rij input', NORA_WW);
    await lev.press('.rp-rij input', 'Enter');
    await wachtOpZichtbaar(lev, '#liCode');
    await lev.locator('#liCode').fill(nora.code());
    await lev.locator('#codeForm button[type="submit"]').click();
    await wachtTot(lev, () => localStorage.getItem('rtg_sup_token'), null, { wat: 'de werksessie in de leverancier-app' });

    assert.deepEqual(fouten, [], 'geen fouten in de pagina');
  } finally {
    await ctx.close();
  }
});

test('2. personeels-app: een verlopen bewijs brengt terug naar het wachtwoord, met de reden',
  { skip: ZONDER_BROWSER, timeout: 180000 }, async () => {
  const lid = await werknemer('werkplek-pda@voorbeeld.test');
  const ctx = await nieuweContext();
  const fouten = [];
  try {
    const pda = await ctx.newPage();
    letOpFouten(pda, fouten);
    const moment = await personeelTotCode(pda, lid.email, WW);
    await wachtwoordWeg(lid, moment);
    // de JUISTE code: alleen het bewijs is verlopen, en de server zegt 401
    const twee = pda.waitForResponse(isStapTwee);
    await pda.locator('#tcCode').fill(lid.code());
    await pda.locator('#codeForm button[type="submit"]').click();
    assert.equal((await twee).status(), 401, 'het bewijs van het oude wachtwoord telt niet meer');
    await wachtOpZichtbaar(pda, '#liUser');
    await wachtTot(pda, () => /verlopen/i.test(document.querySelector('#liErr').textContent), null,
      { wat: 'de reden bij het wachtwoordveld' });
    assert.equal(await pda.evaluate(() => document.getElementById('tcCode')), null, 'het codeveld is weg');
    assert.equal(await pda.evaluate(() => localStorage.getItem('rtg_pda_token')), null, 'geen werksessie');
    assert.deepEqual(fouten, [], 'geen fouten in de pagina');
  } finally {
    await ctx.close();
  }
});

test('3. leverancier-app: een verlopen bewijs of een weggehaalde werkplek geeft het gesprek de echte reden terug',
  { skip: ZONDER_BROWSER, timeout: 180000 }, async () => {
  const verlopen = await werknemer('werkplek-verlopen@voorbeeld.test');
  const weg = await werknemer('werkplek-weg@voorbeeld.test');
  const ctx = await nieuweContext();
  const fouten = [];
  try {
    /* ---- 401: het wachtwoord is gewijzigd tussen stap een en twee ---- */
    const lev = await ctx.newPage();
    letOpFouten(lev, fouten);
    const moment = await gesprekTotCode(lev, verlopen.email, WW);
    await wachtwoordWeg(verlopen, moment);
    const twee = lev.waitForResponse(isStapTwee);
    await lev.locator('#liCode').fill(verlopen.code());
    await lev.locator('#codeForm button[type="submit"]').click();
    assert.equal((await twee).status(), 401, 'het bewijs van het oude wachtwoord telt niet meer');
    await wachtOpZichtbaar(lev, '#gateGesprek');
    await wachtTot(lev, () => /verlopen/i.test(document.querySelector('.rp-zin').textContent), null,
      { wat: 'Rahul zegt dat de inlogpoging is verlopen' });
    assert.equal(await lev.evaluate(() => document.getElementById('codeForm').hidden), true, 'het codeformulier is dicht');
    assert.equal(await lev.evaluate(() => localStorage.getItem('rtg_sup_token')), null, 'geen werksessie');

    /* ---- 404: de manager haalt hem van het rooster tussen stap een en twee ---- */
    const lev2 = await ctx.newPage();
    letOpFouten(lev2, fouten);
    await gesprekTotCode(lev2, weg.email, WW);
    const af = await post('/api/supplier/staff/remove', { staffId: weg.staffId }, managerKikunoi.token);
    assert.equal(af.status, 200, 'de manager haalt hem van het rooster: ' + kort(af.body));
    const twee2 = lev2.waitForResponse(isStapTwee);
    await lev2.locator('#liCode').fill(weg.code());
    await lev2.locator('#codeForm button[type="submit"]').click();
    assert.equal((await twee2).status(), 404, 'geen werkplek meer');
    await wachtOpZichtbaar(lev2, '#gateGesprek');
    await wachtTot(lev2, () => /nergens op het rooster/i.test(document.querySelector('.rp-zin').textContent), null,
      { wat: 'Rahul zegt dat hij nergens op het rooster staat' });
    assert.equal(await lev2.evaluate(() => document.getElementById('codeForm').hidden), true, 'het codeformulier is dicht');
    assert.equal(await lev2.evaluate(() => localStorage.getItem('rtg_sup_token')), null, 'geen werksessie');
    assert.deepEqual(fouten, [], 'geen fouten in de pagina');
  } finally {
    await ctx.close();
  }
});

test('4. leverancier-app: de aanmeldweg landt na de code op de zaak waar het lid zich net aanmeldde',
  { skip: ZONDER_BROWSER, timeout: 180000 }, async () => {
  /* Nora staat op het rooster van Sal de Mar (KIKUNOI) en Vora Beach Club
     (VORA), en meldt zich hier aan bij Sunset Ibiza (PONTO). De werkplekken
     staan op code gesorteerd, dus zonder het gevraagde bedrijf in stap twee
     landt zij op KIKUNOI. Ze bevestigt met een herstelcode: die zegt hoeveel er
     over zijn, en dat bericht moet de sectorwissel overleven. */
  const inv = await post('/api/supplier/staff/invite', { name: 'Nora Prins', func: 'Bediening' }, managerPonto.token);
  assert.equal(inv.status, 200, 'uitnodiging bij Sunset Ibiza: ' + kort(inv.body));
  const herstelcode = nora.herstelcodes[0];
  assert.ok(herstelcode, 'Nora heeft herstelcodes');
  const ctx = await nieuweContext();
  const fouten = [];
  try {
    const lev = await ctx.newPage();
    letOpFouten(lev, fouten);
    await lev.goto(srv.base + '/apps/leverancier.html', { waitUntil: 'domcontentloaded' });
    await lev.locator('#enrollToggle').click();
    await lev.locator('#enBedrijf').fill(managerPonto.zaak);
    await lev.locator('#enCode').fill(inv.body.invite.kassacode);
    await lev.locator('#enLogin').fill(NORA);
    await lev.locator('#enPass').fill(NORA_WW);
    const stap1 = lev.waitForResponse(isStapEen);
    await lev.locator('#enrollForm button[type="submit"]').click();
    assert.equal((await (await stap1).json()).tweedeFactorNodig, true, 'na de aanmelding vraagt de inlog de code');
    await wachtOpZichtbaar(lev, '#liCode');
    const twee = lev.waitForResponse(isStapTwee);
    await lev.locator('#liCode').fill(herstelcode);
    await lev.locator('#codeForm button[type="submit"]').click();
    const antwoord = await twee;
    assert.equal(antwoord.status(), 200, 'de herstelcode opent de werkplek');
    assert.match(antwoord.request().postData() || '', /"bedrijf":"PONTO"/, 'het gevraagde bedrijf reist met stap twee mee');
    /* Na de code wisselt de app naar de eigen sector en laadt de pagina
       opnieuw. Het antwoord van stap twee wordt daarom niet gelezen (zijn
       inhoud kan met de oude pagina verdwijnen); de geopende app zegt waar zij
       is, en het bericht staat er dan al. */
    await wachtTot(lev, () => document.querySelector('#app.active') &&
      /herstelcode/i.test((document.getElementById('toast') || {}).textContent || ''), null,
    { wat: 'de geopende app met het bericht over de herstelcodes' });
    const token = await lev.evaluate(() => localStorage.getItem('rtg_sup_token'));
    assert.ok(token, 'de werksessie na de aanmelding');
    const stand = await post('/api/supplier/state', {}, token);
    assert.equal(stand.status, 200, kort(stand.body));
    assert.equal(stand.body.state.supplier.code, 'PONTO', 'zij landt op de zaak waar zij zich net aanmeldde');
    assert.deepEqual(fouten, [], 'geen fouten in de pagina');
  } finally {
    await ctx.close();
  }
});
