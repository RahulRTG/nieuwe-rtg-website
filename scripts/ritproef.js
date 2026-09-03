#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE RITPROEF -- de tweede gouden keten, en de reden dat er een tweede is.

   WAAROM DEZE EN NIET DE BEZORGING. De tafelproef bewees dat één keten kan
   sluiten. De vraag die daarna telt is een andere: is er een GEDEELDE VORM, of
   is elke keten zijn eigen ding? Die vraag beantwoord je niet met een tweede
   horecaketen (bezorging deelt de rekening, de kaart en de keuken met de tafel
   -- dan meet je bijna hetzelfde nog een keer), maar met een keten in een ander
   domein. Vandaar de rit.

   EN DE VORM WORDT GEMETEN, NIET VERKLAARD. Deze proef is met opzet in dezelfde
   vorm geschreven als scripts/tafelproef.js -- schakels met een van/naar, en
   storingen met een belofte -- maar er is geen gedeelde module. Dat zou de fout
   van `Asset` zijn: een gedeeld type verklaren voordat er twee zijn die het
   echt delen (DEVELOPERCLOUD.md par. 2, OBJECTMODEL.json). Wat de twee ketens
   werkelijk delen, telt scripts/ketenvorm.js achteraf uit de twee registers.

   WAT DEZE KETEN ANDERS DOET DAN DE TAFEL, en dat is precies waarom hij nuttig
   is als tweede meting:

     - de VOLGORDE is omgedraaid: hier wordt eerst betaald en dan geleverd
       (`ride/assign` weigert met 409 zolang de rit niet betaald is), aan tafel
       eet je eerst;
     - de standen zijn een KETEN die alleen vooruit mag (kern/vervoer.js
       RIT_KETEN), waar een horecaregel terug kan met een reden;
     - de klant ziet de naam van de WERKER, en dat is hier juist goed: je stapt
       bij iemand in de auto. Aan tafel gaat de naam van de bediening met opzet
       NIET naar de gast (kern/horeca/correctie.js);
     - de klant heet een CODENAAM richting de vervoerder (privacy by design),
       waar de gast aan tafel een zelfgekozen handle draagt.

   Draaien:  npm run ritproef              (print, zakt op een open schakel)
             npm run ritproef:vast         (schrijft RITPROEF.json)
   ============================================================================ */
const fs = require('fs');
const path = require('path');
const { start } = require('./lib/wegwerpserver');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'RITPROEF.json');
const VERVOERDER = 'ISLATR';                  // de vervoerszaak uit de seed
/* Een BESTEMMING met een locatie op de kaart. De appbrug kan een vrije tekst
   niet naar een plek vertalen (kern/mobiliteit/plekken.js), en storing 7 meet
   dat geval apart; hier hoort de keten wel door te lopen. */
const BESTEMMING = 'KIKUNOI';

async function post(basis, pad, lijf, tok) {
  const r = await fetch(basis + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(lijf || {})
  }).catch(() => null);
  if (!r) return { status: 0, data: null };
  return { status: r.status, data: await r.json().catch(() => null) };
}

function schakel(nr, van, naar, wat, bekend) { return { nr, van, naar, wat, bekend: bekend || null }; }

/* EEN OPEN SCHAKEL MET EEN UITGESCHREVEN REDEN IS EEN BEVINDING, GEEN DEFECT.

   Dezelfde vorm als MET_REDEN in scripts/tikken.js: een scherm dat buiten
   bereik ligt mag bestaan zolang iemand heeft opgeschreven waarom. Zonder die
   uitweg heeft een proef die iets echts vindt maar twee uitgangen -- altijd
   zakken (dan zet iemand hem uit) of de bevinding wegpoetsen (dan meet hij
   niets meer). Met deze uitweg blijft de bevinding staan, in de uitslag, met
   het adres waar het besluit hoort te vallen.

   De grens: `bekend` moet een REDEN zijn en geen etiket. test/ritproef.test.js
   eist een minimumlengte en een verwijzing naar waar het besluit ligt. */

/* Wat het LID van zijn rit ziet. Er is geen route "mijn ritten": het lid leest
   zijn lopende rit via /api/live/state, onder de partner waar hij bij hoort.
   Die vorm staat hier een keer, want anders staat hij in elke schakel. */
async function ritVanLid(basis, tok, ref) {
  const l = await post(basis, '/api/live/state', {}, tok);
  const partners = (l.data && l.data.live && l.data.live.partners) || [];
  for (const p of partners) if (p.ride && (!ref || p.ride.ref === ref)) return p.ride;
  return null;
}

async function loop(basis, uit) {
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

  const lid = await P('/api/login', { tier: 'rtg' });
  const zaak = await P('/api/supplier/login', { username: 'rahul', password: 'Imran' });
  if (!lid.data || !lid.data.token) throw new Error('geen lidsessie (status ' + lid.status + ')');
  if (!zaak.data || !zaak.data.token) throw new Error('geen vervoerderssessie (status ' + zaak.status + ') -- draait de server met DEMO_SUPPLIER=' + VERVOERDER + '?');
  const M = lid.data.token, S = zaak.data.token;

  /* DE WERELD: een chauffeur. De seed geeft ISLATR geen personeel, en zonder
     chauffeur kan de dispatch niemand toewijzen -- dan zou schakel 3 "open"
     heten terwijl de proefopstelling de oorzaak is. Dit is dezelfde ingreep die
     scripts/lib/herstelwereld.js maakt, en om dezelfde reden: de wereld
     klaarzetten is geen valsspelen, een uitslag klaarzetten wel. */
  const staf = await P('/api/supplier/staff/add', { name: 'Chauffeur Proef', func: 'chauffeur' }, S);
  const staffId = staf.data && staf.data.staff && staf.data.staff.id;
  if (!staffId) throw new Error('geen chauffeur aan te maken (status ' + staf.status + ') -- zonder rijder meet deze proef de opstelling');
  uit.wereld = { chauffeur: 'via /api/supplier/staff/add, want de seed geeft ' + VERVOERDER + ' geen personeel' };

  /* 1 -- het lid vraagt een rit. Ontvanger: de vervoerder, op zijn DISPATCHBORD.

     DIT WAS DE BEVINDING VAN DE EERSTE RONDE, en zij is nu een besluit én een
     brug geworden. Er waren twee ritwerelden die niets van elkaar wisten: een
     app-rit landde in `db.data.rides` en het dispatchbord leest
     `db.data.mobOpdrachten`. De vervoerder kon een aanvraag daardoor nergens
     terugvinden -- niet in zijn historie (alleen afgerond), niet in de
     backoffice (alleen betaald, zonder ref), niet op zijn bord. Alleen een
     melding over de SSE-stroom, en was die verbinding weg, dan was de rit
     alleen nog te bereiken door de ref te kennen.

     De eigenaar heeft besloten dat de OPDRACHT de waarheid is
     (MAATSTAF.md par. 7.5); kern/mobiliteit/appbrug.js legt de brug. Deze
     schakel meet het resultaat: staat de aanvraag op het bord?

     De bestemming is hier een ZAAK en geen tekst, en dat is geen truc maar de
     grens van de brug: ./plekken.js lost een zaak, een halte, een favoriet, de
     live locatie of een punt op de kaart op -- geen vrije tekst. Storing 7
     hieronder meet juist het geval waarin dat NIET lukt. */
  const gevraagd = await stap(
    schakel(1, 'lid', 'vervoerder', 'vraagt een rit aan; hij verschijnt op het dispatchbord'),
    () => P('/api/ride/request', { supplierCode: VERVOERDER, toCode: BESTEMMING, passengers: 2 }, M),
    async (r) => {
      const ride = r.data && r.data.ride;
      const oref = r.data && r.data.opdrachtRef;
      const d = await P('/api/supplier/mob/dispatch', {}, S);
      const open = (d.data && d.data.open) || [];
      const bij = open.find(o => o.ref === oref);
      return { klopt: !!oref && !!bij && !!(ride && ride.customerCodename),
        wat: 'rit ' + (ride && ride.ref) + ' -> opdracht ' + oref + ', op het bord: ' + !!bij +
          ', klant heet "' + (ride && ride.customerCodename) + '"' };
    });

  if (!gevraagd) return uit;
  const ref = gevraagd.data.ride.ref;
  uit.rit = ref;

  /* 2 -- het lid betaalt. Ontvanger: de vervoerder, voor wie de rit pas dan
     toewijsbaar wordt. DIT IS DE OMGEKEERDE VOLGORDE ten opzichte van de tafel,
     en het is een grens en geen gewoonte: `ride/assign` weigert een onbetaalde
     rit met 409. */
  await stap(
    schakel(2, 'lid', 'vervoerder', 'betaalt vooraf, en pas dan mag de rit worden toegewezen'),
    () => P('/api/ride/pay', { ref }, M),
    async (r) => {
      const ride = r.data && r.data.ride;
      return { klopt: !!ride && ride.paid === true && ride.status !== 'wacht-op-betaling',
        wat: 'betaald: ' + (ride && ride.paid) + ', stand nu "' + (ride && ride.status) + '"' };
    });

  /* 3 -- de dispatch wijst een chauffeur toe. Ontvanger: het lid, dat de naam
     van zijn chauffeur leest. Die naam MAG hier naar de klant: je stapt bij
     iemand in de auto. */
  await stap(
    schakel(3, 'dispatch', 'lid', 'wijst een chauffeur toe, en het lid leest wie hem komt halen'),
    () => P('/api/supplier/ride/assign', { ref, staffId }, S),
    async () => {
      const r = await ritVanLid(basis, M, ref);
      return { klopt: !!r && !!r.driver,
        wat: 'het lid leest chauffeur "' + (r && r.driver) + '" bij stand "' + (r && r.status) + '"' };
    });

  /* 4-6 -- de chauffeur zet de keten vooruit. Elke stand is een eigen schakel,
     want elke stand is iets wat het lid hoort te zien. */
  for (const [nr, stand, wat] of [
    [4, 'onderweg', 'meldt zich onderweg'],
    [5, 'aangekomen', 'meldt zich aangekomen bij het lid'],
    [6, 'aan-boord', 'meldt dat het lid is ingestapt']
  ]) {
    await stap(
      schakel(nr, 'chauffeur', 'lid', wat + ', en het lid ziet die stand'),
      () => P('/api/supplier/ride/status', { ref, status: stand }, S),
      async () => {
        const r = await ritVanLid(basis, M, ref);
        return { klopt: !!r && r.status === stand, wat: 'het lid leest stand "' + (r && r.status) + '"' };
      });
  }

  /* 7 -- afronden. De rit verdwijnt daarna uit het live-beeld van het lid, en
     dat is hier de juiste afsluiting: een afgeronde rit is geen lopende reis
     meer (kern/live.js sluit 'afgerond' uit). Het is de tegenhanger van de
     gastsessie die aan tafel sluit -- alleen zonder foutmelding, want het lid
     hoefde niets meer te doen. */
  await stap(
    schakel(7, 'chauffeur', 'lid', 'rondt de rit af, en die verdwijnt uit het live-beeld van het lid'),
    () => P('/api/supplier/ride/status', { ref, status: 'afgerond' }, S),
    async (r) => {
      const nog = await ritVanLid(basis, M, ref);
      const ride = r.data && r.data.ride;
      return { klopt: !!ride && ride.status === 'afgerond' && !nog,
        wat: 'stand "' + (ride && ride.status) + '", nog in het live-beeld: ' + !!nog };
    });

  /* 8 -- en de vervoerder houdt hem in zijn historie. Zonder deze schakel zou
     "verdwijnt uit het live-beeld" ook door verlies verklaard kunnen worden. */
  await stap(
    schakel(8, 'vervoerder', 'vervoerder', 'houdt de afgeronde rit in zijn eigen historie'),
    () => P('/api/supplier/ride/history', {}, S),
    async (r) => {
      const lijst = (r.data && (r.data.rides || r.data.lijst || r.data.items)) || [];
      const bij = lijst.find(x => x.ref === ref);
      return { klopt: !!bij, wat: bij ? 'staat in de historie met stand "' + bij.status + '"' : 'niet in de historie' };
    });

  return uit;
}

async function storingen(basis, uit) {
  const P = (pad, lijf, tok) => post(basis, pad, lijf, tok);
  const M = (await P('/api/login', { tier: 'rtg' })).data.token;
  const S = (await P('/api/supplier/login', { username: 'rahul', password: 'Imran' })).data.token;
  const staf = await P('/api/supplier/staff/add', { name: 'Chauffeur Twee', func: 'chauffeur' }, S);
  const staffId = staf.data && staf.data.staff && staf.data.staff.id;

  const noteer = (naam, belofte, klopt, wat) =>
    uit.storingen.push({ naam, belofte, stand: klopt ? 'gehouden' : 'gebroken', wat });

  /* 1. LEVEREN VOOR ER BETAALD IS. De omgekeerde volgorde van de tafel, en
     daarom de eerste storing: hij hoort een grens te zijn en geen gewoonte. */
  const r1 = (await P('/api/ride/request', { supplierCode: VERVOERDER, toCode: BESTEMMING }, M)).data.ride;
  const vroeg = await P('/api/supplier/ride/assign', { ref: r1.ref, staffId }, S);
  noteer('een rit toewijzen die nog niet betaald is',
    'weigert, en zegt dat er nog niet betaald is',
    vroeg.status === 409 && /betaald/i.test(String(vroeg.data && vroeg.data.error)),
    'status ' + vroeg.status + ': ' + (vroeg.data && vroeg.data.error));

  /* 2. DE KETEN TERUG. kern/vervoer.js laat RIT_KETEN alleen vooruit lopen. */
  await P('/api/ride/pay', { ref: r1.ref }, M);
  await P('/api/supplier/ride/assign', { ref: r1.ref, staffId }, S);
  await P('/api/supplier/ride/status', { ref: r1.ref, status: 'onderweg' }, S);
  const terug = await P('/api/supplier/ride/status', { ref: r1.ref, status: 'geaccepteerd' }, S);
  noteer('een rit terugzetten naar een eerdere stand',
    'weigert; de ritketen loopt alleen vooruit',
    terug.status === 409, 'status ' + terug.status + ': ' + (terug.data && terug.data.error));

  /* 3. EEN ONBEKENDE STAND. */
  const raar = await P('/api/supplier/ride/status', { ref: r1.ref, status: 'zweeft' }, S);
  noteer('een stand die niet in de ritketen staat',
    'weigert, en noemt niet stilzwijgend een andere stand',
    raar.status === 400, 'status ' + raar.status + ': ' + (raar.data && raar.data.error));

  /* 4. EEN RIT VAN EEN ANDERE ZAAK. De ritlijst is gedeeld (db.data.rides), dus
     elke route filtert op supplierCode; dat is precies het soort grens dat
     stil wegvalt bij een refactor. */
  const vreemd = await P('/api/supplier/ride/status', { ref: 'RTG-R-BESTAATNIET', status: 'onderweg' }, S);
  noteer('een rit die niet van deze vervoerder is',
    'bestaat niet voor hem',
    vreemd.status === 404, 'status ' + vreemd.status);

  /* 5. TWEE KEER BETALEN. De tafel kent de dubbele tik bij het bestellen; hier
     is de dubbeltik bij het BETALEN het geval dat geld kost. */
  const r2 = (await P('/api/ride/request', { supplierCode: VERVOERDER, toCode: BESTEMMING }, M)).data.ride;
  const eerste = await P('/api/ride/pay', { ref: r2.ref }, M);
  const tweede = await P('/api/ride/pay', { ref: r2.ref }, M);
  noteer('twee keer betalen voor dezelfde rit',
    'de tweede betaling voegt niets toe aan wat de rit kostte',
    eerste.status === 200 && (tweede.status >= 400 ||
      (tweede.data && tweede.data.ride && tweede.data.ride.quote === r2.quote)),
    'eerste ' + eerste.status + ', tweede ' + tweede.status +
      (tweede.data && tweede.data.error ? ': ' + tweede.data.error : ''));

  /* 6. EEN LID DAT NIET BETAALD HEEFT, ZIET GEEN CHAUFFEUR. De keerzijde van
     schakel 3: er hoort niets klaar te staan zolang de rit niet betaald is. */
  const r3 = (await P('/api/ride/request', { supplierCode: VERVOERDER, toCode: BESTEMMING }, M)).data.ride;
  const beeld = await ritVanLid(basis, M, r3.ref);
  noteer('het live-beeld van een onbetaalde rit',
    'toont geen chauffeur, want die is nog niet toegewezen',
    !beeld || !beeld.driver, 'chauffeur in beeld: ' + (beeld ? beeld.driver : 'geen rit in beeld'));

  /* 7. EEN BESTEMMING DIE GEEN PLEK IS. De brug vertaalt een zaak, een halte,
     een favoriet, de live locatie of een punt op de kaart; een vrije tekst
     niet. Dan hoort de rit gewoon door te gaan -- een besluit uitvoeren mag
     geen aanvragen weigeren die gisteren nog werkten -- met de reden erbij. */
  const tekst = await P('/api/ride/request', { supplierCode: VERVOERDER, to: 'Ergens bij de haven' }, M);
  noteer('een bestemming die alleen een tekst is',
    'de rit gaat gewoon door, krijgt geen opdracht, en zegt waarom',
    tekst.status === 200 && !!(tekst.data && tekst.data.ride) &&
      !(tekst.data && tekst.data.opdrachtRef) && !!(tekst.data && tekst.data.opdrachtReden),
    'status ' + tekst.status + ', opdracht: ' + ((tekst.data && tekst.data.opdrachtRef) || 'geen') +
      ', reden: ' + String((tekst.data && tekst.data.opdrachtReden) || '').slice(0, 60) + '...');

  /* 8. DE VERTALING VAN DE STANDEN. `aan-boord` heet in de opdrachtketen
     `ingestapt`, en `rijdt` betekent in de twee werelden iets anders. Deze
     storing bewaakt dat de brug vertaalt in plaats van overtypt. */
  const r8 = (await P('/api/ride/request', { supplierCode: VERVOERDER, toCode: BESTEMMING }, M)).data;
  await P('/api/ride/pay', { ref: r8.ride.ref }, M);
  await P('/api/supplier/ride/assign', { ref: r8.ride.ref, staffId }, S);
  for (const stand of ['onderweg', 'aangekomen', 'aan-boord']) await P('/api/supplier/ride/status', { ref: r8.ride.ref, status: stand }, S);
  const bord8 = await P('/api/supplier/mob/dispatch', {}, S);
  const alle8 = [].concat(bord8.data.open || [], bord8.data.lopend || [], bord8.data.klaar || []);
  const o8 = alle8.find(x => x.ref === r8.opdrachtRef);
  noteer('een rit die op "aan-boord" gaat',
    'de opdracht heet dan "ingestapt" en niet "rijdt" -- dat woord betekent hier iets anders',
    !!o8 && o8.status === 'ingestapt',
    'rit aan-boord, opdracht ' + (o8 ? o8.status : '(niet gevonden)'));

  return uit;
}

async function meet() {
  const uit = {
    stempel: new Date().toISOString().slice(0, 10),
    uitleg: 'Een ritketen van aanvraag tot afronding, gemeten per SCHAKEL (handelt actor A, en ziet actor B dat?) en per STORING (houdt de keten zijn belofte als het misgaat?). Tweede keten naast scripts/tafelproef.js, in een ander domein -- zie MAATSTAF.md par. 7.',
    grens: 'Alleen de rit bij een vervoerszaak; OV, vluchten en zakelijk vervoer hebben eigen naden. De proef zet een chauffeur klaar omdat de seed er geen heeft. Er komt geen browser aan te pas, en de betaling loopt via de demo-rail: dat het geld werkelijk bij de vervoerder landt, is hier niet gemeten.',
    schakels: [], storingen: [], rit: null, wereld: null
  };
  const srv = await start({ naam: 'ritproef', gereed: 'ready',
    env: { NODE_ENV: 'test', RTG_DEMO: '1', DEMO_SUPPLIER: VERVOERDER, OFFICE_CODE: 'RTG-OFFICE-PROEF' } });
  try {
    await loop(srv.basis, uit);
    await storingen(srv.basis, uit);
  } finally { srv.klaar(); }

  const t = { schakels: uit.schakels.length, gesloten: 0, open: 0, openBekend: 0, stuk: 0,
    storingen: uit.storingen.length, gehouden: 0, gebroken: 0 };
  for (const s of uit.schakels) t[s.stand]++;
  for (const s of uit.storingen) t[s.stand]++;
  uit.telling = t;
  /* `openBekend` telt NIET mee als defect, maar de keten heet dan ook niet
     gesloten: hij is `sluitMetBevinding`. Twee velden en geen samengesteld
     cijfer, want een proef die "sluit: true" meldt terwijl er een gat in staat,
     is precies de scorecard die LAT.md regel 11 verbiedt. */
  uit.sluit = t.open === 0 && t.stuk === 0 && t.gebroken === 0 && t.openBekend === 0 && t.schakels >= 7;
  uit.sluitMetBevinding = t.open === 0 && t.stuk === 0 && t.gebroken === 0 && t.schakels >= 7;
  uit.bevindingen = uit.schakels.filter(s2 => s2.stand === 'openBekend')
    .map(s2 => ({ schakel: s2.nr, van: s2.van, naar: s2.naar, wat: s2.wat, gemeten: s2.ziet, reden: s2.bekend }));
  return uit;
}

function druk(u) {
  console.log('ritproef: ' + u.telling.schakels + ' schakels (' + u.telling.gesloten + ' gesloten, ' +
    u.telling.openBekend + ' open met reden, ' + u.telling.open + ' open, ' + u.telling.stuk + ' stuk), ' +
    u.telling.storingen + ' storingen (' + u.telling.gehouden + ' gehouden, ' + u.telling.gebroken + ' gebroken).');
  for (const s of u.schakels)
    console.log('  ' + String(s.nr).padStart(2) + ' ' + (s.van + '->' + s.naar).padEnd(20) +
      s.stand.padEnd(11) + s.wat + (s.ziet ? '\n      ziet: ' + s.ziet : '') +
      (s.bekend ? '\n      BEVINDING: ' + s.bekend : '') +
      (s.antwoord ? '\n      antwoord: ' + s.antwoord : '') + (s.fout ? '\n      FOUT: ' + s.fout : ''));
  for (const s of u.storingen)
    console.log('  -- ' + s.stand.padEnd(9) + s.naam + '\n      belooft: ' + s.belofte + '\n      gaf: ' + s.wat);
  console.log(u.sluit ? '\nDe keten sluit.'
    : u.sluitMetBevinding ? '\nDe keten loopt door, met ' + u.telling.openBekend + ' bevinding(en) die een besluit vragen.'
      : '\nDE KETEN SLUIT NIET.');
}

module.exports = { meet, DOEL, VERVOERDER };

if (require.main === module) {
  meet().then(u => {
    if (process.argv.includes('--json')) { console.log(JSON.stringify(u)); process.exit(u.sluitMetBevinding ? 0 : 1); }
    druk(u);
    if (process.argv.includes('--vastleggen')) {
      fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
      console.log('geschreven: RITPROEF.json');
    }
    process.exit(u.sluitMetBevinding ? 0 : 1);
  }).catch(e => { console.error('de ritproef kon niet draaien: ' + (e && e.message || e)); process.exit(1); });
}
