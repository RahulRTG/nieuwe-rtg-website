/* Het communicatieplatform (server/kern/comm + apps/comm.html).

   WAT HIER BEWAAKT WORDT, en waarom juist dit.

   Dit huis had zes berichtenvoorraden naast elkaar en elke module die er een
   gesprek bij wilde, bouwde de zevende. De kern maakt daar een model van --
   maar een gedeeld model is precies het soort ding dat stil scheef gaat: er
   komt een route bij, die vergeet een controle, en dan lekt een gesprek. De
   vier beloftes hieronder zijn daarom niet "werkt het", maar "kan het niet
   misgaan".

   1. EEN GESPREK IS VAN ZIJN DEELNEMERS. Lezen, sturen, reageren, porren,
      samenvatten -- alles loopt langs dezelfde poort. Een id raden mag nooit
      genoeg zijn. Dit is de toets die er als eerste moest komen: de kern maakt
      een gesprek van elke lijst sleutels die hij krijgt (terecht -- een rit
      koppelt ook vreemden), dus de poort MOET aan de leeskant staan.

   2. EEN GESPREK BEGINNEN KAN ALLEEN MET WIE JE KENT. Deze controle stond er
      eerst NIET in: /api/comm/begin gaf elk lid een gesprek met elke sleutel
      die hij invulde. Op een platform op codenaam is dat erger dan spam -- het
      is een manier om te toetsen of een codenaam bestaat.

   3. EEN PAAR HEEFT EEN GESPREK. Twee gesprekken tussen dezelfde twee mensen
      is de fout die pas opvalt als iemand zegt "ik heb je wel geantwoord".

   4. DE AI STELT OP, DE MENS VERSTUURT. /api/comm/ai levert tekst en plaatst
      niets. Dezelfde drempel als bij geld.

   En tot slot dat er ECHT EEN APP is: het oude berichtenpad leidt naar de
   nieuwe app, en bellen en videobellen staan niet meer los op het beginscherm.

   Draait alleen waar Playwright beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function laadPlaywright() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  return null;
}
const pw = laadPlaywright();

async function post(base, pad, body, tok) {
  const r = await fetch(base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {}) });
  const d = await r.json().catch(() => ({}));
  return Object.assign({ _status: r.status }, d);
}

/* Drie leden, waarvan twee verbonden. De derde is de vreemde: hij hoort
   nergens bij en is daarmee het meetinstrument van belofte 1.

   VIA DE DEMO-INLOG, en dat is een keuze die uitleg verdient. De eerste versie
   registreerde drie verse accounts en zocht elkaars sleutel op codenaam --
   zoals een mens dat doet. Dat werkte niet: de ledengids indexeert een vers
   lid niet meteen, en na vijf seconden proberen vond de toets nog steeds
   niets. Daar is niets mis mee (dat is een eigenschap van de gids, geen fout),
   maar het maakt de toets afhankelijk van iets dat hij niet meet.

   De demo-inlog geeft sessies met VASTE sleutels ('rtg', 'business',
   'lifestyle'), dus verbinden kan rechtstreeks. Hij staat alleen aan met
   RTG_DEMO=1 en is op een echte server uit -- daarom staat die vlag hier in de
   toets en nergens anders. */
const TIERS = { A: 'rtg', B: 'business', C: 'lifestyle' };

async function drieLeden(base) {
  const inlog = async (tier) => {
    const r = await post(base, '/api/login', { tier, pasApp: tier });
    assert.ok(r.token, 'demo-inlog voor ' + tier + ' (staat RTG_DEMO=1 aan?)');
    return r;
  };
  const A = await inlog(TIERS.A), B = await inlog(TIERS.B), C = await inlog(TIERS.C);
  assert.ok((await post(base, '/api/member/connect', { key: TIERS.B }, A.token)).ok, 'A vraagt B');
  assert.ok((await post(base, '/api/member/connect/respond',
    { key: TIERS.A, action: 'accept' }, B.token)).ok, 'B accepteert');
  return { A, B, C, ka: TIERS.A, kb: TIERS.B, kc: TIERS.C };
}

async function metServer(fn) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-comm-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  try { await fn(base); } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
}

test('een gesprek is van zijn deelnemers: een vreemde komt er langs geen enkele weg in', async () => {
  await metServer(async (base) => {
    const { A, B, C, kb } = await drieLeden(base);
    const g = await post(base, '/api/comm/begin', { met: kb }, A.token);
    assert.ok(g.ok, 'A begint een gesprek met B: ' + (g.error || ''));
    const id = g.gesprek.id;
    assert.ok((await post(base, '/api/comm/stuur', { id, tekst: 'Onder ons.' }, A.token)).ok);

    // B hoort erbij en ziet het
    const bij = await post(base, '/api/comm/gesprek', { id }, B.token);
    assert.equal(bij.gesprek.berichten[0].tekst, 'Onder ons.', 'B leest het gesprek');
    const berichtId = bij.gesprek.berichten[0].id;

    /* C hoort er NIET bij. Elke weg apart, want een poort die op vier plekken
       moet staan is een poort die op de vijfde wordt vergeten. */
    const wegen = [
      ['lezen', '/api/comm/gesprek', { id }],
      ['sturen', '/api/comm/stuur', { id, tekst: 'ik hoor hier niet' }],
      ['reageren', '/api/comm/reactie', { id, berichtId, teken: '👍' }],
      ['wijzigen', '/api/comm/wijzig', { id, berichtId, tekst: 'gekaapt' }],
      ['wissen', '/api/comm/wis', { id, berichtId }],
      ['lezen-melden', '/api/comm/lees', { id }],
      ['typen', '/api/comm/typt', { id }],
      ['porren', '/api/comm/por', { id }],
      ['vlaggen', '/api/comm/vlag', { id, vlag: 'vast', aan: true }],
      ['samenvatten', '/api/comm/ai', { id, taak: 'samenvat' }]
    ];
    const open = [];
    for (const [naam, pad, body] of wegen) {
      const r = await post(base, pad, body, C.token);
      if (r.ok || r._status === 200) open.push(naam + ' (' + pad + ')');
    }
    assert.deepEqual(open, [], 'een vreemde kwam binnen via: ' + open.join(', '));

    // en het gesprek is er niet door veranderd
    const na = await post(base, '/api/comm/gesprek', { id }, B.token);
    assert.equal(na.gesprek.berichten.length, 1, 'er is niets bijgekomen');
    assert.equal(na.gesprek.berichten[0].tekst, 'Onder ons.', 'en niets veranderd');
  });
});

test('een gesprek beginnen kan alleen met wie je al kent', async () => {
  await metServer(async (base) => {
    const { A, kb, kc } = await drieLeden(base);
    /* Deze controle stond er eerst niet in. Drie vormen: een verzonnen
       sleutel, een sleutel van een bestaand lid dat geen vriend is, en een
       groep waarin een vreemde meelift -- die laatste is de sluiproute, want
       een lijst met een bekende erin ziet er geldig uit. */
    const verzonnen = await post(base, '/api/comm/begin', { met: 'zomaarverzonnen' }, A.token);
    assert.ok(!verzonnen.ok, 'een verzonnen sleutel gaf een gesprek');

    const vreemd = await post(base, '/api/comm/begin', { met: kc }, A.token);
    assert.ok(!vreemd.ok, 'een bestaand maar onverbonden lid gaf een gesprek');
    const groep = await post(base, '/api/comm/begin', { met: [kb, kc] }, A.token);
    assert.ok(!groep.ok, 'een vreemde liftte mee in een groepsgesprek');
    // en met een vriend mag het gewoon
    assert.ok((await post(base, '/api/comm/begin', { met: kb }, A.token)).ok, 'met een vriend mag het wel');
  });
});

test('twee mensen hebben een gesprek, niet twee', async () => {
  await metServer(async (base) => {
    const { A, B, ka, kb } = await drieLeden(base);
    const een = await post(base, '/api/comm/begin', { met: kb }, A.token);
    const twee = await post(base, '/api/comm/begin', { met: kb }, A.token);
    const drie = await post(base, '/api/comm/begin', { met: ka }, B.token);
    assert.equal(twee.gesprek.id, een.gesprek.id, 'A kreeg een tweede gesprek met dezelfde persoon');
    assert.equal(drie.gesprek.id, een.gesprek.id, 'B opende een ANDER gesprek dan A -- ze praten langs elkaar');
    /* De titel hangt af van wie kijkt, en dat hoort: een opgeslagen titel zou
       voor een van beiden altijd de verkeerde zijn. */
    assert.equal(een.gesprek.titel, B.state.user.codename, 'A ziet de codenaam van B');
    assert.equal(drie.gesprek.titel, A.state.user.codename, 'B ziet de codenaam van A');
    assert.notEqual(een.gesprek.titel, drie.gesprek.titel, 'beiden zien dezelfde naam boven het gesprek');
  });
});

test('de AI stelt op en verstuurt nooit zelf', async () => {
  await metServer(async (base) => {
    const { A, B, kb } = await drieLeden(base);
    const g = await post(base, '/api/comm/begin', { met: kb }, A.token);
    const id = g.gesprek.id;
    await post(base, '/api/comm/stuur', { id, tekst: 'Zullen we vrijdag om zeven uur eten?' }, A.token);
    await post(base, '/api/comm/stuur', { id, tekst: 'Ja, prima. Ik reserveer.' }, B.token);
    const voor = (await post(base, '/api/comm/gesprek', { id }, A.token)).gesprek.berichten.length;

    /* Zonder AI-sleutel geeft dit een nette 503 en geen verzonnen inhoud; met
       sleutel komt er tekst terug. Wat het NOOIT mag doen -- en dat is het
       enige wat deze toets echt bewaakt -- is een bericht in het gesprek
       zetten. Beide uitkomsten zijn dus goed; een extra bericht is dat niet. */
    for (const taak of ['samenvat', 'concept', 'afspraken']) {
      const r = await post(base, '/api/comm/ai', { id, taak }, A.token);
      assert.ok(r._status === 200 || r._status === 503,
        'de AI-taak ' + taak + ' gaf een onverwachte status ' + r._status);
    }
    const na = (await post(base, '/api/comm/gesprek', { id }, A.token)).gesprek.berichten.length;
    assert.equal(na, voor, 'de AI heeft zelf een bericht in het gesprek gezet');
  });
});

test('er is EEN communicatie-app: het oude berichtenpad leidt erheen en bellen staat niet meer los',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  await metServer(async (base) => {
    const A = await post(base, '/api/login', { tier: 'rtg', pasApp: 'rtg' });
    assert.ok(A.token, 'demo-inlog');
    const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    try {
      const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });
      await ctx.addInitScript((t) => {
        try {
          localStorage.setItem('rtg_member_token', t);
          localStorage.setItem('rtg_lang', 'nl');
          localStorage.setItem('rtg_cookieinfo_v1', '1');
        } catch (e) {}
      }, A.token);
      const page = await ctx.newPage();
      const fouten = letOpFouten(page, []);

      /* Het oude pad blijft bestaan -- er kan van buiten naar gelinkt zijn --
         maar het brengt je naar de ene app. Een dood pad is erger dan een
         omleiding. */
      await page.goto(base + '/apps/berichten.html', { waitUntil: 'domcontentloaded' });
      await page.waitForURL(/\/apps\/comm\.html/, { timeout: 8000 });

      await page.waitForSelector('.laden button', { timeout: 10000 });
      const laden = await page.evaluate(() =>
        [...document.querySelectorAll('.laden button')].map((b) => b.textContent.trim()));
      assert.deepEqual(laden, ['Alles', 'Mensen', 'Zaken', 'Onderweg', 'Officieel', 'Rahul'],
        'de laden van de inbox staan er niet: ' + laden.join(', '));

      /* NIETS MAG BUITEN BEELD VALLEN. De linkerkolom liep op een telefoon
         104 punten buiten het venster (een rasterkolom krimpt niet onder zijn
         min-content-breedte), en de +-knop stond dus buiten beeld -- zonder
         schuifbalk en zonder foutmelding. Vandaar deze meting en niet een
         schermafdruk waar je overheen kijkt. */
      const maat = await page.evaluate(() => {
        const p = document.getElementById('nieuwBtn').getBoundingClientRect();
        return { plusRechts: Math.round(p.right), venster: innerWidth,
          overloop: document.documentElement.scrollWidth > innerWidth };
      });
      assert.ok(maat.plusRechts <= maat.venster,
        'de knop "nieuw gesprek" staat buiten beeld (' + maat.plusRechts + ' > ' + maat.venster + ')');
      assert.equal(maat.overloop, false, 'het scherm loopt horizontaal over');

      /* HET BEGINSCHERM TOONT ALLEEN NOG DE DRIE HOOFDWERELDEN.

         Hier stond dat Bellen en Videobellen niet meer als eigen app in de
         functierij mochten staan, en dat Berichten er WEL in stond. Die rij
         bestaat niet meer: het beginscherm draagt de drie hoofdwerelden en verder
         geen losse apps. De oude bewering zou nu eisen dat er een rij is.

         Wat de bewering waard was, blijft: contact met iemand is EEN ding en
         geen vier apps. Dat wordt hierboven al getoetst op het gesprek zelf.
         Wat hier overblijft is de nieuwe afspraak -- geen losse app-tegels op
         het beginscherm -- plus de weg naar Berichten die er moet zijn, want
         een app zonder ingang is erger dan een app te veel. */
      /* IN DE BRON EN NIET OP HET SCHERM, en dat is met reden. Mijn eerste
         versie las `#osFuncties .os-app` uit de DOM. Die telde altijd nul --
         ook toen ik er met een mutatie een tegel in terugzette. De rij wordt
         in dit klikpad namelijk niet getekend (de bezoeker is hier geen lid
         met een pas), dus de bewering kon niet zakken. Een toets die je niet
         hebt zien zakken is geen toets (LAT.md regel 9).

         De gebouwde bundel is wel eerlijk te lezen, en dat is precies waar de
         afspraak staat: een lege FUNCTIES-lijst. Zet iemand er een app in
         terug, dan zakt deze regel. */
      const bundel = fs.readFileSync(path.join(__dirname, '..', 'public', 'apps', 'app-main.js'), 'utf8');
      assert.match(bundel, /const FUNCTIES = \[\s*\]/,
        'het beginscherm draagt weer losse app-tegels naast de drie hoofdwerelden');

      // en Berichten is bereikbaar vanuit zijn wereld
      await page.goto(base + '/apps/sociaal.html', { waitUntil: 'domcontentloaded' });
      const naarComm = await page.evaluate(() =>
        [...document.querySelectorAll('a[href],[data-href]')]
          .some((e) => /\/apps\/comm\.html/.test(e.getAttribute('href') || e.getAttribute('data-href') || '')));
      assert.ok(naarComm, 'vanuit RTG Sociaal is Berichten niet te bereiken');

      assert.deepEqual(fouten, [], 'JS-fouten: ' + fouten.join(' | '));
    } finally { await browser.close(); }
  });
});
