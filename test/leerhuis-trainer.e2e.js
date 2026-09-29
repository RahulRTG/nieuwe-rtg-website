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
   00. de certificaatautoriteit geeft de certificaten van de trainer uit (en
      schorst er een, wat zonder reden geweigerd wordt), en de trainerautoriteit
      kwalificeert hem -- allemaal op het scherm;
   0. vooraf richten de manager en de curriculumeigenaar het leerhuis in op
      hetzelfde scherm: rol, startplan, en een curriculum dat de server niet
      laat activeren zolang het concept-kennis zou leren;
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

      /* T wordt trainer: bewijs en beoordeling voor beide vaardigheden hier; het
         certificaat en de kwalificatie geeft de autoriteit Q op het scherm. */
      const bewijsIds = async (v) => ((await lees(A, 'assessorWerk')).LOPEND.find(b => b.persoon === T.p && b.vaardigheid === v) || { bewijs: [] }).bewijs.map(b => b.id);
      for (const [v, sim, keuzes, soort] of [['terugboeken', 'storno', ['controleer', 'reden', 'tweede-mens'], 'OBSERVATION_EVIDENCE'],
        ['didactiek', 'lesdemo', ['voordoen', 'laten-doen', 'observeren'], 'TRAINER_EVIDENCE']]) {
        await doe(T, 'simulatieAfronden', { scenario: sim, keuzes });
        await doe(A, 'bewijsVastleggen', { persoon: T.p, vaardigheid: v, soort, sterkte: 'OBSERVED', bron: 'opzet' });
        const b = (await doe(T, 'beoordelingAanvragen', { persoon: T.p, vaardigheid: v })).id;
        await doe(A, 'beoordelingStart', { id: b });
        await doe(A, 'beoordelingAfronden', { id: b, uitkomst: 'PROVEN', bewijs: await bewijsIds(v), criteria: 'gezien' });
      }

      browser = await pw.chromium.launch(browserOpties());
      const opScherm = async (wie, adres) => {
        const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
        await ctx.addInitScript((t) => { try { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {} }, wie.tok);
        const pg = await ctx.newPage();
        letOpFouten(pg);
        await pg.goto(base + (adres || '/apps/leerhuis-werk.html') + '?org=' + ORG, { waitUntil: 'domcontentloaded' });
        await pg.waitForFunction(() => !/wordt geladen/.test(document.getElementById('melding').textContent));
        return pg;
      };
      /* "Bezig: ..." herhaalt de tekst van de uitslag voordat de server antwoordde; wie
         daarop wacht, klikt in een kaart die de volgende laadronde weer vervangt. */
      const wachtOp = (pg, re) => pg.waitForFunction((b) => { const t = document.getElementById('melding').textContent;
        return !/^Bezig/.test(t) && new RegExp(b).test(t); }, re.source);

      /* 0. De inrichting op het scherm: de manager wijst de rol toe en maakt het
         startplan; de curriculumeigenaar krijgt de weigering van de server als
         een curriculum concept-kennis zou leren. */
      const q = await opScherm(Q);

      /* 00. De certificaat- en trainerautoriteit op het scherm: twee bewezen
         beoordelingen liggen klaar en krijgen een certificaat; schorsen zonder
         reden weigert de server; daarna wordt T gekwalificeerd als trainer. */
      for (const naam of ['Een betaling terugboeken', 'Train-the-Trainer']) {
        await q.locator('#certificaat .kaart', { hasText: naam + ' van ' + T.code }).filter({ hasText: 'nog geen certificaat' })
          .getByRole('button', { name: 'Certificaat uitgeven' }).click();
        await wachtOp(q, new RegExp('Certificaat uitgegeven: ' + naam));
      }
      const tcert = () => q.locator('#certificaat .kaart', { hasText: 'Een betaling terugboeken van ' + T.code });
      await tcert().getByRole('button', { name: 'Schorsen' }).click();
      await wachtOp(q, /Niet gelukt: zonder reden geen schorsing/);
      await tcert().getByLabel('Reden').fill('controle na een klacht');
      await tcert().getByRole('button', { name: 'Schorsen' }).click();
      await wachtOp(q, /^Schorsen: Een betaling terugboeken/);
      await tcert().getByLabel('Reden').fill('klacht onterecht');
      await tcert().getByRole('button', { name: 'Weer actief' }).click();
      await wachtOp(q, /^Weer actief: Een betaling terugboeken/);
      const kand = q.locator('#trainerautoriteit .kaart', { hasText: 'Train-the-Trainer' }).filter({ hasText: T.code });
      await kand.getByLabel('Trede voor ' + T.code).selectOption('CERTIFIED_TRAINER');
      await kand.getByRole('button', { name: 'Kwalificeren' }).click();
      await wachtOp(q, /Gekwalificeerd: .* als gecertificeerd trainer/);
      assert.ok((await lees(Q, 'trainerWerk')).TRAINERS.some(x => x.persoon === T.p && x.curricula.includes('ops-basis')),
        'T is trainer voor ops-basis, gekwalificeerd op het scherm');
      const qk = q.locator('#manager .kaart', { hasText: N.code });
      await qk.getByLabel('Rol voor ' + N.code).selectOption('ops');
      await qk.getByRole('button', { name: 'Rol toewijzen' }).click();
      await wachtOp(q, /Rol toegewezen: Operations Professional/);
      await q.locator('#manager .kaart', { hasText: N.code }).getByRole('button', { name: 'Startplan maken voor Operations Professional' }).click();
      await wachtOp(q, /Startplan gemaakt/);
      await q.locator('#manager .kaart', { hasText: N.code }).getByText('Startplan ligt klaar voor Operations Professional').waitFor();
      assert.equal(await q.locator('#manager .kaart', { hasText: N.code }).getByRole('button', { name: /Startplan maken/ }).count(), 0,
        'een startplan dat er ligt, krijgt geen tweede knop');

      await doe(C, 'kennisSchrijf', { id: 'escalatie', domein: 'betalingen', titel: 'Escaleren', tekst: 'Wanneer een tweede mens tekent.', bron: 'GELD.md' });
      await doe(C, 'curriculumZet', { id: 'ops-extra', titel: 'Escaleren', vaardigheden: ['terugboeken'], kennis: ['escalatie'] });
      const c = await opScherm(C);
      const ck = () => c.locator('#curriculum .kaart', { hasText: 'Escaleren' });
      await ck().getByText('Nog geen officiële kennis: escalatie').waitFor();
      await ck().getByRole('button', { name: 'Ter review' }).click();
      await wachtOp(c, /Ter review: Escaleren/);
      await ck().getByRole('button', { name: 'Activeren' }).click();
      await wachtOp(c, /Niet gelukt: .*concept/);
      assert.match(await ck().textContent(), /ter review|review/i, 'de weigering liet de stand staan');

      /* De curriculumeigenaar schrijft op het scherm: kennis als concept (en
         zet zijn eigen concept ter review), een kritieke vaardigheid die de
         server op te zwak bewijs weigert, en een curriculum. De
         kwaliteitsautoriteit ziet de curricula maar krijgt geen formulieren. */
      assert.equal(await q.locator('#schrijven details').count(), 0, 'de kwaliteitsautoriteit schrijft niets');
      const form = (titel) => c.locator('#schrijven details', { hasText: titel });
      await form('Nieuwe kennis').locator('summary').click();
      await form('Nieuwe kennis').getByLabel('Titel van het kennisitem').fill('Een terugboeking controleren');
      await form('Nieuwe kennis').getByLabel('Tekst').fill('Kijk de oorspronkelijke betaling na voor je terugboekt.');
      await form('Nieuwe kennis').getByLabel('Bron of bewijs').fill('werkinstructie Operations 2026');
      await form('Nieuwe kennis').getByRole('button', { name: 'Kennis schrijven' }).click();
      await wachtOp(c, /Concept geschreven: Een terugboeking controleren \(code een-terugboeking-controleren\)/);
      await c.locator('#schrijven .rij', { hasText: 'Uw concept: Een terugboeking controleren' }).getByRole('button', { name: 'Ter review' }).click();
      await wachtOp(c, /Ter review gezet: Een terugboeking controleren/);

      await form('Nieuwe vaardigheid').locator('summary').click();
      await form('Nieuwe vaardigheid').getByLabel('Naam van de vaardigheid').fill('Terugboeking controleren');
      await form('Nieuwe vaardigheid').getByLabel('Niveau').selectOption('PRACTITIONER');
      await form('Nieuwe vaardigheid').getByLabel('Minimaal bewijs').selectOption('DOCUMENTED');
      await form('Nieuwe vaardigheid').getByText('Kritiek:').click();
      await form('Nieuwe vaardigheid').getByRole('button', { name: 'Vaardigheid vastleggen' }).click();
      await wachtOp(c, /Niet gelukt: een kritieke vaardigheid vraagt minstens OBSERVED/);
      /* Een weigering laat het formulier staan, met wat er al was ingevuld. */
      assert.equal(await form('Nieuwe vaardigheid').getByLabel('Naam van de vaardigheid').inputValue(), 'Terugboeking controleren');
      await form('Nieuwe vaardigheid').getByLabel('Minimaal bewijs').selectOption('OBSERVED');
      await form('Nieuwe vaardigheid').getByRole('button', { name: 'Vaardigheid vastleggen' }).click();
      await wachtOp(c, /Vaardigheid vastgelegd: Terugboeking controleren/);

      await form('Nieuw curriculum').locator('summary').click();
      await form('Nieuw curriculum').getByLabel('Titel van het curriculum').fill('Controle voor terugboeken');
      await form('Nieuw curriculum').getByText('Terugboeking controleren', { exact: true }).click();
      await form('Nieuw curriculum').getByRole('button', { name: 'Curriculum vastleggen' }).click();
      await wachtOp(c, /Curriculum vastgelegd als concept: Controle voor terugboeken/);
      await c.locator('#curriculum .kaart', { hasText: 'Controle voor terugboeken' }).getByText('Terugboeking controleren').waitFor();
      const nieuw = (await lees(C, 'curriculumWerk')).VAARDIGHEDEN.find(v => v.id === 'terugboeking-controleren');
      assert.ok(nieuw, 'de vaardigheid staat er, met de code uit haar naam');

      /* N leert tot de simulatie; daarna neemt de trainer het over op het scherm. */
      const pad = (await lees(T, 'trainerCockpit')).LEERLINGEN || [];
      if (!pad.some(x => x.persoon === N.p)) await doe(Q, 'trainerToewijzen', { persoon: N.p, curriculum: 'ops-basis', trainer: T.p });
      /* De leerling zet zijn EIGEN stappen op Mijn leerhuis: beginnen, oefenen,
         een scenario dat mislukt (en geen bewijs achterlaat), hetzelfde scenario
         goed, en dan de stap naar het spelen. */
      const n = await opScherm(N, '/apps/leerhuis.html');
      const npad = () => n.locator('#pad .kaart', { hasText: 'Terugboeken' });
      await npad().getByRole('button', { name: 'Ik begin met leren' }).click();
      await wachtOp(n, /Vastgelegd: u bent begonnen met leren/);
      await npad().getByRole('button', { name: 'Ik ga oefenen' }).click();
      await wachtOp(n, /Vastgelegd: u oefent nu/);
      const scen = n.locator('#oefenen .kaart', { hasText: 'storno' });
      for (const stap of ['direct-uitbetalen', 'controleer']) await scen.getByRole('button', { name: stap, exact: true }).click();
      await scen.getByRole('button', { name: 'Scenario afronden' }).click();
      await wachtOp(n, /Nog niet geslaagd\. Er ontbrak: reden, tweede-mens\. Dit had niet gemogen: direct-uitbetalen\./);
      const nMijn = async () => (await post('/api/leerhuis/lees', { org: ORG, vraag: 'mijn' }, N.tok)).body.antwoord;
      await scen.getByRole('button', { name: 'Opnieuw kiezen' }).click();
      for (const stap of ['controleer', 'reden', 'tweede-mens']) await scen.getByRole('button', { name: stap, exact: true }).click();
      await scen.getByText('Uw volgorde: 1. controleer, 2. reden, 3. tweede-mens').waitFor();
      await scen.getByRole('button', { name: 'Scenario afronden' }).click();
      await wachtOp(n, /Geslaagd: het leerhuis legde bewijs vast voor storno/);
      await npad().getByRole('button', { name: 'Ik ga een scenario spelen' }).click();
      await wachtOp(n, /Vastgelegd: u speelt nu scenario's/);
      assert.equal((await nMijn()).PAD.find(x => x.curriculum === 'ops-basis').stand, 'SIMULATING');
      assert.doesNotMatch(await n.textContent('main'), /lid:\d+/, 'geen sleutel van een mens op het scherm');

      const page = await opScherm(T);
      const kaart = () => page.locator('#trainer .kaart', { hasText: N.code });
      const melding = (re) => wachtOp(page, re);

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
      /* De assessor begint op zijn eigen scherm: de kaart noemt de VAARDIGHEID en de
         codenaam van de leerling (eerst stond daar tweemaal de codenaam). */
      const a = await opScherm(A);
      const akaart = a.locator('#assessor .kaart', { hasText: 'Een betaling terugboeken van ' + N.code });
      await akaart.getByRole('button', { name: 'Beoordeling beginnen' }).click();
      await wachtOp(a, /U beoordeelt nu Een betaling terugboeken/);
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

      /* 4. Kwaliteit op het scherm van Q. N maakt bezwaar; het oordeel erachter
         (herstelpad) staat pas op de kaart als Q de review op zich neemt. Een
         ongeldigverklaring zonder reden weigert de server, en een beleid dat Q
         voorstelt, keurt de eigenaar goed -- Q zelf krijgt een zin en geen knop. */
      await doe(N, 'bezwaarIndienen', { beoordeling: open[0].id, reden: 'de storno was klein, het herstelpad past niet' });
      const q2 = await opScherm(Q);
      const zkaart = q2.locator('#kwaliteit .kaart', { hasText: 'Bezwaar: Een betaling terugboeken van ' + N.code });
      await zkaart.getByText('de storno was klein').waitFor();
      assert.doesNotMatch(await zkaart.textContent(), /grote storno/, 'het herstelpad staat niet op de kaart voor de review is opgepakt');
      await zkaart.getByRole('button', { name: 'Review oppakken' }).click();
      await wachtOp(q2, /Review oppakken: Een betaling terugboeken/);
      await zkaart.getByText(/Herstelpad: nog een keer onder toezicht bij een grote storno/).waitFor();
      await zkaart.getByLabel('Uw bevinding').fill('herstelpad past bij het bewijs');
      await zkaart.getByRole('button', { name: 'Het oordeel blijft staan' }).click();
      await wachtOp(q2, /Het oordeel blijft staan: Een betaling terugboeken/);
      assert.equal((await lees(Q, 'kwaliteitWerk')).BEZWAREN.length, 0, 'het bezwaar is afgehandeld');

      const okaart = q2.locator('#kwaliteit .kaart', { hasText: 'Train-the-Trainer van ' + T.code });
      await okaart.getByRole('button', { name: 'Ongeldig verklaren' }).click();
      await wachtOp(q2, /Niet gelukt: ongeldig zonder reden/);
      await okaart.getByLabel('Reden om ongeldig te verklaren').fill('de observatie is niet door een tweede mens gezien');
      await okaart.getByRole('button', { name: 'Ongeldig verklaren' }).click();
      await wachtOp(q2, /Ongeldig verklaard: Train-the-Trainer/);

      const bform = q2.locator('#kwaliteit .kaart', { hasText: 'Nieuw beleid voorstellen' });
      await bform.getByLabel(/Handeling/).fill('betaling.terugboeken');
      await bform.getByText('Een betaling terugboeken', { exact: true }).click();
      await bform.getByRole('button', { name: 'Beleid voorstellen' }).click();
      await wachtOp(q2, /Beleid voorgesteld: betaling.terugboeken/);
      const bkaart = q2.locator('#kwaliteit .kaart', { hasText: 'Beleid voor betaling.terugboeken' });
      await bkaart.getByText('U stelde dit beleid voor; een ander keurt het goed.').waitFor();
      assert.equal(await bkaart.getByRole('button', { name: 'Beleid goedkeuren' }).count(), 0, 'wie voorstelt, keurt niet goed');
      const e2 = await opScherm(E);
      assert.ok(await e2.locator('#kwaliteitBlok').isVisible(), 'de eigenaar ziet het beleid');
      assert.equal(await e2.locator('#kwaliteit .kaart', { hasText: 'Bezwaar' }).count(), 0, 'geen bezwaren voor de eigenaar');
      await e2.locator('#kwaliteit .kaart', { hasText: 'Beleid voor betaling.terugboeken' }).getByRole('button', { name: 'Beleid goedkeuren' }).click();
      await wachtOp(e2, /Beleid goedgekeurd: betaling.terugboeken/);
      assert.ok((await lees(E, 'kwaliteitWerk')).BELEID.find(b => b.handeling === 'betaling.terugboeken').goedgekeurd);
    } finally {
      if (browser) await browser.close().catch(() => {});
      await stop(child);
      try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
    }
  });
