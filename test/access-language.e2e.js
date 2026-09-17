'use strict';
/* Real access screens and authentication; only the translation-provider response
   is controlled here. Locale selection is not a claim of linguistic coverage. */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {startServer,stop,laadPlaywright,browserOpties,geenBrowser,letOpFouten}=require('./helper');
const {TALEN}=require('../server/talen');
const pw=laadPlaywright();

test('alle toegangsschermen bewegen mee zonder invoer, voortgang of akkoord te verliezen',
  {skip:geenBrowser(pw),timeout:180000},async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rtg-access-language-'));
  const srv=await startServer({env:{SMTP_URL:'',RTG_DATA_DIR:dir,RTG_OWNER_EMAIL:'language-owner@example.test'}});
  const browser=await pw.chromium.launch(browserOpties(pw));
  const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const translateBodies=[],capabilities=[];
  await ctx.addInitScript(()=>{localStorage.setItem('rtg_lang','nl');localStorage.setItem('rtg_cookieinfo_v1','1');});
  await ctx.route('**/api/vertaal/ui',async route=>{
    const body=route.request().postDataJSON();translateBodies.push(body);
    await route.fulfill({json:{naar:body.naar,teksten:body.teksten}});
  });
  const page=await ctx.newPage(),errors=[];
  letOpFouten(page,errors);
  const change=async code=>{await page.evaluate(code=>RTGi18n.set(code),code);};
  const enter=async value=>{await page.locator('#agIn').fill(value);await page.locator('#agGo').click();};
  try {
    await page.goto(srv.base+'/apps/app.html?pas=rtg');
    await page.waitForSelector('#agNieuw');
    await t.test('alle 114 keuzes bestaan zonder afhankelijkheid van de talen-API',async()=>{
      const offline=await browser.newContext();
      await offline.route('**/api/talen',route=>route.abort());
      await offline.route('**/api/vertaal/ui',route=>route.abort());
      const p=await offline.newPage();await p.goto(srv.base+'/apps/app.html');
      const codes=await p.evaluate(()=>{RTGi18n.openModal();return RTGi18n._lijst.map(t=>t.code);});
      assert.deepEqual(codes,TALEN.map(t=>t.code));await offline.close();
    });
    await t.test('welkom, alle vier vragen en foutmeldingen volgen Nederlands en Engels',async()=>{
      // The actual Edge route must remain usable when the portal hides the top bar.
      await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="menu"]').click();
      await page.locator('[data-edge-face="all"]').click();
      await page.locator('[data-edge-smart-language]').click();
      await page.locator('#rtg-lang-zoek').fill('English');
      await page.locator('#rtg-lang-hint[data-lang="en"]').click();
      assert.equal(await page.locator('#rtg-lang-modal').isVisible(),false);
      assert.equal(await page.locator('.rtg-edge-index').getAttribute('aria-hidden'),'true');
      assert.match(await page.locator('#agTitle').innerText(),/Welcome/);
      assert.equal(await page.locator('#agNieuw').innerText(),'Create your RTG');
      await page.waitForFunction(()=>!!window.RTGNet);
      await page.evaluate(()=>RTGNet.satelliet.zetStand('aan'));
      assert.equal(await page.locator('#rtg-sat-tekst').innerText(),'Slow connection: data-saving mode is on');
      const notification=await page.locator('#rtg-sat-balkje').boundingBox();
      const edge=await page.locator('.rtg-adaptive-bar').boundingBox();
      assert.ok(notification.y+notification.height<=edge.y,'connection notice must leave Edge controls accessible');
      await page.evaluate(()=>RTGNet.satelliet.zetStand('uit'));
      await page.waitForFunction(()=>document.querySelector('.rtg-adaptive-bar [data-rtg-adaptive-action="worlds"] small')?.textContent==='Worlds');
      assert.equal(await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="context"]').getAttribute('aria-label'),'Actions for this screen');
      await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="menu"]').click();
      await page.waitForFunction(()=>document.querySelector('.rtg-edge-preferences-open')?.textContent==='Controls and display');
      assert.match(await page.locator('.rtg-edge-find input').getAttribute('placeholder'),/^Search \d+ features$/);
      await page.waitForFunction(()=>document.querySelector('.rtg-edge-face-tabs [data-edge-face="here"]')?.textContent==='Here');
      await page.waitForFunction(()=>document.querySelector('.rtg-edge-face-here')?.textContent.includes('Recently visited'));
      assert.match(await page.locator('.rtg-edge-face-here').innerText(),/Recently visited/);
      await page.locator('.rtg-edge-face-tabs [data-edge-face="all"]').click();
      await page.locator('[data-edge-smart-search]').click();
      await page.locator('.rtg-edge-find input').fill('Calendar');
      const visible=page.locator('.rtg-edge-group:not([hidden]) a:not([hidden])');
      // On LivingOS, use a known local entry; matching follows visible translated text.
      await page.locator('.rtg-edge-find input').fill('Overview');
      assert.equal(await visible.count(),1);
      await change('nl');
      assert.equal(await page.locator('.rtg-edge-find input').inputValue(),'Overview');
      assert.equal(await page.locator('.rtg-edge-index').getAttribute('aria-hidden'),'false');
      await page.keyboard.press('Escape');
      await change('nl');
      await page.waitForFunction(()=>document.querySelector('.rtg-adaptive-bar [data-rtg-adaptive-action="worlds"] small')?.textContent==='Werelden');
      await page.locator('#agNieuw').click();
      await page.locator('#agIn').fill('Léa Taalproef');
      await change('en');assert.equal(await page.locator('#agIn').inputValue(),'Léa Taalproef');
      assert.equal(await page.locator('#agTitle').innerText(),'What is your name?');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'agIn');
      await page.locator('#agGo').click();await enter('ongeldig');
      assert.match(await page.locator('#agError').innerText(),/Please check/);
      await change('nl');assert.match(await page.locator('#agError').innerText(),/Controleer/);
      await enter('taalproef@voorbeeld.test');await enter('1992-03-14');
      await change('en');assert.match(await page.locator('#agTitle').innerText(),/secure your account/);
      await page.locator('#agIn').fill('Synthetisch testwachtwoord 2026');
      await page.locator('#agShowPassword').click();
      await change('nl');assert.equal(await page.locator('#agIn').getAttribute('type'),'text');
      assert.equal(await page.locator('#agIn').inputValue(),'Synthetisch testwachtwoord 2026');
    });
    await t.test('alle 114 taalcodes behouden de stap en RTL heeft ruimte op mobiel',async()=>{
      for(const language of TALEN){
        const input=language.naam+' / Élodie 李明 سارة';
        await page.locator('#agIn').fill(input);
        await change(language.code);
        await page.waitForFunction(code=>document.querySelector('.rtg-adaptive-bar [data-rtg-adaptive-action="worlds"] small')?.textContent===(code==='nl'?'Werelden':'Worlds'),language.code);
        const measured=await page.evaluate(code=>{
          const input=document.getElementById('agIn'),title=document.getElementById('agTitle');
          const number=new Intl.NumberFormat(code),date=new Intl.DateTimeFormat(code,{timeZone:'UTC'});
          return {code,lang:document.documentElement.lang,dir:getComputedStyle(document.documentElement).direction,
            input:input.value,focus:document.activeElement.id,view:document.getElementById('gate').dataset.accessView,
            edge:document.querySelector('.rtg-adaptive-bar [data-rtg-adaptive-action="worlds"] small').textContent,
            title:title.textContent,overflow:document.documentElement.scrollWidth>innerWidth,
            formatting:{number:number.format(12345.67),numberLocale:number.resolvedOptions().locale,
              date:date.format(new Date('2026-09-17T00:00:00Z')),dateLocale:date.resolvedOptions().locale},
            fontFamily:getComputedStyle(title).fontFamily};
        },language.code);
        capabilities.push(measured);
        assert.equal(measured.input,input);
        assert.equal(measured.focus,'agIn');
        assert.ok(measured.title.trim());assert.equal(measured.overflow,false);
        assert.equal(measured.dir,['ar','dv','fa','he','ps','sd','ug','ur','yi'].includes(language.code)?'rtl':'ltr');

        assert.equal(await page.getAttribute('html','lang'),language.code);
        assert.equal(await page.locator('#gate').getAttribute('data-access-view'),'register');
      }
      await page.locator('#agIn').fill('Synthetisch testwachtwoord 2026');
      // A curated fixture verifies Arabic layout; the live provider is tested separately.
      await page.evaluate(()=>{I18N.ar=Object.assign({},I18N.ar,{
        'access.portal.how_would_you_like_to_secure_your_account':'كيف تريد تأمين حسابك؟',
        'access.portal.create_my_account':'أنشئ حسابي'
      });});
      await change('ar');assert.equal(await page.getAttribute('html','dir'),'rtl');
      assert.match(await page.locator('#agTitle').innerText(),/كيف/);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.locator('#agSummary summary').click();
      assert.ok((await page.locator('#agReview').innerText()).includes('taalproef@voorbeeld.test'));
      await change('en');
      const bodies=JSON.stringify(translateBodies);
      for(const privateValue of ['taalproef@voorbeeld.test','Léa Taalproef','Synthetisch testwachtwoord 2026','1992-03-14'])
        assert.ok(!bodies.includes(privateValue),'translation requests must not include '+privateValue);
    });
    await t.test('overeenkomst en akkoord behouden hun toestand bij een taalwissel',async()=>{
      await page.locator('#agGo').click();await page.waitForSelector('#onbConsentLabel:not([hidden])');
      await page.locator('#onbIn').fill('Léa Taalproef Gewijzigd');
      await page.locator('#onbActies button').click();await page.locator('#onbConsent').check();
      await page.locator('#onbIn').focus();
      await page.evaluate(()=>document.getElementById('onbIn').setSelectionRange(4,12));
      await change('nl');
      assert.deepEqual(await page.evaluate(()=>{const i=document.getElementById('onbIn');return [i.selectionStart,i.selectionEnd];}),[4,12]);
      assert.equal(await page.locator('#onbIn').inputValue(),'Léa Taalproef Gewijzigd');
      assert.equal(await page.locator('#onbConsent').isChecked(),true);
      assert.equal(await page.locator('#onbLees').isVisible(),true);
      assert.equal(await page.locator('#onbGo').innerText(),'Bevestig en open mijn RTG');
      await change('ar');
      assert.equal(await page.locator('#onbGo').isDisabled(),true);
      assert.equal(await page.locator('#onbLanguageNotice').isVisible(),true);
      assert.equal(await page.locator('#onbConsent').isChecked(),true);
      await change('en');assert.equal(await page.locator('#onbGo').innerText(),'Confirm and open my RTG');
      assert.equal(await page.locator('#onbConsent').isChecked(),true);
      const owner=await (await fetch(srv.base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({login:'language-owner@example.test',password:'Imran',pasApp:'business'})})).json();
      assert.ok(owner.token);
      const changed=await fetch(srv.base+'/api/onboarding/config/ai',{method:'POST',
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+owner.token},
        body:JSON.stringify({opdracht:'Zet in het contract dat reizen op eigen risico is.'})});
      assert.equal(changed.status,200);
      const rejected=page.waitForResponse(r=>r.url().endsWith('/api/onboarding/teken') && r.status()===409);
      await page.locator('#onbGo').click();await rejected;
      await page.waitForFunction(()=>document.getElementById('onbFout').textContent.includes('agreement has changed'));
      assert.equal(await page.locator('#onbConsent').isChecked(),false);
      assert.equal(await page.locator('#onbIn').inputValue(),'Léa Taalproef Gewijzigd');
      assert.match(await page.locator('#onbLees').innerText(),/eigen risico/);
      await page.locator('#onbConsent').check();
      await page.locator('#onbGo').click();await page.waitForSelector('#onbGate',{state:'hidden'});
    });
    await t.test('herstel en wachtwoord hebben dezelfde taalroute',async()=>{
      // Second-factor behaviour is covered by rtg-id-family; copy switches through login/recovery here.
      await ctx.clearCookies();await page.evaluate(()=>localStorage.removeItem('rtg_member_token'));
      await page.goto(srv.base+'/apps/app.html?pas=rtg');await page.waitForSelector('#agAnders');
      await page.locator('#agAnders').click();await enter('taalproef@voorbeeld.test');
      await page.locator('#agIn').fill('een bewaard wachtwoord');await change('nl');
      assert.match(await page.locator('#agTitle').innerText(),/Open uw RTG/);
      assert.equal(await page.locator('#agIn').inputValue(),'een bewaard wachtwoord');
      await page.locator('#agForgot').click();await change('en');
      assert.match(await page.locator('#agTitle').innerText(),/Let us help/);
      assert.equal(await page.locator('#agIn').inputValue(),'taalproef@voorbeeld.test');
      await page.locator('#agGo').click();await page.waitForFunction(()=>document.getElementById('gate').dataset.accessView==='sent');
      await change('nl');assert.match(await page.locator('#agTitle').innerText(),/Controleer uw e-mail/);
    });
    assert.deepEqual(errors,[]);
    if(process.env.RTG_LANGUAGE_PROOF_OUTPUT){
      fs.writeFileSync(path.join(process.env.RTG_LANGUAGE_PROOF_OUTPUT,'browser.json'),JSON.stringify({
        browser:browser.version(),viewport:{width:390,height:844},capabilities,
        allScreensNlEn:true,privateInputExcluded:true,criticalFallbackVisible:true,unsupportedLegalBlocked:true,
        provider:'Controlled echo/abort responses; no translation quality claimed',errors
      },null,2));
    }
  }finally{await browser.close();await stop(srv);fs.rmSync(dir,{recursive:true,force:true});}
});
