#!/usr/bin/env node
'use strict';
/* ============================================================================
   POSITIEPROEF -- wat laat een doorloop in de opslag achter? (A0c)

   De tweede helft van de grondwetmeter uit NAVIGATIE.md par. 6.4 (besluit
   N10). `scripts/positiestroom.js` leest de BRON; deze proef start een echte
   server, loopt de stappen waarin een lid een positie naar de server stuurt, en
   leest daarna de hele OPSLAG. Dat vangt wat een bronlezer niet kan zien: een
   collectie die "vluchtig" heet en toch naar schijf gaat, een kopie die via een
   omweg ergens anders belandt, een termijn die in de code staat maar niet loopt.

   HERKENBARE COORDINATEN. Elke positie die de proef stuurt, draagt een eigen
   waarde in de vijfde decimaal. Wat na afloop in de opslag staat, is daardoor
   precies terug te voeren op de stap die het veroorzaakte -- en de posities van
   zaken uit de zaaidata tellen nooit mee, want die heeft de proef niet gestuurd.

   WAT HIJ TELT, en de namen zijn die van NAVIGATIE.md par. 6.4:

     blijvendeNavPositie   een positie uit een navigatieverzoek die na het
                           antwoord nog ergens staat
     positieNaVenster      een positie die er nog is nadat haar taak voorbij is
                           (Onderweg gestopt, het venster gesloten)
     passageLog            een regel "langs dit hek" voor een hek dat niet het
                           doel van het venster was
     aankomstUitPositie    een aankomst die de server zette op grond van een
                           positie, en niet op een bevestiging
     onbegrensdeRitlijn    niet gelopen: een rit vraagt een vervoerder, een
                           chauffeur en een betaling, en die wereld zet deze
                           proef (nog) niet op -- null MET die reden, nooit 0

   WAT HIJ NIET TELT (N11). Een positie die tijdens een taak wordt verwerkt en
   daarna verdwijnt, is geen schuld. Hier telt alleen wat BLIJFT.

   DE BESTURINGSPROEF. De proef weet van ten minste een stap dat hij een positie
   achterlaat, en MET OPZET: een verkeersmelding bewaart de plek van de melding
   (`noodzakelijk`, besluit N15). Vindt hij die niet terug, dan is de LEZER blind
   -- en dan meldt hij geen nullen maar zakt hij. Een meter die niets kan vinden,
   vindt ook niets. Het anker was eerst de positie die Onderweg na het stoppen
   liet staan; sinds N14 wist stoppen die, en een anker dat de reparatie
   wegneemt is geen anker meer. Een bewuste bewaring kan niet wegrepareren.

        node scripts/positieproef.js                 (toont de uitslag)
        node scripts/positieproef.js --vastleggen    (schrijft POSITIEPROEF.json)
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { start } = require('./lib/wegwerpserver');
const { stempel, eisSchoneBoom } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'POSITIEPROEF.json');
const ZAAK = 'PONTO';

/* De merktekens. Rond het demonstratieraster (Ibiza), zodat routeren werkt, en
   elk met een eigen staart. Twee posities die per ongeluk dezelfde staart
   krijgen, maken een vondst onherleidbaar; daarom staan ze hier bij elkaar. */
const MERK = {
  routeVan: { lat: 38.90111, lng: 1.41111 },
  routeNaar: { lat: 38.92222, lng: 1.43222 },
  zoek: { lat: 38.90333, lng: 1.41333 },
  melding: { lat: 38.90444, lng: 1.41444 },
  onderwegStart: { lat: 38.90555, lng: 1.41555 },
  onderwegOnderweg: { lat: 38.90666, lng: 1.41666 }
};
const GRENS = 0.000011;   // tot op ongeveer een meter: vijf decimalen

function isMerk(o) {
  if (!o || typeof o !== 'object') return null;
  const lat = Number(o.lat), lng = Number(o.lng != null ? o.lng : (o.lon != null ? o.lon : o.lng));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  for (const [naam, m] of Object.entries(MERK))
    if (Math.abs(lat - m.lat) < GRENS && Math.abs(lng - m.lng) < GRENS) return naam;
  return null;
}

/* Loop door een waarde en geef elk pad waar een merkteken staat. */
function zoekMerken(waarde, pad, uit) {
  if (Array.isArray(waarde)) { waarde.forEach((v, i) => zoekMerken(v, pad + '[' + i + ']', uit)); return uit; }
  if (waarde && typeof waarde === 'object') {
    const m = isMerk(waarde);
    if (m) uit.push({ merk: m, pad });
    for (const [k, v] of Object.entries(waarde)) zoekMerken(v, pad + '.' + k, uit);
  }
  return uit;
}

/* De opslag van de wegwerpserver lezen. Zonder RTG_ENC_KEY staat hij als leesbare
   JSON in de kv-tabel (server/db/sqlite.js); is hij toch versleuteld, dan zegt
   de proef dat en telt hij die collectie niet als leeg. */
function leesOpslag(datamap) {
  const bestand = path.join(datamap, 'store.db');
  if (!fs.existsSync(bestand)) return { fout: 'geen store.db in de datamap' };
  const db = new DatabaseSync(bestand, { readOnly: true });
  try {
    const uit = {}, onleesbaar = [];
    for (const r of db.prepare('SELECT key, val FROM kv').all()) {
      try { uit[r.key] = JSON.parse(String(r.val)); } catch (e) { onleesbaar.push(r.key); }
    }
    return { collecties: uit, onleesbaar };
  } finally { db.close(); }
}

async function doorloop() {
  const srv = await start({ naam: 'positieproef', env: { RTG_DEMO: '1', RTG_ENC_KEY: '' } });
  const post = async (pad, body, token) => {
    const r = await fetch(srv.basis + pad, { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body: JSON.stringify(body || {}) });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  };
  const stappen = [];
  const stap = async (naam, pad, body, token) => {
    const r = await post(pad, body, token);
    stappen.push({ naam, pad, status: r.status });
    return r;
  };
  try {
    const login = await post('/api/login', { tier: 'rtg' });
    const lid = login.data && login.data.token;
    if (!lid) throw new Error('geen ledensessie (status ' + login.status + ') -- dan meet deze proef niets');

    // 1. navigeren: de positie hoort het antwoord niet te overleven
    await stap('route', '/api/nav/route', { van: MERK.routeVan, naar: MERK.routeNaar, modus: 'auto' }, lid);
    await stap('bestemmingen zoeken', '/api/nav/bestemmingen', Object.assign({ q: 'Ponto' }, MERK.zoek), lid);

    // 2. een verkeersmelding: een bewuste melding, met een termijn in de module
    await stap('verkeersmelding', '/api/nav/meld', Object.assign({ soort: 'file' }, MERK.melding), lid);

    // 3. Onderweg: starten, bewegen, aankomen bij de zaak, stoppen
    await stap('onderweg start', '/api/live/start', Object.assign({ destCode: ZAAK, mode: 'driving' }, MERK.onderwegStart), lid);
    await stap('onderweg positie', '/api/live/update', MERK.onderwegOnderweg, lid);
    const zaken = await post('/api/nav/kaart', {}, lid);
    const zaakPlek = ((zaken.data && zaken.data.plekken) || []).find(p => p.code === ZAAK) || null;
    let aankomstGesteld = null;
    if (zaakPlek) {
      /* De stoep is geen verzonnen merkteken maar de plek van de zaak zelf; hij
         wordt er een zodra hij bekend is, anders overschrijft deze stap de
         vorige posities en ziet de lezer niets meer terug. */
      MERK.stoep = { lat: Number(zaakPlek.lat), lng: Number(zaakPlek.lng) };
      const a = await stap('onderweg op de stoep', '/api/live/update', { lat: zaakPlek.lat, lng: zaakPlek.lng }, lid);
      aankomstGesteld = !!(a.data && a.data.live && a.data.live.arrived);
    }
    await stap('onderweg stop', '/api/live/stop', {}, lid);

    // 4. nadering: een venster, een passage langs een ander hek, en de eigen zaak
    await stap('venster open', '/api/plaats/venster', { doel: 'nadering', bron: 'bezoek aan ' + ZAAK, hek: 'leverancier:' + ZAAK, minuten: 30 }, lid);
    const hekken = await post('/api/plaats/hekken', { doel: 'nadering' }, lid);
    const eigen = 'leverancier:' + ZAAK;
    const ander = ((hekken.data && hekken.data.hekken) || []).map(h => h.id).find(id => id && id !== eigen) || null;
    if (ander) {
      await stap('langs een andere zaak', '/api/plaats/waarneem', { doel: 'nadering', hek: ander, wat: 'binnen' }, lid);
      await stap('weer weg', '/api/plaats/waarneem', { doel: 'nadering', hek: ander, wat: 'buiten' }, lid);
    }
    await stap('bij de eigen zaak', '/api/plaats/waarneem', { doel: 'nadering', hek: eigen, wat: 'binnen' }, lid);
    await stap('venster dicht', '/api/plaats/venster/sluit', { doel: 'nadering' }, lid);

    /* Laat de schrijflaag bijkomen. De SQLite-motor schrijft achter; een lezer
       die meteen kijkt, ziet de toestand van VOOR de laatste stappen. Er wordt
       gewacht tot twee opeenvolgende lezingen gelijk zijn EN er ten minste een
       seconde voorbij is -- wachten op stilte alleen is niet wachten op de
       schrijver (EXECUTIE.md, de herstelproef). */
    let vorige = null, opslag = null;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      opslag = leesOpslag(srv.datamap);
      const nu = JSON.stringify(Object.keys(opslag.collecties || {}).sort()) + JSON.stringify((opslag.collecties || {}).live || {});
      if (i >= 2 && nu === vorige) break;
      vorige = nu;
    }
    return { stappen, opslag, aankomstGesteld, anderHek: ander, zaakPlek: !!zaakPlek };
  } finally {
    srv.klaar();
  }
}

function tel(uitslag) {
  const { opslag } = uitslag;
  if (opslag.fout) return { fout: opslag.fout };
  const vondsten = [];
  for (const [coll, waarde] of Object.entries(opslag.collecties)) {
    for (const v of zoekMerken(waarde, coll, [])) {
      // de stoep is de plek van de zaak: alleen een KOPIE ervan bij het lid telt
      if (v.merk === 'stoep' && !v.pad.startsWith('live.')) continue;
      vondsten.push(v);
    }
  }
  const van = (...merken) => vondsten.filter(v => merken.includes(v.merk));
  const log = Array.isArray(opslag.collecties.plaatsLog) ? opslag.collecties.plaatsLog : [];
  const passages = uitslag.anderHek
    ? log.filter(r => r && r.wat === 'waargenomen' && r.hek === uitslag.anderHek) : null;

  return {
    vondsten,
    tellers: {
      blijvendeNavPositie: van('routeVan', 'routeNaar', 'zoek').length,
      positieNaVenster: van('onderwegStart', 'onderwegOnderweg', 'stoep').filter(v => v.pad.startsWith('live.')).length,
      passageLog: passages === null ? null : passages.length,
      aankomstUitPositie: uitslag.aankomstGesteld === null ? null : (uitslag.aankomstGesteld ? 1 : 0),
      onbegrensdeRitlijn: null
    },
    redenen: {
      passageLog: passages === null ? 'de hekkenlijst gaf geen tweede hek; er was niets om langs te lopen' : null,
      aankomstUitPositie: uitslag.aankomstGesteld === null ? 'de zaak had geen plek op de kaart' : null,
      onbegrensdeRitlijn: 'niet gelopen: een rit vraagt een vervoerder, een chauffeur en een betaling, en die ' +
        'wereld zet deze proef (nog) niet op -- geen meting is geen nul'
    },
    melding: van('melding').map(v => v.pad),
    onleesbaar: opslag.onleesbaar
  };
}

async function meet() {
  const uitslag = await doorloop();
  const t = tel(uitslag);
  if (t.fout) return { fout: t.fout };
  const besturing = {
    inOrde: t.vondsten.some(v => v.merk === 'melding'),
    wat: 'Een verkeersmelding bewaart met opzet de plek van de melding (NAVIGATIE.md N15, noodzakelijk). Vindt de ' +
      'lezer dat merkteken niet terug, dan is hij blind en zegt een rij nullen niets.'
  };
  return {
    graad: 'gemeten',
    hoe: 'een wegwerpserver met eigen datamap, een doorloop met herkenbare coordinaten per stap, en daarna de ' +
      'hele opslag (store.db) gelezen op die coordinaten.',
    grens: 'Een doorloop meet wat DEZE stappen achterlaten, niet wat het huis in het algemeen bewaart; de ' +
      'bronmeter (POSITIESTROOM.json) ziet de rest. De ritlijn is niet gelopen. En de proef meet een verse ' +
      'server: termijnen die pas na dagen lopen (de bewaarveger, het bewaarbeleid) zijn hier nog niet ' +
      'verstreken, dus "staat er nog" betekent "staat er na de taak", niet "staat er voor altijd".',
    besturing,
    stappen: uitslag.stappen,
    tellers: t.tellers,
    redenen: t.redenen,
    vondsten: t.vondsten,
    meldingBewaard: t.melding,
    onleesbaar: t.onleesbaar
  };
}

if (require.main === module) {
  meet().then(uit => {
    if (uit.fout) { console.error('\n  POSITIEPROEF: ' + uit.fout + '\n'); process.exit(2); }
    console.log('\nPOSITIEPROEF -- wat een doorloop in de opslag achterlaat\n');
    for (const s of uit.stappen) console.log('  ' + String(s.status).padEnd(5) + s.naam);
    console.log('');
    for (const [k, v] of Object.entries(uit.tellers))
      console.log('  ' + k.padEnd(22) + (v === null ? 'niet gemeten -- ' + uit.redenen[k] : v));
    console.log('\n  gevonden:');
    for (const v of uit.vondsten) console.log('    ' + v.merk.padEnd(18) + v.pad);
    if (uit.onleesbaar.length) console.log('\n  onleesbaar (versleuteld?): ' + uit.onleesbaar.join(', '));
    if (!uit.besturing.inOrde) {
      console.error('\n  BESTURINGSPROEF GEZAKT: ' + uit.besturing.wat + '\n');
      process.exit(1);
    }
    if (process.argv.includes('--vastleggen')) {
      const poort = eisSchoneBoom('positieproef');
      if (!poort.ok) { console.error(poort.reden); process.exit(1); }
      fs.writeFileSync(DOEL, JSON.stringify(Object.assign({ stempel: stempel() }, uit), null, 2) + '\n');
      console.log('\nVastgelegd in POSITIEPROEF.json\n');
    } else console.log('');
  }).catch(e => { console.error(e && e.stack || e); process.exit(2); });
}

module.exports = { meet, tel, zoekMerken, isMerk, MERK };
