/* DE ENVELOP (scripts/envelop.js + ENVELOP.json).

   WAT HIER OP HET SPEL STAAT. Deze meter zegt hoe ver RTG af staat van een
   controlelaag waar elke gevoelige handeling doorheen kan: welke feiten liggen
   er op tafel op het moment dat een poortwachter JA zegt. Zeven van de elf
   velden hebben vandaag geen enkele plek, en de actor draagt zeven verschillende
   namen. Die twee getallen mogen alleen omlaag.

   EN OMDAT HET GETALLEN ZIJN DIE UIT TEKSTPATRONEN KOMEN, moet deze meter je een
   keer hebben laten zien dat hij kan uitslaan (LAT.md regel 10). Vijf mutaties:

     1 een poortwachter die een achtste actorvorm neerzet -> de ratel zakt;
     2 een poortwachter die zijn eigenschap niet meer zet -> de meter verklaart
       zichzelf STUK (exit 2) in plaats van een lager, mooier getal te melden;
     3 een poortwachter die helemaal verdwijnt -> ook stuk;
     4 een kant van de bevinding weg -> hij meldt 'veranderd' en blijft hem niet
       opdreunen;
     5 EN DE NEGATIEVE CONTROLE: een module die de woorden wel bevat maar geen
       poortwachter is, mag niets doen.

   Het register wordt bij elke schrijvende proef opzij gezet en in een finally
   teruggezet. Dat is geen netheid maar een reparatie: bij scripts/gezag.js
   schreef de --vastleggen-toets in het echte register, en onder de mutatiemotor
   sloeg de ratel om en zette er een verzonnen stand in.

   Draai los: node --test test/envelop.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const envelop = require('../scripts/envelop');

const WORTEL = path.join(__dirname, '..');
const SCRIPT = path.join(WORTEL, 'scripts', 'envelop.js');
const REGISTER = path.join(WORTEL, 'ENVELOP.json');

function draai(args) {
  try {
    return { code: 0, uit: execFileSync(process.execPath, [SCRIPT, ...(args || [])], { encoding: 'utf8', cwd: WORTEL }) };
  } catch (e) {
    return { code: e.status == null ? 2 : e.status, uit: String(e.stdout || '') + String(e.stderr || '') };
  }
}

const getal = (uit, label) => {
  const m = new RegExp(label + '[^:]*:\\s*(\\d+)').exec(uit);
  assert.ok(m, 'de uitvoer noemt "' + label + '" niet:\n' + uit);
  return Number(m[1]);
};

function metNieuwBestand(relPad, inhoud, doe) {
  const vol = path.join(WORTEL, relPad);
  assert.equal(fs.existsSync(vol), false, 'de mutatie overschrijft nooit een bestaand bestand: ' + relPad);
  fs.writeFileSync(vol, inhoud);
  try { return doe(); } finally { try { fs.unlinkSync(vol); } catch (e) {} }
}

function metVervangen(relPad, van, naar, doe) {
  const vol = path.join(WORTEL, relPad);
  const oud = fs.readFileSync(vol, 'utf8');
  assert.ok(oud.includes(van), 'de mutatie vindt zijn aangrijpingspunt niet in ' + relPad + ': ' + van);
  try { fs.writeFileSync(vol, oud.split(van).join(naar)); return doe(); }
  finally { fs.writeFileSync(vol, oud); }
}

function metBewaardRegister(doe) {
  const voor = fs.readFileSync(REGISTER, 'utf8');
  try { return doe(voor); } finally { fs.writeFileSync(REGISTER, voor); }
}

/* ---------- de grondstand ---------- */

test('de meter staat gelijk aan ENVELOP.json en is heel', () => {
  const r = draai();
  assert.equal(r.code, 0, 'de grondstand hoort groen te zijn:\n' + r.uit);
  const vast = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
  const nu = envelop.meet();
  assert.equal(nu.stuk.length, 0, 'de meter hoort heel te zijn: ' + nu.stuk.join('; '));
  assert.equal(nu.veldenZonderHuis, vast.gemeten.veldenZonderHuis);
  assert.equal(nu.aantalActorVormen, vast.gemeten.actorVormen);
});

test('elke geregistreerde poortwachter bestaat en zet echt wat het register zegt', () => {
  /* Zonder deze bewering is het register een belofte in tekst zonder belofte in
     code (LAT.md regel 6), en dan meet alles erna niets meer. */
  for (const p of envelop.POORTWACHTERS) {
    const bron = fs.readFileSync(path.join(WORTEL, p.bestand), 'utf8');
    assert.match(bron, new RegExp('function\\s+' + p.naam + '\\s*\\('),
      p.naam + ' staat niet meer in ' + p.bestand);
    for (const z of p.zet) {
      if (!z.via.startsWith('req.')) continue;
      assert.match(bron, new RegExp(z.via.replace('.', '\\.') + '\\s*='),
        p.naam + ' zet ' + z.via + ' niet in ' + p.bestand);
    }
  }
});

test('de zeven velden zonder huis zijn precies de velden die niemand vaststelt', () => {
  const nu = envelop.meet();
  const zonder = new Set(nu.zonderHuis.map(v => v.id));
  for (const v of envelop.VELDEN) {
    const dragers = envelop.POORTWACHTERS.filter(p => p.zet.some(z => z.veld === v.id));
    assert.equal(zonder.has(v.id), dragers.length === 0,
      'veld ' + v.id + ': de lijst "zonder huis" klopt niet met het register');
  }
  /* De vier die WEL een huis hebben, met naam -- zodat een stille verschuiving
     naar boven (een veld raakt zijn drager kwijt) hier zakt en niet alleen in
     het totaal verdwijnt. */
  for (const veld of ['actor', 'tenant', 'capability', 'gezag']) {
    assert.equal(zonder.has(veld), false, veld + ' hoort een drager te hebben');
  }
});

/* ---------- mutatie 1: een achtste actorvorm ---------- */

test('MUTATIE: een poortwachter die een nieuwe actorvorm neerzet laat de ratel zakken', () => {
  const voor = envelop.meet().aantalActorVormen;
  metVervangen('scripts/envelop.js',
    "{ naam: 'baasAuth', bestand: 'server/routes/werkplek.js',\n    zet: [],",
    "{ naam: 'baasAuth', bestand: 'server/routes/werkplek.js',\n    zet: [{ veld: 'actor', via: 'req.werkplekBaas' }],", () => {
      const r = draai();
      assert.equal(getal(r.uit, 'vormen waarin de actor wordt neergezet'), voor + 1,
        'de meter ziet de nieuwe actorvorm niet -- dan meet hij niets');
      assert.equal(r.code, 1, 'de ratel hoort te zakken:\n' + r.uit);
      assert.match(r.uit, /ZAKT/);
      assert.match(r.uit, /negende naam|BESTAANDE vorm/);
    });
  assert.equal(envelop.meet().aantalActorVormen, voor, 'na opruimen staat de stand terug');
});

test('MUTATIE: --vastleggen weigert een verslechtering, en raakt het register niet aan', () => {
  metBewaardRegister((voor) => {
    metVervangen('scripts/envelop.js',
      "{ naam: 'baasAuth', bestand: 'server/routes/werkplek.js',\n    zet: [],",
      "{ naam: 'baasAuth', bestand: 'server/routes/werkplek.js',\n    zet: [{ veld: 'actor', via: 'req.werkplekBaas' }],", () => {
        const r = draai(['--vastleggen']);
        assert.equal(r.code, 1, 'de ratel legt geen verslechtering vast:\n' + r.uit);
        assert.match(r.uit, /GEWEIGERD/);
      });
    assert.equal(fs.readFileSync(REGISTER, 'utf8'), voor, 'ENVELOP.json is niet aangeraakt');
  });
});

/* ---------- mutatie 2 en 3: de meter stukmaken ---------- */

test('MUTATIE: een poortwachter die zijn eigenschap niet meer zet maakt de meter STUK', () => {
  /* LAT.md regel 3: stilvallen is geen uitkomst. Zonder deze zelfijking zou een
     hernoemde eigenschap het aantal actorvormen laten DALEN -- de meter zou
     groener worden naarmate hij minder ziet. */
  metVervangen('server/routes/techniek.js', 'req.techUser = user;', 'req.zzWeg = user;', () => {
    const r = draai();
    assert.equal(r.code, 2, 'een niet-gezette eigenschap hoort de meter stuk te verklaren:\n' + r.uit);
    assert.match(r.uit, /DE METER IS STUK/);
    assert.match(r.uit, /techAuth.*req\.techUser/);
  });
  assert.equal(draai().code, 0, 'na herstel meet hij weer gewoon');
});

test('MUTATIE: een verdwenen poortwachter maakt de meter ook stuk', () => {
  metVervangen('server/routes/gast.js', 'function gastAuth(', 'function zzWegAuth(', () => {
    const r = draai();
    assert.equal(r.code, 2);
    assert.match(r.uit, /gastAuth: niet meer gedeclareerd/);
  });
});

/* ---------- mutatie 4: de bevinding ---------- */

test('de vastgelegde bevinding wordt bij elke ronde opnieuw nagetrokken', () => {
  const r = draai();
  assert.match(r.uit, /bevindingen\s*:\s*1/);
  assert.match(r.uit, /\[staat nog\] kantoortoken-kent-geen-personen/,
    'de bevinding hoort nog te staan; is hij opgelost, werk dan ENVELOP.json bij');
});

test('MUTATIE: verdwijnt een kant van de bevinding, dan meldt hij "veranderd"', () => {
  metVervangen('server/routes/uitgifte.js',
    "const wieOffice = req => String((req.body || {}).wie || '')",
    "const wieOffice = req => String((req.actor || {}).name || '')", () => {
      const r = draai();
      assert.match(r.uit, /\[veranderd\] kantoortoken-kent-geen-personen/);
      assert.match(r.uit, /werk ENVELOP\.json bij/);
    });
});

test('een bewijszin uit COMMENTAAR telt mee, want een belofte in tekst is een belofte in code', () => {
  /* Dit ging bij het bouwen echt mis: de bevinding werd tegen de bron ZONDER
     commentaar gehouden, en de zin "het kantoor-token kent geen personen" staat
     juist in de kop van routes/uitgifte.js -- daar is hij de verklaring van het
     gat en dus bewijs, geen ruis. De meter meldde de bevinding daardoor ten
     onrechte als 'veranderd'. */
  const bron = fs.readFileSync(path.join(WORTEL, 'server/routes/uitgifte.js'), 'utf8');
  const { zonderCommentaar } = require('../scripts/lib/bron');
  const zin = 'het kantoor-token kent geen';
  assert.ok(bron.includes(zin), 'de aanname onder deze toets: de zin staat in de bron');
  assert.equal(zonderCommentaar(bron).includes(zin), false,
    'en hij staat in COMMENTAAR -- anders bewijst deze toets niets');
  assert.match(draai().uit, /\[staat nog\] kantoortoken-kent-geen-personen/,
    'de meter hoort hem toch te vinden, dus hij leest hier de ruwe bron');
});

/* ---------- de negatieve controle ---------- */

test('een module die de woorden bevat maar geen poortwachter is, verandert niets', () => {
  const voor = envelop.meet();
  const bron = "'use strict';\n" +
    '// bevat de woorden, maar registreert geen route en is geen poortwachter\n' +
    'module.exports = function zzIjk(req) {\n' +
    '  return { session: req.session, actor: req.actor, techUser: req.techUser };\n' +
    '};\n';
  metNieuwBestand('server/kern/zz-envelop-ijk.js', bron, () => {
    const na = envelop.meet();
    assert.equal(na.aantalActorVormen, voor.aantalActorVormen, 'lezen is geen vaststellen');
    assert.equal(na.veldenZonderHuis, voor.veldenZonderHuis);
  });
});

test('de routetelling telt geen routes uit commentaar', () => {
  /* Derde keer in dit huis dat een meter tekst voor code aanzag; hier met een
     toets erop in plaats van een opmerking erover. */
  const voor = envelop.meet().routes;
  const bron = "'use strict';\n" +
    '/* app.post(\'/api/zz/verzonnen\', auth, (req, res) => res.json({}));\n' +
    "   app.get('/api/zz/ook-verzonnen', supplierAuth, (req, res) => res.json({})); */\n" +
    'module.exports = () => {};\n';
  metNieuwBestand('server/kern/zz-envelop-ijk2.js', bron, () => {
    assert.equal(envelop.meet().routes, voor, 'twee routes in commentaar zijn geen twee routes');
  });
});
