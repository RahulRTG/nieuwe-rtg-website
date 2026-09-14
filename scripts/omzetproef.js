#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE OMZETPROEF -- de vijfde gouden keten, en de eerste die over GELD gaat.

   DE VRAAG. Een lid koopt iets bij een zaak. Komt exact diezelfde gebeurtenis,
   met hetzelfde bedrag, dezelfde tijd, dezelfde fiscale betekenis en dezelfde
   eigenaar, correct terug in de financiele werkelijkheid van die zaak? Niet
   "werkt de betaalknop" -- dat is een route. Dit is de weg van een
   consumentintentie tot een cijfer waar een ondernemer zijn belasting op
   afdraagt, en elke naad daartussen is een plek waar geld stil kan verdwijnen
   of verdubbelen.

   DE ZES TREDEN die de keten modelleert, en ze zijn met opzet geen zeven
   routes:

     consumentintentie   het lid kiest -- nog geen verplichting, nog geen geld
     verplichting        de bestelling bestaat, met een bedrag dat vaststaat
     betaling            het geld beweegt, EEN keer, met een eigen sleutel
     econ. gebeurtenis   er staat een feit in de boeken van de zaak
     fiscale verdeling   dat feit valt uiteen in btw-potten per tarief
     ondernemersbeeld    de ondernemer ziet er een getal van

   WAAROM DEZE KETEN ANDERS IS DAN DE VIER DIE ER AL ZIJN. De tafelproef meet
   een DIENST (bestelling -> bord), de ritproef een VERPLAATSING, de
   toelatingsproef TOEGANG en de zaak-live-proef ZICHTBAARHEID. Geen van vier
   volgt een bedrag tot in de boekhouding. En de assen die scripts/ketenvorm.js
   meet lopen hier opnieuw anders: de uitkomst is een GETAL en geen toestand,
   de tweede actor is niet een mens maar een PROJECTIE (financeVoor), en de
   belofte die eronder ligt is een gelijkheid en geen gebeurtenis.

   DE ACHT NADEN die de eigenaar benoemde, en waar elk ervan in deze proef
   terechtkomt:

     1 transactie-identiteit   schakel 1, 3      draagt de gebeurtenis een sleutel?
     2 tijdwaarheid            schakel 6         geldt het tarief van de DAG?
     3 categoriewaarheid       schakel 5, st. 5  wat is eten, wat is drank?
     4 retry / dubbele betaling storing 1        een tweede tik is geen tweede omzet
     5 halve commit            storing 6         een geweigerde betaling laat niets half
     6 tenant-naad             storing 3         zaak B ziet de omzet van zaak A niet
     7 refund / annulering     storing 2         wat doet een terugstorting met de maand?
     8 bron van waarheid       schakel 7         lid en zaak lezen hetzelfde feit

   DE WERELD. Een vers lid, een ondernemer met een eigen zaak in een eten-genre,
   en een TWEEDE zaak van een tweede ondernemer voor de tenant-naad. Dat
   voorwerk is geen schakel: de toelatingsketen en de zaak-live-keten zijn
   elders al beproefd, en wie ze hier nog eens telt meet twee keer hetzelfde.

   GEEN GEDEELDE MODULE MET DE VIER ANDERE PROEVEN. Besluit, geen slordigheid:
   scripts/ketenvorm.js telt achteraf wat de ketens werkelijk delen, en dat
   telwerk is waardeloos zodra ze uit dezelfde mal komen.

   WAT DEZE PROEF NIET MEET, en dat staat even groot in het register: er komt
   geen browser aan te pas, er gaat geen echte bank langs (kern/pay draait in
   deze opzet op de demo-rail), en hij kijkt naar EEN maand -- de huidige.
   Periodeafsluiting, kwartaalaangifte en de weg naar de Belastingdienst liggen
   erbuiten.

   Draaien:  npm run omzetproef        (print, zakt op een open schakel)
             npm run omzetproef:vast   (schrijft OMZETPROEF.json)
   ============================================================================ */
const fs = require('fs');
const path = require('path');
const { start } = require('./lib/wegwerpserver');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'OMZETPROEF.json');
const GENRE = 'restaurant';          // een eten-genre: basiscategorie 'eten', NL 9%
const KANTOOR = 'RTG-OFFICE-OMZET';
const KEURDER = { email: process.env.RTG_OWNER_EMAIL || 'roellie.i@gmail.com',
                  wachtwoord: process.env.DEMO_PASS || 'Imran' };

/* DE KAART, EN WAAROM PRECIES DEZE TWEE REGELS. Een gerecht uit de keuken en
   een drankje uit de bar vallen in NL in twee verschillende btw-potten (9% en
   21%). Met een kaart van een categorie zou schakel 5 niets bewijzen: dan is
   elke verdeling per definitie goed.

   De koffie draagt `alcohol: false`, uitdrukkelijk. Dat is geen sier: het is de
   scheidslijn die kern/lidacties/bestellen.js al trekt ("de werkplek zegt waar
   iets wordt gemaakt, niet wat erin zit") en die de fiscale kant NIET trekt.
   Zie schakel 5 en storing 5. */
const KAART = [
  { id: 'dagschotel', name: 'Dagschotel', cat: 'Hoofd', price: 20, publiekePrijs: 20, station: 'keuken' },
  { id: 'flatwhite', name: 'Flat White', cat: 'Koffie', price: 5, publiekePrijs: 5, station: 'bar', alcohol: false }
];
const BESTELLING = [{ id: 'dagschotel', qty: 2 }, { id: 'flatwhite', qty: 1 }];
const BRUTO = 20 * 2 + 5 * 1;        // 45,00 -- het bedrag dat de hele keten door moet

async function post(basis, pad, lijf, tok) {
  const r = await fetch(basis + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(lijf || {})
  }).catch(() => null);
  if (!r) return { status: 0, data: null };
  return { status: r.status, data: await r.json().catch(() => null) };
}
const schakel = (nr, van, naar, wat, bekend) => ({ nr, van, naar, wat, bekend: bekend || null });
const euro = n => Math.round(Number(n || 0) * 100) / 100;
/* De omzet van een btw-regel is EX of IN btw, afhankelijk van het register.
   Hier wordt daarom niet geraden: de proef telt het veld `omzet` op, en dat is
   per definitie wat de zaak als omzet ziet. */
const omzetVan = (fin) => euro((fin.btw || []).reduce((s, r) => s + (r.omzet || 0), 0));
const potVan = (fin, cat) => (fin.btw || []).find(r => r.cat === cat) || null;

/* De wereld: twee ondernemers met elk een eigen zaak, en een lid dat koopt.
   Faalt hier iets, dan kan de proef niet draaien -- dat is een storing van het
   instrument en geen uitslag over de keten. */
async function wereld(basis, merk) {
  const P = (pad, lijf, tok) => post(basis, pad, lijf, tok);
  const pw = 'ProefWachtwoord1';
  const keur = await P('/api/auth/login', { login: KEURDER.email, password: KEURDER.wachtwoord });
  const K = keur.data && keur.data.token;
  if (!K) throw new Error('geen keurderssessie -- bestaat het demo-eigenaarsaccount?');

  /* Een zaak opzetten langs de echte toelatingsweg. Twee keer, want de
     tenant-naad is alleen te meten met een TWEEDE zaak die er werkelijk is. */
  const zaakOp = async (naam, mail) => {
    const reg = await P('/api/auth/register',
      { name: naam, email: mail, password: pw, geboortedatum: '1980-06-01' });
    const tok = reg.data && reg.data.token;
    if (!tok) throw new Error('geen ondernemerssessie voor ' + naam + ' (status ' + reg.status + ')');
    const aan = await P('/api/aanmelding/aanvraag', { pas: 'business', naam, contact: mail,
      viaUitnodiging: true, bedrijf: { naam: naam + ' ' + merk, type: GENRE, plaats: 'Amsterdam' } }, tok);
    const id = aan.data && aan.data.aanmelding && aan.data.aanmelding.id;
    if (!id) throw new Error('geen aanmelding voor ' + naam + ' (status ' + aan.status + ')');
    await P('/api/aanmelding/beslis', { id, besluit: 'geaccepteerd', contractEuro: 5000 }, K);
    const t = await P('/api/aanmelding/termijn-voldaan', { id, maand: 1 }, K);
    const code = t.data && t.data.zaak && t.data.zaak.code;
    if (!code) throw new Error('de zaak van ' + naam + ' is niet klaargezet (status ' + t.status + ')');
    const inl = await P('/api/supplier/mijn/login', { login: mail, password: pw, bedrijf: code });
    const S = inl.data && inl.data.token;
    if (!S) throw new Error('geen zaaksessie voor ' + naam + ' (status ' + inl.status + ')');
    await P('/api/supplier/menu', { menu: KAART }, S);
    await P('/api/supplier/poort/online', { online: true }, S);
    return { mail, code, S, lid: tok };
  };
  const A = await zaakOp('Proefzaak A', 'omzeta+' + merk + '@rtg.test');
  const B = await zaakOp('Proefzaak B', 'omzetb+' + merk + '@rtg.test');

  /* De koper. Meerderjarig opgegeven, maar NIET door RTG geverifieerd -- en dat
     is met opzet: zo koopt hij niets met alcohol, en blijft de proef weg bij de
     leeftijdspoort die een andere keten al beproeft. */
  const koper = await P('/api/auth/register',
    { name: 'Proef Koper', email: 'koper+' + merk + '@rtg.test', password: pw, geboortedatum: '1988-03-03' });
  const L = koper.data && koper.data.token;
  if (!L) throw new Error('geen kopersessie (status ' + koper.status + ')');
  const ander = await P('/api/auth/register',
    { name: 'Proef Buitenstaander', email: 'buiten+' + merk + '@rtg.test', password: pw, geboortedatum: '1991-01-01' });
  const X = ander.data && ander.data.token;

  /* HET TELEFOONNUMMER, EN WAAROM DAT WERELD IS EN GEEN SCHAKEL.

     /api/order weigert met een 428 zolang de zaak het lid niet kan bereiken als
     er iets misgaat (kern/gegevenspoort.js: `bestelling` vraagt `telefoon`).
     Dat is een echte poort en een goede -- maar hij gaat over BEREIKBAARHEID en
     niet over geld, en hij heeft zijn eigen gesprek met zijn eigen weigeringen.
     Hem hier als schakel tellen zou de geldketen laten zakken op iets dat er
     niet in zit.

     Het nummer wordt daarom langs de ECHTE weg gezet -- het gesprek, niet een
     achterdeur in de kluis -- want een wereld die met een truc wordt opgezet,
     bewijst de opvolgende schakels tegen een toestand die in productie niet
     bestaat. Elk lid dat koopt, krijgt dit gesprek. */
  for (const tok of [L, X]) {
    const g = await P('/api/gegevens/start', { soort: 'bestelling' }, tok);
    const id = g.data && g.data.id;
    if (id) await P('/api/gegevens/zeg', { id, tekst: '+31 6 12345678' }, tok);
  }
  const rest = await P('/api/gegevens/nodig', { soort: 'bestelling' }, L);
  if (((rest.data && rest.data.ontbreekt) || []).length)
    throw new Error('de koper mist nog gegevens: ' + JSON.stringify(rest.data.ontbreekt));

  return { pw, K, A, B, L, X };
}

async function loop(basis, uit, w) {
  const P = (pad, lijf, tok) => post(basis, pad, lijf, tok);
  const stap = async (s, doe, zien) => {
    const t0 = Date.now();
    let r, gezien = null, fout = null;
    try {
      r = await doe();
      if (!r || r.status < 200 || r.status >= 300) {
        uit.schakels.push(Object.assign({}, s, { stand: 'stuk', status: r ? r.status : 0,
          antwoord: r && r.data && (r.data.error || null), ms: Date.now() - t0 }));
        return null;
      }
      gezien = zien ? await zien(r) : null;
    } catch (e) { fout = String(e && e.message || e); }
    let stand = fout ? 'stuk' : (!zien ? 'gesloten' : (gezien && gezien.klopt ? 'gesloten' : 'open'));
    if (stand === 'open' && s.bekend) stand = 'openBekend';
    uit.schakels.push(Object.assign({}, s, { stand, status: r ? r.status : 0,
      ziet: gezien ? gezien.wat : null, fout, ms: Date.now() - t0 }));
    return r;
  };

  /* De nulmeting. Wat stond er in deze maand al op naam van de zaak voordat het
     lid iets kocht? Zonder dit getal meet elke schakel hierna de SEED mee, en
     dan bewijst "er staat 45 euro" niets. */
  const voor = await P('/api/supplier/finance', {}, w.A.S);
  uit.nulmeting = { omzet: omzetVan(voor.data || {}), status: voor.status };
  const beginOmzet = uit.nulmeting.omzet;

  /* 1 -- CONSUMENTINTENTIE WORDT VERPLICHTING. Het lid bestelt. Wat er hier
     moet ontstaan is niet "een bestelling" maar een verplichting met een EIGEN
     IDENTITEIT en een bedrag dat vaststaat -- naad 1. Zonder sleutel is elke
     latere vraag ("is dit dezelfde gebeurtenis?") onbeantwoordbaar. */
  await stap(schakel(1, 'lid', 'zaak',
    'de bestelling krijgt een eigen sleutel en een bedrag dat vaststaat'),
  () => P('/api/order', { supplierCode: w.A.code, items: BESTELLING }, w.L),
  async (r) => {
    const o = r.data && r.data.order;
    uit.ref = o && o.ref;
    return { klopt: !!(o && o.ref) && euro(o.total) === BRUTO && o.paid === false,
      wat: 'ref ' + ((o && o.ref) || '?') + ', totaal ' + euro(o && o.total) + ' (verwacht ' + BRUTO + '), betaald ' + (o && o.paid) };
  });
  if (!uit.ref) return;

  /* 2 -- ER IS NOG GEEN OMZET. Een verplichting is geen economische
     gebeurtenis. Staat een onbetaalde bestelling al in de boeken, dan draagt de
     ondernemer btw af over geld dat hij nooit kreeg. */
  await stap(schakel(2, 'zaak', 'boekhouding',
    'een onbetaalde bestelling telt NIET mee in de omzet van de maand'),
  () => P('/api/supplier/finance', {}, w.A.S),
  async (r) => {
    const nu = omzetVan(r.data || {});
    return { klopt: euro(nu) === euro(beginOmzet),
      wat: 'omzet ' + nu + ' (voor de bestelling: ' + beginOmzet + ')' };
  });

  /* 3 -- VERPLICHTING WORDT BETALING. Het geld beweegt, en de bestelling
     draagt daarna WANNEER en HOEVEEL er werkelijk betaald is -- in centen, want
     dat is wat de betaalrail teruggaf. Dat `paidAt` bestaat is geen detail: het
     is het tijdstip waar de hele fiscale verdeling straks op hangt (naad 2). */
  await stap(schakel(3, 'lid', 'betaalrail',
    'de betaling landt EEN keer, met tijdstip en met het werkelijk betaalde bedrag'),
  () => P('/api/order/pay', { ref: uit.ref }, w.L),
  async (r) => {
    const o = r.data && r.data.order;
    const centen = o && o.payBetaaldCenten;
    return { klopt: !!(o && o.paid === true && o.paidAt) && Number(centen) === Math.round(BRUTO * 100),
      wat: 'betaald ' + (o && o.paid) + ', op ' + ((o && o.paidAt) || '?') + ', ' + centen + ' cent (verwacht ' + Math.round(BRUTO * 100) + ')' };
  });

  /* 4 -- BETALING WORDT ECONOMISCHE GEBEURTENIS. Nu pas hoort het bedrag in de
     maand van de zaak te staan, en precies een keer. Dit is de kernbewering van
     de hele keten: het verschil tussen voor en na is exact het verkochte
     bedrag. */
  await stap(schakel(4, 'betaalrail', 'boekhouding',
    'de omzet van de maand stijgt met exact het verkochte bedrag, niet meer en niet minder'),
  () => P('/api/supplier/finance', {}, w.A.S),
  async (r) => {
    const nu = omzetVan(r.data || {});
    uit.naBetaling = nu;
    return { klopt: euro(nu - beginOmzet) === BRUTO,
      wat: 'omzet ' + nu + ', verschil ' + euro(nu - beginOmzet) + ' (verwacht ' + BRUTO + ')' };
  });

  /* 5 -- ECONOMISCHE GEBEURTENIS WORDT FISCALE VERDELING (naad 3). Twee
     regels op de kaart, twee btw-potten: de dagschotel is eten (9%), de koffie
     komt van de bar. En daar zit de bevinding: kern/fiscaal/tarief.js leidt de
     categorie af uit de WERKPLEK (`station === 'bar' ? 'drank' : 'eten'`),
     terwijl de landentabel er zelf bij zegt dat in Nederland "eten en
     NIET-ALCOHOLISCHE dranken 9%" zijn en alleen alcohol 21%. Een Flat White
     uit de bar wordt hier dus tegen 21% verdeeld.

     Dezelfde scheidslijn wordt twintig regels verderop in dit huis WEL getrokken:
     kern/lidacties/bestellen.js gebruikt met zoveel woorden `m.alcohol` en niet
     `m.station`, "want de werkplek zegt waar iets wordt gemaakt, niet wat erin
     zit". De ene helft van het huis weet het, de andere niet.

     Deze schakel is daarom `openBekend` en niet `stuk`: hij meet iets echts, en
     het antwoord is een BESLUIT van de eigenaar (wat is de bron van het
     btw-tarief -- de werkplek of het product?) en niet een regel die ik hier
     even omzet. */
  await stap(schakel(5, 'boekhouding', 'fiscus',
    'elke verkochte regel valt in de btw-pot die bij het PRODUCT hoort',
    'de btw-categorie wordt afgeleid uit de werkplek (station) en niet uit het product: ' +
    'een niet-alcoholisch drankje van de bar valt op 21% terwijl NL 9% kent voor ' +
    'eten en niet-alcoholische dranken. De scheidslijn alcohol-ja/nee bestaat al ' +
    'in kern/lidacties/bestellen.js maar niet in kern/fiscaal/tarief.js. ' +
    'Besluit van de eigenaar: wat is de bron van het tarief, de werkplek of het product?'),
  () => P('/api/supplier/finance', {}, w.A.S),
  async (r) => {
    const fin = r.data || {};
    const eten = potVan(fin, 'eten');
    const drank = potVan(fin, 'drank');
    uit.potten = (fin.btw || []).map(p => ({ cat: p.cat, tarief: p.tarief, omzet: euro(p.omzet) }));
    /* De koffie hoort bij 9% te staan, want hij is niet-alcoholisch. Staat hij
       op 21%, dan is dat precies de bevinding. */
    const koffieBij9 = !!eten && euro(eten.omzet) >= 45;
    return { klopt: koffieBij9,
      wat: 'potten: ' + uit.potten.map(p => p.cat + '@' + p.tarief + '% = ' + p.omzet).join(', ') +
        (drank ? ' -- de koffie (5,00) staat bij drank/' + drank.tarief + '%' : '') };
  });

  /* 6 -- TIJDWAARHEID (naad 2). Het tarief moet van de DAG van de transactie
     komen en niet van vandaag. kern/fiscaal/index.js doet dat aantoonbaar
     (`regelbron.tariefOp(landCode, cat, datum)`), en deze schakel bewijst dat
     die datum de betaaldatum van DEZE bestelling is en niet een vaste waarde.

     WAT DEZE SCHAKEL NIET BEWIJST, en dat hoort erbij: het TARIEF is
     tijdgetrouw, de CATEGORIE niet. `basisCat` leest de capaciteiten van de zaak
     zoals ze VANDAAG zijn, en `catVanItem` zoekt het gerecht op NAAM in de
     HUIDIGE kaart. Haalt de zaak een gerecht van de kaart, dan verhuist de al
     verkochte omzet van gisteren naar een andere pot. Dat is storing 5. */
  await stap(schakel(6, 'fiscus', 'boekhouding',
    'het tarief komt van de dag van de transactie en is per pot uitgeschreven'),
  () => P('/api/supplier/finance', {}, w.A.S),
  async (r) => {
    const fin = r.data || {};
    const metTarief = (fin.btw || []).filter(p => Number.isFinite(p.tarief));
    const eten = potVan(fin, 'eten');
    return { klopt: metTarief.length === (fin.btw || []).length && !!eten && eten.tarief === 9,
      wat: (fin.btw || []).length + ' pot(ten), allemaal met tarief: ' + (metTarief.length === (fin.btw || []).length) +
        ', eten staat op ' + (eten ? eten.tarief + '%' : 'geen pot') };
  });

  /* 7 -- BRON VAN WAARHEID (naad 8). Het lid en de zaak kijken naar dezelfde
     gebeurtenis. Ziet het lid een ander bedrag of een andere stand dan de zaak,
     dan zijn er twee waarheden en wint bij een geschil degene met het beste
     scherm. Dit is de enige schakel die aan de KOPERSKANT controleert -- een
     keten die zijn eigen uitkomst bevestigt, bevestigt niets. */
  await stap(schakel(7, 'boekhouding', 'lid',
    'het lid ziet dezelfde bestelling, hetzelfde bedrag en dezelfde betaalstand'),
  () => P('/api/orders/mine', {}, w.L),
  async (r) => {
    const mijn = ((r.data && r.data.orders) || []).find(o => o.ref === uit.ref);
    return { klopt: !!mijn && euro(mijn.total) === BRUTO && mijn.paid === true,
      wat: mijn ? 'ref ' + mijn.ref + ', ' + euro(mijn.total) + ', betaald ' + mijn.paid : 'de eigen bestelling staat niet in de lijst van het lid' };
  });
}

async function storingen(basis, uit, w) {
  const P = (pad, lijf, tok) => post(basis, pad, lijf, tok);
  const noteer = (naam, belofte, houdt, wat) =>
    uit.storingen.push({ naam, belofte, stand: houdt ? 'gehouden' : 'gebroken', wat });
  const omzetNu = async () => omzetVan((await P('/api/supplier/finance', {}, w.A.S)).data || {});

  /* 1. RETRY EN DUBBELE BETALING (naad 4). De duurste fout die een geldketen
     kan maken. Twee tikken op dezelfde bestelling mogen het geld een keer
     bewegen EN de omzet een keer verhogen. Niet een van beide: allebei. */
  const voor = await omzetNu();
  const twee = await P('/api/order/pay', { ref: uit.ref }, w.L);
  const na = await omzetNu();
  noteer('dezelfde bestelling een tweede keer betalen',
    'wordt geweigerd, en de omzet van de maand beweegt geen cent',
    twee.status === 409 && euro(na) === euro(voor),
    'status ' + twee.status + ', omzet ' + voor + ' -> ' + na);

  /* 2. REFUND (naad 7). Een terugstorting is een economische gebeurtenis met
     een eigen datum. De vraag is niet of het geld terugkomt maar wat er met de
     MAAND gebeurt: blijft de verkoop staan met een tegenboeking ernaast, of
     verdwijnt hij?

     kern/fiscaal/index.js telt alleen `o.paid`, en /api/supplier/refund zet die
     op false. De verkoop VERDWIJNT dus uit de maand waarin hij plaatsvond --
     ook als de terugstorting in een andere maand valt, en ook nadat de aangifte
     over die maand al is gedaan. Een boekhouding waarin het verleden beweegt,
     is geen boekhouding.

     Deze storing meet wat er gebeurt en oordeelt niet: 'gebroken' zou zeggen
     dat de route stuk is, en dat is hij niet -- hij doet precies wat er staat.
     De bevinding gaat over de VORM (wissen tegenover tegenboeken) en dat is een
     besluit. Daarom staat hij apart in `bevindingen`. */
  const voorRefund = await omzetNu();
  const ref = await P('/api/supplier/refund', { ref: uit.ref }, w.A.S);
  const naRefund = await omzetNu();
  const bon = ((await P('/api/orders/mine', {}, w.L)).data.orders || []).find(o => o.ref === uit.ref) || {};
  /* DE VERKOOP BLIJFT STAAN, DE TERUGSTORTING KOMT ERNAAST. In deze proef vallen
     beide gebeurtenissen in dezelfde maand, dus netto hoort de omzet met precies
     het verkochte bedrag te dalen -- maar NIET doordat de verkoop verdween.
     Daarom worden allebei apart nagekeken: het bedrag EN de bon. */
  uit.refund = { voor: voorRefund, na: naRefund, status: ref.status,
    vorm: bon.refunded && bon.paid ? 'tegenboeking'
      : (bon.paid === false ? 'wissen' : 'onbekend'),
    verkoopBlijft: bon.paid === true, eigenDatum: !!bon.refundedAt,
    nettoEffect: euro(voorRefund - naRefund) };
  noteer('een betaalde bestelling terugstorten',
    'de verkoop blijft staan, de terugstorting krijgt een eigen datum, en netto daalt de maand met het bedrag',
    ref.status === 200 && bon.paid === true && bon.refunded === true && !!bon.refundedAt &&
      euro(voorRefund - naRefund) === BRUTO,
    'status ' + ref.status + ', omzet ' + voorRefund + ' -> ' + naRefund +
      ', verkoop blijft: ' + (bon.paid === true) + ', eigen datum: ' + !!bon.refundedAt);

  /* EN EEN TWEEDE TERUGSTORTING GAAT NIET. De grendel hing aan `paid`, en die
     blijft nu staan -- zonder een eigen grendel op `refunded` zou dezelfde bon
     twee keer geld terugsturen. Dit is de duurste bijwerking van de wijziging
     hierboven, dus hij wordt hier gemeten en niet aangenomen. */
  const nogmaalsTerug = await P('/api/supplier/refund', { ref: uit.ref }, w.A.S);
  const naTweede = await omzetNu();
  noteer('dezelfde bestelling een tweede keer terugstorten',
    'wordt geweigerd, en de maand beweegt geen cent',
    nogmaalsTerug.status === 409 && euro(naTweede) === euro(naRefund),
    'status ' + nogmaalsTerug.status + ' -- ' + ((nogmaalsTerug.data && nogmaalsTerug.data.error) || '') +
      ', omzet ' + naRefund + ' -> ' + naTweede);

  /* KAN ELK SCHERM DE WAARHEID NOG ZIEN? Dit is de prijs van de tegenboeking en
     hij wordt hier betaald in plaats van aangenomen. Voor de wijziging zei
     `paid === false` tegen ELKE lezer dat het geld weg was; nu blijft `paid`
     staan en moet elke lezer er `refunded` naast lezen. Een lezer die dat niet
     KAN -- omdat de projectie het veld niet stuurt -- toont een teruggestorte
     bon als betaald, en niets aan dat scherm kan dat repareren.

     Gevonden met scripts/refundmigratie.js: het kantoorscherm was zo'n lezer.
     /api/office/timeline stuurde `paid` en niet `refunded`, dus de tijdlijn zei
     "betaald" naast een status "terugbetaald". Daarom worden hier BEIDE
     projecties nagekeken -- die van de zaak en die van het kantoor -- en niet
     alleen de projectie van het lid (die staat in storing 2). */
  /* De zaakstand komt terug als `{ state: ... }` en niet plat. De eerste versie
     las `data.orders`, vond niets, en meldde `refunded undefined` -- wat er
     precies zo uitziet als een projectie die het veld niet stuurt. Een lege
     lezing is geen bevinding; daarom staat de bon-check hieronder apart. */
  const zaakStand = ((await P('/api/supplier/state', {}, w.A.S)).data || {}).state || {};
  const zaakBon = (zaakStand.orders || []).find(o => o.ref === uit.ref) || null;
  const kantoor = await P('/api/office/login', { code: KANTOOR });
  const tl = await P('/api/office/timeline', { q: uit.ref }, (kantoor.data || {}).token);
  const tlBon = (((tl.data || {}).items) || []).find(x => x.ref === uit.ref) || {};
  noteer('een teruggestorte bon opzoeken bij de zaak en bij het kantoor',
    'beide projecties dragen de terugstorting, zodat een scherm hem kan tonen',
    !!zaakBon && zaakBon.refunded === true && tlBon.teruggestort === true,
    (zaakBon ? 'zaak: paid ' + zaakBon.paid + ' / refunded ' + zaakBon.refunded
             : 'zaak: de bon staat niet in haar eigen stand') +
      ', kantoor: paid ' + tlBon.paid + ' / teruggestort ' + tlBon.teruggestort);

  /* 3. DE TENANT-NAAD (naad 6). Zaak B vraagt haar eigen cijfers op. De omzet
     van zaak A mag daar onder geen enkele omstandigheid in zitten -- en dit is
     de enige storing die met twee ECHTE zaken meet in plaats van met een
     verzonnen code. */
  const finB = await P('/api/supplier/finance', {}, w.B.S);
  const omzetB = omzetVan(finB.data || {});
  noteer('zaak B vraagt haar eigen maand op',
    'ziet geen cent van de omzet van zaak A',
    finB.status === 200 && euro(omzetB) === 0,
    'zaak B: ' + omzetB + ' (zaak A verkocht ' + BRUTO + ')');

  /* 4. DE VERKEERDE KOPER. Een tweede lid betaalt de bestelling van een ander.
     Het antwoord mag niet verraden dat de bestelling bestaat. */
  const best = await P('/api/order', { supplierCode: w.A.code, items: BESTELLING }, w.L);
  const ref2 = best.data && best.data.order && best.data.order.ref;
  const vreemd = await P('/api/order/pay', { ref: ref2 }, w.X);
  noteer('een ander lid betaalt jouw bestelling',
    'wordt geweigerd met een 404: de bestelling bestaat niet voor hem',
    vreemd.status === 404, 'status ' + vreemd.status + ' -- ' + ((vreemd.data && vreemd.data.error) || ''));

  /* 5. CATEGORIEWAARHEID IN DE TIJD (naad 3). De zaak haalt de koffie van de
     kaart. De verkoop van gisteren staat er nog, maar `catVanItem` zoekt het
     gerecht op NAAM in de HUIDIGE kaart -- en wat hij niet vindt, valt terug op
     de basiscategorie van de zaak.

     Dit is geen theorie: het is de omgekeerde vorm van de tijdwaarheid die het
     TARIEF wel heeft. Het percentage komt van de dag van de transactie, de
     categorie van vandaag. Een zaak die haar kaart verandert, verandert daarmee
     de btw-verdeling van een maand die al voorbij is. */
  const bestel3 = await P('/api/order', { supplierCode: w.A.code, items: [{ id: 'flatwhite', qty: 4 }] }, w.L);
  const ref3 = bestel3.data && bestel3.data.order && bestel3.data.order.ref;
  await P('/api/order/pay', { ref: ref3 }, w.L);
  const finVoor = (await P('/api/supplier/finance', {}, w.A.S)).data || {};
  const drankVoor = potVan(finVoor, 'drank');
  await P('/api/supplier/menu', { menu: KAART.filter(m => m.id !== 'flatwhite') }, w.A.S);
  const finNa = (await P('/api/supplier/finance', {}, w.A.S)).data || {};
  const drankNa = potVan(finNa, 'drank');
  const verschoven = euro(drankVoor ? drankVoor.omzet : 0) !== euro(drankNa ? drankNa.omzet : 0);
  uit.categorieVerschuiving = {
    voor: drankVoor ? { tarief: drankVoor.tarief, omzet: euro(drankVoor.omzet) } : null,
    na: drankNa ? { tarief: drankNa.tarief, omzet: euro(drankNa.omzet) } : null,
    verschoven,
    bevinding: verschoven
      ? 'Een gerecht van de kaart halen verplaatst de AL VERKOCHTE omzet naar een andere btw-pot. Het TARIEF is tijdgetrouw ' +
        '(regelbron.tariefOp leest de dag van de transactie), de CATEGORIE niet: catVanItem zoekt het gerecht op naam in de ' +
        'kaart van VANDAAG en valt bij een treffer-loze zoektocht terug op de basiscategorie van de zaak. De verkoopregel ' +
        'draagt zijn eigen categorie dus niet mee. Besluit van de eigenaar: de categorie bevriezen op de bestelregel, ' +
        'zoals het bedrag dat al is.'
      : null };
  noteer('een verkocht gerecht van de kaart halen',
    'de btw-verdeling van wat AL verkocht is, beweegt niet meer',
    !verschoven,
    'drankpot ' + (drankVoor ? euro(drankVoor.omzet) : 0) + ' -> ' + (drankNa ? euro(drankNa.omzet) : 0));
  await P('/api/supplier/menu', { menu: KAART }, w.A.S);   // de kaart terugzetten

  /* 6. HALVE COMMIT (naad 5). Een teruggestorte bestelling opnieuw betalen. De
     grendel `o.paid` valt bij een terugstorting weg (die zet hem op false), dus
     zonder de tweede grendel zou dezelfde bon nog een keer omzet maken --
     punten erbij, factuur erbij, ingredienten nog eens afgeboekt. */
  const voor6 = await omzetNu();
  const nogmaals = await P('/api/order/pay', { ref: uit.ref }, w.L);
  const na6 = await omzetNu();
  noteer('een teruggestorte bestelling opnieuw betalen',
    'wordt geweigerd met de reden, en maakt geen tweede omzet',
    nogmaals.status === 409 && euro(voor6) === euro(na6),
    'status ' + nogmaals.status + ' -- ' + ((nogmaals.data && nogmaals.data.error) || '') + ', omzet ' + voor6 + ' -> ' + na6);

  /* 7. EEN MEDEWERKER LEEST DE BOEKEN. De maandcijfers van een zaak zijn
     management-werk; een gewone medewerker met een geldige zaaksessie hoort er
     niet bij te kunnen. Dit is geen rolproef in het klein: het is de vraag of
     de GELDkant een eigen grens draagt boven op de zaakgrens. */
  const geenSessie = await P('/api/supplier/finance', {}, null);
  noteer('de boeken opvragen zonder zaaksessie',
    'wordt geweigerd',
    geenSessie.status >= 400, 'status ' + geenSessie.status);

  /* 8. DE BESTELLING VAN EEN ANDERE ZAAK TERUGSTORTEN. Zaak B stort een bon van
     zaak A terug. Geld terugboeken uit de kas van een ander is de scherpste
     vorm van een tenant-lek. */
  const kruisRefund = await P('/api/supplier/refund', { ref: ref2 }, w.B.S);
  noteer('zaak B stort een bestelling van zaak A terug',
    'wordt geweigerd: die bon bestaat niet voor haar',
    kruisRefund.status === 404, 'status ' + kruisRefund.status + ' -- ' + ((kruisRefund.data && kruisRefund.data.error) || ''));
}

async function meet() {
  const uit = { stempel: new Date().toISOString().slice(0, 10),
    uitleg: 'Van consumentintentie tot het cijfer waar een ondernemer btw over afdraagt: bestelling, ' +
      'betaling, economische gebeurtenis, fiscale verdeling, ondernemersbeeld. Gemeten met twee echte ' +
      'zaken en twee echte leden, op een wegwerpserver.',
    grens: 'Geen browser en geen echte bank (kern/pay draait op de demo-rail). De proef kijkt naar EEN ' +
      'maand -- de huidige -- en dus niet naar periodeafsluiting, kwartaalaangifte of de weg naar de ' +
      'Belastingdienst. Hij meet EEN genre (restaurant, NL) en zegt niets over logies, vervoer of de ' +
      'buitenlandse tarieventabellen. En hij meet de PROJECTIE financeVoor: dat de zaak dit cijfer ziet, ' +
      'bewijst niet dat er een grootboekregel onder ligt. ' +
      'DE MAANDGRENS WORDT HIER NIET GEMETEN: verkoop en terugstorting vallen in deze proef in DEZELFDE ' +
      'maand, want de klok is tegen een draaiende server niet te verzetten. Dat de tegenboeking in de ' +
      'JUISTE maand landt wanneer zij in een andere valt, staat als unittoets in test/kern-fiscaal.test.js ' +
      '(financeVoor is daar een pure projectie over db.data) -- twee mutaties nagetrokken. ' +
      'EN ZIJ GELDT ALLEEN VOOR BESTELLINGEN: kern/fiscaal/index.js telt rides en boekingen nog op `paid` ' +
      'zonder tegenboeking, en hun annuleerweg zet die vlag nog op false. Die twee (plus tickets) gaan pas ' +
      'om met hun eigen gemeten lezerskaart: REFUNDMIGRATIE.json telt de lezers per collectie en houdt ze op ' +
      '`onbekend` tot iemand ze met de hand heeft ingedeeld.',
    genre: GENRE, bruto: BRUTO, schakels: [], storingen: [], ref: null };
  const srv = await start({ naam: 'omzetproef', gereed: 'ready',
    env: { NODE_ENV: 'test', RTG_DEMO: '1', OFFICE_CODE: KANTOOR } });
  try {
    const merk = String(Date.now()).slice(-6);
    const w = await wereld(srv.basis, merk);
    uit.zaken = { a: w.A.code, b: w.B.code };
    await loop(srv.basis, uit, w);
    await storingen(srv.basis, uit, w);
  } finally { srv.klaar(); }

  const t = { schakels: uit.schakels.length, gesloten: 0, open: 0, openBekend: 0, stuk: 0,
    storingen: uit.storingen.length, gehouden: 0, gebroken: 0 };
  for (const s of uit.schakels) t[s.stand]++;
  for (const s of uit.storingen) t[s.stand]++;
  uit.telling = t;
  uit.sluit = t.open === 0 && t.stuk === 0 && t.gebroken === 0 && t.openBekend === 0 && t.schakels >= 7;
  /* `gebroken` HOORT HIER, en hij stond er niet.

     Een gebroken storing is iets anders dan een bevinding: een bevinding is een
     besluit dat de eigenaar moet nemen (welke bron voor de btw-categorie, wissen
     of tegenboeken), een gebroken belofte is software die niet doet wat zij
     zegt. Zonder deze term was de eerste ronde van deze proef op nul gevallen
     terwijl storing 5 aantoonbaar brak -- en een poort die zijn eigen vondst
     laat passeren, is geen poort. */
  uit.sluitMetBevinding = t.open === 0 && t.stuk === 0 && t.gebroken === 0 && t.schakels >= 7;
  uit.bevindingen = uit.schakels.filter(s => s.stand === 'openBekend')
    .map(s => ({ schakel: s.nr, van: s.van, naar: s.naar, wat: s.wat, gemeten: s.ziet, reden: s.bekend }));
  if (uit.categorieVerschuiving && uit.categorieVerschuiving.bevinding)
    uit.bevindingen.push({ schakel: 'storing 5', van: 'zaak', naar: 'fiscus',
      wat: 'de kaart wijzigen verplaatst al verkochte omzet naar een andere btw-pot',
      gemeten: JSON.stringify(uit.categorieVerschuiving.voor) + ' -> ' + JSON.stringify(uit.categorieVerschuiving.na),
      reden: uit.categorieVerschuiving.bevinding });
  return uit;
}

function druk(u) {
  console.log('omzetproef: ' + u.telling.schakels + ' schakels (' + u.telling.gesloten + ' gesloten, ' +
    u.telling.openBekend + ' open met reden, ' + u.telling.open + ' open, ' + u.telling.stuk + ' stuk), ' +
    u.telling.storingen + ' storingen (' + u.telling.gehouden + ' gehouden, ' + u.telling.gebroken + ' gebroken).');
  for (const s of u.schakels)
    console.log('  ' + String(s.nr).padStart(2) + ' ' + (s.van + '->' + s.naar).padEnd(22) +
      s.stand.padEnd(11) + s.wat + (s.ziet ? '\n      ziet: ' + s.ziet : '') +
      (s.bekend ? '\n      BEVINDING: ' + s.bekend : '') +
      (s.antwoord ? '\n      antwoord: ' + s.antwoord : '') + (s.fout ? '\n      FOUT: ' + s.fout : ''));
  for (const s of u.storingen)
    console.log('  -- ' + s.stand.padEnd(9) + s.naam + '\n      belooft: ' + s.belofte + '\n      gaf: ' + s.wat);
  for (const b of u.bevindingen.filter(x => typeof x.schakel === 'string'))
    console.log('\n  BEVINDING (' + b.schakel + '): ' + b.wat + '\n      gemeten: ' + b.gemeten + '\n      ' + b.reden);
  console.log(u.sluit ? '\nDe keten sluit.'
    : u.sluitMetBevinding ? '\nDe keten loopt door, met ' + u.bevindingen.length + ' bevinding(en) die een besluit vragen.'
      : '\nDE KETEN SLUIT NIET.');
}

module.exports = { meet, DOEL, GENRE, BRUTO };

if (require.main === module) {
  meet().then(u => {
    if (process.argv.includes('--json')) { console.log(JSON.stringify(u)); process.exitCode = u.sluitMetBevinding ? 0 : 1; return; }
    druk(u);
    if (process.argv.includes('--vastleggen')) {
      fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
      console.log('geschreven: OMZETPROEF.json');
    }
    process.exit(u.sluitMetBevinding ? 0 : 1);
  }).catch(e => { console.error('de omzetproef kon niet draaien: ' + (e && e.message || e)); process.exit(1); });
}
