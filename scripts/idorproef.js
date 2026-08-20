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
  'POST /api/home/zet': 'homekit.zet zoekt het apparaat in woningVan(B); seed-gedeeld id, B\'s eigen apparaat'
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
  const maakLid = async (n) => {
    const r = await post('/api/auth/register', {
      name: 'IDOR Lid ' + n, email: 'idor' + n + '-' + Date.now() + '@voorbeeld.test',
      phone: '06123456' + (10 + n), password: 'geheim' + n + '123',
      geboortedatum: '1990-01-0' + n, pasApp: 'rtg' });
    return r.data && r.data.token;
  };
  const A = await maakLid(1);
  const B = await maakLid(2);
  if (!A || !B) { console.error('kon geen twee leden registreren; A=' + !!A + ' B=' + !!B); klaar(); process.exit(2); }

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
    const u = await post(r.pad, plausibelLijf(r.pad), A);
    if (u.status >= 200 && u.status < 300 && u.data && typeof u.data === 'object') pool.leer(u.data, r.pad);
  }
  const poolStand = pool.grootte();

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
    const u = await post(r.pad, lijf, B);
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
  for (const r of werkplekRoutes) {
    const sleutel = r.methode + ' ' + r.pad;
    if (!eig || !huizen.length) {
      werkplekTelling.onbereikbaar++;
      werkplekPerRoute[sleutel] = { staat: 'onbereikbaar',
        reden: eig ? 'de eigenaar ziet geen enkel huis; geen open deur om tegen te ijken'
          : 'geen eigenaarstoken; zonder ijking bewijst een weigering niets' };
      continue;
    }
    const code = huizen[0];
    const ijk = await post(r.pad, { bedrijf: code }, eig);
    if (!(ijk.status >= 200 && ijk.status < 300)) {
      werkplekTelling.onbereikbaar++;
      werkplekPerRoute[sleutel] = { staat: 'onbereikbaar', status: ijk.status,
        reden: 'ook de rechtmatige eigenaar kwam er niet in (' + ijk.status + '): deze deur is ' +
          'voor iedereen dicht, dus een weigering voor B bewijst geen scheiding' };
      continue;
    }
    const aanval = await post(r.pad, { bedrijf: code }, B);
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
      werkplek: { routes: werkplekRoutes.length, ...werkplekTelling } },
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
  console.log('    onbereikbaar (geen open deur)      : ' + werkplekTelling.onbereikbaar + '\n');
  for (const [route, v] of doorbraken.slice(0, 20)) console.log('   ? ' + route + ' -> ' + v.status + ' (via ' + (v.velden || []).join(',') + ')');

  if (VASTLEGGEN) {
    fs.writeFileSync(UITSLAG, JSON.stringify(uit, null, 1) + '\n');
    console.log('\n  vastgelegd in IDOR.json\n');
  } else {
    console.log('\n  (niet vastgelegd; --vastleggen schrijft IDOR.json)\n');
  }
  process.exitCode = 0;
})().catch(e => { console.error('de IDOR-proef viel om: ' + (e && e.stack || e)); process.exit(2); });
