#!/usr/bin/env node
/* ============================================================================
   DE LADDER -- een deur waar alle chaos doorheen kan, van kleuter tot hacker.

   Dit is het antwoord op een eenvoudige vraag: als er iemand op deze software
   losgaat, van een peuter die op alles ramt tot de geslepenste aanvaller, houdt
   het dan? De treden staan in scripts/ladder/trappen.js, oplopend in bedoeling
   en vaardigheid; deze loper start een echte server, laat elke trede erop los,
   en telt de uitkomst.

   WAT DIT WEL IS EN WAT NIET

   Het is EEN deur voor alles wat we kunnen bedenken, tegen een ECHTE server.
   Het is GEEN onafhankelijke pentest -- de treden zijn geschreven door dezelfde
   partij die de server schreef, en die vindt de aanname niet die hij niet weet
   dat hij heeft (zie scripts/aanval.js, dat dat eerlijk zegt). Een raak-melding
   is dus altijd waar; een schone uitslag betekent "niets van wat WIJ konden
   bedenken kwam erdoor", niet "veilig".

   DE UITSLAG KENT DRIE STANDEN, want dat is de les van deze codebase:
     RAAK             iets wat niet hoort te kunnen, kon. Dit faalt (exit 1).
     AFGESLAGEN       de deur deed zijn werk.
     NIET GEPROBEERD  de voorwaarde kwam niet rond. Dit blijft ZICHTBAAR --
                      een ronde die stil niets probeert en groen meldt is de
                      onwaarheid waar dit huis vandaag herhaaldelijk op stuitte.

   Draai:  node scripts/ladder.js
           node scripts/ladder.js --trede aanvaller,insider   (alleen die)
           node scripts/ladder.js --rondes 3                  (elke trede 3x)
           MEEDOEN tegen een DRAAIENDE server, geen eigen boot:
           node scripts/ladder.js --basis http://127.0.0.1:3000
   Env: LADDER_SEED (deterministische rommel), LADDER_PORT.
   ============================================================================ */
'use strict';
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const { TREDEN, maakKiezer } = require('./ladder/trappen');
const K = { rood: '\x1b[31m', groen: '\x1b[32m', geel: '\x1b[33m', grijs: '\x1b[2m', reset: '\x1b[0m', vet: '\x1b[1m' };

const arg = (naam, std) => { const i = process.argv.indexOf(naam); return i > 0 ? process.argv[i + 1] : std; };
const BASIS_EXTERN = arg('--basis', null);
const RONDES = Number(arg('--rondes', 1)) || 1;
const ALLEEN = (arg('--trede', '') || '').split(',').map(s => s.trim()).filter(Boolean);
const SEED = Number(process.env.LADDER_SEED || 20260801);
const PORT = Number(process.env.LADDER_PORT || 4400);

/* ---------- de deur naar de server ---------- */
const agent = new http.Agent({ keepAlive: true, maxSockets: 64 });
function maakVraag(host, port) {
  return function vraag(method, pad, token, body, opt) {
    const t0 = Date.now();
    return new Promise(resolve => {
      const data = method === 'GET' ? null : JSON.stringify(body === undefined ? {} : body);
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token;
      if (data) headers['Content-Length'] = Buffer.byteLength(data);
      let klaar = false;
      const af = (status, tekst) => {
        if (klaar) return; klaar = true;
        let d = null; try { d = tekst ? JSON.parse(tekst) : null; } catch (e) {}
        resolve({ status, data: d || {}, ms: Date.now() - t0 });
      };
      const req = http.request({ host, port, path: pad, method, headers, agent }, res => {
        let buf = ''; res.setEncoding('utf8');
        res.on('data', c => { if (buf.length < 131072) buf += c; });
        res.on('end', () => af(res.statusCode, buf)); res.on('error', () => af(res.statusCode, buf));
      });
      req.on('error', () => af(0, ''));
      req.setTimeout((opt && opt.timeout) || 12000, () => { req.destroy(); af(0, ''); });
      /* Bewust afbreken: de "haastige klant" trekt de stekker er halverwege uit.
         De server hoort dat te overleven zonder een halve schrijfactie. */
      if (opt && opt.afbreken) { if (data) req.write(data); req.end(); setTimeout(() => req.destroy(), 5); return; }
      if (data) req.write(data); req.end();
    });
  };
}

/* ---------- de werkbank die elke trede krijgt ---------- */
let _u = 0;
function werkbank(vraag, rollen, kiezer) {
  const meldingen = [];
  return {
    vraag,
    afgebroken: (m, p, t, b) => vraag(m, p, t, b, { afbreken: true }),
    kiezer, kies: kiezer,
    uniek: () => Date.now().toString(36) + '-' + (++_u).toString(36),
    lid: rollen.lid, lid2: rollen.lid2, lid2Codenaam: rollen.lid2Codenaam, zaak: rollen.zaak, zaakCode: rollen.zaakCode,
    paden: rollen.paden,
    raak: (wat, hoe) => meldingen.push({ soort: 'raak', wat, hoe }),
    afgeslagen: () => meldingen.push({ soort: 'af' }),
    /* De begane grond kent een vierde stand. De aanval-treden melden
       "afgeslagen" als de deur dichtbleef; de gewone gast meldt "gelukt" als
       een normale handeling gewoon werkte. Twee kanten van dezelfde deur: een
       muur die alles weigert haalt elke aanval-trede, en is toch kapot. */
    gelukt: () => meldingen.push({ soort: 'gelukt' }),
    nietGeprobeerd: (waarom) => meldingen.push({ soort: 'niet', waarom }),
    _meldingen: meldingen
  };
}

/* ---------- server starten (tenzij --basis) ---------- */
function bootEigen() {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ladder-'));
  const child = spawn(process.execPath, ['--experimental-sqlite', 'server/server.js'], {
    cwd: WORTEL, env: { ...process.env, PORT: String(PORT), RTG_DATA_DIR: TMP, NODE_ENV: 'test', SMTP_URL: '', ANTHROPIC_API_KEY: '' },
    stdio: ['ignore', 'ignore', 'ignore']
  });
  return { child, base: 'http://127.0.0.1:' + PORT, TMP };
}
async function wachtGezond(vraag, pogingen) {
  for (let i = 0; i < (pogingen || 200); i++) {
    const r = await vraag('GET', '/api/ready', null, null, { timeout: 3000 }).catch(() => ({ status: 0 }));
    if (r.status === 200) return true;
    await new Promise(r => setTimeout(r, 250));
  }
  return false;
}

/* ---------- de rollen die de treden nodig hebben ---------- */
async function haalRollen(vraag) {
  const rollen = { lid: null, lid2: null, lid2Codenaam: null, zaak: null, zaakCode: null, paden: ['/api/state', '/api/pay/overzicht', '/api/order', '/api/member/find', '/api/supplier/state', '/api/office/state', '/api/notifications', '/api/chat'] };
  const KYC = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  async function nieuwLid(merk) {
    const u = merk + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    const reg = await vraag('POST', '/api/auth/register', null, { name: 'Ladder ' + u, email: 'ladder' + u + '@voorbeeld.test', phone: '0612345678', password: 'Geheim' + u + '!', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
    const tok = reg.data && reg.data.token;
    if (tok) await vraag('POST', '/api/verify/upload', tok, { image: KYC });
    return tok;
  }
  try {
    rollen.lid = await nieuwLid('a');
    /* Een TWEEDE lid, en dat is geen luxe. De opportunist stuurt onmogelijke
       bedragen; stuurt hij naar zijn eigen codenaam, dan slaat de "aan jezelf
       sturen"-controle toe VOOR de bedragcontrole en meet de trede niets. Dat
       maskeerde een gat: een mutatie op de ondergrens werd niet gevangen tot
       er een echte ontvanger was. */
    rollen.lid2 = await nieuwLid('b');
    if (rollen.lid2) {
      const ov = await vraag('POST', '/api/pay/overzicht', rollen.lid2, {});
      rollen.lid2Codenaam = ov.data && ov.data.codenaam;
    }
  } catch (e) {}
  try {
    const roster = await vraag('POST', '/api/supplier/roster', null, { code: 'KIKUNOI' });
    const mgr = (roster.data.staff || []).find(x => x.role === 'manager');
    if (mgr) {
      const login = await vraag('POST', '/api/supplier/login', null, { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' });
      rollen.zaak = login.data && login.data.token; rollen.zaakCode = 'KIKUNOI';
    }
  } catch (e) {}
  return rollen;
}

/* ---------- de loop ---------- */
async function main() {
  let srv = null, base = BASIS_EXTERN;
  const host = () => new URL(base).hostname, poort = () => Number(new URL(base).port || 80);

  console.log('\n' + K.vet + 'DE LADDER' + K.reset + K.grijs + '  van een onhandige kleuter tot de slimste aanvaller' + K.reset);

  if (!BASIS_EXTERN) {
    srv = bootEigen(); base = srv.base;
    const gezond = await wachtGezond(maakVraag('127.0.0.1', PORT));
    if (!gezond) { console.log('\n  ' + K.rood + 'de server werd niet gezond op ' + base + K.reset + '\n'); try { srv.child.kill('SIGKILL'); } catch (e) {} return 1; }
  }
  const vraag = maakVraag(host(), poort());
  console.log(K.grijs + '  tegen ' + base + (BASIS_EXTERN ? ' (draaiende server)' : ' (eigen boot)') + ' - seed ' + SEED + ' - ' + RONDES + ' ronde(n)' + K.reset + '\n');

  const rollen = await haalRollen(vraag);
  if (!rollen.lid) console.log('  ' + K.geel + 'let op: geen ledentoken -- veel treden melden NIET GEPROBEERD' + K.reset);
  if (!rollen.zaak) console.log('  ' + K.geel + 'let op: geen zaaktoken -- de insider-trede wordt overgeslagen' + K.reset);

  const treden = TREDEN.filter(t => !ALLEEN.length || ALLEEN.includes(t.id));
  const rapport = [];
  for (const trede of treden) {
    const telt = { raak: [], af: 0, gelukt: 0, niet: [] };
    for (let ronde = 0; ronde < RONDES; ronde++) {
      const w = werkbank(vraag, rollen, maakKiezer(SEED + ronde * 101));
      try { await trede.doe(w); }
      catch (e) { w._meldingen.push({ soort: 'raak', wat: 'de trede zelf wierp een fout', hoe: String(e.message || e).slice(0, 120) }); }
      for (const m of w._meldingen) {
        if (m.soort === 'raak') telt.raak.push(m);
        else if (m.soort === 'af') telt.af++;
        else if (m.soort === 'gelukt') telt.gelukt++;
        else telt.niet.push(m.waarom);
      }
    }
    // WERKT voor de begane grond (normale dingen lukten), STANDVAST voor de
    // aanval-treden (chaos werd afgeslagen), LEEG als er niets gebeurde.
    const merk = telt.raak.length ? K.rood + 'RAAK     '
      : (telt.gelukt ? K.groen + 'WERKT    ' : (telt.af ? K.groen + 'STANDVAST' : K.geel + 'LEEG     '));
    console.log('  ' + merk + K.reset + '  ' + K.vet + trede.naam + K.reset + K.grijs + ' -- ' + trede.wie + K.reset);
    const stukjes = [];
    if (telt.gelukt) stukjes.push(telt.gelukt + ' gelukt');
    if (telt.af) stukjes.push(telt.af + ' afgeslagen');
    stukjes.push(telt.raak.length + ' raak'); stukjes.push(telt.niet.length + ' niet geprobeerd');
    console.log('      ' + K.grijs + stukjes.join(', ') + K.reset);
    for (const r of telt.raak) console.log('      ' + K.rood + '! ' + r.wat + (r.hoe ? ' -- ' + r.hoe : '') + K.reset);
    for (const n of [...new Set(telt.niet)]) console.log('      ' + K.grijs + '~ niet geprobeerd: ' + n + K.reset);
    rapport.push({ trede: trede.id, naam: trede.naam, ...telt });
  }

  const raak = rapport.reduce((n, r) => n + r.raak.length, 0);
  const af = rapport.reduce((n, r) => n + r.af, 0);
  const gelukt = rapport.reduce((n, r) => n + r.gelukt, 0);
  const niet = rapport.reduce((n, r) => n + r.niet.length, 0);
  const leeg = rapport.filter(r => !r.af && !r.gelukt && !r.raak.length);
  console.log('\n' + K.vet + 'DE UITKOMST' + K.reset);
  console.log('  ' + gelukt + ' normale dingen gelukt, ' + af + ' aanvallen afgeslagen, '
    + (raak ? K.rood + raak + ' RAAK' + K.reset : '0 raak') + ', ' + niet + ' niet geprobeerd, over ' + treden.length + ' treden');
  if (leeg.length) console.log('  ' + K.geel + leeg.length + ' trede(n) probeerden NIETS' + K.reset + K.grijs + ' -- ' + leeg.map(r => r.naam).join(', ') + ' (voorwaarde kwam niet rond)' + K.reset);
  console.log('  ' + K.grijs + 'Een schone uitkomst betekent: niets van wat WIJ konden bedenken kwam erdoor. Niet: veilig.' + K.reset + '\n');

  if (srv) { try { srv.child.kill('SIGKILL'); } catch (e) {} try { fs.rmSync(srv.TMP, { recursive: true, force: true }); } catch (e) {} }
  return raak ? 1 : 0;
}

if (require.main === module) main().then(c => { process.exitCode = c; }).catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { TREDEN };
