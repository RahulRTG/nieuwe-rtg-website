/* MEEDOEN IN EEN BUNDEL DIE ER AL IS -- en de grendel eromheen.

   Hier komen twee reparaties samen die uit één meting volgen
   (`npm run factuurproef`, zie GELDLAT.md par. "Scenario 3"):

   1. `lib/idem.js` opende ALTIJD zijn eigen bundel, ook als de aanroeper er al
      een had. Daardoor was een buitenste bundel onmogelijk: de binnenste
      committeerde eerst, en tussen die twee commits stond op schijf een halve
      toestand -- geld afgeschreven, factuur nog open.
   2. Meedoen mag alleen in een bundel die DEZELFDE belofte doet. Een
      niet-duurzame buitenbundel zou een geldcommit stil degraderen naar
      write-behind, en zo'n bundel bestaat echt (db/economische-boeking.js).

   De regel woont in `db/bijeen.js` en niet bij de aanroepers, en dat is zelf
   het besluit: duurzaam.js en fonds.js stelden de vraag al elk apart, en dat
   werkt precies zolang niemand hem vergeet -- idem.js vergat hem, en niets
   werd daarvan rood. Deze toetsen draaien daarom tegen de ECHTE bundel en
   tellen het enige getal dat ertoe doet: één commit is heel, twee commits is
   een venster. */
const test = require('node:test');
const assert = require('node:assert');
const maakIdem = require('../server/lib/idem.js');

/* Een bundel die zich gedraagt als die van db/bijeen.js: hij houdt bij hoe vaak
   er werkelijk is gecommit, en welke van die commits duurzaam waren. */
function maakBundel() {
  const uit = { commits: [], open: null };
  const bijeen = async (fn, opties) => {
    const duurzaam = !!(opties && opties.duurzaam);
    const vorige = uit.open;
    uit.open = { duurzaam };
    try { return await fn(); }
    finally { uit.open = vorige; uit.commits.push({ duurzaam }); }
  };
  const inBundel = (eis) => {
    if (!uit.open) return false;
    if (eis && eis.duurzaam) return !!uit.open.duurzaam;
    return true;
  };
  return { bijeen, inBundel, uit };
}

/* De ECHTE bundel, met een teller op elke commit -- en met een `save` die zich
   gedraagt als die van db/index.js: binnen een openstaande bundel zet hij
   alleen de vlag `nodig` en schrijft hij niet zelf. Zonder die nabootsing
   commit de bundel nooit (er is niets te schrijven) en zou elke toets hier
   groen staan op nul commits: de gevaarlijkste vorm van een lege proef. */
function echteBundel() {
  const commits = [];
  const mod = require('../server/db/bijeen.js')({
    save: () => commits.push({ duurzaam: false }),
    saveDuurzaam: () => { commits.push({ duurzaam: true }); return { duurzaam: true, bevestigbaar: true }; } });
  const save = () => {
    const doos = mod.bundelDoos();
    if (doos && doos.open) { doos.nodig = true; return; }
    commits.push({ duurzaam: false });
  };
  return { bijeen: mod.bijeen, inBundel: mod.inBundel, save, commits };
}

test('zonder openstaande bundel opent metIdem er zelf een duurzame', async () => {
  const b = echteBundel(); const data = {};
  const metIdem = maakIdem({ d: () => data, save: b.save, naam: 'proefIdem', bijeen: b.bijeen, duurzaam: true });
  await metIdem('k1', 'afdruk', async () => ({ ok: true }));
  assert.deepEqual(b.commits, [{ duurzaam: true }]);
});

/* DE KERN VAN DE REPARATIE. Binnen een duurzame buitenbundel hoort er EEN
   commit te zijn en niet twee -- het venster waarin de boeking vaststaat en de
   afwikkeling eromheen nog niet, bestaat dan niet. */
test('binnen een duurzame bundel commit metIdem NIET zelf', async () => {
  const b = echteBundel(); const data = {};
  const metIdem = maakIdem({ d: () => data, save: b.save, naam: 'proefIdem', bijeen: b.bijeen, duurzaam: true });
  await b.bijeen(async () => {
    await metIdem('k1', 'afdruk', async () => ({ ok: true }));
    assert.equal(b.commits.length, 0, 'de binnenste mag niet vooruit committeren');
  }, { duurzaam: true });
  assert.deepEqual(b.commits, [{ duurzaam: true }], 'precies EEN commit voor het hele geldpad');
});

/* DE GRENDEL. Een niet-duurzame buitenbundel telt niet mee voor een duurzame
   commit: dan opent bijeen alsnog een eigen duurzame doos. Zonder deze regel
   wordt een geldcommit stilletjes write-behind, en dat is precies de belofte
   die GELDLAT.md weerlegde. db/economische-boeking.js opent zo'n bundel, dus
   dit is geen theorie. */
test('een NIET-duurzame bundel degradeert de geldcommit niet', async () => {
  const b = echteBundel(); const data = {};
  const metIdem = maakIdem({ d: () => data, save: b.save, naam: 'proefIdem', bijeen: b.bijeen, duurzaam: true });
  await b.bijeen(async () => {
    await metIdem('k1', 'afdruk', async () => ({ ok: true }));
    /* METEEN, en dat is de assertie: de geldcommit heeft NIET gewacht op de
       niet-duurzame buitenbundel maar zijn eigen duurzame doos geopend. Zou
       hij meedoen, dan stond hier nul en kwam er daarna een commit met
       `duurzaam: false` -- write-behind, precies de degradatie. */
    assert.deepEqual(b.commits, [{ duurzaam: true }],
      'de geldcommit hoort meteen en duurzaam te zijn, niet mee te gaan in een gewone bundel');
  });
  assert.deepEqual(b.commits, [{ duurzaam: true }], 'en er komt geen tweede, zwakkere commit achteraan');
});

/* Een commit die zelf NIET duurzaam is, mag wel gewoon meedoen in een gewone
   bundel -- daar valt niets te degraderen. */
test('een gewone commit doet wel mee in een gewone bundel', async () => {
  const b = echteBundel(); const data = {};
  const metIdem = maakIdem({ d: () => data, save: b.save, naam: 'proefIdem', bijeen: b.bijeen });
  await b.bijeen(async () => {
    await metIdem('k1', 'afdruk', async () => ({ ok: true }));
    assert.equal(b.commits.length, 0);
  });
  assert.deepEqual(b.commits, [{ duurzaam: false }]);
});

/* EEN DUURZAME BUITENBUNDEL DRAAGT EEN GEWONE BINNENCOMMIT GEWOON MEE. Strenger
   dan gevraagd is geen degradatie, dus meedoen mag. */
test('een gewone commit doet mee in een duurzame bundel', async () => {
  const b = echteBundel(); const data = {};
  const metIdem = maakIdem({ d: () => data, save: b.save, naam: 'proefIdem', bijeen: b.bijeen });
  await b.bijeen(async () => {
    await metIdem('k1', 'afdruk', async () => ({ ok: true }));
  }, { duurzaam: true });
  assert.deepEqual(b.commits, [{ duurzaam: true }]);
});

/* En de vraag waar de grendel op rust, los getoetst: `inBundel({duurzaam})`
   onderscheidt de twee soorten. Beantwoordt hij altijd `true`, dan verdwijnt de
   grendel zonder dat er iets anders verandert. */
test('inBundel({duurzaam}) onderscheidt de twee soorten bundels', async () => {
  const b = echteBundel();
  assert.equal(b.inBundel(), false, 'buiten elke bundel');
  assert.equal(b.inBundel({ duurzaam: true }), false);
  await b.bijeen(async () => {
    assert.equal(b.inBundel(), true);
    assert.equal(b.inBundel({ duurzaam: true }), false, 'een gewone bundel is niet duurzaam');
  });
  await b.bijeen(async () => {
    assert.equal(b.inBundel({ duurzaam: true }), true);
  }, { duurzaam: true });
});

/* DE BUITENSTE BUNDEL NEEMT DE WORP MEE. Faalt het werk binnen een genestelde
   aanroep, dan hoort er NIETS te zijn gecommit -- dat is de helft van de
   belofte die de factuurproef meet: heel, of helemaal niet. */
test('een worp binnen een genestelde bundel laat niets achter', async () => {
  const b = echteBundel();
  await assert.rejects(() => b.bijeen(async () => {
    await b.bijeen(async () => { throw new Error('de afwikkeling mislukte'); }, { duurzaam: true });
  }, { duurzaam: true }));
  assert.equal(b.commits.length, 0, 'een mislukte bundel commit niets');
});

test('een onzekere opslagbevestiging belooft geen afwezige afschrijving', async () => {
  const data = { saldo: 1000, invoices: [{ id: 'f1', bijdrage: 5, status: 'open' }] };
  let opgeslagen;
  const bundel = require('../server/db/bijeen')({
    save: () => {},
    saveDuurzaam: () => {
      opgeslagen = JSON.parse(JSON.stringify(data));
      return { bevestigbaar: true, duurzaam: false, reden: 'bevestiging verloren' };
    }
  });
  const save = () => { bundel.bundelDoos().nodig = true; };
  const { factuurSaldo } = require('../server/kern/factuursaldo').maakFactuurSaldo({
    db: { data }, bijeen: bundel.bijeen,
    payVan: () => ({ huisIn: async () => {
      data.saldo -= 500; save(); return { boeking: 'b1', centen: 500 };
    } }),
    settleFactuur: async () => { data.invoices[0].status = 'paid'; save(); return { ok: true }; }
  });
  const uit = await factuurSaldo({ own: false, wie: 'lid1', invoiceId: 'f1' });
  assert.equal(opgeslagen.saldo, 500, 'een bevestigingsfout kan na de boeking optreden');
  assert.equal(opgeslagen.invoices[0].status, 'paid');
  assert.equal(uit.status, 503);
  assert.doesNotMatch(uit.error, /niets afgeschreven|niet afgeschreven/);
});
