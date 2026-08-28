/* Het walletplafond en het tegoed dat een lid voor een ander koopt.

   Twee dingen worden hier vastgehouden, en ze horen bij elkaar omdat ze
   allebei uit dezelfde regel komen: kern/bevoegdheid/lijst.js staat RTG het
   aanhouden van walletsaldo toe op grond van een BESLUIT, en dat besluit noemt
   drie voorwaarden -- binnen RTG besteedbaar, niet uitbetaald aan het lid, en
   een maximum per wallet en per boeking.

   1. HET PLAFOND PER WALLET bestond niet. MAX_CENTEN begrensde de boeking, het
      maximum per wallet stond nergens; de grond onder het besluit was voor een
      derde onbebouwd. De zwaarste toets hieronder is niet dat het plafond
      weigert, maar WAAR het weigert: vóór de kaart, niet erna.
   2. HET TEGOED (kern/pay/tegoed.js) is de eerste geldvorm hier die van
      eigenaar wisselt terwijl de ontvanger nog niet bekend is. Wat hem binnen
      het besluit houdt is dat hij nooit ergens anders kan landen dan in een
      RTG-wallet. De zaakkant (kern/pay/tegoed-zaak.js) is dezelfde bon met een
      andere betaler, en verschilt op precies twee punten: geen autolaad, en
      klaarzetten is van de manager.

   Elke toets is tegen een tijdelijk kapotgemaakte kern gezien zakken (LAT.md
   regel 2); de geziene mutatie staat per toets in het commentaar.

   Draai los: node --experimental-sqlite --test test/paytegoed.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tegoed-'));

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* Een piepklein geldig PNG'je: RTG Pay vraagt een rtg-lid eenmalig een
   paspoortfoto voordat de wallet opengaat. De toetsen lopen die poort af in
   plaats van hem te omzeilen. */
const MINI_PNG = 'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/* Een VERS lid per toets, en met opzet een REGISTRATIE en niet de demo-login:
   die laatste geeft per pas steeds dezelfde codenaam terug, dus twee toetsen
   die allebei 'rtg' vragen delen een wallet -- en dan toetst de tweede de
   restjes van de eerste. Het plafond en het tegoed hangen allebei aan een
   saldo, dus dat verschil is hier het verschil tussen meten en gokken. */
let teller = 0;
async function lid() {
  const u = Date.now() + '-' + (++teller);
  const r = await api('/api/auth/register', {
    name: 'Tegoed Toets ' + teller, email: 'tegoed-' + u + '@toets.example',
    password: 'geheim123', geboortedatum: '1985-05-05', tier: 'rtg'
  });
  assert.ok(r.body.token, 'registreren hoort een token te geven: ' + JSON.stringify(r.body).slice(0, 160));
  assert.equal((await api('/api/verify/upload', { image: MINI_PNG }, r.body.token)).status, 200,
    'het paspoort hoort aangenomen te worden');
  const o = await api('/api/pay/overzicht', {}, r.body.token);
  return { token: r.body.token, codenaam: o.body.codenaam };
}

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } }); base = srv.base; });
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* ---------------------------------------------------------------- plafond -- */

/* MUTATIE GEZIEN ZAKKEN: in server/kern/pay/index.js de eerste regel van
   plafondFout vervangen door `if (true) return null;`, zodat het plafond niet
   meer bestaat; deze toets zakte op "boven het plafond gaat de wallet dicht"
   (kreeg 200). Teruggedraaid, daarna groen. */
test('het walletplafond: tot tienduizend euro past erin, en daarboven niet', async () => {
  const a = await lid();
  for (const beurt of [1, 2]) {
    const r = await api('/api/pay/oplaad', { centen: 500000, idem: 'plafond-' + beurt }, a.token);
    assert.equal(r.status, 200, 'vijfduizend euro past er ' + beurt + ' keer in: ' + JSON.stringify(r.body).slice(0, 160));
  }
  const vol = await api('/api/pay/overzicht', {}, a.token);
  assert.equal(vol.body.saldo, 1000000, 'precies op het plafond mag nog');
  /* En het scherm hoort de grens te kunnen tonen voordat hij geraakt wordt. */
  assert.equal(vol.body.plafond, 1000000, 'het overzicht draagt het plafond');
  assert.equal(vol.body.ruimte, 0, 'en wat er nog bij kan');

  const overheen = await api('/api/pay/oplaad', { centen: 100, idem: 'plafond-3' }, a.token);
  assert.equal(overheen.status, 409, 'boven het plafond gaat de wallet dicht');
  assert.equal(overheen.body.error && overheen.body.error.includes('10000 euro'), true,
    'en het zegt hoeveel erop kan: ' + JSON.stringify(overheen.body).slice(0, 160));
  assert.equal((await api('/api/pay/overzicht', {}, a.token)).body.saldo, 1000000, 'er is niets bijgekomen');
});

/* DE VOLGORDE IS DE HELE INHOUD: het plafond moet vóór de kaart vallen. Zou
   alleen boekAsync hem vangen, dan is de volgorde "kaart belast, daarna 409" --
   afgeschreven zonder bijgeschreven.

   EN DAT IS OVER HTTP NIET TE ZIEN, wat de reden is dat deze toets rechtstreeks
   op kern/pay/opladen.js staat. In demostand is een betaling meteen 'betaald'
   en laat de naad geen spoor na, dus een geweigerde oplading ziet er van
   buitenaf identiek uit of de kaart nu wel of niet is belast -- het grootboek
   is in beide gevallen leeg en het saldo in beide gevallen gelijk. Een eerdere
   versie van deze toets deed het wél over de routes en mat daarmee niets: met
   de plafondcontrole in laadOp weggehaald bleef hij gewoon groen. Wat je hier
   moet tellen is de AANROEP van de naad, en dat kan alleen van binnenuit.

   MUTATIE GEZIEN ZAKKEN: de plafondcontrole in laadOp vervangen door `null`,
   zodat alleen boekAsync hem nog ving; deze toets zakte op "de kaart is niet
   aangeraakt" (kreeg 1 aanroep). Teruggedraaid, daarna groen. */
test('het plafond valt vóór de kaart: een volle wallet raakt de betaal-naad niet aan', async () => {
  const saldi = { 'lid:Vol': 1000000, 'lid:Ruim': 0 };
  const WALLET_MAX = 1000000;
  let kaartAanroepen = 0;
  const basis = {
    betaal: {
      maakBetaling: async () => { kaartAanroepen++; return { id: 'bet1', status: 'betaald' }; }
    },
    metIdem: (sleutel, afdruk, werk) => werk(),
    boekAsync: async ({ van, naar, centen }) => {
      saldi[van] = (saldi[van] || 0) - centen;
      saldi[naar] = (saldi[naar] || 0) + centen;
      return { ok: true, boeking: { id: 'B1' } };
    },
    rekLid: c => 'lid:' + c,
    saldoVan: r => Math.round(saldi[r] || 0),
    nu: () => Date.now(), d: () => ({}), save: () => {},
    motorklant: {}, geldModus: 'schaduw', keyVanCodenaam: async () => 'k',
    // dezelfde regel als in kern/pay/index.js
    plafondFout: (naar, centen) => (String(naar).startsWith('lid:') && (saldi[naar] || 0) + centen > WALLET_MAX)
      ? { status: 409, code: 'wallet-plafond', error: 'vol' } : null,
    OPLAAD_MIN: 100, MAX_CENTEN: 500000, AUTOLAAD_STAP: 1000
  };
  const { laadOp } = require('../server/kern/pay/opladen').maakOpladen(basis);

  const geweigerd = await laadOp({ codenaam: 'Vol', centen: 100000 });
  assert.equal(geweigerd.status, 409, 'een volle wallet laadt niet bij');
  assert.equal(kaartAanroepen, 0, 'de kaart is niet aangeraakt');
  assert.equal(saldi['lid:Vol'], 1000000, 'en er is niets veranderd');

  /* De positieve kant erbij, anders zou een laadOp die ALTIJD weigert deze
     toets ook halen (LAT.md regel 9). */
  const gelukt = await laadOp({ codenaam: 'Ruim', centen: 100000 });
  assert.equal(gelukt.ok, true, 'met ruimte gaat hij gewoon door: ' + JSON.stringify(gelukt).slice(0, 160));
  assert.equal(kaartAanroepen, 1, 'en dan wordt de kaart wel gebeld');
});

/* Het plafond hoort ook te gelden voor geld dat van een ANDER komt: anders is
   p2p de sluiproute eromheen en betekent het plafond niets.

   MUTATIE GEZIEN ZAKKEN: in plafondFout de voorwaarde `naar.startsWith('lid:')`
   vervangen door `naar.startsWith('extern:')`; deze toets zakte op "een volle
   wallet neemt ook van een ander niets meer aan". Teruggedraaid, daarna groen. */
test('het plafond geldt ook voor geld van een ander, anders is p2p de sluiproute', async () => {
  const a = await lid();
  const b = await lid();
  await api('/api/pay/oplaad', { centen: 500000, idem: 'p2p-a1' }, b.token);
  for (const beurt of [1, 2]) await api('/api/pay/oplaad', { centen: 500000, idem: 'p2p-b' + beurt }, a.token);

  const r = await api('/api/pay/stuur', { aan: a.codenaam, centen: 1000, idem: 'p2p-stuur' }, b.token);
  assert.equal(r.status, 409, 'een volle wallet neemt ook van een ander niets meer aan');
  assert.equal((await api('/api/pay/overzicht', {}, b.token)).body.saldo, 500000, 'en de zender is niets kwijt');
});

/* ----------------------------------------------------------------- tegoed -- */

/* MUTATIE GEZIEN ZAKKEN: in kern/pay/tegoed.js de boeking bij het verzilveren
   omgedraaid (van de wallet naar de escrow in plaats van andersom); deze toets
   zakte op "het tegoed staat op de wallet van de ontvanger". Teruggedraaid,
   daarna groen. */
test('tegoed: kopen zet het vast, verzilveren zet het op de wallet van de ander, en het grootboek sluit', async () => {
  const a = await lid();
  const b = await lid();
  await api('/api/pay/oplaad', { centen: 10000, idem: 'tg-oplaad' }, a.token);

  const koop = await api('/api/pay/tegoed/koop', { centen: 2500, oms: 'Voor jou', idem: 'tg-koop' }, a.token);
  assert.equal(koop.status, 200, JSON.stringify(koop.body).slice(0, 200));
  assert.equal(koop.body.saldo, 7500, 'het geld is uit de wallet van de koper');
  assert.ok(koop.body.tegoed.code, 'er komt een code uit die je kunt doorgeven');
  assert.equal(koop.body.tegoed.status, 'open');

  // dubbeltikken koopt er geen tweede
  const nog = await api('/api/pay/tegoed/koop', { centen: 2500, oms: 'Voor jou', idem: 'tg-koop' }, a.token);
  assert.equal(nog.body.herhaald, true, 'dezelfde sleutel geeft hetzelfde antwoord');
  assert.equal((await api('/api/pay/overzicht', {}, a.token)).body.saldo, 7500, 'en boekt niet dubbel');

  const mijn = await api('/api/pay/tegoed', {}, a.token);
  assert.equal(mijn.body.openCenten, 2500, 'de koper ziet wat er open staat');

  const in_ = await api('/api/pay/tegoed/verzilver', { code: koop.body.tegoed.code, idem: 'tg-in' }, b.token);
  assert.equal(in_.status, 200, JSON.stringify(in_.body).slice(0, 200));
  assert.equal(in_.body.saldo, 2500, 'het tegoed staat op de wallet van de ontvanger');

  // en een tweede keer verzilveren kan niet -- de escrow zou dan leeglopen
  const weer = await api('/api/pay/tegoed/verzilver', { code: koop.body.tegoed.code, idem: 'tg-in-2' }, b.token);
  assert.equal(weer.status, 409, 'een bon gaat er maar een keer af');
  assert.equal((await api('/api/pay/overzicht', {}, b.token)).body.saldo, 2500);

  const gezond = await fetch(base + '/api/pay/gezond').then(r => r.json());
  assert.equal(gezond.klopt, true, 'de som van alle saldi is nog steeds exact nul');
});

/* MUTATIE GEZIEN ZAKKEN: in tegoed.js de controle `t.aan !== codenaam` naar
   `t.aan === codenaam` gedraaid; deze toets zakte op "een gericht tegoed gaat
   niet naar een ander". Teruggedraaid, daarna groen. */
test('tegoed op naam is voor die ene codenaam, en een onbekende naam wordt geen bon', async () => {
  const a = await lid();
  const b = await lid();
  const c = await lid();
  await api('/api/pay/oplaad', { centen: 10000, idem: 'gericht-oplaad' }, a.token);

  const mis = await api('/api/pay/tegoed/koop', { centen: 1000, aan: 'Bestaat Niet', idem: 'gericht-mis' }, a.token);
  assert.equal(mis.status, 404, 'tegoed voor niemand is geld dat niemand kan ophalen');
  assert.equal((await api('/api/pay/overzicht', {}, a.token)).body.saldo, 10000, 'en er is niets vastgezet');

  const koop = await api('/api/pay/tegoed/koop', { centen: 1000, aan: b.codenaam, idem: 'gericht-ok' }, a.token);
  assert.equal(koop.status, 200);
  assert.equal(koop.body.tegoed.aan, b.codenaam);

  const fout = await api('/api/pay/tegoed/verzilver', { code: koop.body.tegoed.code, idem: 'gericht-fout' }, c.token);
  assert.equal(fout.status, 403, 'een gericht tegoed gaat niet naar een ander');

  const goed = await api('/api/pay/tegoed/verzilver', { code: koop.body.tegoed.code, idem: 'gericht-goed' }, b.token);
  assert.equal(goed.status, 200, 'en wel naar degene voor wie het is');
  assert.equal(goed.body.saldo, 1000);

  /* De ontvanger hoefde de code niet over te tikken: een gericht tegoed staat
     gewoon in zijn overzicht. Dat is de reden dat `voorMij` bestaat. */
  const d2 = await api('/api/pay/tegoed', {}, b.token);
  assert.equal(d2.body.voorMij.length, 0, 'en verdwijnt er weer uit zodra het binnen is');
});

/* ------------------------------------------------- de vervaldatum, los -- */

/* DE KLOK IS HIER HET ONDERWERP, en die kun je over HTTP niet vooruitzetten.
   Deze toets bouwt kern/pay/tegoed.js daarom rechtstreeks op een nep-ctx met
   een klok die we zelf vasthouden. Dat is geen omweg om de routes heen: de
   routekant staat hierboven, dit is het enige stuk dat er niet bij kan.

   MUTATIE GEZIEN ZAKKEN: in tegoed.js de vervalcontrole bij verzilveren
   (`t.vervalt < nu()`) weggehaald; deze toets zakte op "een verlopen bon wordt
   niet meer verzilverd". En apart: de controle bij terugnemen omgedraaid
   (`t.vervalt < nu()`); die zakte op "terugnemen kan pas na de vervaldatum".
   Beide teruggedraaid, daarna groen. */
test('een tegoed verloopt, en dan gaat het terug naar de koper en niet naar RTG', async () => {
  const klok = { t: Date.parse('2026-08-20T12:00:00Z') };
  const data = {};
  const saldi = { 'lid:Koper': 50000 };
  let teller = 0;
  const ctx = {
    crypto, save: () => {}, nu: () => klok.t, d: () => data,
    schoon: (s, n) => String(s == null ? '' : s).slice(0, n),
    rekLid: c => 'lid:' + c,
    saldoVan: r => Math.round(saldi[r] || 0),
    id: p => (p || 'P') + (++teller),
    metIdem: (sleutel, afdruk, werk) => werk(),
    // Dezelfde regel als het echte grootboek: een niet-externe rekening kan
    // nooit onder nul, een externe wel.
    boekAsync: async ({ van, naar, centen }) => {
      if (!van.startsWith('extern:') && (saldi[van] || 0) < centen) return { status: 402, error: 'Onvoldoende saldo.' };
      saldi[van] = (saldi[van] || 0) - centen;
      saldi[naar] = (saldi[naar] || 0) + centen;
      return { ok: true, boeking: { id: 'B' + (++teller) } };
    },
    zorgSaldo: async () => ({ ok: true, bijgeladen: 0 }),
    seintje: () => {}, bestaatLid: async () => true,
    MIN_CENTEN: 1, MAX_CENTEN: 500000
  };
  const tegoed = require('../server/kern/pay/tegoed')(ctx);

  const koop = await tegoed.tegoedKoop({ codenaam: 'Koper', centen: 4000, oms: 'Cadeau' });
  assert.equal(koop.ok, true);
  assert.equal(saldi['lid:Koper'], 46000, 'het geld is uit de wallet');
  assert.equal(saldi['extern:tegoed'], 4000, 'en staat vast op de escrow-rekening');

  // vóór de vervaldatum kan de koper er niet bij: dan is het van de ontvanger
  const tevroeg = await tegoed.tegoedTerug({ codenaam: 'Koper', tegoedId: koop.tegoed.id });
  assert.equal(tevroeg.status, 409, 'terugnemen kan pas na de vervaldatum');

  klok.t += 366 * 24 * 60 * 60 * 1000;   // een jaar en een dag verder

  const telaat = await tegoed.tegoedVerzilver({ codenaam: 'Ontvanger', code: koop.tegoed.code });
  assert.equal(telaat.status, 409, 'een verlopen bon wordt niet meer verzilverd');
  assert.equal(saldi['extern:tegoed'], 4000, 'en er is niets van de escrow gegaan');

  const terug = await tegoed.tegoedTerug({ codenaam: 'Koper', tegoedId: koop.tegoed.id });
  assert.equal(terug.ok, true, JSON.stringify(terug).slice(0, 200));
  assert.equal(saldi['lid:Koper'], 50000, 'het volledige bedrag is terug bij de koper');
  assert.equal(saldi['extern:tegoed'], 0, 'de escrow is leeg; RTG hield niets over aan het vergeten');

  // en daarna is er niets meer terug te nemen
  assert.equal((await tegoed.tegoedTerug({ codenaam: 'Koper', tegoedId: koop.tegoed.id })).status, 409);
});

/* ------------------------------------------------------ tegoed van een zaak -- */

/* De zaakkant verschilt op twee punten van de ledenkant, en allebei zijn ze
   hier het onderwerp: een zaak heeft geen autolaad (te weinig saldo is gewoon
   te weinig, er springt geen kaart bij) en klaarzetten is van de MANAGER, om
   dezelfde reden als uitbetalen -- het haalt geld uit de kas op een moment dat
   de eigenaar niet koos.

   MUTATIE GEZIEN ZAKKEN: in server/routes/pay.js de `managerOnly`-regel uit
   /api/supplier/pay/tegoed/zet weggehaald; deze toets zakte op "een medewerker
   zonder managerrechten zet geen tegoed klaar". En apart: in
   kern/pay/tegoed-zaak.js de betaler `rekPartner(zaak)` vervangen door
   'extern:oplaad' -- een extern:-rekening slaat de saldocontrole over, dus het
   tegoed kwam dan uit het niets in plaats van uit de kas; die zakte op "een
   zaak zonder saldo krijgt geen kaart die bijspringt" (kreeg 200 in plaats van
   402). Beide teruggedraaid, daarna groen. */
test('tegoed vanuit een zaak: van de manager, zonder autolaad, en terug naar de kas', async () => {
  const login = await fetch(base + '/api/supplier/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'rahul', password: 'Imran' })
  }).then(r => r.json());
  const supToken = login.token;
  const supCode = login.state.supplier.code;
  assert.ok(supToken && supCode, 'de zaak logt in als manager');

  /* Eerst zonder saldo: een zaak die niets heeft, zet niets klaar -- en er
     wordt geen kaart gebeld om het gat te dekken. */
  const leeg = await api('/api/supplier/pay/tegoed/zet', { centen: 5000, idem: 'zaak-leeg' }, supToken);
  assert.equal(leeg.status, 402, 'een zaak zonder saldo krijgt geen kaart die bijspringt: ' + JSON.stringify(leeg.body).slice(0, 160));

  // de kas vullen langs de gewone weg: een lid betaalt met een kassacode
  const klant = await lid();
  await api('/api/pay/oplaad', { centen: 20000, idem: 'zaak-klant' }, klant.token);
  const kas = await api('/api/pay/kascode', { maxCenten: 20000 }, klant.token);
  const geind = await api('/api/supplier/pay/in', { code: kas.body.code, centen: 15000, idem: 'zaak-in' }, supToken);
  assert.equal(geind.status, 200, JSON.stringify(geind.body).slice(0, 200));

  // een medewerker zonder managerrechten komt er niet bij
  const roster = await api('/api/supplier/roster', { code: supCode });
  const staf = (roster.body.staff || []).find(x => x.role !== 'manager');
  assert.ok(staf, 'de zaak heeft personeel zonder managerrechten');
  const stafTok = (await api('/api/supplier/login', { code: supCode, staffId: staf.id, pin: '5678' })).body.token;
  assert.equal((await api('/api/supplier/pay/tegoed', {}, stafTok)).status, 200, 'kijken hoort bij het werk');
  const stiekem = await api('/api/supplier/pay/tegoed/zet', { centen: 1000, idem: 'staf-zet' }, stafTok);
  assert.equal(stiekem.status, 403, 'een medewerker zonder managerrechten zet geen tegoed klaar');

  // en de manager wel
  const ontvanger = await lid();
  const zet = await api('/api/supplier/pay/tegoed/zet',
    { centen: 5000, aan: ontvanger.codenaam, oms: 'Kerstattentie', idem: 'zaak-zet' }, supToken);
  assert.equal(zet.status, 200, JSON.stringify(zet.body).slice(0, 200));
  assert.equal(zet.body.tegoed.aan, ontvanger.codenaam);

  const in_ = await api('/api/pay/tegoed/verzilver', { code: zet.body.tegoed.code, idem: 'zaak-verzilver' }, ontvanger.token);
  assert.equal(in_.status, 200, JSON.stringify(in_.body).slice(0, 200));
  assert.equal(in_.body.saldo, 5000, 'het staat op de wallet van de medewerker');

  /* De zaak-bon hoort niet in het ledenoverzicht op te duiken en niet door een
     lid terug te nemen te zijn. LET OP WAT DIT WEL EN NIET BEWIJST: hier
     verschilt de zaakcode gewoon van de codenaam, dus dit blijft ook staan
     zonder de `vanSoort`-controle. Het geval waarvoor dat veld bestaat -- een
     zaakcode die toevallig gelijk is aan een codenaam -- is met deze inlog niet
     na te bootsen; zie de kop van kern/pay/tegoed-zaak.js. */
  const bijLid = await api('/api/pay/tegoed', {}, ontvanger.token);
  assert.equal(bijLid.body.gekocht.length, 0, 'een zaak-bon is niet gekocht door een lid');
  const rooftocht = await api('/api/pay/tegoed/terug', { id: zet.body.tegoed.id }, ontvanger.token);
  assert.equal(rooftocht.status, 404, 'en een lid neemt hem niet terug');

  const zaakBeeld = await api('/api/supplier/pay/tegoed', {}, supToken);
  assert.equal(zaakBeeld.body.klaargezet.length, 1, 'de zaak ziet wat hij klaarzette');
  assert.equal(zaakBeeld.body.openCenten, 0, 'en dat het inmiddels is opgehaald');

  const gezond = await fetch(base + '/api/pay/gezond').then(r => r.json());
  assert.equal(gezond.klopt, true, 'het grootboek sluit nog steeds op de cent');
});
