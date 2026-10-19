/* ============================================================================
   DE VIER BETAALPADEN VAN EEN RIT -- de adapter van ./betaalpaden.js voor
   /api/ride/pay. Gebruikt door scripts/ritproef.js.

   Een eigen wereld en niet de server van de ritproef: het crashpad doodt de
   server, en dat hoort niet midden in de schakels van een andere meting. De
   wereld is ./voltooiwereld.js (herstart op dezelfde datamap, opslag lezen uit
   het bestand) met ./betaalhaak.js voorgeladen: die schrijft het afschrift van
   de bank, bevriest de server op het juiste moment, en laat de bank een trage
   betaling later bevestigen.

   Wat elke haak hier meet:
     nieuw(afloop)  een rit waarvan de bijlading bij de bank `afloop` geeft
                    (./simulatieafloop.js kiesRef op 'rit:<ref>:autolaad')
     betaal         POST /api/ride/pay, als het lid
     stand          de rit UIT HET BESTAND (paid), en of er een betaling van
                    deze rit bij de betaalwaarheid wacht
     lever          POST /api/supplier/ride/assign, als de vervoerder
     boekingen      regels in payBoekingen met de ref van de rit, uit het
                    bestand
     afschrift      wat de bank deed (./betaalhaak.js)
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { maakWereld } = require('./voltooiwereld');
const haak = require('./betaalhaak');
const SA = require('./simulatieafloop');
const { vierPaden } = require('./betaalpaden');

const WACHTEND = ['AANGEMAAKT', 'WACHT_OP_KLANT', 'IN_BEHANDELING'];
const bwId = (codenaam, idem) => 'BW-' + crypto.createHash('sha256')
  .update('pay:' + codenaam + '|pay-oplaad:' + codenaam + ':' + idem).digest('hex').slice(0, 20).toUpperCase();
const rust = (ms) => new Promise((r) => setTimeout(r, ms));

async function ritBetaalpaden({ vervoerder, bestemming }) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-betaalhaak-'));
  SA.bankAan();
  const w = await maakWereld('betaalpaden-rit', { RTG_DEMO: '1', DEMO_SUPPLIER: vervoerder, RTG_SIMULATIEBANK: '1', RTG_BETAALHAAK: map },
    { nodeArgs: ['--require', path.join(__dirname, 'betaalhaak.js')] });
  let M, S, staffId;
  const ritten = {};
  async function inloggen() {
    M = (await w.post('/api/login', { tier: 'rtg' })).data.token;
    S = (await w.post('/api/supplier/login', { username: 'rahul', password: 'Imran' })).data.token;
  }
  try {
    await inloggen();
    const staf = await w.post('/api/supplier/staff/add', { name: 'Chauffeur Betaalpaden', func: 'chauffeur' }, S);
    staffId = staf.data && staf.data.staff && staf.data.staff.id;
    if (!staffId) throw new Error('geen chauffeur aan te maken (status ' + staf.status + ')');

    const rit = (ref) => (w.collectie('rides') || []).find((r) => r && r.ref === ref) || null;
    const adapter = {
      async nieuw(afloop) {
        const k = await SA.kiesRef(async () => {
          const r = await w.post('/api/ride/request', { supplierCode: vervoerder, toCode: bestemming, passengers: 1 }, M);
          const ride = r.data && r.data.ride;
          return { antwoord: r, codenaam: ride && ride.customerCodename, idem: ride ? 'rit:' + ride.ref + ':autolaad' : null };
        }, afloop);
        const ride = k.gevonden && k.antwoord.data.ride;
        if (!ride) return null;
        ritten[ride.ref] = ride.customerCodename;
        return { ref: ride.ref };
      },
      betaal: (ref) => w.post('/api/ride/pay', { ref }, M),
      async stand(ref) {
        await rust(250);
        const r = rit(ref);
        const bw = (w.collectie('betaalWaarheid') || {})[bwId(ritten[ref], 'rit:' + ref + ':autolaad')];
        return { betaald: !!(r && r.paid), wacht: !!(bw && WACHTEND.includes(bw.status)), bekend: !!bw,
          betaalwaarheid: bw ? bw.status + ' (' + (bw.gebeurtenissen || []).map((g) => g.soort).join(',') + ')' : null };
      },
      lever: (ref) => w.post('/api/supplier/ride/assign', { ref, staffId }, S),
      async boekingen(ref) {
        await rust(250);
        const b = w.collectie('payBoekingen');
        const lijst = Array.isArray(b) ? b : Object.values(b || {});
        return lijst.filter((x) => x && x.ref === ref).length;
      },
      async afschrift() { return haak.afschrift(map); },
      async bevestigLater(ref) {
        for (const r of haak.afschrift(map)) if (r.soort === 'maak' && r.status === 'open' && r.sleutel === 'waarheid:' + bwId(ritten[ref], 'rit:' + ref + ':autolaad')) haak.zet(map, 'bevestig', r.id);
      },
      async betaalEnCrash(ref) {
        haak.zet(map, 'hang');
        const vlucht = w.post('/api/ride/pay', { ref }, M).catch(() => null);
        const gevraagd = path.join(map, 'gevraagd');
        for (let i = 0; i < 200 && !fs.existsSync(gevraagd); i++) await rust(100);
        if (!fs.existsSync(gevraagd)) { try { fs.unlinkSync(path.join(map, 'hang')); } catch (e) { /* al weg */ } return { gevraagd: false }; }
        await w.crash();
        await vlucht;
        await inloggen();
        return { gevraagd: true, bank: JSON.parse(fs.readFileSync(gevraagd, 'utf8')) };
      }
    };
    return await vierPaden(adapter);
  } finally {
    w.klaar();
    try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) { /* al weg */ }
  }
}

module.exports = { ritBetaalpaden };

if (require.main === module) {
  ritBetaalpaden({ vervoerder: 'ISLATR', bestemming: 'KIKUNOI' })
    .then((u) => console.log(JSON.stringify(u, null, 1)), (e) => { console.error(e); process.exitCode = 1; });
}
