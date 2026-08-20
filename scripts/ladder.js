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
const { start: wegwerp } = require('./lib/wegwerpserver');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WORTEL = path.join(__dirname, '..');
const { TREDEN, maakKiezer } = require('./ladder/trappen');

/* ---- DE RATEL OP DEZE PROEF ----

   Deze ladder was de meest complete aanvalsproef van het huis (3878 aanvallen
   over dertien treden) en hing aan NIETS: niet aan ci.yml, niet aan de
   weekronde, en niet aan een meter. Hij draaide als iemand eraan dacht.

   Dat was geen slordigheid maar een gevolg: hij kon niet groen worden. Twaalf
   bewust-openbare routes stonden niet in de publieke lijst, een 503 uit de
   schakelkast telde als serverfout, en de begane grond toetste op seed-gegevens
   die weggedreven waren. Een proef die per definitie rood staat, kan nergens
   aan hangen. Nu hij eerlijk groen is, hoort hij aan een ratel.

   TWEE GETALLEN, want een ervan alleen liegt. `ladderRaak` telt de bevindingen.
   `ladderNietGeprobeerd` telt de proeven die hun voorwaarde niet rond kregen --
   en dat getal moet erbij, want raak op nul is triviaal te halen door niets meer
   te proberen. Precies dat was hier gebeurd: de insider-trede probeerde NUL
   dingen en meldde keurig geen enkele bevinding.

   Wat deze twee NIET meten: of de treden de juiste dingen proberen. Dat blijft
   mensenwerk en staat in de kop van dit bestand ("een schone uitkomst betekent:
   niets van wat WIJ konden bedenken kwam erdoor"). */
const METER = 'ladderRaak';
const RICHTING = 'omlaag';           // een plafond: meer bevindingen is slechter
const METER_N = 'ladderNietGeprobeerd';
const RICHTING_N = 'omlaag';         // een plafond: minder proberen is slechter
const UITSLAGBESTAND = path.join(WORTEL, 'LADDER.json');
const VASTLEGGEN = process.argv.includes('--vastleggen');
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
/* De startregels wonen in scripts/lib/proefserver.js, want scripts/rolronde.js
   heeft precies hetzelfde nodig. Twee kopieen lopen uiteen -- en dan draait de
   ene proef tegen een installatie met een demo-zaak en de andere niet, waarna
   hun uitslagen niet meer vergelijkbaar zijn zonder dat iemand weet waarom
   (LAT.md regel 4). Daar staat ook waarom RTG_DEMO=1 geen versoepeling is maar
   dekking. */
const proefserver = require('./lib/proefserver');
const bootEigen = () => proefserver.start({ poort: PORT, merk: 'ladder' });
const wachtGezond = (vraag, pogingen) => proefserver.wachtGezond(vraag, pogingen);

/* ---------- de rollen die de treden nodig hebben ---------- */
async function haalRollen(vraag) {
  const rollen = { lid: null, lid2: null, lid2Codenaam: null, zaak: null, zaakCode: null, paden: ['/api/state', '/api/pay/overzicht', '/api/order', '/api/member/find', '/api/supplier/state', '/api/office/state', '/api/notifications', '/api/chat'] };
  const KYC = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  async function nieuwLid(merk) {
    const u = merk + crypto.randomBytes(8).toString('hex');
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
/* HET OORDEEL APART, ZODAT HET TE IJKEN IS.

   De twee meters hierboven hangen aan een ronde van vier minuten met een echte
   server. Die is in een toets niet na te spelen, en dat was bijna de reden om
   hier "geen proef, wel een reden" op te schrijven -- precies de uitweg die
   `metersOngeijkt` telt en die op nul staat.

   Maar de vraag van een ijking is niet "kun je deze ronde namaken", het is
   "SLAAT DEZE METER UIT ALS ZIJN INVOER FOUT IS". Dezelfde redenering staat bij
   de zes prestatiemeters in test/meterijk.test.js, en om dezelfde reden staat
   het oordeel hier los: een toets kan er een bekend-foute uitslag in stoppen.

   WAT DIT NIET BEWIJST, en dat hoort erbij: dat het TELLEN klopt. `raak` is een
   som over wat de treden zelf melden, en of een trede het juiste probeert blijft
   mensenwerk -- zie de kop van dit bestand. Deze functie bewaakt de tand, niet
   het oog. */
function beoordeel(uitslag, normMeters) {
  const redenen = [];
  const plafond = normMeters ? normMeters[METER] : undefined;
  const plafondN = normMeters ? normMeters[METER_N] : undefined;
  if (plafond !== undefined && uitslag.raak > plafond)
    redenen.push('De ladder gaf ' + uitslag.raak + ' bevinding(en) tegen een norm van ' + plafond + '.');
  if (plafondN !== undefined && uitslag.niet > plafondN)
    redenen.push('De ladder kon ' + uitslag.niet + ' proef/proeven niet uitvoeren tegen een norm van ' + plafondN +
      '. Minder proberen is geen betere uitslag.');
  return { zakt: redenen.length > 0, redenen };
}

async function main() {
  let srv = null, base = BASIS_EXTERN;
  const host = () => new URL(base).hostname, poort = () => Number(new URL(base).port || 80);

  console.log('\n' + K.vet + 'DE LADDER' + K.reset + K.grijs + '  van een onhandige kleuter tot de slimste aanvaller' + K.reset);

  if (!BASIS_EXTERN) {
    srv = await bootEigen(); base = srv.base;
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

  /* De uitslag op schijf, zodat er iets te ratelen valt. De bevindingen gaan
     mee met naam: een getal zonder de lijst erbij stuurt niemand ergens heen. */
  try {
    fs.writeFileSync(UITSLAGBESTAND, JSON.stringify({
      uitleg: 'De ladder: elke trede van kleuter tot aanvaller tegen een echte server. ' +
        'raak MAG ALLEEN DALEN en nietGeprobeerd ook -- zie scripts/ladder.js. ' +
        'Een schone uitkomst betekent: niets van wat wij konden bedenken kwam erdoor. Niet: veilig.',
      gedraaid: new Date().toISOString(), treden: treden.length,
      meters: { [METER]: raak, [METER_N]: niet },
      afgeslagen: af, gelukt,
      bevindingen: rapport.flatMap(r => r.raak.map(x => ({ trede: r.trede, wat: x.wat, hoe: x.hoe || null }))),
      nietGeprobeerd: rapport.flatMap(r => [...new Set(r.niet)].map(n => ({ trede: r.trede, reden: n })))
    }, null, 2) + '\n');
  } catch (e) { console.error('  kon LADDER.json niet schrijven: ' + e.message); }

  /* DE RATEL. Losse treden draaien (--trede) meet maar een deel, dus dan is er
     niets te vergelijken -- anders zou een enkele trede de lat van de hele
     ladder verzetten. Dat is dezelfde val als een prestatiecijfer van een andere
     machine. */
  const heleRonde = !ALLEEN.length;
  let norm = null;
  try { norm = JSON.parse(fs.readFileSync(path.join(WORTEL, 'NORM.json'), 'utf8')); } catch (e) {}
  if (heleRonde && norm && norm.meters) {
    if (VASTLEGGEN) {
      const p = norm.meters[METER], pN = norm.meters[METER_N];
      if (p === undefined || raak <= p) norm.meters[METER] = raak;
      if (pN === undefined || niet <= pN) norm.meters[METER_N] = niet;
      fs.writeFileSync(path.join(WORTEL, 'NORM.json'), JSON.stringify(norm, null, 2) + '\n');
      console.log('  ' + K.groen + METER + ' vastgelegd op ' + norm.meters[METER] + ', ' + METER_N + ' op ' + norm.meters[METER_N] + '.' + K.reset + '\n');
    } else {
      const oordeel = beoordeel({ raak, niet }, norm.meters);
      if (oordeel.zakt) {
        for (const r of oordeel.redenen) console.error('  ' + K.rood + r + K.reset);
        console.error('');
        return 1;
      }
    }
  }
  return raak ? 1 : 0;
}

if (require.main === module) main().then(c => { process.exitCode = c; }).catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { TREDEN, beoordeel, METER, METER_N };
