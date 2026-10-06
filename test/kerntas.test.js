/* DE KERN-TAS VAN DE MACHINEDEKKING (scripts/lib/kerntas.js).

   De derde meetweg is er gekomen omdat de meter LibraryOS en de Loop Fabric niet
   zag (besluit van de eigenaar, 6 oktober 2026). Hij is twee keer te ruim
   geweest voordat hij goed was: als tekst gelezen zakte de teller van 2793 naar
   1655, en met de deelmodules erbij heette elke mobiliteitsroute atomair. Deze
   toets houdt de grenzen vast op een kleine, met de hand gebouwde graaf, zodat
   elke grens apart kan zakken. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakKerntas } = require('../scripts/lib/kerntas');

const ASSEN = {
  bewijsketen: { bron: 'server/lib/keten.js', tokens: ['lib/keten'] },
  atomair: { bron: 'server/pg/verzoektransactie.js', tokens: ['verzoektransactie'] },
  envelop: { bron: 'server/kern/envelop.js', tokens: ['kern/envelop'] },
  mensAanDeDeur: { bron: 'server/kern/kantoor/kluispoort.js', uitRouter: true },
};

function graaf(bestanden, { hub = [], reg = [] } = {}) {
  const tekst = new Map(Object.entries(bestanden));
  const alle = [...tekst.keys()];
  const buren = new Map(), vraagt = new Map();
  for (const [f, t] of tekst) {
    const set = new Set([f]);
    for (const m of t.matchAll(/require\(\s*'([^']+)'\s*\)/g)) {
      const doel = m[1];
      if (!tekst.has(doel)) continue;
      set.add(doel);
      if (!vraagt.has(doel)) vraagt.set(doel, new Set());
      vraagt.get(doel).add(f);
    }
    buren.set(f, set);
  }
  return {
    g: { alle, tekst, buren, vraagt, hub: new Set(hub) },
    reg: { perNaam: reg.map(([naam, bestand, hoe]) => ({ naam, herkomsten: [{ bestand, hoe: hoe || 'fabriek' }] })) },
  };
}

/* De vereenvoudiging van de toets: require-paden zijn hier al opgeloste
   bestandsnamen. De echte graaf lost ze op met de padregels van node. */
/* Een require in een nepbestand wordt hier OPGEBOUWD en niet letterlijk
   geschreven: keuringsregel 14 leest elke letterlijke require in een toets als
   afhankelijkheid, ook als hij in een string staat. */
const req = (pad) => 're' + 'quire(\'' + pad + '\')';
const BRONNEN = {
  'server/lib/keten.js': '', 'server/pg/verzoektransactie.js': '', 'server/kern/envelop.js': '',
  'server/kern/kantoor/kluispoort.js': '',
};

test('een route erft de motor van de module die zijn naam levert', () => {
  const { g, reg } = graaf({ ...BRONNEN,
    'server/routes/r.js': "module.exports = ({ app, auth, boek }) => { app.post('/x', auth, boek.doe); };",
    'server/kern/boek.js': "const k = " + req('server/lib/keten.js') + "; module.exports = () => ({ boek: {} });",
  }, { reg: [['boek', 'server/kern/boek.js']] });
  const t = maakKerntas(g, reg);
  assert.deepEqual(t.assenVia('server/routes/r.js', ASSEN).assen, ['bewijsketen']);
  assert.deepEqual(t.assenVia('server/routes/r.js', ASSEN).modules, ['server/kern/boek.js']);
});

test('een woord in commentaar is geen motor', () => {
  const { g, reg } = graaf({ ...BRONNEN,
    'server/routes/r.js': 'module.exports = ({ app, boek }) => {};',
    'server/kern/boek.js': "/* we zouden lib/keten kunnen gebruiken, of bewerkCollectie( */ module.exports = 1;",
  }, { reg: [['boek', 'server/kern/boek.js']] });
  assert.deepEqual(maakKerntas(g, reg).assenVia('server/routes/r.js', ASSEN).assen, []);
});

test('een ingespoten collectietransactie telt als aanroep in code', () => {
  const { g, reg } = graaf({ ...BRONNEN,
    'server/routes/r.js': 'module.exports = ({ app, boek }) => {};',
    'server/kern/boek.js': "module.exports = ({ bewerkCollectie }) => ({ boek: { doe: () => bewerkCollectie('boek', s => s) } });",
  }, { reg: [['boek', 'server/kern/boek.js']] });
  assert.deepEqual(maakKerntas(g, reg).assenVia('server/routes/r.js', ASSEN).assen, ['atomair']);
});

test('een facade erft de motor van haar deelmodules niet', () => {
  const { g, reg } = graaf({ ...BRONNEN,
    'server/routes/r.js': 'module.exports = ({ app, mobiel }) => {};',
    'server/kern/mobiel/index.js': "const a = " + req('server/kern/mobiel/kaart.js') + "; module.exports = () => ({ mobiel: a });",
    'server/kern/mobiel/kaart.js': "const k = " + req('server/lib/keten.js') + "; module.exports = 1;",
  }, { reg: [['mobiel', 'server/kern/mobiel/index.js']] });
  assert.deepEqual(maakKerntas(g, reg).assenVia('server/routes/r.js', ASSEN).assen, []);
});

test('basisobjecten, dubbele herkomst en hubs worden niet gevolgd', () => {
  const { g, reg } = graaf({ ...BRONNEN,
    'server/routes/r.js': 'module.exports = ({ app, save, hub }) => {};',
    'server/db/index.js': "const t = " + req('server/pg/verzoektransactie.js') + "; module.exports = { save() {} };",
    'server/kern/hub.js': "const k = " + req('server/lib/keten.js') + ";",
  }, { hub: ['server/kern/hub.js'], reg: [['save', 'server/db/index.js', 'basisobject'], ['hub', 'server/kern/hub.js']] });
  assert.deepEqual(maakKerntas(g, reg).assenVia('server/routes/r.js', ASSEN).assen, []);

  const dubbel = graaf({ ...BRONNEN,
    'server/routes/r.js': 'module.exports = ({ app, boek }) => {};',
    'server/kern/boek.js': "const k = " + req('server/lib/keten.js') + ";",
  }).g;
  const twee = { perNaam: [{ naam: 'boek', herkomsten: [{ bestand: 'server/kern/boek.js', hoe: 'fabriek' }, { bestand: 'server/kern/ander.js', hoe: 'fabriek' }] }] };
  assert.deepEqual(maakKerntas(dubbel, twee).assenVia('server/routes/r.js', ASSEN).assen, []);
});

test('een toewijzing in server/opzet volgt de require van precies die naam', () => {
  const { g, reg } = graaf({ ...BRONNEN,
    'server/routes/r.js': 'module.exports = ({ app, boek }) => {};',
    'server/opzet/boek.js': "module.exports = (kern) => { kern.boek = " + req('../kern/boek') + "({}); kern.ander = " + req('../kern/ander') + "({}); };",
    'server/kern/boek.js': "const e = " + req('server/kern/envelop.js') + ";",
    'server/kern/ander.js': "const k = " + req('server/lib/keten.js') + ";",
  }, { reg: [['boek', 'server/opzet/boek.js', 'toewijzing']] });
  const t = maakKerntas(g, reg);
  assert.deepEqual(t.assenVia('server/routes/r.js', ASSEN).assen, ['envelop'],
    'de opzet laadt twee modules; alleen die van de naam telt');
});

test('de echte meter telt de tas apart en ziet LibraryOS', () => {
  const { meet } = require('../scripts/machinedekking');
  const u = meet();
  for (const v of Object.values(u.gemeten.perAs)) if (!v.uitKaart) assert.equal(typeof v.tas, 'number');
  const lib = u.perRoute.filter(r => r.pad === '/api/library/work/create');
  assert.equal(lib.length, 1);
  assert.deepEqual(lib[0].boven, [], 'de bestandsas zag LibraryOS al niet; dat is wat de tas oplost');
  assert.ok(lib[0].tas.includes('atomair'), 'kern/library roept zelf de collectietransactie aan');
  const viaTas = u.perRoute.filter(r => !r.boven.length && r.tas.length).length;
  assert.equal(u.gemeten.mutatiesAlleenViaTas, viaTas);
});
