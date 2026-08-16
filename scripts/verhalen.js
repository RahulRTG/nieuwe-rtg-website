#!/usr/bin/env node
/* ============================================================================
   GOEDE VERHALEN -- gewone mensen die gewone dingen doen, terwijl het stormt.

   WAAROM DIT ERBIJ MOEST

   De Beproeving en Tot-Crash bestoken elk endpoint met rommel en kijken of er
   iets breekt. Dat is een sterke test, maar hij beantwoordt maar de helft van
   de vraag. Een server die op ELK verzoek "400 nee" antwoordt haalt een
   chaostest met vlag en wimpel: nul serverfouten, nul rol-lekken, keurige
   latentie. En hij is volledig kapot.

   Wat de chaos niet ziet is of het huis onder die druk nog WERKT. Daarom draait
   dit harnas ernaast: een handvol volledige, logische verhalen van echte
   mensen -- iemand wordt lid, bestelt twee kommen ramen, betaalt, de keuken
   ziet het en zet het door, iemand vraagt een rit aan, gaat onderweg, komt aan,
   twee leden verbinden zich, en het geld klopt op de cent. Elke stap is een
   harde bewering. Zakt er een, dan is dat geen ruis maar een klant die
   vastliep.

   DRIE UITKOMSTEN, NIET TWEE. Dat is de kern van dit script:

     GELUKT     het verhaal liep van begin tot eind, alles klopte.
     AFGEWEZEN  de deur zei 503 of 429. Dat is een deur die DICHT is, niet een
                deur die stuk is: last die bewust wordt afgeworpen, een functie
                die uitstaat, een snelheidslimiet, of een zekering die eruit
                gesprongen is. Gezond gedrag -- maar wel een klant die niets
                kreeg. Het telt dus apart, mét de reden die de server zelf
                meegeeft, en het wordt nooit stilzwijgend weggestreept.
     GEFAALD    een stap gaf een ander antwoord dan hij hoort te geven. Dit is
                het enige wat als fout telt, en het is een harde fout.

   DE IJKING DIE ERBIJ HOORT. Een verhaal dat tijdens de storm faalt bewijst
   alleen iets als datzelfde verhaal in RUST wel loopt. Draait dit harnas als
   module, dan doet het daarom eerst een kalme ronde: faalt een verhaal daar al,
   dan is het verhaal stuk en niet de server, en dat staat er dan ook zo bij.

   WAT DIT NIET BEWIJST. Zeven verhalen zijn geen zeven-en-twintighonderd
   endpoints; dit is een dwarsdoorsnede van de paden waar geld, tijd en
   vertrouwen langskomen, niet een functionele dekking van het platform. En het
   loopt tegen de geseede demo-partners -- er wordt hier niets echt geboekt en
   er komt geen enkel echt hotel- of luchtvaartmerk aan te pas.

   Los draaien tegen een draaiende server:
       node scripts/verhalen.js [http://127.0.0.1:3000] [--rondes 3]
   Als module (zo gebruikt De Beproeving hem tijdens de storm):
       const { draaiRonde, bouwPodium } = require('./verhalen');
   ========================================================================== */
'use strict';
const http = require('http');
const crypto = require('crypto');

/* ---------- de deur ---------- */

const agent = new http.Agent({ keepAlive: true, maxSockets: 128 });

function maakDeur({ host, port, timeoutMs }) {
  return function vraag(method, pad, token, body) {
    const t0 = Date.now();
    return new Promise(resolve => {
      const data = method === 'GET' ? null : JSON.stringify(body === undefined ? {} : body);
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token;
      if (data) headers['Content-Length'] = Buffer.byteLength(data);
      let klaar = false;
      const af = (status, tekst) => {
        if (klaar) return;
        klaar = true;
        let d = null;
        try { d = tekst ? JSON.parse(tekst) : null; } catch (e) { d = null; }
        resolve({ status, data: d || {}, ms: Date.now() - t0 });
      };
      const req = http.request({ host, port, path: pad, method, headers, agent }, res => {
        let buf = '';
        res.setEncoding('utf8');
        res.on('data', c => { if (buf.length < 262144) buf += c; });
        res.on('end', () => af(res.statusCode, buf));
        res.on('error', () => af(res.statusCode, buf));
      });
      req.on('error', () => af(0, ''));
      req.setTimeout(timeoutMs || 15000, () => { req.destroy(); af(0, ''); });
      if (data) req.write(data);
      req.end();
    });
  };
}

/* ---------- de drie uitkomsten ---------- */

/* Een deur die dichtgaat omdat het te druk is, is iets anders dan een deur die
   het verkeerde doet. Twee soorten fouten, zodat het rapport ze nooit door
   elkaar haalt. */
class Afgewezen extends Error {
  constructor(stap, status, reden) {
    super('afgewezen bij "' + stap + '" (' + status + ')');
    this.afgewezen = true;
    this.stap = stap;
    this.status = status;
    /* De reden die de server zelf meegeeft. Die is hier goud waard: een 503 kan
       De Wacht zijn die last afwerpt, maar net zo goed een gesprongen zekering
       (de automatische noodrem in server/beveiliging.js zet bij aanhoudende
       brute force de registratie eraf) of een functie die uitstaat. Dat zijn
       drie totaal verschillende verhalen, en ze raden in plaats van ze aflezen
       is precies hoe een rapport onwaar wordt. */
    this.reden = reden || '';
  }
}
class Gefaald extends Error {
  constructor(stap, tekst) { super(stap + ': ' + tekst); this.stap = stap; }
}

/* De werkbank die elk verhaal krijgt. `stap()` doet een verzoek en rekent het
   meteen af: 503/429 is afwijzing, alles anders dan verwacht is een fout.
   Zo staat in elk verhaal alleen nog het verhaal zelf. */
function werkbank(vraag) {
  const wb = {
    async stap(naam, method, pad, token, body, verwacht) {
      const r = await vraag(method, pad, token, body);
      if (r.status === 503 || r.status === 429) throw new Afgewezen(naam, r.status, (r.data && r.data.error) || '');
      if (r.status === 0) throw new Gefaald(naam, 'geen antwoord (timeout of verbroken verbinding)');
      const goed = verwacht === undefined ? (r.status >= 200 && r.status < 300)
        : (Array.isArray(verwacht) ? verwacht.includes(r.status) : r.status === verwacht);
      if (!goed) {
        throw new Gefaald(naam, 'status ' + r.status + (verwacht !== undefined ? ' (verwacht ' + verwacht + ')' : '')
          + ' -- ' + JSON.stringify(r.data).slice(0, 160));
      }
      return r;
    },
    eis(naam, waar, tekst) { if (!waar) throw new Gefaald(naam, tekst); },
    /* Sommige dingen zijn pas een paar tellen later waar: de gids wordt na de
       registratie bijgewerkt, de write-behind spoelt naar Postgres. Wachten op
       een toestand is dus eerlijk -- maar met een grens, want oneindig wachten
       tot het klopt is geen bewering meer. */
    async tot(naam, doe, klopt, { pogingen = 30, wacht = 200 } = {}) {
      let laatste = null;
      for (let i = 0; i < pogingen; i++) {
        laatste = await doe();
        if (klopt(laatste)) return laatste;
        await new Promise(r => setTimeout(r, wacht));
      }
      throw new Gefaald(naam, 'bleef binnen ' + Math.round((pogingen * wacht) / 1000) + ' s onwaar');
    }
  };
  return wb;
}

/* ---------- het podium ---------- */

let teller = 0;
const uniek = () => crypto.randomBytes(8).toString('hex') + '-' + (++teller).toString(36);

/* Een vers lid. Gebruikt door bouwPodium (voor de vaste ploeg) en door de twee
   verhalen die echt een nieuw mens nodig hebben. */
async function nieuwLid(wb, tier) {
  const u = uniek();
  const reg = await wb.stap('lid worden', 'POST', '/api/auth/register', null, {
    name: 'Verhaal ' + u, email: 'v' + u + '@verhalen.test', phone: '06' + String(crypto.randomInt(10000000, 90000000)),
    password: 'Geheim' + u + '!', geboortedatum: '1990-01-01', tier: tier || 'rtg', pasApp: tier || 'rtg'
  });
  wb.eis('lid worden', reg.data.token, 'registratie gaf geen token');
  const token = reg.data.token;
  const st = await wb.tot('sessie lost op', () => wb.stap('sessie', 'POST', '/api/state', token, {}),
    r => r.data && r.data.state && r.data.state.user);
  return { token, codenaam: st.data.state.user.codename, key: st.data.state.user.key || null };
}

/* Het ene gerecht waar de bestelverhalen op rekenen. Op een plek, want de kaart
   wordt op twee momenten gezet: bij het bouwen van het podium en aan het begin
   van elke ronde (zie draaiRonde -- een storm die de kaart omvergooit hoort de
   verhalen niet te laten "falen" aan iets wat de storm zelf heeft gesloopt). */
const KAART = [{ id: 'verhaal-ramen', name: 'Tonkotsu Ramen', price: 22, cat: 'Warm', station: 'keuken', sectie: 'warm' }];

/* Het paspoort dat een gratis RTG-lid eenmalig laat zien voor zijn eerste
   betaalmoment. Een echte (piepkleine) PNG, want de verificatie kijkt naar het
   beeld en niet naar de belofte dat er een beeld is. */
const KYC_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
// de standen waarmee RTG Pay opengaat (kern/onboarding/lid.js, payGate)
const GEVERIFIEERD = ['pending', 'approved', 'geverifieerd', 'verified'];

/* Het decor: de partner waar besteld wordt, met een gerecht dat wij zelf op de
   kaart zetten zodat het bedrag voorspelbaar is, en een vervoerspartner uit de
   seed. Dit gebeurt EEN keer, voor de storm -- niet in elke ronde opnieuw.

   EN EEN VASTE PLOEG LEDEN. Dat is niet uit zuinigheid. Draait dit harnas naast
   een storm, dan ziet die storm eruit als een aanval -- hij beukt met rommel op
   de inlogpaden -- en de automatische noodrem (server/beveiliging.js) haalt dan
   binnen enkele seconden de REGISTRATIEZEKERING eruit. Dat is precies het
   gedrag dat je wilt. Maar zou elk verhaal beginnen met "iemand wordt lid", dan
   strandt vanaf dat moment ALLES bij stap 1 en meet je nog maar een ding: dat
   de voordeur dicht zit. De leden die al binnen zijn moeten gewoon door kunnen,
   en juist DAT hoort een noodrem te beschermen. Vandaar deze ploeg, die vooraf
   naar binnen loopt. De twee verhalen die echt een nieuw mens nodig hebben
   (lid worden, en twee vreemden die elkaar vinden) blijven vers registreren en
   melden zich netjes als afgewezen zodra de zekering eruit ligt. */
async function bouwPodium(vraag) {
  const wb = werkbank(vraag);
  const inlog = await wb.stap('partner inloggen', 'POST', '/api/supplier/login', null, { username: 'rahul', password: 'Imran' });
  wb.eis('partner inloggen', inlog.data.token, 'de demo-partner gaf geen token');
  const sup = inlog.data.token;
  const st = await wb.stap('partner-stand', 'POST', '/api/supplier/state', sup, {});
  const code = st.data.state.supplier.code;
  await wb.stap('de kaart zetten', 'POST', '/api/supplier/menu', sup, { menu: KAART });
  const kantoor = await wb.stap('kantoor inloggen', 'POST', '/api/office/login', null, { code: 'RTG-OFFICE' });
  const partners = (await wb.stap('partnerlijst', 'POST', '/api/office/state', kantoor.data.token, {})).data.state.suppliers || [];
  const vervoer = partners.find(s => (s.caps || []).includes('rides'));

  // de vaste ploeg: vier leden die al binnen zijn, met hun paspoort getoond
  const ploeg = {};
  for (const naam of ['klant', 'gast', 'beursA', 'beursB']) {
    ploeg[naam] = await nieuwLid(wb);
    await wb.stap('paspoort tonen', 'POST', '/api/verify/upload', ploeg[naam].token, { image: KYC_PNG });
    /* En meteen nakijken of het ook AANKWAM. Een upload die 200 teruggeeft maar
       niet blijft staan, laat het geld-verhaal even verderop stuklopen op een
       403 die dan uit de lucht lijkt te vallen -- dat is precies gebeurd, en ik
       heb er een half uur naar zitten raden. Een podium hoort zijn eigen
       voorwaarde te bewijzen, niet aan te nemen. */
    const st = await wb.stap('paspoortstand', 'POST', '/api/verify/status', ploeg[naam].token, {});
    wb.eis('paspoortstand', GEVERIFIEERD.includes(st.data.status),
      'het paspoort van ' + naam + ' staat na de upload op "' + st.data.status + '" in plaats van "pending"');
  }
  return { supToken: sup, supCode: code, vervoerCode: vervoer ? vervoer.code : null, prijs: 22, ploeg };
}

/* ---------- de verhalen ---------- */

const VERHALEN = [
  {
    id: 'nieuw-lid',
    naam: 'iemand wordt lid en zijn pas staat klaar',
    /* Dit verhaal registreert met opzet VERS: het gaat over de voordeur zelf.
       Ligt de registratiezekering eruit, dan hoort dit verhaal afgewezen te
       worden -- en dat is dan geen storing maar het antwoord. */
    async doe(wb) {
      const lid = await nieuwLid(wb);
      wb.eis('codenaam', lid.codenaam, 'een nieuw lid hoort meteen een codenaam te hebben');
      /* Privacy by design: wat het lid van zichzelf terugkrijgt draait op de
         codenaam. Zijn echte naam hoort in de kluis te blijven, ook hier. */
      const bord = await wb.stap('het bord openen', 'POST', '/api/member/boardroom', lid.token, {});
      wb.eis('het bord openen', bord.data.bord && Array.isArray(bord.data.bord.categorieen),
        'het schakelbord kwam leeg terug');
    }
  },
  {
    id: 'bestellen-en-betalen',
    naam: 'twee kommen ramen: besteld, betaald, en precies een keer afgeschreven',
    async doe(wb, p) {
      const lid = p.ploeg.klant;
      const best = await wb.stap('bestellen', 'POST', '/api/order', lid.token,
        { supplierCode: p.supCode, items: [{ id: 'verhaal-ramen', qty: 2 }] });
      const order = best.data.order;
      wb.eis('het bedrag', order && order.total === p.prijs * 2,
        'twee maal ' + p.prijs + ' hoort ' + p.prijs * 2 + ' te zijn, werd ' + (order && order.total));
      const betaal = await wb.stap('betalen', 'POST', '/api/order/pay', lid.token, { ref: order.ref });
      wb.eis('betalen', betaal.data.order && betaal.data.order.paid === true, 'de bestelling staat niet op betaald');
      /* Dezelfde knop nog een keer. Een tweede afschrijving voor dezelfde
         bestelling is de duurste bug die een kassasysteem kan hebben, en onder
         druk is precies het moment waarop hij zich laat zien. */
      const nog = await wb.stap('nog een keer betalen', 'POST', '/api/order/pay', lid.token, { ref: order.ref }, [409, 400]);
      wb.eis('nog een keer betalen', nog.status === 409 || nog.status === 400,
        'een tweede betaling voor dezelfde bestelling werd niet geweigerd');
      return { ref: order.ref, lid };
    }
  },
  {
    id: 'keuken-zet-door',
    naam: 'de keuken ziet de bestelling en zet hem door',
    async doe(wb, p) {
      const lid = p.ploeg.gast;
      const best = await wb.stap('bestellen', 'POST', '/api/order', lid.token,
        { supplierCode: p.supCode, items: [{ id: 'verhaal-ramen', qty: 1 }] });
      const ref = best.data.order.ref;
      if (best.data.order.status === 'wacht-op-betaling') await wb.stap('betalen', 'POST', '/api/order/pay', lid.token, { ref });
      await wb.tot('de keuken ziet hem',
        () => wb.stap('keukenstand', 'POST', '/api/supplier/state', p.supToken, {}),
        r => (r.data.state.orders || []).some(o => o.ref === ref));
      await wb.stap('in bereiding zetten', 'POST', '/api/supplier/order/status', p.supToken, { ref, status: 'in bereiding' });
      /* En het lid ziet het terug. Zonder deze stap toetsen we alleen dat de
         keuken op een knop mag drukken, niet dat er iets van aankomt. */
      const mijn = await wb.tot('het lid ziet de nieuwe status',
        () => wb.stap('mijn bestellingen', 'POST', '/api/orders/mine', lid.token, {}),
        r => (r.data.orders || []).some(o => o.ref === ref && /bereiding/i.test(o.status || '')));
      wb.eis('het lid ziet de nieuwe status', mijn, 'de statuswijziging bereikte het lid niet');
    }
  },
  {
    id: 'rit-aanvragen',
    naam: 'een rit aanvragen bij een vervoerspartner en betalen',
    overslaanAls: p => !p.vervoerCode && 'geen vervoerspartner in de seed',
    async doe(wb, p) {
      const lid = p.ploeg.klant;
      const rit = await wb.stap('rit aanvragen', 'POST', '/api/ride/request', lid.token,
        { supplierCode: p.vervoerCode, passengers: 2 });
      const r = rit.data.ride;
      wb.eis('rit aanvragen', r && r.ref, 'de ritaanvraag kwam zonder kenmerk terug');
      if (r.status === 'wacht-op-betaling') {
        const b = await wb.stap('rit betalen', 'POST', '/api/ride/pay', lid.token, { ref: r.ref });
        wb.eis('rit betalen', b.data.ride && b.data.ride.paid === true, 'de rit staat niet op betaald');
      } else {
        wb.eis('rit aanvragen', r.status === 'aangevraagd',
          'een rit zonder vooruitbetaling hoort op "aangevraagd" te staan, stond op "' + r.status + '"');
      }
    }
  },
  {
    id: 'onderweg-en-aankomen',
    naam: 'onderweg naar de zaak, en aankomen op de stoep',
    async doe(wb, p) {
      const lid = p.ploeg.gast;
      const start = await wb.stap('onderweg gaan', 'POST', '/api/live/start', lid.token, { destCode: p.supCode });
      wb.eis('onderweg gaan', start.data.live && start.data.live.active === true, 'onderweg werd niet actief');
      const bestemming = start.data.live.dest
        || (start.data.live.partners || []).find(x => x.code === p.supCode);
      wb.eis('de bestemming', bestemming && bestemming.loc, 'de bestemming heeft geen locatie');
      /* EERST NOG NIET. De aankomst hoort uit de AFSTAND te volgen en niet uit
         het feit dat je een positie doorgeeft. Een halve graad noorderbreedte is
         ruim vijftig kilometer; wie daar staat is niet aangekomen. Zonder deze
         eerste stap zou een grens van honderd kilometer hier groen blijven, want
         de tweede stap (precies op de stoep, afstand nul) slaagt bij elke grens
         die groter is dan nul. */
      const ver = await wb.stap('nog onderweg', 'POST', '/api/live/update', lid.token,
        { lat: bestemming.loc.lat + 0.5, lng: bestemming.loc.lng });
      wb.eis('nog onderweg', !(ver.data.live && ver.data.live.arrived),
        'vijftig kilometer verderop gold al als aangekomen');

      // en dan precies op de stoep
      const upd = await wb.stap('aankomen', 'POST', '/api/live/update', lid.token,
        { lat: bestemming.loc.lat, lng: bestemming.loc.lng });
      wb.eis('aankomen', upd.data.live && upd.data.live.arrived === true,
        'op de bestemming staan leverde geen aankomst op');
    }
  },
  {
    id: 'twee-leden-verbinden',
    naam: 'twee leden vinden elkaar op codenaam en verbinden zich',
    /* Ook dit verhaal registreert vers, en dat moet: een verzoek versturen kan
       maar een keer tussen dezelfde twee mensen. Met een vaste ploeg zou de
       tweede ronde op "al verbonden" stuklopen en zou ik de bewering moeten
       verwateren tot "200 of 409" -- en dan toetst hij niets meer. */
    async doe(wb) {
      const [x, y] = [await nieuwLid(wb), await nieuwLid(wb)];
      const treffers = await wb.tot('X vindt Y',
        () => wb.stap('zoeken', 'POST', '/api/member/find', x.token, { q: y.codenaam }),
        r => (r.data.results || []).some(t => t.codename === y.codenaam));
      const yTreffer = (treffers.data.results || []).find(t => t.codename === y.codenaam);
      /* Wat er bij het zoeken WEL en NIET terugkomt is een merkregel, geen
         detail: je vindt elkaar op de codenaam, en de kluis blijft dicht. */
      wb.eis('de gids toont geen echte naam', !yTreffer.naam && !yTreffer.email && !yTreffer.name,
        'de ledengids gaf meer terug dan een codenaam: ' + Object.keys(yTreffer).join(', '));
      await wb.stap('verzoek sturen', 'POST', '/api/member/connect', x.token, { key: yTreffer.key });
      const terug = await wb.tot('Y vindt X',
        () => wb.stap('zoeken', 'POST', '/api/member/find', y.token, { q: x.codenaam }),
        r => (r.data.results || []).some(t => t.codename === x.codenaam));
      const xTreffer = (terug.data.results || []).find(t => t.codename === x.codenaam);
      await wb.stap('verzoek aannemen', 'POST', '/api/member/connect/respond', y.token, { key: xTreffer.key, action: 'accept' });
    }
  },
  {
    id: 'portemonnee-klopt',
    naam: 'geld tussen twee leden: op de cent, en nooit dubbel',
    async doe(wb, p) {
      /* Twee vaste beursjes. Hun paspoort is bij het bouwen van het podium al
         getoond -- zonder die stap zou dit verhaal de KYC-poort toetsen in
         plaats van het geld, en dan slaagt het op 0 -> 0 vanzelf. */
      const a = p.ploeg.beursA, b = p.ploeg.beursB;
      /* De poort van RTG Pay staat of valt met deze stand. Hem hier nog een keer
         aflezen kost een verzoek en scheelt straks een raadsel: een 403 verderop
         betekent dan "het paspoort is ONDERWEG kwijtgeraakt" en niet "er is iets
         met het geld". */
      for (const [naam, lid] of [['A', a], ['B', b]]) {
        const st = await wb.stap('paspoortstand', 'POST', '/api/verify/status', lid.token, {});
        wb.eis('paspoortstand', GEVERIFIEERD.includes(st.data.status),
          'het paspoort van ' + naam + ' staat op "' + st.data.status + '"; RTG Pay laat dan niets toe');
      }
      const saldo = async t => (await wb.stap('saldo', 'POST', '/api/pay/overzicht', t, {})).data;
      const bOverzicht = await saldo(b.token);
      wb.eis('de portemonnee', typeof bOverzicht.saldo === 'number' && bOverzicht.codenaam,
        'de portemonnee van B is onbereikbaar');

      const idem = 'verhaal-oplaad-' + uniek();
      await wb.stap('opladen', 'POST', '/api/pay/oplaad', a.token, { centen: 200000, idem });
      const naEen = (await saldo(a.token)).saldo;
      await wb.stap('nog een keer opladen met dezelfde sleutel', 'POST', '/api/pay/oplaad', a.token, { centen: 200000, idem });
      const naTwee = (await saldo(a.token)).saldo;
      wb.eis('idempotente oplaad', naEen === naTwee,
        'dezelfde oplaadsleutel boekte twee keer (' + naEen + ' -> ' + naTwee + ')');

      const voorA = (await saldo(a.token)).saldo, voorB = (await saldo(b.token)).saldo;
      for (let i = 0; i < 5; i++)
        await wb.stap('sturen', 'POST', '/api/pay/stuur', a.token,
          { aan: bOverzicht.codenaam, centen: 1000, oms: 'verhaal', idem: 'verhaal-stuur-' + uniek() });
      const naA = (await saldo(a.token)).saldo, naB = (await saldo(b.token)).saldo;
      wb.eis('centen blijven bestaan', voorA + voorB === naA + naB,
        'er lekten centen weg: ' + (voorA + voorB) + ' -> ' + (naA + naB));
      wb.eis('B ontving exact', naB - voorB === 5000, 'B ontving ' + (naB - voorB) + ' in plaats van 5000 centen');
      wb.eis('A betaalde exact', voorA - naA === 5000, 'A betaalde ' + (voorA - naA) + ' in plaats van 5000 centen');
    }
  }
];

/* ---------- de ronde ---------- */

function versRapport() {
  const uit = new Map();
  for (const v of VERHALEN) uit.set(v.id, {
    id: v.id, naam: v.naam, gelukt: 0, afgewezen: 0, af429: 0, af503: 0,
    gefaald: 0, overgeslagen: 0, ms: [], fouten: [], deuren: new Map(), redenen: new Map()
  });
  return uit;
}

/* Een ronde: elk verhaal een keer, van begin tot eind. Ze draaien na elkaar en
   niet door elkaar, zodat een gefaald verhaal aan de server ligt en niet aan
   een ander verhaal. De gelijktijdigheid komt van de storm ernaast -- die
   hoeven we hier niet na te bootsen. */
async function draaiRonde(vraag, podium, rapport) {
  const wb = werkbank(vraag);
  /* De kaart terugzetten voor we beginnen. Draait dit harnas naast een storm,
     dan fuzzt die storm ook /api/supplier/menu met een geldig partner-token en
     kan hij het gerecht onder de bestelverhalen vandaan trekken. Een verhaal
     dat daarop stukloopt zou een fout melden die de test zelf heeft gemaakt, en
     dat is precies het soort onwaarheid waar dit script tegen bedoeld is.
     Lukt het terugzetten niet, dan zeggen de verhalen het zelf wel. */
  if (podium.supToken) {
    try { await wb.stap('de kaart terugzetten', 'POST', '/api/supplier/menu', podium.supToken, { menu: KAART }); }
    catch (e) { /* de storm mag deze deur dichthouden */ }
  }
  for (const v of VERHALEN) {
    const r = rapport.get(v.id);
    const reden = v.overslaanAls && v.overslaanAls(podium);
    if (reden) { r.overgeslagen++; if (!r.redenOverslaan) r.redenOverslaan = reden; continue; }
    const t0 = Date.now();
    try {
      await v.doe(wb, podium);
      r.gelukt++;
      r.ms.push(Date.now() - t0);
    } catch (e) {
      if (e && e.afgewezen) {
        /* 429 en 503 zijn allebei "nee", maar ze betekenen iets heel anders, en
           ze bij elkaar optellen zou de meting onleesbaar maken:
             429  de snelheidslimiet, en die telt PER IP. Draait dit harnas naast
                  een storm, dan komen storm en verhalen van hetzelfde adres en
                  delen ze dus een emmer. Dat is een eigenschap van de opstelling
                  en niet van productie, waar klanten uit de hele stad komen.
             503  een deur die dicht is: De Wacht die last afwerpt, een functie die
                  uitstaat, of een gesprongen zekering. DAT is
                  het antwoord dat een echte klant ook zou krijgen.
           Daarom worden ze apart geteld, en houden we bij WAAR de deur dichtging:
           een storm die altijd op dezelfde stap blokkeert wijst iets anders aan
           dan een storm die overal wat wegneemt. */
        r.afgewezen++;
        if (e.status === 429) r.af429++; else r.af503++;
        r.deuren.set(e.stap, (r.deuren.get(e.stap) || 0) + 1);
        if (e.reden) r.redenen.set(e.reden, (r.redenen.get(e.reden) || 0) + 1);
      } else {
        r.gefaald++;
        const tekst = (e && e.message) || String(e);
        if (r.fouten.length < 5 && !r.fouten.includes(tekst)) r.fouten.push(tekst);
      }
    }
  }
  return rapport;
}

/* ---------- het rapport ---------- */

const K = { rood: '\x1b[31m', groen: '\x1b[32m', geel: '\x1b[33m', grijs: '\x1b[2m', reset: '\x1b[0m' };

function schrijfRapport(rapport, titel) {
  console.log('\n\x1b[1m' + titel + '\x1b[0m');
  for (const r of rapport.values()) {
    if (r.overgeslagen && !r.gelukt && !r.gefaald) {
      console.log('  ' + K.grijs + 'OVERGESLAGEN' + K.reset + '  ' + r.naam + ' ' + K.grijs + '(' + r.redenOverslaan + ')' + K.reset);
      continue;
    }
    const med = r.ms.length ? r.ms.slice().sort((a, b) => a - b)[Math.floor(r.ms.length / 2)] : null;
    const merk = r.gefaald ? K.rood + 'GEFAALD' + K.reset : (r.afgewezen ? K.geel + 'AFGEWEZEN' + K.reset : K.groen + 'GELUKT' + K.reset);
    console.log('  ' + merk.padEnd(20) + r.naam);
    console.log('      ' + K.grijs + r.gelukt + 'x gelukt, ' + r.afgewezen + 'x afgewezen ('
      + r.af429 + 'x snelheidslimiet, ' + r.af503 + 'x dicht), '
      + r.gefaald + 'x gefaald' + (med != null ? ', mediaan ' + med + ' ms' : '') + K.reset);
    const deur = [...r.deuren.entries()].sort((a, b) => b[1] - a[1])[0];
    const reden = [...r.redenen.entries()].sort((a, b) => b[1] - a[1])[0];
    if (deur) console.log('      ' + K.grijs + 'meest gesloten deur: "' + deur[0] + '" (' + deur[1] + 'x)'
      + (reden ? ' -- de server zegt: "' + reden[0].slice(0, 90) + '"' : '') + K.reset);
    for (const f of r.fouten) console.log('      ' + K.rood + f.slice(0, 200) + K.reset);
  }
  const tel = veld => [...rapport.values()].reduce((n, r) => n + r[veld], 0);
  return { gelukt: tel('gelukt'), afgewezen: tel('afgewezen'), af429: tel('af429'), af503: tel('af503'), gefaald: tel('gefaald') };
}

/* ---------- los draaien ---------- */

async function main() {
  const url = process.argv.find(a => /^https?:\/\//.test(a)) || 'http://127.0.0.1:3000';
  const ix = process.argv.indexOf('--rondes');
  const rondes = ix > 0 ? Number(process.argv[ix + 1]) || 1 : 1;
  const u = new URL(url);
  const vraag = maakDeur({ host: u.hostname, port: Number(u.port || 80) });

  console.log('\n\x1b[1mGOEDE VERHALEN\x1b[0m ' + K.grijs + url + ' - ' + rondes + ' ronde(n)' + K.reset);
  let podium;
  try { podium = await bouwPodium(vraag); } catch (e) {
    console.log('\n  ' + K.rood + 'het podium kwam niet klaar: ' + e.message + K.reset);
    console.log('  ' + K.grijs + 'draait de server op ' + url + '?' + K.reset + '\n');
    return 1;
  }
  const rapport = versRapport();
  for (let i = 0; i < rondes; i++) await draaiRonde(vraag, podium, rapport);
  const som = schrijfRapport(rapport, 'DE UITKOMST');
  console.log('\n  ' + som.gelukt + ' gelukt, ' + som.afgewezen + ' afgewezen ('
    + som.af429 + ' snelheidslimiet, ' + som.af503 + ' dicht), ' + som.gefaald + ' gefaald.');
  console.log('  ' + K.grijs + 'Afgewezen is geen fout: dat is een deur die dichtgaat, geen deur die stuk is. Gefaald wel.' + K.reset + '\n');
  return som.gefaald === 0 ? 0 : 1;
}

module.exports = { bouwPodium, draaiRonde, versRapport, schrijfRapport, maakDeur, VERHALEN };

if (require.main === module) main().then(c => { process.exitCode = c; });
