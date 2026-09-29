/* LEERHUIS: DE TRAINER AAN HET WERK, IN EEN ECHTE BROWSER (ACADEMY.md, fase B-UI).

   test/leerhuis-grenzen.test.js toets 23 bewijst dat de trainercockpit de
   vaardigheden van het leerpad noemt en alleen OF er een beoordeling loopt;
   deze toets bewijst dat een trainer daarmee op het werkscherm de keten afmaakt,
   tegen een echte server en met een trainer die echt gekwalificeerd is:

   1. hij zet zijn leerling onder toezicht, legt bewijs vast dat hij zag, en
      zet hem klaar voor beoordeling -- elke stap langs de handeling op de
      server, en het bewijs staat daarna in het werk van de assessor;
   2. hij vraagt de beoordeling aan, de kaart zegt dat hij loopt, en een tweede
      aanvraag weigert de server met de reden op het scherm;
   3. het herstelpad en de criteria van de assessor komen nooit op zijn scherm.
      Dat het leerpad weer openstaat ziet hij wel, want de stand van het
      leerpad was al van hem: hij begeleidt het herstel.

   Draai los: node --test test/leerhuis-trainer.e2e.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser, kantoorAlsPersoon, keurLidGoed } = require('./helper');

const pw = laadPlaywright();

test('Leerhuis trainer: onder toezicht, bewijs, klaar voor beoordeling en de aanvraag, zonder uitslag op zijn scherm',
  { skip: geenBrowser(pw) }, async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-leerhuis-trainer-'));
    const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
    const post = (pad, body, tok) => fetch(base + pad, { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
      body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
    const staat = async (tok) => (await post('/api/state', {}, tok)).body.state.user;
    let n = 0;
    const lid = async (naam) => {
      n++;
      const tok = (await post('/api/auth/register', { name: naam, email: 'lht-' + n + '@x.nl', phone: '06123498' + (10 + n),
        password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg' })).body.token;
      const u = await staat(tok);
      return { tok, id: u.id, code: u.codename, p: 'lid:' + u.id };
    };
    const ORG = 'RTG-TRAIN';

    let browser;
    try {
      const [E, C, K, Q, A, T, N] = [await lid('Tr Eigenaar'), await lid('Tr Curriculum'), await lid('Tr Kennis'),
        await lid('Tr Kwaliteit'), await lid('Tr Assessor'), await lid('Tr Trainer'), await lid('Tr Leerling')];
      await keurLidGoed(base, T.tok, T.code, '1985-03-03');

      const login = (await post('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body;
      const vz = (await post('/api/techniek/functie', { id: 'leerhuis', aan: true }, login.token)).body;
      if (vz.status === 'wacht') await post('/api/techniek/functie/besluit', { verzoekId: vz.verzoekId }, login.token);
      const office = await kantoorAlsPersoon(base, 'RTG-OFFICE');
      assert.equal((await post('/api/office/leerhuis/open', { id: ORG, soort: 'RTG', naam: 'Train', eigenaar: 'user-' + E.id }, office)).status, 200);
      let s = 0;
      const doe = async (wie, actie, invoer) => {
        const r = await post('/api/leerhuis/doe', { org: ORG, actie, invoer, sleutel: 'opzet-' + (++s) }, wie.tok);
        assert.equal(r.status, 200, actie + ': ' + JSON.stringify(r.body));
        return r.body;
      };
      const lees = async (wie, vraag) => (await post('/api/leerhuis/lees', { org: ORG, vraag }, wie.tok)).body.antwoord;

      /* De organisatie, met gescheiden bestuursrollen (zoals scripts/lib/leerhuiswereld.js). */
      for (const x of [C, K, Q, A, T]) await doe(E, 'relatieZet', { persoon: x.p, soort: 'EMPLOYEE' });
      await doe(E, 'relatieZet', { persoon: N.p, soort: 'EMPLOYEE', manager: Q.p });
      await doe(E, 'bestuurZet', { persoon: C.p, rol: 'CURRICULUM_OWNER' });
      await doe(E, 'bestuurZet', { persoon: K.p, rol: 'KNOWLEDGE_OWNER' });
      for (const r of ['TRAINER_AUTHORITY', 'ASSESSMENT_AUTHORITY', 'QUALITY_AUTHORITY']) await doe(E, 'bestuurZet', { persoon: Q.p, rol: r });
      await doe(E, 'bestuurZet', { persoon: A.p, rol: 'ASSESSOR' });
      await doe(C, 'kennisSchrijf', { id: 'terugboeken', domein: 'betalingen', titel: 'Een betaling terugboeken', tekst: 'Controleer, leg de reden vast, laat een tweede mens tekenen.', bron: 'GELD.md par. 3' });
      await doe(C, 'kennisSchrijf', { id: 'lesgeven', domein: 'academy', titel: 'Voordoen, laten doen, observeren', tekst: 'Een trainer beoordeelt niet zelf.', bron: 'de opdracht' });
      for (const id of ['terugboeken', 'lesgeven']) {
        await doe(C, 'kennisStand', { id, versie: 1, naar: 'REVIEW' });
        await doe(K, 'kennisStand', { id, versie: 1, naar: 'ACTIVE' });
      }
      await doe(C, 'vaardigheidZet', { id: 'terugboeken', naam: 'Een betaling terugboeken', niveau: 'PRACTITIONER', kritiek: true, kennis: ['terugboeken'],
        bewijsEis: { sterkte: 'OBSERVED', soorten: ['SIMULATION_EVIDENCE', 'OBSERVATION_EVIDENCE'] }, geldigDagen: 365, hercertificering: 'EVENT_DRIVEN' });
      await doe(C, 'vaardigheidZet', { id: 'didactiek', naam: 'Train-the-Trainer', niveau: 'ADVANCED', kritiek: true, trainerschap: true, kennis: ['lesgeven'],
        bewijsEis: { sterkte: 'OBSERVED', soorten: ['TRAINER_EVIDENCE', 'SIMULATION_EVIDENCE'] } });
      await doe(C, 'rolZet', { id: 'ops', titel: 'Operations Professional', soort: 'OPERATIONS', vaardigheden: ['terugboeken'], certificaten: ['terugboeken'] });
      const fasen = ['UNDERSTAND', 'OBSERVE', 'PRACTICE', 'SIMULATE', 'SUPERVISED_WORK', 'PROVE', 'CERTIFY', 'REFRESH'].map(f => ({ fase: f, wat: f.toLowerCase() }));
      await doe(C, 'curriculumZet', { id: 'ops-basis', titel: 'Terugboeken', vaardigheden: ['terugboeken'], kennis: ['terugboeken'], fasen });
      await doe(C, 'curriculumStand', { id: 'ops-basis', naar: 'REVIEW' });
      await doe(C, 'curriculumStand', { id: 'ops-basis', naar: 'ACTIVE' });
      await doe(C, 'scenarioZet', { id: 'storno', domein: 'betalingen', vaardigheden: ['terugboeken'], vereist: ['controleer', 'reden', 'tweede-mens'], verboden: ['direct-uitbetalen'], volgorde: true });
      await doe(C, 'scenarioZet', { id: 'lesdemo', domein: 'academy', vaardigheden: ['didactiek'], vereist: ['voordoen', 'laten-doen', 'observeren'], verboden: ['zelf-beoordelen'] });

      /* T wordt trainer: bewijs, beoordeling en certificaat voor beide vaardigheden. */
      const bewijsIds = async (v) => ((await lees(A, 'assessorWerk')).LOPEND.find(b => b.persoon === T.p && b.vaardigheid === v) || { bewijs: [] }).bewijs.map(b => b.id);
      for (const [v, sim, keuzes, soort] of [['terugboeken', 'storno', ['controleer', 'reden', 'tweede-mens'], 'OBSERVATION_EVIDENCE'],
        ['didactiek', 'lesdemo', ['voordoen', 'laten-doen', 'observeren'], 'TRAINER_EVIDENCE']]) {
        await doe(T, 'simulatieAfronden', { scenario: sim, keuzes });
        await doe(A, 'bewijsVastleggen', { persoon: T.p, vaardigheid: v, soort, sterkte: 'OBSERVED', bron: 'opzet' });
        const b = (await doe(T, 'beoordelingAanvragen', { persoon: T.p, vaardigheid: v })).id;
        await doe(A, 'beoordelingStart', { id: b });
        await doe(A, 'beoordelingAfronden', { id: b, uitkomst: 'PROVEN', bewijs: await bewijsIds(v), criteria: 'gezien' });
        await doe(Q, 'certificaatUitgeven', { persoon: T.p, vaardigheden: [v], beoordelingen: [b], geldigDagen: 365 });
      }
      await doe(Q, 'trainerKwalificeer', { persoon: T.p, trede: 'CERTIFIED_TRAINER', curricula: ['ops-basis'] });

      /* N leert tot de simulatie; daarna neemt de trainer het over op het scherm. */
      await doe(Q, 'rolToewijzen', { persoon: N.p, rol: 'ops' });
      await doe(Q, 'startplanMaak', { persoon: N.p, rol: 'ops' });
      const pad = (await lees(T, 'trainerCockpit')).LEERLINGEN || [];
      if (!pad.some(x => x.persoon === N.p)) await doe(Q, 'trainerToewijzen', { persoon: N.p, curriculum: 'ops-basis', trainer: T.p });
      for (const naar of ['LEARNING', 'PRACTICING']) await doe(N, 'lerenStand', { persoon: N.p, curriculum: 'ops-basis', naar });
      await doe(N, 'simulatieAfronden', { scenario: 'storno', keuzes: ['controleer', 'reden', 'tweede-mens'] });
      await doe(N, 'lerenStand', { persoon: N.p, curriculum: 'ops-basis', naar: 'SIMULATING' });

      browser = await pw.chromium.launch(browserOpties());
      const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
      await ctx.addInitScript((t) => { try { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {} }, T.tok);
      const page = await ctx.newPage();
      letOpFouten(page);
      await page.goto(base + '/apps/leerhuis-werk.html?org=' + ORG, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !/wordt geladen/.test(document.getElementById('melding').textContent));
      const kaart = () => page.locator('#trainer .kaart', { hasText: N.code });
      const melding = (re) => page.waitForFunction((b) => new RegExp(b).test(document.getElementById('melding').textContent), re.source);

      /* 1. Onder toezicht, bewijs, klaar voor beoordeling. */
      await kaart().getByRole('button', { name: 'Werkt nu onder mijn toezicht' }).click();
      await melding(/onder uw toezicht/);
      const k = kaart();
      await k.locator('summary', { hasText: 'Bewijs of beoordeling' }).click();
      await k.getByLabel('Soort bewijs').selectOption('OBSERVATION_EVIDENCE');
      await k.getByLabel('Hoe u het weet').selectOption('OBSERVED');
      await k.getByLabel('Waar u het zag of welk stuk').fill('storno aan de balie, 29 september');
      await k.getByRole('button', { name: 'Bewijs vastleggen' }).click();
      await melding(/Bewijs vastgelegd voor Een betaling terugboeken/);
      await kaart().getByRole('button', { name: 'Klaar voor beoordeling' }).click();
      await melding(/klaar voor beoordeling/);

      /* 2. De aanvraag, en een tweede die de server weigert. */
      await kaart().locator('summary', { hasText: 'Bewijs of beoordeling' }).click();
      await kaart().getByRole('button', { name: 'Beoordeling aanvragen' }).click();
      await melding(/Beoordeling aangevraagd/);
      await kaart().getByText('Er loopt een beoordeling voor: Een betaling terugboeken').waitFor();
      await kaart().locator('summary', { hasText: 'Bewijs of beoordeling' }).click();
      await kaart().getByRole('button', { name: 'Beoordeling aanvragen' }).click();
      await melding(/Niet gelukt: er loopt al een beoordeling/);

      const open = (await lees(A, 'assessorWerk')).OPEN.filter(b => b.persoon === N.p);
      assert.equal(open.length, 1, 'precies een aanvraag wacht op de assessor: ' + JSON.stringify(open));
      await doe(A, 'beoordelingStart', { id: open[0].id });
      const lopend = (await lees(A, 'assessorWerk')).LOPEND.find(b => b.id === open[0].id);
      assert.ok(lopend.bewijs.some(b => b.bron === 'storno aan de balie, 29 september' && b.sterkte === 'OBSERVED'),
        'het bewijs dat de trainer op het scherm vastlegde, ligt bij de assessor: ' + JSON.stringify(lopend.bewijs));

      /* 3. Het herstelpad en de criteria komen niet op het scherm van de trainer. */
      await doe(A, 'beoordelingAfronden', { id: open[0].id, uitkomst: 'NOT_YET_PROVEN', herstel: 'nog een keer onder toezicht bij een grote storno' });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !/wordt geladen/.test(document.getElementById('melding').textContent));
      await kaart().waitFor();
      assert.doesNotMatch(await page.textContent('main'), /grote storno|NOT_YET_PROVEN/, 'geen herstelpad en geen ruwe uitslag bij de trainer');
      assert.match(await kaart().textContent(), /volg het herstelpad/, 'wel de stand van het leerpad dat hij begeleidt');
      assert.doesNotMatch(await page.textContent('main'), /\d+\s*%|score/i, 'geen cijfer op een mens');
    } finally {
      if (browser) await browser.close().catch(() => {});
      await stop(child);
      try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
    }
  });
