/* DE GEBEURTENISSENSTROOM -- wordt de envelop werkelijk gevuld en verstuurd?

   kern/envelop.js legde de vorm vast en stond daarna nergens aangeroepen. Een
   vorm die niemand vult is een voornemen, geen afspraak. kern/gebeurtenis.js
   vult hem; de App Store is de eerste producent.

   Deze toets houdt vier dingen vast die deze laag anders stilletjes waardeloos
   maken:

     1. een gebeurtenis breekt NOOIT de handeling eronder -- maar verdwijnt ook
        niet stil: een geweigerde envelop wordt geteld en gemeld;
     2. wat binnenkomt wordt opnieuw GELEZEN en niet vertrouwd, want het komt van
        een ander proces;
     3. de uitzender hoort zijn eigen gebeurtenissen niet nog een keer;
     4. het journaal van de App Store blijft de waarheid -- de uitzending is
        vluchtig en mag hem niet vervangen.

   En de belangrijkste: dat `boek()` in de App Store ECHT uitzendt. Zonder die
   toets is deze hele laag opnieuw een module die niemand aanroept.

   Draai los: node --test test/gebeurtenis.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../server/kern/gebeurtenis');

/* Een bus die onthoudt wat erop gaat, en waarvan je de luisteraar zelf kunt
   aanroepen -- zo is de ontvangkant te toetsen zonder Redis. */
function proefBus() {
  const heen = [];
  const luisteraars = [];
  return {
    heen, luisteraars,
    publish: (kanaal, bericht) => heen.push({ kanaal, bericht }),
    subscribe: (kanaal, fn) => luisteraars.push({ kanaal, fn }),
    lever: (bericht) => luisteraars.forEach(l => l.fn(bericht))
  };
}
const stil = () => { const t = []; const fn = (s) => t.push(s); fn.regels = t; return fn; };

const GOED = { bron: 'kern/proef', klasse: 'intern', onderwerp: 'iets', actor: 'O-RTG' };

test('1 - een gebeurtenis gaat als envelop het eigen kanaal op', () => {
  const bus = proefBus();
  const g = G.maakGebeurtenis({ bus });
  const r = g.meld('proef.gebeurd', GOED);
  assert.equal(r.ok, true);
  assert.equal(bus.heen.length, 1);
  assert.equal(bus.heen[0].kanaal, 'rtg:gebeurtenis:v1');
  const e = bus.heen[0].bericht.envelop;
  assert.equal(e.soort, 'proef.gebeurd');
  assert.equal(e.klasse, 'intern');
  assert.ok(e.id && e.op && e.keten, 'een verse envelop krijgt id, tijdstip en keten');
  assert.equal(g.stand().verstuurd, 1);
});

test('2 - een kapotte envelop breekt de handeling niet, maar verdwijnt ook niet stil', () => {
  const log = stil();
  const bus = proefBus();
  const g = G.maakGebeurtenis({ bus, log });
  const r = g.meld('geen-geldige-soort', GOED);   // streepje mag niet in een soort
  assert.equal(r.ok, false, 'de envelop hoort geweigerd te worden');
  assert.equal(bus.heen.length, 0, 'en er gaat niets de bus op');
  assert.equal(g.stand().geweigerd, 1, 'maar hij wordt wel geteld');
  assert.equal(log.regels.length, 1, 'en gemeld');
  assert.match(log.regels[0], /geweigerd/);
  assert.match(log.regels[0], /soort/, 'met het veld erbij dat niet klopte');
  assert.ok(g.stand().laatsteFout, 'en de laatste fout is op te vragen');
});

test('3 - een bus die stukgaat laat de aanroeper heel', () => {
  const log = stil();
  const bus = { publish: () => { throw new Error('redis weg'); }, subscribe: () => {} };
  const g = G.maakGebeurtenis({ bus, log });
  let r;
  assert.doesNotThrow(() => { r = g.meld('proef.gebeurd', GOED); });
  assert.equal(r.ok, true, 'de envelop zelf klopte');
  assert.match(log.regels[0], /bus weigerde/);
  assert.equal(g.stand().geweigerd, 1);
});

test('4 - zonder bus gebeurt er niets, en dat is geen fout', () => {
  const g = G.maakGebeurtenis({});
  const r = g.meld('proef.gebeurd', GOED);
  assert.equal(r.ok, true);
  assert.equal(g.stand().zonderBus, 1);
  assert.equal(g.stand().geweigerd, 0, 'geen bus is geen kapotte envelop');
  assert.equal(g.luister(() => {}), false, 'en luisteren kan dan ook niet');
});

test('5 - wat binnenkomt wordt gelezen, niet vertrouwd', () => {
  const log = stil();
  const bus = proefBus();
  const g = G.maakGebeurtenis({ bus, log });
  const gezien = [];
  assert.equal(g.luister(e => gezien.push(e)), true);

  // een geldige envelop van een ander proces komt door
  const ander = G.maakGebeurtenis({ bus: proefBus() });
  const goed = ander.meld('proef.gebeurd', GOED).envelop;
  bus.lever({ afzender: 'een-ander', envelop: goed });
  assert.equal(gezien.length, 1);
  assert.equal(gezien[0].soort, 'proef.gebeurd');

  // een envelop zonder id wordt NIET aangevuld maar geweigerd
  bus.lever({ afzender: 'een-ander', envelop: Object.assign({}, GOED, { soort: 'proef.gebeurd' }) });
  assert.equal(gezien.length, 1, 'een binnenkomende envelop zonder id hoort af te vallen');
  assert.match(log.regels.join(' '), /binnengekomen envelop klopt niet/);

  // en rommel ook
  bus.lever({ afzender: 'een-ander', envelop: { soort: 'kapot' } });
  assert.equal(gezien.length, 1);
});

test('6 - de uitzender hoort zijn eigen gebeurtenissen niet', () => {
  /* Bij Redis krijgt het publicerende proces zijn eigen bericht terug (zie de
     kop van server/bus.js). Zonder deze filter verwerkt elk proces zijn eigen
     werk een tweede keer. */
  const bus = proefBus();
  const g = G.maakGebeurtenis({ bus });
  const gezien = [];
  g.luister(e => gezien.push(e));
  g.meld('proef.gebeurd', GOED);
  bus.lever(bus.heen[0].bericht);        // precies terug zoals Redis dat doet
  assert.equal(gezien.length, 0, 'de eigen gebeurtenis hoort te worden overgeslagen');
});

test('7 - een luisteraar die omvalt, sleept de stroom niet mee', () => {
  const log = stil();
  const bus = proefBus();
  const g = G.maakGebeurtenis({ bus, log });
  g.luister(() => { throw new Error('ik val om'); });
  const goed = G.maakGebeurtenis({ bus: proefBus() }).meld('proef.gebeurd', GOED).envelop;
  assert.doesNotThrow(() => bus.lever({ afzender: 'een-ander', envelop: goed }));
  assert.match(log.regels.join(' '), /luisteraar viel om/);
});

test('8 - journaalnamen worden op EEN plek naar een soort vertaald', () => {
  assert.equal(G.soortVan('appstore', 'inzending-door-naar-mens'), 'appstore.inzendingDoorNaarMens');
  assert.equal(G.soortVan('appstore', 'besluit'), 'appstore.besluit');
  // en het resultaat past door de vorm die de envelop eist
  const bus = proefBus();
  const g = G.maakGebeurtenis({ bus });
  for (const wat of ['inzending-door-naar-mens', 'inzending-afgekeurd-machine', 'app-ingetrokken', 'uitgever-toegelaten']) {
    const r = g.meld(G.soortVan('appstore', wat), GOED);
    assert.equal(r.ok, true, wat + ' hoort een geldige soort op te leveren');
  }
});

test('9 - de App Store zendt ECHT uit, en het journaal blijft de waarheid', async () => {
  /* Zonder deze toets is deze hele laag opnieuw een module die niemand
     aanroept. Hier wordt de echte motor gebouwd, met een echte bus eronder. */
  const fs = require('fs'); const os = require('os'); const path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-geb-'));
  const bus = proefBus();
  const db = { data: {} };
  const { maakAppstore } = require('../server/kern/appstore');
  /* maakAppstore geeft drie lagen terug; `boek` hoort bij de MOTOR. */
  const { appstore: motor } = maakAppstore({ db, save() {}, dir, antivirus: null, log() {}, bus });

  const voor = bus.heen.length;
  motor.boek('uitgever-aangevraagd', 'mijn-app', 'O-PROEF', { extra: 1 });

  assert.equal(bus.heen.length, voor + 1, 'elke journaalregel hoort ook uitgezonden te worden');
  const e = bus.heen[voor].bericht.envelop;
  assert.equal(e.soort, 'appstore.uitgeverAangevraagd');
  assert.equal(e.bron, 'kern/appstore');
  assert.equal(e.onderwerp, 'mijn-app');
  assert.equal(e.actor, 'O-PROEF');
  assert.deepEqual(e.lading, { extra: 1 });

  /* En het journaal is er nog steeds, want dat is wat aangroeit en nooit wordt
     herschreven. De uitzending belooft niets (envelop.NIET_GEBOUWD) en mag hem
     dus niet vervangen. */
  const j = db.data.appstore.journaal;
  assert.equal(j[0].wat, 'uitgever-aangevraagd');
  assert.equal(j[0].over, 'mijn-app');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('10 - de App Store noemt organisaties, geen mensen', () => {
  /* De klasse staat op `intern` omdat dit journaal appsleutels en
     organisatiecodes noemt. Zou er ooit een codenaam in belanden, dan hoort de
     klasse mee te veranderen -- anders reist een aanwijzing naar een mens onder
     een etiket dat zegt dat er geen mens in zit. */
  const fs = require('fs'); const os = require('os'); const path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-geb2-'));
  const bus = proefBus();
  const { appstore: motor } = require('../server/kern/appstore').maakAppstore({
    db: { data: {} }, save() {}, dir, antivirus: null, log() {}, bus });
  motor.boek('besluit', 'mijn-app', 'O-PROEF');
  const e = bus.heen[bus.heen.length - 1].bericht.envelop;
  assert.equal(e.klasse, 'intern');
  const KLASSEN = require('../server/kern/envelop').KLASSEN;
  assert.match(KLASSEN.intern, /geen mens/, 'en die klasse hoort dat ook te betekenen');
  fs.rmSync(dir, { recursive: true, force: true });
});
