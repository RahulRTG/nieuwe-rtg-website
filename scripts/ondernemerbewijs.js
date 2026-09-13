#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE BUSINESS PROOF MAP -- wat kan RTG van een bedrijf werkelijk DRAGEN?

   WAAROM DIT SCRIPT BESTAAT. De vraag "hebben wij genoeg functies voor een
   ondernemer" is hier beantwoord en het antwoord was ja: 160 functies op de
   Business Pass, 57 in de partner-app, 78 genres. De vraag die daarna komt is
   duurder en was onbeantwoord: van welke van die functies is bewezen dat zij
   werkt van klik tot gevolg, onder meer dan een rol, met opslag, rechten,
   herstel en echte foutpaden? Een functielijst telt AANWEZIGHEID; dit telt
   BEWIJS.

   WAT DIT NADRUKKELIJK NIET IS: een dertiende register. Van de twaalf
   bewijslagen die dit huis van een ondernemer-capability eist, worden er acht
   AL gemeten -- alleen onder een andere naam en op een andere korrel, verspreid
   over zeven bestanden die nooit naast elkaar zijn gelegd. Dit script MEET
   NIETS. Het is een PROJECTIE in de vorm van EXECUTION_MAP.json: het leest de
   bestaande registers, legt ze langs de capability waar een ondernemer in
   denkt, en zegt per laag wat er bekend is. Waar geen register spreekt staat
   ONBEKEND met de reden -- nooit een stille nul en nooit een stille groen.

   DRIE REGELS DIE HIJ VAN HET HUIS OVERNEEMT:

     1. DE STRENGSTE TELT. De stand van een capability is de strengste van haar
        twaalf lagen, en de stand van een laag de strengste van haar routes
        (BETROUWBAARHEID.md). Een capability met elf groene lagen en een rode is
        rood.
     2. ONGEMETEN IS GEEN FOUT, EN OOK GEEN GOED. `ONBEKEND` staat naast GROEN
        en ROOD als eigen uitslag (CONTROLPLANE.md: ONBEKEND is met opzet geen
        synoniem van WEIGEREN). Een storing hoort niet te klinken als een
        overtreding, en een ongemeten laag hoort niet te klinken als een bewijs.
     3. ER KOMT GEEN ZESDE GEZAGSVOCABULAIRE (INT-01). De autonomievraag krijgt
        hier GEEN nieuwe A1-A4-ladder. Hij wordt beantwoord met de bestaande
        vier-tredige noemer (GEZAGSNOEMER.json) plus de bestaande bewijspoort
        uit kern/stuur/beleid.js, zoals EXECUTION_MAP.json die al projecteert.

   DE KORREL. De eenheid is de CAPABILITY waarin een ondernemer denkt
   ("personeel aannemen", "voorraad aanvullen") en niet de route. Die eenheid
   wordt niet met de hand verzonnen maar GELEZEN uit server/functies/register/:
   elke functie draagt daar al haar pad-prefixen en haar doelgroepen. De
   toewijzing route -> capability gebruikt de ECHTE resolver
   (server/functies/toegangpad.js, functieVoorPad -- langste prefix wint), want
   een tweede parser naast de productieregel is precies de fout waar
   scripts/lib/routes.js in zijn kop voor waarschuwt.

   DE LEEFTIJDEN LOPEN UITEEN. De bronregisters zijn op verschillende commits
   gemeten (31 augustus tot 12 september). Dat is een LEEFTIJDSVERSCHIL en geen
   tegenspraak (CODE.md), dus elke bron draagt hier haar eigen stempel mee en de
   uitslagen worden nooit over de bronnen heen opgeteld tot een cijfer.

   Draaien:  npm run ondernemerbewijs           (print)
             npm run ondernemerbewijs:vast      (schrijft ONDERNEMERBEWIJS.json)
   ============================================================================ */
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(process.env.RTG_BEWIJS_DOEL ? path.resolve(process.env.RTG_BEWIJS_DOEL) : WORTEL, 'ONDERNEMERBEWIJS.json');
const VAST = process.argv.includes('--vastleggen');

/* ---------------------------------------------------------------------------
   1. DE TWAALF LAGEN, en per laag welk register hem beantwoordt.

   `bron: null` betekent: in dit huis meet niemand deze laag. Dat is een
   uitslag en geen omissie in dit script -- hij staat er met de reden bij, want
   een laag die je weglaat leest als een laag die je haalt (BETROUWBAARHEID.md).
--------------------------------------------------------------------------- */
const LAGEN = [
  { id: 'bereikbaar', naam: 'Bereikbaar', vraag: 'kan de ondernemer er daadwerkelijk komen',
    bron: 'APPWERKT.json', korrel: 'scherm', graad: 'gemeten' },
  { id: 'begrijpelijk', naam: 'Begrijpelijk', vraag: 'begrijpt hij zonder uitleg wat hij moet doen',
    bron: null, korrel: 'mens', graad: 'onbekend',
    reden: 'geen enkel register meet dit. VINDBAAR.json komt het dichtst in de buurt maar meet of je een functie TERUGVINDT met het woord dat erop staat -- dat is vindbaarheid, niet begrijpelijkheid. Deze laag vraagt een mens, geen meter.' },
  { id: 'bedienbaar', naam: 'Bedienbaar', vraag: 'werken alle essentiele knoppen en flows',
    bron: 'APPWERKT.json', korrel: 'scherm', graad: 'gemeten' },
  { id: 'voltooibaar', naam: 'Voltooibaar', vraag: 'kan de volledige taak worden afgemaakt',
    bron: 'ketenproef', korrel: 'keten', graad: 'bewezen',
    reden: 'per ROUTE niet te beantwoorden: APPWERKT.json staat op GEEN_FIXTURE voor alle 102 rijen. Alleen een ketenproef (tafel, rit, toelating) bewijst dit, en dan voor de hele keten tegelijk.' },
  { id: 'waarheidsgetrouw', naam: 'Waarheidsgetrouw', vraag: 'komt de getoonde staat overeen met de werkelijkheid',
    bron: 'ketenproef', korrel: 'keten', graad: 'bewezen',
    reden: 'idem: dit is per definitie een vraag over twee actoren (handelt A, ziet B dat?) en dus ketenwerk. Een losse routetoets kan hem niet stellen.' },
  { id: 'persistent', naam: 'Persistent', vraag: 'bestaat het resultaat na refresh of herstart',
    bron: 'IDEMPROEF.json', korrel: 'route', graad: 'vermoed',
    reden: 'IDEMPROEF.json neemt per route een voor/na-beeld van de opslag en ziet dus of de schrijfactie de collectie werkelijk RAAKTE. Dat is de halve vraag: het bewijst dat het resultaat in de opslag landde, niet dat het een herstart overleeft. Daarom graad `vermoed` en niet `gemeten`.' },
  { id: 'bevoegd', naam: 'Bevoegd', vraag: 'mag de juiste rol het, en de verkeerde niet',
    bron: 'ROLPROEF.json', korrel: 'route', graad: 'gemeten' },
  { id: 'herstelbaar', naam: 'Herstelbaar', vraag: 'beschadigt een storing, timeout of dubbele actie niets',
    bron: 'IDEMPROEF.json', korrel: 'route', graad: 'gemeten' },
  { id: 'uitlegbaar', naam: 'Uitlegbaar', vraag: 'kan RTG aangeven waarom iets gebeurde',
    bron: null, korrel: 'route', graad: 'onbekend',
    reden: 'WAAROM.json lijkt hierop te gaan maar doet het niet: dat zegt per POST-route waarom hij niet te BEWIJZEN valt, in de woorden van de route zelf. Dat is provability, niet uitlegbaarheid naar een gebruiker. Niemand meet of een ondernemer te horen krijgt waarom er iets gebeurde.' },
  { id: 'omkeerbaar', naam: 'Omkeerbaar', vraag: 'kan een actie waar dat logisch is veilig terug',
    bron: 'HERSTELPROEF.json', korrel: 'routepaar', graad: 'gemeten',
    reden: 'let op de naamsbotsing met `herstelbaar` hierboven: dat gaat over een tweede identieke aanroep, dit over een TEGENHANGER die de handeling ongedaan maakt. Twee verschillende vragen, twee verschillende registers.' },
  { id: 'auditbaar', naam: 'Auditbaar', vraag: 'zijn actor, tijdstip, intentie en mutatie aantoonbaar',
    bron: 'AUDITPROEF.json', korrel: 'route', graad: 'gemeten' },
  { id: 'autonoomVeilig', naam: 'Autonoom veilig', vraag: 'mag Rahul dit uitvoeren',
    bron: 'VERTROUWEN.json', korrel: 'route', graad: 'gemeten',
    reden: 'GEEN nieuwe autonomieladder (INT-01). De uitslag is de bestaande bewijspoort: kern/stuur/beleid.js laat een capability zonder bewijs uit de lijst vallen waaruit de AI kiest, en VERTROUWEN.json levert die vervalstaat.' }
];

/* ---------------------------------------------------------------------------
   2. De bronnen inlezen, met hun eigen stempel.
--------------------------------------------------------------------------- */
/* De bronmap is met opzet te verleggen. Niet voor productie -- daar is hij
   altijd de wortel -- maar zodat test/ondernemerbewijs.test.js de projectie op
   GEMUTEERDE registers kan draaien. Een meter die je nooit hebt zien zakken is
   geen meter (LAT-regel 11), en deze kan alleen zakken als je zijn invoer kunt
   vervalsen. */
const BRONMAP = process.env.RTG_BEWIJS_BRON ? path.resolve(process.env.RTG_BEWIJS_BRON) : WORTEL;

function lees(naam) {
  const p = path.join(BRONMAP, naam);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}
const BRON = {
  vertrouwen: lees('VERTROUWEN.json'),
  audit: lees('AUDITPROEF.json'),
  rol: lees('ROLPROEF.json'),
  idem: lees('IDEMPROEF.json'),
  herstel: lees('HERSTELPROEF.json'),
  appwerkt: lees('APPWERKT.json'),
  execmap: lees('EXECUTION_MAP.json'),
  idor: lees('IDOR.json')
};
const ontbreekt = Object.keys(BRON).filter(k => !BRON[k]);
if (ontbreekt.length) {
  /* Lat-regel 3: een meter die zijn invoer niet vindt hoort te ZAKKEN, niet
     stil de gunstigste waarde te geven. Een ontbrekende bron zou hier elke
     laag op ONBEKEND zetten en dat leest als "nog niet gemeten" in plaats van
     "het register is weg". */
  console.error('ondernemerbewijs: bron(nen) ontbreken: ' + ontbreekt.join(', '));
  process.exit(1);
}
const stempels = {};
for (const [k, v] of Object.entries(BRON)) {
  stempels[k] = (v.stempel && v.stempel.op) ? { op: v.stempel.op, commit: v.stempel.commit || null }
                                            : { op: null, commit: null, let: 'dit register draagt geen stempel' };
}

/* ---------------------------------------------------------------------------
   3. De capabilities: uit het functieregister, met de ECHTE resolver.
--------------------------------------------------------------------------- */
const { FUNCTIES } = require(path.join(WORTEL, 'server/functies/register'));
const { functieVoorPad } = require(path.join(WORTEL, 'server/functies/toegangpad'));

/* Wie hoort bij de ondernemerservaring? Niet alleen de twaalf Business-unieke
   functies -- een ondernemer gebruikt zijn hele app. Wel gescheiden gehouden,
   want de twee helften lezen anders:
     werk  de kant die alleen bestaat OMDAT hij ondernemer is
     mee   alles wat elk lid ook krijgt en dus met de pas meekomt */
const ONDERNEMER = new Set(['business', 'leverancier', 'personeel']);
function kantVan(f) {
  const d = f.doelgroepen || [];
  if (d.includes('leverancier') || d.includes('personeel')) return 'werk';
  if (d.includes('business') && !d.includes('rtg')) return 'werk';
  return 'mee';
}
const CAPS = FUNCTIES
  .filter(f => (f.doelgroepen || []).some(d => ONDERNEMER.has(d)))
  .map(f => ({ id: f.id, naam: f.naam, categorie: f.categorie, kant: kantVan(f),
               doelgroepen: f.doelgroepen, paden: f.paden || [], routes: [] }));
const CAP_OP_ID = Object.fromEntries(CAPS.map(c => [c.id, c]));

/* ---------------------------------------------------------------------------
   4. Het route-universum, en de toewijzing aan een capability.

   De registers hebben elk hun eigen sleutelvorm; hier worden ze tot een
   (methode, pad) gebracht. De herkomst per route blijft bewaard, zodat
   zichtbaar is hoeveel routes uberhaupt in een register voorkomen.
--------------------------------------------------------------------------- */
const routes = new Map(); // "METHODE /pad" -> { methode, pad, cap, per-laag-uitslagen }
function routeVan(methode, pad) {
  const sleutel = methode + ' ' + pad;
  let r = routes.get(sleutel);
  if (!r) {
    const f = functieVoorPad(pad);
    r = { methode, pad, cap: (f && CAP_OP_ID[f.id]) ? f.id : null, uitslag: {} };
    routes.set(sleutel, r);
    if (r.cap) CAP_OP_ID[r.cap].routes.push(sleutel);
  }
  return r;
}
function uitRijen(lijst, laag, veld, goed, fout) {
  /* goed/fout zijn verzamelingen van waarden; al het andere is ONBEKEND. */
  for (const rij of Object.values(lijst || {})) {
    if (!rij || !rij.pad || !rij.methode) continue;
    const r = routeVan(rij.methode, rij.pad);
    const v = rij[veld];
    const stand = goed.has(v) ? 'GROEN' : (fout.has(v) ? 'ROOD' : 'ONBEKEND');
    /* De strengste telt, ook binnen een route: dezelfde route komt per ROL
       meermaals voor en een rol die zakt maakt de route rood. */
    const oud = r.uitslag[laag];
    if (!oud || rang(stand) > rang(oud.stand)) r.uitslag[laag] = { stand, waarde: v, reden: rij.reden || null };
  }
}
const RANG = { GROEN: 0, ONBEKEND: 1, ROOD: 2 };
function rang(s) { return RANG[s] === undefined ? 1 : RANG[s]; }

// --- bevoegd: ROLPROEF (acl) ---
uitRijen(BRON.rol.perRoute, 'bevoegd', 'acl', new Set(['dicht']), new Set(['open', 'lek']));
// --- auditbaar: AUDITPROEF ---
uitRijen(BRON.audit.perRoute, 'auditbaar', 'audit', new Set(['bewezen']), new Set(['afwezig', 'gebroken']));
// --- herstelbaar: IDEMPROEF (tweede identieke aanroep) ---
uitRijen(BRON.idem.perRoute, 'herstelbaar', 'idempotentie', new Set(['beschermd']), new Set(['onbeschermd']));
// --- persistent: IDEMPROEF opslag-beeld (graad `vermoed`, zie LAGEN) ---
for (const rij of Object.values(BRON.idem.perRoute || {})) {
  if (!rij || !rij.pad || !rij.methode) continue;
  const r = routeVan(rij.methode, rij.pad);
  const raakte = rij.opslag && rij.opslag.a && Object.values(rij.opslag.a).some(v => v === 'gewijzigd');
  const stand = raakte ? 'GROEN' : 'ONBEKEND';
  const oud = r.uitslag.persistent;
  if (!oud || rang(stand) > rang(oud.stand)) r.uitslag.persistent = { stand, waarde: raakte ? 'opslag-geraakt' : 'geen-schrijfbeeld',
    reden: raakte ? null : 'de proef zag deze route geen collectie veranderen; dat kan een leesroute zijn of een route die de proef niet aan het werk kreeg' };
}
// --- autonoom veilig: VERTROUWEN (vervalstaat) ---
for (const [sleutel, rij] of Object.entries(BRON.vertrouwen.perRoute || {})) {
  const sp = sleutel.indexOf(' ');
  if (sp < 0) continue;
  const r = routeVan(sleutel.slice(0, sp), sleutel.slice(sp + 1));
  const stand = rij.staat === 'bewezen' ? 'GROEN' : (rij.staat === 'geschorst' ? 'ROOD' : 'ONBEKEND');
  r.uitslag.autonoomVeilig = { stand, waarde: rij.staat, reden: rij.reden || null };
}
// --- omkeerbaar: HERSTELPROEF (routeparen) ---
for (const p of Object.values(BRON.herstel.per || {})) {
  if (!p || !p.heen) continue;
  /* HERSTELPROEF kent geen methode; een tegenhanger is per definitie een
     schrijfweg, dus POST. Dat is een AANNAME en staat als zodanig in de
     uitslag -- niet stil overnemen. */
  const r = routeVan('POST', p.heen);
  const stand = (p.uitslag === 'exact' || p.uitslag === 'compensatie') ? 'GROEN'
              : (p.uitslag === 'geen-herstel' ? 'ROOD' : 'ONBEKEND');
  r.uitslag.omkeerbaar = { stand, waarde: p.uitslag, reden: p.reden || null, aanname: 'methode POST aangenomen; HERSTELPROEF.json legt er geen vast' };
}

/* ---------------------------------------------------------------------------
   5. De schermlagen (bereikbaar, bedienbaar) uit APPWERKT.json.

   Die staat op de korrel van een ONDERDEEL uit MAPPEN en niet op een route,
   dus hij wordt niet in het route-universum gemengd maar apart geteld.
--------------------------------------------------------------------------- */
const schermlaag = { bereikbaar: {}, bedienbaar: {} };
for (const laag of ['bereikbaar', 'bedienbaar']) {
  const pb = (BRON.appwerkt.perBewijs || {})[laag] || {};
  schermlaag[laag] = { verdeling: pb,
    bewezen: pb.BEWEZEN || 0,
    totaal: Object.values(pb).reduce((s, n) => s + n, 0) };
}

/* ---------------------------------------------------------------------------
   6. Per capability de twaalf lagen samenstellen.
--------------------------------------------------------------------------- */
function laagVanCap(cap, laag) {
  const def = LAGEN.find(l => l.id === laag.id);
  if (!def.bron) return { stand: 'ONBEKEND', gemeten: 0, totaal: cap.routes.length, graad: 'onbekend', reden: def.reden };
  if (def.korrel === 'scherm') {
    const s = schermlaag[laag.id];
    return { stand: 'ONBEKEND', gemeten: s.bewezen, totaal: s.totaal, graad: 'gemeten',
      reden: 'APPWERKT.json meet per ONDERDEEL en niet per capability; ' + s.bewezen + ' van ' + s.totaal + ' onderdelen bewezen. Niet aan deze capability toe te rekenen zonder die brug.' };
  }
  if (def.korrel === 'keten') {
    return { stand: 'ONBEKEND', gemeten: 0, totaal: cap.routes.length, graad: 'onbekend', reden: def.reden };
  }
  let groen = 0, rood = 0, onbekend = 0;
  const roodVoorbeeld = [];
  for (const sleutel of cap.routes) {
    const u = routes.get(sleutel).uitslag[laag.id];
    if (!u) { onbekend++; continue; }
    if (u.stand === 'GROEN') groen++;
    else if (u.stand === 'ROOD') { rood++; if (roodVoorbeeld.length < 3) roodVoorbeeld.push(sleutel + ' (' + u.waarde + ')'); }
    else onbekend++;
  }
  const stand = rood > 0 ? 'ROOD' : (onbekend > 0 || groen === 0 ? 'ONBEKEND' : 'GROEN');
  return { stand, groen, rood, onbekend, totaal: cap.routes.length, graad: def.graad,
    reden: rood > 0 ? ('zakt op ' + rood + ' route(s): ' + roodVoorbeeld.join(', '))
         : (onbekend > 0 ? (onbekend + ' van ' + cap.routes.length + ' routes niet gemeten') : null) };
}

const rijen = [];
for (const cap of CAPS) {
  const lagen = {};
  for (const l of LAGEN) lagen[l.id] = laagVanCap(cap, l);
  const standen = Object.values(lagen).map(x => x.stand);
  /* De strengste telt. `VERKOOPBAAR` bestaat alleen als alle twaalf groen zijn
     -- en dat is met opzet bijna onhaalbaar, want dat is precies wat de vraag
     "kan ik hier een betalende ondernemer op zetten" waard moet zijn. */
  const stand = standen.includes('ROOD') ? 'GEBLOKKEERD'
              : standen.includes('ONBEKEND') ? 'ONBEWEZEN' : 'VERKOOPBAAR';
  rijen.push({ id: cap.id, naam: cap.naam, categorie: cap.categorie, kant: cap.kant,
               doelgroepen: cap.doelgroepen, paden: cap.paden, routes: cap.routes.length,
               stand, lagen });
}
rijen.sort((a, b) => (b.routes - a.routes) || a.id.localeCompare(b.id));

/* ---------------------------------------------------------------------------
   7. De uitslag.
--------------------------------------------------------------------------- */
const telling = {
  capabilities: rijen.length,
  werk: rijen.filter(r => r.kant === 'werk').length,
  meegeleverd: rijen.filter(r => r.kant === 'mee').length,
  routesToegewezen: [...routes.values()].filter(r => r.cap).length,
  routesZonderCapability: [...routes.values()].filter(r => !r.cap).length,
  verkoopbaar: rijen.filter(r => r.stand === 'VERKOOPBAAR').length,
  onbewezen: rijen.filter(r => r.stand === 'ONBEWEZEN').length,
  geblokkeerd: rijen.filter(r => r.stand === 'GEBLOKKEERD').length
};
const perLaag = {};
/* TWEE TELLINGEN, EN ZE ZEGGEN IETS ANDERS.

   De capability-telling is streng: een capability is pas groen op een laag als
   AL haar routes gemeten zijn en slagen. Bij een capability als `supplier` met
   865 routes betekent een enkele ongemeten route dus onbekend, en dat is
   terecht -- je kunt een ondernemer niet op "grotendeels" zetten.

   Maar die strengheid verbergt hoeveel dekking er werkelijk ligt: een laag die
   op capability-niveau nul groen scoort kan op routeniveau duizenden bewezen
   routes hebben. Daarom staat de route-telling er ONVERKORT naast en worden de
   twee nooit opgeteld of tot een percentage gemengd. */
for (const l of LAGEN) {
  let rg = 0, rr = 0, ro = 0;
  if (l.bron && l.korrel !== 'scherm' && l.korrel !== 'keten') {
    for (const r of routes.values()) {
      if (!r.cap) continue;
      const u = r.uitslag[l.id];
      if (!u) { ro++; continue; }
      if (u.stand === 'GROEN') rg++; else if (u.stand === 'ROOD') rr++; else ro++;
    }
  }
  perLaag[l.id] = { naam: l.naam, bron: l.bron, korrel: l.korrel, graad: l.graad,
    capabilities: {
      groen: rijen.filter(r => r.lagen[l.id].stand === 'GROEN').length,
      rood: rijen.filter(r => r.lagen[l.id].stand === 'ROOD').length,
      onbekend: rijen.filter(r => r.lagen[l.id].stand === 'ONBEKEND').length },
    routes: (l.bron && l.korrel !== 'scherm' && l.korrel !== 'keten')
      ? { groen: rg, rood: rr, onbekend: ro }
      : { let: 'deze laag heeft geen route-korrel; zie `korrel`' },
    reden: l.reden || null };
}

/* ---------------------------------------------------------------------------
   7a. DE KETENS -- de release gate.

   DIT DEEL IS VERKLAARD EN NIET GEMETEN, en dat is met opzet: welke twintig
   ketens geldverdienend zijn, is een BESLUIT van de eigenaar en geen uitkomst
   van een parser. Het staat naast de meting zoals IDEMBESLUIT.json naast
   IDEMPROEF.json staat. Wat hier WEL gemeten wordt, is of er een proef bestaat
   die de keten sluit -- en dat leest hij uit het register van die proef.

   `dekt` is bewust drieledig: een proef die de halve keten loopt heet `deels`
   en nooit `sluit`. Anders is een gate die zichzelf groen rekent.
--------------------------------------------------------------------------- */
const KETENS = [
  { id: 'zaak-live', naam: 'Zaak aanmaken -> live', proef: null,
    waar: 'server/kern/ondernemerpoort.js, routes/supplier/poort.js',
    mist: 'de poort (salonpagina + kassarondleiding + werkrondleiding -> online) is nooit end-to-end gelopen' },
  { id: 'medewerker-dienst', naam: 'Medewerker uitnodigen -> eerste dienst', proef: null,
    waar: 'kern/concern/uitnodiging.js, wervingslink, staff',
    mist: 'de overdracht werkgever -> mens -> rooster kruist drie rollen en is nooit als keten beproefd' },
  { id: 'bestelling-boekhouding', naam: 'Klant -> bestelling -> betaling -> boekhouding', proef: null,
    waar: 'routes/supplier/orders, kern/pay/poort.js, routes/supplier/financien.js',
    mist: 'de naad bestelling -> grootboek. TAFELPROEF stopt bij de afrekening en raakt de boekhouding niet' },
  { id: 'tafel-rekening', naam: 'Reservering -> tafel -> rekening -> loyalty', proef: 'TAFELPROEF.json', dekt: 'deels',
    mist: 'de proef loopt van het openen van een rekening tot de afrekening; reservering ervoor en loyalty erna zitten er niet in' },
  { id: 'factuur-grootboek', naam: 'Factuur -> betaling -> grootboek', proef: null,
    waar: 'routes/supplier/financien.js, kern/lid/facturen.js',
    mist: 'geen proef; en TRAVELCOMMERCE.md par. 9 vond al dat er geen weg was om een verkochte reis te BETALEN' },
  { id: 'ziek-vervanging', naam: 'Ziekmelding -> vervanging -> rooster', proef: null,
    waar: 'vakschema, roosters, PDA',
    mist: 'geen proef; dit is de scherpste onbeproefde keten omdat hij drie mensen en een tijdslot kruist' },
  { id: 'voorraad-ontvangst', naam: 'Voorraad laag -> bestellen -> ontvangst', proef: null,
    waar: 'kern/onderneming/voorraad.js, routes/supplier/groothandel.js',
    mist: 'geen proef; de B2B-kant (zaak koopt in bij groothandel) is nooit als keten gelopen' },
  { id: 'klacht-compensatie', naam: 'Klacht -> compensatie -> afsluiten', proef: null,
    waar: 'kern/service/loop.js, kern/horeca/correctie.js, kern/ledenbalie-zaken.js',
    mist: 'geen proef; SERVICE.md par. 13 vond hier vier fouten die geen enkele toets zag' },
  { id: 'kamer-uitchecken', naam: 'Kamer boeken -> toegang -> uitchecken', proef: null,
    waar: 'routes/supplier/kamers, slimme deuren',
    mist: 'geen proef; de deur is een fysiek gevolg en dat is de duurste soort onbeproefd' },
  { id: 'tweede-vestiging', naam: 'Bedrijf -> tweede vestiging', proef: null,
    waar: 'kern/concern/vestiging.js, kern/concern/entiteit.js',
    mist: 'geen proef; CONCERN.md waarschuwt juist dat een bedrijf niet een KvK is' },
  { id: 'rit', naam: 'Rit aanvragen -> chauffeur -> afrekening', proef: 'RITPROEF.json', dekt: 'sluit',
    mist: null },
  { id: 'toelating', naam: 'Aanvraag -> keuring -> toegelaten zaak', proef: 'TOELATINGSPROEF.json', dekt: 'sluit',
    mist: null },
  { id: 'idee-inschrijving', naam: 'Idee -> rechtsvorm -> inschrijving', proef: null,
    waar: 'kern/onderneming/oprichting.js, rechtsvorm*.js',
    mist: 'geen proef; de hele verkenningslaag van Ondernemers-OS is ongemeten' },
  { id: 'offerte-factuur', naam: 'Offerte -> opdracht -> factuur', proef: null,
    waar: 'kern/onderneming/offertebouw.js, pijplijn.js',
    mist: 'geen proef' },
  { id: 'btw-afdracht', naam: 'Periode -> btw-aangifte -> afdracht', proef: null,
    waar: 'routes/supplier/btw.js, kern/fiscaal/',
    mist: 'geen proef, en dit raakt een geklasseerde fiscale uitspraak -- de gevoeligste categorie' },
  { id: 'salarisrun', naam: 'Uren -> salarisrun -> uitbetaling', proef: null,
    waar: 'zakelijk bankieren (bulkbetalingen), kern/concern/employment.js',
    mist: 'geen proef; geld dat het huis verlaat, dus GELD.md-grens' },
  { id: 'partnersaldo-bank', naam: 'Partnersaldo -> uitbetaling naar bank', proef: null,
    waar: 'kern/pay/, partnersaldo uitbetalen',
    mist: 'geen proef' },
  { id: 'website-domein', naam: 'Eigen website -> eigen domein -> live', proef: null,
    waar: 'zaakweb, eigen domein',
    mist: 'geen proef' },
  { id: 'vacature-aanname', naam: 'Vacature -> sollicitatie -> aanname', proef: null,
    waar: 'routes/supplier/werving',
    mist: 'geen proef; REIZEN.md-reparatie vond hier al dat een aangenomen sollicitant zijn bericht verloor' },
  { id: 'retour-teruggave', naam: 'Retour of derving -> correctie -> teruggave', proef: null,
    waar: 'kern/commerce/retour*.js, kern/horeca/correctie.js',
    mist: 'geen proef; het geldbesluit wordt KLAARGEZET en door een mens uitgevoerd -- die tweede helft is nooit gelopen' }
];
for (const k of KETENS) {
  if (!k.proef) { k.dekt = 'geen'; k.bewijs = null; continue; }
  const reg = lees(k.proef);
  if (!reg) { k.dekt = 'geen'; k.bewijs = { let: 'register ' + k.proef + ' ontbreekt' }; continue; }
  /* DE CIJFERS HETEN NIET OVERAL `gemeten`. De drie ketenproeven zetten hun
     telling in `telling`; een eerdere versie las alleen `gemeten`, kreeg een
     leeg object en kende daarmee `sluit` toe ZONDER ooit naar een schakel te
     kijken. Een gate die groen geeft omdat hij niets leest, is erger dan geen
     gate -- test 6 in test/ondernemerbewijs.test.js heeft dat gevonden en houdt
     het vast. Ontbreken beide, dan is dat een uitslag en geen nul. */
  const g = reg.telling || reg.gemeten || null;
  if (!g || g.schakels === undefined) {
    k.dekt = 'geen';
    k.bewijs = { let: k.proef + ' draagt geen leesbare schakeltelling (`telling` noch `gemeten`); zonder telling is er niets om op te sluiten' };
    continue;
  }
  k.bewijs = { schakels: g.schakels ?? null, gesloten: g.gesloten ?? null,
               storingen: g.storingen ?? null, gehouden: g.gehouden ?? null,
               /* De stempel heeft twee vormen in dit huis: een object met
                  `op`+`commit` (de routeregisters) en een kale datumstring (de
                  drie ketenproeven). Alleen de eerste lezen gaf hier stil null,
                  en een ontbrekende datum laat vervallen bewijs als vers lezen
                  (BESTUUR.md: vervallen bewijs is geen bewijs). */
               stempel: typeof reg.stempel === 'string' ? reg.stempel.slice(0, 10)
                      : (reg.stempel && reg.stempel.op) ? reg.stempel.op.slice(0, 10)
                      : null };
  /* Een proef die niet volledig sluit, dekt niets -- ook niet `deels`. */
  if (g.open || g.stuk || g.gebroken) k.dekt = 'geen';
}
const ketenTelling = {
  totaal: KETENS.length,
  sluit: KETENS.filter(k => k.dekt === 'sluit').length,
  deels: KETENS.filter(k => k.dekt === 'deels').length,
  geen: KETENS.filter(k => k.dekt === 'geen').length
};

/* WELKE LAGEN KUNNEN VANDAAG UBERHAUPT GROEN WORDEN?

   Zonder dit blok leest `VERKOOPBAAR 0` als "wij hebben gemeten en alles zakt",
   en dat is niet wat er staat. Zes van de twaalf lagen hebben op de korrel van
   een capability geen enkele meter, dus zij staan voor ELKE capability op
   ONBEKEND -- ongeacht hoe goed de software is. VERKOOPBAAR is daarmee vandaag
   structureel onbereikbaar, en dat is een uitspraak over de METERS en niet over
   het product. */
const onbereikbaar = LAGEN.filter(l => !l.bron || l.korrel === 'scherm' || l.korrel === 'keten')
  .map(l => ({ laag: l.naam, waarom: l.bron ? ('de bron meet op korrel `' + l.korrel + '` en is niet aan een capability toe te rekenen') : 'geen enkel register meet deze laag' }));

/* ---------------------------------------------------------------------------
   7b. DE BLINDE VLEKKEN -- wat een bron structureel NIET kan zien.

   `onbekend` in de tellingen hierboven heeft twee heel verschillende oorzaken
   en die worden hier uit elkaar gehaald: de proef is er nog niet aan toegekomen
   (inhaalbaar werk), of de proef KAN deze route niet beoordelen (een tekort van
   het instrument). Alleen dat tweede is een ontwerpvraag, en het is het duurste
   soort onbekend omdat geen enkele extra ronde het oplost.

   De grootste post is routes waar de bewaking IN de handler zit in plaats van
   in een bewakerslaag: rollen kruisen meet daar niets, dus over de bevoegdheid
   van die routes zegt dit huis vandaag niets -- en dat ziet er in een telling
   precies hetzelfde uit als "nog niet gemeten".
--------------------------------------------------------------------------- */
function blindeVlek(reg, laag) {
  const uit = { laag, totaalInBron: 0, binnenOndernemer: 0, perReden: {} };
  for (const g of (reg.redenenNietBeproefbaar || [])) {
    for (const sleutel of (g.routes || [])) {
      uit.totaalInBron++;
      const pad = sleutel.slice(sleutel.indexOf(' ') + 1);
      const f = functieVoorPad(pad);
      if (f && CAP_OP_ID[f.id]) {
        uit.binnenOndernemer++;
        uit.perReden[g.reden] = (uit.perReden[g.reden] || 0) + 1;
      }
    }
  }
  return uit;
}
/* NIET FILTEREN OP "leverde niets op". IDEMPROEF.json telt zijn
   niet-beproefbare routes wel maar noemt ze NIET (alleen een aantal per reden),
   dus zijn blinde vlek is hier niet aan een capability toe te rekenen. Die rij
   eruit laten vallen zou hem laten lezen als "geen blinde vlek", en dat is het
   tegenovergestelde van wat er aan de hand is. Hij blijft staan met de reden. */
const blindeVlekken = [blindeVlek(BRON.rol, 'bevoegd'), blindeVlek(BRON.idem, 'herstelbaar')]
  .map(v => {
    if (v.totaalInBron > 0) return v;
    const bron = v.laag === 'herstelbaar' ? BRON.idem : BRON.rol;
    const somm = (bron.redenenNietBeproefbaar || []).reduce((n, g) => n + (g.aantal || 0), 0);
    return { ...v, nietToeTeRekenen: somm,
      reden: 'dit register telt zijn niet-beproefbare routes per reden (' + somm + ' in totaal) maar noemt de routes niet, dus zij zijn niet aan een capability toe te wijzen. Dat is een tekort van de rapportage, geen afwezigheid van blinde vlekken.' };
  });

const uit = {
  soort: 'projectie',
  uitleg: 'Per ondernemer-capability: wat de bestaande registers over haar twaalf bewijslagen zeggen. Dit bestand MEET niets -- het legt zeven registers naast elkaar langs de capability uit server/functies/register/. Waar geen register spreekt staat ONBEKEND met de reden.',
  grens: 'ONBEKEND is geen ROOD en geen GROEN. Een capability heet pas VERKOOPBAAR als alle twaalf lagen groen zijn; dat is met opzet streng. De bronnen zijn op verschillende commits gemeten -- hun stempels staan hieronder en hun uitslagen worden nooit tot een samengesteld cijfer opgeteld.',
  gegenereerdDoor: 'scripts/ondernemerbewijs.js',
  bronnen: stempels,
  lagen: LAGEN.map(l => ({ id: l.id, naam: l.naam, vraag: l.vraag, bron: l.bron, korrel: l.korrel, graad: l.graad, reden: l.reden || null })),
  telling, perLaag,
  standenStructureelOnbereikbaar: {
    let: 'VERKOOPBAAR is vandaag voor geen enkele capability haalbaar. Dat komt niet doordat de software zakt maar doordat ' + onbereikbaar.length + ' van de 12 lagen op deze korrel geen meter hebben. Lees VERKOOPBAAR 0 dus als "de norm is nog niet meetbaar", niet als "alles is stuk".',
    lagen: onbereikbaar },
  blindeVlekken: { uitleg: 'Routes die de bron structureel NIET kan beoordelen. Dit is een tekort van het instrument en niet van de software; het is wel het duurste soort `onbekend`, want geen extra meetronde lost het op.',
                   lijst: blindeVlekken },
  ketens: { uitleg: 'Verklaard, niet gemeten: welke ketens geldverdienend zijn is een besluit. Wat gemeten wordt is of er een proef bestaat die de keten sluit.',
            telling: ketenTelling, lijst: KETENS },
  capabilities: rijen
};

if (VAST) {
  fs.writeFileSync(DOEL, JSON.stringify(uit, null, 1) + '\n');
  console.log('geschreven: ONDERNEMERBEWIJS.json');
}

console.log('\n=== BUSINESS PROOF MAP ===');
console.log('capabilities: ' + telling.capabilities + '  (werkkant ' + telling.werk + ', meegeleverd ' + telling.meegeleverd + ')');
console.log('routes toegewezen: ' + telling.routesToegewezen + '  buiten een ondernemer-capability: ' + telling.routesZonderCapability);
console.log('\nstand:  VERKOOPBAAR ' + telling.verkoopbaar + '   ONBEWEZEN ' + telling.onbewezen + '   GEBLOKKEERD ' + telling.geblokkeerd);
console.log('\nper laag (over ' + rijen.length + ' capabilities):');
for (const l of LAGEN) {
  const p = perLaag[l.id];
  const c = p.capabilities;
  const rt = p.routes.groen === undefined ? '     (geen route-korrel)'
    : ('routes ' + String(p.routes.groen).padStart(4) + ' groen / ' + String(p.routes.rood).padStart(3) + ' rood / ' + String(p.routes.onbekend).padStart(4) + ' onbekend');
  console.log('  ' + l.naam.padEnd(18) + ' caps ' + String(c.groen).padStart(3) + 'G ' + String(c.rood).padStart(3) + 'R ' + String(c.onbekend).padStart(3) + 'O   ' + rt);
}
console.log('\nde tien grootste werkkant-capabilities:');
for (const r of rijen.filter(x => x.kant === 'werk').slice(0, 10)) {
  const g = LAGEN.filter(l => r.lagen[l.id].stand === 'GROEN').length;
  console.log('  ' + r.stand.padEnd(12) + String(r.routes).padStart(4) + ' routes  ' + String(g).padStart(2) + '/12 groen  ' + r.naam);
}

console.log('\nlagen die vandaag voor GEEN capability groen kunnen worden: ' + onbereikbaar.length + '/12');
for (const o of onbereikbaar) console.log('  ' + o.laag.padEnd(18) + o.waarom);
console.log('\nketens (de release gate): sluit ' + ketenTelling.sluit + '   deels ' + ketenTelling.deels + '   geen proef ' + ketenTelling.geen + '   van ' + ketenTelling.totaal);
for (const k of KETENS) console.log('  ' + String(k.dekt).padEnd(6) + k.naam);

for (const v of blindeVlekken) {
  if (v.totaalInBron === 0) {
    console.log('\nblinde vlek in laag `' + v.laag + '`: NIET TOE TE REKENEN (' + v.nietToeTeRekenen + ' routes) -- ' + v.reden.slice(0, 120));
    continue;
  }
  console.log('\nblinde vlek in laag `' + v.laag + '`: ' + v.binnenOndernemer + ' ondernemer-routes zijn niet te beoordelen');
  for (const [r, n] of Object.entries(v.perReden).sort((a, b) => b[1] - a[1]).slice(0, 4))
    console.log('  ' + String(n).padStart(4) + '  ' + r.slice(0, 96));
}
