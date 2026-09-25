#!/usr/bin/env node
/* ============================================================================
   DE BEVOEGDRONDE -- bewijs 6 (bevoegd) over elk onderdeel uit MAPPEN.

   WAAROM. BETROUWBAARHEID.md rij 6 vraagt: kan een andere rol, een ander gezin
   of een ander bedrijf hier niets? Par. 4f heeft eerst GEMETEN of de schermkant
   daar iets over kan zeggen, en de uitslag splitst de rijen in tweeen:

     LEDENSCHERMEN noemen geen object van hun eigenaar bij id -- niet bij het
       laden (0 van 85 met een vers account, 4 met alle werelden) en niet na de
       tikken van bedienbaar (1 scherm, en dat waren toevallige getallen). Ze
       bakenen af op de SESSIE. Of een vreemde bij andermans object kan, is daar
       een ROUTEvraag, en die meten twee registers al: IDOR.json (zelfde rol,
       ander lid, met A's ids) en ROLPROEF.json (verkeerde rol op een
       schrijfroute). Deze ronde STELT SAMEN: een ledenscherm is bevoegd-BEWEZEN
       als elke route die het scherm aanroept in IDOR.json gemeten is, en elke
       schrijfroute daarvan ook in ROLPROEF.json, allebei vers.
     GEZINSSCHERMEN noemen hun gezinscode wel in het verzoek, dus daar heeft een
       kruisproef aan de schermkant een onderwerp. Deze ronde LOOPT die: gezin A
       opent het scherm, en elk verzoek dat A's code draagt wordt nagespeeld met
       het token van gezin B (A's code blijft staan) en zonder token.

   DE OORDELEN, per rij:
     BEWEZEN        ledenscherm: elke route gemeten en niets gebroken;
                    gezinsscherm: minstens een kruispaar, en B en anoniem werden
                    bij elk paar geweigerd terwijl A binnenkwam.
     DEFECT         een doorbraak of lek in IDOR.json, een open deur in
                    ROLPROEF.json, of een gezinspaar waarin B met A's code 2xx
                    kreeg. Een DEFECT hoort met de hand nagekeken te worden,
                    zoals IDOR.json dat voor zijn eigen kandidaten doet.
     NIET_GETEST    al het andere, met de reden: een route die in geen van de
                    registers staat (met naam), een scherm zonder routes of
                    zonder eigen adres, een register dat niet vers is, een
                    gezinsscherm dat zijn code niet noemt, en elke rij van een
                    persona waarvoor deze ronde geen proef heeft (zaak, kantoor).

   WAT DIT NIET BEWIJST, en dat staat in elke uitslag: dynamische paden die het
   scherm aan elkaar plakt ('/api/x/' + id) zijn per voorvoegsel niet volledig te
   kennen; een voorvoegsel telt als gemeten als ELKE bekende route eronder
   gemeten is. En een ledenroute die in IDOR.json `publiek` heet, gaf B hetzelfde
   met en zonder A's id -- dat is geen doorbraak, maar ook geen bewijs dat de
   route iets afschermt dat afgeschermd hoort te zijn.

   Draai: node scripts/bevoegdronde.js               (meet, schrijft niets)
          node scripts/bevoegdronde.js --vastleggen  (schrijft BEVOEGD.json)
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'BEVOEGD.json');
const { stempel, versheid } = require('./lib/stempel');
const { ingangRoutes } = require('./lib/bewijsbron');

const GRENS_LID = 'samengesteld uit IDOR.json en ROLPROEF.json per route die het scherm aanroept; een voorvoegsel telt als ' +
  'gemeten als elke bekende route eronder gemeten is, en een route die IDOR `publiek` noemt schermt niets af';
const GRENS_GEZIN = 'alleen de verzoeken die het scherm bij het laden doet en die de gezinscode dragen; B krijgt A\'s code met ' +
  'B\'s eigen token';

/* ---- DE LEDENKANT: SAMENSTELLEN --------------------------------------------- */

/* De twee registers als opzoektabel per PAD (methode los), met hun versheid.
   Een register dat niet vers is, maakt elke ledenrij NIET_GETEST: vervallen
   bewijs is geen bewijs, ook niet als het er netjes uitziet. */
function laadRegisters({ lees, vers } = {}) {
  const l = lees || ((f) => { try { return fs.readFileSync(path.join(WORTEL, f), 'utf8'); } catch (e) { return null; } });
  const v = vers || versheid;
  const uit = { idor: new Map(), rol: new Map(), vervallen: [] };
  for (const [naam, zet] of [['IDOR.json', 'idor'], ['ROLPROEF.json', 'rol']]) {
    const t = l(naam);
    if (t === null) { uit.vervallen.push(naam + ' bestaat niet'); continue; }
    let reg; try { reg = JSON.parse(t); } catch (e) { uit.vervallen.push(naam + ' is geen geldige JSON'); continue; }
    const s = reg.stempel && typeof reg.stempel === 'object' ? v(reg.stempel) : { vers: false, reden: 'geen stempel met commit' };
    if (!s.vers) uit.vervallen.push(naam + ': ' + s.reden);
    if (zet === 'idor') {
      for (const [k, w] of Object.entries(reg.perRoute || {})) {
        const [methode, pad] = k.split(' ');
        const lijst = uit.idor.get(pad) || []; lijst.push({ methode, staat: w.staat }); uit.idor.set(pad, lijst);
      }
    } else {
      for (const w of reg.perRoute || []) {
        const lijst = uit.rol.get(w.pad) || []; lijst.push({ methode: w.methode, acl: w.acl, privacy: w.privacy }); uit.rol.set(w.pad, lijst);
      }
    }
  }
  return uit;
}

const IDOR_GEMETEN = new Set(['gescheiden', 'nagekeken', 'publiek']);
const IDOR_GEBROKEN = new Set(['doorbraak', 'lek']);

/* Het oordeel over een pad: gebroken, gemeten of open -- met de reden. Een
   schrijfroute (ROLPROEF kent hem) moet in BEIDE registers staan: IDOR zegt of
   een ander lid erbij kan, ROLPROEF of een andere rol het kan. */
function padOordeel(pad, reg) {
  const i = reg.idor.get(pad) || [];
  const r = reg.rol.get(pad) || [];
  const breuk = i.find((x) => IDOR_GEBROKEN.has(x.staat));
  if (breuk) return { stand: 'gebroken', reden: pad + ' staat in IDOR.json als ' + breuk.staat };
  const open = r.find((x) => x.acl !== 'dicht' || x.privacy !== 'schoon');
  if (open) return { stand: 'gebroken', reden: pad + ' staat in ROLPROEF.json met acl ' + open.acl + ' en privacy ' + open.privacy };
  const idorGemeten = i.some((x) => IDOR_GEMETEN.has(x.staat));
  if (!idorGemeten) return { stand: 'open', reden: pad + (i.length ? ' is in IDOR.json ' + i.map((x) => x.staat).join('/') : ' staat niet in IDOR.json') };
  return { stand: 'gemeten' };
}

function ledenOordeel(rij, reg, { schermroutes, lees } = {}) {
  if (reg.vervallen.length) return { status: 'NIET_GETEST', reden: 'bewijs vervallen: ' + reg.vervallen.join('; ') };
  const ing = ingangRoutes(rij.ingang, { schermroutes, lees });
  if (!ing) return { status: 'NIET_GETEST', reden: 'geen eigen adres: een stand of kiezer binnen de ledenapp' };
  const paden = [...ing.exact];
  /* Een voorvoegsel is een pad dat het scherm zelf aan elkaar plakt. Het telt
     alleen als ELKE route die de registers eronder kennen gemeten is; kennen ze
     er geen, dan is het voorvoegsel open. */
  for (const v of ing.voor) {
    const onder = new Set([...reg.idor.keys(), ...reg.rol.keys()].filter((p) => p.startsWith(v)));
    if (!onder.size) paden.push(v + '*');
    else for (const p of onder) paden.push(p);
  }
  if (!paden.length) return { status: 'NIET_GETEST', reden: 'het scherm roept zelf geen route aan; er is niets te kruisen' };
  const oordelen = [...new Set(paden)].sort().map((p) => (p.endsWith('*')
    ? { stand: 'open', reden: p + ': de registers kennen geen route onder dit voorvoegsel' } : padOordeel(p, reg)));
  const gebroken = oordelen.filter((o) => o.stand === 'gebroken');
  if (gebroken.length) return { status: 'GEBLOKKEERD_DOOR_DEFECT', reden: gebroken[0].reden, routes: paden.length };
  const open = oordelen.filter((o) => o.stand === 'open');
  if (open.length) {
    return { status: 'NIET_GETEST', routes: paden.length, open: open.length,
      reden: open.length + ' van de ' + paden.length + ' routes niet gemeten, o.a. ' + open.slice(0, 3).map((o) => o.reden).join('; ') };
  }
  return { status: 'BEWEZEN', routes: paden.length, reden: 'alle ' + paden.length + ' routes van het scherm gemeten: ' + GRENS_LID };
}

/* ---- DE GEZINSKANT: KRUISEN --------------------------------------------------

   Een paar is een verzoek van A dat A's code draagt, drie keer nagespeeld: als
   A (moet binnenkomen, anders zegt het paar niets), als B met A's code, en
   zonder token. */
function paarOordeel({ a, b, anoniem }) {
  const ok = (s) => s >= 200 && s < 300;
  if (!ok(a)) return 'eigenaarWeg';
  if (ok(b)) return 'lek';
  if (ok(anoniem)) return 'openbaar';
  return 'gescheiden';
}

function gezinOordeel(paren) {
  if (!paren.length) return { status: 'NIET_GETEST', reden: 'het scherm noemde de gezinscode in geen enkel verzoek; er viel niets te kruisen' };
  const lek = paren.filter((p) => p.uitslag === 'lek');
  if (lek.length) return { status: 'GEBLOKKEERD_DOOR_DEFECT', reden: 'gezin B kreeg ' + lek[0].verzoek + ' met de code van gezin A (' + lek[0].b + ')', paren: paren.length };
  const gescheiden = paren.filter((p) => p.uitslag === 'gescheiden');
  if (!gescheiden.length) return { status: 'NIET_GETEST', paren: paren.length,
    reden: 'geen enkel paar waarin A binnenkwam en de anderen niet (' + paren.map((p) => p.uitslag).join(', ') + ')' };
  return { status: 'BEWEZEN', paren: paren.length,
    reden: gescheiden.length + ' van de ' + paren.length + ' kruisparen gescheiden (A binnen, B met A\'s code en anoniem geweigerd), 0 lek: ' + GRENS_GEZIN };
}

async function meetGezinnen(rijen, base, browser, maakContext) {
  const { ROLLEN } = require('./lib/proefsessies');
  const A = await ROLLEN.gezin.haal(base), B = await ROLLEN.gezin.haal(base);
  if (!A || !B) return new Map(rijen.map((r) => [r.functie, { status: 'NIET_GETEST', reden: 'geen twee gezinssessies' }]));
  const uit = new Map();
  for (const r of rijen) {
    if (!r.pad) { uit.set(r.functie, { status: 'NIET_GETEST', reden: 'geen eigen adres' }); continue; }
    const ctx = await maakContext(browser, { rtf_sessie: JSON.stringify(A), rtg_cookieinfo_v1: '1' });
    const page = await ctx.newPage();
    const verzoeken = new Map();
    page.on('request', (q) => {
      const u = new URL(q.url());
      if (!u.pathname.startsWith('/api/')) return;
      const lijf = q.postData() || '';
      if (!(u.href.includes(A.code) || lijf.includes(A.code))) return;
      const k = q.method() + ' ' + u.pathname + u.search + ' ' + lijf;
      if (!verzoeken.has(k)) verzoeken.set(k, { methode: q.method(), url: u.pathname + u.search, lijf, koppen: q.headers() });
    });
    try { await page.goto(base + r.pad, { waitUntil: 'domcontentloaded', timeout: 20000 }); await page.waitForTimeout(2500); } catch (e) {}
    await ctx.close();
    const paren = [];
    for (const v of verzoeken.values()) {
      const speel = async (van, naar) => {
        const vervang = (s) => String(s || '').split(van).join(naar);
        const koppen = { 'content-type': 'application/json' };
        for (const [k, w] of Object.entries(v.koppen || {})) if (/^(authorization|x-)/i.test(k)) koppen[k] = vervang(w);
        try {
          const res = await fetch(base + vervang(v.url), { method: v.methode, headers: koppen,
            body: v.methode === 'GET' || v.methode === 'HEAD' ? undefined : vervang(v.lijf) });
          return res.status;
        } catch (e) { return 0; }
      };
      const a = await speel(A.token, A.token), b = await speel(A.token, B.token), anoniem = await speel(A.token, '');
      paren.push({ verzoek: v.methode + ' ' + v.url.split('?')[0], a, b, anoniem, uitslag: paarOordeel({ a, b, anoniem }) });
    }
    uit.set(r.functie, Object.assign(gezinOordeel(paren), { kruisparen: paren }));
  }
  return uit;
}

async function meet() {
  const { rijen, maakContext } = require('./appwerkt');
  const lijst = rijen();
  const reg = laadRegisters();
  const regels = [];
  const gezin = lijst.filter((r) => r.persona === 'gezin');
  let gezinUit = new Map();
  if (gezin.length) {
    const { laadBrowser } = require(path.join(WORTEL, 'test', 'browser'));
    const pw = laadBrowser({ eigenDriver: false });
    if (!pw) { console.error('Geen browser beschikbaar; de gezinskant meet in een echte browser.'); process.exit(2); }
    const { startServer } = require(path.join(WORTEL, 'test', 'helper.js'));
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bevoegdronde-'));
    const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
    const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    try { gezinUit = await meetGezinnen(gezin, base, browser, maakContext); }
    finally {
      await browser.close();
      try { child.kill(); } catch (e) {}
      try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
    }
  }
  for (const r of lijst) {
    const basis = { functie: r.functie, app: r.app, ingang: r.ingang, persona: r.persona };
    if (r.persona === 'lid') regels.push(Object.assign(basis, ledenOordeel(r, reg)));
    else if (r.persona === 'gezin') regels.push(Object.assign(basis, gezinUit.get(r.functie)));
    else regels.push(Object.assign(basis, { status: 'NIET_GETEST', reden: 'deze ronde heeft geen kruisproef voor de persona ' + r.persona }));
  }
  regels.sort((a, b) => a.functie.localeCompare(b.functie));
  const telling = {};
  for (const r of regels) telling[r.status] = (telling[r.status] || 0) + 1;
  return {
    stempel: stempel(),
    uitleg: 'Bewijs 6 (bevoegd) per onderdeel uit MAPPEN: ledenschermen samengesteld uit IDOR.json en ROLPROEF.json, gezinsschermen met een kruisproef op de gezinscode. Zie de kop van scripts/bevoegdronde.js en BETROUWBAARHEID.md par. 4f.',
    grens: 'leden: ' + GRENS_LID + '. gezinnen: ' + GRENS_GEZIN + '.',
    bronnen: { vervallen: reg.vervallen },
    telling,
    regels
  };
}

module.exports = { padOordeel, ledenOordeel, paarOordeel, gezinOordeel, laadRegisters, DOEL };

if (require.main === module) {
  meet().then((u) => {
    console.log('bevoegdronde: ' + u.regels.length + ' onderdelen -- ' + JSON.stringify(u.telling));
    if (u.bronnen.vervallen.length) console.log('  VERVALLEN: ' + u.bronnen.vervallen.join('; '));
    for (const r of u.regels) if (r.status === 'GEBLOKKEERD_DOOR_DEFECT') console.log('  DEFECT  ' + r.app + ': ' + r.reden);
    if (process.argv.includes('--vastleggen')) {
      fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
      console.log('geschreven: BEVOEGD.json');
    }
  }).catch((e) => { console.error('de bevoegdronde kon niet draaien: ' + ((e && e.message) || e)); process.exit(1); });
}
