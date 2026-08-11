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
    bijeenkomst: { lijstVan: () => [], publiek: (b) => b, mijnAgenda: () => ({ komt: [] }) },
    wbwMijn: () => ({ groepen: [] }),
    wbwGroep: () => ({ groep: { leden: [] } }),
    vonkMijn: () => ({ status: 200, matches: [] }),
    rvMatches: () => ({ status: 200, matches: [] }),
    db: { data: { supplierTypes: {} } },
    mijnSpellen: () => ({ potjes: [], uitnodigingen: [] }),
    bestandenLijst: () => ({ eigen: [], gedeeld: [] }),
    comm: { isAanwezig: () => false }
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
      publiek: (b) => b, mijnAgenda: () => ({ komt: [] })
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
      publiek: (b) => b, mijnAgenda: () => ({ komt: [] })
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
    bijeenkomst: { lijstVan: () => [{ id: 'b1', wat: 'Besloten diner' }], publiek: (b) => b, mijnAgenda: () => ({ komt: [] }) }
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

/* EEN LOPEND POTJE IS EEN FEIT, EEN BALANS IS EEN SCORE.

   `ikAanZet` komt uit het spellendomein zelf en is precies waar deze laag om
   draait: niet "u speelt weleens samen" maar "de beurt ligt bij u".

   DE MUTATIE: laat de spel-proef ook afgelopen potjes meenemen (haal de
   status-controle weg). Dan verschijnt er een cap naar een potje dat uit is. */
test('een lopend potje telt, een afgelopen potje niet', () => {
  const met = (potjes) => laag({ mijnSpellen: () => ({ potjes, uitnodigingen: [] }) })
    .object('k', 'persoon', 'Ux');

  assert.deepEqual(met([{ id: 'p1', naam: 'Magnaat', status: 'klaar', spelers: ['Ux'], winnaar: 0 }]).caps, [],
    'een afgelopen potje is geen lopende zaak');

  const bezig = met([{ id: 'p1', naam: 'Magnaat', status: 'bezig', spelers: ['Ux'], ikAanZet: true }]);
  assert.equal(bezig.caps[0].id, 'spel');
  assert.equal(bezig.caps[0].waarom, 'Magnaat, u bent aan zet');

  const ander = met([{ id: 'p1', naam: 'Magnaat', status: 'bezig', spelers: ['Ux'], ikAanZet: false, aanZet: 'Ux' }]);
  assert.equal(ander.caps[0].waarom, 'Magnaat, Ux is aan zet');
});

/* DE KOP VAN HET OBJECT: wie is dit en wat is de stand tussen ons. Feiten uit
   domeinen, en geen enkel oordeel.

   DE MUTATIE: laat de kop een getal opnemen dat over de RELATIE gaat in plaats
   van over dingen -- een hechtheid, een reeks, een percentage. Zo'n veld hoort
   deze toets te laten zakken (LIFE.md par. 4.4). */
test('de kop draagt feiten uit domeinen, en nooit een cijfer over de relatie', () => {
  const l = laag({
    socialConnecties: () => ({ connections: [{ key: 'x', codename: 'Ux', unread: 0, lastAt: '2026-08-10T20:00:00.000Z' }], requests: [] }),
    comm: { isAanwezig: (k) => k === 'x' },
    bijeenkomst: {
      lijstVan: () => [], publiek: (b) => b,
      mijnAgenda: () => ({ komt: [
        { id: 'b0', wat: 'Zonder hen', datum: '2026-09-01', groep: 'K', komen: ['Andere'] },
        { id: 'b1', wat: 'Samen eten', datum: '2026-09-02', tijd: '19:00', groep: 'De Kring', komen: ['Ux'] }
      ] })
    }
  });
  const o = l.object('k', 'persoon', 'Ux');
  assert.equal(o.titel, 'Ux');
  assert.equal(o.over.aanwezig, true);
  assert.equal(o.over.laatsteGesprek, '2026-08-10T20:00:00.000Z');
  assert.deepEqual(o.over.volgendeAfspraak,
    { wat: 'Samen eten', datum: '2026-09-02', tijd: '19:00', groep: 'De Kring' },
    'alleen een bijeenkomst waar de ander ook ja zei, is een gedeelde afspraak');

  /* De harde grens, machinaal: geen enkel veld in de kop mag een oordeel over
     de relatie dragen. Wie er ooit een wil, leest eerst LIFE.md par. 4.4. */
  for (const veld of Object.keys(o.over)) {
    assert.ok(!/score|hecht|reeks|streak|niveau|rang|punt|percentage/i.test(veld),
      'de kop draagt een cijfer over de relatie: ' + veld);
  }
});

/* Aanwezigheid is geen openbaar gegeven: wie niet verbonden is, krijgt het niet.

   DE MUTATIE: haal de aanwezigheid buiten de verbinding-tak, zodat elke codenaam
   hem krijgt. */
test('online zijn ziet u alleen van wie u verbonden bent', () => {
  const l = laag({ comm: { isAanwezig: () => true } });
  const o = l.object('k', 'persoon', 'Vreemde');
  assert.equal(o.over.aanwezig, undefined);
  assert.equal(o.over.laatsteGesprek, undefined);
});

/* Een bron die door twee kanten gelezen wordt (de proeven en de kop) hoort bij
   een storing EEN melding te geven en niet twee.

   DE MUTATIE: haal de Set weg bij het samenvoegen van stil in persoon.js. */
test('een stukke bron wordt een keer gemeld, niet twee keer', () => {
  const l = laag({ socialConnecties: () => { throw new Error('vrienden stuk'); } });
  assert.deepEqual(l.object('k', 'persoon', 'Ux').stil, ['verbinding']);
});

/* DE RELATIERUIMTE (LIFE.md fase 3), en de regel die haar draagt.

   Par. 4.2 zegt dat een relatieruimte van TWEE mensen is en niet van een. Dat is
   hier geen controle maar een eigenschap van de constructie: alles komt uit
   domeinen waar allebei in zitten. Een bijeenkomst telt alleen als IK ja zei EN
   de ander in `komen` staat; een groep waar de ander geen lid van is, levert
   niets.

   DE MUTATIE: laat samen.js de ledenlijst-controle weg, of accepteer een
   bijeenkomst waar de ander niet op geantwoord heeft. Dan staat er iets in de
   ruimte dat de ander niet ziet -- en dan is het geen gedeelde ruimte meer maar
   een dossier over iemand. */
test('in de ruimte staat alleen wat allebei ook echt delen', () => {
  const groepen = [{ id: 'g1', naam: 'Samen' }, { id: 'g2', naam: 'Zonder hen' }];
  const l = laag({
    genootschap: {
      mijne: () => groepen, groepMet: () => null, isLid: () => true,
      publiek: (gr) => ({ id: gr.id, naam: gr.naam,
        ledenlijst: gr.id === 'g1' ? [{ codenaam: 'Ux' }] : [{ codenaam: 'Andere' }] })
    },
    bijeenkomst: {
      mijnAgenda: () => ({ komt: [] }),
      lijstVan: (gid) => gid === 'g1'
        ? [{ id: 'b1', wat: 'Samen gegeten', datum: '2026-01-05' },
           { id: 'b2', wat: 'Zij zeiden nee', datum: '2026-01-06' },
           { id: 'b3', wat: 'Ik zei nee', datum: '2026-01-07' }]
        : [{ id: 'b9', wat: 'Andere groep', datum: '2026-01-08' }],
      publiek: (b) => Object.assign({}, b, {
        mijnAntwoord: b.id === 'b3' ? 'nee' : 'ja',
        komen: b.id === 'b2' ? ['Andere'] : ['Ux']
      })
    }
  });
  const o = l.object('k', 'persoon', 'Ux');
  assert.deepEqual(o.samen.map(r => r.wat), ['Samen gegeten'],
    'alleen waar ik ja zei EN de ander in komen staat, uit een groep die we delen');
  assert.equal(o.samen[0].bron, 'Samen');
});

/* Wat komt staat boven wat geweest is, zoals een mens zijn agenda leest.

   DE MUTATIE: sorteer alles op een hoop, of zet geweest bovenaan. */
test('de ruimte zet komend boven geweest, en telt dingen en geen relatie', () => {
  const l = laag({
    mijnSpellen: () => ({ potjes: [{ id: 'p1', naam: 'Magnaat', status: 'bezig',
      spelers: ['Ux'], at: '2026-02-01T10:00:00.000Z' }], uitnodigingen: [] }),
    genootschap: {
      mijne: () => [{ id: 'g1', naam: 'K' }], groepMet: () => null, isLid: () => true,
      publiek: () => ({ id: 'g1', naam: 'K', ledenlijst: [{ codenaam: 'Ux' }] })
    },
    bijeenkomst: {
      mijnAgenda: () => ({ komt: [] }),
      lijstVan: () => [{ id: 'b1', wat: 'Lang geleden', datum: '2020-01-01' }],
      publiek: (b) => Object.assign({}, b, { mijnAntwoord: 'ja', komen: ['Ux'] })
    }
  });
  const o = l.object('k', 'persoon', 'Ux');
  assert.deepEqual(o.samen.map(r => r.soort), ['spel', 'bijeenkomst']);
  assert.deepEqual(o.telling, { komt: 1, geweest: 1 });
  for (const veld of Object.keys(o.telling)) {
    assert.ok(!/score|hecht|reeks|streak|niveau|rang/i.test(veld),
      'de telling gaat over dingen, niet over de relatie: ' + veld);
  }
});

/* Een saldo hoort in RTG Geld en niet naast iemands naam in een sociale ruimte:
   dat maakt van een vriend een debiteur.

   DE MUTATIE: neem `mijnSaldo` of een bedrag op in de lijstje-regel. */
test('een gedeeld lijstje staat er zonder bedrag', () => {
  const l = laag({
    wbwMijn: () => ({ groepen: [{ id: 'w1', naam: 'Ibiza', at: '2026-03-01T00:00:00.000Z', mijnSaldo: -4500 }] }),
    wbwGroep: () => ({ groep: { leden: [{ codenaam: 'Ux' }, { codenaam: 'ik' }] } })
  });
  const r = l.object('k', 'persoon', 'Ux').samen.find(x => x.soort === 'lijstje');
  assert.equal(r.wat, 'Ibiza');
  assert.deepEqual(Object.keys(r).sort(), ['bron', 'komt', 'soort', 'waar', 'wanneer', 'wat'],
    'geen bedrag, geen saldo, geen schuld in de sociale ruimte');
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

/* DE WERELD OM EEN MOMENT HEEN (LIFE.md fase 6).

   Het punt van deze fase is de VORM, niet het aantal koppelingen. Een
   bijeenkomst vraagt om een CAPABILITY -- een tafel, vervoer, een verblijf, een
   kaartje -- en elk genre dat die cap draagt kan hem leveren. Een domein erbij
   is dan geen koppeling erbij: het genre krijgt zijn cap in het register en
   verschijnt vanzelf. Dat is dezelfde beweging waarmee de handelsketen van N²
   weer N maakte.

   DE MUTATIE: bouw in eventwereld.js een koppeling per GENRE in plaats van per
   cap (bijvoorbeeld hard naar 'restaurant'). Dan telt `genres` niet meer mee met
   het register, en deze toets zakt zodra er een genre bijkomt of afvalt. */
test('een event vraagt om capabilities, niet om genres', () => {
  const register = {
    restaurant: { caps: ['menu', 'reservations', 'tickets'] },
    beachclub: { caps: ['reservations', 'tickets'] },
    taxi: { caps: ['rides'] },
    hotel: { caps: ['bookings'] },
    juwelier: { caps: ['retail'] }
  };
  const l = laag({
    db: { data: { supplierTypes: register } },
    genootschap: { mijne: () => [{ id: 'g1', naam: 'K' }], publiek: (gr) => gr, isLid: () => true, groepMet: () => null },
    bijeenkomst: {
      lijstVan: () => [{ id: 'b1', wat: 'Diner', datum: '2026-09-01', tijd: '20:00', waar: 'De Salon', plaatsen: 12 }],
      publiek: (b) => b, mijnAgenda: () => ({ komt: [] })
    }
  });
  const o = l.object('k', 'event', 'b1');
  const caps = o.eromheen.map(x => x.cap);
  assert.deepEqual(caps, ['reservations', 'rides', 'bookings', 'tickets']);

  /* De telling komt uit het REGISTER en niet uit een lijstje hier. */
  assert.equal(o.eromheen.find(x => x.cap === 'reservations').genres, 2);
  assert.equal(o.eromheen.find(x => x.cap === 'rides').genres, 1);

  /* Elke weg wijst naar een pagina die bestaat -- zelfde regel als bij de caps,
     en om dezelfde reden (PLATFORM.md: zeventien beloftes zonder route). */
  for (const e of o.eromheen) {
    assert.ok(e.naam && e.wat && e.app, 'regel ' + e.cap + ' is niet compleet');
    assert.ok(e.waarom, 'regel ' + e.cap + ' staat er zonder reden');
    assert.ok(fs.existsSync(path.join(APPS, e.link.replace(/^\/apps\//, '').split('#')[0])),
      'de weg voor "' + e.cap + '" wijst naar ' + e.link + ', en die pagina bestaat niet');
  }
});

/* Elke regel hangt aan een FEIT uit de bijeenkomst zelf; er wordt niets geraden.

   DE MUTATIE: zet 'bookings' of 'tickets' altijd aan. Dan stelt het platform een
   overnachting voor bij een lunch, en kaarten bij iets zonder capaciteit. */
test('wat erbij hoort volgt uit de bijeenkomst en wordt niet geraden', () => {
  const maak = (over) => laag({
    db: { data: { supplierTypes: {} } },
    genootschap: { mijne: () => [{ id: 'g1', naam: 'K' }], publiek: (gr) => gr, isLid: () => true, groepMet: () => null },
    bijeenkomst: {
      lijstVan: () => [Object.assign({ id: 'b1', wat: 'X', datum: '2026-09-01' }, over)],
      publiek: (b) => b, mijnAgenda: () => ({ komt: [] })
    }
  }).object('k', 'event', 'b1').eromheen.map(x => x.cap);

  assert.deepEqual(maak({ tijd: '12:30' }), ['reservations', 'rides'],
    'een lunch vraagt geen overnachting');
  assert.deepEqual(maak({ tijd: '20:00' }), ['reservations', 'rides', 'bookings']);
  assert.deepEqual(maak({ tijd: '12:30', plaatsen: 40 }), ['reservations', 'rides', 'tickets'],
    'plaatsen is het enige signaal in de data dat op entree lijkt');
});

/* Een afgelaste bijeenkomst krijgt geen wereld eromheen: een tafel voorstellen
   bij iets dat niet doorgaat is erger dan zwijgen.

   EERLIJK OVER WELKE WACHT DIT IS. De eerst opgeschreven mutatie was "haal de
   afgelast-controle uit eromheen()", en die is gedraaid en liet deze toets NIET
   zakken: event.js keert bij een afgelaste bijeenkomst al vroeg terug met een
   andere vorm, dus die tweede controle was dode code. Hij is weggehaald.

   DE MUTATIE DIE HEM WEL LAAT ZAKKEN: haal `eromheen: []` uit de afgelast-tak
   van event.js. */
test('een afgelaste bijeenkomst krijgt geen wereld eromheen', () => {
  const l = laag({
    db: { data: { supplierTypes: {} } },
    genootschap: { mijne: () => [{ id: 'g1', naam: 'K' }], publiek: (gr) => gr, isLid: () => true, groepMet: () => null },
    bijeenkomst: {
      lijstVan: () => [{ id: 'b1', wat: 'Borrel', datum: '2026-09-01', tijd: '20:00', afgelast: '2026-08-20' }],
      publiek: (b) => b, mijnAgenda: () => ({ komt: [] })
    }
  });
  assert.deepEqual(l.object('k', 'event', 'b1').eromheen, []);
});

/* Deze laag BOEKT NIETS en belooft niets. Er is geen veld dat een reservering
   aankondigt, en geen functie die iets aanvraagt -- elke handeling zou een DERDE
   partij raken (een zaak die een tafel vrijhoudt), en CLAUDE.md verbiedt te doen
   alsof een boeking verwerkt is.

   DE MUTATIE: voeg aan een regel een veld toe als `gereserveerd`, `bevestigd` of
   `aangevraagd`. */
test('de wereld om een event heen boekt niets en belooft niets', () => {
  const l = laag({
    db: { data: { supplierTypes: { restaurant: { caps: ['reservations'] } } } },
    genootschap: { mijne: () => [{ id: 'g1', naam: 'K' }], publiek: (gr) => gr, isLid: () => true, groepMet: () => null },
    bijeenkomst: {
      lijstVan: () => [{ id: 'b1', wat: 'Diner', datum: '2026-09-01', tijd: '20:00' }],
      publiek: (b) => b, mijnAgenda: () => ({ komt: [] })
    }
  });
  for (const e of l.object('k', 'event', 'b1').eromheen) {
    assert.deepEqual(Object.keys(e).sort(),
      ['app', 'cap', 'genres', 'link', 'naam', 'waarom', 'wat'],
      'geen veld dat een boeking of aanvraag suggereert');
  }
});
