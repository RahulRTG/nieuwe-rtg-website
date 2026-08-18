#!/usr/bin/env node
/* ============================================================================
   DE KETENRONDE -- sabotage op echte businessketens, per keten opgeschreven.

   De verraadronde bewijst dat een verraad toeslaat en zichtbaar is. Dat is de
   halve vraag. De andere helft is wat er in de KETEN gebeurde: kreeg de
   gebruiker een bevestiging of een fout, staat er iets blijvend, klopt het
   grootboek nog, is er een spoor, en is een herhaling veilig.

   DRIE KETENS, en dat is met opzet een klein getal:
     GELD          opladen -> saldo -> sluitcontrole. Hier is een fout duur.
     TOESTEMMING   toestemming intrekken. Hier is een fout onherstelbaar:
                   een intrekking die verdwijnt, is een verwerking die
                   doorloopt terwijl iemand nee heeft gezegd.
     NOTITIE       de gewone transactionele workflow, als ijklijn.

   Bij vijftien ketens is achteraf niet te zeggen welke stap door het verraad
   omviel; bij drie wel, en dan is de uitslag ook echt te lezen.

   Elke keten draait in TWEE ETAPPES met een herstart ertussen. Anders is
   `schrijf-verloren` per definitie blind: het geheugen houdt de gegevens vast.

   Uitslag per keten in het formaat van scripts/lib/ketenproef.js -- acht velden,
   en de zevenstappenlat eronder. Een verraad dat de lat niet haalt, telt niet
   mee als bewijs; wat eraan ontbreekt staat erbij.

   Draai:  node --experimental-sqlite scripts/ketenronde.js
           node --experimental-sqlite scripts/ketenronde.js --seed=819226199
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { CATALOGUS } = require('../server/lib/verraad');
const { beoordeel, isStilVerlies, voldoetAanLat, financieelOordeel } = require('./lib/ketenproef');
/* Wanneer is dit gemeten, en waartegen. Zonder stempel is een register niet na
   te lopen: verouderd ziet er identiek uit aan vers. Zie scripts/lib/stempel.js. */
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'KETENS.json');
const SEED = (process.argv.slice(2).find(a => a.startsWith('--seed=')) || '--seed=819226199').slice(7);
const VERRADEN = CATALOGUS.filter(v => v.waar && v.waar.includes('db/index.js')).map(v => v.naam);

function vrijePoort() {
  const net = require('net');
  return new Promise((res, rej) => {
    const s = net.createServer(); s.unref(); s.on('error', rej);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
  });
}
async function start(datamap, extra) {
  const poort = await vrijePoort();
  const basis = 'http://127.0.0.1:' + poort;
  const kind = spawn(process.execPath, ['--experimental-sqlite', path.join(WORTEL, 'server', 'server.js')], {
    cwd: WORTEL, stdio: 'ignore',
    env: { ...process.env, PORT: String(poort), RTG_DATA_DIR: datamap, SMTP_URL: '',
      STUN_UIT: '1', RTG_DEMO: '1', RTG_VERRAAD_SEED: SEED, ...extra } });
  const eind = Date.now() + 45000;
  while (Date.now() < eind) {
    if (kind.exitCode !== null) return { kind, basis, dood: true };
    try { const r = await fetch(basis + '/api/health'); if (r.ok) return { kind, basis, dood: false }; } catch (e) {}
    await new Promise(r => setTimeout(r, 200));
  }
  return { kind, basis, dood: true };
}
const stop = (s) => { try { s.kind.kill('SIGKILL'); } catch (e) {} };
const post = async (basis, pad, lijf, tok) => {
  try {
    const r = await fetch(basis + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
      body: JSON.stringify(lijf || {}) });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  } catch (e) { return { status: 0, data: {} }; }
};
const haal = async (basis, pad) => {
  try { const r = await fetch(basis + pad); return { status: r.status, data: await r.json().catch(() => ({})) }; }
  catch (e) { return { status: 0, data: {} }; }
};

/* ---------------------------------------------------------------------------
   DE DRIE KETENS. Elk levert dezelfde ruwe waarnemingen, zodat ketenproef.js er
   dezelfde acht velden uit kan afleiden -- een keten met een eigen oordeelsvorm
   is niet met een andere te vergelijken.
   ------------------------------------------------------------------------- */
/* WELKE IDENTITEIT EEN KETEN NODIG HEEFT.

   Twee ketens stonden eerst blind, en niet door een fout: er zat een POORT
   voor. RTG Pay weigert een lid zonder geverifieerd paspoort (403, KYC), en dat
   is geen bug maar het ontwerp. Die poort omzeilen zou een keten meten die in
   productie niet bestaat -- dan bewijs je iets over een pad dat niemand loopt.

   Dus gaat de geldketen door de VOORDEUR: het geverifieerde demo-account. Dat
   is precies wie RTG Pay wel mag gebruiken. Een vers lid blijft terecht buiten
   staan, en dat hoort zo. */
const IDENTITEIT = {
  GELD: 'geverifieerd',      // payGate vraagt een geverifieerd paspoort
  TOESTEMMING: 'nieuw',
  NOTITIE: 'nieuw'
};

const KETENS = {
  async GELD(basis, tok, merk) {
    const idem = 'ketenproef-' + merk;   // etappe 2 herhaalt met DEZELFDE sleutel
    const op = await post(basis, '/api/pay/oplaad', { centen: 1234, idem }, tok);
    const na = await post(basis, '/api/pay/overzicht', {}, tok);
    const saldoNa = na.data && na.data.saldo;
    /* Retry met DEZELFDE idem-sleutel: hoort geen tweede oplading te geven. */
    await post(basis, '/api/pay/oplaad', { centen: 1234, idem }, tok);
    const naRetry = await post(basis, '/api/pay/overzicht', {}, tok);
    const gezond = await haal(basis, '/api/pay/gezond');
    return {
      schrijfStatus: op.status,
      zichtbaarVoorHerstart: typeof saldoNa === 'number' && saldoNa >= 1234,
      retryGafTweedeEffect: (naRetry.data && naRetry.data.saldo) > saldoNa,
      ledgerKlopt: gezond.status === 200 && gezond.data.klopt === true,
      auditSpoor: Array.isArray(na.data && na.data.geschiedenis) && na.data.geschiedenis.length > 0
    };
  },
  async TOESTEMMING(basis, tok) {
    /* `zorgprofiel` en niet `rtgid-sessie`: die laatste vraagt een BESTAANDE
       machtiging om in te trekken, en die moet deze proef dan eerst zelf
       aanleggen -- dan meet je de aanleg mee. Het zorgprofiel-meereizen staat
       standaard aan en is dus meteen in te trekken. Zelfde belofte, zonder
       opbouw ertussen: wie nee zegt, hoort nee te blijven -- ook na een crash. */
    const laag = 'zorgprofiel';
    await post(basis, '/api/zorgprofiel/zet', { delen: true, allergieen: ['proef'] }, tok);
    const voor = await post(basis, '/api/toestemming', {}, tok);
    const intrek = await post(basis, '/api/toestemming/intrek', { laag }, tok);
    const na = await post(basis, '/api/toestemming', {}, tok);
    const anders = JSON.stringify(voor.data) !== JSON.stringify(na.data);
    const nogEens = await post(basis, '/api/toestemming/intrek', { laag }, tok);
    const naTweede = await post(basis, '/api/toestemming', {}, tok);
    return {
      schrijfStatus: intrek.status,
      zichtbaarVoorHerstart: anders,
      /* Twee keer intrekken hoort dezelfde toestand te geven; een tweede
         effect zou betekenen dat intrekken iets optelt in plaats van zet. */
      retryGafTweedeEffect: nogEens.status >= 200 && nogEens.status < 300 &&
        JSON.stringify(na.data) !== JSON.stringify(naTweede.data),
      ledgerKlopt: null,
      auditSpoor: anders
    };
  },
  async NOTITIE(basis, tok, merk) {
    const schrijf = await post(basis, '/api/notities/bewaar', { titel: merk, tekst: merk }, tok);
    const lijst = await post(basis, '/api/notities/mijn', {}, tok);
    const erin = JSON.stringify(lijst.data || {}).includes(merk);
    const nogEens = await post(basis, '/api/notities/bewaar', { titel: merk, tekst: merk }, tok);
    const lijst2 = await post(basis, '/api/notities/mijn', {}, tok);
    const aantal = (s) => (JSON.stringify(s || {}).match(new RegExp(merk, 'g')) || []).length;
    return {
      schrijfStatus: schrijf.status,
      zichtbaarVoorHerstart: erin,
      retryGafTweedeEffect: nogEens.status < 300 && aantal(lijst2.data) > aantal(lijst.data),
      ledgerKlopt: null,
      auditSpoor: erin
    };
  }
};

/* Een keten draaien: schrijven (etappe 1), herstarten, terugkijken (etappe 2). */
async function draai(keten, verraadAan) {
  const datamap = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-keten-'));
  const merk = 'kp' + Math.random().toString(36).slice(2, 8);
  const w = { schrijfStatus: null, zichtbaarVoorHerstart: null, blijftNaHerstart: null,
    ledgerKlopt: null, auditSpoor: null, retryGafTweedeEffect: null, startteOp: null };
  try {
    const een = await start(datamap, verraadAan ? { RTG_VERRAAD: verraadAan } : {});
    w.startteOp = !een.dood;
    if (een.dood) { stop(een); return w; }

    const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 900);
    let email, wachtwoord = 'geheim123', tok;
    if (IDENTITEIT[keten] === 'geverifieerd') {
      email = process.env.RTG_OWNER_EMAIL || 'roellie.i@gmail.com';
      wachtwoord = process.env.DEMO_PASS || 'Imran';
      const inlog = await post(een.basis, '/api/auth/login', { login: email, password: wachtwoord });
      tok = inlog.data && inlog.data.token;
    } else {
      email = 'kp' + u + '@x.nl';
      const reg = await post(een.basis, '/api/auth/register', { name: 'Ketenproef', email,
        phone: '06' + u.slice(0, 8), password: wachtwoord, geboortedatum: '1986-06-06',
        geslacht: 'm', tier: 'rtg', pasApp: 'rtg' });
      tok = reg.data && reg.data.token;
    }
    if (!tok) { w.identiteitLukte = false; stop(een); return w; }
    w.identiteitLukte = true;

    Object.assign(w, await KETENS[keten](een.basis, tok, merk));
    await new Promise(r => setTimeout(r, 1500));
    stop(een);
    await new Promise(r => setTimeout(r, 500));

    /* Etappe 2: schoon herstarten en kijken wat er OVER is. */
    const twee = await start(datamap, {});
    if (twee.dood) { stop(twee); return w; }
    const opnieuw = await post(twee.basis, '/api/auth/login', { login: email, password: wachtwoord });
    const tok2 = opnieuw.data && opnieuw.data.token;
    if (tok2) {
      if (keten === 'GELD') {
        const ov = await post(twee.basis, '/api/pay/overzicht', {}, tok2);
        const saldoNa = (ov.data && ov.data.saldo);
        w.blijftNaHerstart = typeof saldoNa === 'number' && saldoNa >= 1234;

        /* SCENARIO 3. De klant heeft geen antwoord gekregen (het proces stierf)
           en probeert het opnieuw -- met dezelfde idem-sleutel, want dat is wat
           een client doet. Er hoort dan EXACT EEN economische mutatie te staan:
           herkent RTG de herhaling niet, dan is lost-write opgelost en
           double-write gebouwd. Zie GELDLAT.md.

           Na de herstart, want alleen daar is de eerste opdracht duurzaam en de
           in-geheugen-toestand weg -- precies de situatie van de klant. */
        await post(twee.basis, '/api/pay/oplaad', { centen: 1234, idem: 'ketenproef-' + merk }, tok2);
        const naRetry = await post(twee.basis, '/api/pay/overzicht', {}, tok2);
        const saldoRetry = (naRetry.data && naRetry.data.saldo);
        w.retryNaHerstartDubbel = typeof saldoNa === 'number' && typeof saldoRetry === 'number'
          ? saldoRetry > saldoNa : null;

        const g = await haal(twee.basis, '/api/pay/gezond');
        w.ledgerKlopt = g.status === 200 && g.data.klopt === true;
      } else if (keten === 'TOESTEMMING') {
        const t = await post(twee.basis, '/api/toestemming', {}, tok2);
        w.blijftNaHerstart = JSON.stringify(t.data || {}).length > 2;
      } else {
        const l = await post(twee.basis, '/api/notities/mijn', {}, tok2);
        w.blijftNaHerstart = JSON.stringify(l.data || {}).includes(merk);
      }
    } else { w.blijftNaHerstart = false; }
    stop(twee);
    return w;
  } finally { try { fs.rmSync(datamap, { recursive: true, force: true }); } catch (e) {} }
}

(async () => {
  console.log('\n=== DE KETENRONDE ===\n  seed : ' + SEED + '\n');
  const uitslagen = [];

  for (const keten of Object.keys(KETENS)) {
    /* IJKEN. Zonder verraad moet de keten zijn werk doen; anders meet de
       waarnemer niets en mag hij niet oordelen. */
    const schoon = await draai(keten, null);
    const ijkOk = schoon.startteOp && schoon.zichtbaarVoorHerstart === true;
    if (!ijkOk) {
      /* EEN BLINDE KETEN KRIJGT EEN REDEN, geen stilte. Zonder reden leest een
         overgeslagen keten als een keten zonder bevindingen, en dat is het
         verschil tussen een werklijst en een gat. */
      const reden = !schoon.startteOp ? 'de server kwam niet op'
        : schoon.schrijfStatus === 403 ? 'de schrijfactie gaf 403 -- er zit een poort voor (KYC/onboarding) die deze proef niet doorloopt'
        : schoon.schrijfStatus === 404 ? 'de schrijfactie gaf 404 -- de keten vraagt een bestaande toestand die deze proef niet aanlegt'
        : 'de schone ronde liet geen spoor na (status ' + schoon.schrijfStatus + ')';
      console.log('  ' + keten + ': DE WAARNEMER IS BLIND -- ' + reden);
      console.log('    ' + JSON.stringify(schoon) + '\n');
      uitslagen.push({ keten, blind: true, reden, schoon });
      continue;
    }

    for (const verraad of VERRADEN) {
      const met = await draai(keten, verraad);
      const nog = await draai(keten, verraad);
      const o = beoordeel({ schoon, met, verraadSloegToe: true,
        herhaalbaar: JSON.stringify(met) === JSON.stringify(nog) });
      const lat = voldoetAanLat(o);
      const stil = isStilVerlies(o);
      /* Geld krijgt de strengere lat: alle drie of niets. Zie ketenproef.js. */
      const fin = keten === 'GELD' ? financieelOordeel(o) : null;

      console.log('  BUSINESSKETEN: ' + keten);
      console.log('  verraad: ' + verraad + '        seed: ' + SEED + '\n');
      console.log('    injectie ............ ' + o.injectie);
      console.log('    zichtbaar ........... ' + o.zichtbaar);
      console.log('    client response ..... ' + o.clientAntwoord);
      console.log('    state wijziging ..... ' + o.toestandWijziging);
      console.log('    ledger invariant .... ' + o.ledgerInvariant);
      console.log('    audit ............... ' + o.audit);
      console.log('    retry veilig ........ ' + o.retryVeilig);
      console.log('    rollback ............ ' + o.rollback);
      console.log('    reproduceerbaar ..... ' + o.herhaalbaar);
      console.log('    voldoet aan de lat .. ' + (lat.voldoet ? 'JA' : 'NEE -- mist: ' + lat.ontbreekt.join(', ')));
      if (fin) console.log('    FINANCIEEL .......... ' + fin.staat + '  (' + fin.reden + ')');
      if (stil) console.log('    !! STIL VERLIES: bevestigd aan de aanroeper en niet gebeurd');
      console.log('');
      uitslagen.push({ keten, verraad, ...o, lat, stilVerlies: stil, financieel: fin, ruw: met });
    }
  }

  const beoordeeld = uitslagen.filter(u => u.lat && u.lat.voldoet);
  const stille = uitslagen.filter(u => u.stilVerlies);
  const gebroken = uitslagen.filter(u => u.ledgerInvariant === 'GEBROKEN');
  const rollbackBewezen = uitslagen.filter(u => u.rollback === 'PROVEN');

  console.log('  ----------------------------------------');
  console.log('  KETENS .................. ' + Object.keys(KETENS).length);
  console.log('  SCENARIOS ............... ' + uitslagen.filter(u => u.verraad).length);
  console.log('  VOLDOET AAN DE LAT ...... ' + beoordeeld.length);
  console.log('  ROLLBACK BEWEZEN ........ ' + rollbackBewezen.length);
  const fins = uitslagen.filter(u => u.financieel);
  console.log('  GELD PROVEN ............. ' + fins.filter(u => u.financieel.staat === 'PROVEN').length +
    ' / ' + fins.length + '   (antwoord + persistentie + grootboek, alle drie)');
  console.log('  LEDGER GEBROKEN ......... ' + gebroken.length);
  console.log('  STIL VERLIES ............ ' + stille.length +
    (stille.length ? '   <- bevestigd en niet blijvend' : ''));
  const blinde = uitslagen.filter(u => u.blind);
  console.log('  BLINDE KETENS ........... ' + blinde.length +
    (blinde.length ? '   <- niet te beoordelen, met reden' : ''));
  for (const b of blinde) console.log('      ' + b.keten + ': ' + b.reden);
  console.log('  ----------------------------------------');

  fs.writeFileSync(UITSLAG, JSON.stringify({
    stempel: stempel(),
    uitleg: 'Sabotage op echte businessketens, acht velden per scenario. Een verraad telt pas ' +
      'als bewijs wanneer het de zevenstappenlat haalt (zie scripts/lib/ketenproef.js): ' +
      'injecteerbaar, aantoonbaar toegeslagen, zichtbaar, reproduceerbaar, businessuitkomst ' +
      'gemeten, invariant beoordeeld, rollback beoordeeld.',
    /* DE GRENS. Deze ronde saboteert de ketens die in KETENS staan, met EEN
       seed. Wat er niet in staat is niet beproefd, en een keten die de lat haalt
       is beproefd op DEZE zeven punten en niet op alles wat er mis kan gaan. */
    grens: 'Alleen de ketens in scripts/lib/ketens; een businessproces dat daar niet ' +
      'in staat is niet gesaboteerd. Per scenario EEN seed (' + SEED + '), dus dit is ' +
      'geen uitputtende zoektocht naar verraad maar een herhaalbare steekproef. ' +
      '"rollbackBewezen" zegt dat de terugdraai is WAARGENOMEN, niet dat elke ' +
      'gedeeltelijke schrijfactie in het huis terugdraait.',
    seed: SEED,
    gemeten: { ketens: Object.keys(KETENS).length, scenarios: uitslagen.filter(u => u.verraad).length,
      voldoetAanLat: beoordeeld.length, rollbackBewezen: rollbackBewezen.length,
      ledgerGebroken: gebroken.length, stilVerlies: stille.length,
      geldScenarios: uitslagen.filter(u => u.financieel).length,
      geldProven: uitslagen.filter(u => u.financieel && u.financieel.staat === 'PROVEN').length,
      blindeKetens: uitslagen.filter(u => u.blind).length },
    scenarios: uitslagen
  }, null, 2) + '\n');
  console.log('\n  weggeschreven in KETENS.json');

  /* Zakken op STIL VERLIES en op een GEBROKEN grootboek -- dat zijn geen
     bevindingen maar gaten in de belofte zelf. Niet op een nette fout. */
  process.exit(stille.length || gebroken.length ? 1 : 0);
})().catch(e => { console.error('de ketenronde viel om: ' + (e && e.stack || e)); process.exit(2); });
