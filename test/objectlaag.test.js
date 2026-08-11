/* De objectlaag (LIFE.md fase 2): niet apps maar objecten -- persoon, groep,
   event, elk met de caps die er ECHT bij horen.

   De vier beloften die deze toetsen bewaken:

     1. een cap is een belofte, en elke belofte heeft een bestaande bestemming
     2. een cap staat er alleen als er bewijs voor is
     3. het object bezit niets en schrijft nooit
     4. "bestaat niet" en "hoort niet bij u" zijn niet uit elkaar te houden

   Bij elke toets staat de mutatie die hem hoort te laten zakken; ze zijn alle
   met die mutatie gedraaid en gezien zakken (LAT.md regel 2). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const maakObjectlaag = require('../server/kern/objectlaag');
const { CAPS } = require('../server/kern/objectlaag/caps');

const APPS = path.join(__dirname, '..', 'public', 'apps');

/* Een lege kern in de vorm die de domeinen ECHT hebben -- elke veldnaam is uit
   het domeinbestand overgenomen. Zie test/socialewereld.test.js voor waarom dat
   hier met zoveel nadruk staat: een namaakbron die niet op de echte lijkt,
   bewijst niets, en dat heeft dit huis al een keer een lege titel gekost. */
function kernMet(over) {
  const k = {
    socialConnecties: () => ({ connections: [], requests: [] }),
    genootschap: {
      mijne: () => [], groepMet: () => null, isLid: () => false,
      publiek: (gr) => gr
    },
    bijeenkomst: { lijstVan: () => [], publiek: (b) => b },
    wbwMijn: () => ({ groepen: [] }),
    wbwGroep: () => ({ groep: { leden: [] } }),
    vonkMijn: () => ({ status: 200, matches: [] }),
    rvMatches: () => ({ status: 200, matches: [] })
  };
  Object.assign(k, over || {});
  return k;
}
const laag = (over) => maakObjectlaag({ kern: kernMet(over) }).objectlaag;

/* DE BELANGRIJKSTE TOETS VAN DEZE LAAG.

   PLATFORM.md beschrijft wat er gebeurt als beloftes loskomen van de code:
   zeventien app-teksten beloofden functies die niet bestonden, en geen ervan had
   een route. Een objectlaag kan die fout op grote schaal herhalen -- een cap
   'reizen' bij een persoon voelt logisch, en zonder bestemming is het een leugen
   met een pijltje.

   DE MUTATIE: voeg aan caps.js een cap toe met een link naar een pagina die niet
   bestaat (bijvoorbeeld '/apps/reizen-samen.html'). Deze toets hoort te zakken. */
test('elke cap in de catalogus wijst naar een pagina die echt bestaat', () => {
  const ids = Object.keys(CAPS);
  assert.ok(ids.length >= 10, 'de catalogus hoort gevuld te zijn (' + ids.length + ')');
  for (const id of ids) {
    const c = CAPS[id];
    assert.ok(c.naam && c.wat && c.app, 'cap ' + id + ' mist naam, uitleg of app');
    const bestand = c.link.replace(/^\/apps\//, '').split('#')[0];
    assert.ok(fs.existsSync(path.join(APPS, bestand)),
      'cap "' + id + '" belooft ' + c.link + ', en die pagina bestaat niet');
  }
});

/* DE MUTATIE: laat capVoor() een onbekende cap-id toch teruggeven (met lege
   naam). Dan belandt er een naamloos blokje op het scherm in plaats van dat het
   knalt. */
test('een verzonnen cap-id komt er niet doorheen, en zwijgt niet', () => {
  const l = laag({
    genootschap: {
      mijne: () => [], isLid: () => true, groepMet: () => ({ id: 'g1' }),
      publiek: () => ({ naam: 'De Kring', leden: 4, soort: 'besloten', mijnRol: 'lid' })
    }
  });
  const o = l.object('k', 'groep', 'g1');
  for (const c of o.caps) assert.ok(CAPS[c.id], 'cap ' + c.id + ' staat niet in de catalogus');
  assert.equal(l.object('k', 'bestaatniet', 'x'), null, 'een onbekende soort levert niets');
});

/* DE MUTATIE: geef in persoon.js een cap terug zonder de vondst te toetsen (dus
   `uit.push(capVoor(p.cap, ''))` buiten de if). Dan biedt het scherm "Wie
   betaalt wat" aan bij iemand met wie niets gedeeld wordt. */
test('een cap staat er alleen als er bewijs voor is', () => {
  const leeg = laag().object('k', 'persoon', 'Ux');
  assert.deepEqual(leeg.caps, [], 'een codenaam waar u niets mee deelt levert nul caps');
  assert.equal(leeg.ok, true, 'en dat is een geldig antwoord, geen fout');

  const l = laag({
    socialConnecties: () => ({ connections: [{ key: 'x', codename: 'Ux', unread: 3 }], requests: [] }),
    vonkMijn: () => ({ status: 200, matches: [{ id: 'm1', met: 'Ux', tafel: 'Chez Nous' }] })
  });
  const o = l.object('k', 'persoon', 'Ux');
  assert.deepEqual(o.caps.map(c => c.id).sort(), ['berichten', 'vonk']);
  assert.equal(o.caps.find(c => c.id === 'berichten').waarom, '3 ongelezen berichten');
  assert.equal(o.caps.find(c => c.id === 'vonk').waarom, 'match, tafel gereserveerd');
});

/* Elke cap draagt zijn REDEN, en dat is geen sierletter: een knop die er zomaar
   staat, laat het lid raden waarom.

   DE MUTATIE: haal `waarom` uit capVoor() in caps.js. */
test('elke cap zegt waarom hij er staat', () => {
  const l = laag({
    genootschap: {
      mijne: () => [], isLid: () => true, groepMet: () => ({ id: 'g1' }),
      publiek: () => ({ naam: 'De Kring', leden: 4, soort: 'besloten', mijnRol: 'beheerder' })
    }
  });
  const o = l.object('k', 'groep', 'g1');
  for (const c of o.caps) assert.ok(c.waarom, 'cap ' + c.id + ' staat er zonder reden');
  assert.equal(o.caps.find(c => c.id === 'beheer').waarom, 'u bent beheerder');
});

/* DE MUTATIE: laat groep.js de beheer-cap altijd meegeven. Dan biedt het scherm
   beheer aan waar de route hem weigert -- een knop naar een weigering die je had
   kunnen zien aankomen. */
test('beheer hangt aan de rol die het domein zelf kent', () => {
  const met = (rol) => laag({
    genootschap: {
      mijne: () => [], isLid: () => true, groepMet: () => ({ id: 'g1' }),
      publiek: () => ({ naam: 'K', leden: 2, soort: 'besloten', mijnRol: rol })
    }
  }).object('k', 'groep', 'g1').caps.map(c => c.id);
  assert.ok(met('beheerder').includes('beheer'));
  assert.ok(!met('lid').includes('beheer'), 'een gewoon lid krijgt geen beheer');
});

/* DE MUTATIE: laat groep.js een object teruggeven voor wie geen lid is. Dan
   verraadt de aanwezigheid van caps dat de groep bestaat en wat hij doet. */
test('bestaat niet en hoort niet bij u zijn niet uit elkaar te houden', () => {
  const geenLid = laag({
    genootschap: {
      mijne: () => [], isLid: () => false, groepMet: () => ({ id: 'g1', naam: 'Geheim' }),
      publiek: () => ({ naam: 'Geheim' })
    }
  });
  const bestaatNiet = laag();
  assert.equal(geenLid.object('k', 'groep', 'g1'), null);
  assert.equal(bestaatNiet.object('k', 'groep', 'g1'), null);
});

/* Een afgelaste bijeenkomst blijft opvraagbaar -- er staat iets in iemands
   agenda en die wil weten waarom het niet doorgaat -- maar kan niets meer.

   DE MUTATIE: haal de afgelast-tak uit event.js. Dan staat er "laten weten of u
   komt" onder een bijeenkomst die niet doorgaat. */
test('een afgelaste bijeenkomst kan alleen nog naar zijn groep wijzen', () => {
  const bij = (over) => laag({
    genootschap: { mijne: () => [{ id: 'g1', naam: 'De Kring' }], publiek: (gr) => gr, isLid: () => true, groepMet: () => null },
    bijeenkomst: {
      lijstVan: () => [Object.assign({ id: 'b1', wat: 'Borrel', datum: '2026-09-01' }, over)],
      publiek: (b) => b
    }
  }).object('k', 'event', 'b1');

  assert.deepEqual(bij({ afgelast: '2026-08-20' }).caps.map(c => c.id), ['vandegroep']);
  assert.deepEqual(bij({ mijnAntwoord: null }).caps.map(c => c.id).sort(), ['antwoord', 'vandegroep']);
  assert.deepEqual(bij({ mijnAntwoord: null, vanMij: true }).caps.map(c => c.id).sort(),
    ['antwoord', 'gastheer', 'vandegroep']);
  assert.equal(bij({ mijnAntwoord: 'ja' }).caps.find(c => c.id === 'antwoord').waarom,
    'u heeft "ja" geantwoord');
});

/* EEN BIJEENKOMST-ID IS EEN GETAL (Date.now(), kern/genootschap/bijeenkomst.js)
   en alles wat via een route binnenkomt is een string. Een kale `!==` matcht dan
   nooit, en de route gaf een 404 op een bijeenkomst die gewoon bestond.

   Deze toets stond er eerst NIET, en de fout kwam boven bij
   test/objectlaagroutes.test.js -- die met de echte domeinen praat. In de
   nagemaakte kern was de id een string, want zo had ik hem opgeschreven; dat is
   dezelfde blinde vlek als de lege bijeenkomsttitel eerder in deze wereld.

   DE MUTATIE: zet in event.js `String(b.id) !== String(id)` terug naar
   `b.id !== id`. */
test('een bijeenkomst met een getal als id wordt ook gevonden', () => {
  const l = laag({
    genootschap: { mijne: () => [{ id: 7, naam: 'De Kring' }], publiek: (gr) => gr, isLid: () => true, groepMet: () => null },
    bijeenkomst: {
      lijstVan: () => [{ id: 1755000000000, wat: 'Borrel', datum: '2026-09-01' }],
      publiek: (b) => b
    }
  });
  const o = l.object('k', 'event', '1755000000000');
  assert.ok(o, 'de route levert de id als string aan; het domein bewaart een getal');
  assert.equal(o.titel, 'Borrel');
});

/* Een event dat niet via een eigen groep bereikbaar is, hoort niet gevonden te
   worden. De poort zit in de ZOEKWEG en niet in een aparte controle.

   DE MUTATIE: laat event.js over alle groepen zoeken in plaats van over
   genootschap.mijne(key). */
test('een bijeenkomst uit een groep waar u niet in zit, bestaat voor u niet', () => {
  const l = laag({
    genootschap: { mijne: () => [], publiek: (gr) => gr, isLid: () => true, groepMet: () => null },
    bijeenkomst: { lijstVan: () => [{ id: 'b1', wat: 'Besloten diner' }], publiek: (b) => b }
  });
  assert.equal(l.object('k', 'event', 'b1'), null);
});

/* DE MUTATIE: haal de try/catch uit persoon.js caps(). Dan levert een object
   waarvan een proef stukging "hier kan niets" op -- een bewering in plaats van
   een leegte, terwijl er gewoon een gedeeld lijstje bestaat. */
test('een proef die stukgaat wordt gemeld en neemt de andere niet mee', () => {
  const l = laag({
    socialConnecties: () => { throw new Error('vrienden stuk'); },
    vonkMijn: () => ({ status: 200, matches: [{ id: 'm1', met: 'Ux' }] })
  });
  const o = l.object('k', 'persoon', 'Ux');
  assert.deepEqual(o.stil, ['verbinding']);
  assert.deepEqual(o.caps.map(c => c.id), ['vonk'], 'de andere proeven horen door te lopen');
});

/* Een gesloten poort (Vonk eist 18+ met geverifieerd paspoort) is geen storing
   en geen match: gewoon niets. Zelfde afspraak als in de sociale graaf.

   DE MUTATIE: haal `if (v.error) return null` uit de vonk-proef. Dan valt Vonk
   voor elk minderjarig lid in stil[] en lijkt er iets stuk. */
test('een gesloten poort is leeg, niet stil', () => {
  const l = laag({ vonkMijn: () => ({ status: 403, error: 'Vonk is voor 18 jaar en ouder.' }) });
  const o = l.object('k', 'persoon', 'Ux');
  assert.deepEqual(o.stil, []);
  assert.deepEqual(o.caps, []);
});

/* DE MUTATIE: voeg een functie toe die iets bewaart. Een object dat gaat
   bewaren, laat een bijeenkomst op twee plekken bestaan (LIFE.md par. 2). */
test('bezit niets: er is geen enkele manier om iets te schrijven', () => {
  assert.deepEqual(Object.keys(laag()).sort(), ['CAPS', 'SOORTEN', 'object']);
  assert.deepEqual(laag().SOORTEN.sort(), ['event', 'groep', 'persoon']);
});

/* Attenties en Entourage staan met opzet NIET in de catalogus: die bewaren
   mensen met hun ECHTE naam in het eigen dossier, en deze laag draait op
   codenamen. Een cap die de twee zou koppelen, doorbreekt het ontwerp dat
   CLAUDE.md beschermt (privacy by design).

   DE MUTATIE: zet een cap 'attentie' of 'entourage' in de catalogus. Deze toets
   hoort te zakken -- en wie hem toch wil, leest eerst de kop van persoon.js. */
test('geen cap koppelt een codenaam aan een dossier met echte namen', () => {
  for (const id of Object.keys(CAPS)) {
    assert.ok(!/attentie|entourage|cercle/i.test(id),
      'cap "' + id + '" koppelt de codenaam-wereld aan een dossier met echte namen');
  }
});
