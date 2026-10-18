/* HET COMMAND-JOURNAAL ONDER AANVAL (server/kern/command/journaal.js).

   Het command-journaal is het spoor waar de beveiliging op leunt: iedere
   handeling, met wie, waarom en onder welke regel, en elke regel draagt de hash
   van de vorige. test/commandjournaal-takken.test.js loopt de gewone takken na.
   Dit bestand doet wat een aanvaller of een kapotte schijf doet: een regel
   WIJZIGEN, WEGHALEN, INVOEGEN, VERWISSELEN of opnieuw zegelen, de opslag laten
   falen terwijl er genoteerd wordt -- en kijkt of het journaal dat aanwijst, of
   luid faalt, in plaats van stil door te lopen.

   Wat hier niet mag sneuvelen:
   1. elke wijziging aan een veld onder de zegel (ook de releasecommit en het
      verzoek-id) wordt door controleer() aangewezen, op precies die regel;
   2. een ingevoegde, verwijderde of verwisselde regel breekt de verwijzing, en
      de EERSTE regel waar het misgaat wordt aangewezen -- niet een latere;
   3. wie een regel opnieuw zegelt om zijn wijziging te verbergen, wordt op de
      VOLGENDE regel betrapt; alleen een volledig herzegelde keten klopt weer, en
      dan verraadt de geexporteerde kop het verschil;
   4. een weggeknipte staart of kop laat de keten heel, maar `aantal` blijft het
      echte totaal tellen, zodat het gat zichtbaar blijft;
   5. een opslag die faalt (save of append) faalt LUID: noteer gooit, en het
      journaal doet niet alsof de regel bewaard is;
   6. een wissing (AVG art. 17) zet de kop van VOOR de wissing in de keten, en
      een mislukte herschrijving laat geen half-gewist journaal achter;
   7. twee vakken (twee zaken) delen nooit een keten.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in controleer() `if (zonder.vorig !== vorig)` vervangen door `if (false)`
     -> "2. een ingevoegde regel", "2b. een verwijderde regel", "2c. verwisselde
        regels", "3. een herzegelde regel" en "7. twee vakken" ZAKKEN (RAAK)
   - in noteer() de regel `if (release) kern.release = release;` weggehaald
     -> "1b. de releasecommit staat onder de zegel" ZAKT (RAAK)
   - in wisActor() `voor: { kopVoorWissing: kopVoor }` vervangen door
     `voor: { kopVoorWissing: null }`
     -> "6. een wissing zet de oude kop in de keten" ZAKT (RAAK)

   Draai: node --test test/commandjournaal-weerbaar.test.js */
'use strict';
/* Een releasecommit uit de omgeving, VOOR het journaal hem voor het eerst leest:
   release() leest een keer per proces. Zo staat er een release in elke regel en
   kan toets 1b zien dat hij onder de zegel valt. */
const OUDE_RELEASE = process.env.RTG_RELEASE_COMMIT;
process.env.RTG_RELEASE_COMMIT = 'abcdef1234567';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { maakJournaal } = require('../server/kern/command/journaal');
require('../server/lib/releaseidentiteit').release({ vers: true });
test.after(() => {
  if (OUDE_RELEASE === undefined) delete process.env.RTG_RELEASE_COMMIT; else process.env.RTG_RELEASE_COMMIT = OUDE_RELEASE;
  require('../server/lib/releaseidentiteit').release({ vers: true });
});

function opzet(save) {
  const vak = {};
  const j = maakJournaal({ db: { data: {} }, save: save || (() => {}), crypto, vak: () => vak });
  return { j, vak };
}
function vul(j, n) {
  const uit = [];
  for (let i = 0; i < n; i++) uit.push(j.noteer({ actor: 'lid-' + i, actie: 'stap ' + i, objectType: 'dossier', objectId: i, verzoek: 'v-' + i }));
  return uit;
}
/* Een regel opnieuw zegelen zoals een aanvaller met de broncode dat zou doen. */
const zegel = (r) => { const { zegel: _z, ...rest } = r; return crypto.createHash('sha256').update(JSON.stringify(rest)).digest('hex').slice(0, 32); };

test('1. elk veld onder de zegel: een wijziging wordt op precies die regel aangewezen', () => {
  for (const [veld, nieuw] of [['actor', 'iemand-anders'], ['actie', 'niets gebeurd'], ['reden', 'achteraf'],
    ['beleid', 'B-vervalst'], ['uitslag', 'geweigerd'], ['niveau', 'auto'], ['risico', 0], ['at', '2020-01-01T00:00:00.000Z'],
    ['objectId', '999'], ['verzoek', 'v-ander']]) {
    const { j, vak } = opzet();
    const regels = vul(j, 4);
    vak.commandJournaal[2][veld] = nieuw;
    assert.deepEqual(j.controleer(), { heel: false, bij: regels[2].id, waarom: 'de regel is gewijzigd na het noteren' },
      'een gewijzigd veld "' + veld + '" moet op regel 3 worden aangewezen');
  }
});

test('1b. de releasecommit staat onder de zegel: hem weghalen of wijzigen breekt de regel', () => {
  const { j, vak } = opzet();
  const [a] = vul(j, 2);
  assert.equal(a.release, 'abcdef1234567', 'de commit waarmee de regel geschreven is, staat erin');
  vak.commandJournaal[0].release = '0000000';
  assert.equal(j.controleer().bij, a.id, 'een andere release is een gewijzigde regel');
  vak.commandJournaal[0].release = 'abcdef1234567';
  assert.equal(j.controleer().heel, true);
  delete vak.commandJournaal[0].release;
  assert.equal(j.controleer().bij, a.id, 'de release weghalen ook');
});

test('1c. een voor/na-toestand achteraf aanpassen wordt gezien', () => {
  const { j, vak } = opzet();
  const r = j.noteer({ actor: 'a', voor: { saldo: 10 }, na: { saldo: 0 } });
  j.noteer({ actor: 'b' });
  vak.commandJournaal[0].na.saldo = '10';
  assert.equal(j.controleer().bij, r.id, 'het verschil voor/na is wat je achteraf openslaat; het mag niet stil veranderen');
});

test('2. een ingevoegde regel breekt de keten, en de ingevoegde regel wordt aangewezen', () => {
  const { j, vak } = opzet();
  vul(j, 3);
  /* Een vervalste regel met een geldige eigen zegel, maar een verwijzing naar een verzonnen vorige. */
  const vals = { id: 'vals', at: new Date().toISOString(), actor: 'aanvaller', actie: 'geef toegang', vorig: 'f'.repeat(32) };
  vals.zegel = zegel(vals);
  vak.commandJournaal.splice(1, 0, vals);
  assert.deepEqual(j.controleer(), { heel: false, bij: 'vals', waarom: 'de verwijzing naar de vorige regel klopt niet' });

  /* Slimmer: de ingevoegde regel verwijst WEL goed naar zijn voorganger. Dan
     breekt de regel erna, want die verwijst nog naar de oorspronkelijke. */
  const tweede = opzet(), regels = vul(tweede.j, 3);
  const slim = { id: 'slim', at: new Date().toISOString(), actor: 'aanvaller', actie: 'x', vorig: regels[0].zegel };
  slim.zegel = zegel(slim);
  tweede.vak.commandJournaal.splice(1, 0, slim);
  assert.deepEqual(tweede.j.controleer(), { heel: false, bij: regels[1].id, waarom: 'de verwijzing naar de vorige regel klopt niet' });
});

test('2b. een verwijderde regel middenin wordt aangewezen op de regel erna', () => {
  const { j, vak } = opzet();
  const regels = vul(j, 5);
  vak.commandJournaal.splice(2, 1);
  const uit = j.controleer();
  assert.equal(uit.heel, false);
  assert.equal(uit.bij, regels[3].id, 'de eerste regel na het gat, niet een latere');
  assert.equal(uit.waarom, 'de verwijzing naar de vorige regel klopt niet');
});

test('2c. verwisselde regels: de volgorde zit in de keten', () => {
  const { j, vak } = opzet();
  const regels = vul(j, 4);
  [vak.commandJournaal[1], vak.commandJournaal[2]] = [vak.commandJournaal[2], vak.commandJournaal[1]];
  assert.equal(j.controleer().bij, regels[2].id, 'de naar voren geschoven regel verwijst niet naar regel 1');
});

test('3. een herzegelde regel wordt op de VOLGENDE regel betrapt; een volledig herzegelde keten verraadt zich via de kop', () => {
  const { j, vak } = opzet();
  const regels = vul(j, 4);
  const kopExport = j.controleer().heel && vak.commandJournaal.at(-1).zegel;
  const r = vak.commandJournaal[1];
  r.actor = 'iemand-anders';
  r.zegel = zegel(r);
  assert.deepEqual(j.controleer(), { heel: false, bij: regels[2].id, waarom: 'de verwijzing naar de vorige regel klopt niet' });
  /* Wie de hele staart herzegelt, krijgt een keten die intern klopt -- precies
     wat de kop van het bestand zegt: dit bewijst onderlinge samenhang. Een
     eerder geexporteerde kop ernaast leggen laat het verschil wel zien. */
  for (let i = 2; i < vak.commandJournaal.length; i++) {
    vak.commandJournaal[i].vorig = vak.commandJournaal[i - 1].zegel;
    vak.commandJournaal[i].zegel = zegel(vak.commandJournaal[i]);
  }
  assert.equal(j.controleer().heel, true);
  assert.notEqual(vak.commandJournaal.at(-1).zegel, kopExport, 'de herschreven kop wijkt af van de geexporteerde');
});

test('3b. een zegel die niet meer bij zijn eigen regel past (bv. afgekapt) is een gewijzigde regel', () => {
  const { j, vak } = opzet();
  const [, b] = vul(j, 3);
  /* noteer() geeft de regel zelf terug, dus `b` IS de opgeslagen regel: het
     oude zegel eerst bewaren, en het laatste teken altijd echt laten wijzigen. */
  const oud = b.zegel;
  vak.commandJournaal[1].zegel = oud.slice(0, 31) + (oud.endsWith('0') ? '1' : '0');
  assert.notEqual(vak.commandJournaal[1].zegel, oud);
  assert.equal(j.controleer().bij, b.id);
  assert.equal(j.controleer().waarom, 'de regel is gewijzigd na het noteren');
});

test('4. een weggeknipte kop of staart: de keten klopt, maar aantal blijft het echte totaal', () => {
  const { j, vak } = opzet();
  vul(j, 5);
  vak.commandJournaal.shift();
  vak.commandJournaal.pop();
  assert.equal(j.controleer().heel, true, 'binnen het venster is er niets mis');
  assert.equal(j.venster(), 3);
  assert.equal(j.aantal(), 5, 'het totaal telt onafhankelijk, dus het gat van twee regels is zichtbaar');
  /* Een nieuwe regel hangt aan de huidige kop, niet aan de weggeknipte. */
  const n = j.noteer({ actor: 'na' });
  assert.equal(n.vorig, vak.commandJournaal.at(-2).zegel);
  assert.equal(j.aantal(), 6);
});

test('5. een falende save faalt luid: noteer gooit door', () => {
  let n = 0;
  const { j, vak } = opzet(() => { n++; if (n === 2) throw new Error('schijf vol'); });
  j.noteer({ actor: 'a' });
  assert.throws(() => j.noteer({ actor: 'b' }), /schijf vol/, 'de aanroeper hoort dat zijn spoor niet bewaard is');
  /* De regel staat in het geheugen; de volgende save neemt hem mee. De keten blijft heel. */
  assert.equal(vak.commandJournaal.length, 2);
  assert.equal(j.controleer().heel, true);
  j.noteer({ actor: 'c' });
  assert.equal(n, 3);
});

test('5b. een falende auditopslag faalt luid, en er wordt niets in een ander vak geschreven', () => {
  const vak = {};
  const opslag = {
    view: () => ({ commandJournaal: [] }),
    append() { throw new Error('SQLITE_BUSY'); },
    rewrite() { throw new Error('SQLITE_BUSY'); }
  };
  const j = maakJournaal({ db: {}, save: () => { throw new Error('mag niet'); }, crypto, vak: () => vak, auditOpslag: opslag });
  assert.throws(() => j.noteer({ actor: 'a' }), /SQLITE_BUSY/);
  assert.equal(vak.commandJournaal, undefined, 'geen stille terugval naar het gewone vak');
  assert.throws(() => j.wisActor('a'), /SQLITE_BUSY/);
});

test('5c. een append die de top meegeeft: de nieuwe regel verwijst naar die top, niet naar de lokale lijst', () => {
  const extern = { zegel: 'e'.repeat(32) };
  let gemaakt;
  const opslag = { view: () => ({ commandJournaal: [] }), append(maak) { gemaakt = maak(extern); return gemaakt; } };
  const j = maakJournaal({ db: {}, save: null, crypto, auditOpslag: opslag });
  const r = j.noteer({ actor: 'a', at: 'geen-tijd' });
  assert.equal(r.vorig, extern.zegel, 'de kop komt uit de opslag zelf (een ander proces kan hem verzet hebben)');
  assert.equal(r.zegel, zegel(r), 'en de zegel dekt die verwijzing');
  assert.notEqual(r.at, 'geen-tijd');
});

test('6. een wissing zet de oude kop in de keten; een eerder geexporteerde kop is terug te vinden', () => {
  const { j, vak } = opzet();
  vul(j, 3);
  j.noteer({ actor: 'lid-1', actie: 'nog een' });
  const kop = vak.commandJournaal.at(-1).zegel;
  const uit = j.wisActor('lid-1', 'AVG-verzoek');
  assert.deepEqual(uit, { geraakt: 2, kopVoor: kop });
  const laatste = vak.commandJournaal.at(-1);
  assert.equal(laatste.voor.kopVoorWissing, kop, 'de kop van voor de wissing staat onder de nieuwe zegel');
  assert.equal(laatste.actor, 'systeem');
  assert.ok(!JSON.stringify(vak.commandJournaal).includes('"lid-1"'), 'de actor is nergens meer te vinden');
  assert.equal(j.controleer().heel, true);
  /* En die vermelding achteraf wijzigen, om de wissing te verdoezelen, breekt de keten. */
  laatste.voor.kopVoorWissing = 'x';
  assert.equal(j.controleer().bij, laatste.id);
});

test('6b. een wissing in een venster dat al is afgekapt behoudt de verwijzing naar wat ervoor lag', () => {
  const { j, vak } = opzet();
  vul(j, 4);
  vak.commandJournaal.shift();             // het venster begint niet meer bij het begin
  const ankerVorig = vak.commandJournaal[0].vorig;
  j.wisActor('lid-2');
  assert.equal(vak.commandJournaal[0].vorig, ankerVorig, 'de eerste regel blijft naar zijn (verdwenen) voorganger wijzen');
  assert.equal(j.controleer().heel, true);
});

test('6c. een herschrijving die halverwege faalt laat het journaal ongemoeid', () => {
  const staat = { commandJournaal: [] };
  const opslag = {
    view: () => staat,
    append(maak) { const w = maak(staat.commandJournaal.at(-1) || null); staat.commandJournaal.push(w); return w; },
    /* Werk op een kopie, en pas vervangen als ALLES gelukt is -- zoals de echte opslag in een transactie. */
    rewrite(werk) {
      const kopie = JSON.parse(JSON.stringify(staat));
      const uit = werk(kopie);
      if (kopie.commandJournaal.length > 2) throw new Error('commit mislukt');
      staat.commandJournaal = kopie.commandJournaal; return uit;
    }
  };
  const j = maakJournaal({ db: {}, save: null, crypto, auditOpslag: opslag });
  j.noteer({ actor: 'weg' }); j.noteer({ actor: 'blijft' });
  assert.throws(() => j.wisActor('weg'), /commit mislukt/);
  assert.deepEqual(staat.commandJournaal.map(r => r.actor), ['weg', 'blijft'], 'geen half-gewist spoor');
  assert.equal(j.controleer().heel, true);
  /* Na de fout schrijft het journaal weer naar de opslag, niet naar een achtergebleven werkvak. */
  const n = j.noteer({ actor: 'daarna' });
  assert.equal(staat.commandJournaal.at(-1), n);
  assert.equal(n.vorig, staat.commandJournaal[1].zegel);
});

test('6d. een wissing via de auditopslag zonder treffer laat het spoor staan', () => {
  const staat = { commandJournaal: [] };
  let herschreven = 0;
  const opslag = {
    view: () => staat,
    append(maak) { const w = maak(staat.commandJournaal.at(-1) || null); staat.commandJournaal.push(w); return w; },
    rewrite(werk) { herschreven++; const kopie = JSON.parse(JSON.stringify(staat)); const uit = werk(kopie); staat.commandJournaal = kopie.commandJournaal; return uit; }
  };
  const j = maakJournaal({ db: {}, save: null, crypto, auditOpslag: opslag });
  const a = j.noteer({ actor: 'a' });
  assert.deepEqual(j.wisActor('niemand'), { geraakt: 0 });
  assert.deepEqual(j.wisActor(''), { geraakt: 0 });
  assert.equal(herschreven, 2);
  assert.deepEqual(staat.commandJournaal, [a], 'geen wissingsregel als er niets gewist is');
});

test('7. twee vakken, twee ketens: de ene zaak ziet en raakt de regels van de andere niet', () => {
  const vakA = {}, vakB = {};
  const a = maakJournaal({ db: {}, save: null, crypto, vak: () => vakA });
  const b = maakJournaal({ db: {}, save: null, crypto, vak: () => vakB });
  const ra = a.noteer({ actor: 'zaak-a' });
  const rb = b.noteer({ actor: 'zaak-b' });
  assert.equal(rb.vorig, null, 'de eerste regel van zaak B hangt niet aan zaak A');
  assert.equal(a.aantal(), 1); assert.equal(b.aantal(), 1);
  assert.deepEqual(b.recent().map(r => r.actor), ['zaak-b']);
  /* Een regel van A in B plakken is een invoeging en wordt aangewezen. */
  vakB.commandJournaal.push(ra);
  assert.equal(b.controleer().bij, ra.id);
});

test('8. de standaardwaarden laten zich niet misbruiken: een object als actor wordt tekst, geen object', () => {
  const { j, vak } = opzet();
  const r = j.noteer({ actor: { toString: () => 'lid-9' }, objectId: 0, risico: 'veel' });
  assert.equal(r.actor, 'lid-9');
  assert.equal(r.objectId, '0');
  assert.ok(Number.isNaN(r.risico), 'een onleesbaar risico wordt geen verzonnen getal');
  assert.equal(vak.commandJournaalTotaal, 1);
  assert.equal(j.controleer().heel, true);
});

test('9. de staart afkappen op MAX laat een keten achter die nog steeds klopt, en het totaal blijft eerlijk', () => {
  const vak = {};
  const j = maakJournaal({ db: {}, save: null, crypto, opslag: { vak: () => vak } });
  assert.deepEqual(j.controleer(), { heel: true, regels: 0 }, 'een leeg journaal is heel');
  assert.deepEqual(j.wisActor('niemand'), { geraakt: 0 }, 'een wissing in een leeg journaal raakt niets');
  const vandaag = new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z';
  let eerste;
  for (let i = 0; i <= j.MAX; i++) {
    const r = j.noteer({ actie: 'tik', at: vandaag, voor: 'tekst', na: { leeg: null, lijst: [], diep: { a: 1 } } });
    if (i === 0) eerste = r;
  }
  assert.equal(j.venster(), j.MAX, 'het venster is begrensd');
  assert.equal(j.aantal(), j.MAX + 1, 'het totaal niet');
  assert.notEqual(vak.commandJournaal[0].id, eerste.id, 'de oudste is uit het venster');
  assert.equal(vak.commandJournaal[0].vorig, eerste.zegel, 'en de nieuwe eerste wijst er nog naar');
  assert.equal(j.controleer().heel, true);
  const r = vak.commandJournaal.at(-1);
  assert.equal(r.actor, 'onbekend', 'zonder actor staat er "onbekend", nooit een lege of geraden naam');
  assert.equal(r.beleid, null);
  assert.deepEqual(r.na, { leeg: null, lijst: '0 stuk(s)', diep: '{…}' });
  if (new Date().toISOString().slice(0, 10) === vandaag.slice(0, 10)) assert.equal(r.at, vandaag);
  /* Een gewijzigde regel diep in het grote venster wordt nog steeds gevonden. */
  vak.commandJournaal[4321].actie = 'anders';
  assert.equal(j.controleer().bij, vak.commandJournaal[4321].id);
});

test('10. de lezing laat een vervalste regel niet verdwijnen: wat in het venster staat, komt in de tijdlijn', () => {
  const { j, vak } = opzet();
  j.noteer({ actor: 'a', actie: 'open', objectType: 'kluis', objectId: 7, niveau: 'auto' });
  j.noteer({ actor: 'b', actie: 'sluit', objectType: 'kluis', objectId: 7, uitslag: 'geweigerd' });
  vak.commandJournaal[0].actor = 'c';
  assert.equal(j.controleer().heel, false);
  const tijd = j.herbeleef(null, null, { objectType: 'kluis', objectId: 7 });
  assert.equal(tijd.stappen, 2);
  assert.deepEqual(tijd.actoren, ['c', 'b'], 'de lezing toont wat er staat; controleer() zegt of het te vertrouwen is');
  assert.equal(tijd.automatisch, 1);
  assert.equal(tijd.mislukt, 1);
  assert.equal(tijd.lijn[1].zegel, vak.commandJournaal[1].zegel, 'elke stap draagt zijn zegel, zodat hij naast een export te leggen is');
  assert.deepEqual(j.recent(5, { actor: 'b', actie: 'slu', niveau: 'hand' }).map(r => r.actie), ['sluit']);
  assert.equal(j.overObject('kluis', 7).length, 2);
});
