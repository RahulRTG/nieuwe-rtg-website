#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE NULMETING VAN DE UNIVERSELE BODEM -- verdwijnt er iets achter betaling?

   SAMENLEVING.md SAM-01: *geen van de zeven werkwoorden van de bodem vraagt een
   betaalde pas.* Deze meter vraagt dat per functie uit de verklaring
   (lib/onvervreemdbaar-verklaring.js) met drie echte verzoeken naast elkaar:

       gratis   een geregistreerd gratis account (RTG Community: tier `guest`
                MET account -- niet de demo-gast zonder account, zie meet())
       RTG      een sessie met de RTG Pass, de goedkoopste betaalde trede
       anoniem  geen sessie

   WAAROM DE RTG PASS ERNAAST EN NIET ALLEEN ANONIEM. De doelgroepmeter
   (scripts/doelgroepbereik.js) houdt elke weigering tegen anoniem aan, en voor
   de gratis sessie leverde dat bij tientallen functies `onbepaald` op: de
   weigering wijkt af van anoniem, dus van buiten niet te zien of het de bewaker
   was of de handler. Dat is eerlijk voor zijn vraag, maar voor DEZE vraag is er
   een scherpere vergelijking. Komt de RTG Pass op dezelfde route WEL langs en
   de gratis sessie niet, dan is het enige verschil tussen die twee de pas -- en
   dan verdwijnt deze route achter betaling. Dat is precies wat SAM-01 verbiedt,
   en het is de vorm die SAMENLEVING.md par. 11.1 vermoedde (101 bestanden
   toetsen op `tier === 'guest'`).

   DE STANDEN PER ROUTE:

     open               de gratis sessie komt langs (geen 401 of 403)
     achter-betaling    de gratis sessie wordt geweigerd, de RTG Pass niet
     ook-rtg-geweigerd  allebei geweigerd: deze route is niet voor leden, en
                        zegt dus niets over betalen
     onbepaald          netwerk of rem (429); telt nergens mee

   Zoals in de doelgroepmeter telt een 400, 404 of 500 als OPEN: de bewaker liet
   de aanroep door. Er gaat een leeg lichaam heen, dus dit gaat over de DEUR en
   niet over de kamer -- of de gratis sessie de functie ook zinnig kan
   gebruiken, staat hier niet.

   DE GRAAD IS `vermoed`, en dat hoort in de uitslag. `achter-betaling` leest een
   verschil tussen twee sessies als een pasverschil. Dat klopt in de gewone
   vorm (een handler die `tier === 'guest'` weigert), maar een handler kan ook
   om een reden weigeren die toevallig alleen de gratis sessie raakt. Daarom
   draagt elke route de foutzin die de gratis sessie kreeg: een mens ziet dan in
   een oogopslag of het een pas was of iets anders.

   PER FUNCTIE EN PER WERKWOORD. Een functie is `open` als geen enkele
   beproefde route achter betaling zit, `deels-achter-betaling` als er routes
   open zijn EN routes achter betaling, en `achter-betaling` als er niets open
   is maar wel een pasweigering. Een werkwoord is `aanwezig` als minstens een
   functie open of deels open is, `verdwenen` als elke gemeten functie achter
   betaling zit -- dat is de overtreding van SAM-01 -- en `geen-eigenaar` als
   de verklaring er geen enkele functie voor noemt.

   WAT HIJ NIET ZEGT. Of de verklaring klopt: die is een VOORSTEL en draagt
   haar aftekening in de uitslag. En of iemand ZONDER account erbij kan: dat
   staat per functie in `zonderAccount`, als informatie, want de bodem belooft
   vandaag alleen de HDI-voordeur zonder account.

   Draaien:  npm run onvervreemdbaar          (print, zakt op een verdwenen werkwoord)
             npm run onvervreemdbaar:vast     (schrijft ONVERVREEMDBAAR.json)
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { WERKWOORDEN, VERKLARING, AFGETEKEND } = require('./lib/onvervreemdbaar-verklaring');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'ONVERVREEMDBAAR.json');
const MAX_PER_FUNCTIE = 8;
const WEIGERSTATUS = new Set([401, 403]);

/* ---- de zuivere classificatie (getoetst in test/onvervreemdbaar.test.js) ---- */

function klasseRoute({ gratis, rtg }) {
  if (!gratis || gratis.onbepaald) return 'onbepaald';
  if (!WEIGERSTATUS.has(gratis.status)) return 'open';
  if (!rtg || rtg.onbepaald) return 'onbepaald';
  if (!WEIGERSTATUS.has(rtg.status)) return 'achter-betaling';
  return 'ook-rtg-geweigerd';
}

function klasseFunctie(standen) {
  const t = { open: 0, 'achter-betaling': 0, 'ook-rtg-geweigerd': 0, onbepaald: 0 };
  for (const s of standen) t[s]++;
  if (!standen.length) return { stand: 'niet-beproefd', telling: t };
  let stand;
  if (t.open && !t['achter-betaling']) stand = 'open';
  else if (t.open) stand = 'deels-achter-betaling';
  else if (t['achter-betaling']) stand = 'achter-betaling';
  else if (t['ook-rtg-geweigerd'] && !t.onbepaald) stand = 'buiten-bereik';
  else stand = 'onbepaald';
  return { stand, telling: t };
}

function klasseWerkwoord(functieStanden) {
  if (!functieStanden.length) return 'geen-eigenaar';
  if (functieStanden.some((s) => s === 'open' || s === 'deels-achter-betaling')) return 'aanwezig';
  if (functieStanden.every((s) => s === 'achter-betaling')) return 'verdwenen';
  return 'onbepaald';
}

/* ---- de meting tegen een wegwerpserver ---- */

/* Een gratis account langs de echte route, nooit een nagebouwd token. Het
   registreren woont in lib/gratisaccount.js, omdat de doelgroepmeter hetzelfde
   gratis lid nodig heeft (SAMENLEVING.md par. 12, stap 4b). */
const { registreerGratis } = require('./lib/gratisaccount');

function onderVoorvoegsel(pad, prefix) {
  if (!pad.startsWith(prefix)) return false;
  const rest = pad.slice(prefix.length);
  return rest === '' || rest[0] === '/';
}

async function klop(basis, route, kop) {
  const url = basis + route.pad.split('/').map((d) => (d.startsWith(':') ? 'proef' : d)).join('/');
  const opties = { method: route.methode, headers: Object.assign({ 'Content-Type': 'application/json' }, kop || {}) };
  if (route.methode !== 'GET' && route.methode !== 'HEAD') opties.body = '{}';
  const r = await fetch(url, opties).catch(() => null);
  if (!r) return { status: 0, onbepaald: true };
  if (r.status === 429) return { status: 429, onbepaald: true };
  let reden = '';
  try { const j = await r.clone().json(); reden = String((j && j.error) || '').slice(0, 120); } catch (e) { /* geen json */ }
  return { status: r.status, reden };
}

async function meet() {
  const { start } = require('./lib/wegwerpserver');
  const { haalDoelgroepen } = require('./lib/doelgroepsessies');
  const { alleRoutes, NIET_AANRAKEN } = require('./lib/routes');
  const { FUNCTIES } = require('../server/functies/register');
  const { stempel } = require('./lib/stempel');

  const uit = {
    stempel: stempel(),
    uitleg: 'De nulmeting van de universele bodem (SAMENLEVING.md par. 11.2): per functie die een werkwoord van de ' +
      'bodem draagt, komt een sessie op de gratis trede langs de deur waar de RTG Pass langskomt? Een werkwoord ' +
      'waarvan elke functie achter betaling zit, is een overtreding van SAM-01.',
    grens: 'Dit meet de DEUR en niet de kamer (een leeg lichaam), en `achter-betaling` heeft de graad vermoed: ' +
      'het leest een verschil tussen de gratis sessie en de RTG Pass als een pasverschil. Daarom staat bij elke ' +
      'route de foutzin die de gratis sessie kreeg. De indeling van functies in werkwoorden is een VERKLARING en ' +
      'geen afleiding, en die is nog door geen mens afgetekend.',
    graad: 'vermoed',
    verklaring: AFGETEKEND,
    werkwoorden: {}, functies: [], overgeslagen: []
  };

  const srv = await start({ naam: 'onvervreemdbaar', gereed: 'ready',
    env: { NODE_ENV: 'test', RTG_DEMO: '1', OFFICE_CODE: 'RTG-OFFICE' } });
  try {
    /* DRIE SESSIES, EN DE EERSTE IS DE ENIGE DIE HIER HET WOORD "GRATIS" DRAAGT.
       De doelgroep `gast` uit lib/doelgroepsessies.js is de DEMO-inlog: tier
       `guest` zonder account. Dat is een bezoeker, geen lid van RTG Community --
       `geenGast()` in server/server.js weigert precies die, en laat een gratis
       account met paspoort door. De eerste versie van deze meter gebruikte de
       demo-gast en vond daardoor "achter betaling" waar het "zonder account"
       was. Het gratis lid wordt daarom hier langs de echte registratieroute
       aangemaakt, en de bezoeker staat ernaast als eigen kolom. */
    const { sessies, overgeslagen } = await haalDoelgroepen(srv.basis, ['gast', 'rtg']);
    uit.overgeslagen = overgeslagen;
    /* EN HET GRATIS ACCOUNT WAAR HET OORDEEL OP STAAT IS GECONTROLEERD. Het
       besluit van 27 september 2026 opende drie hulproutes voor een gratis
       account NA een paspoortcontrole (server/kern/onvervreemdbaar.js). Wie
       met een ongecontroleerd account meet, noemt een route die achter de
       controle zit "achter betaling" -- dezelfde vorm als de eerste meetfout
       hierboven. De controle loopt langs de echte keuring (keurLidGoed uit
       test/helper, zoals scripts/chaos.js die ook leent), en het account
       ZONDER controle staat ernaast als eigen kolom. */
    const gratisAccount = await registreerGratis(srv.basis);
    const ongecontroleerd = await registreerGratis(srv.basis);
    let gecontroleerd = false, keurFout = null;
    if (gratisAccount) {
      try { await require('../test/helper').keurLidGoed(srv.basis, gratisAccount.token, gratisAccount.codenaam); gecontroleerd = true; }
      catch (e) { keurFout = String((e && e.message) || e); }
    }
    if (!gratisAccount) uit.overgeslagen.push({ doelgroep: 'gratis', reden: 'registreren met tier guest leverde geen sessie op' });
    else if (!gecontroleerd) uit.overgeslagen.push({ doelgroep: 'gratis', reden: 'de paspoortcontrole lukte niet: ' + keurFout });
    if (!gratisAccount || !gecontroleerd || !sessies.rtg) {
      uit.klopt = false;
      uit.reden = 'zonder een gecontroleerd gratis account EN een RTG-sessie is er niets te vergelijken; niet gemeten is geen uitslag';
      return uit;
    }
    const kop = (s) => s.draag().kop;
    const gratisKop = { Authorization: 'Bearer ' + gratisAccount.token };
    const ongecontroleerdKop = ongecontroleerd ? { Authorization: 'Bearer ' + ongecontroleerd.token } : null;
    const bezoekerKop = sessies.gast ? kop(sessies.gast) : null;
    const verboden = new Set((NIET_AANRAKEN || []).map((n) => n.pad));
    const routes = alleRoutes().filter((r) => r.pad.startsWith('/api/') && !verboden.has(r.pad));

    const gemeten = new Map();   // dezelfde functie met dezelfde paden hoeft maar een keer
    for (const ww of WERKWOORDEN) {
      const standen = [];
      for (const regel of VERKLARING[ww] || []) {
        let uitslag;
        if (regel.scherm) {
          const r = await fetch(srv.basis + regel.scherm).catch(() => null);
          const open = !!r && r.status === 200;
          uitslag = { scherm: regel.scherm, stand: open ? 'open' : 'onbepaald', zonderAccount: open ? 'open' : 'onbepaald',
            bezoeker: open ? 'open' : 'onbepaald',
            reden: r ? 'status ' + r.status + ' zonder sessie' : 'geen antwoord' };
        } else {
          const f = FUNCTIES.find((x) => x.id === regel.functie);
          const paden = regel.paden || (f && f.paden) || [];
          const sleutel = regel.functie + '|' + paden.join(',');
          if (!gemeten.has(sleutel)) {
            const mijn = routes.filter((r) => paden.some((p) => onderVoorvoegsel(r.pad, p))).slice(0, MAX_PER_FUNCTIE);
            const perRoute = [];
            let anoniemOpen = false, bezoekerOpen = false, achterControle = false;
            for (const r of mijn) {
              const gratis = await klop(srv.basis, r, gratisKop);
              const rtg = await klop(srv.basis, r, kop(sessies.rtg));
              const anoniem = await klop(srv.basis, r, null);
              const bezoeker = bezoekerKop ? await klop(srv.basis, r, bezoekerKop) : null;
              const zonderControle = ongecontroleerdKop ? await klop(srv.basis, r, ongecontroleerdKop) : null;
              if (zonderControle && !zonderControle.onbepaald && WEIGERSTATUS.has(zonderControle.status) &&
                  !WEIGERSTATUS.has(gratis.status)) achterControle = true;
              if (!anoniem.onbepaald && !WEIGERSTATUS.has(anoniem.status)) anoniemOpen = true;
              if (bezoeker && !bezoeker.onbepaald && !WEIGERSTATUS.has(bezoeker.status)) bezoekerOpen = true;
              perRoute.push({ route: r.methode + ' ' + r.pad, stand: klasseRoute({ gratis, rtg }),
                gratis: gratis.status, rtg: rtg.status, bezoeker: bezoeker ? bezoeker.status : null,
                zonderControle: zonderControle ? zonderControle.status : null,
                redenGratis: gratis.reden || undefined });
            }
            const k = klasseFunctie(perRoute.map((x) => x.stand));
            gemeten.set(sleutel, { functie: regel.functie, naam: f ? f.naam : null, paden, stand: k.stand,
              telling: k.telling, zonderAccount: mijn.length ? (anoniemOpen ? 'open' : 'dicht') : 'niet-beproefd',
              bezoeker: !mijn.length || !bezoekerKop ? 'niet-beproefd' : (bezoekerOpen ? 'open' : 'dicht'),
              achterPaspoortcontrole: achterControle,
              routes: perRoute, reden: mijn.length ? undefined : 'geen route van dit huis valt onder ' + paden.join(', ') });
          }
          uitslag = gemeten.get(sleutel);
        }
        standen.push(uitslag.stand);
        uit.functies.push(Object.assign({ werkwoord: ww, waarom: regel.waarom }, uitslag));
      }
      uit.werkwoorden[ww] = { stand: klasseWerkwoord(standen), functies: standen.length };
    }
  } finally { srv.klaar(); }

  const t = { aanwezig: 0, verdwenen: 0, 'geen-eigenaar': 0, onbepaald: 0 };
  for (const w of Object.values(uit.werkwoorden)) t[w.stand]++;
  uit.telling = t;
  uit.achterBetaling = [...new Set(uit.functies.filter((f) => f.stand === 'achter-betaling').map((f) => f.functie))];
  uit.deelsAchterBetaling = [...new Set(uit.functies.filter((f) => f.stand === 'deels-achter-betaling').map((f) => f.functie))];
  /* `klopt` gaat alleen over SAM-01: geen werkwoord verdwenen, en de sessies
     waren er. `geen-eigenaar` is een gat en geen overtreding van SAM-01 -- er
     verdwijnt niets achter betaling wat er nooit was -- en telt hier dus niet;
     hij staat wel in de telling, even groot. */
  uit.klopt = t.verdwenen === 0 && uit.overgeslagen.length === 0;
  return uit;
}

function druk(u) {
  console.log('\nDE UNIVERSELE BODEM -- nulmeting voor de gratis trede (graad: ' + u.graad + ')');
  console.log('verklaring: ' + u.verklaring.stand + '\n');
  if (u.reden) { console.log('  NIET GEMETEN: ' + u.reden); return; }
  for (const [ww, w] of Object.entries(u.werkwoorden)) {
    const kleur = w.stand === 'verdwenen' ? '\x1b[31m' : w.stand === 'aanwezig' ? '' : '\x1b[33m';
    console.log('  ' + kleur + ww.padEnd(18) + w.stand.padEnd(16) + '\x1b[0m' + w.functies + ' functie(s)');
    for (const f of u.functies.filter((x) => x.werkwoord === ww)) {
      const naam = f.scherm || f.functie;
      const t = f.telling ? '  open ' + f.telling.open + ', achter betaling ' + f.telling['achter-betaling'] : '';
      console.log('      ' + naam.padEnd(22) + f.stand.padEnd(24) + t);
    }
  }
  console.log('\n  achter betaling:        ' + (u.achterBetaling.join(', ') || '-'));
  console.log('  deels achter betaling:  ' + (u.deelsAchterBetaling.join(', ') || '-'));
  console.log(u.klopt ? '\nGeen werkwoord verdwenen achter betaling.' : '\nSAM-01 GESCHONDEN OF NIET GEMETEN.');
}

module.exports = { klasseRoute, klasseFunctie, klasseWerkwoord, meet, DOEL };

if (require.main === module) {
  meet().then((u) => {
    druk(u);
    if (process.argv.includes('--vastleggen')) {
      fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
      console.log('geschreven: ONVERVREEMDBAAR.json');
    }
    process.exit(u.klopt ? 0 : 1);
  }).catch((e) => { console.error('de bodemmeter kon niet draaien: ' + ((e && e.message) || e)); process.exit(1); });
}
