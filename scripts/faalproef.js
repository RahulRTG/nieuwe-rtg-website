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
const os = require('os');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'FAALPROEF.json');
const argv = process.argv.slice(2);
const MAX = Number((argv.find(a => a.startsWith('--max=')) || '').slice(6)) || 0;
const SEED = 'faalproef-1';

/* ALS GEREEDSCHAP GEEFT HIJ ZIJN KLASSEERDER MEE, en verder niets.

   `profielVan` beslist of een route werk vastlegt of alleen zijn standaard
   klaarzet, en dat oordeel bepaalt of er uberhaupt een verdict volgt. Dat is
   precies het soort beslissing dat een toets moet kunnen naspelen zonder een
   half uur te draaien -- dezelfde grond als test/faalproefvorm.test.js.

   Beide zijn functiedeclaraties en dus gehesen: ze bestaan hier al, ook al
   staan ze verderop in het bestand. */
if (require.main !== module) { module.exports = { profielVan, oordeel }; return; }

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

/* `__map` is intern boekhouden en geen omgevingsvariabele: hem doorgeven zou
   een onbekende sleutel in de serveromgeving zetten. */
const schoonEnv = (e) => { const u = { ...e }; delete u.__map; return u; };

/* Een ronde: server op, sleutels, wereld, en dan elke route een keer. Geeft per
   route wat er te zien was. */
async function ronde(verraad, lijstUit) {
  const env = { RTG_DEMO: '1', RTG_MAGNAAT_TEST: '1', OFFICE_CODE: 'RTG-OFFICE-PROEF', RTG_STAATLOG: '2' };
  if (verraad) { env.RTG_VERRAAD = verraad; env.RTG_VERRAAD_SEED = SEED; }

  /* DE SLEUTELS WORDEN GEMUNT TERWIJL DE SCHIJF NOG HEEL IS.

     Inloggen is zelf een SCHRIJFACTIE. Met `schrijf-faalt` mislukt hij dus, en
     dan strandt de proef op "geen token voor: member, office, supplier" -- niet
     omdat het systeem slecht faalt, maar omdat het instrument niet binnenkomt.
     De eerste vorm hiervan was een dode server (zie ../server/lib/verraadfase.js);
     dit is de tweede, en hij zit een laag hoger.

     De uitweg is dezelfde die scripts/ketenronde.js gebruikt: EEN datamap, TWEE
     servers. De eerste draait schoon en munt de sleutelbos; de tweede start op
     diezelfde map met het verraad aan. Nagemeten dat dit mag: een sessie die
     schoon is gemunt, komt de herstart door (office en supplier antwoorden 200
     op hun eigen routes). Alleen daarom kan de sabotageronde iets meten op de
     ~4100 routes die een rol vragen.

     De schone ronde doet dit NIET: die mag zijn eigen map houden en munt zelf. */
  let voorbereid = null;
  if (verraad) {
    const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-faalproef-'));
    let voor;
    try {
      voor = await start({ naam: 'faalproef-munt', env: { RTG_DEMO: '1', RTG_MAGNAAT_TEST: '1',
        OFFICE_CODE: 'RTG-OFFICE-PROEF', RTG_STAATLOG: '2' }, datamap: map });
    } catch (e) {
      fs.rmSync(map, { recursive: true, force: true });
      return { waarnemingen: new Map(), lijst: lijstUit || [], nietGedraaid:
        'de muntserver kwam niet op: ' + String(e && e.message || e).slice(0, 160) };
    }
    const muntPost = async (pad, lijf, token) => {
      const h = { 'Content-Type': 'application/json' };
      if (token) h.Authorization = 'Bearer ' + token;
      try {
        const r = await fetch(voor.basis + pad, { method: 'POST', headers: h, body: JSON.stringify(lijf || {}) });
        const t = await r.text();
        let data = null; try { data = JSON.parse(t); } catch (e) {}
        return { status: r.status, data };
      } catch (e) { return { status: 0, data: null }; }
    };
    voorbereid = await haalSleutels({ post: muntPost });
    voor.klaar();
    await new Promise(res => setTimeout(res, 800));
    env.__map = map;
  }

  let server;
  try {
    server = await start({ naam: 'faalproef', env: schoonEnv(env), datamap: env.__map });
  } catch (e) {
    if (env.__map) fs.rmSync(env.__map, { recursive: true, force: true });
    /* NIET GEDRAAID IS IETS ANDERS DAN NIETS GEVONDEN. Zonder deze tak zakte de
       hele proef op het eerste verraad dat de opstart niet overleeft, en dan
       bestaat er ook geen uitslag voor het verraad dat het WEL doet. */
    return { waarnemingen: new Map(), lijst: lijstUit || [], nietGedraaid:
      'de wegwerpserver kwam met dit verraad niet op: ' + String(e && e.message || e).slice(0, 200) };
  }
  const { basis, klaar } = server;

  /* HET LICHAAM MOET MEE, en zonder dat heeft deze proef nooit kunnen draaien.

     Hier stond `await r.text();` -- de tekst opgehaald en meteen weggegooid,
     omdat de meting zelf alleen aan de KOPPEN genoeg heeft (x-rtg-staat,
     x-rtg-effect). Dat klopt voor de meting en niet voor de opstart: vier
     regels verderop vraagt haalSleutels() de sleutelbos, en de munters daarin
     lezen `.data.token` uit precies dit antwoord. Zonder lichaam bleef elke
     munter leeg en zakte de proef op `geen token voor: member, office,
     supplier` -- bij de allereerste ronde, voor er iets was gemeten.

     Dit is de EERSTE van twee redenen waarom FAALPROEF.json niet bestond, en
     alleen deze is hier gerepareerd. Met het lichaam erbij loopt de schone
     ronde: sleutels gemunt, routes gereden, profielen bepaald.

     DE TWEEDE STAAT NOG OPEN en is niet met een regel te verhelpen. `schrijf-faalt`
     laat save() GOOIEN, en de opstart schrijft ook (zaaien, migraties). De
     wegwerpserver komt daardoor met dat verraad aan niet op -- gemeten: dood na
     409 ms, ook met een al gezaaide datamap, terwijl diezelfde server zonder
     verraad in 5,7 seconde staat. Deze proef heeft een LEVENDE server nodig om
     al zijn routes te rijden, dus voor haar is dat fataal.

     WAAROM scripts/ketenronde.js er wel mee draait (blindeKetens: 0): die start
     met `magSterven: true` en een stervende server is daar een geldige uitkomst
     -- het systeem faalt hoorbaar, en dat is precies wat die keten meet. Dit
     instrument meet iets anders en kan niet met een dode server verder.

     De uitweg vraagt een besluit dat hier niet thuishoort: het verraad zou pas
     mogen slaan als de opstart klaar is. Een gate op de VERZOEKcontext werkt
     aantoonbaar (de server komt dan in 5,7 s op), maar zet stilletjes de sabotage
     uit op elke achtergrondschrijver -- en `opslagKlaar()` is voor json/sqlite al
     bij de eerste regel waar, dus die grens helpt niet. Dat is een verbouwing aan
     een GEDEELDE sabotagemotor die ook de ketenronde draagt, en die hoort niet
     als bijvangst van deze reparatie.

     Het lichaam wordt hier ontleed en meegegeven; de rest van dit bestand
     gebruikt `data` nergens, dus de meting verandert er geen letter door. */
  const post = async (pad, lijf, tok) => {
    try {
      const r = await fetch(basis + pad, { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
        body: JSON.stringify(lijf || {}) });
      const tekst = await r.text();
      let data = null;
      try { data = JSON.parse(tekst); } catch (e) { data = tekst; }
      return { status: r.status, data, staat: r.headers.get('x-rtg-staat'),
        effect: r.headers.get('x-rtg-effect'), nietGemeten: r.headers.get('x-rtg-effect-niet-gemeten') };
    } catch (e) { return { status: 0, data: null, staat: null, effect: null, nietGemeten: null }; }
  };

  const bos = voorbereid || await haalSleutels({ post });
  const { tokens, tokenVoor } = bos;
  const mist = BASISROLLEN.filter(r => !tokens[r]);
  if (mist.length) {
    klaar();
    if (env.__map) fs.rmSync(env.__map, { recursive: true, force: true });
    /* Geen sleutels is een UITSLAG en geen crash: zonder deze tak stopt de hele
       proef en bestaat er ook geen uitslag voor het verraad dat wel werkte. */
    return { waarnemingen: new Map(), lijst: lijstUit || [], nietGedraaid:
      'geen token voor: ' + mist.join(', ') + (verraad ? ' (met ' + verraad + ' aan)' : '') };
  }
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
    /* DE TWEEDE OPROEP SCHEIDT SCHRIJVEN VAN KLAARZETTEN -- en dat is de tweede
       laag van dezelfde fout die hierboven al een keer is gerepareerd.

       De effectkop is een directe meting en die klopt: `opslag=1` betekent dat
       save() werkelijk is aangeroepen. Maar dit is de EERSTE oproep die deze
       route ooit kreeg, en heel veel leesroutes zetten bij die eerste oproep
       hun standaard klaar (`homekit.overzicht()` legt de woning aan,
       `careOverzicht()` het dossier). Dan schrijft een LEESroute een keer, en
       uit een steekproef van een is dat niet te onderscheiden van een route die
       werk van een lid vastlegt.

       Gemeten over de 24 routes die als `gezakt` in dit register stonden: 22
       schreven bij de eerste oproep en daarna nooit meer -- `/api/dag` staat in
       zijn eigen kop als "die leest alleen", en `/api/office/rechten` is in
       COMMERCIE.md "met opzet uitsluitend lezend". Twee schreven bij ELKE
       oproep (`/api/office/aidata/export`, `/api/office/magnaat/scan`) en die
       twee zijn dus de enige van de vierentwintig over wie dit register een
       oordeel mocht vellen.

       Daarom: wie bij de eerste oproep schrijft, krijgt er een tweede. Blijft
       de teller dan stil, dan was het klaarzetten en geen schrijven. Alleen
       schrijvers krijgen die extra oproep, dus dit kost de ronde ~139 verzoeken
       en geen tweede pass.

       DE GRENS: een route die om en om schrijft (elke tweede oproep) leest hier
       als voorziening. Dat is een bekende blinde vlek van twee steekproeven en
       geen eigenschap van die route; hij staat in de uitslag als `voorziening`
       met de effectkop van beide oproepen erbij, zodat het na te kijken is. */
    let effect2 = null;
    if (!verraad && /opslag=[1-9]/.test(String(a.effect || ''))) {
      const her = await post(r.pad, lijf, tok);
      effect2 = String(her.effect || '');
      if (her.staat != null) vorigeStaat = her.staat;
    }
    uit.set(r.methode + ' ' + r.pad, { ...a, veranderd, effect2, rol: r.rol });
    if (++n % 500 === 0) console.log('      ' + n + '/' + lijst.length);
  }
  klaar();
  await new Promise(res => setTimeout(res, 500));
  /* Wie de datamap aanlevert, ruimt hem op -- klaar() doet dat alleen voor een
     map die de wegwerpserver zelf heeft gemaakt. */
  if (env.__map) fs.rmSync(env.__map, { recursive: true, force: true });
  return { waarnemingen: uit, lijst };
}

/* Het effectprofiel uit de schone ronde: wat DEED deze route werkelijk. */
function profielVan(w) {
  if (!w) return { soort: 'onbekend', reden: 'geen waarneming' };
  const werkte = w.status >= 200 && w.status < 300;
  if (!werkte) return { soort: 'geen-werk', reden: 'de proef kreeg hem niet aan het werk (status ' + w.status + ')' };
  const effect = String(w.effect || '');
  /* DE EFFECTMETER BESLIST, NIET DE MOMENTOPNAME -- en dat is een reparatie.

     Hier stond `slaatOp = /save=[1-9]/ || w.veranderd === true`. Die tweede helft
     is een GLOBALE momentopname, vergeleken met de vorige route in de rij: alles
     wat intussen schrijft (de onderhoudsronde, een wekker, een async staart van
     een eerdere route) wordt toegeschreven aan de route die toevallig daarna
     kwam. Gemeten over 400 routes: 109 heetten `duurzaam`, waarvan er 85 een
     effectkop `geen` droegen -- save() was daar nooit aangeroepen. Van die 85
     leverde er precies EEN een oordeel op; de andere 84 kwamen als "het verraad
     greep hier niet aan" in het register, en dat leest als een bevinding over de
     route terwijl het er een is over de meter.

     De effectkop is de directe meting (server/effectmeter.js telt in save()
     zelf, boven de bundelcheck, dus ook een gebundelde schrijfactie telt mee).
     Beweegt de momentopname zonder dat die teller iets zag, dan is dat geen
     duurzame route maar een niet toe te schrijven waarneming -- eigen soort,
     eigen reden, en GEEN oordeel over hoe hij faalt. */
  /* DE SLEUTELS HETEN `opslag`, `mail` EN `sms` -- zie SOORTEN in
     server/effectmeter.js. Hier stond `/save=[1-9]/`, en die matchte dus NOOIT:
     de oude klassering leunde volledig op de momentopname zonder dat iemand dat
     kon zien, want de regex ernaast suggereerde het tegendeel. Een dode tak in
     een classificatie is erger dan een ontbrekende: hij ziet eruit als dekking. */
  const slaatOp = /opslag=[1-9]/.test(effect);
  const bericht = /(mail|sms)=[1-9]/.test(effect);
  /* KLAARZETTEN IS GEEN SCHRIJVEN, en een oordeel over hoe een route faalt
     hoort alleen over een route te gaan die werkelijk werk vastlegt. Zie de
     tweede oproep in ronde() voor de meting waar dit op rust. */
  if (slaatOp && w.effect2 != null && !/opslag=[1-9]/.test(String(w.effect2))) {
    return { soort: 'voorziening', effect, effect2: w.effect2,
      reden: 'de eerste oproep schreef (' + effect + ') en de tweede niet (' +
        (w.effect2 || 'geen') + '): dit is een route die bij het eerste bezoek ' +
        'zijn standaard klaarzet, geen route die werk vastlegt. Een verraad op de ' +
        'schrijfweg meet hier niets, dus er wordt geen oordeel geveld.' };
  }
  if (slaatOp) return { soort: 'duurzaam', effect };
  if (w.veranderd === true) return { soort: 'onzeker', effect,
    reden: 'de momentopname bewoog maar de effectmeter zag geen save(); die opname is ' +
      'globaal en sequentieel, dus dit kan net zo goed een achtergrondschrijver zijn. ' +
      'Niet aan deze route toe te schrijven, en dus niet te beoordelen.' };
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
  const telSoort = s => [...profielen.values()].filter(p => p.soort === s).length;
  const duurzaam = telSoort('duurzaam');
  console.log('  duurzaam schrijvend: ' + duurzaam + ' | onzeker: ' + telSoort('onzeker') +
    ' | bericht: ' + telSoort('bericht') + ' | leest: ' + telSoort('leest') +
    ' | geen werk: ' + telSoort('geen-werk'));

  const rondes = {};
  const nietGedraaid = {};
  for (const naam of Object.keys(TOEPASBAAR)) {
    console.log('  verraadronde: ' + naam + ' ...');
    rondes[naam] = await ronde(naam, lijst);
    if (rondes[naam].nietGedraaid) {
      nietGedraaid[naam] = rondes[naam].nietGedraaid;
      console.log('      NIET GEDRAAID -- ' + rondes[naam].nietGedraaid);
    }
  }
  const gedraaid = Object.keys(TOEPASBAAR).filter(n => !nietGedraaid[n]);
  if (!gedraaid.length) {
    console.error('\n  Geen enkel verraad kon draaien; er valt niets te oordelen.\n');
    process.exit(2);
  }

  const perRoute = [];
  for (const r of lijst) {
    const sleutel = r.methode + ' ' + r.pad;
    const p = profielen.get(sleutel);
    /* `methode` en `pad` APART, en niet alleen de samengestelde `route`.

       scripts/bewijsmatrix.js bouwt zijn sleutel als `r.methode + ' ' + r.pad`
       -- zo lezen alle registers van deze familie. Dit bestand droeg alleen
       `route`, dus elke sleutel werd 'undefined undefined' en de FAILURE-kolom
       matchte NIETS. Dat is een bedradingsfout die ik zelf heb gemaakt toen ik
       de kolom aansloot, en die niemand kon zien: het register vulde zich, de
       matrix draaide, en er kwam alleen nooit een cel uit.

       De les eronder is die van LAT.md regel 11, nu op bedrading in plaats van
       op een toets: een koppeling die je niet van het ene eind tot het andere
       hebt zien werken, is geen koppeling. test/faalproefvorm.test.js houdt de
       twee vormen sindsdien tegen elkaar aan. */
    const rij = { methode: r.methode, pad: r.pad, route: sleutel,
      rol: r.rol, profiel: p.soort, effect: p.effect || null,
      /* De tweede effectkop hoort in de uitslag en niet alleen in de reden:
         `voorziening` is een oordeel over TWEE metingen, dus beide staan er. */
      effect2: p.effect2 || null, perVerraad: {} };
    if (p.soort !== 'duurzaam') {
      rij.failure = 'ongemeten';
      rij.reden = p.reden;
      perRoute.push(rij);
      continue;
    }
    let eind = 'ongemeten', reden = null;
    /* Alleen de verraden die WERKELIJK gedraaid hebben. Een verraad dat niet kon
       starten mag een route niet stil op `ongemeten` zetten alsof er gemeten is;
       hij staat per route bij naam in perVerraad, met de reden. */
    for (const naam of Object.keys(nietGedraaid)) {
      rij.perVerraad[naam] = { staat: 'niet-gedraaid', reden: nietGedraaid[naam] };
    }
    for (const naam of gedraaid) {
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
    /* WAT ER NIET IS GEMETEN, EN WAAROM -- en niet als een lege waarde. Een
       route die hier `bewezen` heet, is dat op de verraden in `verradenGedraaid`
       en op geen enkel ander. Wie dat verschil wegpoetst, leest een halve meting
       als een hele. */
    verradenGedraaid: gedraaid,
    verradenNietGedraaid: nietGedraaid,
    gemeten: {
      routes: perRoute.length,
      duurzaamSchrijvend: duurzaam,
      /* Apart, en met opzet niet bij `duurzaam` opgeteld: over deze routes zegt
         deze proef niets, en een getal dat twee dingen bij elkaar telt verbergt
         welk van de twee bewoog. */
      nietToeTeSchrijven: telSoort('onzeker'),
      /* APART GETELD, en met opzet niet bij `duurzaam`: dit zijn routes die bij
         hun eerste bezoek hun standaard klaarzetten. Tot deze teller bestond,
         stonden ze als `duurzaam` in de proef en kregen ze een `gezakt` -- 22
         van de 24 gezakte routes waren dit. Een oordeel over een route die
         niets hoort op te slaan, is een beschuldiging zonder grond. */
      voorziening: telSoort('voorziening'),
      bewezen: tel('bewezen'), gezakt: tel('gezakt'), ongemeten: tel('ongemeten'),
      /* DE NOEMER VAN DE MEETWEG. `bewezen` hierboven is bewezen op zoveel van
         de zoveel sabotages -- staat er een nul in `verradenGedraaid`, dan is
         het geen bewijs maar een niet-uitgevoerde proef. */
      verradenInCatalogus: Object.keys(TOEPASBAAR).length,
      verradenGedraaid: gedraaid.length
    },
    perRoute
  };
  fs.writeFileSync(UITSLAG, JSON.stringify(uit, null, 1) + '\n');
  console.log('\nFAALPROEF.json geschreven');
  console.log('  bewezen ' + uit.gemeten.bewezen + ' | gezakt ' + uit.gemeten.gezakt + ' | ongemeten ' + uit.gemeten.ongemeten);
  console.log('  duurzaam schrijvend ' + uit.gemeten.duurzaamSchrijvend + ' | klaarzetters (voorziening) ' + uit.gemeten.voorziening);
  console.log('  gemeten met ' + gedraaid.length + ' van de ' + Object.keys(TOEPASBAAR).length + ' sabotages: ' + gedraaid.join(', '));
  for (const [naam, reden] of Object.entries(nietGedraaid)) console.log('  NIET gedraaid -- ' + naam + ': ' + reden);
})().catch(e => { console.error(e); process.exit(1); });
