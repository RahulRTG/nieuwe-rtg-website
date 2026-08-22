#!/usr/bin/env node
/* ============================================================================
   DE GLUURRONDE -- de HORIZONTALE scheiding: mag lid A bij de spullen van lid B?

   scripts/rolronde.js beantwoordt de verticale vraag (welke ROL komt waar
   binnen) voor alle 1444 leden-endpoints. Die vraag is makkelijker dan hij
   lijkt, want er staat een deur. De horizontale vraag is de moeilijke: A heeft
   een geldig token, de deur gaat terecht open, en de scheiding moet dus PER
   OPVRAGING gebeuren. Daar zitten zulke gaten.

   Tot vandaag deed alleen de gluurder-trede van de ladder dit, met zeven
   handgeschreven paden (een bon en een notitie). Dat is een steekproef, en hij
   stond als zodanig in TAKEN.md 4.14.

   HOE DEZE RONDE HET BREDER TREKT, in vier stappen:

     1. TWEE ECHTE LEDEN. Geregistreerd en geverifieerd, geen demo-persona --
        die heeft geen accountId en komt op een flink deel van de leden-routes
        niet eens binnen.

     2. ALLEBEI LEGGEN ZE EEN LEVEN AAN. Niet met handgeschreven stromen per
        domein (dat veroudert), maar met een veegronde over elke route die
        `bewaar`, `maak`, `nieuw` of `voeg` heet, met een generiek lijf. Twintig
        daarvan lukken en leveren dertig identificatoren op, verspreid over
        zeventien domeinen: agenda, notities, concern, gewoonten, muziek,
        mediaos, rtmail, onderneming, site en meer. Nieuwe aanmaakroutes komen
        er vanzelf bij; dat is met opzet, want een handgeschreven lijst zou
        precies de nieuwe routes missen.

     3. WAT IS VAN B EN NIET VAN IEDEREEN? Het verschil met A. Een eerste
        poging oogstte 153 "identificatoren" waarvan de meeste catalogusnamen
        waren (sa-jet, krekel, toegankelijkheid) -- die staan bij A net zo goed.
        Wat bij B verschijnt en niet bij A, is van B.

     4. DRIE VRAGEN AAN A:
        - PASSIEF: ziet A ergens de codenaam van B, of een van B's tekens,
          terwijl hij daar zelf nooit om vroeg? Dat is een lek zonder dat A
          iets hoefde te weten.
        - ACTIEF: A stuurt B's identificator naar de BUURENDPOINTS van de route
          die hem aanmaakte (`/api/notities/*` voor een notitie-id). Daar zit
          het risico: een zusje van de aanmaakroute dat vergeet te vragen van
          wie het ding is.
        - EN DAARNA: staan B's spullen er nog? Een schrijflek geeft `{ok:true}`
          terug en verraadt zich niet in de inhoud. Dus kijkt B na afloop of
          zijn identificatoren nog bestaan. Verdwenen = A heeft ze weggegooid.

   WAT DEZE RONDE NIET DOET, en dat hoort erbij te staan:
     - De actieve proef is gericht op BUURENDPOINTS, niet op alle 1444. Een lek
       waarbij een notitie-id opduikt in een endpoint van een heel ander domein
       wordt hier niet gevonden. Dat is een bewuste grens: alle combinaties zijn
       dertigduizend verzoeken en het overgrote deel daarvan is onzin.
     - Wat B niet kan AANLEGGEN, kan hier ook niet gestolen worden. De dekking
       is dus precies zo groot als de veegronde in stap 2, en dat getal staat in
       de uitslag (`bezitStukken`). Zakt het, dan is er minder beproefd -- en
       daar zit een ratel op.
     - Twee leden van dezelfde pas. Scheiding tussen pas-niveaus is een andere
       vraag.

   Draai:  node scripts/gluurronde.js
           node scripts/gluurronde.js --vastleggen
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const WORTEL = path.join(__dirname, '..');
const K = { rood: '\x1b[31m', groen: '\x1b[32m', geel: '\x1b[33m', grijs: '\x1b[2m', reset: '\x1b[0m', vet: '\x1b[1m' };
const { alleRoutes } = require('./lib/routes');
const proefserver = require('./lib/proefserver');

const arg = (naam, std) => { const i = process.argv.indexOf(naam); return i > 0 ? process.argv[i + 1] : std; };
const BASIS_EXTERN = arg('--basis', null);
const PORT = Number(process.env.GLUURRONDE_PORT || 4420);
const VASTLEGGEN = process.argv.includes('--vastleggen');

/* ---- DE METERS ----
   `gluurGaten` telt wat A van B kon zien, veranderen of weggooien. Nul.

   `gluurProeven` telt hoeveel vragen er werkelijk zijn gesteld, en mag alleen
   omhoog. Zonder dat tweede getal is nul gaten triviaal te halen door B niets
   te laten bezitten -- en juist dat is hier het broze deel: de dekking hangt
   volledig aan wat de veegronde weet aan te leggen. */
const METER = 'gluurGaten';
const RICHTING = 'omlaag';           // een plafond: meer lekken is slechter
/* HIER STOND `gluurProeven`, EN DAT WAS DE VERKEERDE MAAT.

   Die meter telde VERZOEKEN. Toen de vernielingscontrole werd herbouwd -- van
   per stuk een familie aflopen naar een momentopname over 796 leesroutes --
   controleerde de ronde meer en vroeg hij minder: 9349 in plaats van 9540
   verzoeken. De ratel zag dat als achteruitgang en zakte, terwijl de dekking
   juist was gegroeid. Een meter die geklets beloont, duwt de volgende
   verbetering de verkeerde kant op.

   `gluurGecontroleerd` telt wat er werkelijk is NAGEKEKEN: elk endpoint dat A
   antwoordde, elke vraag met een identificator van B, en elk stuk dat tegen
   vernieling bewaakt wordt. Dat getal stijgt als de dekking stijgt en beweegt
   niet mee met hoe zuinig de ronde zijn verzoeken doet. */
const METER_N = 'gluurGecontroleerd';
const RICHTING_N = 'omhoog';         // een vloer: minder nakijken is slechter
/* `gluurOnbewaakt` telt de aanmaakroutes waarvan het resultaat door geen enkele
   leesroute wordt getoond en waarvoor ook geen reden is opgeschreven. Zo'n route
   is geen lek maar een BLINDE VLEK: wat B nooit kan opvragen, kan hij ook niet
   missen, dus een schrijflek erop blijft onzichtbaar. Nul, en wie een nieuwe
   aanmaakroute zonder lezer bouwt, geeft hem er een of schrijft in
   ONGELEZEN_BEDOELD op waarom die er niet is. */
const METER_O = 'gluurOnbewaakt';
const RICHTING_O = 'omlaag';         // een plafond: meer blinde vlekken is slechter
const UITSLAGBESTAND = path.join(WORTEL, 'GLUURRONDE.json');

const NIET_KLOPPEN = /\/api\/(sse|stream|live-)|\/sse|\/stream|\/api\/test\/|\/api\/cluster\//;
const KYC = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/* Een lijf dat op veel aanmaakroutes plausibel is. Bewust onschuldig.

   ELK LID KRIJGT ZIJN EIGEN MERK, en dat is geen detail maar de helft van de
   opsporing. Eerst legden A en B allebei "ZZGLUUR" aan; dan is de INHOUD van B
   niet als inhoud van B te herkennen en blijft alleen zijn id over. Een lek
   waarbij A de tekst van B's notitie terugkrijgt zou dan onzichtbaar zijn --
   precies het geval waar dit voor bestaat. Met een eigen merk per lid is elke
   letter die A van B te zien krijgt herkenbaar. */
const MERK_BASIS = 'ZZGLUUR';
const maakLijf = (merk) => ({ titel: merk, naam: merk, title: merk, name: merk, tekst: merk + ' tekst', text: merk,
  omschrijving: merk, soort: 'lijst', type: 'lijst', items: [{ t: merk }], datum: '2026-09-01', date: '2026-09-01',
  inhoud: merk, waarde: merk, label: merk, kleur: '#7F1634', aan: true, bedrag: 100, centen: 100,
  /* De velden hieronder komen niet uit de duim maar uit de FOUTMELDINGEN van de
     routes die afvielen: "een clip duurt 1 tot 60 seconden", "waarom wilt u
     dit?", "een scene heeft minstens een apparaatstand nodig", "geef eerst een
     onderwerp", "minstens twee vraag-antwoordparen", "welk vak is het?", "wat is
     de kaart- of ticketcode?". Elke route die zegt wat hij mist, krijgt het. */
  seconden: 5, duur: 5, lengte: 5, reden: merk + ' reden', waarom: merk + ' waarom',
  onderwerp: merk, vak: 'rekenen', standen: [{ apparaat: merk, stand: 'aan' }],
  paren: [{ vraag: merk, antwoord: merk }, { vraag: merk + '2', antwoord: merk + '2' }],
  vragen: [{ vraag: merk, antwoord: merk }, { vraag: merk + '2', antwoord: merk + '2' }],
  kaarten: [{ vraag: merk, antwoord: merk }, { vraag: merk + '2', antwoord: merk + '2' }],
  personen: [merk], betrokkenen: [merk], vrienden: [merk],
  ticketcode: merk, kaartcode: merk, barcode: merk });

/* De veldnamen waaronder een identificator meegestuurd wordt. Breed, want een
   endpoint dat er een niet leest, negeert hem gewoon. */
const IDVELDEN = ['id', 'ref', 'code', 'sleutel', 'key', 'nummer', 'uuid', 'kamercode'];

/* WAT EEN LID AANLEGT IS NIET ALTIJD PRIVE, en dat is geen uitzondering maar
   een soort. Deze ronde vond bij de eerste echte draai een "lek" op
   /api/labfonds/overzicht: A zag daar iets wat B had aangemaakt. Nagelopen: B
   had een LOCATIE in het Lab-fonds gemaakt, en zo'n locatie hoort openbaar te
   zijn -- leden zien hem, doneren eraan en stemmen erover. Dat is het hele idee
   van een fonds.

   Zulke routes staan hier met hun reden, en niet in een stille filter. Een
   nieuwe deel-route die er niet in staat, meldt zich dus als lek tot iemand
   opschrijft waarom hij deelt. Dat is de goede kant om fout te staan: luid.

   NB: alleen wat de route ZELF aanmaakt valt hieronder. Elk aanmaakverzoek van
   B draagt een eigen merk, dus het merk van een gedeelde route wordt apart
   uitgesloten en de rest van B's spullen blijft volledig herkenbaar. */
/* Per aanmaakroute: waarom hij deelt, en WAAR dat delen zichtbaar wordt. Dat
   tweede is nodig omdat delen niet altijd binnen de eigen familie blijft: een
   site die je publiceert onder /api/site/* verschijnt in de gids onder
   /api/browser/*, mét de codenaam van de maker erbij. Dat is attributie en geen
   lek -- dezelfde regel als "Uit De Salon - naam" in de huisstijl. Zonder dat
   veld zou de ronde die attributie elke draai als bevinding melden, en dan is
   hij binnen een week niet meer serieus te nemen. */
const GEDEELD_BEDOELD = new Map([
  ['/api/labfonds/locatie/maak', { reden: 'een locatie in het Lab-fonds is juist openbaar: leden doneren eraan en stemmen erover' }],
  ['/api/meet/maak', { reden: 'de code van een ontmoeting IS de uitnodiging: wie hem heeft mag erbij, net als een vergaderlink' }],
  ['/api/samen/maak', { reden: 'idem voor een samen-sessie: meedoen gebeurt met de code, dat is het hele mechanisme' }],
  ['/api/les/maak', { reden: 'de code van een les is de uitnodiging: de klas doet ermee mee' }],
  ['/api/site/bewaar', { reden: 'een gepubliceerde site staat in de browsergids -- openbaar zijn IS het doel van publiceren',
    toont: ['/api/browser'] }]
]);

/* WAT DIT REGISTER WEL EN NIET VRIJSTELT, en dat onderscheid is er een die deze
   ronde bij de eerste vondst nog niet maakte.

   "Mag zien" is niet "mag weggooien". Dat A met de code van B mag MEEDOEN aan
   een ontmoeting is de bedoeling; dat hij hem zou kunnen VERWIJDEREN is dat
   niet. Het register haalt de spullen van zo'n route daarom alleen uit de
   INHOUDSCONTROLE (A mag ze zien), en niet uit de controle achteraf of B zijn
   spullen nog heeft. Zou het allebei doen, dan is een gedeelde route meteen ook
   een blinde vlek voor vernieling.

   EN DE VRIJSTELLING GELDT DE HELE FAMILIE, niet alleen de aangemaakte spullen.
   Dat bleek nodig bij de tweede draai: A deed met de code van B mee aan een
   samen-sessie en kreeg daar de CODENAAM van B te zien. Die codenaam is geen
   spullen van die route -- maar deelnemers die elkaar zien is precies wat een
   samen-sessie IS. Wie de code deelt, deelt het gezelschap. De inhoudscontrole
   slaat dus /api/samen/* over, en de vernielingscontrole niet. */

/* AANMAAKROUTES WAARVAN HET RESULTAAT BEWUST NERGENS TE LEZEN IS.

   De ronde kijkt of B zijn eigen spullen terugvindt; wat hij nooit kan opvragen,
   kan hij ook niet missen, en een schrijflek daarop blijft dus onzichtbaar
   (TAKEN.md 4.16). Bij de eerste meting bleven negen aanmaakroutes over waarvan
   geen enkele leesroute het resultaat toonde. ACHT daarvan bleken wél een lezer
   te hebben -- die werd alleen niet bereikt, omdat de opname elke route met een
   leeg lijf aanriep terwijl een gezinsroute een gezinsreferentie wil en een
   detailroute het identificator zelf. Dat is hieronder gerepareerd.

   Wat overblijft staat hier MET REDEN, net als bij GEDEELD_BEDOELD. Een nieuwe
   aanmaakroute zonder lezer die hier niet in staat, laat de meter
   `gluurOnbewaakt` stijgen en zakt de ronde. Dat is de goede kant om fout te
   staan: luid, en niet als stille regel in een filter. */
const ONGELEZEN_BEDOELD = new Map([
  ['/api/concern/nieuw', 'een concerngroep is een indeling, geen ding: hij wordt zichtbaar via ' +
    '/api/concern/boom zodra er een entiteit in hangt, en een lege groep staat op geen enkele lijst. ' +
    'De ronde hangt er niets in, dus zij ziet hem niet. Nagelopen op 18 augustus 2026, en het is bij ' +
    'die controle wel wat anders opgeleverd: het HANGEN zelf keek niet of de groep van de aanvrager ' +
    'was (gerepareerd in server/kern/concern/graaf.js, toets in test/concern.test.js).']
]);

/* ---------------------------------------------------------------- het vragen */
const agent = new http.Agent({ keepAlive: true, maxSockets: 32 });
function maakVraag(basis, telOp) {
  const u = new URL(basis);
  return function vraag(methode, pad, token, lijf, opt) {
    if (telOp) telOp();
    return new Promise(resolve => {
      const data = methode === 'GET' ? null : JSON.stringify(lijf === undefined ? {} : lijf);
      const headers = { 'Content-Type': 'application/json' };
      if (data) headers['Content-Length'] = Buffer.byteLength(data);
      if (token) headers.Authorization = 'Bearer ' + token;
      const req = http.request({ hostname: u.hostname, port: u.port, path: pad, method: methode, headers, agent,
        timeout: (opt && opt.timeout) || 8000 }, res => {
        let body = '';
        res.on('data', c => { if (body.length < 200000) body += c; });
        res.on('end', () => resolve({ status: res.statusCode, tekst: body }));
      });
      req.on('error', () => resolve({ status: 0, tekst: '' }));
      req.on('timeout', () => { req.destroy(); resolve({ status: 0, tekst: '' }); });
      if (data) req.write(data);
      req.end();
    });
  };
}

async function nieuwLid(vraag, merk) {
  const u = merk + crypto.randomBytes(8).toString('hex');
  const email = 'gluur' + u + '@voorbeeld.test', wachtwoord = 'Geheim' + u + '!';
  const reg = await vraag('POST', '/api/auth/register', null, {
    name: 'Gluur ' + u, email, phone: '0612345678',
    password: wachtwoord, geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  let tok = null; try { tok = JSON.parse(reg.tekst).token; } catch (e) {}
  if (tok) await vraag('POST', '/api/verify/upload', tok, { image: KYC });
  /* De inloggegevens gaan mee terug, want B mag NOOIT opnieuw worden aangemaakt:
     dan zijn zijn spullen weg en meet de hele ronde niets meer. Hij logt opnieuw
     in met hetzelfde account. */
  return tok ? { token: tok, email, wachtwoord } : null;
}
async function codenaamVan(vraag, tok) {
  const r = await vraag('POST', '/api/pay/overzicht', tok, {});
  try { return JSON.parse(r.tekst).codenaam || null; } catch (e) { return null; }
}

const idsUit = (tekst) => [...String(tekst).matchAll(/"(?:id|ref|code|sleutel|key)":"([A-Za-z0-9_-]{4,64})"/g)].map(m => m[1]);

/* --------------------------------------------------------------- het oordeel */
function beoordeel(uitslag, normMeters) {
  const redenen = [];
  const plafond = normMeters ? normMeters[METER] : undefined;
  const vloer = normMeters ? normMeters[METER_N] : undefined;
  if (plafond !== undefined && uitslag.gaten > plafond)
    redenen.push('De gluurronde vond ' + uitslag.gaten + ' lek(ken) tegen een norm van ' + plafond + '.');
  if (vloer !== undefined && uitslag.gecontroleerd < vloer)
    redenen.push('De gluurronde keek ' + uitslag.gecontroleerd + ' dingen na tegen een norm van ' + vloer +
      '. Minder nakijken is geen betere uitslag.');
  const blind = normMeters ? normMeters[METER_O] : undefined;
  if (blind !== undefined && uitslag.onbewaakt > blind)
    redenen.push('De gluurronde vond ' + uitslag.onbewaakt + ' aanmaakroute(s) zonder lezer en zonder reden, ' +
      'tegen een norm van ' + blind + '. Geef de route een leesroute, of zet in ONGELEZEN_BEDOELD waarom die er niet is.');
  return { zakt: redenen.length > 0, redenen };
}

/* ------------------------------------------------------------------ de ronde */
async function main() {
  let srv = null, basis = BASIS_EXTERN;
  if (!basis) { srv = proefserver.start({ poort: PORT, merk: 'gluur' }); basis = srv.base; }
  let proeven = 0;
  const vraag = maakVraag(basis, () => { proeven++; });

  console.log('\n' + K.vet + 'DE GLUURRONDE' + K.reset + K.grijs + ' -- mag lid A bij de spullen van lid B' + K.reset);
  console.log('  ' + K.grijs + 'tegen ' + basis + (srv ? ' (eigen boot)' : ' (meegegeven)') + K.reset + '\n');

  if (!await proefserver.wachtGezond(vraag)) {
    console.error('  ' + K.rood + 'De server kwam niet op; er is niets gemeten.' + K.reset);
    console.error('  ' + K.grijs + 'Dat is geen schone uitslag maar een ontbrekende meting (LAT.md regel 3).' + K.reset + '\n');
    proefserver.stop(srv); return 2;
  }

  const lidA = await nieuwLid(vraag, 'a'), lidB = await nieuwLid(vraag, 'b');
  let A = lidA && lidA.token;
  let B = lidB && lidB.token;
  if (!A || !B) {
    console.error('  ' + K.rood + 'Er kwamen geen twee leden rond; zonder twee is er geen scheiding te beproeven.' + K.reset + '\n');
    proefserver.stop(srv); return 2;
  }
  const codeA = await codenaamVan(vraag, A), codeB = await codenaamVan(vraag, B);

  /* ---- DE KANARIE VAN A, en zonder hem was deze hele ronde een leugen ----

     A klopt in de passieve veeg op ELKE route, en daar zit /api/auth/logout bij
     -- alfabetisch vooraan. A logde zichzelf dus uit, en alles wat daarna kwam
     kreeg 401 "Niet ingelogd". De actieve veeg deed 1084 vragen zonder sessie,
     de terugkijkronde vond niets, en de uitslag meldde "A kwam nergens bij de
     spullen van B" -- groen, over een proef die niets had geprobeerd.

     Het is precies dezelfde fout als in scripts/rolronde.js, waar hij al een
     keer is gevonden en gerepareerd. Hij kwam hier terug omdat de les niet
     meeverhuisde, en dat is het argument voor deze kanarie op de PLEK waar de
     vraag gesteld wordt in plaats van in een losse controle: elke vraag namens A
     loopt hierlangs, dus er is geen weg omheen.

     Een NIEUWE A na een uitlog kan geen kwaad: A's identiteit doet er niet toe,
     alleen dat hij een geldig lid is dat B niet is. Wat B bezit blijft staan --
     die wordt nooit opnieuw aangemaakt, want dan waren zijn spullen weg. */
  /* ---- DE KANARIE VAN B, en die werkt anders dan die van A ----

     B doet straks een MOMENTOPNAME over elk endpoint dat hem antwoordt, en daar
     zit /api/auth/logout net zo goed bij. Maar B mag niet opnieuw worden
     aangemaakt zoals A: dan zijn zijn spullen weg en meet de hele ronde niets.
     Hij logt dus opnieuw in met hetzelfde account, en houdt alles. */
  let herstelB = 0;
  const vraagB = async (methode, pad, lijf, andereSleutel) => {
    const sleutel = andereSleutel || B;
    let res = await vraag(methode, pad, sleutel, lijf);
    if (res.status !== 401 || andereSleutel) return res;
    if ((await vraag('POST', '/api/state', B, {})).status !== 401) return res;
    const opnieuw = await vraag('POST', '/api/auth/login', null, { email: lidB.email, password: lidB.wachtwoord });
    let vers = null; try { vers = JSON.parse(opnieuw.tekst).token; } catch (e) {}
    if (!vers) return res;
    B = vers; herstelB++;
    return vraag(methode, pad, B, lijf);
  };

  let herstelA = 0;
  const vraagA = async (methode, pad, lijf) => {
    let res = await vraag(methode, pad, A, lijf);
    if (res.status !== 401) return res;
    const leeft = (await vraag('POST', '/api/state', A, {})).status !== 401;
    if (leeft) return res;                       // echt geweigerd, niet uitgelogd
    const vers = await nieuwLid(vraag, 'a');
    if (!vers) return res;
    A = vers.token; herstelA++;
    return vraag(methode, pad, A, lijf);
  };
  console.log('  ' + K.grijs + 'A: ' + codeA + '   B: ' + codeB + K.reset);

  const routes = alleRoutes().filter(r => r.pad.startsWith('/api/') && !r.viaRouter && !NIET_KLOPPEN.test(r.pad));
  const aanmaak = routes.filter(r => r.methode === 'POST' && /(bewaar|maak|nieuw|voeg|aanmaak|create)\b/i.test(r.pad)
    && !/supplier|office|staff|foundation|techniek|rtfos|lab2|bedrijf/.test(r.pad));

  /* ---------- 1. allebei een leven aanleggen ---------- */
  /* EEN MERK PER ROUTE. Met een merk per LID zou een enkele bewust-gedeelde
     route (het Lab-fonds) het merk van B overal publiek maken, en dan is geen
     enkel stuk inhoud van B meer herkenbaar. Per route uitsluiten kan alleen als
     elk merk bij precies een route hoort. */
  /* ---- DE GEZINSKANT HEEFT EEN EIGEN SLEUTELVORM ----

     Elf aanmaakroutes onder /api/rtf/* gaven "Log opnieuw in bij je gezin", en
     dat bleek geen ontbrekend recht maar een andere VORM. Een gezinsroute wil
     drie dingen tegelijk: de gezinscode in het lijf (gezinVan leest
     req.body.code), en het profieltoken -- maar de ene route leest dat uit de
     HEADER (tokenUit pakt de header voor het lijf) en de andere rechtstreeks uit
     req.body.token. Wie er maar een van de drie meestuurt, komt er niet in, en
     dat leek dan op een gesloten deur terwijl het een verkeerde sleutelbaard was.

     Beide leden krijgen daarom een eigen gezin. Dat is ook horizontaal winst: A
     probeert straks de identificatoren van B op gezinsroutes met ZIJN gezin, en
     dat is precies de vraag of gezinnen van elkaar gescheiden zijn. */
  const gezinPad = (pad) => /^\/api\/(rtf|school)\//.test(pad);
  const maakGezin = async (tok, merk) => {
    const r = await vraag('POST', '/api/foundation/gezin/maak', tok,
      { gezinsnaam: 'Gluur ' + merk, naam: 'Ouder', pin: '4321' });
    try { const j = JSON.parse(r.tekst); return j.token ? { token: j.token, code: j.code } : null; }
    catch (e) { return null; }
  };

  /* WAT DE AANMAAKROUTE TERUGGAF, WORDT BEWAARD -- want de lezer wil het vaak
     terug. /api/les/leraar geeft de les alleen aan wie zowel de klascode als de
     leraarssleutel meestuurt, en die twee staan naast elkaar in het antwoord op
     /api/les/maak. Alleen het identificator meesturen is dan te weinig, en de
     les leek daardoor onleesbaar terwijl haar lezer er gewoon is. De vlakke
     tekstvelden zijn genoeg: geneste objecten zijn de inhoud, niet de sleutel. */
  const vlakkeVelden = (tekst) => {
    let j = null; try { j = JSON.parse(tekst); } catch (e) { return {}; }
    if (!j || typeof j !== 'object') return {};
    const uit = {};
    for (const [k, v] of Object.entries(j)) if (typeof v === 'string' && v.length <= 128) uit[k] = v;
    return uit;
  };
  const legAan = async (tok, merkBasis, gezin) => {
    const ids = new Set(); const bronnen = new Map(); const merken = new Map();
    const stukken = new Map(); const antwoorden = new Map();
    for (let i = 0; i < aanmaak.length; i++) {
      const r = aanmaak[i];
      const merk = merkBasis + String(i).padStart(3, '0');
      const lijf = maakLijf(merk);
      let sleutel = tok;
      if (gezin && gezinPad(r.pad)) { lijf.token = gezin.token; lijf.code = gezin.code; sleutel = gezin.token; }
      const res = await vraag('POST', r.pad, sleutel, lijf);
      if (res.status < 200 || res.status >= 300) continue;
      merken.set(merk, r.pad);
      antwoorden.set(r.pad, vlakkeVelden(res.tekst));
      for (const id of idsUit(res.tekst)) {
        ids.add(id);
        if (!bronnen.has(id)) bronnen.set(id, r.pad);
        if (!stukken.has(r.pad)) stukken.set(r.pad, []);
        stukken.get(r.pad).push(id);
      }
    }
    return { ids, bronnen, merken, stukken, antwoorden };
  };
  const merkA = MERK_BASIS + 'A' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const merkB = MERK_BASIS + 'B' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const gezinA = await maakGezin(A, merkA), gezinB = await maakGezin(B, merkB);
  const bezitA = await legAan(A, merkA, gezinA), bezitB = await legAan(B, merkB, gezinB);
  /* Wat bij B verschijnt EN bij A: dat is geen bezit maar een catalogus. En het
     merk zelf telt niet als id -- dat is de echo van wat we zelf instuurden. */
  const vanB = [...bezitB.ids].filter(id => !bezitA.ids.has(id) && !id.toUpperCase().startsWith(MERK_BASIS));
  console.log('  ' + K.grijs + aanmaak.length + ' aanmaakroutes geprobeerd; B bezit ' + vanB.length +
    ' herkenbare stukken over ' + new Set(vanB.map(id => bezitB.bronnen.get(id))).size + ' route(s)' + K.reset + '\n');

  /* ---------- de nulmeting: wat kan B zelf terugvinden? ----------
     VOOR A iets probeert, want anders is "niet gevonden" niet te onderscheiden
     van "nooit vindbaar geweest". Zes van de twintig stukken hebben namelijk
     geen leesroute in hun eigen familie, en die zouden anders elke ronde als
     gestolen tellen. Dit is de kant die bij de eerste versie ontbrak: hij MAT
     de vindbaarheid en deed er niets mee, en daardoor kwam een mutatie die B's
     notitie liet weggooien er ongezien doorheen. Een meting die geen oordeel
     draagt, is precies wat LAT.md regel 10 een liegende meter noemt. */
  const familieVan = (pad) => String(pad || '').split('/').slice(0, 3).join('/');

  /* EEN MOMENTOPNAME IN PLAATS VAN ZOEKEN PER STUK, en dat is tegelijk breder EN
     goedkoper. Hiervoor keek deze controle alleen in de eigen FAMILIE van de
     aanmaakroute: `/api/notities/*` voor een notitie. Elf van B's zesentwintig
     stukken hebben daar geen leesroute, en die vielen dus buiten de bewaking --
     wat B nooit kan opvragen, kan hij ook niet missen, dus een schrijflek op zo'n
     stuk bleef onzichtbaar (TAKEN.md 4.16).

     Nu wordt er EEN opname gemaakt van alles wat B antwoordt, en wordt elk stuk
     daarin gezocht. Dat is niet alleen breder maar ook minder werk: eerst
     zesentwintig keer een familie aflopen (ruim duizend verzoeken), nu een ronde
     van een paar honderd. Zoeken doe je in de opname, niet op de server.

     De opname loopt via vraagB, want ook B klopt hier op /api/auth/logout. */
  /* ALLEEN LEESACHTIGE ROUTES IN DE OPNAME, en dat is geen voorzichtigheid maar
     een reparatie. De eerste versie riep ELK endpoint aan als B, en die opname
     vond veertien van B's zesentwintig stukken terwijl de smalle familiezoektocht
     er vijftien vond. Een bredere zoektocht die MINDER vindt, vernietigt
     onderweg: tussen die duizenden aanroepen zitten wis-, archiveer- en
     uitlogroutes, en met een leeg lijf doen sommige daarvan gewoon hun werk. Het
     meetinstrument sloopte de spullen die het moest tellen, en meldde dat
     vervolgens als veertien lekken.

     De verbwoorden hieronder komen uit de padnamen van dit huis zelf. Het is een
     naamheuristiek en dus niet waterdicht -- een leesroute die toevallig "zet"
     heet valt eruit, en dat kost dekking maar geen waarheid. De andere kant op
     fout gaan zou erger zijn: dan meet de controle zichzelf kapot. */
  const MUTEERT = /\/(weg|wis|verwijder|reset|leeg|archiveer|archief|sluit|stop|uitlog|logout|afmeld|zet|bewaar|maak|nieuw|voeg|deel|vink|betaal|stuur|oplaad|koop|annuleer|start|kom|mee|join|verlaat|update|wijzig|schrijf|upload|wissel|intrekken|opzeg)(\/|$)/;
  /* EN DE OPNAME BLIJFT KLEIN, want een meting die de SNELHEIDSREM uitlokt meet
     de rem. Een eerdere versie riep alle 3071 niet-muterende routes aan: de
     eerste opname gaf nog 299 keer 2xx, de tweede nog maar 36 -- met 2700 keer
     401. B was niet bestolen, hij was geremd, en de controle meldde veertien
     lekken die geen van alle bestonden.

     Dus alleen de echte LEZERS: paden die eindigen op mijn/lijst/overzicht/
     alles/staat/status/gids/kaart (237 stuks), plus de niet-muterende routes uit
     de families waar B iets heeft. Twee opnames kosten daarmee een paar honderd
     verzoeken in plaats van zesduizend, en dat blijft ruim onder de rem. */
  const LEZER = /\/(mijn|lijst|lijsten|overzicht|alles|staat|status|gids|kaart)$/;
  const families = new Set([...bezitB.bronnen.values()].map(familieVan));
  const leesRoutes = routes.filter(r => !r.pad.startsWith('/api/auth/') && !MUTEERT.test(r.pad)
    && (LEZER.test(r.pad) || [...families].some(f => r.pad === f || r.pad.startsWith(f + '/'))));
  /* EN DE OPNAME NEEMT DE GEZINSREFERENTIE MEE. Een lege body op /api/rtf/* is
     geen vraag maar een dichte deur: gezinVan leest de gezinscode uit het lijf.
     Vier van de negen "onbewaakte" aanmaakroutes hadden hun lezer gewoon naast
     zich staan (/api/rtf/baby/boek, /api/rtf/kantoorpakket/mijn,
     /api/rtf/tiener/toetsen, /api/rtf/leren/projecten) -- de opname klopte
     alleen zonder sleutel aan. Dat is dezelfde les als bij het AANLEGGEN, waar
     de gezinsvorm al werd meegestuurd; hij was hier niet meeverhuisd. */
  const gezinLijf = (pad, extra) => Object.assign({}, extra,
    gezinB && gezinPad(pad) ? { token: gezinB.token, code: gezinB.code } : {});
  const momentopname = async (merk) => {
    const uit = []; const status = new Map();
    for (const r of leesRoutes) {
      const res = await vraagB(r.methode, r.pad.replace(/:[A-Za-z_]+/g, 'x1'), gezinLijf(r.pad));
      status.set(res.status, (status.get(res.status) || 0) + 1);
      if (res.status >= 200 && res.status < 300) uit.push(res.tekst);
    }
    console.log('  ' + K.grijs + 'opname ' + (merk || '') + ': ' + uit.length + ' van ' + leesRoutes.length +
      ' gaven 2xx  [' + [...status].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([s, n]) => s + ':' + n).join(' ') + ']' + K.reset);
    return uit.join('\n');
  };
  const opnameVooraf = await momentopname('vooraf');
  console.log('  ' + K.grijs + leesRoutes.length + ' leesachtige routes in de momentopname (van ' + routes.length + ')' + K.reset);

  /* ---------- de gerichte tweede blik ----------
     Een opname met een leeg lijf vindt alleen wat op een LIJST staat. Een stuk
     dat je bij naam moet opvragen -- /api/rtf/leren/project-staat,
     /api/rtf/samen/staat, /api/samen/staat -- valt er dus buiten, en viel
     daarmee ook buiten de bewaking. Voor precies die stukken wordt hier nog
     eenmaal gericht gevraagd: in de BUURT van de aanmaakroute (het pad zonder
     zijn laatste segment, dus /api/rtf/leren voor project-maak), met het
     identificator onder elke gangbare veldnaam, met de vlakke velden uit het
     aanmaakantwoord, en met de gezinsreferentie waar die hoort.

     Echte lezers eerst, en dat is geen kosmetiek: /api/samen/muziek antwoordt
     ook met de kamercode, maar dat is een zetroute. Wie de eerste de beste
     treffer onthoudt, onthoudt straks een muterende route als "de plek waar B
     zijn spullen terugvindt", en de controle achteraf schrijft dan waar zij
     hoort te lezen.

     De vondst wordt onthouden, want de controle achteraf hoeft dan maar EEN
     vraag te stellen in plaats van de buurt opnieuw af te lopen. Een ronde die
     de snelheidsrem uitlokt meet de rem, en niet de scheiding. */
  const buurtVan = (pad) => String(pad || '').replace(/\/[^/]+$/, '');
  const gerichtePlek = new Map();
  const gerichtVragen = async (id, plek) => {
    const bron = bezitB.bronnen.get(id);
    const lijf = Object.assign({}, bezitB.antwoorden.get(bron) || {});
    for (const veld of IDVELDEN) lijf[veld] = id;
    const res = await vraagB(plek.methode, plek.pad, gezinLijf(plek.pad, lijf));
    return res.status >= 200 && res.status < 300 && res.tekst.includes(id);
  };
  const zoekGericht = async (id) => {
    const buurt = buurtVan(bezitB.bronnen.get(id));
    if (!buurt) return false;
    const buren = routes.filter(r => !MUTEERT.test(r.pad) && r.pad.startsWith(buurt + '/'))
      .sort((a, b) => (LEZER.test(b.pad) ? 1 : 0) - (LEZER.test(a.pad) ? 1 : 0));
    for (const plek of buren) {
      if (await gerichtVragen(id, plek)) { gerichtePlek.set(id, plek); return true; }
    }
    return false;
  };
  const uitOpname = vanB.filter(id => opnameVooraf.includes(id));
  const gerichtGevonden = [];
  for (const id of vanB) {
    if (uitOpname.includes(id)) continue;
    if (await zoekGericht(id)) gerichtGevonden.push(id);
  }
  const vindbaarVooraf = uitOpname.concat(gerichtGevonden);
  if (gerichtGevonden.length) console.log('  ' + K.grijs + 'gericht nagevraagd: ' + gerichtGevonden.length +
    ' stuk(ken) die niet op een lijst staan maar wel bij naam op te vragen zijn' + K.reset);
  /* WAT NIET BEWAAKT WORDT, MET NAAM. Een getal ("15 van de 27") laat zich
     lezen als een detail; de lijst laat zien welke aanmaakroutes iets opleveren
     dat daarna door geen enkele leesroute meer wordt getoond. Dat is geen lek --
     maar wat B nooit kan opvragen, kan hij ook niet missen, en een schrijflek
     daarop blijft dus onzichtbaar. Het hoort zichtbaar te zijn, niet weggeteld. */
  /* PER ROUTE EN NIET PER IDENTIFICATOR, want een antwoord draagt er vaak meer
     dan een. /api/muziek/maak geeft een track met vier kanalen terug, elk met
     een eigen id; /api/muziek/mijn toont de track en van de kanalen alleen het
     aantal. Op identificatorniveau heet dat vier onbewaakte stukken, terwijl
     wat de route OPLEVERT gewoon op een lijst staat. De vraag is of het
     resultaat van de route ergens te zien is, en het antwoord is ja zodra een
     van zijn identificatoren wordt getoond. */
  const onbewaakt = [...bezitB.stukken.keys()]
    .filter(pad => (bezitB.stukken.get(pad) || []).some(id => vanB.includes(id)))
    .filter(pad => !(bezitB.stukken.get(pad) || []).some(id => vindbaarVooraf.includes(id)));
  const onbewaaktOnverklaard = onbewaakt.filter(pad => !ONGELEZEN_BEDOELD.has(pad));
  console.log('  ' + K.grijs + 'nulmeting: B vindt ' + vindbaarVooraf.length + ' van zijn ' + vanB.length +
    ' stukken zelf terug' + (herstelB ? '; de sessie van B is ' + herstelB + ' keer hersteld' : '') + K.reset);

  /* ---- DE ZELFPROEF: SLAAT DE VERNIELINGSCONTROLE ECHT UIT? ----

     Deze controle is de enige die een SCHRIJFlek kan zien -- zo'n lek geeft
     {ok:true} terug en verraadt zich nergens in de inhoud. Precies daarom mag
     hij niet ongeijkt blijven, en dat was hij bijna: een poging om hem te
     beproeven met een opzettelijk gat in de eigendomscontrole van notities
     sloeg drie keer af, want die mutatie werkt alleen zolang de notities van
     het slachtoffer niet in een bundel zijn opgeborgen. Een ijking die van de
     opslagvorm afhangt, is geen ijking.

     Met GLUUR_ZELFPROEF=1 verdwijnt er daarom na de nulmeting een stuk van B
     langs de gewone weg -- B gooit het zelf weg via zijn eigen route. Daarna
     HOORT de controle hieronder precies dat ene stuk als kwijt te melden. Doet
     hij dat niet, dan meet hij niets en zegt deze ronde dat hardop.

     Dit is dezelfde gedachte als test/meterijk.test.js: niet het lek namaken,
     maar de meter een bekend-fout gegeven voeren en zien of hij uitslaat. */
  let zelfproefId = null;
  if (process.env.GLUUR_ZELFPROEF) {
    for (const id of vindbaarVooraf) {
      const familie = familieVan(bezitB.bronnen.get(id));
      const weghaler = routes.find(r => r.pad.startsWith(familie + '/') && /\/(weg|verwijder|wis)$/.test(r.pad));
      if (!weghaler) continue;
      const lijf = {}; for (const veld of IDVELDEN) lijf[veld] = id;
      const res = await vraagB(weghaler.methode, weghaler.pad, lijf);
      if (res.status < 200 || res.status >= 300) continue;
      /* Op dezelfde plek terugkijken als waar het stuk gevonden is -- een stuk
         dat alleen bij naam op te vragen was, staat ook nu niet op een lijst. */
      const plek = gerichtePlek.get(id);
      const weg = plek ? !(await gerichtVragen(id, plek)) : !(await momentopname('zelfproef')).includes(id);
      if (weg) { zelfproefId = id; break; }
    }
    console.log('  ' + (zelfproefId
      ? K.geel + 'ZELFPROEF: B heeft ' + zelfproefId + ' zelf weggegooid; de controle hoort hem als kwijt te melden' + K.reset
      : K.rood + 'ZELFPROEF: geen enkel stuk van B was langs zijn eigen route weg te krijgen -- de proef kon niet' + K.reset));
  }

  const gaten = [];
  /* De tekens die alleen van B kunnen komen: zijn identificatoren, zijn codenaam,
     en de merken uit ZIJN aanmaakverzoeken -- behalve die van routes die met
     opzet delen. */
  const gedeeldeMerken = new Set([...bezitB.merken].filter(([, pad]) => GEDEELD_BEDOELD.has(pad)).map(([m]) => m));
  const priveMerken = [...bezitB.merken.keys()].filter(m => !gedeeldeMerken.has(m));
  const priveIds = vanB.filter(id => !GEDEELD_BEDOELD.has(bezitB.bronnen.get(id)));
  const gedeeldeFamilies = [...GEDEELD_BEDOELD].flatMap(([pad, regel]) =>
    [familieVan(pad)].concat((regel && regel.toont) || []));
  const inGedeeldeFamilie = (pad) => gedeeldeFamilies.some(f => pad.startsWith(f + '/') || pad === f);
  const merkersVanB = new Set(priveIds.concat(codeB ? [codeB] : []).concat(priveMerken));
  for (const pad of onbewaakt.filter(p => ONGELEZEN_BEDOELD.has(p)))
    console.log('  ' + K.grijs + 'geen lezer, met reden: ' + pad + ' -- ' +
      String(ONGELEZEN_BEDOELD.get(pad)).split('.')[0] + '.' + K.reset);
  if (onbewaaktOnverklaard.length) console.log('  ' + K.geel + onbewaaktOnverklaard.length +
    ' aanmaakroute(s) leveren iets op dat geen enkele leesroute toont, zonder opgegeven reden' + K.reset
    + K.grijs + ': ' + onbewaaktOnverklaard.slice(0, 8).join(', ') + (onbewaaktOnverklaard.length > 8 ? ' ...' : '') + K.reset);
  console.log('  ' + K.grijs + 'waarvan ' + (vanB.length - priveIds.length) +
    ' uit routes die met opzet delen; die tellen niet voor de inhoud, wel voor de vernieling' + K.reset);

  const zietB = (tekst, behalve) => {
    for (const m of merkersVanB) { if (m !== behalve && tekst.includes(m)) return m; }
    return null;
  };

  /* ---------- 2. passief: ziet A iets van B zonder erom te vragen? ---------- */
  let passief = 0;
  for (const r of routes) {
    const pad = r.pad.replace(/:[A-Za-z_]+/g, 'x1');
    const eigenGezin = gezinA && gezinPad(r.pad) ? { token: gezinA.token, code: gezinA.code } : {};
    const res = await vraagA(r.methode, pad, eigenGezin, gezinA && gezinPad(r.pad) ? gezinA.token : null);
    if (res.status < 200 || res.status >= 300) continue;
    passief++;
    const gezien = inGedeeldeFamilie(r.pad) ? null : zietB(res.tekst, null);
    if (gezien) gaten.push({ soort: 'passief', route: r.methode + ' ' + pad, marker: gezien,
      hoe: 'A kreeg iets van B te zien zonder er ooit om te vragen', bestand: r.bestand + ':' + r.regel });
  }
  console.log('  ' + K.grijs + 'passief: ' + passief + ' endpoints gaven A een antwoord' + K.reset);

  /* ---------- 3. actief: A stuurt B's teken naar de buurendpoints ---------- */
  let actief = 0;
  for (const id of vanB) {
    const bron = bezitB.bronnen.get(id) || '';
    const familie = bron.split('/').slice(0, 3).join('/');       // '/api/notities' uit '/api/notities/bewaar'
    const buren = routes.filter(r => r.pad.startsWith(familie + '/') || r.pad === familie);
    for (const r of buren) {
      /* HET LIJF DRAAGT MEER DAN ALLEEN HET ID, en dat is een reparatie uit een
         mislukte mutatieproef. Eerst stuurde deze ronde uitsluitend id-velden.
         Een endpoint dat nog iets anders nodig heeft -- /api/notities/vink wil
         een `index`, /api/notities/deel wil een `codenaam` -- viel dan op een
         400 voordat hij ook maar bij zijn eigendomscontrole kwam. Een opzettelijk
         gat in die controle bleef daardoor onzichtbaar: de proef klopte op een
         deur die al eerder dichtviel. Nu gaat het aanmaaklijf mee, plus de
         handvol tweede parameters die in dit huis het vaakst voorkomen. */
      const lijf = Object.assign(maakLijf(MERK_BASIS + 'PROBE'), { index: 0, af: true, aan: true, codenaam: codeA });
      for (const veld of IDVELDEN) lijf[veld] = id;
      /* Op een gezinsroute gaat A's EIGEN gezin mee -- anders komt hij niet eens
         door de deur en zegt de proef niets over de scheiding erachter. De code
         van zijn eigen gezin overschrijft het geinjecteerde id met opzet: de
         vraag is of hij met zijn sleutel bij de spullen van B komt. */
      let sleutelA = null;
      if (gezinA && gezinPad(r.pad)) { lijf.token = gezinA.token; lijf.code = gezinA.code; sleutelA = gezinA.token; }
      const res = await vraagA(r.methode, r.pad.replace(/:[A-Za-z_]+/g, 'x1'), lijf, sleutelA);
      actief++;
      if (res.status < 200 || res.status >= 300) continue;
      const gezien = inGedeeldeFamilie(r.pad) ? null : zietB(res.tekst, id);
      if (gezien) gaten.push({ soort: 'actief', route: r.methode + ' ' + r.pad, marker: gezien,
        hoe: 'A stuurde een identificator van B en kreeg gegevens van B terug', bestand: r.bestand + ':' + r.regel });
    }
  }
  console.log('  ' + K.grijs + 'actief: ' + actief + ' vragen met een identificator van B aan zijn buurendpoints'
    + (herstelA ? '; de sessie van A is ' + herstelA + ' keer hersteld' : '') + K.reset);

  /* ---------- 4. staan B's spullen er nog? ---------- */
  /* Een SCHRIJFlek geeft {ok:true} terug en verraadt zich niet in de inhoud. De
     enige eerlijke controle is achteraf, en alleen op wat B VOORAF wel kon
     vinden -- dat is de nulmeting hierboven. */
  const opnameNa = await momentopname('achteraf');
  const kwijt = [];
  for (const id of vindbaarVooraf) {
    /* Wie vooraf alleen bij naam te vinden was, wordt achteraf ook bij naam
       gevraagd -- en op DEZELFDE plek. Anders heet elk stuk dat niet op een
       lijst staat na afloop kwijt, en meldt deze ronde vernieling waar alleen
       verkeerd gekeken is. */
    const plek = gerichtePlek.get(id);
    const gevonden = plek ? await gerichtVragen(id, plek) : opnameNa.includes(id);
    if (!gevonden) {
      kwijt.push(id);
      gaten.push({ soort: 'weg', route: bezitB.bronnen.get(id) || '?', marker: id,
        hoe: 'B kon dit stuk voor de ronde terugvinden en erna niet meer -- A heeft het weggegooid of overschreven',
        bestand: '(zie de aanmaakroute)' });
    }
  }
  console.log('  ' + K.grijs + 'terugkijken: van de ' + vindbaarVooraf.length + ' vindbare stukken is B er ' +
    kwijt.length + ' kwijt' + K.reset);

  /* ---------- de uitslag ---------- */
  /* De zelfproef beoordelen VOOR de gewone uitslag: als de controle het
     opzettelijk verdwenen stuk niet heeft gezien, is een schone ronde niets
     waard en zegt hij dat met een eigen exitcode. */
  if (process.env.GLUUR_ZELFPROEF) {
    const gezien = zelfproefId && kwijt.includes(zelfproefId);
    console.log('  ' + (gezien ? K.groen + 'ZELFPROEF RAAK: de vernielingscontrole zag het verdwenen stuk.'
      : K.rood + 'ZELFPROEF AFGESLAGEN: het verdwenen stuk is NIET gezien; deze controle meet niets.') + K.reset + '\n');
    proefserver.stop(srv);
    return gezien ? 0 : 1;
  }

  /* Wat er is NAGEKEKEN: elk endpoint dat A antwoordde, elke vraag met een teken
     van B, en elk stuk dat tegen vernieling bewaakt wordt. */
  const gecontroleerd = passief + actief + vindbaarVooraf.length;
  const uitslag = { gaten: gaten.length, gecontroleerd, onbewaakt: onbewaaktOnverklaard.length };
  try {
    fs.writeFileSync(UITSLAGBESTAND, JSON.stringify({
      uitleg: 'De gluurronde: de HORIZONTALE scheiding tussen twee leden. gaten MAG ALLEEN DALEN en proeven mag ' +
        'ALLEEN STIJGEN -- zie scripts/gluurronde.js. De dekking hangt aan wat lid B kan aanleggen (bezitStukken); ' +
        'daalt dat, dan is er minder beproefd en niet minder mis.',
      gedraaid: new Date().toISOString(),
      meters: { [METER]: gaten.length, [METER_N]: gecontroleerd, [METER_O]: onbewaaktOnverklaard.length },
      verzoeken: proeven,
      bezitStukken: vanB.length, aanmaakGeprobeerd: aanmaak.length,
      passiefBeantwoord: passief, actieveVragen: actief,
      vindbaarVooraf: vindbaarVooraf.length, onbewaakteAanmaakroutes: onbewaakt,
      onbewaaktMetReden: onbewaakt.filter(pad => ONGELEZEN_BEDOELD.has(pad)),
      onbewaaktZonderReden: onbewaaktOnverklaard, kwijtNaAfloop: kwijt.length,
      sessieHersteldA: herstelA, sessieHersteldB: herstelB, gaten
    }, null, 2) + '\n');
  } catch (e) { console.error('  kon GLUURRONDE.json niet schrijven: ' + e.message); }

  proefserver.stop(srv);

  if (gaten.length) {
    console.log('\n  ' + K.rood + K.vet + gaten.length + ' LEK(KEN) IN DE HORIZONTALE SCHEIDING' + K.reset + '\n');
    for (const g of gaten.slice(0, 40))
      console.log('    ' + K.rood + '!' + K.reset + ' [' + g.soort + '] ' + g.route + K.grijs + '  ' + g.hoe + '  (' + g.bestand + ')' + K.reset);
    if (gaten.length > 40) console.log('    ' + K.grijs + '... nog ' + (gaten.length - 40) + K.reset);
    console.log('');
    return 1;
  }
  console.log('\n  ' + K.groen + 'A kwam nergens bij de spullen van B.' + K.reset +
    K.grijs + ' (' + gecontroleerd + ' dingen nagekeken in ' + proeven + ' verzoeken; de dekking hangt aan de '
    + vanB.length + ' stukken die B kon aanleggen)' + K.reset + '\n');

  let norm = null;
  try { norm = JSON.parse(fs.readFileSync(path.join(WORTEL, 'NORM.json'), 'utf8')); } catch (e) {}
  if (norm && norm.meters && !BASIS_EXTERN) {
    if (VASTLEGGEN) {
      const p = norm.meters[METER], v = norm.meters[METER_N], b = norm.meters[METER_O];
      if (p === undefined || uitslag.gaten <= p) norm.meters[METER] = uitslag.gaten;
      if (v === undefined || uitslag.gecontroleerd >= v) norm.meters[METER_N] = uitslag.gecontroleerd;
      if (b === undefined || uitslag.onbewaakt <= b) norm.meters[METER_O] = uitslag.onbewaakt;
      fs.writeFileSync(path.join(WORTEL, 'NORM.json'), JSON.stringify(norm, null, 2) + '\n');
      console.log('  ' + K.groen + METER + ' vastgelegd op ' + norm.meters[METER] + ', ' + METER_N + ' op ' +
        norm.meters[METER_N] + ', ' + METER_O + ' op ' + norm.meters[METER_O] + '.' + K.reset + '\n');
    } else {
      const oordeel = beoordeel(uitslag, norm.meters);
      if (oordeel.zakt) { for (const r of oordeel.redenen) console.error('  ' + K.rood + r + K.reset); console.error(''); return 1; }
    }
  }
  return 0;
}

if (require.main === module) main().then(c => { process.exitCode = c; }).catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { beoordeel, METER, METER_N, METER_O };
