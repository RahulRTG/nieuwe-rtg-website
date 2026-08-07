/* EEN ADRES DAT DE BEZOEKER ZELF MAG KIEZEN, IS GEEN ADRES.

   Elke snelheidslimiet, elk verbod en elke teller in dit huis rekent op het
   adres van de aanroeper. De server leidt dat zorgvuldig af in
   server/web/verrijk.js: uit x-forwarded-for van RECHTS, en alleen bij een
   vertrouwde proxy. Van rechts, omdat de client links zijn eigen waarden kan
   bijplakken; server/trio.js zet het echte adres er daarom rechts achter.

   WAT ER MISGING. Twee plekken lazen die kop zelf, en allebei van LINKS:
   server/foundation/basis.js (de rem op het RADEN van een gezinscode) en
   server/routes/lesmaker.js. Bij de eerste was het ernstig: wie bij elke poging
   een ander adres meestuurde kreeg telkens een verse teller en raakte de grens
   nooit -- terwijl achter zo'n code van zes tekens kinderprofielen liggen
   zonder pincode, met hun locatie en gezondheidsgegevens.

   Er was dus al een goed antwoord op deze vraag; die twee waren een tweede,
   slechter antwoord. Twee bronnen voor een waarheid betekent dat de zwakste
   wint zodra iemand hem gebruikt.

   DEZE TOETS BEWAAKT DE HELE FAMILIE, niet dat ene geval. Wie morgen ergens
   opnieuw zelf de kop gaat lezen, loopt hier tegenaan -- ook op een plek die
   vandaag nog niet bestaat. Dat is het verschil tussen een toets die een bug
   afvangt en een toets die een SOORT bug afvangt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..', 'server');

/* De twee plekken die de kop WEL mogen lezen, met de reden erbij:
   - web/verrijk.js leidt req.ip af (van rechts, alleen bij een vertrouwde proxy)
   - trio.js is de gateway zelf en plakt het echte adres rechts aan de keten */
const MAG = new Set([
  path.join(WORTEL, 'web', 'verrijk.js'),
  path.join(WORTEL, 'trio.js')
]);

function alleJs(map) {
  const uit = [];
  for (const naam of fs.readdirSync(map)) {
    const p = path.join(map, naam);
    const st = fs.statSync(p);
    if (st.isDirectory()) uit.push(...alleJs(p));
    else if (naam.endsWith('.js')) uit.push(p);
  }
  return uit;
}

test('niemand leest x-forwarded-for zelf, behalve wie dat hoort te doen', () => {
  const zondaars = [];
  for (const bestand of alleJs(WORTEL)) {
    if (MAG.has(bestand)) continue;
    const regels = fs.readFileSync(bestand, 'utf8').split('\n');
    regels.forEach((r, i) => {
      // alleen echte CODE, geen commentaar dat over de fout vertelt
      const kaal = r.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
      if (/headers\s*\[\s*['"]x-forwarded-for['"]\s*\]/i.test(kaal) || /req\.get\(\s*['"]x-forwarded-for['"]/i.test(kaal))
        zondaars.push(path.relative(WORTEL, bestand) + ':' + (i + 1) + '  ' + r.trim().slice(0, 90));
    });
  }
  assert.deepEqual(zondaars, [],
    'deze plekken lezen het adres zelf uit de kop; gebruik req.ip, dat is de afgeleide waarheid:\n  ' + zondaars.join('\n  '));
});

/* En de andere kant: req.ip MOET het adres zijn dat de bezoeker NIET kiest.

   Twee standen, en allebei moeten ze kloppen:

   - MET een proxy ervoor (de gewone stand: server/trio.js staat als gateway
     voor de app en plakt het echte adres RECHTS aan de keten). Van rechts lezen
     betekent dan: wat de bezoeker vooraan verzint telt niet mee. Live nagemeten
     op app.rahultravelgroup.com -- twaalf pogingen met telkens een ander
     verzonnen adres liepen na tien tegen de rem: 401 x10, daarna 429.

   - ZONDER proxy, met RTG_PROXY_HOPS=0. Dan is de bezoeker zelf de eerste hop
     en mag hij niets bepalen; alleen het adres van de verbinding telt. Dat is
     de stand die deze toets draait, want die is hier af te dwingen.

   De gevaarlijke stand is een app die RECHTSTREEKS aan het internet hangt met
   de standaard hops=1: dan IS de bezoeker de proxy en kiest hij zijn eigen
   teller. server/opzet/verzoekketen.js waarschuwt daarvoor; deze toets legt
   vast dat hops=0 dan ook echt helpt. */
test('met RTG_PROXY_HOPS=0 kan een bezoeker zijn eigen teller niet kiezen', async () => {
  const { startServer, stop } = require('./helper');
  const srv = await startServer({ env: { SMTP_URL: '', RTG_PROXY_HOPS: '0' } });
  try {
    const uitslagen = [];
    for (let i = 0; i < 12; i++) {
      const r = await fetch(srv.base + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.' + i },
        body: JSON.stringify({ login: 'bestaat-niet@x.nl', password: 'fout' })
      });
      uitslagen.push(r.status);
    }
    assert.ok(uitslagen.includes(429),
      'twaalf mislukte pogingen met telkens een ander VERZONNEN adres horen tegen de rem te lopen; ' +
      'gebeurt dat niet, dan telt de rem op iets wat de bezoeker zelf kiest. Uitslagen: ' + uitslagen.join(','));
  } finally { stop(srv.child); }
});
