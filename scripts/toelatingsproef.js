#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE TOELATINGSPROEF -- de derde gouden keten, en waarom er een derde is.

   De tafelproef bewees dat een keten kan sluiten. De ritproef stelde de vraag
   die daarna telt: is er een GEDEELDE VORM? scripts/ketenvorm.js gaf daar een
   streng antwoord -- 0 van de 8 actoren gedeeld, 3 van de 8 beloftethema's, en
   die drie gaan alle drie over de MACHINE (herhaling, volgorde, wat niet bestaat
   bestaat niet) en niet over het domein.

   TWEE KETENS DRAGEN GEEN CONTRACT. Dat is de reden dat MAATSTAF.md U40 en U41
   (het status-, actor- en uitkomstcontract) niet uit twee metingen zijn
   afgeleid maar op een derde wachten. Drie punten liggen op een lijn of ze
   liggen dat niet; twee altijd.

   WAAROM DEZE KETEN. Hij moest maximaal ANDERS zijn, anders meet je hetzelfde
   nog een keer (dat was al de reden om de bezorging over te slaan: die deelt de
   rekening, de kaart en de keuken met de tafel). De toelating verschilt op vier
   assen tegelijk van beide voorgangers:

     - de klant is GEEN LID. Een aanvrager heeft geen account, geen zaak en geen
       sessie -- hij heeft alleen zijn aanvraagnummer;
     - er zit een KANTOOR in, en dus een mens van RTG die op naam tekent;
     - het gaat over een DOCUMENT met een houdbaarheid, niet over een gerecht of
       een auto: de keten kan verlopen zonder dat iemand iets doet;
     - de uitkomst is TOEGANG, niet een geleverde dienst.

   WAT DEZE KETEN NIET IS. Hij meet de aanmelding van een ZAAK in een
   gereguleerd genre, niet de ballotage van een lid en niet de aanmelding van
   een vrij genre (dat is dezelfde weg zonder de bewijsstap). Er komt geen
   browser aan te pas.

   Draaien:  npm run toelatingsproef        (print, zakt op een open schakel)
             npm run toelatingsproef:vast   (schrijft TOELATINGSPROEF.json)
   ============================================================================ */
const fs = require('fs');
const path = require('path');
const { start } = require('./lib/wegwerpserver');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'TOELATINGSPROEF.json');
const GENRE = 'apotheek';            // een van de acht genres met een bewijsstand
const VRIJ = 'hotel';                // een genre zonder bewijseis, voor storing 7
const KANTOOR = 'RTG-OFFICE-PROEF';
/* DE WERELD DIE DEZE PROEF ZELF KLAARZET: een mens achter de kantoordeur.

   De eerste ronde liep hierop vast, en dat was geen fout in de proef maar een
   ontdekking over de keten. Aftekenen en beslissen EISEN een naam ("een
   aftekening zonder naam is geen aftekening"), en `boardroomWie()` geeft die
   alleen als er een LID-account achter het kantoortoken hangt. Wie inlogt met
   de kale gedeelde kantoorcode heeft geen naam, en de hele keten staat dan stil
   bij schakel 4 -- met een nette melding, maar stil.

   Dat is een grens en geen gat, en zij hoort dus in de meting te zitten in
   plaats van eromheen: storing 1 meet precies dat geval. Voor de keten zelf
   zet de proef een echte mens klaar, zoals de ritproef een chauffeur klaarzet.
   De wereld klaarzetten is geen valsspelen; een uitslag klaarzetten wel. */
const EIGENAAR = { email: (process.env.RTG_OWNER_EMAIL || 'roellie.i@gmail.com'),
  /* In demostand maakt de opstart dit account zelf aan (server.js: createUserZaai
     met DEMO_PASS). Inloggen is dus de weg, en niet registreren -- die route
     weigert dit adres dan terecht met 409. */
  wachtwoord: process.env.DEMO_PASS || 'Imran',
  /* De eenmalige sleutel waarmee het eigenaarsadres zich mag registreren. Hij
     moet minstens zestien tekens zijn (routes/auth/aanmeldcontrole.js) en gaat
     alleen naar de WEGWERPSERVER van deze proef -- nooit naar een echte
     omgeving, en er staat niets in de repo dat hem daar zou zetten. */
  sleutel: 'proefsleutel-toelatingsketen-2026' };

async function post(basis, pad, lijf, tok, kop) {
  const r = await fetch(basis + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' },
      tok ? { Authorization: 'Bearer ' + tok } : {}, kop || {}),
    body: JSON.stringify(lijf || {})
  }).catch(() => null);
  if (!r) return { status: 0, data: null };
  return { status: r.status, data: await r.json().catch(() => null) };
}

const schakel = (nr, van, naar, wat, bekend) => ({ nr, van, naar, wat, bekend: bekend || null });

/* De aanvraag die deze proef steeds indient. Een naam met een nummer erin,
   zodat twee proeven op dezelfde database elkaar niet in de lijst verwarren. */
const aanvraagLijf = (genre, merk) => ({
  pas: 'business', naam: 'Proefaanvrager ' + merk, contact: 'proef+' + merk + '@rtg.test',
  viaUitnodiging: true,
  bedrijf: { naam: 'Proefzaak ' + merk, type: genre, plaats: 'Amsterdam' }
});

async function loop(basis, uit) {
  const P = (pad, lijf, tok, kop) => post(basis, pad, lijf, tok, kop);
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

  /* De kantoorsessie. Bewust GEEN gedeelde header maar dezelfde inlog die een
     medewerker gebruikt: storing 1 gaat juist over wat er gebeurt als er geen
     mens aan een kantoortoken hangt, en dat meet je niet met een verzonnen weg
     naar binnen. */
  const inlog = await P('/api/auth/login', { login: EIGENAAR.email, password: EIGENAAR.wachtwoord });
  const K = inlog.data && inlog.data.token;
  if (!K) throw new Error('geen eigenaarssessie (status ' + inlog.status + ': ' +
    ((inlog.data && inlog.data.error) || '?') + ') -- bestaat het demo-eigenaarsaccount?');
  uit.wereld = { keurder: 'ingelogd met het eigenaarsaccount (demostand); de gedeelde kantoorcode heeft geen ' +
    'naam en kan daarom niet aftekenen of beslissen -- zie storing 1 en 7',
    naamvorm: 'de naam die in het dossier belandt is een SLEUTEL (user-1), geen mensennaam' };
  const merk = String(Date.now()).slice(-6);

  /* 1 -- de aanvrager dient in. Ontvanger: het KANTOOR, in zijn wachtrij.

     Let op wie hier NIET inlogt. De aanvrager heeft geen token en geen sessie;
     dat is met opzet zo (een aspirant-apotheker is nog geen lid) en het is het
     scherpste verschil met de twee andere ketens, waar de klant altijd een
     sessie had. */
  let id = null;
  const r1 = await stap(schakel(1, 'aanvrager', 'kantoor',
    'een aanvraag indienen zonder account, en die komt in de wachtrij van het kantoor'),
  () => P('/api/aanmelding/aanvraag', aanvraagLijf(GENRE, merk)),
  async (r) => {
    id = r.data && r.data.aanmelding && r.data.aanmelding.id;
    const lijst = await P('/api/aanmelding/lijst', { status: 'in behandeling' }, K);
    const staat = ((lijst.data && lijst.data.aanmeldingen) || []).some(a => a.id === id);
    return { klopt: !!id && staat, wat: 'id ' + (id || 'geen') + ', in de wachtrij: ' + staat };
  });
  if (!r1 || !id) { uit.aanmelding = null; return; }
  uit.aanmelding = { id, genre: GENRE };

  /* 2 -- het kantoor ziet WELK stuk er nodig is, en niet alleen dat er iets
     nodig is. Een poort die zegt "er ontbreekt iets" zonder te zeggen wat,
     verplaatst het werk naar een telefoongesprek. */
  await stap(schakel(2, 'kantoor', 'kantoor',
    'de bewijsstand noemt het gevraagde stuk bij naam'),
  () => P('/api/aanmelding/bewijs/stand', { id }, K),
  async (r) => {
    const d = r.data || {};
    const tekst = JSON.stringify(d);
    return { klopt: /apotheek|vergunning|register/i.test(tekst) && d.stand !== 'niet nodig',
      wat: 'stand: ' + (d.stand || '?') + ', eis: ' + (d.eis || d.uitleg || '-') };
  });

  /* 3 -- de aanvrager dient het stuk in. Ontvanger: het kantoor. Deze route is
     PUBLIEK op het aanmeldnummer, en dat is een besluit met een reden: de
     aanvrager heeft nog geen enkele inlog. Storing 6 meet wat die keuze kost. */
  await stap(schakel(3, 'aanvrager', 'kantoor',
    'het stuk indienen op het aanmeldnummer, en het kantoor ziet het als "ingediend"'),
  () => P('/api/aanmelding/bewijs', { id, soort: 'Vergunning apotheek', nummer: 'AP-2026-001' }),
  async () => {
    const st = await P('/api/aanmelding/bewijs/stand', { id }, K);
    const d = st.data || {};
    return { klopt: /ingediend|wacht/i.test(JSON.stringify(d)) && !/afgetekend":\{/.test(JSON.stringify(d)),
      wat: 'stand na indienen: ' + (d.stand || '?') };
  });

  /* 4 -- een MENS van RTG tekent af, op naam. De kern eist die naam en weigert
     zonder; storing 1 meet dat apart. Hier telt of de naam ook TERUGKOMT: een
     aftekening die je later niet aan iemand kunt koppelen, is administratie. */
  await stap(schakel(4, 'keurder', 'dossier',
    'aftekenen op naam, en die naam staat daarna in het dossier'),
  () => P('/api/aanmelding/bewijs/teken', { id }, K),
  async (r) => {
    const b = (r.data && r.data.bewijs) || {};
    const naam = b.afgetekend && b.afgetekend.door;
    return { klopt: !!naam && String(naam).length > 1, wat: 'afgetekend door: ' + (naam || 'niemand') };
  });

  /* 5 -- het kantoor beslist over de pas. Ontvanger: de aanmelding zelf, met
     het besluit en de naam van wie het nam. */
  await stap(schakel(5, 'kantoor', 'aanvrager',
    'het besluit over de pas landt op de aanmelding, met de naam erbij'),
  () => P('/api/aanmelding/beslis', { id, besluit: 'geaccepteerd', contractEuro: 5000, notitie: 'proef' }, K),
  async () => {
    const een = await P('/api/aanmelding/een', { id }, K);
    const a = (een.data && (een.data.aanmelding || een.data)) || {};
    const wie = (a.besluit && (a.besluit.door || a.besluit.wie)) || null;
    return { klopt: /geaccepteerd/i.test(String(a.status || '')) && !!wie,
      wat: 'status: ' + (a.status || '?') + ', besloten door: ' + (wie || 'niemand') };
  });

  /* 6 -- de zaak wordt klaargezet. Dit is de UITKOMST van deze keten, en hij is
     iets anders dan bij de twee voorgangers: geen geleverde dienst maar
     TOEGANG. De eerste voldane termijn is de gebeurtenis die hem vrijgeeft. */
  await stap(schakel(6, 'kantoor', 'zaak',
    'de eerste voldane termijn zet de zaak klaar'),
  () => P('/api/aanmelding/termijn-voldaan', { id, maand: 1 }, K),
  async (r) => {
    const d = r.data || {};
    const tekst = JSON.stringify(d);
    return { klopt: /zaak|supplier|code/i.test(tekst), wat: 'antwoord: ' + tekst.slice(0, 160) };
  });

  /* 7 -- de herkeuring. De enige schakel in de drie ketens die door TIJD wordt
     getrokken en niet door een handeling: niemand doet iets, en toch verandert
     de stand. Een aparte aanvraag met een verlopen datum, want de eerste is
     inmiddels doorgezet. */
  await stap(schakel(7, 'tijd', 'kantoor',
    'een afgetekend stuk dat is verlopen, verschijnt op de herkeuringslijst'),
  async () => {
    const a = await P('/api/aanmelding/aanvraag', aanvraagLijf(GENRE, merk + 'v'));
    const vid = a.data && a.data.aanmelding && a.data.aanmelding.id;
    if (!vid) return { status: 500, data: { error: 'geen tweede aanvraag' } };
    uit.verlopenId = vid;
    await P('/api/aanmelding/bewijs', { id: vid, soort: 'Vergunning apotheek', nummer: 'AP-OUD', geldigTot: '2020-01-01' });
    return P('/api/aanmelding/bewijs/teken', { id: vid }, K);
  },
  async () => {
    const h = await P('/api/aanmelding/bewijs/herkeuring', { dagen: 60 }, K);
    const lijst = (h.data && h.data.herkeuring) || [];
    const rijen = Array.isArray(lijst) ? lijst : (lijst.verlopen || []).concat(lijst.binnenkort || []);
    const staat = rijen.some(x => x.id === uit.verlopenId || (x.aanmelding && x.aanmelding.id === uit.verlopenId));
    return { klopt: staat, wat: 'op de herkeuringslijst: ' + staat + ' (' + rijen.length + ' rijen)' };
  });
}

async function storingen(basis, uit) {
  const P = (pad, lijf, tok, kop) => post(basis, pad, lijf, tok, kop);
  /* De storingen draaien op de KALE kantoorcode, met opzet: dat is de stand
     waarin de meeste medewerkers binnenkomen, en de vraag is juist wat de
     keten dan doet. Waar een storing een naam nodig heeft, staat dat erbij. */
  const inlog = await P('/api/office/login', { code: KANTOOR });
  const K = inlog.data && inlog.data.token;
  const merk = String(Date.now()).slice(-5) + 's';
  const noteer = (naam, belofte, houdt, wat) =>
    uit.storingen.push({ naam, belofte, stand: houdt ? 'gehouden' : 'gebroken', wat });

  /* Een verse aanvraag per storing: een storing die op de resten van een vorige
     draait, meet die resten. */
  async function versAanvraag(genre, suffix) {
    const a = await P('/api/aanmelding/aanvraag', aanvraagLijf(genre, merk + suffix));
    return (a.data && a.data.aanmelding && a.data.aanmelding.id) || null;
  }

  const id1 = await versAanvraag(GENRE, '1');
  await P('/api/aanmelding/bewijs', { id: id1, soort: 'Vergunning', nummer: 'X1' });

  /* 1. "Een aftekening zonder naam is geen aftekening." De kern zegt dat
     letterlijk. Het kantoor logt in op een GEDEELDE code; dan is er niemand aan
     te wijzen, en dan hoort de aftekening te weigeren in plaats van op
     'RTG-personeel' terug te vallen -- dat is de fout die in de kop van
     routes/aanmeldingen.js staat beschreven en die daar is gerepareerd. */
  const zonderNaam = await P('/api/aanmelding/bewijs/teken', { id: id1 }, K);
  const b1 = zonderNaam.data && zonderNaam.data.bewijs;
  const naam1 = b1 && b1.afgetekend && b1.afgetekend.door;
  noteer('aftekenen vanaf de kale kantoorcode',
    'of het weigert, of het draagt de naam van een mens -- nooit een verzamelnaam',
    zonderNaam.status >= 400 || (!!naam1 && !/^RTG-personeel$/i.test(String(naam1))),
    'status ' + zonderNaam.status + ', naam: ' + (naam1 || 'geen'));

  /* 2. "Een ingediend stuk is geen bewijs" (CLAUDE.md). Zonder aftekening komt
     er geen zaak, ook niet als de termijn is voldaan. */
  const id2 = await versAanvraag(GENRE, '2');
  await P('/api/aanmelding/bewijs', { id: id2, soort: 'Vergunning', nummer: 'X2' });
  await P('/api/aanmelding/beslis', { id: id2, besluit: 'geaccepteerd', contractEuro: 5000 }, K);
  const zonderTeken = await P('/api/aanmelding/termijn-voldaan', { id: id2, maand: 1 }, K);
  const tekst2 = JSON.stringify(zonderTeken.data || {});
  noteer('een ingediend maar niet afgetekend stuk',
    'zet geen zaak klaar; een mens van RTG moet het gezien hebben',
    !/"code":"[A-Z0-9]/.test(tekst2) || /wacht|bewijs|niet/i.test(tekst2),
    'antwoord: ' + tekst2.slice(0, 160));

  /* 3. Twee keer aftekenen. Een herhaling die WORDT GEWEIGERD is een
     toestandscontrole en geen idempotentie (MUTATIECONTRACT.md), en dat is hier
     het goede gedrag: een tweede aftekening zou een tweede mens suggereren. */
  const id3 = await versAanvraag(GENRE, '3');
  await P('/api/aanmelding/bewijs', { id: id3, soort: 'Vergunning', nummer: 'X3' });
  /* Deze storing gaat over de HERHALING en niet over de naam, dus hij tekent
     met een genoemde mens; anders zou hij groen staan omdat allebei de pogingen
     op de naamloosheid stukliepen -- de tafelproef had precies die fout. */
  const M = (await P('/api/auth/login', { login: EIGENAAR.email, password: EIGENAAR.wachtwoord })).data;
  const N = M && M.token;
  const eerste = await P('/api/aanmelding/bewijs/teken', { id: id3 }, N);
  const tweede = await P('/api/aanmelding/bewijs/teken', { id: id3 }, N);
  noteer('twee keer aftekenen',
    'de tweede wordt geweigerd met een reden, en overschrijft de eerste nooit',
    eerste.status === 200 && tweede.status >= 400,
    'eerste ' + eerste.status + ', tweede ' + tweede.status +
      (tweede.data && tweede.data.error ? ' -- ' + tweede.data.error : ''));

  /* 4. Bewijs indienen bij een genre dat het niet vraagt. Een restaurant hoort
     geen leeg vakje te zien, en zeker geen stap die niets doet. */
  const id4 = await versAanvraag(VRIJ, '4');
  const nietNodig = await P('/api/aanmelding/bewijs', { id: id4, soort: 'Iets', nummer: 'X4' });
  noteer('een stuk indienen waar het genre er geen vraagt',
    'wordt geweigerd met de mededeling dat het niet nodig is',
    nietNodig.status >= 400 && /niet nodig|geen bewijs/i.test(String((nietNodig.data && nietNodig.data.error) || '')),
    'status ' + nietNodig.status + ' -- ' + ((nietNodig.data && nietNodig.data.error) || ''));

  /* 5. Een aanmeldnummer raden. De indien-route is publiek; de vraag is dus of
     zij iets teruggeeft waaraan je kunt zien dat een aanvraag BESTAAT of van
     wie hij is. Zo niet, dan is het publieke pad geen lek maar een keuze. */
  const geraden = await P('/api/aanmelding/bewijs', { id: 'zomaar-een-id', soort: 'X', nummer: 'Y' });
  const lek = JSON.stringify(geraden.data || {});
  noteer('een aanmeldnummer raden op de publieke route',
    'levert geen gegevens over de aanvraag of de aanvrager',
    !/naam|contact|pas|bedrijf/i.test(lek),
    'status ' + geraden.status + ', antwoord: ' + lek.slice(0, 120));

  /* 6. De wachtrij achter de kantoorpoort. Zonder code hoort er niets uit te
     komen -- ook geen lege lijst met een 200, want dan is het bestaan van de
     route zelf al een antwoord. */
  const zonderCode = await P('/api/aanmelding/lijst', {});
  noteer('de wachtrij opvragen zonder kantoorcode',
    'wordt geweigerd en geeft geen lijst',
    zonderCode.status >= 400 && !(zonderCode.data && zonderCode.data.aanmeldingen),
    'status ' + zonderCode.status);

  /* 7. Een akkoord op een contractuele pas zonder bedrag. PRIJZEN.md: een bodem
     is geen prijs, en een contractpas heeft geen lijstprijs -- dus mag er geen
     akkoord ontstaan waar niemand een bedrag heeft afgesproken. */
  const id7 = await versAanvraag(GENRE, '7');
  const zonderBedrag = await P('/api/aanmelding/beslis', { id: id7, besluit: 'geaccepteerd' }, K);
  noteer('akkoord op een contractuele pas zonder afgesproken bedrag',
    'wordt geweigerd; een contractpas heeft geen lijstprijs om op terug te vallen',
    zonderBedrag.status >= 400,
    'status ' + zonderBedrag.status + ' -- ' + ((zonderBedrag.data && zonderBedrag.data.error) || ''));
}

async function meet() {
  const uit = {
    stempel: new Date().toISOString().slice(0, 10),
    uitleg: 'De toelatingsketen van een zaak in een gereguleerd genre: aanvraag, bewijs, aftekenen, besluit, zaak, herkeuring. Gemeten per SCHAKEL (handelt actor A, en ziet actor B dat?) en per STORING (houdt de keten zijn belofte als het misgaat?). Derde keten naast tafelproef en ritproef -- zie MAATSTAF.md par. 7.',
    grens: 'Alleen de zaakaanmelding in een gereguleerd genre; de ballotage van een LID en een vrij genre lopen anders. Geen browser. Dat het geld werkelijk binnenkomt is niet gemeten: de termijn wordt administratief afgetekend.',
    genre: GENRE, schakels: [], storingen: [], aanmelding: null, wereld: null
  };
  const srv = await start({ naam: 'toelatingsproef', gereed: 'ready',
    env: { NODE_ENV: 'test', RTG_DEMO: '1', OFFICE_CODE: KANTOOR,
      RTG_OWNER_BOOTSTRAP: EIGENAAR.sleutel } });
  try {
    await loop(srv.basis, uit);
    await storingen(srv.basis, uit);
  } finally { srv.klaar(); }

  const t = { schakels: uit.schakels.length, gesloten: 0, open: 0, openBekend: 0, stuk: 0,
    storingen: uit.storingen.length, gehouden: 0, gebroken: 0 };
  for (const s of uit.schakels) t[s.stand]++;
  for (const s of uit.storingen) t[s.stand]++;
  uit.telling = t;
  uit.sluit = t.open === 0 && t.stuk === 0 && t.gebroken === 0 && t.openBekend === 0 && t.schakels >= 7;
  uit.sluitMetBevinding = t.open === 0 && t.stuk === 0 && t.gebroken === 0 && t.schakels >= 7;
  uit.bevindingen = uit.schakels.filter(s => s.stand === 'openBekend')
    .map(s => ({ schakel: s.nr, van: s.van, naar: s.naar, wat: s.wat, gemeten: s.ziet, reden: s.bekend }));
  return uit;
}

function druk(u) {
  console.log('toelatingsproef: ' + u.telling.schakels + ' schakels (' + u.telling.gesloten + ' gesloten, ' +
    u.telling.openBekend + ' open met reden, ' + u.telling.open + ' open, ' + u.telling.stuk + ' stuk), ' +
    u.telling.storingen + ' storingen (' + u.telling.gehouden + ' gehouden, ' + u.telling.gebroken + ' gebroken).');
  for (const s of u.schakels)
    console.log('  ' + String(s.nr).padStart(2) + ' ' + (s.van + '->' + s.naar).padEnd(22) +
      s.stand.padEnd(11) + s.wat + (s.ziet ? '\n      ziet: ' + s.ziet : '') +
      (s.bekend ? '\n      BEVINDING: ' + s.bekend : '') +
      (s.antwoord ? '\n      antwoord: ' + s.antwoord : '') + (s.fout ? '\n      FOUT: ' + s.fout : ''));
  for (const s of u.storingen)
    console.log('  -- ' + s.stand.padEnd(9) + s.naam + '\n      belooft: ' + s.belofte + '\n      gaf: ' + s.wat);
  console.log(u.sluit ? '\nDe keten sluit.'
    : u.sluitMetBevinding ? '\nDe keten loopt door, met ' + u.telling.openBekend + ' bevinding(en) die een besluit vragen.'
      : '\nDE KETEN SLUIT NIET.');
}

module.exports = { meet, DOEL, GENRE };

if (require.main === module) {
  meet().then(u => {
    if (process.argv.includes('--json')) { console.log(JSON.stringify(u)); process.exitCode = u.sluitMetBevinding ? 0 : 1; return; }
    druk(u);
    if (process.argv.includes('--vastleggen')) {
      fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
      console.log('geschreven: TOELATINGSPROEF.json');
    }
    process.exit(u.sluitMetBevinding ? 0 : 1);
  }).catch(e => { console.error('de toelatingsproef kon niet draaien: ' + (e && e.message || e)); process.exit(1); });
}
