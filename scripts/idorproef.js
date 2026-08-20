#!/usr/bin/env node
/* ============================================================================
   DE IDOR-PROEF -- kan de VERKEERDE PERSOON bij het object van een ander?

   De rolproef kruist ROLLEN (een supplier op een member-route) en legt EEN
   foutklasse expliciet buiten zijn grens: twee mensen met DEZELFDE rol, de
   een die bij het dossier van de ander komt. Dat is IDOR, en het is de
   sluitweg die BEWIJSSCHULD.json bij de post `objectpoort` (106 routes)
   noemt. Dit instrument pakt hem op.

   HOE. Twee ECHTE leden (auth/register geeft elk een eigen sleutel, user-<id>;
   de demo-tiers delen hun sleutel en deugen hier dus niet). Lid A gaat langs
   alle member-schrijfroutes en OOGST wat hij terugkrijgt in de objectpool
   (scripts/lib/objectpool.js): echte id's van objecten die aan A toebehoren of
   die A mocht zien. Daarna probeert lid B DEZELFDE routes, met een lijf dat met
   A's id's is verrijkt. Wat B dan krijgt, oordeelt scripts/lib/idor.js.

   DE OPZET IS DIE VAN DE ANDERE PROEVEN: een eigen wegwerpserver met een eigen
   datamap (nooit de ontwikkeldata), en aankloppen met de rol die past. De
   proef MUTEERT: hij maakt twee accounts en stuurt schrijfverzoeken. Vandaar
   de wegwerpmap.

   DE EERLIJKE GRENS, en die staat ook in scripts/lib/idor.js: een 2xx van B is
   een BEVINDING, geen vonnis. Het object kan publiek zijn. Elke doorbraak
   hoort met de hand nagekeken; de proef meldt ze als vraag, niet als lek.

   Draai:  node --experimental-sqlite scripts/idorproef.js
           node --experimental-sqlite scripts/idorproef.js --vastleggen
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { start } = require('./lib/wegwerpserver');
const { alleRoutes, verdeelOpRol } = require('./lib/routes');
const { plausibelLijf } = require('./lib/rolproef');
const { maakPool } = require('./lib/objectpool');
const { oordeelIdor } = require('./lib/idor');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'IDOR.json');

/* NAGEKEKEN, EN GEEN LEK -- met de reden erbij, zoals de omgevingsruis in de
   staatproef. Een doorbraak is een VRAAG; deze zijn met de hand beantwoord.
   Het gemeenschappelijke patroon: de route haalt de eigenaar uit de SESSIE
   (req.session.key), niet uit het lijf, en zoekt het id op in de EIGEN
   namespace van de aanvrager. A's geoogste id bestaat ook in B's namespace
   omdat de demo-seed elk lid dezelfde standaard-inrichting geeft -- B bedient
   dus zijn EIGEN object, niet dat van A. Een route die hier NIET op staat en
   toch een doorbraak geeft, is een nieuwe vraag en hoort nagekeken. */
const NAGEKEKEN = {
  'POST /api/boeken/boek': 'de huisbibliotheek is publiek; een boek-id is geen persoonlijk object',
  'POST /api/foodcourt/tijden': 'openingstijden van een restaurant zijn publiek',
  'POST /api/gemeente/afspraak': 'eigenaar uit req.session; het id valt in B\'s eigen namespace',
  'POST /api/gemeente/burgerzaken/slots': 'publieke slots op soort+datum, geen persoonlijk object',
  'POST /api/gemoed/zet': 'eigenaar uit req.session.key; seed-gedeeld id in B\'s eigen namespace',
  'POST /api/home/zet': 'homekit.zet zoekt het apparaat in woningVan(B); seed-gedeeld id, B\'s eigen apparaat',

  /* DE OOGST VAN DE HERSTELDE SESSIE. Toen de proef ophield zichzelf uit te
     loggen, groeide de objectpool van 120 naar 428 velden en kwamen er achttien
     nieuwe doorbraak-kandidaten boven water. Alle achttien zijn nagelopen in de
     code; geen ervan is een lek. Ze vallen in vier patronen, en die patronen
     zijn de moeite waard om te kennen, want ze komen terug:

       1  DE WINKEL. Een catalogus-id is geen persoonlijk object. B installeert
          een app of leest een reisgids uit dezelfde publieke etalage als A, en
          het resultaat landt in B's eigen bibliotheek (req.session.key).
       2  HET SOCIALE WERKWOORD. Liken, reageren, melden en bewaren HOREN op
          andermans bericht te werken -- anders is er geen sociaal netwerk. De
          handelende persoon komt uit de sessie, en het bericht moet door
          zichtbaar() heen. Bij de versiegeschiedenis staat het er zelfs met
          zoveel woorden bij: "elke vorige versie blijft staan, en iedereen kan
          hem lezen. Een correctie mag; ongemerkt herschrijven niet."
       3  IETS NIEUWS VOOR JEZELF. Een kanaal aanmelden of een KVK-inschrijving
          doen maakt een object voor de AANVRAGER. Het id uit A's lijf wordt
          genegeerd; het nieuwe nummer wordt afgeleid uit de eigen sleutel.
       4  DE CODE IS DE SLEUTEL. Een vergaderkamer werkt zoals een vergaderlink:
          wie de code heeft, mag erin -- en een BESLOTEN kamer weigert alsnog
          (magErin). Dat is de bedoelde vorm, geen omzeiling ervan. */
  'POST /api/mall/apps/installeer': 'catalogus-id; appbieb.installeer(req.session.key, id) zet de app in B\'s eigen bibliotheek',
  'POST /api/mall/apps/weg': 'zelfde bibliotheek, zelfde sleutel: B verwijdert uit zijn EIGEN lijst',
  'POST /api/mall/bestel': 'de winkelcatalogus is publiek en de bestelling draagt B\'s eigen naam en adres; er wordt geen bestaand object van A aangeraakt',
  'POST /api/mall/reis/installeer': 'reisgids uit de publieke bieb, geinstalleerd op req.session.key',
  'POST /api/mall/reis/lees': 'leest een publieke reisgids; er is geen eigenaar om te schenden',
  'POST /api/mall/reis/weg': 'verwijdert uit B\'s eigen bibliotheek',
  'POST /api/mall/rtf/installeer': 'zelfde publieke bieb, andere etage',
  'POST /api/mall/rtf/weg': 'verwijdert uit B\'s eigen bibliotheek',
  'POST /api/meet/kom': 'een kamercode werkt als een vergaderlink: wie hem heeft mag binnen, en een BESLOTEN kamer weigert alsnog (magErin). B komt binnen als B, met zijn eigen codenaam',
  'POST /api/member/pulse/bewaar': 'een bladwijzer op andermans bericht, in B\'s EIGEN plank; het bericht moet door zichtbaar() heen',
  'POST /api/member/pulse/like': 'liken hoort op andermans bericht te werken; de like staat op B\'s sleutel en het bericht moet zichtbaar zijn',
  'POST /api/member/pulse/meld': 'melden hoort juist op andermans bericht te werken -- dat is de knop',
  'POST /api/member/pulse/post': 'pulsePost(key, naam, tekst) negeert het id uit het lijf en schrijft een NIEUW bericht van B',
  'POST /api/member/pulse/reactie': 'reageren op een zichtbaar bericht; de reactie staat op B\'s naam',
  'POST /api/member/pulse/versies': 'de versiegeschiedenis staat met opzet open voor iedereen die het bericht mag zien -- dat is de voorwaarde waaronder bewerken eerlijk blijft',
  'POST /api/overheid/kvk/inschrijven': 'het kvknummer uit het lijf wordt genegeerd; het nieuwe nummer volgt uit B\'s eigen sleutel, en een tweede inschrijving op dezelfde sleutel geeft 409',
  'POST /api/podium/kanaal/aanmeld': 'kanaalMaak(req.session.key, ...) meldt een kanaal aan VOOR B; de makerkey uit het lijf wordt nergens gelezen',
  'POST /api/podium/meld': 'een kanaal melden hoort op andermans kanaal te werken; de melder is codenaamVan(req.session.key)'
};
const argv = process.argv.slice(2);
const MAX = Number((argv.find(a => a.startsWith('--max=')) || '').slice(6)) || 0;
const VASTLEGGEN = argv.includes('--vastleggen');

if (require.main !== module) { module.exports = {}; return; }

(async () => {
  const server = await start({ naam: 'idor', env: { RTG_DEMO: '1', OFFICE_CODE: 'RTG-OFFICE-PROEF' } });
  const { basis, klaar } = server;

  const post = async (pad, lijf, tok) => {
    try {
      const r = await fetch(basis + pad, { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
        body: JSON.stringify(lijf || {}) });
      const tekst = await r.text();
      let data; try { data = JSON.parse(tekst); } catch (e) { data = tekst; }
      return { status: r.status, data, tekst };
    } catch (e) { return { status: 0, data: null, tekst: String(e.message) }; }
  };

  /* TWEE ECHTE LEDEN. auth/register geeft elk een eigen user-sleutel; alleen
     dan bestaat er eigenaarschap om te schenden. Beiden meerderjarig zodat de
     jeugdpoort niets afsluit dat de proef aanziet voor een IDOR-weigering. */
  const geheugen = {};
  const maakLid = async (n) => {
    const email = 'idor' + n + '-' + Date.now() + '@voorbeeld.test';
    const wachtwoord = 'geheim' + n + '123';
    const r = await post('/api/auth/register', {
      name: 'IDOR Lid ' + n, email, phone: '06123456' + (10 + n), password: wachtwoord,
      geboortedatum: '1990-01-0' + n, pasApp: 'rtg' });
    geheugen[n] = { email, wachtwoord };
    return r.data && r.data.token;
  };
  let A = await maakLid(1);
  let B = await maakLid(2);
  if (!A || !B) { console.error('kon geen twee leden registreren; A=' + !!A + ' B=' + !!B); klaar(); process.exit(2); }

  /* ---- DE SESSIE OVERLEEFT DE PROEF, want anders bewijst hij het tegendeel ----

     DIT IS EEN ECHTE FOUT GEWEEST, en een van de gevaarlijkste soort: hij maakte
     de uitslag BETER dan de waarheid. Deze proef loopt alle member-schrijfroutes
     langs, en daar zit /api/logout tussen. Vanaf dat punt was het token van A (en
     in de tweede gang dat van B) ongeldig, en dan gebeurt er dit:

       gang 1  A oogst niets meer -- elke volgende route geeft 401, dus de
               objectpool blijft halverwege steken;
       gang 2  B krijgt op ELKE volgende route een 401, en oordeelIdor leest een
               401 als "bewezen gescheiden". Een uitgelogde proef schrijft dus
               honderden routes als bewijs van scheiding weg, terwijl er alleen
               maar geen sessie was.

     Nagetrokken met een mutatie: /api/logout op een echt accounttoken geeft 200,
     en /api/auth/me daarna 401. (Voor office en supplier gebeurt dit niet: die
     komen op /api/logout niet eens door de member-poort heen.)

     De reparatie is niet "logout overslaan" -- dan blijft de volgende
     sessiebeeindiger die erbij komt onopgemerkt (LAT.md regel 4). De reparatie
     is een 401 NIET geloven voordat is vastgesteld dat de sessie nog leeft. Is
     hij dood, dan halen we een verse en doen de route over; pas daarna telt het
     antwoord. */
  const levend = async (tok) => (await post('/api/auth/me', {}, tok)).status === 200;
  const versLid = async (n) => {
    const r = await post('/api/auth/login', { login: geheugen[n].email, password: geheugen[n].wachtwoord });
    return r.data && r.data.token;
  };
  let hernieuwd = 0;
  /* Roept de route aan met het token van lid `n`, en zorgt dat een 401 iets
     BETEKENT. `zet` hangt het verse token terug op de juiste plek. */
  const roep = async (pad, lijf, n, tok, zet) => {
    let u = await post(pad, lijf, tok);
    if (u.status !== 401) return u;
    if (await levend(tok)) return u;              // de sessie leeft: dit is een echte weigering
    const vers = await versLid(n);
    if (!vers) return u;
    hernieuwd++; zet(vers);
    return post(pad, lijf, vers);
  };

  /* Alleen member-schrijfroutes: IDOR gaat over het bedienen van een object,
     niet over lezen of over een publieke deur. */
  const kandidaten = alleRoutes()
    .filter(r => r.pad.startsWith('/api/') && r.methode !== 'GET')
    .filter(r => !r.pad.includes(':'));
  const verdeling = verdeelOpRol(kandidaten, ['member']);
  let routes = verdeling.metRol.filter(r => r.rol === 'member');
  if (MAX) routes = routes.slice(0, MAX);

  console.log('\n=== DE IDOR-PROEF ===\n');
  console.log('  twee echte leden, ' + routes.length + ' member-schrijfroutes\n');

  /* GANG 1: A oogst. Elk geslaagd antwoord draagt id's van objecten die A mag
     bedienen; de pool onthoudt ze per domein. */
  const pool = maakPool();
  for (const r of routes) {
    const u = await roep(r.pad, plausibelLijf(r.pad), 1, A, (t) => { A = t; });
    if (u.status >= 200 && u.status < 300 && u.data && typeof u.data === 'object') pool.leer(u.data, r.pad);
  }
  const poolStand = pool.grootte();
  /* DE PROEF CONTROLEERT ZICHZELF, want dit is precies de fout die hij een
     ronde lang niet zag. Leeft A na de oogstgang niet meer, dan is de pool
     halverwege gestopt met vullen en zegt alles wat hierna komt minder dan het
     lijkt. Dan geen halve uitslag maar stoppen, in dezelfde vorm als "DE METER
     IS BLIND" van de rolproef. */
  if (!(await levend(A))) {
    console.error('\n  DE SESSIE VAN A IS DOOD na de oogstgang, en het herstel greep niet. De objectpool ' +
      'is dan halverwege blijven steken en elke 401 hierna zou als "gescheiden" tellen zonder dat ' +
      'iemand iets heeft geweigerd.\n');
    klaar(); process.exit(2);
  }

  /* GANG 2: B probeert dezelfde routes met A's id's. En de IJKING die dit
     instrument scherp maakt (zonder haar is elke publieke lees-POST een vals
     alarm): een 2xx telt alleen als A's SPECIFIEKE id het verschil maakt.
     Daarom vuurt B bij een 2xx nog een keer met een VERZONNEN id in hetzelfde
     lijf. Zakt die controle naar een 4xx, dan opende A's echte id de deur ->
     doorbraak. Blijft hij 2xx, dan is de route gewoon publiek en telt hij als
     publiek, niet als bevinding. Dezelfde gedachte als de vingerafdruk-ijking
     van de rolproef: eerst bewijzen dat je meetinstrument iets KAN zien. */
  const perRoute = {};
  const telling = { gescheiden: 0, doorbraak: 0, nagekeken: 0, publiek: 0, onbereikbaar: 0, lek: 0 };
  const verzonnen = () => 'ZZ-' + Math.random().toString(36).slice(2, 10);
  for (const r of routes) {
    const sleutel = r.methode + ' ' + r.pad;
    const { lijf, velden } = pool.verrijk(plausibelLijf(r.pad), r.pad);
    if (!velden.length) { telling.onbereikbaar++; perRoute[sleutel] = { staat: 'onbereikbaar', reden: 'geen id van A in dit domein' }; continue; }
    const u = await roep(r.pad, lijf, 2, B, (t) => { B = t; });
    const o = oordeelIdor(u.status, u.tekst);
    if (o.staat === 'doorbraak') {
      const nep = { ...lijf };
      for (const v of velden) nep[v] = verzonnen();
      const controle = await post(r.pad, nep, B);
      if (controle.status >= 200 && controle.status < 300) {
        telling.publiek++;
        perRoute[sleutel] = { status: u.status, staat: 'publiek', velden,
          reden: 'ook met een VERZONNEN id een ' + controle.status + ': de route is publiek/rol-open, ' +
            'A\'s id maakt geen verschil -- geen objectreferentie om te schenden' };
        continue;
      }
      if (NAGEKEKEN[sleutel]) {
        telling.nagekeken++;
        perRoute[sleutel] = { status: u.status, staat: 'nagekeken', velden,
          reden: 'doorbraak-kandidaat, met de hand nagekeken en GEEN lek: ' + NAGEKEKEN[sleutel] };
        continue;
      }
      perRoute[sleutel] = { status: u.status, staat: 'doorbraak', velden,
        reden: 'B kreeg ' + u.status + ' met A\'s id maar ' + controle.status + ' met een verzonnen id: ' +
          'A\'s ECHTE object opende de deur voor B -- dit is een objectreferentie die B niet hoort te hebben' };
      telling.doorbraak++;
      continue;
    }
    perRoute[sleutel] = { status: u.status, ...o, velden };
    telling[o.staat]++;
    if (o.lek) telling.lek++;
  }
  if (!(await levend(B))) {
    console.error('\n  DE SESSIE VAN B IS DOOD na de aanvalsgang: de 401\'s die als bewezen scheiding ' +
      'zijn geteld, kunnen ook gewoon "geen sessie" zijn geweest. Deze uitslag deugt niet.\n');
    klaar(); process.exit(2);
  }

  /* ---- GANG 3: DE WERKPLEK-POORT (de 78 objectpoort-routes) ----

     Een andere vorm van dezelfde vraag, en de reden dat de rolproef hier
     niets kon: huisPoort doet werkplek.kent(req.body.bedrijf) VOOR het naar de
     identiteit kijkt, dus een verzonnen bedrijfscode geeft 404 en de
     eigenaarschapsvraag komt nooit aan de beurt. Met een ECHTE code komt hij
     er wel aan toe, en dan is de vraag zuiver: mag een lid dat geen toegang
     tot dit huis heeft er toch in?

     DE IJKING IS ONMISBAAR. Een 403 voor B bewijst alleen iets als de deur
     voor de RECHTMATIGE persoon opengaat -- anders meet je een deur die voor
     iedereen dicht zit, en dat is geen scheiding maar een muur. De eigenaar
     mag per definitie in elk huis (werkplek.magIn: baas -> true), dus die is
     de ijking. Zonder open deur wordt de uitslag ONBEREIKBAAR en geen bewijs. */
  const eig = (await post('/api/auth/login', {
    login: process.env.RTG_OWNER_EMAIL || 'roellie.i@gmail.com',
    password: process.env.DEMO_PASS || 'Imran' })).data.token;
  const werkplekRoutes = alleRoutes()
    .filter(r => r.methode === 'POST' && r.pad.startsWith('/api/werkplek/'))
    .filter(r => !r.pad.includes(':'));
  const huizen = eig
    ? (((await post('/api/werkplek/mijn', {}, eig)).data || {}).bedrijven || []).map(b => b.code)
    : [];
  const werkplekTelling = { gescheiden: 0, doorbraak: 0, onbereikbaar: 0 };
  const werkplekPerRoute = {};
  const code = huizen[0];

  /* TWEE GANGEN VOOR DE IJKING, en dat is de reparatie van de grootste rest die
     deze proef overhield: 62 routes bleven ONBEREIKBAAR omdat ook de eigenaar er
     met alleen `{ bedrijf }` niet in kwam. Die routes willen meer -- een
     bestaand document, een klus, een dienst -- en een verzonnen id geeft
     dezelfde 404 als geen id. Dat is precies waar de objectpool voor is (zie
     scripts/lib/objectpool.js): oogsten is geen raden.

     GANG A laat de EIGENAAR elke route aanraken met een plausibel lijf, en
     oogst alles wat er terugkomt. Dat werkt twee kanten op: de leesroutes
     leveren de id's van wat er al is, en de maak-routes maken tijdens deze gang
     zelf nieuwe objecten aan waarvan het antwoord het id draagt.
     GANG B geeft iedereen die de eerste keer niet binnenkwam een tweede kans,
     nu met een verrijkt lijf.

     Wat B straks stuurt is LETTERLIJK HETZELFDE LIJF als waarmee de eigenaar
     binnenkwam. Anders vergelijkt de proef twee verschillende vragen en zegt
     een 404 voor B niets over de scheiding. */
  const wpPool = maakPool();
  const ijkUit = new Map();
  if (eig && huizen.length) {
    for (const r of werkplekRoutes) {
      const lijf = { ...plausibelLijf(r.pad), bedrijf: code };
      const ijk = await post(r.pad, lijf, eig);
      if (ijk.status >= 200 && ijk.status < 300) wpPool.leer(ijk.data, r.pad);
      ijkUit.set(r.pad, { ijk, lijf, verrijkt: false });
    }
    for (const r of werkplekRoutes) {
      const v = ijkUit.get(r.pad);
      if (v.ijk.status >= 200 && v.ijk.status < 300) continue;
      /* `bedrijf` wordt NA het verrijken teruggezet: de pool overschrijft
         id-achtige velden, en het huis waar we tegen ijken staat vast. */
      const lijf = { ...wpPool.verrijk(v.lijf, r.pad).lijf, bedrijf: code };
      const ijk = await post(r.pad, lijf, eig);
      if (ijk.status >= 200 && ijk.status < 300) {
        wpPool.leer(ijk.data, r.pad);
        ijkUit.set(r.pad, { ijk, lijf, verrijkt: true });
      }
    }
  }

  let herwonnen = 0;
  for (const r of werkplekRoutes) {
    const sleutel = r.methode + ' ' + r.pad;
    if (!eig || !huizen.length) {
      werkplekTelling.onbereikbaar++;
      werkplekPerRoute[sleutel] = { staat: 'onbereikbaar',
        reden: eig ? 'de eigenaar ziet geen enkel huis; geen open deur om tegen te ijken'
          : 'geen eigenaarstoken; zonder ijking bewijst een weigering niets' };
      continue;
    }
    const gang = ijkUit.get(r.pad);
    const ijk = gang.ijk;
    if (!(ijk.status >= 200 && ijk.status < 300)) {
      werkplekTelling.onbereikbaar++;
      werkplekPerRoute[sleutel] = { staat: 'onbereikbaar', status: ijk.status,
        reden: 'ook de rechtmatige eigenaar kwam er niet in (' + ijk.status + '), ook niet met een ' +
          'lijf dat verrijkt was met echte id\'s uit zijn eigen huis: deze deur is voor iedereen ' +
          'dicht, dus een weigering voor B bewijst geen scheiding' };
      continue;
    }
    if (gang.verrijkt) herwonnen++;
    const aanval = await roep(r.pad, gang.lijf, 2, B, (t) => { B = t; });
    const o = oordeelIdor(aanval.status, aanval.tekst);
    /* EEN 2xx OP EEN GEFILTERDE LIJST IS GEEN DOORBRAAK, en dit huis heeft er
       een: /api/werkplek/mijn antwoordt elk ingelogd lid met 200 en geeft
       daarin ALLEEN de huizen waar hij in mag -- voor B dus een lege lijst.
       Dat is geen lek maar precies de bedoeling. Het onderscheid is meetbaar:
       draagt B's antwoord de code van het huis, dan kreeg hij de inhoud;
       draagt het hem niet, dan is het gefilterd. Zonder deze scheiding meldt
       de proef een lek dat er niet is, en na drie loze alarmen zet iemand hem
       uit (dezelfde les als de ruisvloer van de staatproef). */
    const draagtInhoud = new RegExp('\\b' + code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i')
      .test(String(aanval.tekst || ''));
    if (o.staat === 'doorbraak' && !draagtInhoud) {
      werkplekTelling.gescheiden++;
      werkplekPerRoute[sleutel] = { status: aanval.status, staat: 'gescheiden', bedrijf: code,
        reden: 'B kreeg ' + aanval.status + ' maar zonder de inhoud van dit huis (gefilterde lijst): ' +
          'de scheiding zit in het antwoord, niet in de statuscode' };
      continue;
    }
    if (o.staat === 'doorbraak') {
      werkplekTelling.doorbraak++;
      werkplekPerRoute[sleutel] = { status: aanval.status, staat: 'doorbraak', bedrijf: code,
        reden: 'de eigenaar kwam binnen (' + ijk.status + ') EN lid B ook (' + aanval.status +
          '), terwijl B geen toegang tot dit huis heeft: de werkplek-poort scheidt hier niet' };
    } else if (o.staat === 'gescheiden') {
      werkplekTelling.gescheiden++;
      werkplekPerRoute[sleutel] = { status: aanval.status, staat: 'gescheiden', bedrijf: code,
        reden: 'de deur ging open voor de eigenaar (' + ijk.status + ') en bleef dicht voor B (' +
          aanval.status + '): bewezen scheiding op de werkplek-poort' };
    } else {
      werkplekTelling.onbereikbaar++;
      werkplekPerRoute[sleutel] = { status: aanval.status, staat: 'onbereikbaar', reden: o.reden };
    }
  }

  klaar();

  const doorbraken = Object.entries(perRoute).filter(([, v]) => v.staat === 'doorbraak');
  const uit = {
    stempel: stempel(),
    uitleg: 'Twee echte leden met dezelfde rol: A oogst objecten (objectpool), B probeert ze te ' +
      'bedienen. gescheiden = B geweigerd (bewijs); doorbraak = B kreeg 2xx op een object uit A\'s ' +
      'antwoord (BEVINDING, met de hand nakijken -- kan publiek zijn); onbereikbaar = geen id of ' +
      'validatie strandde eerder. Zie scripts/lib/idor.js voor het oordeel.',
    grens: 'een doorbraak is een VRAAG en geen vonnis: het object kan publiek zijn. En de proef ziet ' +
      'alleen wat A terugkreeg -- objecten die alleen via een eigen keten ontstaan, blijven buiten beeld.',
    gemeten: { routes: routes.length, ...telling, poolDomeinen: poolStand.domeinen, poolVelden: poolStand.velden,
      werkplek: { routes: werkplekRoutes.length, ...werkplekTelling,
        herwonnen, pool: wpPool.grootte() }, sessieHernieuwd: hernieuwd },
    doorbraken: doorbraken.map(([route, v]) => ({ route, status: v.status, velden: v.velden })),
    perRoute,
    werkplekPerRoute
  };

  if (argv.includes('--json')) { console.log(JSON.stringify(uit, null, 1)); process.exitCode = 0; return; }
  console.log('  gescheiden (B geweigerd)      : ' + telling.gescheiden);
  console.log('  doorbraak (2xx -- NIEUW, NAKIJKEN): ' + telling.doorbraak);
  console.log('  nagekeken (geen lek, met reden): ' + telling.nagekeken);
  console.log('  publiek (id maakt geen verschil): ' + telling.publiek);
  console.log('  onbereikbaar (geen id/validatie): ' + telling.onbereikbaar);
  console.log('  weigering die een persoonsveld lekt: ' + telling.lek);
  console.log('  objectpool: ' + poolStand.domeinen + ' domeinen, ' + poolStand.velden + ' velden');
  console.log('\n  WERKPLEK-POORT (de objectpoort-routes), geijkt op de eigenaar:');
  console.log('    gescheiden (eigenaar erin, B eruit): ' + werkplekTelling.gescheiden);
  console.log('    doorbraak (B kwam ook binnen)       : ' + werkplekTelling.doorbraak);
  console.log('    onbereikbaar (geen open deur)      : ' + werkplekTelling.onbereikbaar);
  console.log('    herwonnen met een verrijkt lijf    : ' + herwonnen +
    '  (pool: ' + wpPool.grootte().domeinen + ' naamruimtes, ' + wpPool.grootte().velden + ' velden)');
  console.log('    sessie hernieuwd na een dode 401    : ' + hernieuwd +
    '  (deze proef loopt ook langs /api/logout)\n');
  for (const [route, v] of doorbraken.slice(0, 20)) console.log('   ? ' + route + ' -> ' + v.status + ' (via ' + (v.velden || []).join(',') + ')');

  if (VASTLEGGEN) {
    fs.writeFileSync(UITSLAG, JSON.stringify(uit, null, 1) + '\n');
    console.log('\n  vastgelegd in IDOR.json\n');
  } else {
    console.log('\n  (niet vastgelegd; --vastleggen schrijft IDOR.json)\n');
  }
  process.exitCode = 0;
})().catch(e => { console.error('de IDOR-proef viel om: ' + (e && e.stack || e)); process.exit(2); });
