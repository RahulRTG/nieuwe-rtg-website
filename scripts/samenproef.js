#!/usr/bin/env node
/* ============================================================================
   DE SAMENPROEF -- maakt een app een keten af met een andere app?

   Eigenaarsbesluit van 19 oktober 2026: elke app werkt LOS en SAMEN, en samen
   gaat via een VERWIJZING en nooit via gedeelde data. scripts/lib/appcontract.js
   verklaart per functie wat hij uitgeeft, ontvangt en met wie hij ketens maakt;
   scripts/lib/bewijsbron.js meet of de code die verklaring waarmaakt. Deze proef
   meet of de keten in een echte browser ook AFLOOPT -- van het aanbieden in de
   ene app tot het resultaat in de andere -- en wat er gebeurt als een schakel
   uitvalt.

   EEN REGISTER VOOR ALLE SAMEN-KETENS (SAMENPROEF.json), met per keten een eigen
   rij schakels en storingen onder `ketens.<naam>`, in de vorm van de andere
   ketenregisters (LUSPROEF.json): gesloten/openBekend/stuk en gehouden/gebroken.
   De bewijsbron leest een keten met `deel: ['ketens', naam]`.

   KETEN 1: reis-naar-agenda. Een lid ziet in Reizen een echte reis (door het
   reisbureau klaargezet en door hem opgeëist), sleept hem in de werkruimte naar
   de Agenda, krijgt een voorstel, bevestigt, en de Agenda zet hem er met haar
   eigen sessie in. Het oppakken gebeurt op de ECHTE regel van het reisscherm
   (pointerdown en een beweging op het element met data-sleep), niet met een
   nagemaakt bericht: dan meet de proef ook wat Reizen werkelijk aanbiedt.

   Gebruik: node scripts/samenproef.js [--vastleggen]
   Overgeslagen (afsluitcode 2, niets geschreven) zonder browser.
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { stempel: huisStempel, eisSchoneBoom, magSchrijven } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'SAMENPROEF.json');

function teller() {
  const schakels = [], storingen = [];
  return {
    schakels, storingen,
    schakel: (nr, wat, ok, detail) => schakels.push({ nr, wat, stand: ok === 'open' ? 'openBekend' : (ok ? 'gesloten' : 'stuk'), detail: String(detail || '') }),
    storing: (nr, wat, ok, detail) => storingen.push({ nr, wat, stand: ok ? 'gehouden' : 'gebroken', detail: String(detail || '') })
  };
}

function afsluiten(t) {
  const telling = { schakels: t.schakels.length, gesloten: 0, openBekend: 0, stuk: 0, storingen: t.storingen.length, gehouden: 0, gebroken: 0 };
  for (const x of t.schakels.concat(t.storingen)) telling[x.stand] = (telling[x.stand] || 0) + 1;
  const sluitMetBevinding = telling.stuk === 0 && telling.gebroken === 0;
  return { schakels: t.schakels, storingen: t.storingen, telling, sluitMetBevinding, sluit: sluitMetBevinding && telling.openBekend === 0 };
}

const wacht = (ms) => new Promise((k) => setTimeout(k, ms));
/* Staat de afspraak in de KALENDER van het agendascherm? In de lijstweergave
   (dertig dagen vooruit) en alleen in #kal: de melding "Toegevoegd: ..." is
   geen bewijs dat het lid de afspraak terugvindt. */
async function inKalender(frame, label) {
  if (!frame || !label) return false;
  try {
    await frame.click('#wLijst');
    for (let i = 0; i < 20; i++) {
      const ja = await frame.evaluate((l) => { const k = document.querySelector('#kal'); return !!k && k.innerText.includes(l); }, label);
      if (ja) return true;
      await wacht(250);
    }
  } catch (e) { /* frame weg of knop niet te klikken: niet gezien */ }
  return false;
}

/* Een werkruimte voor een lid, met Reizen, Agenda en een derde surface die de
   soort niet kent (zonder die derde is "zwijgen is nee" niet te meten). */
async function werkruimte(browser, base, tok) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  const fouten = [];
  page.on('pageerror', (e) => fouten.push(String(e.message || e).slice(0, 160)));
  await page.goto(base + '/apps/werkruimte.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate((tk) => {
    localStorage.setItem('rtg_member_token', tk);
    localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
  }, tok);
  await page.goto(base + '/apps/werkruimte.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.rtg-surface[data-id="agenda"]', { state: 'attached', timeout: 20000 });
  /* Een derde surface die de soort niet kent: zonder hem is "zwijgen is nee"
     niet te meten. */
  await page.evaluate(() => RTGSchil.open('office', { naam: 'Documenten', url: '/apps/office.html', kort: 'Documenten' }));
  await page.waitForSelector('body[data-rtg-desktop-state="ready"]', { timeout: 20000 }).catch(() => {});
  for (let i = 0; i < 60; i++) {
    const klaar = page.frames().some((f) => f.url().includes('/apps/reizen.html')) &&
      page.frames().some((f) => f.url().includes('/apps/agenda.html'));
    if (klaar) break;
    await wacht(250);
  }
  await wacht(1500);
  const frame = (pad) => page.frames().find((f) => f.url().includes(pad));
  /* Wat de agenda ONTVANGT, onderschept in haar eigen venster. */
  const agenda = frame('/apps/agenda.html');
  if (agenda) await agenda.evaluate(() => { window.__samen = []; window.addEventListener('message', (e) => window.__samen.push(e.data)); });
  return { ctx, page, fouten, frame };
}

/* ---- KETEN 1: een reis uit Reizen wordt een afspraak in de Agenda ------- */
async function reisNaarAgenda({ pw, browserOpties, base, api }) {
  const t = teller();
  const dag = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const nieuwLid = async (naam) => {
    const u = naam.toLowerCase() + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const r = await api('/api/auth/register', { name: naam, email: u + '@samen.test',
      phone: '06' + String(Date.now()).slice(-8), password: 'geheim123', geboortedatum: '1985-05-05', tier: 'rtg' });
    if (!r.body || !r.body.token) throw new Error('registreren mislukte voor ' + naam + ': ' + JSON.stringify(r.body).slice(0, 160));
    return r.body.token;
  };
  const A = await nieuwLid('Anouk'), B = await nieuwLid('Bas');

  /* Een ECHTE reis, langs de voordeur: het reisbureau zet hem klaar, A eist hem op. */
  const kantoor = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  const van = dag(30);
  const zet = await api('/api/office/reisbureau/klaarzetten', { onderdelen: [
    { soort: 'verblijf', titel: 'Hotel Aurora', bestemming: 'Lissabon', van, tot: dag(34), kenmerk: 'SAMEN1', herkomst: 'document' }
  ] }, kantoor);
  const code = zet.body && zet.body.link ? zet.body.link.split('code=')[1] : null;
  const eis = code ? await api('/api/reis/uitnodiging/eisop', { code }, A) : { status: 0 };
  const reizen = (await api('/api/reis/reizen', {}, A)).body;
  const reisId = reizen && reizen.reizen && reizen.reizen[0] ? reizen.reizen[0].id : null;
  const lijst = async (tok) => ((await api('/api/agenda/mijn-lijst', {}, tok)).body.items || []);

  const browser = await pw.chromium.launch(browserOpties(pw));
  try {
    const open = (tok) => werkruimte(browser, base, tok);
    const lichtOp = (page, ms) => page.waitForSelector('.rtg-surface[data-id="agenda"][data-kan-vangen]', { timeout: ms || 8000 }).then(() => true, () => false);
    const loslatenOpAgenda = async (page) => {
      const doos = await page.evaluate(() => {
        const el = document.querySelector('.rtg-surface[data-id="agenda"] .rtg-handle') || document.querySelector('.rtg-surface[data-id="agenda"]');
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + Math.min(r.height / 2, 20)) };
      });
      await page.mouse.move(doos.x, doos.y);
      await page.waitForSelector('.rtg-surface[data-id="agenda"][data-vangt]', { timeout: 3000 }).catch(() => {});
      await page.mouse.up();
      return page.waitForSelector('.rtg-voorstel[data-aan]', { timeout: 8000 }).then(() => true, () => false);
    };
    /* Oppakken op de ECHTE regel: pointerdown op het element en een beweging
       van meer dan acht pixels, zoals reizen.html dat zelf als sleep herkent. */
    const pakEchteRegel = (reisFrame) => reisFrame.evaluate(() => {
      const a = document.querySelector('[data-sleep="reis"]');
      if (!a) return null;
      const r = a.getBoundingClientRect();
      const x = r.left + 10, y = r.top + 10;
      a.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
      document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x + 30, clientY: y + 5, pointerId: 1 }));
      document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x + 30, clientY: y + 5, pointerId: 1 }));
      return { id: a.dataset.sleepId, label: a.dataset.sleepLabel, datum: a.dataset.sleepDatum };
    });
    const stuurUitFrame = (f, object) => f.evaluate((o) => window.parent.postMessage({ rtg: 'sleep-start', object: o }, location.origin), object);

    /* ===== A: de keten ===== */
    const a = await open(A);
    const reisFrame = a.frame('/apps/reizen.html');
    let regel = null;
    for (let i = 0; i < 20 && reisFrame; i++) {
      regel = await reisFrame.evaluate(() => { const el = document.querySelector('[data-sleep="reis"]'); return el ? el.dataset.sleepLabel : null; }).catch(() => null);
      if (regel) break;
      await wacht(500);
    }
    t.schakel(1, 'Reizen toont de echte reis van het lid als sleepbare regel (soort reis, met datum)',
      !!regel && !!reisId, regel ? 'regel "' + regel + '"' : 'geen regel met data-sleep="reis" (klaarzetten ' + (zet.status) + ', opeisen ' + eis.status + ', reis ' + (reisId || 'geen') + ')');

    const gepakt = regel ? await pakEchteRegel(reisFrame) : null;
    const opgelicht = gepakt ? await lichtOp(a.page) : false;
    const lichtende = await a.page.evaluate(() => [...document.querySelectorAll('.rtg-surface[data-kan-vangen]')].map((e) => e.dataset.id));
    t.schakel(2, 'het oppakken in Reizen laat alleen de Agenda oplichten; de surface die geen reis kent zwijgt',
      opgelicht && lichtende.length === 1 && lichtende[0] === 'agenda', 'oplichtend: ' + JSON.stringify(lichtende));

    const voorstel = opgelicht ? await loslatenOpAgenda(a.page) : false;
    const voorstelTekst = voorstel ? await a.page.textContent('.rtg-voorstel .wat') : '';
    const voorNiets = (await lijst(A)).length === 0;
    t.schakel(3, 'loslaten op de Agenda geeft een voorstel dat zegt welk object en wat er gebeurt -- en er staat nog niets',
      voorstel && gepakt && voorstelTekst.includes(gepakt.label) && voorNiets, (voorstelTekst || 'geen voorstel') + (voorNiets ? '' : ' -- maar er stond al iets'));

    if (voorstel) {
      await a.page.click('.rtg-voorstel [data-doe="nee"]');
      await a.page.waitForSelector('.rtg-voorstel[data-aan]', { state: 'hidden', timeout: 5000 }).catch(() => {});
    }
    await wacht(800);
    t.schakel(4, 'annuleren laat de agenda zoals hij was', voorstel && (await lijst(A)).length === 0, (await lijst(A)).length + ' afspraken na annuleren');

    /* Bevestigen. */
    let items = [];
    if (regel) {
      await pakEchteRegel(reisFrame);
      if (await lichtOp(a.page) && await loslatenOpAgenda(a.page)) {
        await a.page.click('.rtg-voorstel [data-doe="ja"]');
        for (let i = 0; i < 25 && !items.length; i++) { items = await lijst(A); if (!items.length) await wacht(300); }
      }
    }
    t.schakel(5, 'na bevestigen zet de Agenda er met haar eigen sessie precies een afspraak in, met de titel en datum die Reizen toonde',
      items.length === 1 && gepakt && items[0].titel === gepakt.label && items[0].datum === gepakt.datum,
      items.length + ' afspraak/afspraken' + (items[0] ? ': "' + items[0].titel + '" op ' + items[0].datum : ''));

    const ontvangen = a.frame('/apps/agenda.html') ? await a.frame('/apps/agenda.html').evaluate(() => window.__samen || []) : [];
    const doe = ontvangen.filter((m) => m && m.rtg === 'sleep-doe');
    t.schakel(6, 'de Agenda kreeg pas NA de bevestiging een opdracht, en een keer',
      doe.length === 1, doe.length + ' keer sleep-doe ontvangen');

    await wacht(1200);
    const zichtbaar = await inKalender(a.frame('/apps/agenda.html'), gepakt && gepakt.label);
    t.schakel(7, 'het lid vindt de afspraak terug in de kalender van het agendascherm (lijstweergave)', zichtbaar,
      zichtbaar ? 'staat in de kalender' : 'niet in #kal van het agendascherm');

    /* ===== storingen ===== */
    /* 1. De schakel Agenda valt uit: zijn toevoegroute antwoordt 503. */
    await a.ctx.route('**/api/agenda/toevoegen', (r) => r.fulfill({ status: 503, contentType: 'application/json',
      body: JSON.stringify({ error: 'De agenda is even niet bereikbaar.' }) }));
    const voorStoring = (await lijst(A)).length;
    let melding = '';
    if (regel) {
      await pakEchteRegel(reisFrame);
      if (await lichtOp(a.page) && await loslatenOpAgenda(a.page)) {
        await a.page.click('.rtg-voorstel [data-doe="ja"]');
        await wacht(1500);
        melding = await a.frame('/apps/agenda.html').evaluate(() => { const m = document.querySelector('#melding'); return m ? m.textContent : ''; }).catch(() => '');
      }
    }
    const naStoring = (await lijst(A)).length;
    const reisNogBruikbaar = regel ? (await pakEchteRegel(reisFrame), await lichtOp(a.page)) : false;
    if (reisNogBruikbaar) { await a.page.mouse.up(); await a.page.keyboard.press('Escape').catch(() => {}); }
    t.storing(1, 'valt de Agenda uit, dan komt er geen afspraak bij, zegt de Agenda het in woorden, en blijft Reizen bruikbaar',
      naStoring === voorStoring && /niet bereikbaar|lukte niet/i.test(melding) && reisNogBruikbaar,
      'afspraken ' + voorStoring + ' -> ' + naStoring + '; melding "' + melding + '"; Reizen daarna ' + (reisNogBruikbaar ? 'nog bruikbaar' : 'NIET bruikbaar'));
    await a.ctx.unroute('**/api/agenda/toevoegen');
    await a.page.evaluate(() => { const v = document.querySelector('.rtg-voorstel [data-doe="nee"]'); if (v) v.click(); });

    /* 2. De schakel Reizen valt uit: de reisroutes antwoorden 503. De Agenda
          laadt dan gewoon, en geen van beide gooit een kale fout. */
    const c = await (async () => {
      const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
      await ctx.route('**/api/reis/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Reizen is even niet bereikbaar.' }) }));
      const page = await ctx.newPage();
      const fouten = [];
      page.on('pageerror', (e) => fouten.push(String(e.message || e).slice(0, 160)));
      await page.goto(base + '/apps/werkruimte.html', { waitUntil: 'domcontentloaded' });
      await page.evaluate((tk) => { localStorage.setItem('rtg_member_token', tk); localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, A);
      await page.goto(base + '/apps/werkruimte.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.rtg-surface[data-id="agenda"]', { state: 'attached', timeout: 20000 }).catch(() => {});
      await wacht(4000);
      const ag = page.frames().find((f) => f.url().includes('/apps/agenda.html'));
      const agendaLeeft = await inKalender(ag, gepakt && gepakt.label);
      await ctx.close();
      return { agendaLeeft, fouten };
    })();
    t.storing(2, 'valt Reizen uit, dan laadt de Agenda gewoon met wat er al stond, zonder kale fout',
      c.agendaLeeft && c.fouten.length === 0, (c.agendaLeeft ? 'agenda toont de afspraak' : 'agenda toont niets') + '; ' + c.fouten.length + ' kale fout(en)' + (c.fouten[0] ? ': ' + c.fouten[0] : ''));

    /* 3. Een reis zonder datum: de Agenda kan er niets mee en zegt dus niets. */
    let zonderDatum = null;
    if (reisFrame) {
      await stuurUitFrame(reisFrame, { soort: 'reis', id: 'ZONDER', label: 'Reis zonder datum', velden: {} });
      zonderDatum = await lichtOp(a.page, 2500);
      await a.page.mouse.up();
    }
    t.storing(3, 'een reis zonder bruikbare datum laat de Agenda niet oplichten: geen loze belofte', zonderDatum === false,
      zonderDatum ? 'de Agenda lichtte toch op' : 'geen aanbod');

    /* 4. Een bericht uit het topvenster is geen surface en start niets. */
    await a.page.evaluate((d) => window.postMessage({ rtg: 'sleep-start', object: { soort: 'reis', id: 'TOP', label: 'Uit het topvenster', velden: { datum: d } } }, location.origin), van);
    const uitTop = await lichtOp(a.page, 2500);
    await a.page.mouse.up();
    t.storing(4, 'een verwijzing die niet uit een surface komt, start geen sleep', !uitTop, uitTop ? 'de Agenda lichtte op' : 'genegeerd');

    /* 5. Een verzender die een dossier in de verwijzing propt: de schil kapt af. */
    const voor = (await a.frame('/apps/agenda.html').evaluate(() => (window.__samen || []).length));
    const velden = {}; for (let i = 0; i < 12; i++) velden['v' + i] = 'x'.repeat(300);
    velden.datum = van;
    await stuurUitFrame(reisFrame, { soort: 'reis', id: 'DOSSIER', label: 'L'.repeat(400), paspoort: 'NL1234567', velden });
    await lichtOp(a.page, 4000);
    await a.page.mouse.up();
    const kreeg = (await a.frame('/apps/agenda.html').evaluate(() => window.__samen || [])).slice(voor).filter((m) => m && m.rtg === 'sleep-kan').map((m) => m.object);
    const o = kreeg[0] || {};
    const schoon = kreeg.length > 0 && JSON.stringify(Object.keys(o).sort()) === JSON.stringify(['id', 'label', 'soort', 'velden']) &&
      !('paspoort' in o) && String(o.label).length <= 120 && Object.keys(o.velden || {}).length <= 8;
    t.storing(5, 'een dossier in de verwijzing komt niet aan: de Agenda krijgt alleen soort, id, label en hooguit acht korte velden',
      schoon, kreeg.length ? 'ontvangen sleutels ' + Object.keys(o).join(',') + ', label ' + String(o.label).length + ' tekens, ' + Object.keys(o.velden || {}).length + ' velden' : 'niets ontvangen');

    /* 6. Bevoegd: de verwijzing van A opent niets voor B. B's agenda blijft
          leeg, en met het id uit de verwijzing (of het echte reis-id) komt B
          niet bij A's reis. */
    const bLijst = await lijst(B);
    const metKenmerk = await api('/api/reis/gezelschap/reis', { reis: gepakt ? gepakt.id : 'SAMEN1' }, B);
    const metId = reisId ? await api('/api/reis/gezelschap/reis', { reis: reisId }, B) : { status: 0 };
    const aZelf = reisId ? await api('/api/reis/gezelschap/reis', { reis: reisId }, A) : { status: 0 };
    const lek = JSON.stringify(metKenmerk.body || {}).includes('Lissabon') || JSON.stringify(metId.body || {}).includes('Lissabon');
    t.storing(6, 'de verwijzing van lid A opent niets voor lid B: geen afspraak bij B, en A\'s reis blijft dicht met het id uit de verwijzing',
      bLijst.length === 0 && metKenmerk.status !== 200 && metId.status !== 200 && !lek,
      'B: ' + bLijst.length + ' afspraken; reis met kenmerk ' + metKenmerk.status + ', met id ' + metId.status + (lek ? ', en de bestemming LEKT' : '') +
        ' (A zelf: ' + aZelf.status + ')');

    t.storing(7, 'de hele keten loopt zonder kale JS-fout in de werkruimte', a.fouten.length === 0,
      a.fouten.length ? a.fouten.length + ' fout(en): ' + a.fouten[0] : 'geen');
    await a.ctx.close();
  } finally {
    await browser.close().catch(() => {});
  }
  return afsluiten(t);
}

/* ---- KETEN 2: de contextbus naar de Agenda --------------------------------
   Kiest iemand een reis, dan stuurt de schil de verwijzing rond
   (rtg-schil/05-context.js) en volgt de Agenda: ze zoekt in de EIGEN afspraken
   en springt naar de dag. Geen enkele app stuurt vandaag context; de proef zet
   hem met RTGSchil.context, de API van de console. Schakel 1 staat daarom open
   met de reden: zonder afzender is de keten niet af. */
async function contextNaarAgenda({ pw, browserOpties, base, api }) {
  const t = teller();
  const nieuwLid = async (naam) => {
    const u = naam.toLowerCase() + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const r = await api('/api/auth/register', { name: naam, email: u + '@samen.test',
      phone: '06' + String(Date.now()).slice(-8), password: 'geheim123', geboortedatum: '1985-05-05', tier: 'rtg' });
    if (!r.body || !r.body.token) throw new Error('registreren mislukte voor ' + naam);
    return r.body.token;
  };
  const A = await nieuwLid('Carla'), B = await nieuwLid('Daan');
  const d = new Date(); d.setDate(d.getDate() + 21);
  const datum = d.toISOString().slice(0, 10);
  const LABEL = 'Hotel Aurora naar Lissabon';
  await api('/api/agenda/toevoegen', { titel: LABEL, datum }, A);
  const REF = { soort: 'reis', id: 'SAMEN1', label: LABEL };

  const browser = await pw.chromium.launch(browserOpties(pw));
  try {
    const volg = async (w) => w.page.evaluate(() => { window.__volgt = []; window.addEventListener('message', (e) => { if (e.data && e.data.rtg === 'context-volgt') window.__volgt.push(e.data); }); });
    const stand = async (w) => w.frame('/apps/agenda.html').evaluate(() => ({ context: document.body.dataset.context || null,
      regel: (document.querySelector('#agendaContext') || {}).textContent || '', kal: (document.querySelector('#kal') || {}).innerText || '' }));
    const volgden = (w) => w.page.evaluate(() => window.__volgt || []);
    const zet = (w, ref) => w.page.evaluate((r) => RTGSchil.context(r), ref);
    const wachtOp = async (fn, ms) => { for (let i = 0; i < (ms || 6000) / 250; i++) { if (await fn()) return true; await wacht(250); } return false; };

    t.schakel(1, 'een app in de werkruimte stuurt de gekozen reis als context', 'open',
      'geen enkele app stuurt vandaag {rtg: \'context\'}; de proef zet de context met RTGSchil.context (de console-API)');

    const a = await werkruimte(browser, base, A);
    await volg(a);
    await zet(a, REF);
    const gevolgd = await wachtOp(async () => (await stand(a)).context === REF.id);
    const sa = await stand(a);
    t.schakel(2, 'de Agenda lost de verwijzing op met haar eigen afspraken en springt naar de dag van de reis',
      gevolgd && sa.kal.includes(LABEL) && /Context: 1 afspraak/.test(sa.regel), (sa.regel || 'geen contextregel') + (sa.kal.includes(LABEL) ? '; de afspraak staat in beeld' : '; de afspraak staat NIET in beeld'));
    const v = await volgden(a);
    t.schakel(3, 'de Agenda meldt de schil dat ze volgt, met wat ze doet en zonder gegevens',
      v.length === 1 && v[0].id === REF.id && Object.keys(v[0]).sort().join() === 'id,rtg,soort,wat', JSON.stringify(v).slice(0, 200));
    await zet(a, null);
    const weg = await wachtOp(async () => (await stand(a)).context === null);
    const na = await stand(a);
    t.schakel(4, 'context weg (null) zet de Agenda terug zoals ze was', weg && !na.regel, weg ? 'contextregel weg' : 'context bleef staan');

    /* ===== storingen ===== */
    /* Elke storing begint zonder context. Een soort die de Agenda niet kent zet
       haar volgens het contract terug -- ook als `null` (schakel 4) niet
       aankomt -- zodat de ene storing de volgende niet kleurt. */
    const reset = async (w) => { await zet(w, { soort: 'leeg', id: 'reset', label: '' }); await wachtOp(async () => (await stand(w)).context === null, 3000); };
    await reset(a);
    const volgdenVoor = (await volgden(a)).length;
    await zet(a, { soort: 'factuur', id: 'F1', label: LABEL });
    const onbekend = await wachtOp(async () => (await stand(a)).context !== null, 2500);
    t.storing(1, 'een soort die de Agenda niet kent: ze zwijgt en toont niets', !onbekend && (await volgden(a)).length === volgdenVoor,
      onbekend ? 'de Agenda volgde toch' : 'gezwegen');

    await reset(a);
    /* Een context die niet van de schil komt maar uit een ander frame. */
    const reis = a.frame('/apps/reizen.html');
    if (reis) await reis.evaluate((r) => {
      const f = [...window.parent.document.querySelectorAll('iframe')].find((x) => x.src.includes('/apps/agenda.html'));
      if (f) f.contentWindow.postMessage({ rtg: 'context', ref: r }, location.origin);
    }, REF);
    const vreemd = await wachtOp(async () => (await stand(a)).context !== null, 2500);
    t.storing(2, 'een context uit een ander venster dan de schil wordt niet gehoord', !!reis && !vreemd, vreemd ? 'de Agenda volgde een buurframe' : 'genegeerd');

    await reset(a);
    /* De Agenda kan haar eigen lijst niet lezen: zwijgen, geen kale fout. */
    await a.ctx.route('**/api/agenda/mijn-lijst', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'even niet' }) }));
    await zet(a, REF);
    const zonderLijst = await wachtOp(async () => (await stand(a)).context !== null, 2500);
    await a.ctx.unroute('**/api/agenda/mijn-lijst');
    t.storing(3, 'kan de Agenda haar eigen afspraken niet lezen, dan volgt ze niet en gooit ze niets', !zonderLijst && a.fouten.length === 0,
      (zonderLijst ? 'volgde toch' : 'gezwegen') + '; ' + a.fouten.length + ' kale fout(en)');
    await zet(a, null);

    /* Bevoegd: dezelfde verwijzing in de werkruimte van B opent niets. */
    const b = await werkruimte(browser, base, B);
    await volg(b);
    await zet(b, REF);
    const bVolgt = await wachtOp(async () => (await stand(b)).context !== null, 3000);
    const sb = await stand(b);
    t.storing(4, 'de verwijzing van lid A opent niets voor lid B: B\'s Agenda zwijgt en toont niets van A',
      !bVolgt && !sb.kal.includes(LABEL) && (await volgden(b)).length === 0, bVolgt ? 'B volgde' : 'B zweeg' + (sb.kal.includes(LABEL) ? ', maar A\'s afspraak STAAT in beeld' : ''));
    t.storing(5, 'geen kale JS-fout in de werkruimte', a.fouten.length === 0 && b.fouten.length === 0,
      (a.fouten[0] || b.fouten[0] || 'geen'));
    await a.ctx.close(); await b.ctx.close();
  } finally {
    await browser.close().catch(() => {});
  }
  return afsluiten(t);
}

const KETENS = { 'reis-naar-agenda': reisNaarAgenda, 'context-naar-agenda': contextNaarAgenda };

if (require.main === module) (async () => {
  const vastleggen = process.argv.includes('--vastleggen');
  const poort = vastleggen ? eisSchoneBoom('samenproef') : { ok: true };
  if (!poort.ok) { console.error(poort.reden); process.exit(2); }
  const helper = require(path.join(WORTEL, 'test', 'helper.js'));
  const pw = helper.laadPlaywright();
  if (helper.geenBrowser(pw)) { console.error('  geen browser: de samenproef is niet gedraaid en er is niets geschreven'); process.exit(2); }
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-samenproef-'));
  const srv = await helper.startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const api = (pad, body, token) => fetch(srv.base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const uit = {};
  try {
    for (const [naam, keten] of Object.entries(KETENS)) uit[naam] = await keten({ pw, browserOpties: helper.browserOpties, base: srv.base, api });
  } finally {
    try { await helper.stopHard(srv.child); } catch (e) { try { helper.stop(srv); } catch (x) { /* weg */ } }
    fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
  let stuk = 0;
  for (const [naam, k] of Object.entries(uit)) {
    console.log('\n  DE SAMENPROEF -- ' + naam + '\n');
    for (const x of k.schakels) console.log('  ' + (x.stand === 'gesloten' ? '  ok ' : x.stand === 'openBekend' ? ' open' : 'BREEK') + '  ' + String(x.nr).padStart(2) + '. ' + x.wat + '\n          ' + x.detail);
    console.log('\n  STORINGEN\n');
    for (const x of k.storingen) console.log('  ' + (x.stand === 'gehouden' ? '  ok ' : 'BREEK') + '  ' + String(x.nr).padStart(2) + '. ' + x.wat + '\n          ' + x.detail);
    console.log('\n  ' + k.telling.gesloten + ' van ' + k.telling.schakels + ' schakels gesloten; ' + k.telling.gehouden + ' van ' + k.telling.storingen + ' storingen gehouden.');
    stuk += k.telling.stuk + k.telling.gebroken;
  }
  if (vastleggen) {
    const reg = {
      stempel: huisStempel(),
      uitleg: 'Modus SAMEN (eigenaarsbesluit 19 oktober 2026): ketens die een app met een andere app afmaakt via een verwijzing, gemeten in een echte browser per SCHAKEL en per STORING. Een keten per sleutel onder `ketens`; de verklaring staat in scripts/lib/appcontract.js (SAMEN, KETENS_ZONDER_APP).',
      grens: 'Een browser, de werkruimte met drie surfaces, twee leden en het reisbureau voor een echte reis. Het oppakken gebeurt met pointer-events op de echte regel in het frame (een muissleep over de framegrens is in een headless browser niet betrouwbaar); het loslaten, het voorstel en de bevestiging met de muis in de werkruimte. Geen herstart en geen crash: dat is herstelbaar, en dat meet deze proef niet.',
      ketens: uit
    };
    if (magSchrijven(eisSchoneBoom('samenproef'), DOEL)) { fs.writeFileSync(DOEL, JSON.stringify(reg, null, 2) + '\n'); console.log('\n  geschreven: SAMENPROEF.json'); }
  }
  process.exit(stuk ? 1 : 0);
})().catch((e) => { console.error('\n  DE PROEF ZELF IS STUK:', e && e.stack || e, '\n'); process.exit(2); });

module.exports = { KETENS, afsluiten, teller };
