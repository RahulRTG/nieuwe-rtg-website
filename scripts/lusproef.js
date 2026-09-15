#!/usr/bin/env node
/* ============================================================================
   DE LUSPROEF -- sluit de ontdeklus, en houdt hij zijn belofte als het misgaat?

   De zesde ketenproef van dit huis, na tafel, rit, toelating, Adam en moment.
   Hij is er om een andere vraag te beantwoorden dan de vijf ervoor: die eindigen
   bij een GELEVERDE dienst of bij iemand die iets WEET. Deze eindigt bij iemand
   die iets KAN, en is aantoonbaar door een ANDER bevestigd.

   WAAROM DIT GEEN LOSSE ROUTETOETSEN ZIJN. De lus van Foundation Connect loopt
   over vier lagen en twee mensen: een lid zegt wat hem interesseert, de mixer
   bouwt daar een brug van naar een vak waar hij nooit om vroeg, hij opent hem,
   hij zegt dat hij het snapt -- en dan komt er een TWEEDE mens die zegt dat hij
   door dat werk geholpen is, en pas daardoor ontstaat de trede die buiten
   Foundation iets betekent. Geen enkele routetoets ziet die overdracht, want
   hij loopt van het ene dossier naar het andere langs een haak.

   ZEVENTIEN SCHAKELS EN TIEN STORINGEN. Een schakel vraagt: handelt actor A, en
   MERKT actor B dat? Een storing vraagt: houdt de keten zijn belofte als het
   misgaat? De storingen zijn hier de helft van de waarde, want de beloftes van
   deze laag zijn bijna allemaal NEGATIEF -- geen score, geen rangorde, geen
   gegeven over de mens, geen kind dat publiek gaat. Een keten die alleen het
   gelukkige pad loopt, bewijst van zo'n laag niets.

   DE STAND `openBekend` BESTAAT OOK HIER, in de vorm van scripts/ritproef.js:
   een schakel die aantoonbaar nog niet dicht is, met de reden erbij. Zonder die
   uitweg heeft een proef die iets echts vindt maar twee uitgangen -- altijd
   zakken, of de bevinding wegpoetsen.

   DRAAIEN  npm run lusproef
   ========================================================================== */
'use strict';

const ws = require('./lib/wegwerpserver');
const { ROLLEN } = require('./lib/proefsessies');

const schakels = [], storingen = [];
const schakel = (nr, wat, ok, detail) => schakels.push({ nr, wat, stand: ok === 'open' ? 'openBekend' : (ok ? 'sluit' : 'BREEKT'), detail });
const storing = (nr, wat, ok, detail) => storingen.push({ nr, wat, stand: ok ? 'houdt' : 'BREEKT', detail });

async function proef(basis) {
  const post = async (pad, lijf, token) => {
    const h = { 'Content-Type': 'application/json' };
    if (token) h.Authorization = 'Bearer ' + token;
    const r = await fetch(basis + pad, { method: 'POST', headers: h, body: JSON.stringify(lijf || {}) });
    return { status: r.status, body: await r.json().catch(() => null) };
  };

  /* TWEE LEDEN, want de belangrijkste schakel loopt tussen twee mensen. Een
     proef met een lid kan de trede `onderwezen` niet bereiken -- dat is precies
     de grendel die hij hoort te toetsen. */
  const a = await ROLLEN.lid.haal(basis);
  const b = await ROLLEN.lid.haal(basis);
  if (!a || !b) throw new Error('geen twee ledensessies; de proef kan niets bewijzen');

  /* ---- 1. de mens zegt wat hem interesseert ---------------------------- */
  let r = await post('/api/connect/signaal', { onderwerp: 'voetbal', signaal: 'meer' }, a);
  schakel(1, 'een lid zegt "meer voetbal" en dat wordt bewaard',
    r.status === 200 && r.body.bewaard === true && r.body.gewicht === 1, 'gewicht ' + (r.body || {}).gewicht);

  /* ---- 2. de lus bouwt er een BRUG van ---------------------------------- */
  r = await post('/api/connect/ontdek', { vandaag: '2026-09-15' }, a);
  const plekken = (r.body || {}).plekken || [];
  const brug = plekken.find(p => p.ontdekking.soort === 'vraag');
  schakel(2, 'van een alledaags onderwerp naar een vak waar niet om gevraagd is',
    !!brug && brug.ontdekking.onderwerp !== 'voetbal',
    brug ? 'voetbal -> ' + brug.ontdekking.onderwerp + ': "' + brug.ontdekking.titel + '"' : 'geen brug');

  /* ---- 3. elke plek draagt zijn reden ----------------------------------- */
  schakel(3, 'elke plek zegt WAAROM hij er staat en welke motor hem koos',
    plekken.length > 0 && plekken.every(p => p.door && p.waarom && p.dektNiet),
    plekken.length + ' plekken, alle met motor + reden + wat hij niet dekt');

  /* ---- 4. een motor zonder bron zegt dat hij niet kijkt ------------------ */
  const motoren = (r.body || {}).motoren || [];
  const zonderBron = motoren.filter(m => !m.aangesloten);
  schakel(4, 'een motor zonder bron meldt dat hij niet kijkt, met de reden',
    zonderBron.length > 0 && zonderBron.every(m => m.reden),
    zonderBron.length + ' van ' + motoren.length + ' motoren: ' + zonderBron.map(m => m.id).join(', '));

  /* ---- 5. openen schrijft de trede `gezien` ------------------------------ */
  const o = (brug || plekken[0]).ontdekking;
  r = await post('/api/connect/open', { id: o.id, onderwerp: o.onderwerp, herkomst: o.herkomst }, a);
  schakel(5, 'iets openen zet de trede "gezien" in het eigen leerdossier',
    r.status === 200 && r.body.ok === true, 'trede ' + ((r.body.regel || {}).trede || '-'));

  /* ---- 6. het lid zegt dat hij het snapt -------------------------------- */
  r = await post('/api/connect/noteer', { trede: 'begrepen', onderwerp: o.onderwerp }, a);
  schakel(6, 'de mens zet zelf "begrepen", en die regel draagt de graad `vermoed`',
    r.status === 200 && (r.body.regel || {}).graad === 'vermoed', 'graad ' + ((r.body.regel || {}).graad || '-'));

  /* ---- 7. maar de overdrachtstreden kan hij NIET zelf zetten ------------- */
  /* `gebruikt` en `doorgegeven` dragen aanspraak `overdracht` en zijn daarmee de
     enige twee die buiten Foundation iets betekenen -- precies daarom mag de
     mens ze zelf niet schrijven. Hier stond `onderwezen`, en die trede bestaat
     sinds de ladder vijf overdrachtstreden kreeg niet meer; de route weigerde
     toen om de VERKEERDE reden ("die trede bestaat niet") terwijl de proef
     groen las op het woord. Een geldige uitslag van het verkeerde experiment. */
  const zelfGeweigerd = [];
  for (const trede of ['gebruikt', 'doorgegeven']) {
    const w = await post('/api/connect/noteer', { trede, onderwerp: o.onderwerp, bron: 'w1' }, a);
    zelfGeweigerd.push(w.status !== 200 && /een ander/i.test(String((w.body || {}).error || '')));
  }
  schakel(7, 'de twee treden met bewijskracht kan hij niet zelf zetten',
    zelfGeweigerd.every(Boolean), 'gebruikt en doorgegeven allebei geweigerd met de reden');

  /* ---- 8. EEN TWEEDE MENS zegt dat hij geholpen is ----------------------- */
  /* DE SCHAKEL WAAR DE HELE LAAG OM DRAAIT, en hij is op 15 september gesloten.

     Hij stond OPEN met een reden: geen enkele bron droeg een maker, dus een
     `geholpen` kon bij niemand landen. Daarvoor stond hij op GROEN met `maker`
     uit het verzoek -- waarmee iedereen een regel met bewijskracht in het
     dossier van een willekeurig ander kon schrijven.

     Het besluit van de eigenaar wees de uitweg aan: Connect mag auteurschap
     CONSUMEREN en niet uitvinden. Daarom begint deze schakel nu bij een ECHT
     domein: lid A maakt een clip langs /api/clips/maak, kern/clips.js roept
     `nieuwWerk(key, 'flow', titel)` aan zoals hij altijd al deed, en
     kern/mediaos/werkherkomst.js legt daar vast van wie dat werk is. Pas dan
     kan lid B er iets mee, en landt de regel bij A.

     Dat is de hele bewijsketen in een schakel: een domein beweert auteurschap,
     Connect leest het, een tweede mens doet er iets mee. */
  const clip = await post('/api/clips/maak', { titel: 'Zo maak je pasta', duurS: 30 }, a);
  const werken = await post('/api/connect/werk', {}, a);
  schakel(8, 'een ECHT domein meldt werk aan, en Connect neemt het auteurschap over',
    clip.status === 200 && werken.status === 200 && werken.body.nieuw &&
      werken.body.nieuw.some(x => x.trede === 'gemaakt') && werken.body.nieuw.some(x => x.trede === 'aangeboden'),
    'clip gemaakt (' + clip.status + '); overgenomen: ' +
      ((werken.body.nieuw || []).map(x => x.trede).join(', ') || 'niets'));

  /* De ontdekking-sleutel zoals een scherm hem zou dragen: herkomst + id. */
  const werkId = ((werken.body.nieuw || [])[0] || {}).werk;
  const werk = werkId ? 'mediaos:' + werkId : 'mediaos:onbekend';

  /* ---- 8b. het komt bij een ander AAN -- en dat telt niet als ontwikkeling -- */
  r = await post('/api/connect/open', { id: werk, onderwerp: 'flow', herkomst: 'mediaos' }, b);
  const naOpen = await post('/api/connect/portfolio', {}, a);
  schakel(9, 'bereikt staat in het dossier van de maker en NIET in zijn portfolio',
    r.status === 200 && r.body.bereikteMaker === true &&
      !(naOpen.body.bewijzen || []).some(x => x.trede === 'bereikt'),
    'bereikt geschreven: ' + r.body.bereikteMaker + '; in portfolio: ' +
      (naOpen.body.bewijzen || []).some(x => x.trede === 'bereikt'));

  /* ---- 8c. en pas als B er IETS MEE doet, telt het wel -------------------- */
  const mooi = await post('/api/connect/naklank', { id: werk, soort: 'mooi' }, b);
  const naMooi = await post('/api/connect/portfolio', {}, a);
  const gebruikt = await post('/api/connect/naklank', { id: werk, soort: 'geprobeerd' }, b);
  const naGebruik = await post('/api/connect/portfolio', {}, a);
  schakel(10, '"mooi" levert de maker niets op, "geprobeerd" wel',
    mooi.body.dossier === null && !!mooi.body.dossierReden &&
      !(naMooi.body.bewijzen || []).some(x => x.trede === 'gebruikt') &&
      (naGebruik.body.bewijzen || []).some(x => x.trede === 'gebruikt' && x.graad === 'bewezen'),
    'na "mooi": ' + (naMooi.body.bewijzen || []).length + ' bewijzen; na "geprobeerd": ' +
      (naGebruik.body.bewijzen || []).length);

  /* ---- 11. de teller zelf ------------------------------------------------ */
  /* De maker is hier een losse codenaam en niet lid A: deze laag ZOEKT de maker
     niet op (hij kent hem niet), dus de proef geeft hem mee zoals een scherm dat
     zou doen. Wat bewezen wordt is de haak en de graad, niet de opzoeking. */
  const tel = await post('/api/connect/naklank/tel', { id: werk }, b);
  const soorten = ((tel.body || {}).soorten || []);
  schakel(11, 'de teller kent zes soorten en GEEN totaal',
    soorten.length === 6 && !('totaal' in (tel.body || {})) && !('score' in (tel.body || {})),
    soorten.length + ' soorten, velden: ' + Object.keys(tel.body || {}).join(', '));

  /* ---- 10. het dossier vat samen PER onderwerp, zonder totaal ------------ */
  const dos = await post('/api/connect/dossier', {}, a);
  const per = (dos.body || {}).perOnderwerp || [];
  schakel(12, 'het dossier geeft de hoogste trede per ONDERWERP en geen niveau',
    per.length > 0 && per.every(p => p.trede && p.graad) && !('niveau' in (dos.body || {})),
    per.map(p => p.onderwerp + '=' + p.trede).join(', '));

  /* ---- 11. de horizon stuurt de verdeling -------------------------------- */
  await post('/api/connect/schuif', { schuif: 0 }, a);
  const vertrouwd = await post('/api/connect/ontdek', { vandaag: '2026-09-15' }, a);
  await post('/api/connect/schuif', { schuif: 100 }, a);
  const ontdekkend = await post('/api/connect/ontdek', { vandaag: '2026-09-15' }, a);
  schakel(13, 'de schuif van de mens verdeelt de plekken en niets anders doet dat',
    (vertrouwd.body || {}).verdeling.ontdekken === 0 && (ontdekkend.body || {}).verdeling.vertrouwd === 0,
    'schuif 0 -> ' + JSON.stringify(vertrouwd.body.verdeling) + ', schuif 100 -> ' + JSON.stringify(ontdekkend.body.verdeling));

  /* ---- 12. de sessie mag ophouden ---------------------------------------- */
  schakel(14, 'het antwoord zegt zelf wanneer het genoeg is',
    !!(ontdekkend.body || {}).genoeg, String((ontdekkend.body || {}).genoeg || '').slice(0, 60) + '...');

  /* ---- 13. een GEZIN loopt dezelfde lus langs een andere deur ------------ */
  const g = await ROLLEN.gezin.haal(basis);
  if (!g) throw new Error('geen gezinssessie');
  const gr = await post('/api/rtf/connect/ontdek', { code: g.code, token: g.token, vandaag: '2026-09-15' });
  schakel(15, 'een gezinsprofiel krijgt dezelfde motor langs een eigen deur',
    gr.status === 200 && ((gr.body || {}).plekken || []).length > 0,
    (((gr.body || {}).plekken) || []).length + ' plekken');

  /* ---- 14. een KIND komt niet voorbij `team` ----------------------------- */
  /* De KINDSESSIE gaat langs de echte inlog en niet langs een nagebouwd token:
     `profiel/maak` geeft het token met opzet niet terug (pubProfiel laat hem
     weg), dus het kind kiest zijn eigen profiel met zijn eigen pincode --
     precies zoals in de app. Een nagebouwde sessie meet je eigen aanname en
     niet de deur (scripts/lib/proefsessies.js). */
  const kind = await post('/api/foundation/gezin/profiel/maak',
    { code: g.code, token: g.token, naam: 'Kind', rol: 'kind', geboortedatum: '2016-04-04', pin: '4321' });
  const kiesbaar = ((kind.body || {}).profiel || {}).id;
  const kies = kiesbaar
    ? await post('/api/foundation/gezin/profiel/kies', { code: g.code, profielId: kiesbaar, pin: '4321' })
    : { body: {} };
  const kt = (kies.body || {}).token;
  let kindStand = 'open', kindDetail = 'geen kindsessie gekregen: ' + JSON.stringify((kies.body || {}).error || (kind.body || {}).error || kind.status);
  if (kt) {
    const naarPubliek = await post('/api/rtf/connect/kring', { code: g.code, token: kt, huidig: 'team', kring: 'publiek' });
    const terug = await post('/api/rtf/connect/kring', { code: g.code, token: kt, huidig: 'team', kring: 'alleenIk' });
    kindStand = naarPubliek.status !== 200 && terug.body && terug.body.ok === true && terug.body.versmald === true;
    kindDetail = 'publiek geweigerd (' + naarPubliek.status + '), versmallen lukt wel';
  }
  schakel(16, 'een minderjarig profiel gaat niet publiek, maar kan altijd versmallen', kindStand, kindDetail);

  /* ---- 15. lezen laat de opslag met rust --------------------------------- */
  /* Van buitenaf niet te zien, dus gemeten aan wat er WEL waarneembaar is: een
     verse mens die alleen leest, krijgt daarna nog steeds een leeg dossier en
     de standaardschuif. Zou het lezen een rij aanmaken, dan is dat hier niet
     zichtbaar -- daarom staat deze schakel ook in test/connect.test.js, waar de
     opslag zelf te lezen is. Hier toetst hij de waarneembare helft. */
  const c = await ROLLEN.lid.haal(basis);
  await post('/api/connect/horizon', {}, c);
  await post('/api/connect/dossier', {}, c);
  const na = await post('/api/connect/dossier', {}, c);
  const h = await post('/api/connect/horizon', {}, c);
  schakel(17, 'alleen lezen verandert niets aan de eigen stand',
    (na.body || {}).totaal === 0 && (h.body || {}).schuif === 40,
    'dossier ' + (na.body || {}).totaal + ' regels, schuif ' + (h.body || {}).schuif);

  /* ======================== DE STORINGEN ================================== */
  const s1 = await post('/api/connect/ontdek', {});
  storing(1, 'zonder inlog komt er niets uit', s1.status === 401, 'status ' + s1.status);

  const s2 = await post('/api/rtf/connect/ontdek', { code: g.code });
  storing(2, 'een gezinsdeur zonder token gaat niet open', s2.status === 403, 'status ' + s2.status);

  /* DEZE TWEE TOETSTEN EERST HET VERKEERDE, en allebei stonden ze op groen.
     Nummer 3 vroeg om de trede `gemaakt` en concludeerde uit de weigering dat
     de bron-eis werkte -- terwijl `gemaakt` door het SYSTEEM wordt geschreven
     en dus al op `wieSchrijft` afketste. Een geldige uitslag van het verkeerde
     experiment (BEWIJSMACHINE.md par. 6a). Hij toetst nu de grendel die hij
     bedoelde: van de zeven treden mag een mens er precies twee zelf zetten. */
  const zelfMag = await post('/api/connect/noteer', { trede: 'toegepast', onderwerp: 'koken' }, a);
  const zelfMagNiet = await post('/api/connect/noteer', { trede: 'geoefend', onderwerp: 'koken' }, a);
  storing(3, 'een mens zet alleen de treden die over hemzelf gaan',
    zelfMag.status === 200 && zelfMagNiet.status !== 200,
    'toegepast mag (' + zelfMag.status + '), geoefend niet (' + zelfMagNiet.status + '): ' +
    String((zelfMagNiet.body || {}).error || '').slice(0, 50));

  /* Nummer 4 gaf `maker` mee in het verzoek en las de weigering als bewijs. Dat
     veld bestaat niet meer -- zie schakel 8. Wat hier overblijft is de garantie
     die ook NA het sluiten van die schakel geldt: een ding waarvan het huis de
     maker niet kent (hier een verzonnen id) schrijft in NIEMANDS dossier. De
     opzoeking is de enige weg; er is geen achterdeur waarlangs de aanroeper
     alsnog een maker aanwijst. */
  const s4 = await post('/api/connect/naklank', { id: 'los-werk', soort: 'geholpen' }, a);
  storing(4, 'zonder vaststaande maker komt er geen regel in andermans dossier',
    s4.status === 200 && s4.body.dossier === null && !!s4.body.dossierReden,
    String((s4.body || {}).dossierReden || '').slice(0, 62));

  const s5 = await post('/api/connect/signaal', { onderwerp: 'iemand@ergens.nl', signaal: 'meer' }, a);
  storing(5, 'een contactgegeven wordt niet als voorkeur bewaard',
    s5.status !== 200, String((s5.body || {}).error || '').slice(0, 60));

  const s6 = await post('/api/connect/signaal', { onderwerp: 'koken', signaal: 'verras' }, a);
  const s6b = await post('/api/connect/horizon', {}, a);
  storing(6, '"verras me" verzet de instelling van de mens NIET',
    s6.body && s6.body.bewaard === false && (s6b.body || {}).schuif === 100,
    'eenmalig=' + (s6.body || {}).eenmalig + ', schuif blijft ' + (s6b.body || {}).schuif);

  const s7 = await post('/api/connect/uitleg', { werkwoord: 'beloon' }, a);
  storing(7, 'een werkwoord dat botst met een grens, wordt geweigerd MET de reden',
    s7.status === 200 && (s7.body.werkwoord || {}).bestaat === false && !!(s7.body.werkwoord || {}).reden,
    String((s7.body.werkwoord || {}).reden || '').slice(0, 60));

  const s8 = await post('/api/connect/schuif', { schuif: 400 }, a);
  storing(8, 'een schuif buiten bereik weigert in plaats van af te kappen',
    s8.status !== 200, String((s8.body || {}).error || '').slice(0, 50));

  const s9 = await post('/api/connect/naklank/weg', { id: 'nooit-gegeven', soort: 'mooi' }, a);
  storing(9, 'terugnemen wat er niet staat, is geen fout',
    s9.status === 200 && s9.body.ok === true && s9.body.weg === false, 'ok zonder dat er iets stond');

  const s10 = await post('/api/connect/ontdek', { vandaag: '2026-09-15' }, a);
  storing(10, 'zonder plaats meldt de laag dat, in plaats van stil niets lokaals te tonen',
    !!(s10.body || {}).plaatsGevraagd, String((s10.body || {}).plaatsGevraagd || '').slice(0, 55));
}

(async () => {
  const s = await ws.start({ naam: 'lusproef' });
  try { await proef(s.basis); } finally { s.klaar(); }

  console.log('\n  DE LUSPROEF -- Foundation Connect\n');
  for (const k of schakels) {
    const merk = k.stand === 'sluit' ? '  ok ' : k.stand === 'openBekend' ? ' open' : 'BREEK';
    console.log('  ' + merk + '  ' + String(k.nr).padStart(2) + '. ' + k.wat);
    if (k.detail) console.log('          ' + k.detail);
  }
  console.log('\n  STORINGEN\n');
  for (const k of storingen) {
    console.log('  ' + (k.stand === 'houdt' ? '  ok ' : 'BREEK') + '  ' + String(k.nr).padStart(2) + '. ' + k.wat);
    if (k.detail) console.log('          ' + k.detail);
  }
  const dicht = schakels.filter(k => k.stand === 'sluit').length;
  const open = schakels.filter(k => k.stand === 'openBekend').length;
  const stuk = schakels.filter(k => k.stand === 'BREEKT').length + storingen.filter(k => k.stand === 'BREEKT').length;
  console.log('\n  ' + dicht + ' van ' + schakels.length + ' schakels gesloten' + (open ? ', ' + open + ' open met reden' : '') +
    '; ' + storingen.filter(k => k.stand === 'houdt').length + ' van ' + storingen.length + ' storingen gehouden.\n');
  /* `sluit` en `sluitMetBevinding` worden nooit een cijfer, in de vorm van
     scripts/ritproef.js: een open schakel met een reden is geen breuk, en een
     breuk verdwijnt nooit in een gemiddelde. */
  process.exit(stuk ? 1 : 0);
})().catch(e => { console.error('\n  DE PROEF ZELF IS STUK:', e.message, '\n'); process.exit(2); });
