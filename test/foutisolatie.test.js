/* DE FOUTWIKKEL, EN WAAROM HIJ EEN NAAM DRAAGT.

   Draai los: node --experimental-sqlite --test test/foutisolatie.test.js

   server/lib/foutisolatie.js omhult elke route-handler zodat een (async) fout
   next(err) wordt in plaats van een unhandledRejection. Dat is oud gedrag en het
   staat hieronder in toets 1 en 2.

   Toets 3 tot 6 gaan over iets wat er NIEUW aan is en wat je niet ziet als je
   alleen naar het gedrag van een verzoek kijkt: de wikkel neemt de NAAM van de
   functie over. Zonder die naam heet elke laag in de router niets, en dan is uit
   de router niet te lezen welke bewaker voor een route hangt.

   WAT DAT KOSTTE TOEN HET ONTBRAK. De rolproef, de idempotentieproef, de
   invoerproef en de staatproef moeten de rol van een route weten -- anders weten
   ze niet welke rollen de VERKEERDE zijn, en aankloppen met de juiste rol bewijst
   niets over scheiding. Omdat de router zwijgen moest, raadden ze het met een
   regex over de brontekst, en die ziet niet wat via een mount of een
   voorvoegsel-hulpje hangt: 2934 routes waar de router er 4191 heeft. Alle vier
   de proeven misten exact dezelfde 1257, waaronder alle 281 van de RTFoundation.

   Deze toets bestaat dus omdat een "opruiming" van deze wikkel (de
   defineProperty eruit, hij doet toch niets voor het verzoek) vier bewijsproeven
   stil zou halveren. Dat mag niet zonder dat iets zakt.

   MUTATIES (alle vier gedaan, alle vier zag ik de JUISTE toets zakken):
     - de defineProperty in lib/foutisolatie.js weghalen        -> toets 3 en 5 zakken
     - laagNaam uit leesLagen halen (web/routing.js)            -> toets 5 zakt
     - in inventaris() de laatste laag NIET afsnijden           -> toets 6 zakt
     - de try/catch uit omhul() halen                           -> toets 1 zakt

   EN DE DERDE BEET EERST NIET, wat hier hoort te staan. In de eerste versie van
   toets 6 hadden alle handlers een anonieme arrow, en dan geeft
   `lagen.filter(Boolean)` precies hetzelfde antwoord als
   `lagen.slice(0, -1).filter(Boolean)` -- de handler valt in beide gevallen weg
   omdat hij naamloos is. De mutatie liep dus door een groene toets heen. Pas met
   een handler die WEL een naam heeft (`function lees(...)`) valt het verschil om.
   Dat is regel 9 in bedrijf: een toets die niet kan zakken koopt vertrouwen dat
   er niet is, en je merkt het alleen door de mutatie echt te doen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const foutisolatie = require('../server/lib/foutisolatie');
const routedekking = require('../server/kern/routedekking');
const web = require('../server/web');

/* ---------------- 1-2. de wikkel doet nog steeds zijn werk ---------------- */

test('een gegooide fout wordt next(err) en komt niet als uncaught naar buiten', () => {
  const stuk = foutisolatie.omhul(() => { throw new Error('kapot'); });
  let gezien = null;
  stuk({}, {}, (e) => { gezien = e; });
  assert.ok(gezien instanceof Error, 'de fout komt via next() terug');
  assert.equal(gezien.message, 'kapot');
});

test('een afgewezen belofte wordt ook next(err)', async () => {
  const stuk = foutisolatie.omhul(async () => { throw new Error('async kapot'); });
  const fout = await new Promise((klaar) => { stuk({}, {}, klaar); });
  assert.ok(fout instanceof Error, 'een async fout komt via next() terug');
  assert.equal(fout.message, 'async kapot');
});

/* ---------------- 3-4. de naam blijft staan ---------------- */

test('de wikkel draagt de naam van de functie die hij omhult', () => {
  function officeAuth(req, res, next) { next(); }
  assert.equal(foutisolatie.omhul(officeAuth).name, 'officeAuth',
    'zonder deze naam kan de router niet zeggen welke bewaker voor een route hangt');
  /* En een anonieme functie blijft anoniem: dat is geen tekortkoming maar het
     onderscheid waar de meting op leunt. Een naamloze laag is de handler. */
  assert.equal(foutisolatie.omhul((req, res) => res.end()).name, '');
});

test('isoleer() omhult alle zes de routemethoden en laat de rest staan', () => {
  const nep = { get: () => 'g', post: () => 'p', put: () => 'u', delete: () => 'd',
    patch: () => 'a', all: () => 'l', use: () => 'x' };
  const origUse = nep.use;
  foutisolatie.isoleer(nep);
  for (const m of ['get', 'post', 'put', 'delete', 'patch', 'all']) {
    assert.equal(typeof nep[m], 'function', m + ' bestaat nog');
  }
  /* use() is met opzet NIET omhuld: daar hangt foutmiddleware aan met vier
     argumenten, en de wikkel heeft er altijd drie. Die arity stilletjes
     veranderen zou de router een foutlaag als gewone laag laten zien. */
  assert.equal(nep.use, origUse, 'use() blijft ongemoeid');
});

/* ---------------- 5-6. en de router kan het lezen ---------------- */

test('de router noemt de bewaker van een route, ook door een mount heen', () => {
  const app = web();
  function techAuth(req, res, next) { next(); }
  function eigenaarAlleen(req, res, next) { next(); }
  foutisolatie.isoleer(app);
  app.post('/api/direct', techAuth, (req, res) => res.end());

  /* De mount is de helft die het eerst kapot was: een route achter
     app.use('/api/tak', router) staat in de brontekst met zijn pad BINNEN de
     mount, dus een regex over de bron leest '/leden' en niet '/api/tak/leden'. */
  const tak = web.Router();
  foutisolatie.isoleer(tak);
  tak.post('/leden', techAuth, eigenaarAlleen, (req, res) => res.end());
  app.use('/api/tak', tak);

  const regels = app._routes();
  const direct = regels.filter(r => r.pad === '/api/direct');
  assert.equal(direct.length, 2, 'bewaker en handler zijn elk een laag');
  assert.deepEqual(direct.map(r => r.laagNaam), ['techAuth', ''],
    'de router noemt de bewaker bij naam, en de handler blijft naamloos');

  const gemount = regels.filter(r => r.pad === '/api/tak/leden');
  assert.equal(gemount.length, 3, 'twee bewakers plus de handler, met het volle pad');
  assert.deepEqual(gemount.map(r => r.laagNaam), ['techAuth', 'eigenaarAlleen', '']);
});

test('inventaris() leidt de bewakers af: alles behalve de laatste laag', () => {
  const app = web();
  function auth(req, res, next) { next(); }
  function geenGast(req, res, next) { next(); }
  foutisolatie.isoleer(app);
  app.post('/api/met', auth, geenGast, (req, res) => res.end());
  app.get('/api/zonder', (req, res) => res.end());

  /* EEN BENOEMDE HANDLER, en die is de hele reden dat deze toets iets bewijst.

     Met een anonieme handler is "snijd de laatste laag eraf" niet te
     onderscheiden van "gooi de naamloze eruit": beide geven hetzelfde antwoord.
     Ik heb die mutatie geprobeerd en de toets bleef groen -- een toets die niet
     kan zakken is slechter dan geen toets (LAT.md regel 9). Met een handler die
     WEL een naam heeft valt het verschil om, en zulke handlers bestaan hier
     echt: server/routes/techniek/betalingen.js hangt `status`, `stap` en `proef`
     als benoemde functies op. Zonder het afsnijden zou `status` daar als bewaker
     tellen, en dan bepaalt de rolproef zijn rol uit een handlernaam. */
  function lees(req, res) { res.end(); }
  app.post('/api/benoemd', auth, lees);

  const routes = routedekking.inventaris(app._routes()).routes;
  const met = routes.find(r => r.pad === '/api/met');
  const zonder = routes.find(r => r.pad === '/api/zonder');
  const benoemd = routes.find(r => r.pad === '/api/benoemd');
  assert.deepEqual(met.bewakers, ['auth', 'geenGast'], 'de handler telt niet als bewaker');
  assert.deepEqual(benoemd.bewakers, ['auth'],
    'een handler met een naam is nog steeds geen bewaker -- de LAATSTE laag valt eraf, ' +
    'niet alleen de naamloze');
  assert.deepEqual(zonder.bewakers, [],
    'een route zonder bewakerslaag krijgt een LEEG lijstje: dat is een meting');

  /* En het verschil dat eronder ligt: onbekend is geen leeg lijstje. Een kaart
     zonder laagnamen (de gebundelde vorm van scripts/routekaart.js zonder
     bewakers erin) hoort null te geven, niet [] -- anders leest "we weten het
     niet" als "deze route is onbeschermd" (LAT.md regel 3). */
  const kaal = routedekking.inventaris([{ pad: '/api/kaal', methoden: ['POST'] }]).routes[0];
  assert.equal(kaal.bewakers, null, 'onbekend blijft null en wordt geen leeg lijstje');
});
