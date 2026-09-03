/* DE DRAGERS BIJ EEN LOPEND VERZOEK -- welke laag heeft echt een sleutel.

   HET GAT DAT DIT SLUIT, en het was er een van het soort dat groen kijkt. De
   drager `apparaat` had een keurige opslagplek en geen enkele plek in de code
   die er ooit een sleutel in stopte; `sessie` viel stil terug op de
   IDENTITEITsleutel. Een lid dat "alleen deze inlog" dichtzette, zette zichzelf
   dus overal dicht -- en niets zei dat. De meter meldde ondertussen "5 van de 6
   dragers met een bron", omdat `bron` de vraag "waar staat de stand"
   beantwoordde terwijl scripts/isolatieproef.js hem las als "kan dit werken".
   Twee vragen onder een veldnaam.

   ZES BEWERINGEN, en de vijfde is de belangrijkste: de MIGRATIE. Zonder die stap
   staat elk lid dat vandaag op `sessie: isolatie` staat na een versiewissel
   zonder ceremonie weer op normaal -- precies wat SEC-LOCK-001 verbiedt, en
   test/seclock.test.js vangt het niet (die toetst de route en de bron, niet de
   opslag over een versiegrens heen).

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - `apparaat: req.body.apparaat` in sessiedragers.js  -> 1 ZAKT (RAAK).
   - `sessie` terugzetten op `s.key`                    -> 2 ZAKT (RAAK).
   - de reden weglaten bij een ontbrekende drager       -> 3 ZAKT (RAAK).
   - de apparaatsleutel uit crypto.randomBytes halen in plaats van uit de
     credential                                         -> 4 ZAKT (RAAK: elke
     inlog is dan een nieuw apparaat, en dan is de drager een teller).
   - de migratie overslaan                              -> 5 ZAKT (RAAK).
   - `s.id || s.sid` op een van de drie plekken terugzetten -> 6 ZAKT (RAAK).

   Draai los: node --test test/isolatiedragers.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { dragersVanVerzoek, EIGEN_LAGEN } = require('../server/kern/isolatie/sessiedragers');
const { sleutelUitCredential } = require('../server/kern/isolatie/apparaatsleutel');
const dragerlijst = require('../server/kern/isolatie/dragers');
const migreer = require('../server/kern/initdata/isolatiesleutels');
const { tokenHash } = require('../server/kern/sessies');

/* Een nagebootst verzoek. Alleen wat de echte deur ook levert: een sessie en de
   Authorization-kop. Bewust GEEN body -- als deze toets er een gaf, zou hij niet
   kunnen meten dat de vertaling er nooit naar kijkt. */
function verzoek(sessie, token, body) {
  return { session: sessie, body: body || {},
    get: (h) => (String(h).toLowerCase() === 'authorization' && token ? 'Bearer ' + token : '') };
}

test('1. de sleutel komt nooit uit het verzoekslijf', () => {
  const uit = dragersVanVerzoek(verzoek({ key: 'user-7' }, 'tok-a',
    { apparaat: 'gestolen', sessie: 'gestolen', identiteit: 'gestolen', organisatie: 'gestolen' }));
  for (const [naam, sleutel] of Object.entries(uit.sleutels)) {
    assert.notEqual(sleutel, 'gestolen', naam + ' kwam uit het lijf; dat is een uitlogknop voor ' +
      'willekeurige leden, geen beveiligingsfunctie');
  }
  assert.equal(uit.sleutels.identiteit, 'user-7');
});

test('2. twee logins van hetzelfde account krijgen dezelfde identiteit en VERSCHILLENDE sessies', () => {
  const een = dragersVanVerzoek(verzoek({ key: 'user-7' }, 'token-een'));
  const twee = dragersVanVerzoek(verzoek({ key: 'user-7' }, 'token-twee'));

  assert.equal(een.sleutels.identiteit, twee.sleutels.identiteit, 'dezelfde mens');
  assert.notEqual(een.sleutels.sessie, twee.sleutels.sessie,
    'maar niet dezelfde inlog -- anders zetten twee lagen in werkelijkheid dezelfde stand');
  /* En het is de sessiesleutel van het HUIS en geen tweede definitie: dezelfde
     hash die bepaalt of u bent ingelogd (LAT.md regel 4). */
  assert.equal(een.sleutels.sessie, tokenHash('token-een'));
});

test('3. een ontbrekende drager komt terug met een reden en nooit als kale null', () => {
  const uit = dragersVanVerzoek(verzoek({ key: 'user-7' }, 'tok'));
  assert.equal(uit.sleutels.organisatie, null);
  assert.ok(String(uit.ontbreekt.organisatie || '').length > 40,
    'een laag die niet werkt hoort te zeggen waarom (GRAMMATICA.md): ' +
    JSON.stringify(uit.ontbreekt.organisatie));
  /* De reden staat in het dragerregister en is hier niet overgetypt. */
  assert.equal(uit.ontbreekt.organisatie, dragerlijst.OP_NAAM.organisatie.geenSleutel);

  /* Zonder token bestaat er geen sessie, en ook dat draagt een reden. */
  const zonder = dragersVanVerzoek(verzoek({ key: 'user-7' }, null));
  assert.equal(zonder.sleutels.sessie, null);
  assert.ok(String(zonder.ontbreekt.sessie || '').length > 10);
});

test('4. dezelfde passkey geeft dezelfde apparaatsleutel, een andere niet', () => {
  const geheim = () => Buffer.from('0123456789abcdef0123456789abcdef');
  const a1 = sleutelUitCredential('cred-A', geheim);
  const a2 = sleutelUitCredential('cred-A', geheim);
  const b = sleutelUitCredential('cred-B', geheim);

  assert.equal(a1, a2, 'twee inlogs met dezelfde passkey zijn hetzelfde apparaat');
  assert.notEqual(a1, b, 'twee passkeys zijn twee apparaten');
  assert.match(String(a1), /^[a-f0-9]{32}$/);
  /* HET CREDENTIAL-ID ZELF KOMT ER NIET IN. Dat id is over accounts heen te
     herkennen; wie het op twee plekken ziet, weet dat het dezelfde
     authenticator is. */
  assert.ok(!String(a1).includes('cred'), 'de sleutel is een afgeleide en niet het id');

  /* Zonder kluisgeheim: null en geen verzinsel. Een sleutel die uit niets is
     afgeleid, hangt aan niets. */
  assert.equal(sleutelUitCredential('cred-A', () => null), null);
  assert.equal(sleutelUitCredential('', geheim), null);
});

test('5. de migratie verplaatst een oude sessiestand en verzwakt hem nooit', () => {
  /* De oude vorm: de sessiesleutel WAS de identiteitsleutel. */
  const db = { data: { isolatie: {
    sessie: { 'user-7': { stand: 'isolatie', sinds: '2026-08-01T00:00:00.000Z', door: 'lid-user-7' } },
    identiteit: { 'user-7': { stand: 'beschermd', sinds: '2026-08-01T00:00:00.000Z', door: 'lid-user-7' } }
  } } };
  migreer({ db, save: () => {} });

  assert.deepEqual(db.data.isolatie.sessie, {}, 'de oude rij is weg');
  const na = db.data.isolatie.identiteit['user-7'];
  assert.equal(na.stand, 'isolatie',
    'de STRENGSTE van de twee wint; de andere kant op zou een verlaging zonder ceremonie zijn');
  assert.match(String(na.reden), /verplaatst van de drager/);
  assert.equal(db.data.isolatie.spoor[0].richting, 'verplaatst');

  /* Een echte sessiesleutel (64 hex) blijft staan: die hoort er wel. */
  const db2 = { data: { isolatie: { sessie: { ['a'.repeat(64)]: { stand: 'beperkt' } } } } };
  migreer({ db: db2, save: () => {} });
  assert.ok(db2.data.isolatie.sessie['a'.repeat(64)], 'een echte sessiesleutel verhuist niet');

  /* EN HIJ IS AANGESLOTEN, wat een tweede bewering is. De eerste helft van deze
     toets roept de migratie rechtstreeks aan; dat bewijst dat hij WERKT en niet
     dat hij DRAAIT. De mutatie "sla de migratie over" liep daar dus doorheen --
     een toets die zijn onderwerp zelf aanroept, meet de bedrading nooit. */
  const opstart = fs.readFileSync(
    path.join(__dirname, '..', 'server/kern/initdata/deel1-basis.js'), 'utf8');
  assert.match(opstart, /require\('\.\/isolatiesleutels'\)\(\{ db, save \}\)/,
    'de migratie hoort bij het opstarten te draaien; alleen bestaan is niet genoeg');
});

test('6. de vertaling staat op EEN plek: geen s.id of s.sid meer in de code', () => {
  const wortel = path.join(__dirname, '..', 'server');
  const { codeRegelsUit } = require('../scripts/lib/werkelijkheid');
  const raak = [];
  (function loop(map) {
    for (const naam of fs.readdirSync(map, { withFileTypes: true })) {
      const p = path.join(map, naam.name);
      if (naam.isDirectory()) { if (naam.name !== 'data' && naam.name !== 'node_modules') loop(p); continue; }
      if (!naam.name.endsWith('.js')) continue;
      const rel = path.relative(path.join(__dirname, '..'), p).replace(/\\/g, '/');
      for (const [lijn, code] of codeRegelsUit(fs.readFileSync(p, 'utf8'))) {
        /* De vorm die het gat maakte, en NIET breder: een sessiesleutel raden
           uit twee velden die niet bestaan, met de identiteitsleutel als stille
           terugval. `s.id || null` elders in het huis gaat over iets anders --
           een toets die dat meepakt, meldt werk dat er niet is en wordt
           uitgezet. */
        if (/\bs\.(id|sid)\s*\|\|\s*s\.(sid|key)\b/.test(code)) {
          raak.push(rel + ':' + lijn + '  ' + code.trim().slice(0, 90));
        }
      }
    }
  })(wortel);
  assert.deepEqual(raak, [],
    'deze plekken raden hun sessiesleutel opnieuw; de vertaling hoort alleen in ' +
    'kern/isolatie/sessiedragers.js te staan: ' + raak.join(' | '));

  /* En de lijst eigen lagen is er ook maar EEN. */
  assert.deepEqual([...EIGEN_LAGEN], ['identiteit', 'sessie', 'apparaat']);
});
