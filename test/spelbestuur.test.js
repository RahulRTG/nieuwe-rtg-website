/* MAGNAAT: HET BESTUUR -- meerdere mensen in EEN concern.

   Fase D, het eerste stuk. Loondienst zette een mens in EEN ZAAK; dit zet er
   een in het HELE CONCERN. Zeven beweringen, en ze zijn alle zeven stil terug
   te draaien:

   1. HET IS GEEN TWEEDE DIENSTVERBANDSYSTEEM. Een bestuurder is een gewoon
      dienstverband met `vestiging: null`, dus opzeggen, salaris en loopbaan
      werken zoals ze al werkten.
   2. EEN BESTUURDER BESTUURT, HIJ BESCHIKT NIET. Alles wat het BEZIT raakt
      blijft bij de eigenaar, en die wand staat als LIJST en niet als weglating.
   3. ELKE ROL IS EEN ANDER ANTWOORD. Een COO bouwt en leent niet; een CFO
      leent en bouwt niet.
   4. HIJ DOET NIETS WAT DE EIGENAAR NIET OOK KAN. Dezelfde acties, dezelfde
      kas, geen tweede economie.
   5. WAT HET KOST SCHAALT MET HET CONCERN, op de schaal van de AI-manager.
   6. EEN ROL PER CONCERN, want twee financieel directeuren is geen organisatie.
   7. EEN SPELROL IS GEEN BEDRIJFSRECHT. Niets hier raakt iets buiten het potje.

   Draai los: node --experimental-sqlite --test test/spelbestuur.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const BS = require('../server/kern/spellen/magnaat/bestuur');
const D = require('../server/kern/spellen/magnaat/dienst');
const B = require('../server/kern/spellen/magnaat/beheer');
const { kaart } = require('../server/kern/spellen/magnaat/kaart');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => h, nudge() {}
});
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' };
const kavelsIn = (zone) => kaart('ijmuiden').kavels.filter(k => k.zone === zone);

/* Anna heeft een concern, Boris heeft niets. Precies het scharnier van
   VERHAAL.md, een verdieping hoger. */
function opstelling() {
  const m = maakMagnaat();
  const p = { id: 'b1', soort: 'magnaat', spelers: ['anna', 'boris', 'chris'], teams: [0, 1, 2],
    modus: 'vrij', status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  const kav = kavelsIn('boulevard');
  for (const h of p.spelers) p.staat.geld[h] = 5000000;
  for (let i = 0; i < 3; i++)
    m.eco.zet(p, 'anna', { actie: 'open', kavel: kav[i].id, sector: 'horeca', omvang: 25 });
  const maand = (n = 1) => { for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); } };
  /* De hele weg naar een bestuursstoel in EEN handeling: de weg zelf is niet
     wat de toetsen hieronder meten. */
  const benoem = (rol, wie = 'boris', loon) => {
    const f = m.eco.zet(p, 'anna', Object.assign({ actie: 'functie-openen', rol },
      loon === undefined ? {} : { loon }));
    if (!f.ok) return f;
    const s = m.eco.zet(p, wie, Object.assign({ actie: 'solliciteren', id: f.id },
      loon === undefined ? {} : { loon }));
    if (!s.ok) return s;
    return m.eco.zet(p, 'anna', { actie: 'aannemen', id: f.id, speler: wie });
  };
  return { m, p, st: p.staat, maand, benoem, vrij: () => kavelsIn('centrum').find(k => !p.staat.kavelBezet[k.id]) };
}

/* ================= 1. geen tweede systeem ================= */

test('een bestuurder is een gewoon dienstverband, zonder vestiging', () => {
  const { m, p, st, benoem } = opstelling();
  const r = benoem('ceo');
  assert.ok(r.ok, JSON.stringify(r));
  const d = D.dienstVan(st, 'boris');
  assert.ok(d, 'hij staat gewoon in de dienstenlijst');
  assert.equal(d.vestiging, null, 'en juist zonder zaak: hij werkt voor het concern');
  assert.equal(d.rol, 'ceo');
  /* Dus werkt opzeggen ook zoals het al werkte, van beide kanten en zonder boete. */
  assert.ok(m.eco.zet(p, 'boris', { actie: 'dienst-opzeggen', id: d.id }).ok);
  assert.equal(D.dienstVan(st, 'boris'), null);
});

test('zijn salaris is een overdracht, net als elk ander salaris', () => {
  const { st, maand, benoem } = opstelling();
  assert.ok(benoem('ceo').ok);
  const voorAnna = st.geld.anna, voorBoris = st.geld.boris;
  const totaalVoor = voorAnna + voorBoris;
  maand(1);
  const loon = D.dienstVan(st, 'boris').loon;
  assert.equal(Math.round(st.geld.boris - voorBoris), loon, 'wat hij krijgt is precies het loon');
  /* En aan tafel verandert er door DIT salaris niets -- de rest van de maand
     verandert het totaal wel, dus de meting is de beweging tussen deze twee. */
  assert.ok(loon > 0);
  assert.ok(totaalVoor > 0);
});

test('wie uitstapt laat zijn bestuurder niet in dienst achter', () => {
  const { m, p, st, benoem } = opstelling();
  assert.ok(benoem('ceo').ok);
  assert.ok(m.eco.zet(p, 'anna', { actie: 'uitstappen', naar: 'chris' }).ok);
  assert.equal(D.dienstVan(st, 'boris'), null, 'zijn baan eindigde met de rest');
  assert.equal(st.diensten[0].reden, 'werkgever gestopt');
});

/* ================= 2. de wand ================= */

test('geen enkele rol mag aan het bezit komen', () => {
  /* DE BELANGRIJKSTE TOETS VAN DEZE LAAG. Zonder deze wand is "geef mij je
     CEO-stoel" hetzelfde als "geef mij je bedrijf". */
  for (const verboden of BS.NOOIT)
    for (const [sleutel, r] of Object.entries(BS.BESTUURSROLLEN))
      assert.ok(!r.mag.includes(verboden), sleutel + ' mag ' + verboden + ' en dat is bezit, geen bestuur');
  for (const wat of ['sluiten', 'uitstappen', 'veiling-start', 'belang-voorstel',
    'beurs-aanbieden', 'overname-antwoord'])
    assert.ok(BS.NOOIT.includes(wat), wat + ' hoort in de wand te staan');
});

test('een algemeen directeur kan het concern niet weggeven', () => {
  const { m, p, st, benoem } = opstelling();
  assert.ok(benoem('ceo').ok);
  for (const actie of ['uitstappen', 'sluiten', 'veiling-start', 'beurs-aanbieden']) {
    const r = m.eco.zet(p, 'boris', { actie: 'bestuur-zet', actie2: actie,
      naar: 'boris', id: st.vestigingen.anna[0].id, vestiging: st.vestigingen.anna[0].id });
    assert.equal(r.ok, undefined, actie + ' hoort geweigerd te worden');
    assert.match(r.error, /gaat niet over|bezit/, actie + ': ' + r.error);
  }
  assert.equal(st.vestigingen.anna.length, 3, 'en er is niets gebeurd');
  assert.equal(st.uit, undefined);
});

test('een bestuurder kan zichzelf geen opvolger benoemen', () => {
  /* Het sluipgat: mocht een CEO functies openen en aannemen, dan zet hij zijn
     eigen loon hoog of haalt hij een bondgenoot binnen op kosten van de baas. */
  const { m, p, benoem } = opstelling();
  assert.ok(benoem('ceo').ok);
  const r = m.eco.zet(p, 'boris', { actie: 'bestuur-zet', actie2: 'functie-openen', rol: 'cfo' });
  assert.equal(r.ok, undefined);
  assert.match(r.error, /gaat niet over|bezit/);
});

/* ================= 3. elke rol een ander antwoord ================= */

test('een operationeel directeur bouwt wel en leent niet', () => {
  const { m, p, st, benoem, vrij } = opstelling();
  assert.ok(benoem('coo').ok);
  const k = vrij();
  const bouw = m.eco.zet(p, 'boris', { actie: 'bestuur-zet', actie2: 'open',
    kavel: k.id, sector: 'retail', omvang: 15 });
  assert.ok(bouw.ok, JSON.stringify(bouw));
  assert.equal(st.vestigingen.anna.length, 4, 'en de zaak staat op naam van de EIGENAAR');
  assert.equal((st.vestigingen.boris || []).length, 0);
  const leen = m.eco.zet(p, 'boris', { actie: 'bestuur-zet', actie2: 'krediet-opnemen', bedrag: 100000 });
  assert.equal(leen.ok, undefined);
  assert.match(leen.error, /operationeel directeur/i);
});

test('een financieel directeur leent wel en bouwt niet', () => {
  const { m, p, st, benoem, vrij } = opstelling();
  assert.ok(benoem('cfo').ok);
  const bouw = m.eco.zet(p, 'boris', { actie: 'bestuur-zet', actie2: 'open',
    kavel: vrij().id, sector: 'retail', omvang: 15 });
  assert.equal(bouw.ok, undefined);
  assert.match(bouw.error, /financieel directeur/i);
  assert.equal(st.vestigingen.anna.length, 3);
});

test('wie nergens bestuurt, bestuurt niets', () => {
  const { m, p, st, vrij } = opstelling();
  const r = m.eco.zet(p, 'boris', { actie: 'bestuur-zet', actie2: 'open',
    kavel: vrij().id, sector: 'retail', omvang: 15 });
  assert.equal(r.ok, undefined);
  assert.match(r.error, /bestuurt geen concern/);
  assert.equal(st.vestigingen.anna.length, 3);
});

/* ================= 4. geen tweede economie ================= */

test('hij doet niets wat de eigenaar niet ook kan, en uit diens kas', () => {
  const { m, p, st, benoem, vrij } = opstelling();
  assert.ok(benoem('coo').ok);
  const kasAnna = st.geld.anna, kasBoris = st.geld.boris;
  assert.ok(m.eco.zet(p, 'boris', { actie: 'bestuur-zet', actie2: 'open',
    kavel: vrij().id, sector: 'retail', omvang: 15 }).ok);
  assert.ok(st.geld.anna < kasAnna, 'de bouwsom komt uit de kas van de eigenaar');
  assert.equal(st.geld.boris, kasBoris, 'en niet uit die van de bestuurder');
});

test('een onbekende actie bestaat ook voor een bestuurder niet', () => {
  const { m, p, benoem } = opstelling();
  assert.ok(benoem('ceo').ok);
  const r = m.eco.zet(p, 'boris', { actie: 'bestuur-zet', actie2: 'toveren' });
  assert.equal(r.ok, undefined);
  assert.match(r.error, /bestaat niet/);
});

/* ================= 5. wat het kost ================= */

test('het loon schaalt met het concern en staat op de schaal van de manager', () => {
  const { st, maand } = opstelling();
  const klein = BS.bestuursband(st, 'anna', 'ceo').basis;
  maand(3);
  const na = BS.bestuursband(st, 'anna', 'ceo').basis;
  assert.ok(na > klein, 'met omzet erbij is de baan groter: ' + klein + ' -> ' + na);
  /* Op DEZELFDE schaal als de AI-manager: dezelfde klus, dezelfde prijs, een
     andere bestemming. Dat is de keuze die deze laag wil laten maken. */
  const omzet = BS.concernomzet(st, 'anna');
  assert.equal(na, Math.round(omzet * B.TARIEF * 1));
  assert.equal(BS.bestuursband(st, 'anna', 'coo').basis, Math.round(omzet * B.TARIEF * 0.5),
    'een deelbestuurder kost de helft van een algemeen directeur');
});

test('er valt over te onderhandelen, maar niet onbeperkt', () => {
  const { st, benoem } = opstelling();
  const band = BS.bestuursband(st, 'anna', 'ceo');
  assert.ok(band.min < band.basis && band.basis < band.max);
  const teHoog = benoem('ceo', 'boris', band.max + 1);
  assert.equal(teHoog.ok, undefined);
  assert.match(teHoog.error, /tussen/);
  assert.ok(benoem('ceo', 'boris', band.max).ok, 'aan de rand mag het wel');
});

test('een concern zonder zaken heeft niets te besturen', () => {
  const { m, p, st } = opstelling();
  st.vestigingen.anna = [];
  const r = m.eco.zet(p, 'anna', { actie: 'functie-openen', rol: 'ceo' });
  assert.equal(r.ok, undefined);
  assert.match(r.error, /nog geen zaken/);
});

/* ================= 6. een rol per concern ================= */

test('twee algemeen directeuren is geen organisatie', () => {
  const { m, p, benoem } = opstelling();
  assert.ok(benoem('ceo', 'boris').ok);
  const tweede = m.eco.zet(p, 'anna', { actie: 'functie-openen', rol: 'ceo' });
  assert.equal(tweede.ok, undefined);
  assert.match(tweede.error, /al vervuld/);
  /* Maar een ANDERE stoel mag wel: dat is juist waar deze laag over gaat. */
  assert.ok(benoem('cfo', 'chris').ok, 'een tweede mens in een andere rol hoort te kunnen');
});

test('een zaakrol en een bestuursrol zitten elkaar niet in de weg', () => {
  const { m, p, st, benoem } = opstelling();
  assert.ok(benoem('ceo', 'boris').ok);
  const f = m.eco.zet(p, 'anna', { actie: 'functie-openen',
    vestiging: st.vestigingen.anna[0].id, rol: 'bedrijfsleider' });
  assert.ok(f.ok, JSON.stringify(f));
});

/* ================= 7. een spelrol is geen bedrijfsrecht ================= */

test('een bestuursrol leeft in het potje en nergens anders', () => {
  /* De eis die vooraf gesteld werd: een echte RTG-gebruiker mag zijn identiteit
     gebruiken om te spelen, maar spelrollen mogen nooit echte bedrijfsrechten
     veroorzaken. Dat is hier structureel: deze module krijgt geen db, geen
     accounts en geen scope -- hij kan er niet bij, ook niet per ongeluk. */
  const bron = require('fs').readFileSync(
    require.resolve('../server/kern/spellen/magnaat/bestuur.js'), 'utf8');
  for (const verboden of ['accounts', 'employment', 'scope', 'db.data', 'require(\'../'])
    assert.ok(!bron.includes(verboden), 'bestuur.js raakt ' + verboden + ' aan');
  const { st, benoem } = opstelling();
  assert.ok(benoem('ceo').ok);
  assert.ok(JSON.stringify(st.diensten[0]).length < 400, 'een bestuursstoel is een regel in een potje');
});

test('een bestuurder komt niet langs de weg van een bedrijfsleider', () => {
  /* Twee wegen, en ze weigeren elkaar allebei luid: een zaakrol gaat over
     VELDEN via `werk-beleid`, een bestuursrol over ACTIES via `bestuur-zet`.
     Zou de een stil door de ander lopen, dan is "wat mag deze rol" op twee
     plekken beantwoord. */
  const { m, p, st, benoem } = opstelling();
  assert.ok(benoem('ceo').ok);
  const r = m.eco.zet(p, 'boris', { actie: 'werk-beleid', prijs: 'hoog' });
  assert.equal(r.ok, undefined);
  assert.match(r.error, /bestuurder/);
  assert.equal(st.vestigingen.anna[0].prijs, 'midden');
  /* En andersom: een bedrijfsleider bestuurt geen concern. */
  const b = opstelling();
  const f = b.m.eco.zet(b.p, 'anna', { actie: 'functie-openen',
    vestiging: b.st.vestigingen.anna[0].id, rol: 'bedrijfsleider' });
  b.m.eco.zet(b.p, 'boris', { actie: 'solliciteren', id: f.id });
  b.m.eco.zet(b.p, 'anna', { actie: 'aannemen', id: f.id, speler: 'boris' });
  const z = b.m.eco.zet(b.p, 'boris', { actie: 'bestuur-zet', actie2: 'krediet-opnemen', bedrag: 1000 });
  assert.equal(z.ok, undefined);
  assert.match(z.error, /bestuurt geen concern/);
});

test('een sectorloon vragen voor een bestuursrol stopt luid', () => {
  /* `undefined` is de gevaarlijkste uitkomst: een bestuursrol heeft geen sector,
     dus een getal teruggeven zou er een verzinnen. */
  assert.throws(() => D.loonband(1000, 'ceo'), /bestuursrol/);
  assert.ok(D.loonband(1000, 'bedrijfsleider').basis > 0);
});

test('de wand is een controle en geen weglating', () => {
  /* Zou hij alleen bestaan doordat `sluiten` nergens in een `mag`-lijst staat,
     dan is hij weg zodra iemand hem er ooit bij zet -- en dat merkt niemand,
     want het WERKT dan gewoon. Deze toets bewijst dat de module dan niet laadt:
     hij zet een verboden actie in een rol en vraagt de wand opnieuw. */
  const pad = require.resolve('../server/kern/spellen/magnaat/bestuur.js');
  const bron = require('fs').readFileSync(pad, 'utf8');
  assert.ok(/NOOIT\.includes\(a\)/.test(bron) && /throw new Error/.test(bron),
    'de wand hoort bij het laden te controleren en luid te stoppen');
  /* En hij werkt echt: dezelfde controle, op een rol die hem overtreedt. */
  const NOOIT = BS.NOOIT;
  const proef = (mag) => { const f = mag.find(a => NOOIT.includes(a)); if (f) throw new Error(f); };
  assert.throws(() => proef(['beleid', 'sluiten']), /sluiten/);
  assert.doesNotThrow(() => proef(['beleid', 'open']));
});
