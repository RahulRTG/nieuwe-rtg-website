/* ============================================================================
   DE OPBOUW VAN DE IDOR-PROEF -- A maakt echte objecten, langs de echte routes.

   WAAROM. De oogstgang raakt elke route een keer aan met een plausibel lijf
   (scripts/lib/rolproef.js plausibelLijf). Op ruim de helft van de ledenroutes
   is dat niet genoeg om iets te MAKEN: een pot vraagt een geldig doel, een
   lijstje een vriend, een gesprek een tegenpartij, een spel een bekende naam.
   Gemeten (19 oktober 2026, BEVOEGD.json): 258 routes van de ledenschermen bleven
   ongesteld omdat A in dat domein niets bezat. Dan heeft B ook niets om op los te
   laten, en zegt de proef daar niets -- eerlijk, maar leeg.

   WAT DIT IS. Drie tabellen, en geen ervan verzint een uitkomst:

     LIJVEN    per route een geldig basislijf (veldnamen en waarden die de
               validatie doorlaten). A, B en de controle C sturen het allemaal.
               Een veld op `undefined` valt uit het lijf: zo MAAKT de oogstgang
               een pot in plaats van een niet-bestaande bij te werken.
     VAN_A     per route de velden die naar een object van A WIJZEN en die de
               objectpool niet kent (een IBAN is geen id-veld, een aanbeveling
               deelt haar `id` met de rol in hetzelfde domein). Ze komen uit de
               opbouw en worden NA het verrijken gezet, zodat B precies A's
               object noemt. Ze tellen als verrijkte velden.
     stappen() een korte reeks echte verzoeken die A NA de oogstgang doet om
               objecten te maken. Wat terugkomt, gaat de pool en de merktekens
               in -- precies zoals elk ander antwoord van A.

   DE TEGENPARTIJ IS C, NOOIT B. Waar een object een tweede lid vraagt (een
   gesprek, een kring, een lijstje met een vriend), is dat de controle C. Was het
   B, dan mocht B het object rechtmatig zien en meet de proef niets. Een stap met
   `als: 'tegen'` doet C; `als: 'kantoor'` is de inrichting van de wereld die een
   lid niet kan doen (de leden-bank live zetten), met de kantoorcode van deze
   wegwerpserver -- dezelfde ijking als gang 3 met de eigenaar.

   WAT DIT NIET DOET: een object van A rechtstreeks in de opslag zetten. Alles
   gaat langs de route die een lid ook gebruikt; een stap die faalt laat zijn
   routes eerlijk onbereikbaar, en de proef meldt welke stap faalde.

   De lijven komen uit de routecode en uit de voltooiscenario's
   (scripts/lib/voltooi/*.js); daar zijn ze in gebruik en gemeten.
   ========================================================================== */
'use strict';
const { randomUUID } = require('crypto');

const vandaag = () => new Date().toISOString().slice(0, 10);
const idem = () => randomUUID();

/* Zoek de eerste waarde in een antwoord: onder een sleutelnaam, of een string
   die op een patroon past. Voor de opbouw die een id moet onthouden. */
function zoek(data, { sleutel, patroon } = {}) {
  let uit;
  (function loop(v, d) {
    if (uit !== undefined || d > 6 || !v || typeof v !== 'object') return;
    for (const [k, w] of Object.entries(v)) {
      if (uit !== undefined) return;
      if (sleutel && k === sleutel && (typeof w === 'string' || typeof w === 'number')) { uit = w; return; }
      if (patroon && typeof w === 'string' && patroon.test(w)) { uit = w; return; }
      if (w && typeof w === 'object') loop(w, d + 1);
    }
  })(data, 0);
  return uit;
}

const LIJVEN = {
  /* RTG Geld (routes/geld.js): de /zet-routes MAKEN zonder id en werken bij met id. */
  '/api/geld/pot/zet': { id: undefined, naam: 'Vakantie', doelCenten: 50000 },
  '/api/geld/pot/reserveer': { centen: 1000 },
  '/api/geld/beleid/zet': { id: undefined, soort: 'maanddrempel', drempelCenten: 100000, niveau: 'kijken' },
  '/api/geld/grens/zet': { id: undefined, periode: 'maand', centen: 50000 },
  /* Wie betaalt wat (routes/wbw.js) */
  '/api/wbw/uitgave': { centen: 2500, oms: 'Eten' },
  '/api/wbw/verreken': () => ({ idem: idem() }),
  /* RTG Bank (routes/bank.js) */
  '/api/bank/rekening/open': () => ({ soort: 'spaar', naam: 'Spaar', idem: idem() }),
  '/api/bank/storten': () => ({ centen: 1000, route: 'auto', oms: 'proef', idem: idem() }),
  '/api/bank/overboek': () => ({ centen: 100, oms: 'proef', idem: idem() }),
  '/api/bank/naar-wallet': () => ({ centen: 100, idem: idem() }),
  '/api/bank/afschrift': { limit: 50, offset: 0 },
  '/api/bank/spaardoel': { euro: 1000 },
  '/api/bank/pas/uitgeven': () => ({ soort: 'debit', naam: 'Mijn pas', idem: idem() }),
  '/api/bank/advies': { vraag: 'Hoe spaar ik voor een reis?' },
  '/api/bank/hart': { limit: 60 },
  '/api/bank/inzichten': () => ({ maand: vandaag().slice(0, 7) }),
  /* RTG Pay en de wallet */
  '/api/pay/rekening': { iban: 'NL91ABNA0417164300', naam: 'Proef Rekening' },
  '/api/pay/oplaad': () => ({ centen: 1000, idem: idem() }),
  '/api/pay/terug': () => ({ centen: 100, idem: idem() }),
  '/api/pay/tegoed/roteer': () => ({ idem: idem() }),
  '/api/pay/tik': () => ({ centen: 100, oms: 'proef', idem: idem() }),
  '/api/wallet/munt/koop': () => ({ zaak: 'Festival Proef', aantal: 1, idem: idem() }),
  '/api/kosten/herkomst': { soort: 'opslag' },
  '/api/code/dyn': { soort: 'zegel', code: 'proefzegel1' },
  '/api/chat/send': { text: 'Hallo', lang: 'nl' },
  '/api/link/cap/maak': { handeling: 'geld.ontvangen', centen: 1000, oms: 'Lunch' },
  /* Metier (routes/member/metier.js) */
  '/api/metier/kaart': { kop: 'Sommelier', over: 'Twintig jaar wijn', plaats: 'Amsterdam' },
  '/api/metier/rol': { wat: 'Barman', waar: 'Cafe Proef' },
  '/api/metier/lijst': { veld: 'vaardigheden', waarden: ['sommelier'] },
  '/api/metier/loon': { land: 'NL' },
  '/api/metier/loon-toets': { vak: 'hotel', land: 'NL', uurloon: 18 },
  '/api/metier/ai/brief': { vacature: 'Sommelier gezocht voor een restaurant in Amsterdam.' },
  '/api/metier/ai/oefen': { rol: 'Sommelier' },
  '/api/metier/naam-vrij': { code: 'KIKUNOI', waarvoor: 'sollicitatie' },
  '/api/metier/naam-intrekken': { code: 'KIKUNOI' },
  /* Het loopbaanledger (routes/carriereledger.js) */
  '/api/carriere/ledger/zet': () => ({ kapitaal: 'vermogen', wat: 'Diploma sommelier gehaald', op: vandaag() }),
  '/api/carriere/ledger/intrek': { reden: 'verkeerde datum' },
  '/api/carriere/ledger/deel': { dagen: 7, voor: 'een opdrachtgever' },
  /* Veilig (routes/veiligheid.js) */
  '/api/veiligheid/kring/mail': { adres: 'kring-proef@voorbeeld.test' },
  '/api/veiligheid/plek': { lat: 52.37, lon: 4.89, lng: 4.89 },
  '/api/veiligheid/alarm': { proef: true },
  '/api/veiligheid/codewoord/zet': { zin: 'rode fiets bij de molen' },
  /* Overige identiteitsroutes */
  '/api/sociaal/beleid/zet': { soort: 'antwoord', aan: true },
  '/api/isolatie/mijn/zet': { drager: 'identiteit', naar: 'normaal' },
  '/api/webauthn/bevestig/opties': { actie: 'passkey-nieuw' },
  '/api/gegevens/start': { soort: 'bestelling' },
  '/api/gegevens/zeg': { tekst: '+31612345678' },
  '/api/member/vluchten/charter': { soort: 'privejet', bestemming: 'Nice' },
  '/api/verify/upload': { image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' },
  '/api/verify/selfie': { image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' }
};

/* Wat naar een object van A wijst en niet uit de pool komt. Leeg (undefined)
   als de opbouw het object niet kon maken: dan wordt er niets gezet. */
const VAN_A = {
  '/api/bank/afschrift': (c) => ({ iban: c.iban }),
  '/api/bank/afschrift.csv': (c) => ({ iban: c.iban }),
  '/api/bank/storten': (c) => ({ iban: c.iban }),
  '/api/bank/naar-wallet': (c) => ({ iban: c.iban }),
  '/api/bank/overboek': (c) => ({ vanIban: c.iban, naarIban: c.spaarIban }),
  '/api/bank/spaardoel': (c) => ({ iban: c.spaarIban }),
  '/api/bank/pas/uitgeven': (c) => ({ iban: c.iban }),
  '/api/bank/rekening': (c) => ({ iban: c.iban }),
  '/api/metier/aanbeveling-intrekken': (c) => ({ id: c.aanbeveling }),
  '/api/metier/aanbeveling-verberg': (c) => ({ id: c.aanbevelingOpA }),
  '/api/metier/rol-weg': (c) => ({ id: c.rol }),
  '/api/carriere/ledger/intrek': (c) => ({ id: c.feit }),
  '/api/carriere/ledger/deel': (c) => ({ id: c.feit }),
  '/api/carriere/ledger/stopdelen': (c) => ({ id: c.deelId }),
  '/api/pay/tegoed/roteer': (c) => ({ id: c.tegoed }),
  '/api/code/scan': (c) => ({ token: c.codeToken }),
  '/api/gegevens/zeg': (c) => ({ id: c.gesprek }),
  '/api/neiging/antwoord': (c) => (c.vraag ? { vraag: c.vraag, onderwerpen: c.onderwerpen } : {})
};

/* De opbouwstappen. `lijf(ctx)` mag lezen wat eerdere stappen bewaarden;
   `bewaar(data, ctx)` onthoudt wat later nodig is. `doe(hulp, ctx)` is een stap
   die meer dan een verzoek is (twee leden verbinden). */
function stappen() {
  return [
    { als: 'kantoor', pad: '/api/office/bank/leden', lijf: { aan: true } },
    { naam: 'verbind A met C', doe: async (h, c) => {
      const { verbind } = require('./voltooiwereld');
      const v = await verbind({ post: h.post }, { token: h.A() }, { token: h.C() });
      c.ik.key = v.a.key; c.tegen.key = v.b.key;
    } },
    /* RTG Bank: akkoord opent de eerste rekening, daarna een spaarrekening,
       geld erop en een pas. */
    { pad: '/api/bank/akkoord', lijf: {}, bewaar: (d, c) => { c.iban = zoek(d, { sleutel: 'iban' }); } },
    { pad: '/api/bank/overzicht', lijf: {}, bewaar: (d, c) => { c.iban = c.iban || zoek(d, { sleutel: 'iban' }); } },
    { pad: '/api/bank/rekening/open', lijf: () => ({ soort: 'spaar', naam: 'Spaar', idem: idem() }),
      bewaar: (d, c) => { c.spaarIban = zoek(d, { sleutel: 'iban' }); } },
    { pad: '/api/bank/storten', lijf: (c) => ({ iban: c.iban, centen: 5000, route: 'auto', oms: 'opbouw', idem: idem() }) },
    { pad: '/api/bank/pas/uitgeven', lijf: (c) => ({ iban: c.iban, soort: 'debit', naam: 'Mijn pas', idem: idem() }) },
    /* RTG Geld */
    { pad: '/api/geld/pot/zet', lijf: { naam: 'Vakantie', doelCenten: 50000 } },
    { pad: '/api/geld/beleid/zet', lijf: { soort: 'maanddrempel', drempelCenten: 100000, niveau: 'kijken' } },
    { pad: '/api/geld/grens/zet', lijf: { periode: 'maand', centen: 50000 } },
    /* Wie betaalt wat: een lijstje met C */
    { pad: '/api/wbw/maak', lijf: (c) => ({ naam: 'Weekendje', leden: [c.tegen.key] }) },
    /* RTG Pay */
    { pad: '/api/pay/rekening', lijf: { iban: 'NL91ABNA0417164300', naam: 'Proef Rekening' } },
    { pad: '/api/pay/oplaad', lijf: () => ({ centen: 5000, idem: idem() }) },
    { pad: '/api/pay/tegoed/koop', lijf: (c) => ({ centen: 500, aan: c.tegen.codenaam, oms: 'proef', idem: idem() }),
      bewaar: (d, c) => { c.tegoed = zoek(d, { sleutel: 'tegoedId' }) || zoek(d, { sleutel: 'id' }); } },
    { pad: '/api/code/dyn', lijf: { soort: 'zegel', code: 'proefzegel1', ttlMs: 300000 },
      bewaar: (d, c) => { c.codeToken = zoek(d, { sleutel: 'token' }); } },
    /* Metier: een eigen profiel, en aanbevelingen over en weer met C */
    { pad: '/api/metier/kaart', lijf: { kop: 'Sommelier', over: 'Twintig jaar wijn', plaats: 'Amsterdam' } },
    { pad: '/api/metier/rol', lijf: { wat: 'Barman', waar: 'Cafe Proef' }, bewaar: (d, c) => { c.rol = d.rol && d.rol.id; } },
    { pad: '/api/metier/lijst', lijf: { veld: 'vaardigheden', waarden: ['sommelier'] } },
    { als: 'tegen', pad: '/api/metier/lijst', lijf: { veld: 'vaardigheden', waarden: ['sommelier'] } },
    { pad: '/api/metier/beveel-aan', lijf: (c) => ({ wie: c.tegen.codenaam, tekst: 'Een uitstekende collega, altijd paraat.' }),
      bewaar: (d, c) => { c.aanbeveling = d.aanbeveling && d.aanbeveling.id; } },
    { als: 'tegen', pad: '/api/metier/beveel-aan', lijf: (c) => ({ wie: c.ik.codenaam, tekst: 'Een uitstekende collega, altijd paraat.' }),
      bewaar: (d, c) => { c.aanbevelingOpA = d.aanbeveling && d.aanbeveling.id; } },
    /* Het loopbaanledger: een feit en een deelcode */
    { pad: '/api/carriere/ledger/zet', lijf: () => ({ kapitaal: 'vermogen', wat: 'Diploma sommelier gehaald', op: vandaag() }),
      bewaar: (d, c) => { c.feit = d.regel && d.regel.id; } },
    { pad: '/api/carriere/ledger/deel', lijf: (c) => ({ id: c.feit, dagen: 7, voor: 'een opdrachtgever' }) },
    { pad: '/api/carriere/ledger/delen', lijf: {}, bewaar: (d, c) => { c.deelId = zoek(d, { patroon: /^cd[0-9a-f]{4,}$/ }); } },
    /* Veilig: C in de kring, een moment met C */
    { pad: '/api/veiligheid/kring/toevoegen', lijf: (c) => ({ handle: c.tegen.codenaam }) },
    { pad: '/api/veiligheid/kring/mail', lijf: { adres: 'kring-proef@voorbeeld.test' } },
    { pad: '/api/veiligheid/codewoord/zet', lijf: { zin: 'rode fiets bij de molen' } },
    { pad: '/api/veiligheid/moment/maak', lijf: (c) => ({ ontvangers: [{ soort: 'contact', id: c.tegen.codenaam, niveau: 'voortgang' }], titel: 'Wandeling', minuten: 120 }) },
    /* RTG iD: een machtiging aan C */
    { pad: '/api/rtgid/machtig', lijf: (c) => ({ dienst: 'gemeente', dagen: 7, codenaam: c.tegen.codenaam }) },
    /* Neigingen: de intake geeft de vraag */
    { pad: '/api/neiging/intake', lijf: {}, bewaar: (d, c) => {
      const v = d.vraag || {};
      c.vraag = v.id; c.onderwerpen = (v.opties || []).slice(0, 2).map((o) => o.onderwerp).filter(Boolean);
    } },
    /* Een gegevensgesprek */
    { pad: '/api/gegevens/start', lijf: { soort: 'vlucht' }, bewaar: (d, c) => { c.gesprek = zoek(d, { patroon: /^gg/ }) || d.id; } }
  ];
}

function lijfVoor(pad, basis, ctx) {
  const e = LIJVEN[pad];
  if (!e) return basis;
  const uit = Object.assign({}, basis, typeof e === 'function' ? e(ctx || {}) : e);
  for (const k of Object.keys(uit)) if (uit[k] === undefined) delete uit[k];
  return uit;
}

/* De velden die naar A's object wijzen, alleen als de opbouw ze kon vullen. */
function vanA(pad, ctx) {
  const f = VAN_A[pad];
  if (!f) return {};
  const uit = {};
  for (const [k, v] of Object.entries(f(ctx || {}) || {})) if (v !== undefined && v !== null && v !== '') uit[k] = v;
  return uit;
}

module.exports = { LIJVEN, VAN_A, stappen, lijfVoor, vanA, zoek, vandaag };
