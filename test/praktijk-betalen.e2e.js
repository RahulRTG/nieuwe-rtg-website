'use strict';
// Bedieningsproef met API-antwoorden als fixture. De echte HTTP- en
// providerketen staat afzonderlijk in praktijk-transacties-http.test.js.
const test=require('node:test'),assert=require('node:assert/strict');
const {startServer,stopHard,laadPlaywright,browserOpties,geenBrowser}=require('./helper');
const pw=laadPlaywright();
for(const width of [390,1440])test('klant bedient betaalpagina en status op '+width+'px',{skip:geenBrowser(pw)},async()=>{
  let srv,browser;
  try {
    srv=await startServer();browser=await pw.chromium.launch(browserOpties(pw));
    const page=await browser.newPage({viewport:{width,height:900}});
    await page.addInitScript(()=>localStorage.setItem('rtg_cookieinfo_v1','1'));
    let betaald=false,starten=0;
    await page.route('**/api/werk-gast/**',async route=>{
      const pad=new URL(route.request().url()).pathname,b=route.request().postDataJSON();
      assert.equal(b.sleutel,'lokale-browserfixture');
      const betaling={beschikbaar:true,aangezet:true,ontvanger:'RTG Fixture',magStarten:!betaald,
        uitleg:'U bevestigt bij de betaalprovider.',stand:betaald?{status:'BEVESTIGD',label:'Betaling bevestigd'}:null};
      let uit={ok:true,organisatie:'Werkplek',titel:'Afgesproken opdracht',omschrijving:'Dienstverlening',voorstel:'Alle afgesproken werkzaamheden',
        bedragMinor:4200,valuta:'EUR',decimalen:2,stand:'bevestigd',onderdelen:[],versie:4,betaling};
      if(pad.endsWith('/betaling/start')) {
        starten++;assert.equal(b.akkoord,true);assert.equal(b.versie,4);assert.equal(b.bedragMinor,undefined);
        uit={ok:true,betaling:{label:'Wacht op jouw bevestiging'},actie:{soort:'doorsturen',url:'https://checkout.stripe.com/c/pay/fixture'}};
      }
      if(pad.endsWith('/betaling/status')){betaald=true;uit={ok:true};}
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(uit)});
    });
    await page.goto(srv.base+'/apps/werk.html#gast=lokale-browserfixture',{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'Doorgaan naar betalen',exact:true}).click();
    const link=page.getByRole('link',{name:'Open beveiligde betaalpagina',exact:true});await link.waitFor();
    assert.equal(await link.getAttribute('rel'),'noopener noreferrer');assert.equal(await link.getAttribute('target'),'_blank');
    assert.equal(starten,1);assert.equal(await page.getByRole('button',{name:'Doorgaan naar betalen',exact:true}).isDisabled(),true);
    await page.getByRole('button',{name:'Betaalstatus vernieuwen',exact:true}).click();
    await page.getByText('Betaling bevestigd',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Doorgaan naar betalen',exact:true}).count(),0);
    assert.equal(await page.locator('#praktijkGast').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
    await page.goto(srv.base+'/apps/werk.html#betaling-terug',{waitUntil:'domcontentloaded'});
    await page.reload({waitUntil:'domcontentloaded'}); // terugkeer vanaf de externe provider is een volledige navigatie
    await page.getByRole('heading',{name:'Terug van de betaalpagina',exact:true}).waitFor();
    assert.equal(await page.locator('#inlog').isVisible(),false);
  } finally {if(browser)await browser.close();if(srv)await stopHard(srv.child);}
});
