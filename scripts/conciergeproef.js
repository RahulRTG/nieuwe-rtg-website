#!/usr/bin/env node
/* ============================================================================
   DE CONCIERGEPROEF -- sluit de lus rond een wens, en houdt hij zijn belofte
   als het misgaat? (CONCIERGE.md par. 0a en 6)

   CONCIERGE.md zei het zelf: "Geen conciergeproef. De schakels en storingen van
   par. 6 zitten in de toetsen, niet in een ketenproef." Toetsen zijn eigen
   bewijs van wie ze schreef; een ketenproef met een register is bewijs dat
   APPWERKT (scripts/appwerkt.js, via scripts/lib/bewijsbron.js) zelf kan lezen,
   op versheid kan houden en kan laten zakken. Daarom staat deze proef er, in de
   vorm van scripts/lusproef.js: schakels (handelt actor A, en merkt actor B
   dat?) en storingen (houdt de keten zijn belofte als het misgaat?).

   DRIE MENSEN EN TWEE ZAKEN. Het lid (Lifestyle, demo-inlog: deze pas wordt
   nooit zelf aangevraagd), het kantoor (de case-eigenaar), de zaak die een
   onderdeel levert (KIKUNOI, met een manager en een medewerker) en een tweede
   zaak (PONTO) die er NIETS van mag zien. Plus een Business-lid dat de case van
   het eerste lid niet mag openen.

   WAT HIJ LOOPT, en niets meer: de concierge-lus (lid, kantoor, zaak) en aan
   het eind de tafeluitzondering van diezelfde zaak (doorzetten, tegenvoorstel,
   het antwoord van het lid). Niet de rest van het Privekantoor -- daarom levert
   hij in scripts/lib/appcontract.js GEEN voltooibaar voor link:rechterhand.

   WAT DEZE PROEF NIET BEWIJST, en dat staat ook in het register (`grens`):
   - er komt geen browser aan te pas; dat de schermen hem bedienen, bewijst
     test/conciergelusscherm.e2e.js;
   - de schermen: de zaak bedient zijn opdrachten en de tafeluitzondering op
     apps/leverancier.html en het lid antwoordt op apps/foodcourt.html, maar
     dat toetst test/conciergezaakscherm.e2e.js en niet deze proef;
   - het VERVAL van een aanbod vraagt een verzette klok en staat in
     test/conciergelus-kern.test.js, niet hier;
   - de hotelconcierge (B1), het collega-netwerk (B3) en de routekennis (B5)
     wachten op een besluit en worden niet gelopen.

   DRAAIEN  npm run conciergeproef
            npm run conciergeproef:vast   (schrijft CONCIERGEPROEF.json, met het huisstempel)
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const ws = require('./lib/wegwerpserver');
const { stempel: huisStempel } = require('./lib/stempel');

const KANTOORCODE = 'KANTOOR-CONCIERGEPROEF';
const schakels = [], storingen = [];
/* De nummers volgen de volgorde waarin de keten loopt; een schakel ertussen
   voegen hernummert de rest, en dat is beter dan nummers die niet meer lopen. */
const schakel = (wat, ok, detail) => schakels.push({ nr: schakels.length + 1, wat, stand: ok ? 'sluit' : 'BREEKT', detail });
const storing = (wat, ok, detail) => storingen.push({ nr: storingen.length + 1, wat, stand: ok ? 'houdt' : 'BREEKT', detail });

async function proef(basis) {
  const post = async (pad, lijf, token) => {
    const h = { 'Content-Type': 'application/json' };
    if (token) h.Authorization = 'Bearer ' + token;
    const r = await fetch(basis + pad, { method: 'POST', headers: h, body: JSON.stringify(lijf || {}) });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const zaakTok = async (code) => {
    const ro = await post('/api/supplier/roster', { code });
    const staf = (ro.body && ro.body.staff) || [];
    const man = staf.find(x => x.role === 'manager') || staf[0];
    return ((await post('/api/supplier/login', { code, staffId: man && man.id, pin: '1234' })).body || {}).token;
  };

  const lid = ((await post('/api/login', { tier: 'lifestyle' })).body || {}).token;
  const ander = ((await post('/api/login', { tier: 'business' })).body || {}).token;
  const kantoor = ((await post('/api/office/login', { code: KANTOORCODE })).body || {}).token;
  const zaak = await zaakTok('KIKUNOI');
  const buur = await zaakTok('PONTO');
  if (!lid || !ander || !kantoor || !zaak || !buur) throw new Error('niet alle sessies; draait de server in de testomgeving?');

  /* ---- 1. een zin wordt een case -------------------------------------- */
  const SLEUTEL = 'conciergeproef-sleutel-0123456789';
  const zin = 'Mijn vrouw is morgen jarig. We zijn in Amsterdam, ze weet van niets. Diner om 20 uur, geen noten.';
  let r = await post('/api/member/bureau/lus/intake', { zin, sleutel: SLEUTEL, speelruimteMin: 30 }, lid);
  const c0 = (r.body || {}).zaak || {};
  const id = c0.id;
  schakel('het lid vertelt een wens in een zin, en er staat een case met de velden uit die zin',
    r.status === 200 && !!id && c0.verrassing === true && c0.tijd === '20:00' && c0.plaats === 'Amsterdam' &&
      (c0.harde || []).includes('geen noten') && c0.status === 'in voorbereiding',
    'status ' + r.status + '; ' + [c0.tijd, c0.plaats, (c0.harde || []).join('+'), c0.verrassing ? 'verrassing' : ''].join(' · '));
  if (!id) throw new Error('geen case; de rest van de keten kan niets bewijzen');

  /* ---- 2. een dubbeltik levert geen tweede diner op ---------------------- */
  r = await post('/api/member/bureau/lus/intake', { zin, sleutel: SLEUTEL }, lid);
  const zaken1 = (await post('/api/member/bureau/zaken', {}, lid)).body || {};
  const lusZaken = (zaken1.zaken || []).filter(z => z.werkwijze === 'voorstel');
  schakel('dezelfde wens nog eens (zelfde sleutel) is een herhaling en geen tweede case',
    r.status === 200 && r.body.herhaald === true && lusZaken.length === 1, lusZaken.length + ' case(s) in de lus');

  /* ---- 3. het kantoor ziet hem ------------------------------------------- */
  r = await post('/api/office/bureau', {}, kantoor);
  const rij = ((r.body || {}).zaken || []).find(z => z.id === id) || {};
  const key = rij.key;
  schakel('het kantoor ziet de case op het bureau, als lus-case',
    r.status === 200 && rij.lus === true && !!key, 'lus ' + rij.lus + ', soort ' + rij.soort);
  const K = (pad, b) => post('/api/office/bureau/lus' + pad, Object.assign({ key, id }, b || {}), kantoor);

  /* ---- 4. iemand pakt het op, en het lid ziet dat ------------------------ */
  r = await K('/neem');
  let l = (await post('/api/member/bureau/lus/zaak', { id }, lid)).body || {};
  schakel('het kantoor pakt hem op; het lid ziet een eigenaar (met de gedeelde code een ROL, geen verzonnen naam)',
    r.status === 200 && l.eigenaar && l.eigenaar.rol === 'Lead Rechterhand' && l.eigenaar.naam === null,
    'lid ziet: ' + JSON.stringify(l.eigenaar));

  /* ---- 5. de gewone route weigert ----------------------------------------- */
  r = await K('/weigering', { reden: 'Volgeboekt om 20:00' });
  let kz = ((await K('')).body || {}).zaak || {};
  const regels = (kz.tijdlijn || []).map(x => x.notitie);
  const iW = regels.findIndex(x => /gewone route lukt niet/.test(x)), iB = regels.findIndex(x => /bijzonder verzoek/.test(x));
  schakel('een weigering van de gewone route staat in de tijdlijn, en PAS DAARNA wordt de case bijzonder',
    r.status === 200 && kz.soort === 'bijzonder' && iW >= 0 && iB > iW, 'soort ' + kz.soort);

  /* ---- 6. een aanbod dat wordt vastgehouden ------------------------------ */
  r = await K('/aanbod', { wat: 'Tafel bij het water', van: '21:30', duurMin: 120, zaak: 'KIKUNOI', geldigMin: 30, bron: 'beslisser' });
  const aanbod = (r.body || {}).aanbod || {};
  schakel('de beslisser biedt iets anders aan, en het wordt een termijn vastgehouden',
    r.status === 200 && aanbod.stand === 'vastgehouden' && !!aanbod.geldigTot, 'stand ' + aanbod.stand);

  /* ---- 7. buiten de speelruimte beslist het lid -------------------------- */
  r = await K('/kies', { aanbod: aanbod.id });
  l = (await post('/api/member/bureau/lus/zaak', { id }, lid)).body || {};
  schakel('buiten het mandaat zet het kantoor NIET vast: het lid krijgt een voorstel met de reden',
    r.status === 200 && r.body.vastgezet === false && l.voorstel && l.voorstel.wat === 'Tafel bij het water' && !!l.voorstel.reden,
    'reden: ' + (l.voorstel || {}).reden);

  /* ---- 8. het lid zegt ja ------------------------------------------------ */
  r = await post('/api/member/bureau/lus/beslis', { id, akkoord: true }, lid);
  l = (await post('/api/member/bureau/lus/zaak', { id }, lid)).body || {};
  schakel('het lid geeft akkoord, het onderdeel staat vast, en pas dan zegt het bericht "Alles is geregeld"',
    r.status === 200 && r.body.vastgezet === true && l.bericht && l.bericht.alles === true && l.voorstel === null,
    'het lid leest: ' + (l.bericht || {}).tekst);

  /* ---- 9. de zaak ziet zijn stukje --------------------------------------- */
  r = await post('/api/supplier/concierge/opdrachten', {}, zaak);
  const mijn = ((r.body || {}).opdrachten || []).filter(o => o.caseRef === id);
  const velden = mijn[0] ? Object.keys(mijn[0]).sort().join(',') : '';
  schakel('de zaak ziet zijn onderdeel, "discreet" omdat het een verrassing is, en alleen de positieve veldenlijst',
    r.status === 200 && mijn.length === 1 && mijn[0].discreet === true &&
      velden === 'caseRef,datum,discreet,duurMin,gelegenheid,onderdeel,personen,stand,van,wat,wensen',
    'velden: ' + velden);

  /* ---- de verrassing is een stand die het lid zelf zet, en de zaak volgt ---- */
  const discreet = async () => (((await post('/api/supplier/concierge/opdrachten', {}, zaak)).body || {}).opdrachten || [])
    .filter(o => o.caseRef === id).map(o => o.discreet);
  const uit = await post('/api/member/bureau/lus/verrassing', { id, aan: false }, lid);
  const zietUit = await discreet();
  const lUit = (await post('/api/member/bureau/lus/zaak', { id }, lid)).body || {};
  const aan = await post('/api/member/bureau/lus/verrassing', { id, aan: true }, lid);
  const zietAan = await discreet();
  schakel('het lid zet de verrassing uit en weer aan; zijn zaak volgt, en de zaak ziet "discreet" alleen zolang hij aan staat',
    uit.status === 200 && aan.status === 200 && lUit.verrassing === false && zietUit.length === 1 && zietUit[0] === false &&
      zietAan[0] === true,
    'uit: lid ' + lUit.verrassing + ', zaak ' + zietUit.join(',') + '; weer aan: zaak ' + zietAan.join(','));

  /* ---- de zaak bevestigt haar eigen onderdeel ------------------------------ */
  const extra = (await K('/onderdeel', { wat: 'Bloemen op tafel', van: '19:00', duurMin: 10, zaak: 'KIKUNOI' })).body || {};
  const extraId = (extra.onderdeel || {}).id;
  const vreemdeZaak = await post('/api/supplier/concierge/bevestig', { caseRef: id, onderdeel: extraId }, buur);
  const naVreemd = (((await K('')).body || {}).zaak || {}).onderdelen || [];
  storing('een tweede zaak bevestigt geen onderdeel dat niet het hare is: 404, en het onderdeel blijft gevraagd',
    vreemdeZaak.status === 404 && (naVreemd.find(o => o.id === extraId) || {}).stand === 'gepland',
    'status ' + vreemdeZaak.status + ', stand ' + (naVreemd.find(o => o.id === extraId) || {}).stand);
  const zietExtra = ((((await post('/api/supplier/concierge/opdrachten', {}, zaak)).body || {}).opdrachten) || []).find(o => o.onderdeel === extraId) || {};
  r = await post('/api/supplier/concierge/bevestig', { caseRef: id, onderdeel: extraId }, zaak);
  kz = ((await K('')).body || {}).zaak || {};
  schakel('de zaak ziet een nieuw onderdeel als gevraagd, bevestigt het zelf, en het kantoor ziet in de case dat de ZAAK het deed',
    zietExtra.stand === 'gepland' && r.status === 200 && ((kz.onderdelen || []).find(o => o.id === extraId) || {}).stand === 'bevestigd' &&
      (kz.tijdlijn || []).some(x => x.door === 'zaak' && /Bevestigd door de zaak: Bloemen op tafel/.test(x.notitie)),
    'zaak zag ' + zietExtra.stand + '; daarna ' + r.status);

  /* ---- 10. een vertraging zet klaar en verstuurt niets --------------------- */
  const onderdeel = (kz = ((await K('')).body || {}).zaak || {}).onderdelen.find(o => o.wat === 'Tafel bij het water') || {};
  r = await K('/vertraging', { onderdeel: onderdeel.id, minuten: 15 });
  const klaar = (r.body || {}).klaar || {};
  schakel('een vertraging rekent de gevolgen uit en zet per partner een bericht KLAAR',
    r.status === 200 && (klaar.berichten || []).length === 1 && klaar.berichten[0].nieuw === '21:45',
    (klaar.berichten || []).map(b => b.bericht).join(' | '));

  /* ---- 11. versturen kan pas als alles gezien is ------------------------- */
  const half = await K('/verstuur', { klaar: klaar.id, gezien: [] });
  r = await K('/verstuur', { klaar: klaar.id, gezien: (klaar.berichten || []).map(b => b.id) });
  kz = ((await K('')).body || {}).zaak || {};
  const nu = (kz.onderdelen || []).find(o => o.id === onderdeel.id) || {};
  schakel('pas met alles aangevinkt gaat het weg, de zaak krijgt het, en de nieuwe tijd is de afspraak',
    half.status === 409 && r.status === 200 && (r.body.uitslag || []).every(u => u.bezorgd) && nu.van === '21:45',
    'zonder vinkjes ' + half.status + '; daarna ' + JSON.stringify(r.body && r.body.uitslag));

  /* ---- 12. een onderdeel valt om: dezelfde case, in herstel ---------------- */
  r = await K('/kapot', { onderdeel: onderdeel.id, reden: 'Keuken onder water' });
  const zaken2 = (await post('/api/member/bureau/zaken', {}, lid)).body || {};
  kz = ((await K('')).body || {}).zaak || {};
  schakel('een onderdeel dat omvalt maakt geen nieuwe case: dezelfde case gaat "in herstel"',
    r.status === 200 && kz.status === 'in herstel' && (zaken2.zaken || []).filter(z => z.werkwijze === 'voorstel').length === 1,
    'status ' + kz.status);

  /* ---- 13. het lid laat iets weten tijdens het herstel --------------------- */
  r = await post('/api/member/bureau/lus/toelichting', { id, tekst: 'Graag nog steeds aan het water.' }, lid);
  schakel('het lid kan tijdens het herstel iets laten weten, in dezelfde case',
    r.status === 200, 'status ' + r.status);

  /* ---- 14. een alternatief vervangt het kapotte onderdeel ------------------ */
  const a2 = (await K('/aanbod', { wat: 'Tafel aan de gracht', van: '21:45', duurMin: 120, zaak: 'KIKUNOI', vervangt: onderdeel.id })).body || {};
  const gekozen = await K('/kies', { aanbod: (a2.aanbod || {}).id });
  // binnen het mandaat zet het kantoor vast, daarbuiten beslist het lid: allebei een geldige weg
  if (gekozen.body && gekozen.body.wachtOpLid) await post('/api/member/bureau/lus/beslis', { id, akkoord: true }, lid);
  kz = ((await K('')).body || {}).zaak || {};
  const oud = (kz.onderdelen || []).find(o => o.id === onderdeel.id) || {};
  const alt = (kz.onderdelen || []).find(o => o.id === oud.vervangenDoor) || {};
  l = (await post('/api/member/bureau/lus/zaak', { id }, lid)).body || {};
  schakel('een alternatief VERVANGT het kapotte onderdeel, en het lid hoort dat het programma is aangepast',
    gekozen.status === 200 && !!alt.id && kz.status === 'in uitvoering' && /aangepast\. Alles is geregeld/.test((l.bericht || {}).tekst || ''),
    (gekozen.body && gekozen.body.wachtOpLid ? 'via het lid; ' : 'binnen het mandaat; ') + 'het lid leest: ' + (l.bericht || {}).tekst);

  /* ---- storingen voor het sluiten ---------------------------------------- */
  r = await post('/api/office/bureau/voortgang', { key, id, status: 'in uitvoering' }, kantoor);
  storing('het bureau kan een lus-case niet om de lus heen een stand geven',
    r.status === 409, 'status ' + r.status + ': ' + ((r.body || {}).error || ''));

  r = await post('/api/member/bureau/lus/beslis', { id, akkoord: true }, lid);
  storing('het lid kan niet beslissen over een voorstel dat er niet ligt',
    r.status === 400, 'status ' + r.status);

  r = await post('/api/member/bureau/lus/zaak', { id }, ander);
  storing('een ander lid opent deze case niet, ook niet met het juiste id',
    r.status === 404, 'status ' + r.status);

  r = await post('/api/supplier/concierge/opdrachten', {}, buur);
  const buurZiet = ((r.body || {}).opdrachten || []).filter(o => o.caseRef === id).length;
  storing('een tweede zaak ziet niets van een onderdeel dat niet het zijne is',
    r.status === 200 && buurZiet === 0, buurZiet + ' onderdeel/onderdelen gezien');

  r = await post('/api/member/bureau/zaak/open', { titel: 'Probeer de lus te forceren', domein: 'gelegenheden', werkwijze: 'voorstel' }, ander);
  storing('een lid kan de werkwijze niet zelf zetten: een gewone case blijft gewoon',
    // de case moet WEL ontstaan: een weigering bewijst niet dat de werkwijze niet te zetten is
    r.status === 200 && !!(r.body.zaak || {}).id && (r.body.zaak || {}).werkwijze !== 'voorstel',
    'status ' + r.status + ', werkwijze ' + ((r.body || {}).zaak || {}).werkwijze);

  r = await K('/vertraging', { onderdeel: alt.id, minuten: 10 });
  const kl2 = (r.body || {}).klaar || {};
  const andere = await K('/verstuur', { klaar: 'niet-de-klaargezette', gezien: (kl2.berichten || []).map(b => b.id) });
  storing('berichten die niet de klaargezette zijn, gaan niet weg',
    andere.status === 409, 'status ' + andere.status);
  await K('/verstuur', { klaar: kl2.id, gezien: (kl2.berichten || []).map(b => b.id) });

  /* ---- 15. sluiten, met een uitkomst in plaats van een status ------------- */
  const bev = (kz.onderdelen || []).filter(o => !o.vervangenDoor && o.stand !== 'bevestigd' && o.stand !== 'kapot');
  for (const o of bev) await K('/bevestig', { onderdeel: o.id });
  r = await post('/api/office/bureau/voortgang', { key, id, status: 'geregeld', notitie: 'Diner aan de gracht' }, kantoor);
  const eind = ((await post('/api/member/bureau/zaken', {}, lid)).body.zaken || []).find(z => z.id === id) || {};
  const u = eind.uitkomst || {};
  schakel('"geregeld" kan alleen als het waar is, en draagt een uitkomst: beloften, herstel, en hoe vaak het lid het opnieuw moest vertellen',
    r.status === 200 && eind.status === 'geregeld' && u.herstelmomenten === 1 && u.opnieuwVerteld === 1 &&
      (u.nietGemeten || []).some(x => x.wat === 'tevredenheid'),
    JSON.stringify({ beloften: u.beloften, herstel: u.herstelmomenten, opnieuwVerteld: u.opnieuwVerteld }));

  /* ---- de tafel van een zaak: tussen ja en nee (kern/ervaring/tafeluitzondering.js) ----
     Dezelfde zaak, nu als restaurant dat een aanvraag krijgt die het om 20:00
     niet kan honoreren. Een medewerker zet door naar een manager; de manager
     biedt een andere tijd aan met een termijn; het lid zegt ja. */
  const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const staf = ((await post('/api/supplier/roster', { code: 'KIKUNOI' })).body || {}).staff || [];
  const mwId = (staf.find(x => x.role !== 'manager') || {}).id;
  const mw = ((await post('/api/supplier/login', { code: 'KIKUNOI', staffId: mwId, pin: '5678' })).body || {}).token;
  const aanvraag = await post('/api/reserveer', { supplierCode: 'KIKUNOI', datum: morgen, tijd: '20:00', personen: 2 }, lid);
  const rid = ((aanvraag.body || {}).reservering || {}).id;
  if (!mw || !rid) throw new Error('geen medewerker of geen aanvraag (' + aanvraag.status + ' ' + JSON.stringify(aanvraag.body) + '); de tafelketen kan niets bewijzen');
  r = await post('/api/supplier/reservering/doorzetten', { id: rid, reden: 'Verjaardag, graag een uitzondering' }, mw);
  const mwJa = await post('/api/supplier/reservering/beslis', { id: rid, action: 'bevestig' }, mw);
  const zaakZiet = (((await post('/api/supplier/state', {}, mw)).body || {}).state || {}).reserveringen || [];
  schakel('een medewerker zet een tafelaanvraag door met een reden; vanaf dan beslist alleen een manager, en de zaak ziet dat hij doorgezet is',
    r.status === 200 && mwJa.status === 403 && !!((zaakZiet.find(x => x.id === rid) || {}).doorgezet),
    'doorzetten ' + r.status + ', ja van de medewerker ' + mwJa.status);
  r = await post('/api/supplier/reservering/tegenvoorstel', { id: rid, tijd: '21:15', geldigMin: 12 }, zaak);
  const lidZiet = (((await post('/api/reserveringen/mijn', {}, lid)).body || {}).reserveringen || []).find(x => x.id === rid) || {};
  const nogBijZaak = ((((await post('/api/supplier/state', {}, zaak)).body || {}).state || {}).reserveringen || []).find(x => x.id === rid) || {};
  schakel('de manager biedt 21:15 aan, twaalf minuten vastgehouden; het lid ziet de nieuwe tijd en de termijn, en de zaak houdt hem in beeld',
    r.status === 200 && lidZiet.status === 'tegenvoorstel' && lidZiet.tijd === '21:15' && lidZiet.gevraagdeTijd === '20:00' &&
      Date.parse((lidZiet.tegenvoorstel || {}).geldigTot) > Date.now() && nogBijZaak.status === 'tegenvoorstel' &&
      // regel 4 van tafeluitzondering.js: de gast weet niet WIE besloot -- ook niet in het antwoord van de server
      !('doorgezet' in lidZiet) && !('door' in (lidZiet.tegenvoorstel || {})),
    'lid ziet ' + lidZiet.status + ' om ' + lidZiet.tijd + '; zaak ziet ' + nogBijZaak.status +
      ('doorgezet' in lidZiet || 'door' in (lidZiet.tegenvoorstel || {}) ? '; het lid krijgt WIE besloot mee: ' + JSON.stringify({ doorgezet: lidZiet.doorgezet, door: (lidZiet.tegenvoorstel || {}).door }) : ''));
  r = await post('/api/reservering/tegenvoorstel', { id: rid, akkoord: true }, lid);
  const vast = ((((await post('/api/supplier/state', {}, zaak)).body || {}).state || {}).reserveringen || []).find(x => x.id === rid) || {};
  schakel('het lid zegt ja; de tafel staat bevestigd op 21:15, ook bij de zaak',
    r.status === 200 && vast.status === 'bevestigd' && vast.tijd === '21:15', 'status ' + r.status + ', zaak ziet ' + vast.status + ' ' + vast.tijd);
}

/* Alleen als script: een require laadt de proef zonder hem te draaien. */
if (require.main === module) (async () => {
  const s = await ws.start({ naam: 'conciergeproef', gereed: 'ready',
    env: { NODE_ENV: 'test', RTG_DEMO: '1', OFFICE_CODE: KANTOORCODE } });
  try { await proef(s.basis); } finally { s.klaar(); }

  console.log('\n  DE CONCIERGEPROEF -- de lus rond een wens\n');
  for (const k of schakels) {
    console.log('  ' + (k.stand === 'sluit' ? '  ok ' : 'BREEK') + '  ' + String(k.nr).padStart(2) + '. ' + k.wat);
    if (k.detail) console.log('          ' + k.detail);
  }
  console.log('\n  STORINGEN\n');
  for (const k of storingen) {
    console.log('  ' + (k.stand === 'houdt' ? '  ok ' : 'BREEK') + '  ' + String(k.nr).padStart(2) + '. ' + k.wat);
    if (k.detail) console.log('          ' + k.detail);
  }
  const stuk = schakels.filter(k => k.stand === 'BREEKT').length + storingen.filter(k => k.stand === 'BREEKT').length;
  console.log('\n  ' + schakels.filter(k => k.stand === 'sluit').length + ' van ' + schakels.length + ' schakels gesloten; ' +
    storingen.filter(k => k.stand === 'houdt').length + ' van ' + storingen.length + ' storingen gehouden.\n');
  /* Het register, in het woordgebruik van de andere ketenregisters, zodat
     scripts/lib/bewijsbron.js het met dezelfde lezer leest (zie lusproef.js). */
  if (process.argv.includes('--vastleggen')) {
    const SCHAKEL = { sluit: 'gesloten', BREEKT: 'stuk' };
    const STORING = { houdt: 'gehouden', BREEKT: 'gebroken' };
    const reg = {
      stempel: huisStempel(),
      uitleg: 'De concierge-lus van De Rechterhand (CONCIERGE.md), gemeten per SCHAKEL (handelt actor A, en merkt actor B dat?) en per STORING (houdt de keten zijn belofte als het misgaat?): van een wens in een zin tot een gesloten case met een uitkomst, met een vertraging en een herstel onderweg.',
      grens: 'Een Lifestyle-lid (demo-inlog), het kantoor met de gedeelde code, twee zaken (KIKUNOI met manager en medewerker, PONTO) en een Business-lid, allemaal over de API. Hij loopt de concierge-lus en de tafeluitzondering, en NIET de rest van het Privekantoor (woning, kring, bezit, mandaat): daarom is hij geen bewijs voor het Privekantoor als geheel. Er komt geen browser aan te pas (dat doen test/conciergelusscherm.e2e.js en test/conciergezaakscherm.e2e.js). Het verval van een aanbod vraagt een verzette klok en staat in test/conciergelus-kern.test.js. De hotelconcierge (B1), het collega-netwerk (B3) en de routekennis (B5) wachten op een besluit en worden niet gelopen.',
      schakels: schakels.map((k) => Object.assign({}, k, { stand: SCHAKEL[k.stand] || k.stand })),
      storingen: storingen.map((k) => Object.assign({}, k, { stand: STORING[k.stand] || k.stand }))
    };
    const t = { schakels: reg.schakels.length, gesloten: 0, openBekend: 0, stuk: 0, storingen: reg.storingen.length, gehouden: 0, gebroken: 0 };
    for (const x of reg.schakels.concat(reg.storingen)) t[x.stand] = (t[x.stand] || 0) + 1;
    reg.telling = t;
    reg.sluitMetBevinding = t.stuk === 0 && t.gebroken === 0;
    reg.sluit = reg.sluitMetBevinding && t.openBekend === 0;
    fs.writeFileSync(path.join(__dirname, '..', 'CONCIERGEPROEF.json'), JSON.stringify(reg, null, 2) + '\n');
    console.log('  geschreven: CONCIERGEPROEF.json\n');
  }
  process.exit(stuk ? 1 : 0);
})().catch(e => { console.error('\n  DE PROEF ZELF IS STUK:', e.message, '\n'); process.exit(2); });
