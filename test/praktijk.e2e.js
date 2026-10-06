'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), os=require('node:os'), path=require('node:path');
const {startServer,stopHard,laadPlaywright,browserOpties,geenBrowser,letOpFouten}=require('./helper');
const pw=laadPlaywright();
for (const breedte of [390,1440]) test('dagelijks werk vanaf nul en gastakkoord op '+breedte+'px',{skip:geenBrowser(pw)},async()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rtg-praktijk-browser-'));let srv,browser;
  try {
    srv=await startServer({env:{RTG_DATA_DIR:tmp,SMTP_URL:''}});browser=await pw.chromium.launch(browserOpties(pw));
    const ctx=await browser.newContext({viewport:{width:breedte,height:900}}),page=await ctx.newPage(),fouten=[];letOpFouten(page,fouten);
    await page.addInitScript(()=>localStorage.setItem('rtg_cookieinfo_v1','1'));
    await page.goto(srv.base+'/apps/werk.html',{waitUntil:'domcontentloaded'});
    await page.getByText('Begin zonder bestaande software',{exact:true}).click();
    await page.getByLabel('Naam van uw organisatie').fill('Buurthulp en workshops');
    await page.getByRole('button',{name:'Eigen werkruimte maken',exact:true}).click();
    const paneel=page.locator('#praktijk');
    page.setDefaultTimeout(12000);
    /* Na een bewaarknop bouwt praktijk.js het paneel opnieuw op (innerHTML), en
       dan staan alle onderdelen weer dicht. Een klik op een summary voordat dat
       gebeurd is, opent het OUDE onderdeel en verdwijnt bij de herbouw: op een
       trage runner viel de toets daardoor elke keer op een andere stap om. Dus
       wacht hij tot het formulier van de knop echt is vervangen. */
    const bewaar=async knop=>{const oud=await knop.elementHandle();await knop.click();
      await page.waitForFunction(el=>!el.isConnected,oud);};
    await paneel.getByLabel('Hoe werkt u?').selectOption('stichting');
    await bewaar(paneel.getByRole('button',{name:'Werkplek bewaren',exact:true}));
    await paneel.getByText('Aanbod toevoegen · 0 onderdelen',{exact:true}).click();
    await paneel.getByLabel('Wat biedt u aan?').fill('Samen koken');
    await paneel.getByLabel('Soort',{exact:true}).selectOption('activiteit');
    await paneel.getByLabel('Omschrijving',{exact:true}).fill('Een gezellige kookmiddag');
    await paneel.getByLabel('Prijs',{exact:true}).selectOption('kosteloos');
    await paneel.getByLabel('Locatie, vestiging of online').fill('Buurthuis Haarlem');
    await bewaar(paneel.getByRole('button',{name:'Aanbod bewaren',exact:true}));
    await paneel.getByText('Klantvraag of hulpvraag toevoegen',{exact:true}).click();
    await paneel.getByLabel('Klant of contactpersoon (een herkenbare naam is genoeg)').fill('Mijn buur');
    await paneel.getByLabel('Wat wil deze persoon?').fill('Met drie mensen komen koken');
    await bewaar(paneel.getByRole('button',{name:'Vraag bewaren',exact:true}));
    await paneel.getByText('Aanbod toevoegen · 1 onderdelen',{exact:true}).click();
    await paneel.getByLabel('Wat biedt u aan?').fill('Volgende activiteit als concept');
    await paneel.locator('[data-pr-werk] > summary').click();
    await paneel.getByLabel('Wat spreekt u af?').fill('Gratis kookmiddag, materialen inbegrepen');
    await bewaar(paneel.getByRole('button',{name:'Voorstel maken',exact:true}));
    assert.equal(await paneel.getByLabel('Wat biedt u aan?').inputValue(),'Volgende activiteit als concept','ander formulier blijft bewaard');
    await paneel.getByLabel('Wat biedt u aan?').fill('');
    page.on('dialog', d=>d.accept());
    await paneel.locator('[data-pr-werk] > summary').click();
    await paneel.getByRole('button',{name:'Klantlink maken',exact:true}).click();
    const link=await paneel.locator('.pr-link').getAttribute('href');assert.ok(link.includes('#gast='));
    const gast=await browser.newPage({viewport:{width:breedte,height:900}});letOpFouten(gast,fouten);
    await gast.goto(srv.base+link,{waitUntil:'domcontentloaded'});
    await gast.getByRole('button',{name:'Akkoord met dit voorstel',exact:true}).click();
    await gast.locator('#praktijkGast').getByText('bevestigd',{exact:true}).waitFor();
    assert.equal(await gast.locator('#praktijkGast').getByText('Mijn buur',{exact:true}).count(),0);
    await page.reload({waitUntil:'domcontentloaded'});
    await paneel.locator('[data-pr-werk] > summary').click();
    await paneel.getByLabel('Uitvoerdatum',{exact:true}).fill('2026-12-01');
    await paneel.getByLabel('Wie voert het uit?').fill('Sam');
    await bewaar(paneel.getByRole('button',{name:'Werk plannen',exact:true}));
    await paneel.locator('[data-pr-werk] > summary').click();
    await paneel.getByText('Externe afspraken en onderdelen · 0',{exact:true}).click();
    await paneel.getByLabel('Wat wordt geregeld?',{exact:true}).fill('Keukenruimte huren');
    await paneel.getByLabel('Uitvoerende partij',{exact:true}).fill('Buurthuis');
    await paneel.getByLabel('Externe stand',{exact:true}).selectOption('uitgevoerd');
    await paneel.getByLabel('Bevestiging of bewijsreferentie',{exact:true}).fill('Ontvangstbewijs BH-01');
    await bewaar(paneel.getByRole('button',{name:'Extern onderdeel bewaren',exact:true}));
    // De POST herlaadt het paneel. Open pas de nieuwe details nadat het
    // opgeslagen onderdeel terugkomt; de oude summary kan nog even bestaan.
    await paneel.getByText('Externe afspraken en onderdelen · 1',{exact:true}).waitFor({state:'attached'});
    await paneel.locator('b').filter({hasText:/^Keukenruimte huren$/}).waitFor({state:'attached'});
    assert.match(await paneel.textContent(),/Ontvangstbewijs BH-01/);
    await paneel.locator('[data-pr-werk] > summary').click();
    await paneel.getByLabel('Wat is daadwerkelijk uitgevoerd?').fill('Samen gekookt en opgeruimd');
    await bewaar(paneel.getByRole('button',{name:'Uitvoering vastleggen',exact:true}));
    await paneel.locator('[data-pr-werk] > summary').click();
    await paneel.getByLabel('Verwijzing naar uw administratie of uitleg').fill('Kosteloze vrijwilligersactiviteit');
    await bewaar(paneel.getByRole('button',{name:'Administratief afronden',exact:true}));
    await paneel.getByText('Mijn buur · afgerond · 2026-12-01',{exact:true}).waitFor();
    await paneel.locator('[data-pr-werk] > summary').click();
    await paneel.getByRole('button',{name:'Klantlinks intrekken',exact:true}).click();
    await paneel.getByText('Alle klantlinks voor deze afspraak zijn ingetrokken.',{exact:true}).waitFor();
    await gast.reload({waitUntil:'domcontentloaded'});
    await gast.getByText('Deze link is verlopen, ingetrokken of niet geldig.',{exact:true}).waitFor();
    const code=await page.evaluate(()=>window.RTGWerk.sessie().werkruimte);
    const collega=await browser.newPage({viewport:{width:breedte,height:900}});
    await collega.goto(srv.base+'/apps/werk.html',{waitUntil:'domcontentloaded'});
    await collega.getByText('Aansluiten bij uw organisatie',{exact:true}).click();
    await collega.getByLabel('Werkruimtecode van uw organisatie',{exact:true}).fill(code);
    await collega.getByLabel('Uw naam',{exact:true}).fill('Collega Noor');
    await collega.getByRole('button',{name:'Toegang aanvragen',exact:true}).click();
    await collega.getByRole('button',{name:'Controleer mijn toegang',exact:true}).click();
    assert.equal(await collega.locator('#inhoud').isVisible(),false,'wachten geeft nog geen toegang');
    await paneel.getByText('Team en tijdelijke rechten',{exact:true}).click();
    await paneel.getByRole('button',{name:'Team laden',exact:true}).click();
    await paneel.getByText('Collega Noor · wacht',{exact:true}).click();
    await paneel.getByRole('button',{name:'Persoon toelaten',exact:true}).click();
    await paneel.getByText('Collega Noor · actief',{exact:true}).click();
    await paneel.getByLabel('Projectleiding',{exact:true}).check();
    await paneel.getByLabel('Verkoop',{exact:true}).check();
    await paneel.getByRole('button',{name:'Rechten vervangen',exact:true}).click();
    await collega.getByRole('button',{name:'Controleer mijn toegang',exact:true}).click();
    await collega.locator('#praktijk').getByText('Uw dagelijkse werk',{exact:true}).waitFor();
    await collega.close();
    assert.equal(await paneel.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'werktafel past mobiel');
    fs.mkdirSync('artifacts/praktijk',{recursive:true});
    await page.screenshot({path:'artifacts/praktijk/werk-'+breedte+'.png',fullPage:false});
    assert.deepEqual(fouten,[]);
  } catch(err) {
    if(browser) { const p=browser.contexts()[0]?.pages()[0];if(p){fs.mkdirSync('artifacts/praktijk',{recursive:true});fs.writeFileSync('artifacts/praktijk/fout-'+breedte+'.html',await p.content());await p.screenshot({path:'artifacts/praktijk/fout-'+breedte+'.png',fullPage:true});}}
    throw err;
  } finally {if(browser)await browser.close();if(srv)await stopHard(srv.child);fs.rmSync(tmp,{recursive:true,force:true});}
});
