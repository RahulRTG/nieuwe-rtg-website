/* DE NIEUWE ENDPOINTS VAN DE SAMENVOEGRONDE, EEN KEER ECHT AANGEROEPEN.

   WAT DIT IS. Bij het samenvoegen van 23 PR's kwamen 44 nieuwe endpoints
   binnen waar geen enkel testbestand langs ging -- de deltapoort wees ze aan met
   "komt in geen enkel testbestand voor". Dat is de stilste soort risico: ze
   staan in de routetabel, ze halen elke keuring, en niemand heeft ze ooit
   aangeroepen. Deze toets doet dat wel.

   WAT HIJ BEWIJST, en het is met opzet weinig:
     - elk endpoint BESTAAT (geen 404 op de route zelf);
     - elk endpoint heeft een POORT: een anonieme beller komt er niet in;
     - geen enkel endpoint valt om op rommel (geen 5xx op een leeg of onzinnig
       lijf).

   WAT HIJ NIET BEWIJST, en dat hoort er net zo hard bij: of het endpoint DOET
   wat het belooft. Dat is per stuk werk en staat op de takenlijst. Deze toets
   is de ondergrens -- hij vangt de fout die bij dit soort samenvoegingen
   werkelijk voorkomt: een route die naar een functie wijst die er niet meer is,
   of een handler die op een leeg lijf een 500 gooit. Twee daarvan zijn in deze
   ronde al zo gevonden (pay.kasStand en routesInBron).

   Draai los: node --test test/nieuwe-endpoints.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-nieuw-'));

/* De endpoints zoals de deltapoort ze aanwees, op 20 augustus 2026. Groeit deze
   lijst, dan is er nieuw werk zonder toets bijgekomen; krimpt hij, dan heeft
   iemand er een echte toets voor geschreven en mag hij hier weg. */
const NIEUW = [
  '/api/festival/bezetting',
  '/api/festival/control/weg',
  '/api/festival/dienst/weg',
  '/api/festival/gast/edities',
  '/api/festival/gast/passen',
  '/api/festival/gast/programma',
  '/api/festival/groep/code',
  '/api/festival/groep/mijn',
  '/api/festival/norm/weg',
  '/api/festival/partner/deelt',
  '/api/festival/partner/lijst',
  '/api/festival/partner/opzeg',
  '/api/festival/partner/weiger',
  '/api/festival/pas/intrek',
  '/api/festival/plek/weg',
  '/api/festival/producten',
  '/api/festival/tijdlijn',
  '/api/festival/uitzonderingen',
  '/api/festival/verkoop/los',
  '/api/leerstof/pad',
  '/api/member/rendezvous/aanwezig/wis',
  '/api/member/rendezvous/akkoord',
  '/api/member/rendezvous/arrange',
  '/api/member/rendezvous/encounter',
  '/api/member/rendezvous/introductie/antwoord',
  '/api/member/rendezvous/introducties',
  '/api/member/rendezvous/samen',
  '/api/member/rendezvous/samen/zet',
  '/api/member/rendezvous/tafel/antwoord',
  '/api/member/rendezvous/tafels',
  '/api/office/bank/regels/geraakt',
  '/api/office/bank/regels/geschiedenis',
  '/api/office/bank/regels/zzp',
  '/api/office/bank/regels/zzp/update',
  '/api/rtf/leerling/bewijs',
  '/api/rtf/leerling/dag',
  '/api/rtf/leerling/herhaal',
  '/api/rtf/leerling/herhalen',
  '/api/rtf/leerling/pad',
  '/api/supplier/btw/afsluiting',
  '/api/supplier/btw/preflight',
  '/api/supplier/gateway/mandaat/intrek',
  '/api/supplier/horeca/gasten',
  '/api/supplier/pay/tegoed/terug',
];

/* Rommel die een handler nooit mag laten struikelen: leeg, een verkeerd type,
   en een te lang veld. Geen fuzzing -- drie vormen die in dit huis echt
   voorkomen als een client iets misbegrijpt. */
const ROMMEL = [{}, { id: 12345, code: null }, { naam: 'x'.repeat(5000) }];

test('elk nieuw endpoint bestaat, heeft een poort, en valt niet om op rommel', async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const zonderPoort = [];
    const bestaatNiet = [];
    const stuk = [];

    for (const pad of NIEUW) {
      for (const lijf of ROMMEL) {
        const r = await fetch(base + pad, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lijf)
        }).catch((e) => ({ status: 0, fout: e.message }));

        if (r.status === 0) { stuk.push(pad + ' -- geen antwoord: ' + r.fout); continue; }
        if (r.status === 404) { bestaatNiet.push(pad); break; }
        /* 5xx is altijd fout: rommel hoort een 4xx te krijgen. Een 503 van een
           functie die bewust uitstaat telt niet mee -- die laat niemand binnen. */
        if (r.status >= 500) {
          const d = await r.json().catch(() => ({}));
          if (!(r.status === 503 && d.functie)) stuk.push(pad + ' -> ' + r.status + ' op ' + JSON.stringify(lijf).slice(0, 40));
        }
        /* En de poort: anoniem hoort er niet in te komen. 400 mag ook -- dan
           struikelt hij op het lijf voordat hij aan de deur toekomt, en dat is
           geen toegang. */
        if (r.status >= 200 && r.status < 300) zonderPoort.push(pad);
      }
    }

    assert.deepEqual(bestaatNiet, [], 'deze endpoints bestaan niet (404): ' + bestaatNiet.join(', '));
    assert.deepEqual(stuk, [], 'deze endpoints vielen om op rommel: ' + stuk.slice(0, 8).join(' | '));
    assert.deepEqual(zonderPoort, [], 'deze endpoints lieten een ANONIEME beller binnen: ' + zonderPoort.join(', '));
  } finally { stop(child); }
});
