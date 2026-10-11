'use strict';
/* VAKANTIETOETS.md -- het juridische toetsingsdossier van de rekenregel voor
   vakantierecht (besluit 4A van de eigenaar, 11 oktober 2026) -- mag niet STIL
   verouderen. Een jurist tekent voor wat er in het dossier staat; als de code
   intussen iets anders doet, tekent hij voor een regel die niet bestaat.

   Vier dingen worden tegen de bron gehouden, en elk zakt met de naam van wat er
   niet meer klopt:
     1. de REGELVERSIE in het dossier is die van de code (de poort bindt aan
        dezelfde waarde, kern/vrijheid/vakantiepoort.js);
     2. de bronhashes van vakantieregel.js, vakantiepoort.js en saldobron.js --
        want de REGELVERSIE dekt alleen de TABELLEN en niet de rekencode
        (VAKANTIETOETS.md par. 6.2);
     3. elke codeverwijzing `pad:regel#naam`: het bestand bestaat, de regel
        bestaat, en de naam staat op die regel;
     4. elke voorbeeldberekening: de echte functie geeft op de invoer uit het
        dossier exact de uitkomst uit het dossier.
   Plus een zelfijking: de verwijzingscontrole moet een kapotte verwijzing ook
   echt afkeuren -- een instrument dat niet kan uitslaan is geen instrument. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const R = require('../server/kern/vrijheid/vakantieregel');
const maakPoort = require('../server/kern/vrijheid/vakantiepoort');
const maakSaldobron = require('../server/kern/vrijheid/saldobron');
const { maakBeleid } = require('../server/kern/vrijheid/beleid');
const { maakContracten } = require('../server/kern/payroll/contracten');
const { maakVerzuim } = require('../server/kern/payroll/verzuim');

const WORTEL = path.join(__dirname, '..');
const DOSSIER = fs.readFileSync(path.join(WORTEL, 'VAKANTIETOETS.md'), 'utf8');
const BRONNEN = ['server/kern/vrijheid/vakantieregel.js', 'server/kern/vrijheid/vakantiepoort.js', 'server/kern/vrijheid/saldobron.js'];

test('de REGELVERSIE in het dossier is die van de code', () => {
  const treffers = [...DOSSIER.matchAll(/\*\*REGELVERSIE:\*\* `([^`]+)`/g)].map(m => m[1]);
  assert.equal(treffers.length, 1, 'het dossier noemt precies een REGELVERSIE');
  assert.equal(treffers[0], R.REGELVERSIE,
    'de rekenregel is veranderd (code: ' + R.REGELVERSIE + ', dossier: ' + treffers[0] + '). Een toets op de oude versie ' +
    'is geen toets op de nieuwe: werk VAKANTIETOETS.md bij en laat hem opnieuw toetsen.');
});

test('de bronhashes in het dossier zijn die van de bestanden', () => {
  const genoemd = Object.fromEntries([...DOSSIER.matchAll(/`([\w./-]+\.js)@sha256:([0-9a-f]{16})`/g)].map(m => [m[1], m[2]]));
  assert.deepEqual(Object.keys(genoemd).sort(), BRONNEN.slice().sort(), 'het dossier noemt de bronhash van precies deze drie bestanden');
  for (const f of BRONNEN) {
    const echt = crypto.createHash('sha256').update(fs.readFileSync(path.join(WORTEL, f))).digest('hex').slice(0, 16);
    assert.equal(genoemd[f], echt, f + ' is veranderd sinds het dossier is opgesteld (dossier ' + genoemd[f] + ', nu ' + echt +
      '). Lees de wijziging na, werk de verwijzingen en voorbeelden in VAKANTIETOETS.md bij, en zet de nieuwe hash erin.');
  }
});

/* De verwijzingscontrole, los zodat de zelfijking hem ook kan voeden. */
const VERWIJZING = /`([\w./-]+\.js):(\d+)#([\w.]+)`/g;
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function controleer(tekst) {
  const fouten = []; let aantal = 0;
  for (const [, pad, nr, naam] of tekst.matchAll(VERWIJZING)) {
    aantal++;
    const vol = path.join(WORTEL, pad);
    if (!fs.existsSync(vol)) { fouten.push(pad + ' bestaat niet'); continue; }
    const regels = fs.readFileSync(vol, 'utf8').split('\n');
    const regel = regels[Number(nr) - 1];
    if (regel === undefined) { fouten.push(pad + ':' + nr + ' -- het bestand heeft maar ' + regels.length + ' regels'); continue; }
    if (!new RegExp('(^|[^\\w])' + escape(naam) + '($|[^\\w])').test(regel))
      fouten.push(pad + ':' + nr + '#' + naam + ' -- die naam staat niet op die regel: ' + regel.trim().slice(0, 100));
  }
  return { aantal, fouten };
}

test('elke codeverwijzing in het dossier klopt met de bron', () => {
  const { aantal, fouten } = controleer(DOSSIER);
  assert.ok(aantal >= 50, 'het dossier draagt zijn verwijzingen (gevonden: ' + aantal + '); nul gevonden is een kapotte meter en geen groen');
  assert.deepEqual(fouten, [], 'werk VAKANTIETOETS.md bij: deze verwijzingen kloppen niet meer met de code');
});

test('zelfijking: de verwijzingscontrole keurt een kapotte verwijzing af', () => {
  /* Het regelnummer wordt hier GEZOCHT en niet overgetypt: de zelfijking moet
     de controle ijken, niet zelf een verwijzing worden die veroudert. */
  const f = 'server/kern/vrijheid/vakantieregel.js';
  const nr = fs.readFileSync(path.join(WORTEL, f), 'utf8').split('\n').findIndex(l => /^function reken\(/.test(l)) + 1;
  assert.ok(nr > 1, 'reken() is te vinden');
  const r = controleer('`' + f + ':' + nr + '#reken` `' + f + ':' + (nr - 1) + '#reken` ' +
    '`server/kern/vrijheid/bestaatniet.js:1#x` `' + f + ':99999#reken` `' + f + ':' + nr + '#reke`');
  assert.equal(r.aantal, 5);
  assert.equal(r.fouten.length, 4, 'verkeerde regel, ontbrekend bestand, regel voorbij het einde en een halve naam: ' + JSON.stringify(r.fouten));
});

test('elk artikel en elke verzuimsoort van de regel staat in het dossier', () => {
  for (const a of R.ARTIKELEN) assert.ok(new RegExp('^### .*' + escape(a.artikel), 'mi').test(DOSSIER), a.artikel + ' heeft geen paragraaf in par. 2');
  for (const s of Object.keys(R.OPBOUW)) assert.ok(DOSSIER.includes('`' + s + '`'), 'de verzuimsoort ' + s + ' staat niet in het dossier');
});

/* ---------------- de voorbeeldberekeningen ---------------- */
const PROEFTOETS = { door: 'Proefbeoordelaar (voorbeeld, geen echte toets)', datum: '2026-10-10', kenmerk: 'VOORBEELD-1' };
function verlofrechten(spec) {
  const bak = {};
  const opslag = { bak: (n) => bak[n] || (bak[n] = {}), kijk: (n) => bak[n] };
  const nu = () => '2026-10-11T08:00:00.000Z';
  const contracten = maakContracten({ opslag, save: () => {}, nu });
  const verzuim = maakVerzuim({ opslag, save: () => {}, nu });
  const poort = maakPoort({ eigen: opslag, save: () => {}, nu });
  if (spec.poort === 'open') assert.equal(poort.zet({ stand: 'open', door: 'Eigenaar', toets: PROEFTOETS }).open, true);
  const bron = maakSaldobron({ bronnen: () => ({ payrollOS: { contracten, verzuim },
    vestigingVanUnit: () => (spec.land ? { land: spec.land } : null) }), poort: () => poort.stand() });
  for (const c of spec.contracten || []) assert.ok(contracten.leg('ZAAK', spec.mens.id, c.versie, 'manager', c.nr).ok);
  for (const m of spec.verzuim || []) assert.ok(verzuim.meld('ZAAK', spec.mens.id, m, 'manager').ok);
  const r = bron.verlofrechten('ZAAK', spec.mens, spec.jaar, maakBeleid(spec.beleid === 'wet' ? R.WETTELIJKE_LAAG : {}));
  const b = r.bron.berekening;
  return { wettelijk: r.wettelijk, berekend: b ? b.uren : null, graad: b ? b.graad : null, waarom: r.waarom.wettelijk };
}

test('elke voorbeeldberekening in het dossier is wat de echte functie geeft', () => {
  const blokken = [...DOSSIER.matchAll(/```json vakantievoorbeeld\n([\s\S]*?)\n```/g)].map(m => JSON.parse(m[1]));
  assert.ok(blokken.length >= 35, 'het dossier draagt zijn voorbeelden (gevonden: ' + blokken.length + ')');
  const ids = blokken.map(b => b.id);
  assert.equal(new Set(ids).size, ids.length, 'elk voorbeeld heeft een eigen nummer');
  for (const id of ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9']) assert.ok(ids.includes(id), id + ' (uit de bestaande toetsen) ontbreekt');
  for (const b of blokken) {
    const echt = b.functie === 'reken' ? R.reken(b.invoer)
      : b.functie === 'verlofrechten' ? verlofrechten(b.invoer)
      : assert.fail(b.id + ': onbekende functie ' + b.functie);
    assert.deepEqual(echt, b.uitkomst, b.id + ': de code geeft nu iets anders dan het dossier. Draai het voorbeeld opnieuw en ' +
      'zet de echte uitkomst erin -- nooit een met de hand uitgerekend getal.');
  }
});
