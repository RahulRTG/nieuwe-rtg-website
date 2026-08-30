#!/usr/bin/env node
/* ============================================================================
   HOEVEEL TIKKEN STAAT ELKE FUNCTIE VAN HET BEGINSCHERM AF.

   WAAROM DIT SCRIPT ER IS

   "Elke functie binnen vijf tikken" is een belofte, en een belofte zonder
   meting is een mening (LAT.md regel 2). Dit huis heeft 327 schermen onder
   public/apps, een bank met werelden, een huis per wereld met een rooster
   diensten, en spotlight in de schil. Niemand kan uit het hoofd zeggen hoe diep
   /apps/hangar.html zit -- en juist de schermen die niemand kan noemen zijn de
   schermen die te diep liggen.

   Dus wordt het niet geschat maar afgelopen, in een echte browser, met een
   gewone ledensessie, op TELEFOONFORMAAT -- want een tik is een duim en geen
   muis, en op een breed scherm staat de bank al open terwijl hij op een
   telefoon achter een greep zit. Meten op de brede stand zou de belofte
   goedkoper maken dan hij is.

   WAT EEN TIK HIER IS

   Een tik is een handeling die de mens moet DOEN om verder te komen:

     - een zichtbare link of knop met een bestemming aantikken kost 1 tik;
     - een bestemming die er wel staat maar niet zichtbaar is (achter een
       tabblad, een lade, een dichtgeklapt paneel) kost 2: eerst openmaken, dan
       aantikken. Dat is de eerlijke ondergrens -- soms zijn het er meer, nooit
       minder.

   Typen telt niet als tik. Wie in spotlight drie letters typt heeft geen drie
   tikken gedaan; hij heeft een veld en een resultaat aangetikt.

   WAT DEZE METER NIET ZIET, en dat staat er even groot bij:

     - een knop die met JavaScript ergens heen springt zonder href of data-url.
       Die bestaat hier (bijvoorbeeld tabbladknoppen die pas bij een klik een
       adres kennen) en telt dus als GEEN weg. De uitkomst is daarmee een
       BOVENgrens van de diepte: het kan in werkelijkheid korter zijn.
     - wat er achter een formulier of een tweede lading zit. Dit meet de weg
       NAAR een scherm, niet de weg naar een handeling BINNEN dat scherm.

   Daarom staat er per scherm bij LANGS WELKE WEG de meter er kwam. Een cijfer
   zonder route is niet na te lopen.

   DRAAIEN

     node scripts/tikken.js              (meet, schrijft TIKKEN.json)
     node scripts/tikken.js --controle   (zakt als een scherm dieper dan 5 ligt)
     node scripts/tikken.js --stil       (alleen de eindregel)
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'TIKKEN.json');
const controle = process.argv.includes('--controle');
const stil = process.argv.includes('--stil');

/* DE GRENS. Vijf, en die staat hier en niet in een leesregel: een belofte die
   alleen in een document staat, is over een half jaar weg (CLAUDE.md). */
const GRENS = 5;

/* Het beginscherm, en er is er maar EEN (WERELD.md). */
const START = '/apps/app.html';

/* ---------------------------------------------------------------------------
   WAT MET REDEN NIET OP HET BEGINSCHERM VAN EEN LID STAAT.

   Deze lijst is geen ontheffing maar een BEWERING, en elke regel draagt zijn
   reden. Twee soorten, en het verschil is belangrijk:

     ROL     -- een scherm van een rol, niet van een lid: een kantoor van RTG,
                de kant van een leverancier, een PDA op een werkvloer, een
                meldkamer. Wie daar werkt komt er via zijn zaak of zijn
                kantoortoken, niet via zijn eigen beginscherm. Zou dit hier wel
                staan, dan beloofde het huis een deur die de meeste leden niet
                mogen opendoen.
     LANDING -- een pagina waar je LANDT en niet heen navigeert: je scant een
                code op een tafel, of je volgt de link van je groep. Zo staat
                het ook in scripts/lib/bereik.js (MAG_LOS). Zo'n pagina in een
                wereld hangen zou een deur maken naar een tafel waar u niet zit.
     STAND   -- een adres dat een STAND van een andere app is geworden. Metier
                zit in RTG Geld, Codewoord/Thuisrust/Thuiswacht in RTG Veilig,
                Berichten in RTG Communication Core. Het pad blijft bestaan voor
                wie het van buiten nog gebruikt; opnieuw als tegel opvoeren zou
                twee ingangen naar hetzelfde maken -- precies wat WERELDEN.md
                afschaft.

   Wie hier iets bij zet, schrijft de reden erbij. Een scherm dat onbereikbaar
   is EN hier niet staat, laat --controle zakken; een scherm dat hier staat en
   toch bereikbaar blijkt, wordt gemeld -- dan is de reden verlopen. */
const MET_REDEN = {
  '/apps/appcel.html': 'ROL: de cel waarin derdencode draait (APPSTORE.md). Geen scherm maar een uitvoeromgeving.',
  '/apps/appstore-kantoor.html': 'ROL: de keuring van RTG. Alleen een medewerker met kantoortoken.',
  '/apps/appstore-uitgever.html': 'ROL: het bureau van een uitgever van buiten.',
  '/apps/architect-pda.html': 'ROL: PDA op de werkvloer van een architectenbureau.',
  '/apps/hardware-pda.html': 'ROL: PDA in een hardwarelab.',
  '/apps/studio-pda.html': 'ROL: PDA in een studio.',
  '/apps/boardroom.html': 'ROL: de boardroom van RTG zelf.',
  '/apps/kosten.html': 'ROL: het kostprijsbord van het kantoor (KOSTEN.md, vier lezers).',
  '/apps/zaakkosten.html': 'ROL: hetzelfde bord voor een zaak; komt binnen via de zaak.',
  '/apps/zaakweb.html': 'ROL: de website van een zaak, vanuit die zaak.',
  '/apps/websitestudio.html': 'ROL: de studio van het atelier.',
  '/apps/klankwerk-kantoor.html': 'ROL: kantoor rond een uitgave.',
  '/apps/redactiekantoor.html': 'ROL: de redactie.',
  '/apps/leverancier-commerce.html': 'ROL: de verkoopkant van een leverancier.',
  '/apps/leverancier-rtmail.html': 'ROL: RTMAIL voor een zaak.',
  '/apps/payroll.html': 'ROL: het loonkantoor.',
  '/apps/platformregister.html': 'ROL: het register van het platform.',
  '/apps/meldkamer.html': 'ROL: de meldkamer.',
  '/apps/dispatch.html': 'ROL: dispatch van vervoer.',
  '/apps/ghost.html': 'ROL: de chauffeurskant.',
  '/apps/zakelijk.html': 'ROL: zakelijk vervoer, vanuit de zaak die het inkoopt.',
  '/apps/oog.html': 'ROL: RTG Eye, een toezichtscherm.',
  '/apps/techniek.html': 'ROL: de technische status van het huis.',
  '/apps/stadsdoos.html': 'ROL: veld-app van een gemeente.',
  '/apps/handel.html': 'ROL: inkoop tussen zaken.',
  '/apps/werkplek.html': 'ROL: de campus van een werkgever.',
  '/apps/festival.html': 'ROL: de organisatiekant van een festival (de gastkant staat wel in LivingOS).',
  '/apps/gast.html': 'LANDING: aan tafel, na het scannen van de code op die tafel (bereik.js MAG_LOS).',
  '/apps/festival-gast.html': 'LANDING: uw eigen kant van het festival, via uw pas of de link van uw groep (bereik.js MAG_LOS).',
  '/apps/metier.html': 'STAND: Metier is een stand van RTG Geld geworden.',
  '/apps/codewoord.html': 'STAND: Codewoord is een stand van RTG Veilig geworden.',
  '/apps/thuisrust.html': 'STAND: Thuisrust is een stand van RTG Veilig geworden.',
  '/apps/thuiswacht.html': 'STAND: Thuiswacht is een stand van RTG Veilig geworden.',
  '/apps/berichten.html': 'STAND: de gesprekken wonen in RTG Communication Core (/apps/comm.html).'
};

const { laadBrowser } = require('../test/browser');

function log(...a) { if (!stil) console.log(...a); }

/* De bevolking: elk scherm dat een lid kan openen. Niet de appcatalogus (57
   rijen) en niet MAPPEN (82 items) maar ALLES onder public/apps, want de vraag
   is niet of de lijstjes kloppen maar of het huis bereikbaar is. Wat geen
   scherm van een lid is (de backoffice van RTG, de leverancierskant) blijft er
   wel in staan met zijn eigen antwoord: onbereikbaar voor een lid is dan geen
   fout maar de bedoeling, en dat verschil hoort een mens te maken. */
function alleSchermen() {
  const wortel = path.join(WORTEL, 'public', 'apps');
  const uit = [];
  (function loop(map) {
    for (const naam of fs.readdirSync(map)) {
      const p = path.join(map, naam);
      const st = fs.statSync(p);
      if (st.isDirectory()) loop(p);
      else if (naam.endsWith('.html')) uit.push('/' + path.relative(path.join(WORTEL, 'public'), p).split(path.sep).join('/'));
    }
  })(wortel);
  return uit.sort();
}

async function meet() {
  const pw = laadBrowser({ eigenDriver: false });
  if (!pw) { console.error('Geen browser beschikbaar; dit script meet in een echte browser.'); process.exit(2); }
  const { startServer } = require(path.join(WORTEL, 'test', 'helper.js'));
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tikken-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });

  const diepte = new Map();   // pad -> { tikken, via }
  let browser;
  try {
    const u = Date.now().toString().slice(-8);
    const lid = await fetch(base + '/api/auth/register', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Meetlid', email: 'tk' + u + '@x.nl', phone: '06' + u,
        password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' }) }).then(r => r.json());
    if (!lid || !lid.token) throw new Error('geen ledensessie: ' + JSON.stringify(lid).slice(0, 160));

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    /* TELEFOONFORMAAT. Zie de kop: op een breed scherm staat de bank open en
       zou elke wereld een tik goedkoper lijken dan hij voor een duim is. */
    const ctx = await browser.newContext({ serviceWorkers: 'block',
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
      deviceScaleFactor: 3, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
    /* DE INTAKE IS NIET WAT HIER GEMETEN WORDT. Een vers lid staat voor de
       ledenovereenkomst; die tekenen is een handeling van een mens en gebeurt
       een keer in een leven. De schermtoetsen doen dit al zo (test/apps-ui.e2e.js)
       en dit is dezelfde ingreep: de intake staat op klaar, zodat de meter de
       werktafel meet en niet de deurmat. */
    await ctx.route('**/api/onboarding/status', r => r.fulfill({ status: 200,
      contentType: 'application/json', body: JSON.stringify({ klaar: true }) }));
    const page = await ctx.newPage();
    await page.addInitScript((tok) => {
      try { localStorage.setItem('rtg_member_token', tok); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
    }, lid.token);

    /* Wat een pagina AANBIEDT: elke bestemming met de vraag of hij zichtbaar
       is. Het onderscheid zichtbaar/verborgen is de hele reden dat dit een
       meting is en geen linkteller. */
    const oogst = () => page.evaluate(() => {
      const uit = [];
      const zie = el => {
        if (!el || el.hidden) return false;
        if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return false;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return false;
        for (let p = el; p; p = p.parentElement) {
          const s = getComputedStyle(p);
          if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
        }
        return true;
      };
      const voeg = (raw, el) => {
        if (!raw) return;
        let p;
        try { p = new URL(raw, location.href); } catch (e) { return; }
        if (p.origin !== location.origin) return;
        if (!/\.html$/.test(p.pathname)) return;
        uit.push({ pad: p.pathname, zichtbaar: zie(el),
          label: (el.textContent || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 60) });
      };
      document.querySelectorAll('a[href]').forEach(a => voeg(a.getAttribute('href'), a));
      document.querySelectorAll('[data-url]').forEach(b => voeg(b.getAttribute('data-url'), b));
      return uit;
    });

    let rand = [{ pad: START, tikken: 0, via: [] }];
    diepte.set(START, { tikken: 0, via: [] });
    for (let laag = 0; laag <= GRENS && rand.length; laag++) {
      const volgende = new Map();
      for (const knoop of rand) {
        let gevonden = [];
        try {
          await page.goto(base + knoop.pad, { waitUntil: 'load', timeout: 30000 });
          await new Promise(r => setTimeout(r, 900));
          gevonden = await oogst();
        } catch (e) { /* een scherm dat niet laadt biedt geen wegen aan */ }
        for (const g of gevonden) {
          /* zichtbaar = 1 tik, verborgen = 2 (openmaken, dan aantikken) */
          const kosten = knoop.tikken + (g.zichtbaar ? 1 : 2);
          if (kosten > GRENS) continue;
          const al = diepte.get(g.pad);
          if (al && al.tikken <= kosten) continue;
          const eerder = volgende.get(g.pad);
          if (eerder && eerder.tikken <= kosten) continue;
          volgende.set(g.pad, { pad: g.pad, tikken: kosten,
            via: knoop.via.concat([{ vanaf: knoop.pad, label: g.label, zichtbaar: g.zichtbaar }]) });
        }
      }
      rand = [];
      for (const [pad, k] of volgende) { diepte.set(pad, { tikken: k.tikken, via: k.via }); rand.push(k); }
      log('  laag ' + (laag + 1) + ': ' + rand.length + ' nieuwe schermen (totaal ' + diepte.size + ')');
    }
  } finally {
    if (browser) await browser.close();
    try { child.kill(); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
  return diepte;
}

(async () => {
  log('Tikkenmeter: het huis aflopen vanaf ' + START + ' op telefoonformaat.');
  const diepte = await meet();
  const schermen = alleSchermen();
  const perScherm = schermen.map(pad => {
    const d = diepte.get(pad);
    return { pad, tikken: d ? d.tikken : null,
      via: d ? d.via.map(v => v.vanaf + ' -> ' + (v.label || '(zonder label)') + (v.zichtbaar ? '' : ' [verborgen]')) : [] };
  });
  const bereikt = perScherm.filter(s => s.tikken !== null);
  const buiten = perScherm.filter(s => s.tikken === null);
  const verdeling = {};
  for (const s of bereikt) verdeling[s.tikken] = (verdeling[s.tikken] || 0) + 1;

  const onterecht = buiten.filter(s => !MET_REDEN[s.pad]).map(s => s.pad);
  const verlopen = Object.keys(MET_REDEN).filter(p => {
    const s = perScherm.find(x => x.pad === p);
    return s && s.tikken !== null;
  });

  const uit = {
    stempel: new Date().toISOString().slice(0, 10),
    uitleg: 'Hoeveel tikken elk scherm van het beginscherm af ligt, gemeten in een echte browser op telefoonformaat met een gewone ledensessie. Een zichtbare bestemming kost 1 tik, een bestemming achter een tabblad of lade 2. Typen telt niet. Een knop die zonder href of data-url navigeert ziet deze meter niet, dus dit is een BOVENgrens.',
    grens: GRENS,
    start: START,
    schermen: schermen.length,
    bereikt: bereikt.length,
    buitenBereik: buiten.length,
    verdeling,
    metReden: Object.keys(MET_REDEN).length,
    zonderReden: onterecht,
    verlopenReden: verlopen,
    perScherm
  };
  fs.writeFileSync(DOEL, JSON.stringify(uit, null, 2) + '\n');
  console.log('TIKKEN.json: ' + bereikt.length + ' van ' + schermen.length + ' schermen binnen ' + GRENS + ' tikken, ' + buiten.length + ' erbuiten.');
  console.log('Verdeling: ' + Object.keys(verdeling).sort().map(k => k + ' tik: ' + verdeling[k]).join(', '));
  if (onterecht.length) console.log('ZONDER REDEN onbereikbaar (' + onterecht.length + '): ' + onterecht.join(', '));
  if (verlopen.length) console.log('Reden verlopen, deze zijn wel bereikbaar (' + verlopen.length + '): ' + verlopen.join(', '));
  /* FAIL-CLOSED, EN OP DE JUISTE VRAAG. Niet "zijn alle 276 schermen
     bereikbaar" -- dat zou het huis dwingen een meldkamer op een beginscherm te
     zetten -- maar: ligt elk scherm van een LID binnen vijf tikken, en draagt
     elk scherm dat er niet ligt een uitgeschreven reden? Een verlopen reden
     zakt niet: dat een scherm ALSNOG bereikbaar werd is goed nieuws, alleen mag
     de regel dan weg. */
  if (controle && onterecht.length) process.exit(1);
})().catch(e => { console.error(e); process.exit(2); });
