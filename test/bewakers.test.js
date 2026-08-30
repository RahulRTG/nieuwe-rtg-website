/* ============================================================================
   DE BEWAKERSKAART MOET UITPUTTEND BLIJVEN.

   scripts/lib/bewakers.js zegt van elke bewakerslaag in dit huis wat voor SOORT
   deur het is. Die kaart is alleen iets waard zolang hij compleet is: een deur
   die er niet op staat valt door naar 'onbekend', en dan is de vraag "welke rol
   hoort bij deze route" onbeantwoord zonder dat er iets omvalt. Precies zo bleven
   338 routes onder een reden staan die het verkeerde beloofde.

   Deze toets sluit dat gat. Hij loopt de LEVENDE routekaart af -- niet een
   lijstje in dit bestand -- en zakt zodra er een bewaker in het huis staat die
   niemand heeft ingedeeld. Wie morgen een nieuwe deur maakt, moet dus zeggen wat
   voor deur het is. Dat is de hele bedoeling.

   MUTATIEBEWIJS (LAT.md regel 2 en 10: een toets die je niet hebt zien zakken
   meet niets). Drie keer gebroken, drie keer gezakt -- dit is wat er WERKELIJK
   omviel, niet wat ik verwachtte:

     boardroomAuth uit KAART gehaald        -> 3 gezakt (1, 5, 9)
        De uitputtendheidstoets meldt hem bij naam, en 5 en 9 vallen mee omdat de
        64 boardroomroutes dan uit de kruisbare groep verdwijnen. Dat drie toetsen
        tegelijk zakken is geen ruis: het is dezelfde fout die zich op drie
        plekken laat zien.

     boardroomAuth de rol 'office' gegeven  -> 2 gezakt (2, 5)
        De kaart is dan nog uitputtend en de route heeft nog een rol -- alleen
        wordt het KANTOORTOKEN niet meer gekruist, want dat geldt nu als de juiste
        rol. Dat is precies de stille erosie waar toets 2 voor bestaat: geen enkel
        getal in een register zou zijn gezakt.

     de rangorde in beoordeel() terug naar dragend[0] -> 1 gezakt (7)
        mw+arrivalPassAuth leest dan als "geen autorisatielaag": een route MET een
        slot die zich voordoet als een route zonder.
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { alleRoutes } = require('../scripts/lib/routes.js');
const bk = require('../scripts/lib/bewakers.js');

/* De drie rollen waarvoor de proeven een levend token hebben (zie
   scripts/lib/rolproef.js). Alles daarbuiten is een eigenrol. */
const GEMODELLEERD = ['member', 'supplier', 'office'];

test('elke bewaker in het huis heeft een soort -- de kaart is uitputtend', () => {
  const onbekend = new Map();
  for (const r of alleRoutes()) {
    if (!r.bewakersBekend) continue;
    for (const naam of r.bewakers) {
      if (bk.soortVan(naam) !== 'onbekend') continue;
      const bij = onbekend.get(naam) || [];
      if (bij.length < 3) bij.push(r.methode + ' ' + r.pad);
      onbekend.set(naam, bij);
    }
  }
  assert.deepStrictEqual([...onbekend.keys()], [],
    'Nieuwe bewakerslaag zonder soort. Deel hem in in scripts/lib/bewakers.js -- ' +
    'rol, eigenrol, verfijner, lichaamssleutel, objectpoort, geenBewaker of omgeving. ' +
    'Voorbeelden: ' + JSON.stringify([...onbekend]));
});

test('een eigenrol valt BUITEN de drie gemodelleerde rollen', () => {
  /* Dit is geen smaak maar de kern van de meting. draaiRolproef() slaat de
     JUISTE rol over en kruist de rest. Krijgt boardroomAuth de rol 'office',
     dan geldt het kantoortoken als juist en wordt het niet meer geprobeerd --
     terwijl juist DAT de interessante poging is (een echte kantoormedewerker die
     de boardroom in wil). De meting zou dan krimpen zonder dat een getal zakt. */
  const fout = bk.namenVan('eigenrol').filter(n => GEMODELLEERD.includes(bk.rolBij(n)));
  assert.deepStrictEqual(fout, [],
    'Een eigenrol met een gemodelleerde rolnaam maakt dat token "de juiste rol", ' +
    'en dan wordt het niet meer gekruist: ' + fout.join(', '));
});

test('elke eigenrol heeft een rol, elke niet-rol heeft er geen', () => {
  for (const [naam, [soort, rol]] of bk.KAART) {
    if (soort === 'rol' || soort === 'eigenrol') {
      assert.ok(rol, naam + ' is een ' + soort + ' en hoort een rolnaam te dragen');
    } else {
      assert.strictEqual(rol, null, naam + ' is een ' + soort + ' en hoort GEEN rol te dragen');
    }
  }
});

test('elke bewaker draagt een waarom, en dat is geen losse kreet', () => {
  for (const naam of bk.KAART.keys()) {
    const w = bk.waaromBij(naam);
    assert.ok(w.length >= 15, naam + ' heeft geen bruikbare uitleg: "' + w + '"');
  }
});

test('een rol wint van een eigenrol, en verfijners doen niet mee', () => {
  const rol = (b) => bk.beoordeel({ bewakersBekend: true, bewakers: b }).rol;
  assert.strictEqual(rol(['officeAuth', 'boardroomAuth']), 'office');
  assert.strictEqual(rol(['boardroomAuth']), 'boardroom');
  assert.strictEqual(rol(['boardroomAuth', 'alleenBaas']), 'boardroom');
  assert.strictEqual(rol(['techAuth', 'eigenaarAlleen']), 'techniek');
  assert.strictEqual(rol(['supplierAuth', 'rijk']), 'supplier');
  assert.strictEqual(rol(['auth', 'pro', 'kansPoort']), 'member');
});

test('een lichaamssleutel of objectpoort krijgt GEEN rol, met de reden erbij', () => {
  const o = (b) => bk.beoordeel({ bewakersBekend: true, bewakers: b });
  for (const naam of ['gastAuth', 'gezinsPoort', 'rtfPoort', 'arrivalPassAuth']) {
    const u = o([naam]);
    assert.strictEqual(u.rol, null, naam + ' hoort geen rol te krijgen');
    assert.match(u.reden, /lichaamssleutel/);
    assert.match(u.reden, /kruisen meet niets/);
  }
  for (const naam of ['huisAuth', 'huisPoort']) {
    const u = o([naam]);
    assert.strictEqual(u.rol, null);
    assert.match(u.reden, /objectpoort/);
  }
});

test('een rem voor een echte deur maakt hem geen remroute', () => {
  /* mw is de snelheidsrem. Stond hij vooraan, dan las mw+arrivalPassAuth als
     "geen autorisatielaag" -- een route MET een slot die zich voordeed als een
     route zonder. De sterkste bewering telt, niet de eerste. */
  const u = bk.beoordeel({ bewakersBekend: true, bewakers: ['mw', 'arrivalPassAuth'] });
  assert.match(u.reden, /lichaamssleutel/);
  assert.doesNotMatch(u.reden, /geen autorisatielaag/);

  const kaal = bk.beoordeel({ bewakersBekend: true, bewakers: ['mw'] });
  assert.match(kaal.reden, /geen autorisatielaag/);
});

test('onbekend blijft onbekend, en dat is geen lege bewakerslijst', () => {
  /* Het verschil dat de hele oefening draagt: NIET WETEN is iets anders dan
     WETEN DAT ER NIETS IS. Ze mogen nooit dezelfde reden krijgen. */
  const nietBekend = bk.beoordeel({ bewakersBekend: false, bewakers: [] });
  const leeg = bk.beoordeel({ bewakersBekend: true, bewakers: [] });
  assert.strictEqual(nietBekend.rol, null);
  assert.strictEqual(leeg.rol, null);
  assert.notStrictEqual(nietBekend.reden, leeg.reden);
  assert.match(nietBekend.reden, /geen bewakers noemen/);
  assert.match(leeg.reden, /geen bewakerslaag/);
});

test('een rol zonder token is geen beproefde rol', () => {
  /* DE KEERZIJDE VAN DE EIGENROLLEN, en die kostte bijna een stille meting.

     Door boardroom, techniek, scim en werkplekbaas als eigenrol te herkennen
     kwamen 123 routes als "met rol" uit verdeelOpRol(). Maar de proeven hebben
     alleen een token voor member, office en supplier. tokenVoor('boardroom')
     gaf undefined, de route werd ZONDER sleutel aangeroepen, kreeg 401, en dat
     telde als "geweigerd en er bleef niets staan": ROLLBACK bewezen. Natuurlijk
     bleef er niets staan -- er was geen sleutel. Een meter zonder invoer die toch
     een cijfer geeft (LAT.md regel 3).

     verdeelOpRol() neemt daarom een lijst beschikbare rollen. Wie er geen
     meegeeft krijgt het oude gedrag: de rolproef KRUIST rollen, en daar is een
     rol zonder token juist het geval dat je wilt beproeven. */
  const { alleRoutes, verdeelOpRol } = require('../scripts/lib/routes.js');
  const kandidaten = alleRoutes().filter(r => r.pad.startsWith('/api/') && r.methode !== 'GET');

  const ruim = verdeelOpRol(kandidaten);
  const krap = verdeelOpRol(kandidaten, ['member', 'office', 'supplier']);
  assert.ok(krap.metRol.length < ruim.metRol.length,
    'met een rollenlijst horen de eigenrol-routes eruit te vallen; nu ' +
    krap.metRol.length + ' tegen ' + ruim.metRol.length);

  for (const r of krap.metRol) {
    assert.ok(['member', 'office', 'supplier'].includes(r.rol),
      r.pad + ' krijgt rol "' + r.rol + '" terwijl daar geen token voor is');
  }
  const uitleg = krap.redenen.find(x => /geen token/.test(x.reden));
  assert.ok(uitleg && uitleg.aantal > 0,
    'de uitgevallen routes horen MET REDEN terug te komen, niet stil te verdwijnen');
});

test('de reclassificatie levert echte meting op, en dat is te tellen', () => {
  /* De 338 routes met een "onbekende rol" splitsen in vier groepen die om vier
     verschillende reparaties vragen. Deze toets houdt vast dat de KRUISBARE
     groep (eigenrol) niet stilletjes terugvalt naar ongemeten. Alleen groeien. */
  const alle = alleRoutes();
  const eigen = bk.namenVan('eigenrol');
  const kruisbaar = alle.filter(r => r.bewakersBekend &&
    r.bewakers.some(b => eigen.includes(b)) &&
    !r.bewakers.some(b => bk.soortVan(b) === 'rol'));
  assert.ok(kruisbaar.length >= 138,
    'de eigenrol-routes zijn kruisbaar geworden; dat aantal mag groeien maar niet ' +
    'krimpen zonder reden. Nu: ' + kruisbaar.length + ', ondergrens 138.');
});

/* ============================================================================
   EEN OPENBARE ROUTE IS TE BEPROEVEN, EN TELDE ALS INSTRUMENTTEKORT.

   WAT ER MIS WAS. `beoordeel()` gaf voor een route zonder middleware altijd
   "geen bewakerslaag (bewaking zit in de handler)". Voor de meeste klopt dat,
   maar niet voor de routes die met een REDEN op de openbaar-lijst staan
   (scripts/lib/publiek.js): die horen zonder sleutel open te gaan. Ze vielen
   daarmee in de bak GEEN_PROEFSLEUTEL van scripts/onbewezen.js -- een tekort
   van de opstelling -- terwijl er niets ontbrak. Er valt juist WEL te meten, en
   op de enige juiste manier: zonder token, want dat is wat een bezoeker
   meestuurt.

   Gemeten: 55 routes verhuisden van "geen sleutel" naar beproefbaar.

   EN DE TWEEDE HELFT VAN DEZELFDE FOUT: `rolVan()` gaf alleen de BEWAKERS door
   en niet het pad, dus de nieuwe tak werd nooit bereikt. De eerste meting na
   het toevoegen gaf 0 openbaar. Een tak die stil nooit afgaat is geen tak
   (LAT.md regel 9) -- vandaar dat de tweede toets hieronder door verdeelOpRol
   heen meet en niet alleen beoordeel() aanroept.

   DE MUTATIE: haal de PUBLIEK-tak uit beoordeel() -> beide toetsen zakken.
   Geef in verdeelOpRol het pad niet meer mee -> de tweede zakt.
   ========================================================================== */
test('een route zonder bewaker die met reden openbaar is, krijgt de rol openbaar', () => {
  const { PUBLIEK } = require('../scripts/lib/publiek');
  const pad = [...PUBLIEK.keys()][0];
  const u = bk.beoordeel({ bewakersBekend: true, bewakers: [], pad, methode: 'POST' });
  assert.equal(u.rol, 'openbaar', pad + ' staat met een reden op de openbaar-lijst');
  assert.equal(u.reden, null, 'een besluit is geen reden-om-niet');
});

test('een route zonder bewaker die NIET openbaar is, blijft een gat', () => {
  const u = bk.beoordeel({ bewakersBekend: true, bewakers: [], pad: '/api/bestaat-niet-xyz', methode: 'POST' });
  assert.equal(u.rol, null);
  assert.match(u.reden, /geen bewakerslaag/);
});

test('en de verdeling bereikt die tak ook werkelijk', () => {
  /* De tak zat er een meting lang in zonder ooit af te gaan, omdat het pad niet
     werd doorgegeven. Deze toets meet daarom door verdeelOpRol heen. */
  const { alleRoutes, isSchakel, verdeelOpRol } = require('../scripts/lib/routes');
  const { ROLLEN } = require('../scripts/lib/proefsleutels');
  const m = alleRoutes().filter(r => r.pad.startsWith('/api/') && r.methode !== 'GET' &&
    !isSchakel(r.pad) && !r.pad.includes(':'));
  const v = verdeelOpRol(m, ROLLEN);
  const openbaar = v.metRol.filter(x => x.rol === 'openbaar').length;
  assert.ok(openbaar > 20,
    'er horen tientallen openbare schrijfroutes beproefbaar te zijn, gevonden: ' + openbaar);
});

/* ============================================================================
   OPENBAAR MET EEN REM ERVOOR IS NOG STEEDS OPENBAAR.

   De openbaar-tak zat eerst alleen op de tak ZONDER enige middleware. Maar een
   openbare route heeft juist vaak wel iets voor zich staan -- een rem, want
   open en scheppend hoort begrensd te zijn. /api/arrival/interpret, de twee
   betaal-webhooks, de hele lab2-bewonerkant en het rtfos-portaal vielen
   daardoor onder "alleen verfijners, geen laag die een identiteit vaststelt".
   Dat is waar, en het is niet de conclusie: er valt WEL te meten, zonder token,
   precies zoals een bezoeker het doet.

   Gemeten: 41 routes stonden zo als instrumenttekort geboekt terwijl er niets
   ontbrak.

   HET IS DEZELFDE FOUT ALS EEN TAK HOGER, en die herhaling is het punt: de
   vraag "is dit met reden openbaar" hoort niet aan de VORM van de bewakerslijst
   te hangen. Wie hier een derde tak toevoegt, hoort deze vraag weer te stellen.

   DE MUTATIE: haal de PUBLIEK-tak uit de verfijner-tak -> deze toets zakt.
   ========================================================================== */
test('een openbare route met alleen een rem ervoor is beproefbaar', () => {
  const { PUBLIEK } = require('../scripts/lib/publiek');
  const pad = '/api/arrival/interpret';
  assert.ok(PUBLIEK.has(pad), 'deze route hoort met een reden op de openbaar-lijst te staan');
  const u = bk.beoordeel({ bewakersBekend: true, bewakers: ['mw'], pad, methode: 'POST' });
  assert.equal(u.rol, 'openbaar', 'een rem is geen identiteitslaag, maar ook geen reden om niet te meten');
});

test('een NIET-openbare route met alleen een rem blijft wel een gat', () => {
  const u = bk.beoordeel({ bewakersBekend: true, bewakers: ['mw'], pad: '/api/bestaat-niet-xyz', methode: 'POST' });
  assert.equal(u.rol, null);
  assert.match(u.reden, /geen autorisatielaag/,
    'zonder reden op de openbaar-lijst blijft een rem gewoon een rem');
});

test('de openbaar-lijst overschrijft nooit een ECHTE deur', () => {
  /* De zwakste bewering mag de sterkste niet overschrijven. Staat er een
     lichaamssleutel of een objectpoort voor, dan is er wel degelijk een deur --
     en dan mag "hij staat op de openbaar-lijst" die niet wegschrijven. */
  const { PUBLIEK } = require('../scripts/lib/publiek');
  const pad = [...PUBLIEK.keys()][0];
  for (const bewaker of ['gastAuth', 'huisAuth', 'meetpoort']) {
    const u = bk.beoordeel({ bewakersBekend: true, bewakers: [bewaker], pad, methode: 'POST' });
    assert.notEqual(u.rol, 'openbaar',
      bewaker + ' is een deur; de openbaar-lijst hoort die niet weg te schrijven');
  }
});
