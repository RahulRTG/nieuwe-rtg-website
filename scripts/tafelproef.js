#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE TAFELPROEF -- één horecaketen als volledig verhaal over actoren heen.

   WAAR DIT UIT KOMT. MAATSTAF.md par. 7: de doctrine wil drie gouden
   ecosystemen, en horeca gaat eerst omdat daar de meeste ketenwaarheid al
   staat. Wat er níét stond was het BEWIJS dat de keten sluit. IDEMPROEF meet
   routes los, HERSTELPROEF meet paren, DOODSPOOR meet of een handeling een
   ontvanger heeft -- geen van drieën loopt één verhaal van begin tot eind.

   WAAROM HIJ TAFELPROEF HEET EN NIET KETENPROEF OF VERHAALPROEF. Allebei die
   namen zijn bezet: `scripts/lib/ketenproef.js` beoordeelt wat er per keten
   onder SABOTAGE gebeurde (een andere vraag), en "verhaal" is in dit huis een
   redactiebegrip. Dat is dezelfde botsing die `overdracht` opleverde, nu vóór
   het schrijven gevonden in plaats van erna. En hij heet naar de tafel en niet
   naar iets abstracts omdat er ER EEN IS: komt er later een mobiliteitsketen,
   dan heet die `ritproef.js`. Een gedeelde naam wordt gevonden zodra er twee
   zijn, niet vooraf verklaard (DEVELOPERCLOUD.md par. 2, de les van `Asset`).

   WAT HIJ MEET, en dat is iets anders dan alle andere proeven in dit huis:

     per SCHAKEL   handelt actor A, en ZIET actor B dat vervolgens?
     per STORING   houdt de keten zich aan wat hij belooft als het misgaat?

   De vraag is dus niet "geeft de route 200" maar "is de werkelijkheid van de
   volgende actor veranderd". Een schakel is `gesloten` als de ontvanger de
   verandering aantoonbaar ziet, `open` als hij hem niet ziet, en `stuk` als de
   handeling zelf al niet lukte. Een open of stukke schakel laat deze proef
   zakken -- dit is geen triagelijst zoals DOODSPOOR.json maar één keten die
   hoort te sluiten.

   WAT HIJ NIET MEET, en dat staat in de uitslag onder `grens`:
     - alleen de TAFEL-keten; bezorging, hotel en club hebben eigen naden;
     - de rekening loopt hier niet door tot een creditnota: de retourlaag
       (kern/commerce/retour.js) hangt aan een leverancierbestelling en niet
       aan een horecarekening, en die naad leggen is werk en geen proef;
     - er komt geen browser aan te pas, dus dit zegt niets over de schermen.

   Draaien:  npm run tafelproef              (print, zakt op een open schakel)
             npm run tafelproef:vast         (schrijft TAFELPROEF.json)
   ============================================================================ */
const fs = require('fs');
const path = require('path');
const { start } = require('./lib/wegwerpserver');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'TAFELPROEF.json');

async function post(basis, pad, lijf, tok) {
  const r = await fetch(basis + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(lijf || {})
  }).catch(() => null);
  if (!r) return { status: 0, data: null };
  return { status: r.status, data: await r.json().catch(() => null) };
}

/* Een schakel: wie handelt, wie hoort het te zien, en de meting ertussen.
   `zie` geeft de waarde die de ONTVANGER na afloop ziet; `verwacht` zegt wat
   die waarde dan moet zijn. Twee functies en geen booleaan, zodat de uitslag
   de gemeten waarde kan tonen -- "0 -> 1 bonnen op het bord" leest anders dan
   "true". */
function schakel(nr, van, naar, wat, opts) {
  return Object.assign({ nr, van, naar, wat }, opts);
}

async function loop(basis, uit) {
  const P = (pad, lijf, tok) => post(basis, pad, lijf, tok);
  const stap = async (s, doe, zien) => {
    const t0 = Date.now();
    let r, gezien = null, fout = null;
    try {
      r = await doe();
      /* Eerst de handeling: lukte die niet, dan is de schakel STUK en meten we
         de ontvanger niet -- die zou dan terecht niets zien en dat leest als
         een open schakel terwijl de oorzaak ervoor ligt. */
      if (!r || r.status < 200 || r.status >= 300) {
        uit.schakels.push(Object.assign({}, s, { stand: 'stuk', status: r ? r.status : 0,
          antwoord: r && r.data && (r.data.error || null), ms: Date.now() - t0 }));
        return null;
      }
      gezien = zien ? await zien(r) : null;
    } catch (e) { fout = String(e && e.message || e); }
    const stand = fout ? 'stuk' : (!zien ? 'gesloten' : (gezien && gezien.klopt ? 'gesloten' : 'open'));
    uit.schakels.push(Object.assign({}, s, { stand, status: r ? r.status : 0,
      ziet: gezien ? gezien.wat : null, fout, ms: Date.now() - t0 }));
    return r;
  };

  /* ---- de actoren ---- */
  const sup = await P('/api/supplier/login', { username: 'rahul', password: 'Imran' });
  if (!sup.data || !sup.data.token) throw new Error('geen leverancierssessie (status ' + sup.status + ') -- dan meet deze proef zichzelf');
  const S = sup.data.token;

  const kaart = await P('/api/supplier/horeca/kaart', {}, S);
  const item = kaart.data && kaart.data.groepen && kaart.data.groepen[0] && kaart.data.groepen[0].items[0];
  if (!item) throw new Error('geen kaartitem in de seed -- de proef heeft iets te bestellen nodig');
  const TAFEL = 'PROEF-1';

  const qr = await P('/api/supplier/horeca/gast/qr', { tafel: TAFEL, naam: TAFEL }, S);
  const qrToken = qr.data && qr.data.token;
  if (!qrToken) throw new Error('geen QR voor de tafel (status ' + qr.status + ')');

  /* 1 -- de zaak opent een rekening. Ontvanger: de gast die de QR scant. */
  const open = await stap(
    schakel(1, 'zaak', 'gast', 'opent een rekening op de tafel'),
    () => P('/api/supplier/horeca/rekening/open', { tafel: TAFEL }, S),
    async (r) => {
      const t = await P('/api/gast/tafel', { token: qrToken });
      return { klopt: t.status === 200 && t.data && t.data.plek === TAFEL,
        wat: 'de gast leest tafel ' + (t.data && t.data.plek) + ' bij ' + (t.data && t.data.zaak && t.data.zaak.naam) };
    });
  if (!open) return uit;
  const rekId = open.data.rekening.id;
  uit.rekening = rekId;

  /* 2 -- de bediening zet een stoel neer. Ontvanger: het gezelschapsbeeld.
     HORECA.md: dit is de tweede deur op dezelfde data, en een stoel van de
     bediening krijgt NOOIT een sessiesleutel. */
  await stap(
    schakel(2, 'zaak', 'zaak', 'zet een stoel aan tafel (de tweede deur, zonder sessie)'),
    () => P('/api/supplier/horeca/gezelschap/stoel', { rekeningId: rekId, naam: 'Stoel 1' }, S),
    async () => {
      const g = await P('/api/supplier/horeca/gezelschap', { rekeningId: rekId }, S);
      const st = (g.data && g.data.gezelschap && g.data.gezelschap.stoelen) || [];
      const eigen = st.find(x => x.handle === 'Stoel 1');
      return { klopt: !!eigen && eigen.eigenSessie === false,
        wat: st.length + ' stoel(en), stoel 1 zonder eigen sessie: ' + (eigen ? eigen.eigenSessie === false : null) };
    });

  /* 3 -- de gast schuift aan op DEZELFDE rekening. Dit is de kern van "één
     werkelijkheid": de gast die de QR scant, komt niet op een tweede bon. */
  const aan = await stap(
    schakel(3, 'gast', 'zaak', 'schuift aan via de QR en komt op dezelfde rekening'),
    () => P('/api/gast/aanschuiven', { token: qrToken, naam: 'Gast' }),
    async (r) => {
      const zelfde = r.data && r.data.rekening && r.data.rekening.rekeningId === rekId;
      const g = await P('/api/supplier/horeca/gezelschap', { rekeningId: rekId }, S);
      const st = (g.data && g.data.gezelschap && g.data.gezelschap.stoelen) || [];
      return { klopt: !!zelfde && st.length === 2,
        wat: 'gast op rekening ' + (r.data && r.data.rekening && r.data.rekening.rekeningId) +
          ' (zaak opende ' + rekId + '), ' + st.length + ' stoelen' };
    });
  if (!aan) return uit;
  const K = aan.data.sleutel;

  /* 4 -- de gast bestelt. Ontvanger: de rekening van de zaak. */
  await stap(
    schakel(4, 'gast', 'zaak', 'bestelt, en de regel landt op de rekening van de zaak'),
    () => P('/api/gast/bestel', { sleutel: K, items: [{ itemId: item.id, aantal: 1 }], idem: 'tafelproef-1' }),
    async () => {
      const r = await P('/api/supplier/horeca/rekening', { rekeningId: rekId }, S);
      const regels = (r.data && r.data.rekening && r.data.rekening.regels) || [];
      return { klopt: regels.length === 1 && regels[0].itemId === item.id,
        wat: regels.length + ' regel(s) op de bon van de zaak' };
    });

  /* 5 -- de zaal geeft de gang vrij. DIT IS DE HANDOFF die de proef zocht:
     vóór de vrijgave staat de bestelling niet op het keukenbord, erna wel.
     Zonder deze stap wacht het werk bij de bediening en ziet de keuken niets. */
  const bordVoor = await P('/api/supplier/horeca/keuken/bord', {}, S);
  await stap(
    schakel(5, 'zaal', 'keuken', 'geeft de gang vrij, en pas dan ziet de keuken de bon'),
    () => P('/api/supplier/horeca/gang/vrij', { rekeningId: rekId, gang: 0 }, S),
    async () => {
      const na = await P('/api/supplier/horeca/keuken/bord', {}, S);
      const voor = (bordVoor.data && bordVoor.data.aantal) || 0;
      const nu = (na.data && na.data.aantal) || 0;
      return { klopt: voor === 0 && nu === 1, wat: 'keukenbord ' + voor + ' -> ' + nu + ' bon(nen)' };
    });

  const bord = await P('/api/supplier/horeca/keuken/bord', {}, S);
  const bon = bord.data && bord.data.bonnen && bord.data.bonnen[0];
  const regelId = bon && bon.regelId;

  /* 6 -- de bon draagt de STOEL tot in de keuken. HORECA.md noemde de stoel het
     ontbrekende scharnier; dit meet of hij aan het eind van de keten nog staat. */
  await stap(
    schakel(6, 'keuken', 'keuken', 'ziet op welke stoel het gerecht hoort'),
    async () => ({ status: bon ? 200 : 404, data: bon }),
    async () => ({ klopt: !!bon && typeof bon.gastNr === 'number' && !!bon.stoel,
      wat: bon ? 'bon draagt gastNr ' + bon.gastNr + ' (' + bon.stoel + ')' : 'geen bon' }));

  /* 7 -- de keuken zet de stand. Ontvanger: de gast, die het in zijn eigen
     rekeningbeeld terugziet. */
  await stap(
    schakel(7, 'keuken', 'gast', 'zet de bon op uitgegeven, en de gast ziet dat'),
    () => P('/api/supplier/horeca/keuken/stand', { rekeningId: rekId, regelId, stand: 'uitgegeven' }, S),
    async () => {
      const g = await P('/api/gast/rekening', { sleutel: K });
      const s = g.data && g.data.rekening && g.data.rekening.service && g.data.rekening.service.geserveerd;
      return { klopt: !!s && s.uitgegeven >= 1, wat: s ? s.uitgegeven + ' van ' + s.besteld + ' uitgegeven' : 'geen servicebeeld' };
    });

  /* 8 -- de gast splitst per stoel. Meet de invariant uit HORECA.md: de delen
     tellen op tot wat er te betalen staat, tot op de cent. */
  await stap(
    schakel(8, 'gast', 'gast', 'splitst de rekening per stoel, en de delen sluiten op de cent'),
    () => P('/api/gast/verdeel', { sleutel: K }),
    async (r) => {
      const d = (r.data && r.data.delen) || [];
      const som = d.reduce((n, x) => n + (x.centen || 0), 0);
      return { klopt: d.length === 2 && som === r.data.teBetalen,
        wat: d.length + ' delen, som ' + som + ' van ' + (r.data && r.data.teBetalen) + ' centen' };
    });

  /* 9 -- de zaak rekent af. De ontvanger is de gast, en die ziet iets ANDERS
     dan een gesloten bon: zijn sessie is voorbij.

     DE EERSTE VERSIE VAN DEZE SCHAKEL TOETSTE DE VERKEERDE KANT. Er stond
     `openstaand === 0 && gesloten === true` -- allebei velden uit het antwoord
     van de ZAAK, terwijl deze proef juist bestaat om de ontvanger te meten. Hij
     stond op groen met `gastbeeld: undefined` eronder, en dat was de enige
     aanwijzing dat er niets van de gast was nagekeken.

     Wat de gast werkelijk ziet is 401 met code `sessie-weg` en de zin "Scan de
     QR op tafel opnieuw". Dat is geen gat maar een grens: een sleutel die na het
     afrekenen geldig blijft, is een tafel waar een vreemde later nog op kan
     kijken. De belofte is dus niet "de gast leest gesloten" maar "de gast wordt
     netjes afgesloten, met een reden en een weg terug" -- en dat is precies wat
     GRAMMATICA.md van elke verhindering vraagt. */
  const rek9 = await P('/api/supplier/horeca/rekening', { rekeningId: rekId }, S);
  const teBetalen = (rek9.data && rek9.data.rekening && rek9.data.rekening.openstaand) || 0;
  await stap(
    schakel(9, 'zaak', 'gast', 'rekent af; de gastsessie sluit met een reden en een weg terug'),
    () => P('/api/supplier/horeca/betaal', { rekeningId: rekId, wijze: 'pin', centen: teBetalen }, S),
    async (r) => {
      const zaakDicht = r.data && r.data.openstaand === 0 && r.data.gesloten === true;
      const g = await P('/api/gast/rekening', { sleutel: K });
      const nette = g.status === 401 && g.data && g.data.code === 'sessie-weg' &&
        /scan/i.test(String(g.data.error || ''));
      return { klopt: !!zaakDicht && !!nette,
        wat: 'zaak: openstaand ' + (r.data && r.data.openstaand) + ', gesloten ' + (r.data && r.data.gesloten) +
          ' | gast: ' + g.status + ' ' + (g.data && g.data.code) + ' -- "' + (g.data && g.data.error) + '"' };
    });

  return uit;
}

/* ---- DE STORINGEN. Elke primaire keten hoort te weten wat er misgaat, en dit
   is de helft die zonder proef altijd op "dat vangen we af" blijft staan. Elke
   storing noemt WAT hij belooft; komt het antwoord niet overeen, dan is de
   uitslag `gebroken` en zakt de proef. ---- */
async function storingen(basis, uit) {
  const P = (pad, lijf, tok) => post(basis, pad, lijf, tok);
  const S = (await P('/api/supplier/login', { username: 'rahul', password: 'Imran' })).data.token;
  const item = (await P('/api/supplier/horeca/kaart', {}, S)).data.groepen[0].items[0];
  const TAFEL = 'PROEF-2';
  const qrToken = (await P('/api/supplier/horeca/gast/qr', { tafel: TAFEL, naam: TAFEL }, S)).data.token;
  const rekId = (await P('/api/supplier/horeca/rekening/open', { tafel: TAFEL }, S)).data.rekening.id;
  const K = (await P('/api/gast/aanschuiven', { token: qrToken, naam: 'Gast' })).data.sleutel;

  const noteer = (naam, belofte, klopt, wat) =>
    uit.storingen.push({ naam, belofte, stand: klopt ? 'gehouden' : 'gebroken', wat });

  /* 1. DE DUBBELE TIK. Een gast op slechte wifi tikt twee keer op Bestellen. */
  await P('/api/gast/bestel', { sleutel: K, items: [{ itemId: item.id, aantal: 1 }], idem: 'storing-1' });
  const na1 = await P('/api/supplier/horeca/rekening', { rekeningId: rekId }, S);
  await P('/api/gast/bestel', { sleutel: K, items: [{ itemId: item.id, aantal: 1 }], idem: 'storing-1' });
  const na2 = await P('/api/supplier/horeca/rekening', { rekeningId: rekId }, S);
  const n1 = ((na1.data.rekening || {}).regels || []).length;
  const n2 = ((na2.data.rekening || {}).regels || []).length;
  noteer('dubbele tik op Bestellen', 'dezelfde sleutel geeft geen tweede regel',
    n1 === n2 && n1 === 1, n1 + ' regel(s) na de eerste, ' + n2 + ' na de herhaling');

  /* 2. TERUGZETTEN ZONDER REDEN. De keuken mag een stand terugzetten, maar niet
     stil: wat teruggaat blijft op de bon staan. */
  await P('/api/supplier/horeca/gang/vrij', { rekeningId: rekId, gang: 0 }, S);
  const bord = await P('/api/supplier/horeca/keuken/bord', {}, S);
  const b = (bord.data.bonnen || []).find(x => x.rekeningId === rekId);
  const regelId = b && b.regelId;
  await P('/api/supplier/horeca/keuken/stand', { rekeningId: rekId, regelId, stand: 'gestart' }, S);
  const terug = await P('/api/supplier/horeca/keuken/stand', { rekeningId: rekId, regelId, stand: 'besteld' }, S);
  noteer('een stand terugzetten zonder reden', 'wordt geweigerd, en de weigering zegt waarom',
    terug.status === 400 && /waarom/i.test(String(terug.data && terug.data.error)),
    'status ' + terug.status + ': ' + (terug.data && terug.data.error));

  /* 3. EEN RAIL DIE ER NIET IS. De gast wil met pin betalen vanaf zijn eigen
     telefoon. GRAMMATICA.md: een verhindering draagt altijd een reden, en hier
     ook de weg eromheen. */
  const pin = await P('/api/gast/betaal', { sleutel: K, wijze: 'pin', idem: 'storing-3' });
  noteer('betalen met een rail die de gastdeur niet heeft',
    'weigert, noemt de reden en zegt wat er wel kan',
    pin.status >= 400 && !!(pin.data && pin.data.error) && Array.isArray(pin.data && pin.data.rails),
    'status ' + pin.status + ', rails die wel kunnen: ' + JSON.stringify(pin.data && pin.data.rails));

  /* 4. EEN VERZONNEN SLEUTEL. Een gastsessie is de enige poort naar een
     rekening, dus een sleutel die niemand heeft uitgegeven hoort geen enkele
     tafel te openen -- ook niet half, met een leeg maar geldig antwoord. */
  const vreemd = await P('/api/gast/rekening', { sleutel: 'nietbestaand'.padEnd(32, '0') });
  noteer('een verzonnen gastsleutel',
    'opent geen enkele rekening en geeft geen leeg-maar-geldig antwoord',
    vreemd.status >= 400 && !(vreemd.data && vreemd.data.rekening),
    'status ' + vreemd.status + ', rekening in het antwoord: ' + !!(vreemd.data && vreemd.data.rekening));

  /* 5. TWEE REKENINGEN OP EEN TAFEL. Dan betaalt de ene tafel de bestelling van
     de andere -- de route weigert dat met de bestaande rekening erbij. */
  const tweede = await P('/api/supplier/horeca/rekening/open', { tafel: TAFEL }, S);
  noteer('een tweede rekening op dezelfde tafel', 'weigert en wijst naar de bestaande',
    tweede.status === 409 && tweede.data && tweede.data.rekeningId === rekId,
    'status ' + tweede.status + ', wijst naar ' + (tweede.data && tweede.data.rekeningId));

  return uit;
}

async function meet() {
  const uit = {
    stempel: new Date().toISOString().slice(0, 10),
    uitleg: 'Een horecaketen van tafel tot afrekening, gemeten per SCHAKEL (handelt actor A, en ziet actor B dat?) en per STORING (houdt de keten zich aan wat hij belooft als het misgaat?). Zie MAATSTAF.md par. 7.',
    grens: 'Alleen de tafel-keten; bezorging, hotel en club hebben eigen naden. De rekening loopt niet door tot een creditnota: de retourlaag hangt aan een leverancierbestelling en niet aan een horecarekening. Er komt geen browser aan te pas, dus dit zegt niets over de schermen.',
    schakels: [], storingen: [], rekening: null
  };
  const srv = await start({ naam: 'tafelproef', gereed: 'ready',
    env: { NODE_ENV: 'test', RTG_DEMO: '1', OFFICE_CODE: 'RTG-OFFICE-PROEF' } });
  try {
    await loop(srv.basis, uit);
    await storingen(srv.basis, uit);
  } finally { srv.klaar(); }

  const t = { schakels: uit.schakels.length, gesloten: 0, open: 0, stuk: 0,
    storingen: uit.storingen.length, gehouden: 0, gebroken: 0 };
  for (const s of uit.schakels) t[s.stand]++;
  for (const s of uit.storingen) t[s.stand]++;
  uit.telling = t;
  uit.sluit = t.open === 0 && t.stuk === 0 && t.gebroken === 0 && t.schakels >= 9;
  return uit;
}

function druk(u) {
  console.log('tafelproef: ' + u.telling.schakels + ' schakels (' + u.telling.gesloten + ' gesloten, ' +
    u.telling.open + ' open, ' + u.telling.stuk + ' stuk), ' + u.telling.storingen + ' storingen (' +
    u.telling.gehouden + ' gehouden, ' + u.telling.gebroken + ' gebroken).');
  for (const s of u.schakels)
    console.log('  ' + String(s.nr).padStart(2) + ' ' + (s.van + '->' + s.naar).padEnd(14) +
      s.stand.padEnd(9) + s.wat + (s.ziet ? '\n      ziet: ' + s.ziet : '') +
      (s.antwoord ? '\n      antwoord: ' + s.antwoord : '') + (s.fout ? '\n      FOUT: ' + s.fout : ''));
  for (const s of u.storingen)
    console.log('  -- ' + s.stand.padEnd(9) + s.naam + '\n      belooft: ' + s.belofte + '\n      gaf: ' + s.wat);
  console.log(u.sluit ? '\nDe keten sluit.' : '\nDE KETEN SLUIT NIET.');
}

module.exports = { meet, DOEL };

if (require.main === module) {
  meet().then(u => {
    if (process.argv.includes('--json')) { console.log(JSON.stringify(u)); process.exit(u.sluit ? 0 : 1); }
    druk(u);
    if (process.argv.includes('--vastleggen')) {
      fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
      console.log('geschreven: TAFELPROEF.json');
    }
    process.exit(u.sluit ? 0 : 1);
  }).catch(e => { console.error('de tafelproef kon niet draaien: ' + (e && e.message || e)); process.exit(1); });
}
