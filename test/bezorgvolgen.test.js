/* HET VOLGSCHERM VAN DE KLANT -- waar is mijn bestelling, en hoe lang nog?

   WAAROM DIT ER IS

   Tussen "betaald" en "onderweg" zit de keuken, en dat is precies de tijd
   waarin iemand zich afvraagt of zijn bestelling wel is aangekomen. In die
   stilte zat geen stap, geen tijd en geen woord: het volgscherm gaf pas iets
   zodra de bezorger reed.

   WAT HIER WORDT VASTGELEGD

   1. EEN STAP PER KETENTOESTAND, en zolang de bestelling loopt is er precies
      EEN bezig. De stappen volgen de echte staat van de bon (betaald, keuken
      bezig, klaar op de pas, onderweg, bezorgd) en niet een apart veld dat
      naast de werkelijkheid kan gaan lopen. "Klaar op de pas" en "onderweg"
      vielen samen op een stap: de klant las dat er iemand reed terwijl zijn
      tas nog in de zaak stond. En bezorgd is een EINDtoestand: dan is er geen
      stap meer bezig, anders blijft een afgeronde bestelling eeuwig lopen.
   1b. EEN AFHAALBON HEEFT ZIJN EIGEN KETEN: hij vertrekt nooit, dus er staat
      geen "Onderweg" in en hij eindigt op "Opgehaald".
   2. MEERDERE BESTELLINGEN TEGELIJK staan elk in hun EIGEN fase. Dat is de
      valkuil van zo'n scherm: een gedeelde variabele en alle drie de kaarten
      tonen dezelfde stap.
   3. DE VERWACHTING IS GEMETEN OF ZE IS ER NIET. Zonder historie geeft het
      scherm geen getal en zegt het waarom -- liever geen verwachting dan een
      verzonnen. Met historie komt de keukentijd uit de eigen bonnen van de
      zaak, en zodra de bezorger rijdt uit zijn echte afstand.
   4. DE LIVE POSITIE komt alleen als hij ook echt onderweg is. Een kaartje met
      een stilstaande stip die "live" heet, is erger dan geen kaartje. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');
const bezorgvolg = require('../server/kern/bezorgvolg');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-volg-'));

function post(base) {
  return (pad, body, token) => fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' },
      token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

const ADRESSEN = [
  { naam: 'Sant Antoni', lat: 38.9800, lng: 1.3000 },
  { naam: 'Jesus', lat: 38.9300, lng: 1.4400 },
  { naam: 'De haven', lat: 38.9100, lng: 1.4300 }
];

async function zaakKlaar(P) {
  const r = await P('/api/supplier/roster', { code: 'KIKUNOI' });
  const man = (r.body.staff || []).find(s => s.role === 'manager');
  const lg = await P('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' });
  const token = lg.body.token;
  const prod = await P('/api/supplier/bezorg/product', { name: 'Omakase-box', price: 48.5 }, token);
  assert.equal(prod.status, 200, 'assortiment gevuld');
  await P('/api/supplier/bezorg/instellingen', { aan: true, bezorgen: true }, token);
  return { token, zaak: ((lg.body.state || {}).supplier || {}).loc, productId: prod.body.producten[0].id };
}

async function nieuwLid(P, naam) {
  const u = String(Date.now()).slice(-7) + Math.floor(Math.random() * 900 + 100);
  const r = await P('/api/auth/register', {
    name: naam, email: naam.toLowerCase() + u + '@x.nl', phone: '06' + u.slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', geslacht: 'v', tier: 'rtg', pasApp: 'rtg'
  });
  assert.ok(r.body.token, naam + ' is aangemeld');
  return r.body.token;
}

test('het volgscherm: drie bestellingen tegelijk, elk in zijn eigen fase', async () => {
  const { child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  try {
    const P = post(base);
    const { token: zaakToken, productId } = await zaakKlaar(P);
    const lid = await nieuwLid(P, 'Volglid');

    // drie bestellingen op drie adressen
    const refs = [];
    for (const a of ADRESSEN) {
      const b = await P('/api/bezorg/bestel', {
        supplierCode: 'KIKUNOI', levering: 'bezorgen',
        items: [{ id: productId, qty: 1 }], adres: a.naam, lat: a.lat, lng: a.lng
      }, lid);
      assert.equal(b.status, 200, 'bestelling naar ' + a.naam);
      refs.push(b.body.ref || b.body.order.ref);
    }

    /* ---- 1. VOOR DE BETALING staat de eerste stap nog niet eens aan. ---- */
    const onbetaald = await P('/api/bezorg/volg', { ref: refs[0] }, lid);
    assert.equal(onbetaald.status, 200, 'het volgscherm opent');
    assert.equal(onbetaald.body.stappen[0].staat, 'bezig', 'stap 1 is bezig: de betaling');
    assert.match(onbetaald.body.wat, /betaling/i, 'en het zegt waar het op wacht: ' + onbetaald.body.wat);

    for (const ref of refs) {
      const p = await P('/api/order/pay', { ref }, lid);
      assert.equal(p.status, 200, 'betaald: ' + ref);
    }

    /* ---- 2. DRIE BESTELLINGEN, DRIE VERSCHILLENDE FASEN. We zetten ze
       bewust uit elkaar: de eerste blijft in de keuken, de tweede gaat op de
       pas, de derde rijdt. ---- */
    await P('/api/supplier/bezorg/neem', { refs }, zaakToken);

    /* #2 is klaar in de keuken en ingepakt -- bij een BEZORGING is het
       inpakmoment het signaal dat de keuken klaar is; die bonnen lopen niet
       langs de keukenlijn van de menukaart. */
    const inpak2 = await P('/api/supplier/bezorg/inpak',
      { ref: refs[1], bon: refs[1], tas: 'Tas 2', items: [productId] }, zaakToken);
    assert.equal(inpak2.status, 200, 'de tweede is ingepakt: ' + JSON.stringify(inpak2.body).slice(0, 140));

    // #3 helemaal tot onderweg
    await P('/api/supplier/bezorg/inpak',
      { ref: refs[2], bon: refs[2], tas: 'Tas 3', items: [productId] }, zaakToken);
    await P('/api/supplier/bezorg/pakcheck', { refs: [refs[2]] }, zaakToken);
    const weg = await P('/api/supplier/bezorg/status', { refs: [refs[2]], status: 'onderweg' }, zaakToken);
    assert.equal(weg.status, 200, 'de derde vertrekt: ' + JSON.stringify(weg.body).slice(0, 140));

    const beelden = [];
    for (const ref of refs) beelden.push((await P('/api/bezorg/volg', { ref }, lid)).body);

    /* Elk beeld heeft precies EEN stap die bezig is -- dat is de bewering die
       zakt als iemand er een gedeelde variabele van maakt. */
    for (const [i, b] of beelden.entries()) {
      const bezig = b.stappen.filter(s => s.staat === 'bezig');
      assert.equal(bezig.length, 1, 'bestelling ' + (i + 1) + ' heeft precies een lopende stap: ' +
        JSON.stringify(b.stappen.map(s => s.naam + '=' + s.staat)));
    }

    const lopende = beelden.map(b => (b.stappen.find(s => s.staat === 'bezig') || {}).naam);
    assert.equal(lopende[0], 'In de keuken', 'de eerste zit in de keuken');
    assert.equal(lopende[1], 'Klaar voor vertrek', 'de tweede staat klaar en wacht op vertrek');
    assert.equal(lopende[2], 'Onderweg', 'de derde is onderweg');
    /* De bewering waar het om begonnen was: bij de tweede rijdt er niemand, en
       dan hoort "Onderweg" ook niet op te lichten. */
    assert.equal(beelden[1].stappen.find(s => s.sleutel === 'onderweg').staat, 'wacht',
      'de tweede laat "Onderweg" met rust: ' + JSON.stringify(beelden[1].stappen.map(s => s.naam + '=' + s.staat)));
    assert.match(beelden[2].wat, /onderweg/i, 'en dat staat er ook: ' + beelden[2].wat);
    assert.notEqual(beelden[0].wat, beelden[2].wat,
      'de drie kaarten vertellen niet allemaal hetzelfde verhaal');

    /* ---- 3. DE LIVE POSITIE komt alleen bij wie echt rijdt. ---- */
    assert.equal(beelden[0].positie, null, 'de bestelling in de keuken heeft geen bezorgerpositie');
    const rit = await P('/api/supplier/bezorg/gps', { lat: 38.9150, lng: 1.4350 }, zaakToken);
    assert.equal(rit.status, 200, 'de bezorger geeft zijn positie door');

    const onderweg = (await P('/api/bezorg/volg', { ref: refs[2] }, lid)).body;
    assert.ok(onderweg.positie && Number.isFinite(onderweg.positie.lat),
      'nu staat hij live op de kaart: ' + JSON.stringify(onderweg.positie));
    assert.equal(onderweg.etaBron, 'rit', 'en de verwachting komt uit zijn echte afstand');
    assert.ok(onderweg.etaMin >= 1, 'met een aankomsttijd in minuten (' + onderweg.etaMin + ')');

    /* ---- 4. DICHTERBIJ RIJDEN VERKORT DE VERWACHTING. ---- */
    await P('/api/supplier/bezorg/gps', { lat: ADRESSEN[2].lat + 0.0005, lng: ADRESSEN[2].lng }, zaakToken);
    const bijna = (await P('/api/bezorg/volg', { ref: refs[2] }, lid)).body;
    assert.ok(bijna.etaMin <= onderweg.etaMin,
      'de verwachting daalt als hij nadert: ' + onderweg.etaMin + ' -> ' + bijna.etaMin + ' min');

    /* ---- 5. BEZORGD: alle stappen gedaan, geen tijd meer, geen kaartje. Een
       afgeronde bestelling heeft geen lopende stap; zolang de laatste stap op
       "bezig" bleef staan, was hij op het scherm niet van een rijdende bezorger
       te onderscheiden. ---- */
    await P('/api/supplier/bezorg/status', { refs: [refs[2]], status: 'bezorgd' }, zaakToken);
    const klaar = (await P('/api/bezorg/volg', { ref: refs[2] }, lid)).body;
    const staten = klaar.stappen.map(s => s.naam + '=' + s.staat);
    assert.deepEqual(klaar.stappen.filter(s => s.staat !== 'gedaan'), [],
      'elke stap is gedaan, ook de laatste: ' + JSON.stringify(staten));
    assert.equal(klaar.etaMin, null, 'er staat geen tijd meer bij een bezorgde bestelling');
    assert.equal(klaar.positie, null, 'en geen live kaartje meer');
  } finally {
    child.kill('SIGKILL');
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

/* DE AFHAALBON, LANGS DE ECHTE ROUTES. De tabel hieronder legt de afbeelding
   toestand voor toestand vast, maar een tabel bewijst niet dat die toestanden
   ook echt ontstaan. Deze toets loopt daarom de afhaalketen door zoals de zaak
   hem in de app doorloopt: bestellen, betalen, de knop "Klaar" op de
   leverancierskaart (/api/supplier/order/status, die zet status "klaar"
   RECHTSTREEKS en dus zonder pasAt) en dan "Opgehaald". Precies die stand
   -- ophalen + klaar, zonder pasAt en zonder inpak -- kreeg vroeger de stap
   "Onderweg" en de zin "hij wacht op de bezorger". */
test('de afhaalbon loopt zijn eigen keten af, van bestellen tot opgehaald', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-volg-op-'));
  const { child, base } = await startServer({ env: { RTG_DATA_DIR: dir, SMTP_URL: '' } });
  try {
    const P = post(base);
    const { token: zaakToken, productId } = await zaakKlaar(P);
    const lid = await nieuwLid(P, 'Ophaallid');

    const b = await P('/api/bezorg/bestel', {
      supplierCode: 'KIKUNOI', levering: 'ophalen', items: [{ id: productId, qty: 1 }]
    }, lid);
    assert.equal(b.status, 200, 'de afhaalbestelling is geplaatst');
    const ref = b.body.ref || b.body.order.ref;
    const volg = async () => (await P('/api/bezorg/volg', { ref }, lid)).body;
    const lopend = (v) => (v.stappen.find(s => s.staat === 'bezig') || {}).naam;
    const beeld = (v) => JSON.stringify(v.stappen.map(s => s.naam + '=' + s.staat));

    /* 1. In de hele keten komt geen rit voor: er staat dus ook geen "Onderweg"
       in, en de laatste stap heet "Opgehaald" en niet "Bezorgd". */
    const eerst = await volg();
    assert.deepEqual(eerst.stappen.map(s => s.naam),
      ['Bevestigd', 'In de keuken', 'Klaar om op te halen', 'Opgehaald'],
      'de afhaalketen: ' + beeld(eerst));
    assert.equal(lopend(eerst), 'Bevestigd', 'nog niet betaald: ' + beeld(eerst));

    assert.equal((await P('/api/order/pay', { ref }, lid)).status, 200, 'betaald');
    const inKeuken = await volg();
    assert.equal(lopend(inKeuken), 'In de keuken', 'betaald: ' + beeld(inKeuken));

    /* 2. DE STAND WAAR HET OM GING. De zaak zet de bon klaar met de knop op de
       leverancierskaart; die route zet status "klaar" en verder niets. */
    const zetKlaar = await P('/api/supplier/order/status', { ref, status: 'klaar' }, zaakToken);
    assert.equal(zetKlaar.status, 200, 'de zaak zet hem klaar: ' + JSON.stringify(zetKlaar.body).slice(0, 140));
    assert.ok(!zetKlaar.body.order.pasAt, 'en wel zonder pasAt: dit is geen bon van de menukaart');
    assert.ok(!zetKlaar.body.order.inpak, 'en zonder inpakmoment: die stap kent de afhaalbon niet');
    const klaarOm = await volg();
    assert.equal(lopend(klaarOm), 'Klaar om op te halen', 'klaar om op te halen: ' + beeld(klaarOm));
    assert.doesNotMatch(klaarOm.wat, /bezorger|onderweg/i,
      'geen bezorger in beeld bij een bon die de klant zelf komt halen: ' + klaarOm.wat);
    assert.equal(klaarOm.positie, null, 'en geen live kaartje');

    /* 3. Opgehaald is een eindtoestand, net als bezorgd. */
    const op = await P('/api/supplier/bezorg/status', { refs: [ref], status: 'opgehaald' }, zaakToken);
    assert.equal(op.status, 200, 'de zaak vinkt hem af: ' + JSON.stringify(op.body).slice(0, 140));
    const gedaan = await volg();
    assert.deepEqual(gedaan.stappen.filter(s => s.staat !== 'gedaan'), [],
      'alles is gedaan, niets is nog bezig: ' + beeld(gedaan));
    assert.match(gedaan.wat, /opgehaald/i, 'en hij heet opgehaald, niet bezorgd: ' + gedaan.wat);
    assert.equal(gedaan.etaMin, null, 'er staat geen tijd meer bij');
  } finally {
    child.kill('SIGKILL');
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
});

/* DE AFBEELDING VAN DE KETEN NAAR HET VOLGSCHERM, toestand voor toestand.

   De toestanden hieronder zijn niet verzonnen: ze staan zo in de routes die ze
   zetten. 'wacht-op-betaling' en (na betalen) 'nieuw' komen uit
   kern/lidacties/bestellen.js; 'in bereiding', pasAt en 'klaar' uit
   routes/supplier/orders/afhandeling.js; inpak en pakcheck uit
   routes/supplier/bezorg-keten.js; 'onderweg', 'bezorgd' en 'opgehaald' uit
   routes/supplier/bezorg.js. Elke regel legt vast WELKE stap oplicht -- de
   tabel zakt dus zodra twee toestanden weer op een stap vallen.

   De drie signalen waaruit keukenKlaar() bestaat staan er elk APART in (alleen
   pasAt, alleen status "klaar", alleen inpak), want een tabel die ze altijd
   samen aanbiedt merkt het niet als er een uit de bron verdwijnt. */
const NU = new Date().toISOString();
const bezorging = (extra) => Object.assign(
  { ref: 'RTG-B-T', supplierCode: 'KIKUNOI', levering: 'bezorgen', at: NU }, extra);
const afhaal = (extra) => Object.assign(bezorging(extra), { levering: 'ophalen' });
const BETAALD = { paid: true, paidAt: NU };
const KLAAR = null;   // eindtoestand: geen enkele stap is nog bezig

const KETEN = [
  ['besteld, nog niet betaald', bezorging({ status: 'wacht-op-betaling', paid: false }), 'Bevestigd'],
  ['betaald, de zaak weet ervan', bezorging(Object.assign({ status: 'nieuw' }, BETAALD)), 'In de keuken'],
  ['de keuken is begonnen', bezorging(Object.assign({ status: 'in bereiding' }, BETAALD)), 'In de keuken'],
  // alleen pasAt: de keuken is af, maar de bar schenkt nog, dus de bon staat nog op "in bereiding"
  ['op de pas, de bar nog bezig', bezorging(Object.assign({ status: 'in bereiding', pasAt: NU }, BETAALD)), 'Klaar voor vertrek'],
  ['klaar op de pas', bezorging(Object.assign({ status: 'klaar', pasAt: NU }, BETAALD)), 'Klaar voor vertrek'],
  // alleen status "klaar": de knop op de leverancierskaart, zonder pas en zonder tas
  ['met de knop klaargezet (geen pas)', bezorging(Object.assign({ status: 'klaar' }, BETAALD)), 'Klaar voor vertrek'],
  // alleen inpak: het bezorgassortiment loopt niet langs de keukenlijn
  ['ingepakt (tas + bonnummer)', bezorging(Object.assign({ status: 'nieuw', inpak: { tas: 'Tas 1', at: NU } }, BETAALD)), 'Klaar voor vertrek'],
  ['de bezorger vinkte af (pakcheck)', bezorging(Object.assign({ status: 'nieuw', inpak: { tas: 'Tas 1', at: NU }, pakcheck: { at: NU } }, BETAALD)), 'Klaar voor vertrek'],
  ['de rit is vertrokken', bezorging(Object.assign({ status: 'onderweg', inpak: { at: NU }, pakcheck: { at: NU } }, BETAALD)), 'Onderweg'],
  ['bezorgd', bezorging(Object.assign({ status: 'bezorgd', finishedAt: NU }, BETAALD)), KLAAR],
  ['afhaalbon: de keuken is begonnen', afhaal(Object.assign({ status: 'in bereiding' }, BETAALD)), 'In de keuken'],
  // de enige klaar-stand die een afhaalbon in productie kent: status "klaar", geen pas, geen tas
  ['afhaalbon: met de knop klaargezet', afhaal(Object.assign({ status: 'klaar' }, BETAALD)), 'Klaar om op te halen'],
  ['afhaalbon: opgehaald', afhaal(Object.assign({ status: 'opgehaald', finishedAt: NU }, BETAALD)), KLAAR]
];

test('elke ketentoestand licht zijn eigen stap op', () => {
  for (const [naam, order, verwacht] of KETEN) {
    const st = bezorgvolg.stappenVan(order);
    const beeld = JSON.stringify(st.map(s => s.naam + '=' + s.staat));
    const bezig = st.filter(s => s.staat === 'bezig').map(s => s.naam);
    if (verwacht === KLAAR) {
      assert.deepEqual(bezig, [], naam + ': niets is nog bezig ' + beeld);
      assert.deepEqual(st.filter(s => s.staat !== 'gedaan'), [], naam + ': alles is gedaan ' + beeld);
      continue;
    }
    assert.deepEqual(bezig, [verwacht], naam + ' -> "' + verwacht + '" ' + beeld);
    const i = st.findIndex(s => s.naam === verwacht);
    assert.deepEqual(st.slice(0, i).filter(s => s.staat !== 'gedaan'), [],
      naam + ': alles voor "' + verwacht + '" is gedaan ' + beeld);
    assert.deepEqual(st.slice(i + 1).filter(s => s.staat !== 'wacht'), [],
      naam + ': niets na "' + verwacht + '" loopt vooruit ' + beeld);
  }
});

test('een afhaalbon die toch op "onderweg" staat valt terug op zijn eigen keten', () => {
  /* Dit kan echt: /api/supplier/order/status laat "onderweg" toe zodra er is
     ingepakt en afgevinkt, en kijkt niet of het een afhaalbon is. De afhaalketen
     kent geen stap "onderweg"; zonder de voorwaarde in fase() vraagt hij om een
     stap die er niet is. Dat hoort te klappen (en die fout ziet deze toets),
     maar de bon zelf hoort gewoon zijn eigen keten te volgen. */
  const bon = afhaal({ status: 'onderweg', paid: true, paidAt: NU,
    inpak: { tas: 'Tas 1', at: NU }, pakcheck: { at: NU } });
  const st = bezorgvolg.stappenVan(bon);
  const beeld = JSON.stringify(st.map(s => s.naam + '=' + s.staat));
  assert.deepEqual(st.filter(s => s.staat === 'bezig').map(s => s.naam),
    ['Klaar om op te halen'], 'hij staat gewoon klaar: ' + beeld);
});

test('geen enkele stand laat het volgscherm leeg', () => {
  /* De vorm van het defect dat hierachter loert: fase() leunde op findIndex, en
     die geeft -1 voor een stap die de keten niet heeft. stappenVan() zet dan
     ALLES op "wacht": een scherm waarop niets oplicht en niets klaagt. Deze
     toets loopt daarom elke combinatie van leveringswijze, status en signaal af
     en eist per stand hetzelfde: OF precies een lopende stap, OF alles gedaan
     (en dat laatste alleen bij een echte eindstatus). */
  const STATUSSEN = ['wacht-op-betaling', 'nieuw', 'in bereiding', 'klaar',
    'geserveerd', 'geweigerd', 'onderweg', 'bezorgd', 'opgehaald'];
  const SIGNALEN = [['kaal', {}], ['op de pas', { pasAt: NU }],
    ['ingepakt', { inpak: { tas: 'Tas 1', at: NU }, pakcheck: { at: NU } }]];
  let standen = 0;
  for (const levering of ['bezorgen', 'ophalen']) {
    for (const status of STATUSSEN) {
      for (const [sig, velden] of SIGNALEN) {
        for (const paid of [false, true]) {
          const bon = Object.assign({ ref: 'RTG-B-T', supplierCode: 'KIKUNOI', levering, at: NU, status, paid },
            paid ? { paidAt: NU } : {}, velden);
          const waar = levering + '/' + status + '/' + sig + (paid ? '/betaald' : '/onbetaald');
          const st = bezorgvolg.stappenVan(bon);
          const beeld = JSON.stringify(st.map(s => s.naam + '=' + s.staat));
          const bezig = st.filter(s => s.staat === 'bezig');
          const wacht = st.filter(s => s.staat === 'wacht');
          if (!bezig.length) {
            assert.ok(['bezorgd', 'opgehaald'].includes(status),
              waar + ': geen lopende stap terwijl dit geen eindstatus is ' + beeld);
            assert.deepEqual(wacht, [], waar + ': eindstatus, dus alles gedaan ' + beeld);
          } else {
            assert.equal(bezig.length, 1, waar + ': precies een lopende stap ' + beeld);
          }
          assert.equal(bezorgvolg.stappenVan(bon).length, levering === 'ophalen' ? 4 : 5,
            waar + ': de keten van deze bon ' + beeld);
          standen++;
        }
      }
    }
  }
  assert.equal(standen, 108, 'alle standen zijn langsgeweest (kreeg ' + standen + ')');
});

test('de stap en de zin eronder komen uit dezelfde bron', () => {
  /* Het defect was aan twee kanten zichtbaar: de stap zei "Onderweg" en de zin
     eronder zei dat hij op de bezorger wachtte. Wie er een van de twee
     verandert, moet de ander meenemen -- daarom kijken deze beweringen naar
     allebei, en naar alle drie de signalen van keukenKlaar(). */
  const opDePas = bezorging(Object.assign({ status: 'klaar', pasAt: NU }, BETAALD));
  const ingepakt = bezorging(Object.assign({ status: 'nieuw', inpak: { tas: 'Tas 1', at: NU } }, BETAALD));
  const knop = bezorging(Object.assign({ status: 'klaar' }, BETAALD));

  assert.equal(bezorgvolg.stappenVan(opDePas).find(s => s.sleutel === 'onderweg').staat, 'wacht',
    '"Onderweg" staat stil zolang er niemand rijdt');
  assert.match(bezorgvolg.watGebeurtEr(opDePas), /wacht op de bezorger/i,
    'en de zin zegt hetzelfde: ' + bezorgvolg.watGebeurtEr(opDePas));
  for (const [naam, bon] of [['ingepakt', ingepakt], ['met de knop klaargezet', knop]]) {
    assert.equal(bezorgvolg.watGebeurtEr(bon), bezorgvolg.watGebeurtEr(opDePas),
      naam + ' is dezelfde toestand als op de pas, dus ook dezelfde zin: ' + bezorgvolg.watGebeurtEr(bon));
    assert.equal(bezorgvolg.stappenVan(bon).find(s => s.staat === 'bezig').naam, 'Klaar voor vertrek',
      naam + ' licht dezelfde stap op');
  }

  // en een afhaalbon wacht op niemand: die zin gaat over de klant zelf
  const afhaalKlaar = afhaal(Object.assign({ status: 'klaar' }, BETAALD));
  assert.doesNotMatch(bezorgvolg.watGebeurtEr(afhaalKlaar), /bezorger/i,
    'een afhaalbon noemt geen bezorger: ' + bezorgvolg.watGebeurtEr(afhaalKlaar));
  assert.equal(bezorgvolg.stappenVan(afhaalKlaar).find(s => s.staat === 'bezig').naam, 'Klaar om op te halen',
    'en de stap zegt hetzelfde');
  assert.match(bezorgvolg.watGebeurtEr(afhaal({ status: 'opgehaald', paid: true })), /opgehaald/i,
    'en een opgehaalde bon heet opgehaald, niet bezorgd');
});

test('de verwachte tijd is gemeten of ze is er niet', () => {
  /* Deze twee gaan over de rekenkern zelf, zonder server: de vraag is of hij
     zwijgt als hij het niet weet. Een scherm dat "ongeveer 30 minuten" zegt
     omdat dat een redelijk getal lijkt, is precies wat hier niet mag. */
  const nu = Date.now();
  const bon = (min) => ({
    supplierCode: 'KIKUNOI',
    paidAt: new Date(nu - min * 60000 - 60000).toISOString(),
    pasAt: new Date(nu - 60000).toISOString()
  });

  assert.equal(bezorgvolg.keukenMinuten([], 'KIKUNOI'), null, 'zonder historie: geen getal');
  assert.equal(bezorgvolg.keukenMinuten([bon(20), bon(22)], 'KIKUNOI'), null,
    'met twee bonnen nog steeds niet: dat is een toevalstreffer en geen meting');

  const drie = bezorgvolg.keukenMinuten([bon(18), bon(20), bon(22)], 'KIKUNOI');
  assert.equal(drie, 20, 'met drie bonnen de mediaan (kreeg ' + drie + ')');

  /* De mediaan en niet het gemiddelde: een vergeten bon die uren op de pas
     bleef liggen mag de verwachting van alle anderen niet verzieken. */
  const metUitschieter = bezorgvolg.keukenMinuten([bon(18), bon(20), bon(22), bon(200)], 'KIKUNOI');
  assert.ok(metUitschieter <= 25,
    'een uitschieter van 200 minuten trekt de verwachting niet omhoog (kreeg ' + metUitschieter + ')');

  // en bonnen van een andere zaak tellen niet mee
  const anders = bezorgvolg.keukenMinuten(
    [bon(18), bon(20), bon(22)].map(b => Object.assign({}, b, { supplierCode: 'ESVEDRA' })), 'KIKUNOI');
  assert.equal(anders, null, 'de keukentijd van een andere zaak telt niet mee');
});
