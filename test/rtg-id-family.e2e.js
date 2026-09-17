/* RTG access in a real browser: one shared Edge, four concise registration
   steps, explicit agreement and existing password/WebAuthn/2FA recovery routes.
   All identities and credentials belong to isolated local test fixtures. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser
} = require('./helper');

const pw = laadPlaywright();
const ROOT = path.join(__dirname, '..');
const APPS = path.join(ROOT, 'public', 'apps');
const WERELDEN = new Set(['living', 'travel', 'work', 'foundation']);
const leesPad = (bestand) => fs.readFileSync(bestand, 'utf8');
const lees = (bestand) => leesPad(path.join(ROOT, bestand));

function paginas(map) {
  return fs.readdirSync(map, { withFileTypes: true }).flatMap((item) =>
    item.isDirectory()
      ? paginas(path.join(map, item.name))
      : item.name.endsWith('.html') ? [path.join(map, item.name)] : []);
}

function bodyVan(bron) {
  return (bron.match(/<body\b[^>]*>/i) || [''])[0];
}

function wereldVan(bron) {
  const match = bodyVan(bron).match(/\bdata-rtg-world=["']([^"']+)/i);
  return match && match[1];
}

function omleidingVan(bron) {
  const meta = bron.match(/<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^"']*url=([^"';>]+)/i);
  return meta && meta[1].trim();
}

function basisTag(bron) {
  return (bron.match(/<script\b[^>]*src=["'][^"']*\/shared\/basis(?:\.min)?\.js[^"']*["'][^>]*>/i) || [])[0];
}

test('alle zelfstandige appschermen erven de ene wereldkleurige Edge', () => {
  const alle = paginas(APPS);
  const zelfstandig = [];
  const omleidingen = [];
  const projecties = [];

  for (const bestand of alle) {
    const bron = leesPad(bestand);
    const omleiding = omleidingVan(bron);
    if (omleiding) { omleidingen.push([bestand, omleiding]); continue; }
    if (/\bdata-rtg-projectie\b/i.test(bodyVan(bron))) { projecties.push(bestand); continue; }

    zelfstandig.push(bestand);
    const relatief = path.relative(ROOT, bestand);
    assert.ok(WERELDEN.has(wereldVan(bron)), relatief + ' mist een geldige wereldkleur');
    const tag = basisTag(bron);
    assert.ok(tag, relatief + ' mist de centrale basislaag voor Edge');
    assert.ok(/\bdefer\b/i.test(tag) || bron.indexOf(tag) > bron.search(/<body\b/i),
      relatief + ' start basis.js voordat body en wereldidentiteit bestaan');
    assert.doesNotMatch(bron,
      /\/shared\/rtg-edge-2-(?:loader|context|reveal)\.js|\/shared\/rtg-edge-2\.js|\/shared\/rtg-edge-2\.css/,
      relatief + ' mag geen tweede, plaatselijke Edge-laadketen maken');
  }

  assert.ok(zelfstandig.length > 250,
    'de platformregel moet aantoonbaar de volledige verzameling van 250+ schermen dekken');
  assert.equal(projecties.length, 1, 'alleen het gedeelde televisiescherm is bewust chromeloos');
  assert.equal(path.relative(ROOT, projecties[0]), 'public/apps/spelscherm.html');

  for (const [bestand, doel] of omleidingen) {
    const doelpad = doel.split(/[?#]/)[0];
    assert.ok(doelpad.startsWith('/apps/'), path.relative(ROOT, bestand) + ' leidt niet naar een eigen app');
    const doelbestand = path.join(ROOT, 'public', doelpad.replace(/^\//, ''));
    assert.ok(fs.existsSync(doelbestand), path.relative(ROOT, bestand) + ' leidt naar een ontbrekend scherm');
    const doelbron = leesPad(doelbestand);
    assert.ok(WERELDEN.has(wereldVan(doelbron)), doelpad + ' mist een geldige wereldkleur');
    assert.ok(basisTag(doelbron), doelpad + ' erft de centrale Edge niet');
  }

  assert.equal(zelfstandig.length + omleidingen.length + projecties.length, alle.length);
});

test('de universele laadketen bouwt exact een Edge-casco', () => {
  const basis = lees('public/shared/basis.js');
  const randen = lees('public/shared/randen.js');
  const systeem = lees('public/shared/rtg-edge-system.js');
  const bibliotheek = lees('public/shared/rtg-edge-library.js');

  assert.match(basis, /\['living', 'travel', 'work', 'foundation'\]/);
  assert.match(basis, /s\.src = '\/shared\/randen\.js'/);
  assert.match(randen, /function startPlatformEdge\(\)/);
  assert.match(randen, /d\.body\.dataset\.rtgWorld/);
  assert.match(randen, /w\.RTGEdge\.start\(\{ world: wereld/);
  assert.equal((systeem.match(/className = 'rtg-edge-chrome'/g) || []).length, 1);
  assert.equal((systeem.match(/\/shared\/rtg-edge-2-loader\.js/g) || []).length, 1);
  for (const deel of ['rtg-edge-top', 'rtg-edge-side', 'rtg-edge-bottom']) {
    assert.equal((bibliotheek.match(new RegExp('class="' + deel + '"', 'g')) || []).length, 1, deel);
  }
});

test('het inlogportaal en de aanmelding werken met de bestaande beveiligde routes',
  { skip: geenBrowser(pw), timeout: 240000 }, async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-access-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dataDir } });
  const base = srv.base.replace('127.0.0.1','localhost');
  const browser = await pw.chromium.launch(browserOpties(pw));
  const secret = 'Synthetisch portal wachtwoord 26';
  const email = 'portal@voorbeeld.test';
  async function api(pad, data, token) {
    const response = await fetch(base+pad,{method:'POST',headers:{'Content-Type':'application/json',
      ...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});
    const body=await response.json(); assert.ok(response.ok, pad+': '+JSON.stringify(body)); return body;
  }
  async function context(viewport={width:390,height:844}) {
    const c=await browser.newContext({viewport,reducedMotion:'reduce'});
    await c.addInitScript(()=>{localStorage.setItem('rtg_lang','nl');localStorage.setItem('rtg_cookieinfo_v1','1');});
    return c;
  }
  async function open(c, route='/apps/app.html?pas=rtg'){
    const page=await c.newPage(); page.setDefaultTimeout(20000);
    await page.goto(base+route,{waitUntil:'domcontentloaded'});
    await page.waitForSelector('#agPasskey');
    await page.waitForSelector('body[data-rtg-adaptive-ready="true"]');
    return page;
  }
  async function enter(page,value){await page.locator('#agIn').fill(value);await page.locator('#agGo').click();}
  async function ready(page){await page.waitForFunction(()=>!document.getElementById('agGo').disabled);}
  let accountToken;
  try {
    await t.test('mobiel en desktop tonen de nieuwe compositie met precies één standaard Edge',async()=>{
      for(const viewport of [{width:320,height:680},{width:390,height:844},{width:1440,height:900}]){
        const c=await context(viewport),p=await open(c);
        const errors=[];letOpFouten(p,errors);
        const geometry=await p.evaluate(()=>{
          const g=document.getElementById('gate'),bar=document.querySelector('.rtg-adaptive-bar');
          const b=bar.getBoundingClientRect(),pass=document.getElementById('agPasskey').getBoundingClientRect();
          return {bars:document.querySelectorAll('.rtg-adaptive-bar').length,
            overflow:document.documentElement.scrollWidth>innerWidth,
            edgeInside:b.left>=0&&b.right<=innerWidth&&b.bottom<=innerHeight,
            passHeight:pass.height,clocks:g.querySelectorAll('[data-rtg-klok]').length,
            color:getComputedStyle(g).backgroundColor};
        });
        assert.equal(geometry.bars,1);assert.equal(geometry.overflow,false);
        assert.equal(geometry.edgeInside,true);assert.ok(geometry.passHeight>=48);assert.equal(geometry.clocks,0);
        assert.equal(geometry.color,'rgb(57, 9, 25)');
        await p.locator('#agNieuw').click();
        assert.match(await p.locator('#agZin').innerText(),/Vul uw volledige naam in\./);
        assert.equal(await p.locator('#agStappen').innerText(),'STAP 1 VAN 4');
        await p.keyboard.press('Tab');assert.notEqual(await p.evaluate(()=>document.activeElement.tagName),'BODY');
        assert.deepEqual(errors,[]);await c.close();
      }
    });
    await t.test('vier vragen, corrigeren, foutafhandeling, gratis account en bewust akkoord',async()=>{
      const c=await context(),p=await open(c),calls=[];
      p.on('request',r=>{if(r.method()==='POST')calls.push({path:new URL(r.url()).pathname,body:r.postData()});});
      await p.locator('#agNieuw').click();await enter(p,'Portal Proefpersoon');
      await enter(p,'geen-mailadres');
      assert.equal(await p.locator('#agIn').getAttribute('aria-invalid'),'true');
      await enter(p,email);await enter(p,'1992-03-14');
      await p.locator('#agSummary summary').click();
      await p.locator('#agReview button').first().click();
      assert.equal(await p.locator('#agIn').inputValue(),'Portal Proefpersoon');
      await enter(p,'Portal Testpersoon');assert.equal(await p.locator('#agIn').inputValue(),email);
      await p.locator('#agGo').click();await p.locator('#agGo').click();
      let failOnce=true;
      await p.route('**/api/auth/register',async route=>{
        if(failOnce){failOnce=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Aanmelden is tijdelijk niet mogelijk. Probeer het opnieuw.'})});}
        else await route.continue();
      });
      await enter(p,secret);
      await p.waitForFunction(()=>document.getElementById('agError').textContent.includes('tijdelijk'));
      assert.equal(await p.locator('#agIn').inputValue(),secret);
      assert.equal(await p.locator('#gate').isVisible(),true);
      await ready(p);await p.locator('#agGo').click();
      await p.waitForSelector('#onbGate:not([hidden])');
      await p.waitForSelector('#onbConsent');
      assert.equal(await p.locator('#onbConsent').isChecked(),false);
      await p.locator('#onbActies button').click();
      assert.equal(await p.locator('#onbLees').isVisible(),true);
      assert.ok((await p.locator('#onbLees').innerText()).length>100);
      await p.locator('#onbActies button').click();
      await p.locator('#onbIn').fill('Portal Testpersoon');
      await p.locator('#onbGo').click();
      assert.match(await p.locator('#onbFout').innerText(),/Bevestig dat u/);
      assert.equal(calls.filter(r=>r.path==='/api/onboarding/teken').length,0);
      await p.locator('#onbConsent').check();await p.locator('#onbGo').click();
      await p.waitForSelector('#onbGate',{state:'hidden'});
      accountToken=await p.evaluate(()=>localStorage.getItem('rtg_member_token'));
      assert.ok(accountToken);
      const state=await api('/api/state',{},accountToken);
      assert.equal(state.state.user.tier,'guest','account creation cannot silently buy a paid pass');
      assert.equal((state.state.invoices || []).length,0,'no contribution invoice for the free account');
      assert.equal((await api('/api/onboarding/status',{},accountToken)).klaar,true);
      assert.equal(calls.filter(r=>r.path==='/api/auth/register').length,2,'one failure, one explicit retry');
      assert.ok(calls.every(r=>!r.path.startsWith('/api/aanmeld/')),'credentials do not travel through a conversation');
      assert.ok(calls.filter(r=>r.body&&r.body.includes(secret)).every(r=>r.path==='/api/auth/register'));
      const stored=await p.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}));
      assert.ok(!stored.includes(secret)&&!stored.includes(email),'draft identity and password are not stored');
      await c.close();
    });
    await t.test('wachtwoordfouten openen geen sessie; geldige inlog en herladen herstellen de echte sessie',async()=>{
      const c=await context(),p=await open(c);
      await p.locator('#agAnders').click();await enter(p,email);await enter(p,'Onjuist wachtwoord');
      await p.waitForFunction(()=>!!document.getElementById('agError').textContent);
      assert.equal(await p.locator('#gate').isVisible(),true);await ready(p);
      await enter(p,secret);await p.waitForSelector('#gate',{state:'hidden'});
      await p.reload();await p.waitForSelector('#gate',{state:'hidden'});await c.close();
    });
    await t.test('leeftijdsgrens geeft een concrete gratis Foundation-route zonder account aan te maken',async()=>{
      const c=await context(),p=await open(c);
      await p.locator('#agNieuw').click();await enter(p,'Jonge Testpersoon');await enter(p,'jong@voorbeeld.test');
      const now=new Date(),birth=(now.getFullYear()-10)+'-01-01';
      await enter(p,birth);
      assert.match(await p.locator('#agError').innerText(),/vanaf 15 jaar/);
      assert.match(await p.locator('#agFoundation').innerText(),/altijd 100% gratis/);
      assert.equal(await p.locator('#agFoundation').getAttribute('href'),'/apps/foundation/os-publiek.html');
      await c.close();
    });
    await t.test('herstel zonder telefoon vraagt geen verplichte code en de link is eenmalig',async()=>{
      const recovery=await api('/api/auth/forgot',{email});
      assert.ok(recovery.devResetUrl);assert.equal(recovery.devCode,null);
      const route=new URL(recovery.devResetUrl);
      const c=await context(),p=await c.newPage();
      await p.goto(base+route.pathname+route.search,{waitUntil:'domcontentloaded'});
      await p.waitForSelector('#agIn');
      assert.equal(await p.locator('#agCode').getAttribute('required'),null);
      await enter(p,'Vernieuwd portal wachtwoord 26');
      await p.waitForFunction(()=>document.getElementById('gate').dataset.accessView==='login');
      assert.ok(!new URL(p.url()).searchParams.has('reset'));
      assert.match(await p.locator('#agStatus').innerText(),/wachtwoord is gewijzigd/);
      await c.close();
      await api('/api/auth/login',{login:email,password:'Vernieuwd portal wachtwoord 26'});
    });
    await t.test('een echte WebAuthn-handtekening opent de juiste sessie vanuit de browser',async()=>{
      const member=await api('/api/auth/register',{name:'Passkey Testpersoon',email:'passkey@voorbeeld.test',password:secret,geboortedatum:'1992-03-14',tier:'guest'});
      const {maakAuthenticator}=require('./webauthn-authenticator');
      const auth=maakAuthenticator('localhost');
      const options=await api('/api/webauthn/registreer/opties',{},member.token);
      await api('/api/webauthn/registreer',{naam:'Virtuele browsertest',antwoord:auth.registratieAntwoord(options.opties.challenge,base)},member.token);
      const c=await context(),p=await open(c);
      const cdp=await c.newCDPSession(p);await cdp.send('WebAuthn.enable');
      const {authenticatorId}=await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
      await cdp.send('WebAuthn.addCredential',{authenticatorId,credential:{
        credentialId:auth.credId.toString('base64'),isResidentCredential:true,rpId:'localhost',
        privateKey:auth.privateKey.export({format:'der',type:'pkcs8'}).toString('base64'),
        userHandle:Buffer.from(options.opties.user.id,'base64url').toString('base64'),signCount:0}});
      const response=p.waitForResponse(r=>new URL(r.url()).pathname==='/api/webauthn/login');
      await p.locator('#agPasskey').click();assert.equal((await response).status(),200);
      await p.waitForSelector('#gate',{state:'hidden'});
      const token=await p.evaluate(()=>localStorage.getItem('rtg_member_token'));
      assert.ok(token);assert.equal((await api('/api/state',{},token)).state.user.tier,'guest');
      await c.close();
    });
    await t.test('een tweede factor vraagt om bewijs voordat er een sessie ontstaat',async()=>{
      const member=await api('/api/auth/register',{name:'Tweefactor Testpersoon',email:'factor@voorbeeld.test',password:secret,geboortedatum:'1992-03-14',tier:'rtg'});
      const options=await api('/api/mijn/tweefactor/begin',{huidig:secret},member.token);
      const {totpCode}=require('../server/kern/totp');
      const confirm=await api('/api/mijn/tweefactor/bevestig',{code:totpCode(options.geheim)},member.token);
      const c=await context(),p=await open(c);
      await p.locator('#agAnders').click();await enter(p,'factor@voorbeeld.test');await enter(p,secret);
      await p.waitForFunction(()=>document.getElementById('gate').dataset.accessView==='second');
      assert.equal(await p.evaluate(()=>localStorage.getItem('rtg_member_token')),null);
      await ready(p);await enter(p,'ongeldige-code');
      await p.waitForFunction(()=>!!document.getElementById('agError').textContent);
      assert.equal(await p.evaluate(()=>localStorage.getItem('rtg_member_token')),null);
      await ready(p);await enter(p,confirm.herstelcodes[0]);
      await p.waitForSelector('#gate',{state:'hidden'});await c.close();
    });
    await t.test('een passkey kan worden geannuleerd zonder de alternatieve route te blokkeren',async()=>{
      const c=await context();
      await c.addInitScript(()=>{
        Object.defineProperty(navigator,'credentials',{value:{get:async()=>{throw new DOMException('Cancelled','NotAllowedError');}}});
      });
      const p=await open(c);await p.locator('#agPasskey').click();
      await p.waitForFunction(()=>!!document.getElementById('agError').textContent);
      await p.locator('#agAnders').click();
      assert.equal(await p.locator('#agIn').isVisible(),true);
      assert.equal(await p.locator('#agGo').isDisabled(),false);await c.close();
    });
  } finally {await browser.close();await stop(srv.child);fs.rmSync(dataDir,{recursive:true,force:true});}
});
