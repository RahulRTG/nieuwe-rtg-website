#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE ZAAK-LIVE-PROEF -- de vierde gouden keten: van goedgekeurde aanvraag naar
   een zaak die een lid werkelijk kan zien.

   WAAROM DEZE KETEN, EN WAAROM HIJ NIET DE TOELATING OVERDOET. De toelatings-
   proef eindigt op schakel 6: "de eerste voldane termijn zet de zaak klaar".
   Daar houdt hij op, en precies daar begint dit. De naad is scherp: de
   toelating gaat over het KANTOOR dat een zaak toelaat, deze over de
   ONDERNEMER die zijn eigen zaak bruikbaar en zichtbaar maakt. Er zit geen
   medewerker van RTG in deze keten -- na de goedkeuring doet de ondernemer het
   zelf, en dat is de eerste ervaring van elke betalende ondernemer.

   Hij verschilt ook op de assen die scripts/ketenvorm.js meet:

     - de uitkomst is ZICHTBAARHEID, niet een dienst (tafel), niet een rit, en
       niet toegang voor de aanvrager (toelating): het is toegang voor DERDEN,
       namelijk de leden die de zaak mogen vinden;
     - de actor die de keten voltooit is de KLANT ZELF, niet een medewerker;
     - er wordt niets geleverd en niets betaald; wat verandert is een
       zichtbaarheidsgrens;
     - hij loopt over twee apps: de partner-app en de leden-app, en de
       controle gebeurt aan de LEDENkant. Een keten die zijn eigen uitkomst
       bevestigt, bevestigt niets (dat was de fout in schakel 9 van de
       tafelproef).

   DE WERELD DIE DEZE PROEF KLAARZET. Een vers lid dat ondernemer wordt, een
   kantoor dat zijn aanvraag goedkeurt, en de zaak die daaruit ontstaat. Dat
   voorwerk is met opzet GEEN schakel: het is de toelatingsketen, en die is
   elders al beproefd. Wie hem hier nog eens telt, meet twee keer hetzelfde.

   DE ONDERNEMER LOGT IN MET ZIJN EIGEN RTG-ACCOUNT (/api/supplier/mijn/login)
   en niet met de gedeelde bedrijfsinlog. Dat is niet netter maar WAARHEIDS-
   GETROUWER: de gedeelde inlog werkt alleen in demostand en de route zegt zelf
   dat hij dicht is. Een keten die op een demo-ingang leunt, bewijst de
   productieweg niet.

   GEEN GEDEELDE MODULE MET DE ANDERE DRIE PROEVEN. Dat is een besluit en geen
   slordigheid: scripts/ketenvorm.js telt achteraf wat de ketens werkelijk
   delen, en dat telwerk is waardeloos zodra ze uit dezelfde mal komen. Dezelfde
   reden als waarom `Asset` hier sneuvelde.

   Draaien:  npm run zaakliveproef        (print, zakt op een open schakel)
             npm run zaakliveproef:vast   (schrijft ZAAKLIVEPROEF.json)
   ============================================================================ */
const fs = require('fs');
const path = require('path');
const { start } = require('./lib/wegwerpserver');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'ZAAKLIVEPROEF.json');
const GENRE = 'hotel';               // een vrij genre: geen bewijsstuk nodig
const KANTOOR = 'RTG-OFFICE-PROEF';
/* Het eigenaarsaccount is hier het KANTOOR (de keurder), niet de ondernemer.
   In demostand maakt de opstart dit account zelf aan; inloggen is dus de weg. */
const KEURDER = { email: process.env.RTG_OWNER_EMAIL || 'roellie.i@gmail.com',
                  wachtwoord: process.env.DEMO_PASS || 'Imran' };
/* Een 1x1 PNG. De Salon-pagina eist een FOTO en niet een mooie foto; een echte
   afbeelding meeslepen zou de proef aan een bestand binden dat niets bewijst. */
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const BIO = 'Een klein proefhotel aan de gracht, acht kamers en een binnentuin.';

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

/* De wereld: een vers lid, zijn aanvraag, en de zaak die daaruit ontstaat.
   Alles hier is VOORBEREIDING. Faalt het, dan kan de proef niet draaien en dat
   is een storing van het instrument -- geen uitslag over de keten. */
async function wereld(basis, merk) {
  const P = (pad, lijf, tok) => post(basis, pad, lijf, tok);
  const mail = 'onderneem+' + merk + '@rtg.test';
  const pw = 'ProefWachtwoord1';
  const reg = await P('/api/auth/register',
    { name: 'Proef Ondernemer', email: mail, password: pw, geboortedatum: '1985-04-12' });
  const O = reg.data && reg.data.token;
  if (!O) throw new Error('geen ondernemerssessie (status ' + reg.status + ': ' + ((reg.data && reg.data.error) || '?') + ')');
  /* Een TWEEDE lid: de verkeerde actor. Hij bestaat alleen voor de storingen,
     en hij wordt hier gemaakt zodat geen enkele storing op de resten van een
     vorige draait. */
  const mail2 = 'vreemde+' + merk + '@rtg.test';
  const reg2 = await P('/api/auth/register',
    { name: 'Proef Vreemde', email: mail2, password: pw, geboortedatum: '1990-02-02' });
  const V = reg2.data && reg2.data.token;

  const keur = await P('/api/auth/login', { login: KEURDER.email, password: KEURDER.wachtwoord });
  const K = keur.data && keur.data.token;
  if (!K) throw new Error('geen keurderssessie -- bestaat het demo-eigenaarsaccount?');

  const aan = await P('/api/aanmelding/aanvraag', { pas: 'business', naam: 'Proef Ondernemer',
    contact: mail, viaUitnodiging: true,
    bedrijf: { naam: 'Proefhotel ' + merk, type: GENRE, plaats: 'Amsterdam' } }, O);
  const id = aan.data && aan.data.aanmelding && aan.data.aanmelding.id;
  if (!id) throw new Error('geen aanmelding (status ' + aan.status + ')');
  await P('/api/aanmelding/beslis', { id, besluit: 'geaccepteerd', contractEuro: 5000 }, K);
  const t = await P('/api/aanmelding/termijn-voldaan', { id, maand: 1 }, K);
  const code = t.data && t.data.zaak && t.data.zaak.code;
  if (!code) throw new Error('de zaak is niet klaargezet (status ' + t.status + ': ' + JSON.stringify(t.data).slice(0, 160) + ')');
  return { mail, mail2, pw, O, V, K, id, code };
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

  let S = null; // de sessie van de ondernemer OP zijn zaak

  /* 1 -- de ondernemer komt zijn eigen zaak binnen, met zijn eigen RTG-account.
     Dit is de eerste keer dat hij iets van zijn bedrijf ziet. Het bewijs is
     niet dat er een token terugkomt maar dat hij op de JUISTE zaak landt en
     als manager: een ondernemer die als medewerker binnenkomt, kan zijn eigen
     zaak niet inrichten. */
  await stap(schakel(1, 'ondernemer', 'zaak',
    'met het eigen RTG-account op de eigen zaak landen, als manager'),
  () => P('/api/supplier/mijn/login', { login: w.mail, password: w.pw, bedrijf: w.code }),
  async (r) => {
    S = r.data && r.data.token;
    const sup = r.data && r.data.supplier;
    const act = r.data && r.data.actor;
    return { klopt: !!S && sup && sup.code === w.code && act && act.manager === true,
      wat: 'zaak ' + ((sup && sup.code) || '?') + ', rol ' + ((act && act.role) || '?') };
  });
  if (!S) return;

  /* 2 -- de zaak vertelt wat er nog moet gebeuren, EN WAAROM. Dit is de enige
     schakel in de vier ketens die over BEGRIJPELIJKHEID gaat, en hij toetst
     daarom het enige wat daarvan machinaal te toetsen is: draagt elke openstaande
     stap een eigen uitleg, of alleen een vinkje? Een checklist zonder reden
     verplaatst het werk naar een telefoongesprek. */
  await stap(schakel(2, 'zaak', 'ondernemer',
    'de poort noemt elke openstaande stap MET een uitleg waarom hij nodig is'),
  () => P('/api/supplier/poort', {}, S),
  async (r) => {
    const st = (r.data && r.data.stappen) || [];
    const open = st.filter(x => !x.klaar);
    const metUitleg = open.filter(x => typeof x.tekst === 'string' && x.tekst.trim().length > 10);
    return { klopt: open.length > 0 && metUitleg.length === open.length,
      wat: open.length + ' open stap(pen), ' + metUitleg.length + ' met uitleg' };
  });

  /* 3 -- de werkvormen worden AFGELEID en niet gezet. Een hotel hoort de
     verblijfs-tools te krijgen zonder dat iemand een pakket aanzet; dat is de
     belofte van kern/werkvormen.js ("geen migratie, geen schakelaar die iemand
     vergeet"). Het bewijs is dat de vorm er staat EN dat hij niet handmatig is. */
  await stap(schakel(3, 'zaak', 'systeem',
    'de werkvormen volgen uit wat de zaak IS, zonder dat iemand iets aanzet'),
  () => P('/api/supplier/werkvormen', {}, S),
  async (r) => {
    const v = (r.data && r.data.vormen) || [];
    const verblijf = v.find(x => x.id === 'verblijf');
    return { klopt: !!verblijf && verblijf.handmatig === false,
      wat: v.map(x => x.id + (x.handmatig ? '(handmatig)' : '')).join(', ') || 'geen' };
  });

  /* 4 -- de etalage vullen. De Salon-pagina is de enige inrichting die RTG
     VERPLICHT stelt voordat leden een zaak zien. */
  await stap(schakel(4, 'ondernemer', 'etalage',
    'de Salon-pagina vullen, en de zaak bevestigt dat hij compleet is'),
  () => P('/api/supplier/salon/bio', { bio: BIO, foto: PIXEL }, S),
  async (r) => ({ klopt: r.data && r.data.compleet === true,
    wat: 'compleet: ' + (r.data && r.data.compleet) }));

  /* 5 -- DE SCHAKEL WAAR HET OM DRAAIT, en hij staat met opzet VOOR het online
     zetten. De vraag is niet of de knop werkt maar of de POORT iets tegenhoudt:
     staat de zaak al in de etalage van een lid terwijl de verplichte
     rondleidingen niet gevolgd zijn?

     kern/ondernemerpoort.js belooft letterlijk: "Zo staat er nooit een lege of
     half-ingerichte zaak in de app." Deze schakel toetst die zin. */
  await stap(schakel(5, 'poort', 'etalage',
    'zolang de verplichte rondleidingen niet gevolgd zijn, ziet een lid de zaak niet'),
  () => P('/api/supplier/poort', {}, S),
  async (r) => {
    const klaar = r.data && r.data.klaar;
    const zien = await P('/api/salon/profiel', { code: w.code }, w.O);
    const zichtbaar = zien.status === 200;
    uit.poort = { klaarNaSalon: klaar, zichtbaarNaSalon: zichtbaar,
      rondleidingen: ((r.data && r.data.rondleidingen) || []).map(x => x.id + ':' + x.klaar).join(', ') };
    /* De poort houdt zijn belofte als OFWEL de poort klaar is (dan mag hij
       zichtbaar zijn) OFWEL de zaak nog niet zichtbaar is. */
    return { klopt: klaar === true || !zichtbaar,
      wat: 'poort klaar: ' + klaar + ', lid ziet de zaak: ' + (zichtbaar ? 'JA' : 'nee') +
           ' (' + uit.poort.rondleidingen + ')' };
  });

  /* 6 -- de rondleidingen. Ze zijn het enige inhoudelijke dat de poort van de
     ondernemer vraagt, en ze horen daarna ook echt afgetikt te STAAN. */
  await stap(schakel(6, 'ondernemer', 'poort',
    'de twee verplichte rondleidingen aftikken, en de poort staat daarna op klaar'),
  async () => {
    await P('/api/supplier/poort/rondleiding', { id: 'kassa' }, S);
    return P('/api/supplier/poort/rondleiding', { id: 'werk' }, S);
  },
  async (r) => {
    const d = r.data || {};
    const verplicht = (d.rondleidingen || []).filter(x => x.verplicht);
    return { klopt: d.klaar === true && verplicht.every(x => x.klaar),
      wat: 'klaar: ' + d.klaar + ', verplicht gevolgd: ' + verplicht.filter(x => x.klaar).length + '/' + verplicht.length };
  });

  /* 7 -- online zetten. Nu pas mag het, en nu moet het ook lukken. */
  await stap(schakel(7, 'ondernemer', 'publiek',
    'de zaak online zetten lukt zodra de poort klaar is'),
  () => P('/api/supplier/poort/online', { online: true }, S),
  async (r) => ({ klopt: r.data && r.data.online === true && r.data.onlineGezet === true,
    wat: 'online: ' + (r.data && r.data.online) }));

  /* 8 -- DE UITKOMST, en hij wordt aan de LEDENkant gemeten. Een zaak die
     zichzelf online noemt, bewijst niets; het gaat erom dat een ander mens in
     een andere app hem werkelijk kan openen. */
  await stap(schakel(8, 'zaak', 'lid',
    'een lid opent de etalage van de zaak en ziet de ingevulde bio'),
  () => P('/api/salon/profiel', { code: w.code }, w.O),
  async (r) => {
    const bio = r.data && (r.data.bio || (r.data.partner && r.data.partner.bio) || (r.data.salon && r.data.salon.bio));
    return { klopt: String(bio || '').includes('proefhotel'),
      wat: 'bio bij het lid: ' + String(bio || 'geen').slice(0, 60) };
  });

  /* 9 -- PERSISTENT. Een verse sessie, een nieuwe inlog, dezelfde werkelijkheid.
     Dit is de goedkoopste schakel en de meest overgeslagen: een stand die alleen
     in het geheugen van de lopende sessie bestaat, ziet er tot de eerste
     herlaadbeurt identiek uit. */
  await stap(schakel(9, 'ondernemer', 'zaak',
    'na een nieuwe inlog staat dezelfde poortstand er nog'),
  () => P('/api/supplier/mijn/login', { login: w.mail, password: w.pw, bedrijf: w.code }),
  async (r) => {
    const S2 = r.data && r.data.token;
    if (!S2) return { klopt: false, wat: 'geen tweede sessie' };
    const pb = await P('/api/supplier/poort', {}, S2);
    const d = pb.data || {};
    return { klopt: d.klaar === true && d.online === true,
      wat: 'na herinloggen -- klaar: ' + d.klaar + ', online: ' + d.online };
  });
}

async function storingen(basis, uit, w) {
  const P = (pad, lijf, tok) => post(basis, pad, lijf, tok);
  const noteer = (naam, belofte, houdt, wat) =>
    uit.storingen.push({ naam, belofte, stand: houdt ? 'gehouden' : 'gebroken', wat });
  const S = (await P('/api/supplier/mijn/login', { login: w.mail, password: w.pw, bedrijf: w.code })).data;
  const tok = S && S.token;

  /* 1. Een onbekende rondleiding. Een poort die alles aanneemt wat er langskomt,
     kan later niet zeggen wat er gevolgd is. */
  const raar = await P('/api/supplier/poort/rondleiding', { id: 'bestaat-niet' }, tok);
  noteer('een rondleiding die niet bestaat aftikken',
    'wordt geweigerd met een reden, en verschijnt nooit in de lijst',
    raar.status >= 400, 'status ' + raar.status + ' -- ' + ((raar.data && raar.data.error) || ''));

  /* 2. Twee keer online zetten. Een herhaling mag geen tweede werkelijkheid
     maken (MUTATIECONTRACT.md); hier hoort hij gewoon hetzelfde antwoord te
     geven, want de stand is al bereikt. */
  const een = await P('/api/supplier/poort/online', { online: true }, tok);
  const twee = await P('/api/supplier/poort/online', { online: true }, tok);
  noteer('twee keer online zetten',
    'levert dezelfde stand op, geen tweede zaak en geen fout',
    een.status === 200 && twee.status === 200 &&
      JSON.stringify(een.data && een.data.stappen) === JSON.stringify(twee.data && twee.data.stappen),
    'eerste ' + een.status + ', tweede ' + twee.status);

  /* 3. DE VERKEERDE ACTOR. Een ander lid mag deze zaak niet binnenkomen, ook
     niet met een geldig eigen account. Dit is de scherpste storing van de
     keten: hij toetst niet of de deur op slot zit maar of hij op de JUISTE
     zaak op slot zit. */
  const vreemd = await P('/api/supplier/mijn/login', { login: w.mail2, password: w.pw, bedrijf: w.code });
  noteer('een ander lid logt in op deze zaak',
    'wordt geweigerd: hij staat hier niet op het rooster',
    vreemd.status >= 400, 'status ' + vreemd.status + ' -- ' + ((vreemd.data && vreemd.data.error) || ''));

  /* 4. Een lidsessie op een partnerroute. Twee apps, twee sleutels; een
     ledentoken hoort de partner-app niet te openen. */
  const kruis = await P('/api/supplier/poort', {}, w.V);
  noteer('een ledentoken op een partnerroute',
    'opent de partner-app niet',
    kruis.status >= 400, 'status ' + kruis.status);

  /* 5. OMKEERBAAR. De ondernemer pauzeert zijn zaak, en dan hoort hij ook
     werkelijk uit de etalage van het lid te verdwijnen -- niet alleen uit zijn
     eigen scherm. Weer aanzetten brengt hem terug. */
  await P('/api/supplier/poort/online', { online: false }, tok);
  const weg = await P('/api/salon/profiel', { code: w.code }, w.O);
  await P('/api/supplier/poort/online', { online: true }, tok);
  const terug = await P('/api/salon/profiel', { code: w.code }, w.O);
  noteer('de zaak pauzeren en weer aanzetten',
    'pauzeren haalt hem bij het LID weg, aanzetten brengt hem terug',
    weg.status === 404 && terug.status === 200,
    'gepauzeerd: lid kreeg ' + weg.status + ', na aanzetten: ' + terug.status);

  /* 6. AUDITBAAR. Wie zette deze zaak online? Een zichtbaarheidsgrens die
     verschuift zonder spoor, is later niet uit te leggen. */
  const spoor = await P('/api/supplier/activity', {}, tok);
  const rijen = JSON.stringify((spoor.data && (spoor.data.activity || spoor.data.rijen || spoor.data)) || '');
  noteer('het spoor van de livegang',
    'het logboek van de zaak noemt wie haar online zette',
    spoor.status === 200 && /online/i.test(rijen),
    'status ' + spoor.status + ', "online" in het spoor: ' + /online/i.test(rijen));

  /* 7. Een niet-ingelogd lid. De etalage van een zaak is geen open web. */
  const anoniem = await P('/api/salon/profiel', { code: w.code });
  noteer('de etalage opvragen zonder inlog',
    'wordt geweigerd; de Salon is voor leden',
    anoniem.status >= 400, 'status ' + anoniem.status);

  /* 8. Een zaak die niet bestaat. "Wat niet bestaat, bestaat niet" -- en het
     antwoord mag niet verraden of een code wel of niet in gebruik is op een
     andere manier dan een gewone 404. */
  const spook = await P('/api/salon/profiel', { code: 'BESTAATNIET' }, w.O);
  noteer('de etalage van een zaak die niet bestaat',
    'geeft dezelfde 404 als een zaak die nog niet zichtbaar is',
    spook.status === 404, 'status ' + spook.status);
}

async function meet() {
  const uit = { stempel: new Date().toISOString().slice(0, 10),
    uitleg: 'Van goedgekeurde aanvraag naar een zaak die een lid werkelijk kan zien. ' +
      'De toelatingsketen ervoor is hier WERELD en geen schakel; die is elders beproefd.',
    grens: 'Geen browser, geen betaling. De proef meet de partner-app en de ledenkant van EEN zaak ' +
      'in een vrij genre (hotel); een gereguleerd genre loopt eerst door de toelatingsketen.',
    genre: GENRE, schakels: [], storingen: [], poort: null };
  const srv = await start({ naam: 'zaakliveproef', gereed: 'ready',
    env: { NODE_ENV: 'test', RTG_DEMO: '1', OFFICE_CODE: KANTOOR } });
  try {
    const merk = String(Date.now()).slice(-6);
    const w = await wereld(srv.basis, merk);
    uit.zaak = { code: w.code, genre: GENRE, aanmelding: w.id };
    await loop(srv.basis, uit, w);
    await storingen(srv.basis, uit, w);
  } finally { srv.klaar(); }

  const t = { schakels: uit.schakels.length, gesloten: 0, open: 0, openBekend: 0, stuk: 0,
    storingen: uit.storingen.length, gehouden: 0, gebroken: 0 };
  for (const s of uit.schakels) t[s.stand]++;
  for (const s of uit.storingen) t[s.stand]++;
  uit.telling = t;
  uit.sluit = t.open === 0 && t.stuk === 0 && t.gebroken === 0 && t.openBekend === 0 && t.schakels >= 9;
  uit.sluitMetBevinding = t.open === 0 && t.stuk === 0 && t.gebroken === 0 && t.schakels >= 9;
  uit.bevindingen = uit.schakels.filter(s => s.stand === 'openBekend')
    .map(s => ({ schakel: s.nr, van: s.van, naar: s.naar, wat: s.wat, gemeten: s.ziet, reden: s.bekend }));
  return uit;
}

function druk(u) {
  console.log('zaakliveproef: ' + u.telling.schakels + ' schakels (' + u.telling.gesloten + ' gesloten, ' +
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
      console.log('geschreven: ZAAKLIVEPROEF.json');
    }
    process.exit(u.sluitMetBevinding ? 0 : 1);
  }).catch(e => { console.error('de zaakliveproef kon niet draaien: ' + (e && e.message || e)); process.exit(1); });
}
