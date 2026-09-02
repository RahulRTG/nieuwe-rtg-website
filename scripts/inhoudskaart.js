#!/usr/bin/env node
/* ============================================================================
   DE INHOUDSKAART -- het ware antwoordprofiel van de blinde routes.

   WAAROM DIT ER IS. Na de OUTPUT-band bleven er 145 routes BLIND: er is over
   ze gelogen en geen enkele toets zag het. De sluitweg uit BEWIJSSCHULD.json
   ("per route een toets die het antwoord leest") met de hand schrijven is
   dagenwerk over vijftig domeinen -- en de meeste van die toetsen zouden
   hetzelfde doen: kijken of het antwoord de vorm heeft die het hoort te
   hebben. Dus doen we dat een keer goed: dit script legt per blinde route het
   WARE antwoordprofiel vast (status, sleutels, en welke velden dragend zijn),
   en test/inhoudswacht.test.js dwingt die profielen af. De liegpoort vervangt
   een antwoord door `200 {ok:true}`; elk profiel met meer dan dat is dus een
   toets die de leugen ziet -- en de band meet dat daarna per route na, met
   controlerun en al. Geen truc: het profiel komt uit een eerlijke run, en een
   route waarvan het ware antwoord ZELF kaal {ok:true} is, is eerlijk
   onwaarneembaar en blijft blind met die reden in dit register.

   TWEE GRONDEN OM ONWAARNEEMBAAR TE ZIJN, en ze verschillen wezenlijk. Ze
   staan sinds kort als `grond` in de kaart, zodat een lezer ze uit elkaar kan
   houden zonder een zin te moeten ontleden:

     gelijk-aan-leugen   het ware antwoord IS 200 {ok:true}. De liegpoort
                         verandert er dus niets aan, en geen enkele toets kan
                         het verschil zien -- niet omdat er niemand kijkt, maar
                         omdat er niets te zien is. Wat deze routes waard zijn,
                         zit in hun UITWERKING en hoort op de STATE-as thuis.
     geen-json           het antwoord is geen JSON-object (een CSV-export, een
                         bundel). Een vormcontract op SLEUTELS kan daar niets,
                         maar dat maakt het antwoord niet inhoudsloos: hier
                         valt wel degelijk iets te bewaken, alleen niet met dit
                         register. Zo'n route hoort een eigen inhoudstoets te
                         krijgen (zoals de boekhoud-export er een kreeg in
                         test/eigenaar.test.js), niet een vrijstelling.

   WAT EEN PROFIEL IS, en waarom niet meer dan dit:

     status     de statuscode van het ware antwoord op een plausibele aanroep
     sleutels   de sleutels op het hoogste niveau, gesorteerd
     dragend    de sleutels waarvan de waarde niet leeg was (een getal, een
                niet-lege tekst, een niet-lege lijst of een gevuld object)

   GEEN WAARDEN. Waarden verschillen per run (id's, tijden, teksten); sleutels
   en gevuldheid zijn de vorm van het antwoord, en de vorm is wat de leugen
   sloopt. Wie meer wil borgen dan de vorm schrijft alsnog een echte toets --
   dit register is de vloer, niet het plafond.

   DE KAART STAPELT: een nieuwe run vervangt alleen de routes die hij zelf
   heeft aangeroepen; de rest houdt zijn profiel en zijn op-stempel.

   Draai:  node scripts/inhoudskaart.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { start } = require('./lib/wegwerpserver');
const { alleRoutes, rolVan } = require('./lib/routes');
const { plausibelLijf } = require('./lib/rolproef');
const { stempel } = require('./lib/stempel');
const { haalSleutels, meldSleutels, BASISROLLEN } = require('./lib/proefsleutels');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'INHOUDSKAART.json');
const OUTPUT = path.join(WORTEL, 'OUTPUTPROEF.json');

/* Het profiel van een antwoord: pure functie, los toetsbaar. */
function profielVan(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { sleutels: [], dragend: [], vorm: Array.isArray(data) ? 'lijst' : typeof data };
  }
  const sleutels = Object.keys(data).sort();
  const dragend = sleutels.filter(k => {
    const v = data[k];
    if (v === null || v === undefined || v === '') return false;
    if (typeof v === 'number' || typeof v === 'boolean') return true;
    if (typeof v === 'string') return v.length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return false;
  });
  return { sleutels, dragend, vorm: 'object' };
}

/* Onwaarneembaar: het ware antwoord onderscheidt zich niet van de leugen
   (200 met hoogstens `ok`). Daarover valt met vormen niets te bewaken. */
function onwaarneembaar(status, profiel) {
  return status === 200 && profiel.sleutels.every(k => k === 'ok');
}

/* DE GROND, als pure functie en niet als een zin in het register. Zie de kop:
   'geen-json' en 'gelijk-aan-leugen' lijken op elkaar (allebei onwaarneembaar
   voor DIT register) maar zijn tegengesteld van betekenis, en de outputproef
   handelt er verschillend op. Zolang dit onderscheid alleen in de tekst van een
   reden zat, moest een lezer een zin ontleden om het te zien -- en de enige
   route waar het verschil uitmaakte (de boekhoud-export) stond aan de verkeerde
   kant. Geeft null terug als het antwoord gewoon waarneembaar is. */
function grondVan(status, profiel) {
  if (profiel.vorm !== 'object' || !profiel.sleutels.length) return 'geen-json';
  if (onwaarneembaar(status, profiel)) return 'gelijk-aan-leugen';
  return null;
}

module.exports = { profielVan, onwaarneembaar, grondVan };
if (require.main !== module) return;

(async () => {
  let reg;
  try { reg = JSON.parse(fs.readFileSync(OUTPUT, 'utf8')); }
  catch (e) { console.error('geen OUTPUTPROEF.json; zonder blindenlijst valt er niets in kaart te brengen'); process.exit(2); }
  /* Blind EN onbeslist: allebei zijn het routes zonder toerekenbare
     inhoudstoets, en voor allebei is een vormcontract de sluitweg. DEUREN
     doen niet mee: die worden in elke lie-run gespaard (RTG_LIEG_NIET), dus
     een contract erop kan nooit tot een gerichte meting leiden. */
  const { DEUREN } = require('./mutatie');
  const isDeur = (pad) => DEUREN.split(',').some(d => pad === d || pad.startsWith(d));
  const doel = new Set(Object.entries(reg.perRoute || {})
    .filter(([, c]) => c.staat === 'blind' || c.staat === 'onbeslist')
    .filter(([k]) => !isDeur(k.split(' ')[1]))
    .filter(([k]) => k.split(' ')[1].startsWith('/api/'))
    .map(([k]) => k));
  if (!doel.size) { console.log('geen blinde of onbesliste routes; de kaart heeft niets te doen'); return; }

  /* De rolverdeling, met de PUBLIEKE routes erbij: rolVan() geeft daar niets
     terug en verdeelOpRol zou ze wegleggen, maar een route zonder poort is
     juist de makkelijkste om in kaart te brengen -- gewoon aankloppen zonder
     token. Eigenrollen (boardroom, scim, webauthn, werkplekbaas) blijven
     erbuiten met hun reden: dit instrument heeft er geen sleutel voor. */
  /* `kantoor-op-naam` staat er sinds de sleutelbos hem KAN munten (zie
     ./lib/proefsleutels.js). De kluisdeuren -- een KYC-besluit, een
     documentnummer, aftekenen -- dragen sinds kern/kantoor/kluispoort.js die
     eigenrol, en zonder deze regel viel hun antwoordprofiel terug op de 403 van
     de gedeelde code. Dan beschrijft de kaart de dichte deur in plaats van het
     antwoord erachter, en dat is precies wat dit instrument NIET moet doen. */
  const KENT = new Set(['member', 'office', 'supplier', 'kantoor-op-naam']);
  const routes = [];
  let zonderSleutel = 0;
  for (const r of alleRoutes()) {
    const s = r.methode + ' ' + r.pad;
    if (!doel.has(s)) continue;
    const rol = rolVan(r.bewakers);
    if (!rol) routes.push({ methode: r.methode, pad: r.pad, rol: 'publiek' });
    else if (KENT.has(rol)) routes.push({ methode: r.methode, pad: r.pad, rol });
    else zonderSleutel++;
  }
  const verdeling = { metRol: routes, zonderRol: { length: zonderSleutel } };
  console.log('\n=== DE INHOUDSKAART ===\n');
  console.log('  blinde + onbesliste routes (geen deur): ' + doel.size);
  console.log('  bereikbaar (publiek of bekende rol)   : ' + verdeling.metRol.length);

  const server = await start({ naam: 'inhoudskaart', env: { RTG_DEMO: '1', RTG_MAGNAAT_TEST: '1', OFFICE_CODE: 'RTG-OFFICE-PROEF' } });
  const { basis, klaar } = server;
  const doe = async (methode, pad, lijf, tok) => {
    try {
      const r = await fetch(basis + pad, { method: methode,
        headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
        body: methode === 'GET' || methode === 'HEAD' ? undefined : JSON.stringify(lijf || {}) });
      let data = null; try { data = await r.json(); } catch (e) {}
      return { status: r.status, data };
    } catch (e) { return { status: 0, data: null }; }
  };
  /* De sleutelbos: ./lib/proefsleutels.js. `doe` heeft de methode vooraan, dus
     de bos krijgt hier een post() die daarop aansluit -- geen tweede kopie. */
  const bos = await haalSleutels({ post: (pad, lijf, tok) => doe('POST', pad, lijf, tok) });
  const { tokens } = bos;
  meldSleutels(bos);

  /* Vaste volgorde: de wacht roept straks in dezelfde volgorde aan, zodat de
     opgebouwde toestand (route A maakte iets dat route B ziet) gelijk loopt. */
  const rij = verdeling.metRol.slice().sort((a, b) =>
    (a.methode + ' ' + a.pad).localeCompare(b.methode + ' ' + b.pad));

  const nuOp = new Date().toISOString();
  const vers = {};
  let waarneembaar = 0, kaal = 0, dood = 0;
  for (const r of rij) {
    const uit = await doe(r.methode, r.pad, plausibelLijf(r.pad), tokens[r.rol]);
    const sleutel = r.methode + ' ' + r.pad;
    if (!uit.status) { dood++; continue; }
    const profiel = profielVan(uit.data);
    /* Geen JSON (een bundel, een CSV-export): daar valt met sleutels niets te
       bewaken, en een leeg profiel in de kaart zou een wacht zijn die niets
       wacht. Eerlijk onwaarneembaar, met de vorm als reden. */
    const grond = grondVan(uit.status, profiel);
    if (grond === 'geen-json') {
      kaal++;
      vers[sleutel] = { methode: r.methode, pad: r.pad, rol: r.rol, status: uit.status,
        onwaarneembaar: true, grond: 'geen-json', op: nuOp,
        reden: 'het antwoord is geen JSON-object (vorm: ' + profiel.vorm + '); een vormcontract ' +
          'op sleutels kan hier niets bewaken' };
      continue;
    }
    if (grond === 'gelijk-aan-leugen') {
      kaal++;
      vers[sleutel] = { methode: r.methode, pad: r.pad, rol: r.rol, status: uit.status,
        onwaarneembaar: true, grond: 'gelijk-aan-leugen', op: nuOp,
        reden: 'het ware antwoord is zelf niet van de leugen te onderscheiden (200 met hoogstens ok); ' +
          'hier valt met vormen niets te bewaken -- een echte inhoudstoets moet dieper kijken dan dit register kan' };
      continue;
    }
    waarneembaar++;
    vers[sleutel] = { methode: r.methode, pad: r.pad, rol: r.rol, status: uit.status,
      sleutels: profiel.sleutels, dragend: profiel.dragend, op: nuOp };
  }
  klaar();

  /* Stapelen: vers wint, de rest blijft. */
  let oud = {};
  try { oud = JSON.parse(fs.readFileSync(UITSLAG, 'utf8')).perRoute || {}; } catch (e) {}
  /* Snoeien bij het stapelen: geen niet-/api/-paden (buiten bereik van de
     liegpoort) en geen waarneembaar profiel zonder sleutels -- dat zou een
     wacht zijn die niets wacht. */
  const perRoute = {};
  /* EN GEEN ONWAARNEEMBAAR-CLAIM OVER EEN ROUTE DIE INMIDDELS BEWEZEN IS. Dat
     is een echt geval geweest: de boekhoud-export stond hier als
     onwaarneembaar omdat de sonde `r.json()` op een CSV-lichaam doet en dan
     niets ziet -- terwijl het antwoord juist boordevol inhoud zit. Zodra een
     gerichte meting bewijst dat een toets de leugen wel degelijk merkt, is de
     claim weerlegd, en een weerlegde claim laten staan is erger dan geen
     claim: hij leest als een vrijstelling van het toetsen. */
  const bewezenNu = new Set(Object.entries(reg.perRoute || {})
    .filter(([, c]) => c.staat === 'bewezen').map(([k]) => k));
  let weerlegd = 0;
  for (const [k, v] of Object.entries({ ...oud, ...vers })) {
    if (!k.split(' ')[1].startsWith('/api/')) continue;
    if (!v.onwaarneembaar && (!v.sleutels || !v.sleutels.length)) continue;
    if (v.onwaarneembaar && bewezenNu.has(k)) { weerlegd++; continue; }
    perRoute[k] = v;
  }

  fs.writeFileSync(UITSLAG, JSON.stringify({
    stempel: stempel(),
    uitleg: 'Het ware antwoordprofiel per blinde route (status, sleutels, dragende velden), vastgelegd ' +
      'van een eerlijke run op een wegwerpserver. test/inhoudswacht.test.js dwingt deze profielen af; ' +
      'de liegpoort vervangt een antwoord door 200 {ok:true}, dus elk profiel met meer dan dat ziet de ' +
      'leugen. De kaart stapelt: een nieuwe run vervangt alleen wat hij zelf aanriep.',
    grens: 'Een profiel borgt de VORM van het antwoord, niet de waarheid van de waarden -- dit is de ' +
      'vloer, geen plafond. Routes met onwaarneembaar:true zijn eerlijk niet te bewaken op vorm en ' +
      'blijven blind. En de kaart kent alleen rollen waarvoor dit instrument een token heeft.',
    gemeten: { doelRoutes: doel.size, inKaart: Object.keys(perRoute).length,
      waarneembaar: Object.values(perRoute).filter(p => !p.onwaarneembaar).length,
      onwaarneembaar: Object.values(perRoute).filter(p => p.onwaarneembaar).length,
      versDezeRun: Object.keys(vers).length, zonderRol: verdeling.zonderRol.length, dood,
      weerlegd },
    perRoute
  }, null, 1) + '\n');
  if (weerlegd) console.log('  weerlegde onwaarneembaar-claims verwijderd: ' + weerlegd);
  console.log('  waarneembaar profiel         : ' + waarneembaar);
  console.log('  onwaarneembaar (kaal ok)     : ' + kaal);
  console.log('  zonder token voor de rol     : ' + verdeling.zonderRol.length);
  console.log('  niet bereikbaar              : ' + dood);
  console.log('\n  weggeschreven in INHOUDSKAART.json\n');
})().catch(e => { console.error('de inhoudskaart viel om: ' + (e && e.stack || e)); process.exit(2); });
