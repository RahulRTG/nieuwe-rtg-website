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
const morgen = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const over = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
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
  '/api/metier/beveel-aan': (c) => ({ wie: c.tegen && c.tegen.codenaam, tekst: 'Een uitstekende collega, altijd paraat.' }),
  '/api/metier/onderschrijf': (c) => ({ wie: c.tegen && c.tegen.codenaam, vaardigheid: 'sommelier', aan: true }),
  '/api/metier/lid': (c) => ({ wie: c.tegen && c.tegen.codenaam }),
  '/api/wbw/maak': (c) => ({ naam: 'Weekendje', leden: c.tegen && c.tegen.key ? [c.tegen.key] : [] }),
  '/api/member/pulse/volg': (c) => ({ key: c.tegen && c.tegen.key }),
  /* RTMail (routes/rtmail-*.js): het postvak komt altijd uit de sessie */
  '/api/member/rtmail/concept/bewaar': (c) => ({ id: undefined, naar: c.ikAdres, onderwerp: 'Proef', tekst: 'proef' }),
  '/api/member/rtmail/antwoord': { tekst: 'Re proef' },
  '/api/member/rtmail/etiket': { label: 'proef', aan: true },
  '/api/member/rtmail/sluimer': () => ({ tot: new Date(Date.now() + 864e5).toISOString() }),
  '/api/member/rtmail/ster': { aan: true },
  '/api/member/rtmail/verplaats': { map: 'archief' },
  '/api/member/rtmail/zoek': { vraag: 'proef' },
  '/api/member/rtmail/afwezig': { tekst: 'Ik ben weg', van: undefined, tot: undefined },
  '/api/member/rtmail/regel/maak': { id: undefined, naam: 'Proef', veld: 'onderwerp', bevat: 'proef', actie: 'ster' },
  '/api/member/rtmail/regel/zet': { aan: false },
  '/api/member/rtmail/imap/sleutel': { id: undefined, naam: 'Proeftoestel', dagen: 30 },
  '/api/member/rtmail/imap/roteer': { dagen: 30 },
  '/api/member/rtmail/bewaring': { aan: true, zaak: 'ZAAK-1', reden: 'Proef juridische bewaring' },
  '/api/member/rtmail/opruimen': { reden: 'Proef opruimen' },
  '/api/member/rtmail/team/maak': { id: undefined, naam: 'Proefteam' },
  '/api/member/rtmail/team/stuur': { tekst: 'proef' },
  '/api/member/rtmail/team/status': { status: 'in behandeling' },
  '/api/member/rtmail/team/prioriteit': { prioriteit: 'hoog' },
  '/api/member/rtmail/team/notitie': { tekst: 'proef' },
  '/api/member/rtmail/team/koppel': { klantId: 'K1', ticketId: 'T1' },
  '/api/member/rtmail/team/bevestiging': { tekst: 'Ontvangen' },
  '/api/member/rtmail/team/lid': (c) => ({ codenaam: c.tegen && c.tegen.codenaam, erin: true }),
  /* Gesprekken (routes/member/comm.js) */
  '/api/comm/begin': (c) => ({ met: c.tegen && c.tegen.key }),
  '/api/comm/stuur': { tekst: 'proef' },
  '/api/comm/concept': { tekst: 'proef' },
  '/api/comm/vlag': { vlag: 'vast', aan: true },
  '/api/comm/reactie': { teken: '+1' },
  '/api/comm/wijzig': { tekst: 'nieuw' },
  /* Spellen (routes/spellen.js) */
  '/api/member/spel/nieuw': (c) => ({ soort: 'schaak', codenamen: c.tegen ? [c.tegen.codenaam] : [] }),
  '/api/member/spel/random': { soort: 'schaak' },
  '/api/member/spel/projectie-open': () => ({ idem: 'proef-herhaal-' + randomUUID() }),
  '/api/member/spel/arcade-score': { spel: 'tetris', punten: 1234 },
  '/api/member/spel/arcade-bord': { spel: 'tetris' },
  '/api/member/spel/dag': { spel: 'sudoku' },
  '/api/member/spel/dag-start': { spel: 'sudoku' },
  '/api/member/spel/dag-klaar': { spel: 'sudoku', inzending: new Array(81).fill(0) },
  '/api/member/spel/sudoku-nieuw': { niveau: 'normaal' },
  '/api/member/spel/sudoku-klaar': { rooster: new Array(81).fill(0) },
  '/api/member/spel/toernooi-nieuw': { soort: 'schaak', vorm: 'roundrobin', maat: 3 },
  /* Magnaat (routes/magnaatwereld.js, magnaatstad.js) */
  '/api/member/magnaat/leven/actie': { actie: 'slaap' },
  '/api/member/magnaat/stad/actie': { actie: 'slaap' },
  '/api/member/magnaat/economie/schok': { schokId: 'vraagpiek' },
  '/api/member/magnaat/economie/volgende-dag': () => ({ commandoId: 'proef-dag-' + randomUUID().slice(0, 8) }),
  '/api/member/magnaat/economie/analyse': { hypothese: 'vraag', maatregel: 'niets', indicatoren: ['vraag', 'verkoop'],
    causaleKeten: 'Als de vraag stijgt, stijgt de verkoop en daarmee de omzet van de zaak.',
    alternatief: 'De prijs verhogen om de vraag te temperen.', opportunityCost: 'Geen investering in extra capaciteit.',
    risico: 'De vraag zakt weer voordat de voorraad op is.', omzetRichting: 'stijgt', winstRichting: 'gelijk', kasRichting: 'daalt',
    verwachteOmzet: 10000, verwachteWinst: 1000, verwachteInflatie: 2, zekerheid: 70 },
  /* Vakwerk (routes/member/vakpro.js): DENTAL is een vakzaak uit de initdata */
  '/api/vak/offerte/vraag': () => ({ supplierCode: 'DENTAL', omschrijving: 'Controle en reiniging graag', wens: over(14) }),
  '/api/vak/ritme/start': () => ({ supplierCode: 'DENTAL', serviceId: 't1', intervalWeken: 2, tijd: '10:00', start: over(7) }),
  '/api/vak/wachtlijst/zet': () => ({ supplierCode: 'DENTAL', datum: over(7), serviceId: 't1' }),
  '/api/vak/review': { supplierCode: 'DENTAL', ref: 'geen-boeking', sterren: 5, tekst: '' },
  /* Commerce en winkelen */
  '/api/commerce/etalage': { verkoper: 'TALLER', lang: 'nl' },
  '/api/commerce/mand/zet': { koopbaarId: 'dienst:TALLER:g1', aantal: 1 },
  '/api/commerce/overdracht/maak': { verkoper: 'TALLER' },
  '/api/reserveer': () => ({ supplierCode: 'KIKUNOI', datum: morgen(), tijd: '20:00', personen: 2 }),
  '/api/booking/slots': () => ({ supplierCode: 'DENTAL', serviceId: 't1', date: over(7) }),
  '/api/booking/request': () => ({ supplierCode: 'DENTAL', serviceId: 't1', date: over(7), time: '10:00', note: '' }),
  '/api/retail/catalogus': { supplierCode: 'MAISON', lang: 'nl' },
  '/api/retail/wishlist': (c) => ({ supplierCode: 'MAISON', artikelId: c.artikel }),
  '/api/reviews': { supplierCode: 'KIKUNOI' },
  '/api/mall/aanvraag': { wat: 'Privechef gezocht', verdieping: 'eten', plek: 'Ibiza' },
  /* Thuis, agenda, gezondheid -- privé per sleutel */
  '/api/home/onderhoud/meld': { titel: 'Kraan lekt', plek: 'keuken', urgentie: 'normaal' },
  '/api/agenda/bereik': () => ({ van: vandaag(), tot: over(14) }),
  '/api/instant-reality/event': { type: 'intent.delta', value: 'vier gasten' },
  '/api/plaats/venster': { doel: 'dienst', minuten: 60 },
  '/api/metingen/zet': { onderwerp: 'slaap', waarde: 7 },
  '/api/metingen/weg': () => ({ onderwerp: 'slaap', op: vandaag() }),
  '/api/leerstof/examen': { fase: 'havo' },
  '/api/leerstof/examen-antwoord': { nr: 1, antwoord: 'A' },
  '/api/bieb/ai': { vraag: 'Een boek over wijn' },
  '/api/bijles/vraag': { tekst: 'Hoe werkt breuken optellen?' },
  '/api/fluister': { q: 'Hallo Rahul' },
  '/api/mediaos/volg': (c) => ({ codenaam: c.tegen && c.tegen.codenaam, aan: true }),
  '/api/push/subscribe': { subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/proef123', keys: { p256dh: 'x', auth: 'y' } } },
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
  '/api/gegevens/zeg': (c) => ({ id: c.gegevensgesprek }),
  '/api/neiging/antwoord': (c) => (c.vraag ? { vraag: c.vraag, onderwerpen: c.onderwerpen } : {}),
  '/api/metier/naam-intrekken': () => ({ code: 'KIKUNOI' }),
  /* RTMail: A's eigen bericht, A's eigen postvak, A's team */
  '/api/member/rtmail/antwoord': (c) => ({ id: c.bericht }),
  '/api/member/rtmail/etiket': (c) => ({ id: c.bericht }),
  '/api/member/rtmail/sluimer': (c) => ({ id: c.bericht }),
  '/api/member/rtmail/ster': (c) => ({ id: c.bericht }),
  '/api/member/rtmail/verplaats': (c) => ({ id: c.bericht }),
  '/api/member/rtmail/concept/verstuur': (c) => ({ id: c.concept }),
  '/api/member/rtmail/concept/weg': (c) => ({ id: c.concept }),
  '/api/member/rtmail/bewaring': (c) => ({ postvak: c.ikAdres }),
  '/api/member/rtmail/opruimen': (c) => ({ postvak: c.ikAdres }),
  ...Object.fromEntries(['af', 'bevestiging', 'dossier', 'hef', 'koppel', 'lid', 'notitie', 'overzicht', 'pak', 'postvak',
    'prioriteit', 'status', 'stuur', 'verlaat'].map((h) => ['/api/member/rtmail/team/' + h,
    (c) => ({ id: c.team, bericht: c.teamBericht, ...(h === 'stuur' ? { naar: c.ikAdres } : {}) })])),
  /* Gesprekken: A's gesprek met C */
  ...Object.fromEntries(['concept', 'gesprek', 'lees', 'por', 'stuur', 'typt', 'vlag'].map((h) => ['/api/comm/' + h, (c) => ({ id: c.gesprek })])),
  ...Object.fromEntries(['reactie', 'wijzig', 'wis'].map((h) => ['/api/comm/' + h, (c) => ({ id: c.gesprek, berichtId: c.commBericht })])),
  '/api/member/spel/projectie-open': (c) => ({ id: c.potje })
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
    { pad: '/api/geld/pot/zet', lijf: (c) => ({ naam: 'Vakantie-' + c.merk, doelCenten: 50000 }) },
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
    /* RTMail: het eigen adres, een bericht aan zichzelf, een concept, een team
       met een bericht erin, een regel en een IMAP-sleutel. */
    { pad: '/api/member/rtmail/adres', lijf: {}, bewaar: (d, c) => { c.ikAdres = d.adres; } },
    { pad: '/api/member/rtmail/concept/bewaar', lijf: (c) => ({ naar: c.ikAdres, onderwerp: 'Proef ' + c.merk, tekst: 'proef ' + c.merk }),
      bewaar: (d, c) => { c.conceptVoorBericht = d.concept && d.concept.id; } },
    { pad: '/api/member/rtmail/concept/verstuur', lijf: (c) => ({ id: c.conceptVoorBericht }), bewaar: (d, c) => { c.bericht = d.bericht && d.bericht.id; } },
    { pad: '/api/member/rtmail/concept/bewaar', lijf: (c) => ({ naar: c.ikAdres, onderwerp: 'Concept ' + c.merk, tekst: 'blijft liggen' }),
      bewaar: (d, c) => { c.concept = d.concept && d.concept.id; } },
    { pad: '/api/member/rtmail/team/maak', lijf: (c) => ({ naam: 'Proefteam ' + c.merk }),
      bewaar: (d, c) => { c.team = d.team && d.team.id; c.teamAdres = d.team && d.team.adres; } },
    { pad: '/api/member/rtmail/concept/bewaar', lijf: (c) => ({ naar: c.teamAdres, onderwerp: 'Teamvraag ' + c.merk, tekst: 'graag hulp' }),
      bewaar: (d, c) => { c.teamConcept = d.concept && d.concept.id; } },
    { pad: '/api/member/rtmail/concept/verstuur', lijf: (c) => ({ id: c.teamConcept }), bewaar: (d, c) => { c.teamBericht = d.bericht && d.bericht.id; } },
    { pad: '/api/member/rtmail/regel/maak', lijf: (c) => ({ naam: 'Regel ' + c.merk, veld: 'onderwerp', bevat: 'proef', actie: 'ster' }) },
    { pad: '/api/member/rtmail/imap/sleutel', lijf: { naam: 'Proeftoestel', dagen: 30 } },
    /* Een gesprek met C, met een bericht */
    { pad: '/api/comm/begin', lijf: (c) => ({ met: c.tegen.key }), bewaar: (d, c) => { c.gesprek = d.gesprek && d.gesprek.id; } },
    { pad: '/api/comm/stuur', lijf: (c) => ({ id: c.gesprek, tekst: 'proef ' + c.merk }), bewaar: (d, c) => {
      const b = (d.gesprek && d.gesprek.berichten) || [];
      c.commBericht = b.length ? b[b.length - 1].id : undefined;
    } },
    /* Een potje schaak met C */
    { pad: '/api/member/spel/nieuw', lijf: (c) => ({ soort: 'schaak', codenamen: [c.tegen.codenaam] }), bewaar: (d, c) => { c.potje = d.id; } },
    { pad: '/api/member/spel/sudoku-nieuw', lijf: { niveau: 'normaal' } },
    /* Een Magnaat-stad met C erin */
    { pad: '/api/member/magnaat/stad/maak', lijf: { moeilijkheid: 'normaal', begin: 'keuken' }, bewaar: (d, c) => { c.stad = d.stad && d.stad.code; } },
    { als: 'tegen', pad: '/api/member/magnaat/stad/doe', lijf: (c) => ({ code: c.stad }) },
    { pad: '/api/member/magnaat/stad/start', lijf: {} },
    /* Vakwerk, winkelen, reserveren */
    { pad: '/api/vak/offerte/vraag', lijf: () => ({ supplierCode: 'DENTAL', omschrijving: 'Controle en reiniging graag', wens: over(14) }) },
    { pad: '/api/vak/ritme/start', lijf: () => ({ supplierCode: 'DENTAL', serviceId: 't1', intervalWeken: 2, tijd: '10:00', start: over(7) }) },
    { pad: '/api/retail/catalogus', lijf: { supplierCode: 'MAISON', lang: 'nl' }, bewaar: (d, c) => {
      const a = (d.artikelen || d.items || [])[0]; c.artikel = a && a.id;
    } },
    { pad: '/api/commerce/mand/zet', lijf: { koopbaarId: 'dienst:TALLER:g1', aantal: 1 } },
    { pad: '/api/reserveer', lijf: () => ({ supplierCode: 'KIKUNOI', datum: morgen(), tijd: '20:00', personen: 2 }) },
    { pad: '/api/mall/aanvraag', lijf: (c) => ({ wat: 'Privechef gezocht ' + c.merk, verdieping: 'eten', plek: 'Ibiza' }) },
    /* Privé per sleutel: agenda, onderhoud, metingen, medicatie, noodkaart.
       De namen dragen A's merkwoord, zodat A's antwoord iets van A toont. */
    { pad: '/api/agenda/toevoegen', lijf: (c) => ({ titel: 'Afspraak ' + c.merk, datum: morgen(), tijd: '10:00' }) },
    { pad: '/api/home/onderhoud/meld', lijf: (c) => ({ titel: 'Kraan ' + c.merk, plek: 'keuken', urgentie: 'normaal' }) },
    { pad: '/api/metingen/zet', lijf: { onderwerp: 'slaap', waarde: 7 } },
    { pad: '/api/medicatie/zet', lijf: (c) => ({ naam: 'Middel-' + c.merk, sterkte: '10mg' }) },
    { pad: '/api/noodkaart/zet', lijf: (c) => ({ contactNaam: 'Contact-' + c.merk, contactTel: '0612345678' }) },
    /* C maakt een clip, zodat er iets van C te volgen valt */
    { als: 'tegen', pad: '/api/clips/maak', lijf: { titel: 'Proefclip', duurS: 10 } },
    /* Een gegevensgesprek */
    { pad: '/api/gegevens/start', lijf: { soort: 'vlucht' }, bewaar: (d, c) => { c.gegevensgesprek = zoek(d, { patroon: /^gg/ }) || d.id; } }
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

/* A's merkwoord: spatieloos en met cijfers, zodat het een merkteken is
   (./afbakening.js merkbaar). Alleen de opbouw van A gebruikt het; B en C sturen
   het nooit, dus wie het in een antwoord ziet, ziet iets van A. */
function merkwoord() { return 'mrk' + randomUUID().replace(/-/g, '').slice(0, 10); }

module.exports = { LIJVEN, VAN_A, stappen, lijfVoor, vanA, zoek, vandaag, merkwoord };
