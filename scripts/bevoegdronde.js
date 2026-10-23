#!/usr/bin/env node
/* ============================================================================
   DE BEVOEGDRONDE -- bewijs 6 (bevoegd) over elk onderdeel uit MAPPEN.

   WAAROM. BETROUWBAARHEID.md rij 6 vraagt: kan een andere rol, een ander gezin
   of een ander bedrijf hier niets? Par. 4f heeft eerst GEMETEN of de schermkant
   daar iets over kan zeggen, en de uitslag splitst de rijen in tweeen:

     LEDENSCHERMEN noemen geen object van hun eigenaar bij id -- niet bij het
       laden (0 van 85 met een vers account, 4 met alle werelden) en niet na de
       tikken van bedienbaar (1 scherm, en dat waren toevallige getallen). Ze
       bakenen af op de SESSIE. Of een vreemde bij andermans object kan, is daar
       een ROUTEvraag, en die meten twee registers al: IDOR.json (zelfde rol,
       ander lid, met A's ids) en ROLPROEF.json (verkeerde rol op een
       schrijfroute). Deze ronde STELT SAMEN: een ledenscherm is bevoegd-BEWEZEN
       als elke route die het scherm aanroept in IDOR.json gemeten is, en elke
       schrijfroute daarvan ook in ROLPROEF.json, allebei vers.
     GEZINSSCHERMEN noemen hun gezinscode wel in het verzoek, dus daar heeft een
       kruisproef aan de schermkant een onderwerp. Deze ronde LOOPT die: gezin A
       opent het scherm, en elk verzoek dat A's code draagt wordt nagespeeld met
       het token van gezin B (A's code blijft staan) en zonder token.

   DE OORDELEN, per rij:
     BEWEZEN        ledenscherm: elke route gemeten en niets gebroken;
                    gezinsscherm: minstens een kruispaar, en B en anoniem werden
       bij elk paar geweigerd terwijl A en B hun eigen code konden gebruiken.
     VOLLEDIGE APPSCENARIO'S mogen een ontbrekende generieke routeprojectie
       aanvullen als de bevoegde actor de hele kernworkflow voltooit EN het
       scenario minstens één vreemde-actorstap expliciet als kruisproef heeft
       uitgevoerd. Een concrete lekbevinding uit IDOR, ROLPROEF of het scenario
       blokkeert altijd; een losse weigering of groene samenvatting telt niet.
     DEFECT         een doorbraak of lek in IDOR.json, een open deur in
                    ROLPROEF.json, of een gezinspaar waarin B met A's code 2xx
                    kreeg. Een DEFECT hoort met de hand nagekeken te worden,
                    zoals IDOR.json dat voor zijn eigen kandidaten doet.
     NIET_GETEST    al het andere, met de reden: een route die in geen van de
                    registers staat (met naam), een scherm zonder routes of
                    zonder eigen adres, een register dat niet vers is, een
                    gezinsscherm dat zijn code niet noemt, en elke rij van een
                    persona waarvoor deze ronde geen generieke proef heeft en
                    waarvoor ook geen expliciete appkruisproef bestaat.

   WAT DIT NIET BEWIJST, en dat staat in elke uitslag: dynamische paden die het
   scherm aan elkaar plakt ('/api/x/' + id) zijn per voorvoegsel niet volledig te
   kennen; een voorvoegsel telt als gemeten als ELKE bekende route eronder
   gemeten is. En een ledenroute die in IDOR.json `publiek` heet, gaf B hetzelfde
   met en zonder A's id -- dat is geen doorbraak, maar ook geen bewijs dat de
   route iets afschermt dat afgeschermd hoort te zijn.

   Draai: node scripts/bevoegdronde.js               (meet, schrijft niets)
          node scripts/bevoegdronde.js --vastleggen  (schrijft BEVOEGD.json)
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'BEVOEGD.json');
const { stempel, versheid } = require('./lib/stempel');
const { ingangVan } = require('./lib/bewijsbron');
const { CONTRACT } = require('./lib/appcontract');
const { beoordeelRolrij } = require('./lib/rolproef');

const GRENS_LID = 'samengesteld uit IDOR.json en ROLPROEF.json per route die het scherm aanroept; een voorvoegsel telt als ' +
  'gemeten als elke bekende route eronder gemeten is; publiek/nagekeken zijn geen bewezen afscherming, en een los ' +
  'gescheiden-label mist de eigen positieve controles; ' +
  'de bekende methoden komen uit de bewijsregisters en vormen geen volledige canonieke route-inventaris; afgebakend ' +
  'leest alleen het antwoord: B kreeg met hetzelfde verzoek geen merkteken van A terug, een stille schrijfactie ziet het niet';
const GRENS_GEZIN = 'alleen de verzoeken die het scherm bij het laden doet en die de gezinscode dragen; B krijgt A\'s code met ' +
  'B\'s eigen token; alleen 401/403 telt als weigering, redirects worden niet gevolgd; ' +
  'A en B moeten met hun eigen code en token 2xx krijgen; de eigen controle vervangt alleen de gezinscode en het token, ' +
  'andere objectidentiteiten worden niet geraden; niet passend ingerichte testdata blijven onbeslist';

/* ---- DE LEDENKANT: SAMENSTELLEN --------------------------------------------- */

/* De twee registers als opzoektabel per PAD (methode los), met hun versheid.
   Een register dat niet vers is, maakt elke ledenrij NIET_GETEST: vervallen
   bewijs is geen bewijs, ook niet als het er netjes uitziet. */
function laadRegisters({ lees, vers } = {}) {
  const l = lees || ((f) => { try { return fs.readFileSync(path.join(WORTEL, f), 'utf8'); } catch (e) { return null; } });
  const v = vers || versheid;
  const uit = { idor: new Map(), rol: new Map(), vervallen: [], bronnen: [],
    voltooi: new Map(), voltooiVervallen: [] };
  for (const [naam, zet] of [['IDOR.json', 'idor'], ['ROLPROEF.json', 'rol']]) {
    const t = l(naam);
    if (t === null) { uit.vervallen.push(naam + ' bestaat niet'); continue; }
    let reg; try { reg = JSON.parse(t); } catch (e) { uit.vervallen.push(naam + ' is geen geldige JSON'); continue; }
    uit.bronnen.push({ register: naam, sha256: crypto.createHash('sha256').update(t).digest('hex'), stempel: reg.stempel });
    const s = reg.stempel && typeof reg.stempel === 'object' ? v(reg.stempel) : { vers: false, reden: 'geen stempel met commit' };
    if (!s.vers) uit.vervallen.push(naam + ': ' + s.reden);
    if (zet === 'idor') {
      /* De zaak-gang (gang 5) meet leveranciersroutes met twee ZAKEN: daar is
         "een ander bedrijf" de vraag, en ledenschermen als Horeca roepen ze aan.
         De paden overlappen niet met de ledengang. */
      for (const [k, w] of [...Object.entries(reg.zaakPerRoute || {}), ...Object.entries(reg.perRoute || {})]) {
        const [methode, pad] = k.split(' ');
        const lijst = uit.idor.get(pad) || [];
        /* Oudere IDOR-rijen bewaren de methode alleen in de sleutel van
           `perRoute` (`POST /api/...`). De bevoegdronde controleert methoden
           later bewust afzonderlijk; zonder normalisatie werd zo'n geldige
           rij daar ten onrechte "bewijs zonder bekende HTTP-methode". Een
           methode die WEL in de rij staat blijft leidend, zodat een verschil
           tussen sleutel en inhoud juist open blijft en niet wordt gladgestreken. */
        lijst.push({ ...w, methode: w.methode || methode,
          routeMethode: methode, routePad: pad }); uit.idor.set(pad, lijst);
      }
    } else {
      uit.rolMeting = reg.gemeten;
      for (const w of reg.perRoute || []) {
        const lijst = uit.rol.get(w.pad) || []; lijst.push(w); uit.rol.set(w.pad, lijst);
      }
    }
  }
  /* De volledige appscenario's mogen een tweede, smallere weg naar bewijs 6
     leveren: alleen als zij hun vreemde-actorproeven expliciet als zodanig
     hebben uitgevoerd. Dit blijft hetzelfde VOLTOOIPROEF-register; er ontstaat
     geen tweede bewijsadministratie. Een ontbrekende of oude voltooiproef maakt
     de routeproeven niet oud en omgekeerd. */
  const naam = 'VOLTOOIPROEF.json';
  const tekst = l(naam);
  if (tekst === null) uit.voltooiVervallen.push(naam + ' bestaat niet');
  else {
    let bron;
    try { bron = JSON.parse(tekst); } catch (e) { uit.voltooiVervallen.push(naam + ' is geen geldige JSON'); }
    if (bron) {
      uit.bronnen.push({ register: naam, sha256: crypto.createHash('sha256').update(tekst).digest('hex'), stempel: bron.stempel });
      const s = bron.stempel && typeof bron.stempel === 'object' ? v(bron.stempel) : { vers: false, reden: 'geen stempel met commit' };
      if (!s.vers) uit.voltooiVervallen.push(naam + ': ' + s.reden);
      for (const [functie, app] of Object.entries(bron.apps || {})) uit.voltooi.set(functie, app.bevoegd);
    }
  }
  return uit;
}

/* Een expliciete appkruisproef bestaat uit twee kanten: de bevoegde actor moet
   de hele kernworkflow voltooien en minstens één gemarkeerde vreemde actor
   moet aantoonbaar buiten blijven. De schakels zelf zijn leidend; een groene
   samenvatting kan een open of ontbrekende schakel niet overstemmen. */
function scenarioOordeel(rij, reg) {
  if (reg.voltooiVervallen.length) return { status: 'NIET_GETEST',
    reden: 'appkruisproef vervallen: ' + reg.voltooiVervallen.join('; ') };
  const bewijs = reg.voltooi.get(rij.functie);
  if (!bewijs || bewijs.nietBeproefd) return { status: 'NIET_GETEST',
    reden: bewijs?.nietBeproefd || 'geen expliciete appkruisproef in VOLTOOIPROEF.json' };
  const schakels = Array.isArray(bewijs.schakels) ? bewijs.schakels : [];
  const eigen = schakels.filter((s) => s.soort === 'bevoegde-workflow');
  const vreemd = schakels.filter((s) => s.soort === 'tegenproef');
  if (eigen.length !== 1 || !vreemd.length) return { status: 'NIET_GETEST',
    reden: 'appkruisproef mist de bevoegde kernworkflow of een expliciete vreemde-actorproef' };
  const stuk = schakels.find((s) => !['gesloten', 'open', 'stuk'].includes(s.stand));
  if (stuk) return { status: 'NIET_GETEST', reden: 'appkruisproef draagt een onbekende schakelstand' };
  const open = schakels.find((s) => s.stand !== 'gesloten');
  if (open || bewijs.sluit !== true) return { status: 'GEBLOKKEERD_DOOR_DEFECT',
    reden: 'appkruisproef sluit niet: ' + (open ? open.wat + ' staat ' + open.stand : 'de proef zegt zelf niet gesloten') };
  const t = bewijs.telling || {};
  if (t.schakels !== schakels.length || t.gesloten !== schakels.length || t.open !== 0 || t.stuk !== 0)
    return { status: 'NIET_GETEST', reden: 'de samenvatting van de appkruisproef spreekt de schakels tegen' };
  return { status: 'BEWEZEN', scenario: true, tegenproeven: vreemd.length,
    reden: 'volledige bevoegde kernworkflow en ' + vreemd.length + ' expliciete vreemde-actorproef/proeven gesloten in VOLTOOIPROEF.json' };
}

function combineerOordelen(route, scenario) {
  /* Een concreet gevonden lek blijft altijd een blokkade, ongeacht een andere
     geslaagde route. Bij ontbrekend bewijs mag een volledige appkruisproef wel
     de kernworkflow kwalificeren; beide bronnen blijven in de reden zichtbaar. */
  if (route.status === 'GEBLOKKEERD_DOOR_DEFECT') return route;
  if (scenario.status === 'GEBLOKKEERD_DOOR_DEFECT') return scenario;
  if (route.status === 'BEWEZEN') return route;
  if (scenario.status === 'BEWEZEN') return { ...scenario,
    reden: scenario.reden + '; de generieke routeprojectie bleef open: ' + route.reden };
  return { ...route, reden: route.reden + '; appkruisproef: ' + scenario.reden };
}

/* `afgebakend` is de vierde gang van de IDOR-proef (scripts/lib/afbakening.js):
   een route zonder id, waar A een merkteken van zichzelf terugkreeg en B met
   hetzelfde verzoek geen enkel daarvan. Dat is een uitgevoerd experiment met een
   open deur als ijking. Een route waar A NIETS van zichzelf zag, heet daar
   onbereikbaar en telt hier dus niet. */
const IDOR_GEBROKEN = new Set(['doorbraak', 'lek']);
const METHODEN = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'CONNECT', 'TRACE']);

function beoordeelIdorRij(rij = {}, { methode = rij.routeMethode || rij.methode, pad = rij.routePad } = {}) {
  if (rij.lek === true || IDOR_GEBROKEN.has(rij.staat))
    return { stand: 'gebroken', reden: rij.lek === true ? 'de IDOR-weigering lekt gegevens' : 'IDOR meldt ' + rij.staat };
  if (!METHODEN.has(methode) || rij.methode !== methode || (rij.routePad && rij.routePad !== pad))
    return { stand: 'open', reden: 'de werkelijk gebruikte IDOR-methode of route is niet aangetoond' };
  if (rij.gang === 'stroom') {
    if (rij.pad !== pad) return { stand: 'open', reden: 'stroomproef hoort bij een andere route' };
    return require('./lib/stroomisolatie').oordeel(rij);
  }
  if (rij.gang === 'gegevensisolatie') {
    if (rij.pad !== pad) return { stand: 'open', reden: 'gegevensbewijs hoort bij een andere route' };
    return require('./lib/gegevensisolatie-oordeel').oordeel(rij);
  }
  if (rij.gang === 'snapisolatie') {
    if (rij.pad !== pad) return { stand: 'open', reden: 'snapbewijs hoort bij een andere route' };
    return require('./lib/snapisolatie-oordeel').oordeel(rij);
  }
  if (rij.gang === 'verificatie-opslag') {
    if (rij.pad !== pad) return { stand: 'open', reden: 'opslagbewijs hoort bij een andere route' };
    return require('./lib/verificatie-isolatie').oordeel(rij);
  }
  const ok = s => Number.isInteger(s) && s >= 200 && s < 300;
  if (rij.staat === 'afgebakend' && rij.gang === 'afbakening' && ok(rij.statusA) && ok(rij.status) &&
      Number.isInteger(rij.merken) && rij.merken > 0 && Array.isArray(rij.voorbeeld) &&
      rij.voorbeeld.length > 0 && rij.voorbeeld.length <= rij.merken && rij.voorbeeld.every(x => typeof x === 'string' && x.length > 0) &&
      Array.isArray(rij.velden) && rij.velden.length === 0 && !(rij.gezien?.length)) {
    return { stand: 'gemeten', reden: 'alleen antwoordafbakening: A zag eigen merktekens, B kreeg op hetzelfde verzoek 2xx zonder die merktekens' };
  }
  if (rij.staat === 'gescheiden') return { stand: 'open',
    reden: 'IDOR bewaart hier geen volledige A-eigen en B-eigen-objectcontrole op dezelfde route en methode; een weigering alleen bewijst geen scheiding' };
  if (rij.staat === 'publiek' || rij.staat === 'nagekeken') return { stand: 'open',
    reden: 'IDOR noemt de route ' + rij.staat + ': ' + (rij.reden || 'geen toelichting') + '; deze smalle duiding is geen ruwe proef van afscherming' };
  return { stand: 'open', reden: 'IDOR draagt geen volledige ruwe antwoordafbakening' };
}

/* Het oordeel over een pad: gebroken, gemeten of open -- met de reden. Een
   niet-GET-methode moet in BEIDE registers staan: IDOR zegt of
   een ander lid erbij kan, ROLPROEF of een andere rol het kan. */
function padOordeel(pad, reg) {
  const i = reg.idor.get(pad) || [];
  const r = reg.rol.get(pad) || [];
  const ids = i.map(x => beoordeelIdorRij(x, { methode: x.routeMethode || x.methode, pad }));
  const breuk = ids.find(x => x.stand === 'gebroken');
  if (breuk) return { stand: 'gebroken', reden: pad + ': ' + breuk.reden };
  const rollen = r.map(beoordeelRolrij);
  const breukRol = rollen.find((x) => x.acl === 'OPEN' || x.privacy === 'LEK');
  if (breukRol) return { stand: 'gebroken', reden: pad + ' staat in ROLPROEF.json met acl ' + breukRol.acl + ' en privacy ' + breukRol.privacy };
  // De registers zijn alleen bewijs voor hun eigen HTTP-methode. GET mag
  // een onbekende POST op hetzelfde pad niet laten meeliften. Net als de
  // rolproef behandelen we iedere niet-GET API-methode als schrijvend.
  if (!i.length) return { stand: 'open', reden: pad + ' staat niet in IDOR.json' };
  if ([...i, ...r].some((x) => !METHODEN.has(x.methode))) {
    return { stand: 'open', reden: pad + ' heeft bewijs zonder bekende HTTP-methode' };
  }
  if (r.length || Object.hasOwn(reg, 'rolMeting')) {
    const g = reg.rolMeting;
    if (Number.isInteger(g?.zijeffecten) && g.zijeffecten > 0)
      return { stand: 'gebroken', reden: 'ROLPROEF.json mat blijvende ongeoorloofde wijzigingen' };
    if (!g || !['zijeffecten', 'blindeRondes'].every(k => Number.isInteger(g[k]) && g[k] === 0))
      return { stand: 'open', reden: 'ROLPROEF.json heeft geen aantoonbaar geslaagde hele meting' };
  }
  const onbeslist = rollen.find(x => x.acl !== 'dicht' || x.privacy !== 'schoon');
  if (onbeslist) return { stand: 'open', reden: pad + ': ' + onbeslist.reden };
  const idorOpen = ids.find(x => x.stand !== 'gemeten');
  if (idorOpen) return { stand: 'open', reden: pad + ': ' + idorOpen.reden };
  for (const methode of new Set([...i, ...r].map((x) => x.methode))) {
    const ids = i.filter((x) => x.methode === methode);
    if (!ids.length) {
      return { stand: 'open', reden: methode + ' ' + pad + ' is niet volledig gemeten in IDOR.json' };
    }
    if (methode !== 'GET' && !r.some((x) => x.methode === methode)) {
      return { stand: 'open', reden: methode + ' ' + pad + ' staat niet in ROLPROEF.json' };
    }
  }
  return { stand: 'gemeten' };
}

function ledenOordeel(rij, reg, { schermroutes, lees, contract = CONTRACT } = {}) {
  if (reg.vervallen.length) return { status: 'NIET_GETEST', reden: 'bewijs vervallen: ' + reg.vervallen.join('; ') };
  /* Gebruik hetzelfde expliciete appcontract als APPWERKT. Interne tabs en
     OS-standen hebben geen eigen URL, maar wel een echte ingang, navigatiestap
     en afgebakende bronbestanden. De brede paginaresolver verloor die context
     en schreef daardoor alle routes van /apps/app.html aan iedere stand toe --
     of verklaarde de stand helemaal onmeetbaar. `ingangVan` valideert voor een
     gewoon scherm bovendien dat een contractdeel werkelijk door dat scherm
     geladen wordt; de bevoegdheidsnorm per gevonden route blijft gelijk. */
  const ing = ingangVan(rij.ingang, contract && contract[rij.functie], { schermroutes, lees });
  if (!ing) return { status: 'NIET_GETEST', reden: 'geen eigen adres: een stand of kiezer binnen de ledenapp' };
  const paden = [...ing.exact];
  /* Een voorvoegsel is een pad dat het scherm zelf aan elkaar plakt. Het telt
     alleen als ELKE route die de registers eronder kennen gemeten is; kennen ze
     er geen, dan is het voorvoegsel open. */
  for (const v of ing.voor) {
    const onder = new Set([...reg.idor.keys(), ...reg.rol.keys()].filter((p) => p.startsWith(v)));
    if (!onder.size) paden.push(v + '*');
    else for (const p of onder) paden.push(p);
  }
  if (!paden.length) return { status: 'NIET_GETEST', reden: 'het scherm roept zelf geen route aan; er is niets te kruisen' };
  const oordelen = [...new Set(paden)].sort().map((p) => (p.endsWith('*')
    ? { stand: 'open', reden: p + ': de registers kennen geen route onder dit voorvoegsel' } : padOordeel(p, reg)));
  const gebroken = oordelen.filter((o) => o.stand === 'gebroken');
  if (gebroken.length) return { status: 'GEBLOKKEERD_DOOR_DEFECT', reden: gebroken[0].reden, routes: paden.length };
  const open = oordelen.filter((o) => o.stand === 'open');
  if (open.length) {
    return { status: 'NIET_GETEST', routes: paden.length, open: open.length,
      reden: open.length + ' van de ' + paden.length + ' routes niet gemeten, o.a. ' + open.slice(0, 3).map((o) => o.reden).join('; ') };
  }
  return { status: 'BEWEZEN', routes: paden.length, reden: 'alle ' + paden.length + ' routes van het scherm gemeten: ' + GRENS_LID };
}

/* ---- DE GEZINSKANT: KRUISEN --------------------------------------------------

   Een paar is een verzoek van A dat A's code draagt, vier keer nagespeeld: als
   A, als B met A's code, zonder token en als B met B's eigen code.
   Beide eigen controles moeten binnenkomen; anders bewijst een weigering
   mogelijk alleen dat de tweede sessie of testfixture niet bruikbaar was. */
function paarOordeel({ a, bEigen, b, anoniem }) {
  const ok = (s) => s >= 200 && s < 300;
  if (!ok(a)) return 'eigenaarWeg';
  if (ok(b)) return 'lek';
  if (ok(anoniem)) return 'openbaar';
  // Een time-out, redirect, validatiefout of serverfout is geen weigering
  // door autorisatie. Ook 404 vereist een eigen verhullingscontract en
  // bewijst hier op zichzelf niet dat de bevoegdheidsgrens is geraakt.
  const geweigerd = (s) => s === 401 || s === 403;
  return ok(bEigen) && geweigerd(b) && geweigerd(anoniem) ? 'gescheiden' : 'onbeslist';
}

function gezinOordeel(paren, { rij, contract = CONTRACT } = {}) {
  if (!paren.length) return { status: 'NIET_GETEST', reden: 'het scherm noemde de gezinscode in geen enkel verzoek; er viel niets te kruisen' };
  const lek = paren.filter((p) => p.uitslag === 'lek');
  if (lek.length) return { status: 'GEBLOKKEERD_DOOR_DEFECT', reden: 'gezin B kreeg ' + lek[0].verzoek + ' met de code van gezin A (' + lek[0].b + ')', paren: paren.length };
  const openbaar = paren.find((p) => p.uitslag === 'openbaar');
  if (openbaar) return { status: 'GEBLOKKEERD_DOOR_DEFECT',
    reden: 'anoniem kreeg ' + openbaar.verzoek + ' met de code van gezin A (' + openbaar.anoniem + ')', paren: paren.length };
  // Gezinsparen uit de gedeelde schil kwalificeren geen aanvullende
  // appcontext. Het bestaande appcontract benoemt die context, niet een
  // uitzonderingslijst in de meter. Een echte lekbevinding hierboven gaat voor.
  const context = rij && contract?.[rij.functie]?.bevoegdContext;
  if (context && context !== 'gezin') return { status: 'NIET_GETEST', paren: paren.length,
    reden: 'vereiste bevoegdheidscontext ' + context + ' niet gemeten: gezinsparen bewijzen alleen de gedeelde schil; eigen appobjecten, rollen en kruiscontroles ontbreken' };
  const gescheiden = paren.filter((p) => p.uitslag === 'gescheiden');
  if (gescheiden.length !== paren.length) return { status: 'NIET_GETEST', paren: paren.length,
    reden: 'niet elk paar bewijst A en B op eigen code binnen, B op A\'s code en anoniem geweigerd met 401/403 (' + paren.map((p) => p.uitslag).join(', ') + ')' };
  return { status: 'BEWEZEN', paren: paren.length,
    reden: gescheiden.length + ' van de ' + paren.length + ' kruisparen gescheiden (beide eigenaren binnen, B met A\'s code en anoniem geweigerd), 0 lek: ' + GRENS_GEZIN };
}

async function meetGezinnen(rijen, base, browser, maakContext, meetIngang) {
  const { ROLLEN } = require('./lib/proefsessies');
  const A = await ROLLEN.gezin.haal(base), B = await ROLLEN.gezin.haal(base);
  if (!A?.code || !B?.code || !A.token || !B.token || A.code === B.code || A.token === B.token) {
    return new Map(rijen.map((r) => [r.functie, { status: 'NIET_GETEST', reden: 'geen twee verschillende gezinssessies' }]));
  }
  const uit = new Map();
  for (const r of rijen) {
    const meet = meetIngang(r);
    if (!meet) { uit.set(r.functie, { status: 'NIET_GETEST', reden: 'geen uitvoerbare ingang' }); continue; }
    const ctx = await maakContext(browser, { rtf_sessie: JSON.stringify(A), rtg_cookieinfo_v1: '1' });
    const page = await ctx.newPage();
    const verzoeken = new Map();
    page.on('request', (q) => {
      const u = new URL(q.url());
      if (!u.pathname.startsWith('/api/')) return;
      const lijf = q.postData() || '';
      if (!(u.href.includes(A.code) || lijf.includes(A.code))) return;
      const k = q.method() + ' ' + u.pathname + u.search + ' ' + lijf;
      if (!verzoeken.has(k)) verzoeken.set(k, { methode: q.method(), url: u.pathname + u.search, lijf, koppen: q.headers() });
    });
    try { await page.goto(base + meet.pad, { waitUntil: 'domcontentloaded', timeout: 20000 }); await page.waitForTimeout(2500); } catch (e) {}
    await ctx.close();
    const paren = [];
    for (const v of verzoeken.values()) {
      const speel = async (van, naar, eigenCode) => {
        const vervang = (s) => {
          const tokenVervangen = String(s || '').split(van).join(naar);
          return eigenCode ? tokenVervangen.split(A.code).join(eigenCode) : tokenVervangen;
        };
        const koppen = { 'content-type': 'application/json' };
        for (const [k, w] of Object.entries(v.koppen || {})) if (/^(authorization|x-)/i.test(k)) koppen[k] = vervang(w);
        try {
          const res = await fetch(base + vervang(v.url), { method: v.methode, headers: koppen,
            redirect: 'manual',
            body: v.methode === 'GET' || v.methode === 'HEAD' ? undefined : vervang(v.lijf) });
          return res.status;
        } catch (e) { return 0; }
      };
      const a = await speel(A.token, A.token), b = await speel(A.token, B.token), anoniem = await speel(A.token, '');
      const bEigen = await speel(A.token, B.token, B.code);
      paren.push({ verzoek: v.methode + ' ' + v.url.split('?')[0], a, bEigen, b, anoniem,
        uitslag: paarOordeel({ a, bEigen, b, anoniem }) });
    }
    uit.set(r.functie, Object.assign(gezinOordeel(paren, { rij: r }), { kruisparen: paren }));
  }
  return uit;
}

async function meet() {
  const { rijen, maakContext, meetIngang } = require('./appwerkt');
  const lijst = rijen();
  const reg = laadRegisters();
  const regels = [];
  const gezin = lijst.filter((r) => r.persona === 'gezin');
  let gezinUit = new Map();
  if (gezin.length) {
    const { laadBrowser } = require(path.join(WORTEL, 'test', 'browser'));
    const pw = laadBrowser({ eigenDriver: false });
    if (!pw) { console.error('Geen browser beschikbaar; de gezinskant meet in een echte browser.'); process.exit(2); }
    const { startServer } = require(path.join(WORTEL, 'test', 'helper.js'));
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bevoegdronde-'));
    const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
    const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    try { gezinUit = await meetGezinnen(gezin, base, browser, maakContext, meetIngang); }
    finally {
      await browser.close();
      try { child.kill(); } catch (e) {}
      try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
    }
  }
  for (const r of lijst) {
    const basis = { functie: r.functie, app: r.app, ingang: r.ingang, persona: r.persona };
    let route;
    if (r.persona === 'lid') route = ledenOordeel(r, reg);
    else if (r.persona === 'gezin') route = gezinUit.get(r.functie);
    else route = { status: 'NIET_GETEST', reden: 'de generieke ronde heeft geen kruisproef voor de persona ' + r.persona };
    regels.push(Object.assign(basis, combineerOordelen(route, scenarioOordeel(r, reg))));
  }
  regels.sort((a, b) => a.functie.localeCompare(b.functie));
  const telling = {};
  for (const r of regels) telling[r.status] = (telling[r.status] || 0) + 1;
  return {
    stempel: stempel(),
    uitleg: 'Bewijs 6 (bevoegd) per onderdeel uit MAPPEN: ledenschermen samengesteld uit IDOR.json en ROLPROEF.json, gezinsschermen met een kruisproef op de gezinscode, en expliciet gemarkeerde vreemde-actorproeven uit de volledige appscenario\'s. Een concreet lek uit een bron blokkeert altijd. Zie de kop van scripts/bevoegdronde.js en BETROUWBAARHEID.md par. 4f.',
    grens: 'leden: ' + GRENS_LID + '. gezinnen: ' + GRENS_GEZIN + '.',
    bronnen: { vervallen: reg.vervallen, registers: reg.bronnen },
    telling,
    regels
  };
}

module.exports = { beoordeelIdorRij, padOordeel, ledenOordeel, paarOordeel, gezinOordeel,
  scenarioOordeel, combineerOordelen, laadRegisters, DOEL };

if (require.main === module) {
  meet().then((u) => {
    console.log('bevoegdronde: ' + u.regels.length + ' onderdelen -- ' + JSON.stringify(u.telling));
    if (u.bronnen.vervallen.length) console.log('  VERVALLEN: ' + u.bronnen.vervallen.join('; '));
    for (const r of u.regels) if (r.status === 'GEBLOKKEERD_DOOR_DEFECT') console.log('  DEFECT  ' + r.app + ': ' + r.reden);
    if (process.argv.includes('--vastleggen')) {
      fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
      console.log('geschreven: BEVOEGD.json');
    }
  }).catch((e) => { console.error('de bevoegdronde kon niet draaien: ' + ((e && e.message) || e)); process.exit(1); });
}
