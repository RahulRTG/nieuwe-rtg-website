#!/usr/bin/env node
/* FAALT HIJ NETJES ALS ER IETS ONDER HEM WEGVALT -- de FAILURE-cel per route.

   WAAROM DIT ER IS. `bewezen` in VERTROUWEN.json eist elf cellen. Tien daarvan
   worden per route gemeten; FAILURE niet. Die kwam alleen uit de ketenronde, en
   die saboteert drie KETENS -- samen twee routes. Voor de andere ~4800 routes
   was `bewezen` daarmee niet onbereikbaar omdat ze slecht zijn, maar omdat er
   nooit een instrument voor is gebouwd. Een cel die niemand kan vullen, is geen
   lat maar een muur.

   DE SABOTAGE IS NIET NIEUW. server/lib/verraad.js draagt negen verraden,
   waarvan er vier echt zijn ingebouwd; hij staat uit zonder RTG_VERRAAD, is
   deterministisch met een seed, en weigert in productie. Deze proef haalt hem
   over ALLE routes in plaats van over drie ketens.

   HET CONTRACT WORDT EERST BEPAALD, EN DAN PAS BEPROEFD. Dat is de kern van dit
   instrument. `schrijf-verloren` over een route die niets hoort op te slaan,
   meet niets en zou als "gezakt" of "ongemeten" een oordeel vellen dat nergens
   op slaat. Daarom eerst een SCHONE ronde, die per route het effectprofiel
   leest uit de meters die dit huis al heeft:

     X-RTG-Effect              wat dit verzoek werkelijk deed (save, mail, sms)
     X-RTG-Effect-Niet-Gemeten waar die meter blind is (bestanden, externe rails)
     X-RTG-Staat               de momentopname van de collecties, om te zien of
                               er DUURZAAM iets veranderde

   Daaruit volgt welk verraad van toepassing is:

     schrijft duurzaam    -> schrijf-faalt EN schrijf-verloren
     stuurt alleen bericht-> geen ingebouwd verraad; ongemeten MET reden
     leest alleen         -> geen ingebouwd verraad voor een leesafhankelijkheid;
                             ongemeten MET reden (de catalogus noemt `cache-oud`,
                             maar die staat er als voornemen en niet als code)
     deed geen werk       -> ongemeten MET de status die de proef terugkreeg

   HET OORDEEL, en dat is de grond die de ketenronde ook gebruikt
   (scripts/lib/ketenproef.js -- clientAntwoord: 2xx is OK, geen antwoord is
   GEEN ANTWOORD, de rest is FAIL):

     2xx terwijl de beloofde toestand er niet is  -> GEZAKT (stil verlies)
     een expliciete fout, en niets half achter    -> BEWEZEN
     het verraad greep niet aan                   -> ONGEMETEN, met reden

   WAT DEZE PROEF NIET KAN, en dat staat in de uitslag en niet alleen hier: de
   ketenronde herstart de server om te zien of een schrijfactie de herstart
   OVERLEEFT (`blijftNaHerstart`). Dat kan niet 4800 keer. Deze proef meet
   duurzaamheid daarom binnen het proces, via de collectiemomentopname. Een
   route die pas bij een herstart zijn belofte breekt, ziet hij niet -- en dat
   is een grens van dit instrument, geen eigenschap van die route.

   EN HIJ REPAREERT NIETS. Een gezakte route blijft gezakt; dit is een meting en
   geen opruimronde. Wie tijdens een bewijsronde repareert, meet zijn eigen
   reparatie.

   Draaien: npm run faalproef            (alle routes, drie rondes)
            node scripts/faalproef.js --max=200
*/
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'FAALPROEF.json');
const argv = process.argv.slice(2);
const MAX = Number((argv.find(a => a.startsWith('--max=')) || '').slice(6)) || 0;
const SEED = 'faalproef-1';

if (require.main !== module) { module.exports = {}; return; }

const { start } = require('./lib/wegwerpserver');
const { haalSleutels, meldSleutels, BASISROLLEN } = require('./lib/proefsleutels');
const { alleRoutes, verdeelOpRol } = require('./lib/routes');
const { plausibelLijf } = require('./lib/rolproef');
const { stempel, eisSchoneBoom } = require('./lib/stempel');

/* De verraden die ECHT zijn ingebouwd (server/lib/verraad.js noemt per regel
   `waar`; een regel zonder plaats is een voornemen). Alleen die kunnen iets
   opwekken, dus alleen die worden gedraaid. */
const TOEPASBAAR = {
  'schrijf-faalt': { wat: 'de schrijfactie mislukt hoorbaar', voor: 'duurzaam' },
  'schrijf-verloren': { wat: 'de schrijfactie wordt bevestigd en niet bewaard', voor: 'duurzaam' }
};

const b = eisSchoneBoom('de faalproef');
if (!b.ok) { console.error('\n  ' + b.reden + '\n'); for (const f of b.bestanden || []) console.error('    ' + f); process.exit(2); }

/* Een ronde: server op, sleutels, wereld, en dan elke route een keer. Geeft per
   route wat er te zien was. */
async function ronde(verraad, lijstUit) {
  const env = { RTG_DEMO: '1', RTG_MAGNAAT_TEST: '1', OFFICE_CODE: 'RTG-OFFICE-PROEF', RTG_STAATLOG: '2' };
  if (verraad) { env.RTG_VERRAAD = verraad; env.RTG_VERRAAD_SEED = SEED; }
  const server = await start({ naam: 'faalproef', env });
  const { basis, klaar } = server;

  const post = async (pad, lijf, tok) => {
    try {
      const r = await fetch(basis + pad, { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
        body: JSON.stringify(lijf || {}) });
      await r.text();
      return { status: r.status, staat: r.headers.get('x-rtg-staat'),
        effect: r.headers.get('x-rtg-effect'), nietGemeten: r.headers.get('x-rtg-effect-niet-gemeten') };
    } catch (e) { return { status: 0, staat: null, effect: null, nietGemeten: null }; }
  };

  const bos = await haalSleutels({ post });
  const { tokens, tokenVoor } = bos;
  const mist = BASISROLLEN.filter(r => !tokens[r]);
  if (mist.length) { klaar(); throw new Error('geen token voor: ' + mist.join(', ')); }
  if (!verraad) meldSleutels(bos);

  let geldLijven = {};
  try {
    const { zetWereldKlaar } = require('./lib/idemwereld');
    const wereld = await zetWereldKlaar({ post, tokens, datamap: server.datamap });
    geldLijven = wereld.perRoute || {};
  } catch (e) { /* zonder wereld meet hij minder, en dat staat in de uitslag */ }

  const lijst = lijstUit || (() => {
    const kandidaten = alleRoutes().filter(r => r.pad.startsWith('/api/') && r.methode !== 'GET');
    const v = verdeelOpRol(kandidaten, Object.keys(tokens).filter(r => tokens[r]));
    const alles = [...v.metRol, ...v.zonderRol.map(r => ({ ...r, rol: null }))];
    return MAX ? alles.slice(0, MAX) : alles;
  })();

  const uit = new Map();
  let vorigeStaat = null, n = 0;
  for (const r of lijst) {
    const tok = r.rol ? tokenVoor(r.rol) : null;
    const lijf = geldLijven[r.methode + ' ' + r.pad] || geldLijven[r.pad] || plausibelLijf(r.pad);
    const a = await post(r.pad, lijf, tok);
    /* DE MOMENTOPNAME IS GLOBAAL, dus de wijziging van DEZE route is het
       verschil met de vorige. Sequentieel aanroepen is daarom geen luxe maar de
       voorwaarde waaronder dit signaal iets betekent. */
    const veranderd = a.staat != null && vorigeStaat != null ? a.staat !== vorigeStaat : null;
    if (a.staat != null) vorigeStaat = a.staat;
    uit.set(r.methode + ' ' + r.pad, { ...a, veranderd, rol: r.rol });
    if (++n % 500 === 0) console.log('      ' + n + '/' + lijst.length);
  }
  klaar();
  await new Promise(res => setTimeout(res, 500));
  return { waarnemingen: uit, lijst };
}

/* Het effectprofiel uit de schone ronde: wat DEED deze route werkelijk. */
function profielVan(w) {
  if (!w) return { soort: 'onbekend', reden: 'geen waarneming' };
  const werkte = w.status >= 200 && w.status < 300;
  if (!werkte) return { soort: 'geen-werk', reden: 'de proef kreeg hem niet aan het werk (status ' + w.status + ')' };
  const effect = String(w.effect || '');
  const slaatOp = /save=[1-9]/.test(effect) || w.veranderd === true;
  const bericht = /(mail|sms)=[1-9]/.test(effect);
  if (slaatOp) return { soort: 'duurzaam', effect };
  if (bericht) return { soort: 'bericht', effect,
    reden: 'deze route stuurt een bericht en slaat niets op; er is geen ingebouwd verraad dat een berichtenrail laat wegvallen' };
  if (w.effect == null) return { soort: 'onmeetbaar', reden: 'dit antwoord droeg geen effectkop (een stromend antwoord zet zijn koppen zelf)' };
  return { soort: 'leest', effect,
    reden: 'geen meetbaar effect; er is geen ingebouwd verraad dat een LEESafhankelijkheid laat wegvallen (de catalogus noemt cache-oud, maar die staat er als voornemen)' };
}

/* Het oordeel per verraad, op de grond van scripts/lib/ketenproef.js:
   2xx is OK, 0 of geen antwoord is GEEN ANTWOORD, de rest is FAIL. */
function oordeel(schoon, met) {
  if (!met) return { staat: 'ongemeten', reden: 'geen waarneming in de verraadronde' };
  const ok = met.status >= 200 && met.status < 300;
  const geenAntwoord = met.status === 0;
  if (geenAntwoord) return { staat: 'ongemeten', reden: 'de server gaf geen antwoord; dat is een crash en geen nette fout, maar deze proef kan niet zien of er iets half bleef staan' };
  if (!ok) return { staat: 'bewezen', reden: 'expliciete fout (status ' + met.status + ') in plaats van een bevestiging' };
  if (met.veranderd === true) return { staat: 'ongemeten', reden: 'het verraad greep hier niet aan: de toestand veranderde gewoon' };
  return { staat: 'gezakt', reden: 'status ' + met.status + ' terwijl de toestand niet veranderde: bevestigd en niet bewaard' };
}

(async () => {
  console.log('\n=== DE FAALPROEF: faalt hij netjes als er iets onder hem wegvalt ===\n');
  console.log('  schone ronde ...');
  const schoon = await ronde(null, null);
  const lijst = schoon.lijst;
  console.log('  routes gereden: ' + lijst.length);

  const profielen = new Map();
  for (const r of lijst) {
    const sleutel = r.methode + ' ' + r.pad;
    profielen.set(sleutel, profielVan(schoon.waarnemingen.get(sleutel)));
  }
  const duurzaam = [...profielen.values()].filter(p => p.soort === 'duurzaam').length;
  console.log('  duurzaam schrijvend: ' + duurzaam + ' | bericht: ' +
    [...profielen.values()].filter(p => p.soort === 'bericht').length + ' | leest: ' +
    [...profielen.values()].filter(p => p.soort === 'leest').length + ' | geen werk: ' +
    [...profielen.values()].filter(p => p.soort === 'geen-werk').length);

  const rondes = {};
  for (const naam of Object.keys(TOEPASBAAR)) {
    console.log('  verraadronde: ' + naam + ' ...');
    rondes[naam] = await ronde(naam, lijst);
  }

  const perRoute = [];
  for (const r of lijst) {
    const sleutel = r.methode + ' ' + r.pad;
    const p = profielen.get(sleutel);
    const rij = { route: sleutel, rol: r.rol, profiel: p.soort, effect: p.effect || null, perVerraad: {} };
    if (p.soort !== 'duurzaam') {
      rij.failure = 'ongemeten';
      rij.reden = p.reden;
      perRoute.push(rij);
      continue;
    }
    let eind = 'ongemeten', reden = null;
    for (const naam of Object.keys(TOEPASBAAR)) {
      const o = oordeel(schoon.waarnemingen.get(sleutel), rondes[naam].waarnemingen.get(sleutel));
      rij.perVerraad[naam] = o;
      /* De STRENGSTE uitkomst telt: gezakt is een bevinding en die wint van een
         geslaagde andere sabotage. Zo kan een route niet groen worden door een
         verraad dat hem toevallig niet raakt. */
      if (o.staat === 'gezakt') { eind = 'gezakt'; reden = naam + ': ' + o.reden; }
      else if (o.staat === 'bewezen' && eind !== 'gezakt') { eind = 'bewezen'; reden = naam + ': ' + o.reden; }
      else if (eind === 'ongemeten') reden = naam + ': ' + o.reden;
    }
    rij.failure = eind; rij.reden = reden;
    perRoute.push(rij);
  }

  const tel = s => perRoute.filter(r => r.failure === s).length;
  const uit = {
    soort: 'meting',
    uitleg: 'De FAILURE-cel per route: faalt hij netjes als er iets onder hem wegvalt. Het contract wordt eerst bepaald uit het gemeten effectprofiel (X-RTG-Effect / X-RTG-Staat) en pas daarna beproefd met het verraad dat daarbij hoort.',
    stempel: stempel(),
    grond: ['server/lib/verraad.js', 'scripts/lib/ketenproef.js (clientAntwoord)', 'server/effectmeter.js', 'server/staatlog.js'],
    grens: 'De ketenronde herstart de server om te zien of een schrijfactie de herstart OVERLEEFT; dat kan niet per route. Duurzaamheid wordt hier binnen het proces gemeten via de collectiemomentopname. Een route die pas bij een herstart zijn belofte breekt, ziet deze proef niet -- dat is een grens van het instrument en geen eigenschap van die route.',
    verraden: TOEPASBAAR,
    gemeten: {
      routes: perRoute.length,
      duurzaamSchrijvend: duurzaam,
      bewezen: tel('bewezen'), gezakt: tel('gezakt'), ongemeten: tel('ongemeten')
    },
    perRoute
  };
  fs.writeFileSync(UITSLAG, JSON.stringify(uit, null, 1) + '\n');
  console.log('\nFAALPROEF.json geschreven');
  console.log('  bewezen ' + uit.gemeten.bewezen + ' | gezakt ' + uit.gemeten.gezakt + ' | ongemeten ' + uit.gemeten.ongemeten);
})().catch(e => { console.error(e); process.exit(1); });
