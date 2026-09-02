#!/usr/bin/env node
/* DE ECHTE DROOGLOOP -- een plan werkelijk laten lopen, maar nergens waar het
   telt. EXECUTIE.md blok 4, de helft die openstond.

   WAT ER AL WAS EN WAT ERAAN ONTBRAK. server/kern/stuur/gevolg.js voorspelt wat
   een plan aanraakt door een EERDERE meting op de stappen te projecteren. Dat is
   nuttig en het is geen droogloop: 96 van de 176 bereikbare paden staan daar op
   `onbekend`, en een projectie kan per definitie niets zeggen over deze invoer.

   WAAROM NIET DE ZANDBAK. server/kern/command/zandbak.js leek de plek -- hij
   draait uit de zaaiset en schrijft structureel niet terug. Maar hij is een
   DATAVENSTER voor de Command-laag (journaal, beleid, risico, runbooks), geen
   routehost: er luistert geen HTTP op. Een plan bestaat uit API-paden, dus daar
   kan het niet draaien. Dat is geen gebrek van de zandbak; hij is voor iets
   anders gebouwd.

   WEL: DEZELFDE WEGWERPSERVER DIE DE PROEVEN AL GEBRUIKEN. scripts/lib/
   wegwerpserver.js start een echte server met een EIGEN DATAMAP op een eigen
   poort, en ruimt hem daarna op. Daar draait het plan echt -- met echte routes,
   echte poorten en echte bevestigingen -- en raakt het niets van de productie.
   Er komt geen tiende kopie van die opstelling bij; deze gebruikt de bestaande.

   WAT DE UITSLAG ZEGT, PER STAP: de status, en welke collecties er werkelijk
   veranderden -- gemeten door de opslag voor en na te vergelijken. Dat is geen
   projectie meer maar een waarneming aan DEZE invoer.

   DRIE GRENZEN, EN ZE STAAN IN DE UITSLAG:

   1 Een stap op niveau `voorstel` wordt NIET bevestigd. De droogloop laat het
     voorstel ontstaan en stopt daar: bevestigen is een menselijke handeling en
     die simuleert dit script niet. Wat achter die bevestiging gebeurt, blijft
     dus ongemeten -- en dat staat er per stap bij.
   2 De data komt uit de zaaiset. Een plan dat op de gegevens van een echt lid
     leunt, doet hier iets anders.
   3 Alles buiten de opslag blijft onzichtbaar: mail, een betaalprovider, een
     derde partij. Dezelfde grens als bij de voorspelling.

   Draaien: npm run droogloop */
'use strict';
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { stempel } = require('./lib/stempel');
const { DatabaseSync } = require('node:sqlite');
const { start } = require('./lib/wegwerpserver');
const { gevolgVan } = require('../server/kern/stuur/gevolg');

const WORTEL = path.join(__dirname, '..');

/* Het plan dat standaard gedroogd wordt: de pilotketen uit EXECUTIE.md par. 7,
   aangevuld met twee stappen die zeker iets doen. Een eigen plan meegeven kan
   met --plan <bestand>. */
const STANDAARDPLAN = {
  doel: 'een handvol stappen van een lid, om te zien wat er werkelijk verandert',
  stappen: [
    { id: 's1', capability: '/api/pay/overzicht', invoer: {} },
    { id: 's2', capability: '/api/agenda/mijn', invoer: {} },
    { id: 's3', capability: '/api/leerstof/vakken', invoer: { groep: 5 } },
    { id: 's4', capability: '/api/mediaos/stuur', invoer: { richting: 'meer', onderwerp: 'reizen' } },
    { id: 's5', capability: '/api/agenda/toevoegen', invoer: { titel: 'droogloop', datum: '2026-12-01' } }
  ]
};

function leesPlan() {
  const i = process.argv.indexOf('--plan');
  if (i < 0 || !process.argv[i + 1]) return STANDAARDPLAN;
  return JSON.parse(fs.readFileSync(process.argv[i + 1], 'utf8'));
}

/* HET BEELD VAN DE OPSLAG. De eerste versie las db.json, en die BESTAAT NIET
   in een verse datamap: de opslag is sqlite (rtg.db, store.db, grootboek.db).
   Daardoor stond de uitslag op "0 collecties bewogen" terwijl een agenda-item
   er aantoonbaar bij kwam -- een meting die stil nul zegt is erger dan een die
   afbreekt, en precies daarom staat de db.json-tak er nog: als hij er wel is,
   telt hij mee. Gemeten wordt WELKE tabel bewoog, per bestand. */
const BOEKEN = ['rtg.db', 'store.db', 'grootboek.db'];

function opslagBeeld(datamap) {
  const uit = {};
  try {
    const rauw = JSON.parse(fs.readFileSync(path.join(datamap, 'db.json'), 'utf8'));
    for (const [naam, waarde] of Object.entries(rauw || {}))
      uit['db.json:' + naam] = Array.isArray(waarde) ? waarde.length
        : (waarde && typeof waarde === 'object' ? Object.keys(waarde).length : String(waarde).length);
  } catch (e) { /* geen db.json: dat is de gewone stand */ }
  for (const boek of BOEKEN) {
    const bestand = path.join(datamap, boek);
    if (!fs.existsSync(bestand)) continue;
    let db;
    try {
      db = new DatabaseSync(bestand, { readOnly: true });
      const tabellen = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
      for (const t of tabellen) {
        /* De kv-tabel IS de collectielijst: elke sleutel is wat db.json ooit een
           collectie noemde, en de kolom `ver` telt hoe vaak hij is geschreven.
           Een rijtelling op kv bewoog nooit -- die had gezegd "er verandert
           niets" terwijl er een agenda-item bij kwam. Per sleutel dus, en op
           `ver`, want dat verandert ook als een lijst even lang blijft. */
        try {
          if (t.name === 'kv') {
            for (const r of db.prepare('SELECT key, ver, length(val) AS n FROM kv').all())
              uit[boek + ':' + r.key] = String(r.ver) + '/' + String(r.n);
          } else {
            uit[boek + ':' + t.name] = db.prepare('SELECT COUNT(*) AS n FROM "' + t.name + '"').get().n;
          }
        } catch (e) { /* een tabel die niet te tellen is, telt niet mee */ }
      }
    } catch (e) { uit[boek + ':<niet te lezen>'] = -1; }
    finally { try { db && db.close(); } catch (e) {} }
  }
  return Object.keys(uit).length ? uit : null;
}

/* HUISHOUDING TEGENOVER DOMEIN. Elke oproep schrijft in het apispoor, het
   handelingLog en de AI-teller -- ook een die alleen leest. Dat is echte
   verandering en het hoort in de uitslag, maar wie het op een hoop gooit met
   het gevolg van de handeling zelf, krijgt vijf stappen die allemaal "raakt
   van alles aan" heten. Twee lijsten dus, en de reden staat erbij. */
const SPOREN = ['apiSpoor', 'handelingLog', 'rtgai'];
const isSpoor = (naam) => SPOREN.includes(String(naam).split(':').pop());

/* TWEE BEELDEN, TWEE VRAGEN. Hierboven telt `ver` -- het versienummer van een
   sleutel -- en dat beantwoordt "is er iets gebeurd". Dat is precies wat de
   droogloop wil weten, en het is precies wat de HERSTELPROEF niet kan
   gebruiken: `ver` loopt alleen maar op, dus na een heen- en een terugstap
   staat hij nooit meer op zijn oude waarde, ook niet als de inhoud terug is.
   Voor "staat het er weer zoals het stond" hoort dus een INHOUDSbeeld, en die
   twee door elkaar halen zou de herstelproef laten zeggen dat niets ooit
   herstelt. Zelfde bestand, want het is dezelfde opslag. */
function inhoudsBeeld(datamap) {
  const uit = {};
  for (const boek of BOEKEN) {
    const bestand = path.join(datamap, boek);
    if (!fs.existsSync(bestand)) continue;
    let db;
    try {
      db = new DatabaseSync(bestand, { readOnly: true });
      const heeftKv = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='kv'").get();
      if (!heeftKv) continue;
      for (const r of db.prepare('SELECT key, val FROM kv').all())
        uit[boek + ':' + r.key] = crypto.createHash('sha256').update(String(r.val || '')).digest('hex').slice(0, 16);
    } catch (e) { /* niet te lezen: die collectie doet niet mee */ }
    finally { try { db && db.close(); } catch (e) {} }
  }
  return Object.keys(uit).length ? uit : null;
}

function verschil(voor, na) {
  if (!voor || !na) return null;
  const uit = [];
  for (const naam of new Set([...Object.keys(voor), ...Object.keys(na)]))
    if (voor[naam] !== na[naam]) uit.push(naam);
  return uit.sort();
}

async function main() {
  const plan = leesPlan();
  console.log('DE ECHTE DROOGLOOP\n');
  console.log('  doel: ' + plan.doel);
  console.log('  ' + plan.stappen.length + ' stappen, tegen een wegwerpserver met een eigen datamap\n');

  /* De testinlog mint alleen TOKENS, en alleen in de uitdrukkelijk geisoleerde
     testomgeving (server/testomgeving.js: NODE_ENV=test EN RTG_DEMO=1). Zonder
     die twee geeft /api/login geen sessie -- daar liep de eerste versie op vast.
     De routes die daarna draaien zijn de echte, met hun echte poorten ervoor. */
  const srv = await start({ naam: 'droogloop', gereed: 'ready',
    env: { NODE_ENV: 'test', RTG_DEMO: '1' } });
  const stappen = [];
  try {
    const login = await fetch(srv.basis + '/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' })
    }).then(async r => ({ status: r.status, data: await r.json().catch(() => null) })).catch(e => ({ status: 0, data: null }));
    /* Het antwoord van de inlog is niet overal dezelfde vorm; accepteer beide,
       en toon bij een mislukking WAT er wel terugkwam. Een meting die stil
       stopt met "het lukte niet" laat je raden, en raden is hier het probleem. */
    const token = (login.data && (login.data.token || (login.data.data && login.data.data.token))) || null;
    if (!token) throw new Error('geen sessie op de wegwerpserver (status ' + login.status + ', antwoord ' +
      JSON.stringify(login.data) + '): zonder inlog meet deze droogloop niets');

    for (const s of plan.stappen) {
      const voor = opslagBeeld(srv.datamap);
      let status = 0, antwoord = null;
      try {
        const r = await fetch(srv.basis + s.capability, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify(s.invoer || {})
        });
        status = r.status;
        antwoord = await r.json().catch(() => null);
      } catch (e) { status = 0; }
      /* De schrijver is asynchroon; even ademen voordat we het beeld nemen. */
      await new Promise(r => setTimeout(r, 250));
      const na = opslagBeeld(srv.datamap);
      const gewijzigd = verschil(voor, na) || [];
      const domein = gewijzigd.filter(n => !isSpoor(n));
      const sporen = gewijzigd.filter(isSpoor);
      /* De voorspelling van gevolg.js naast de waarneming leggen. Dat is de
         hele reden dat deze droogloop bestaat: een projectie uit een eerdere
         proefronde tegenover wat er met DEZE invoer werkelijk gebeurde. */
      const voorspeld = gevolgVan(s.capability);
      const bevestigNodig = !!(antwoord && (antwoord.bevestigNodig || antwoord.goedkeuring));
      stappen.push({ id: s.id, capability: s.capability, status, gewijzigd, domein, sporen, bevestigNodig,
        voorspeld: { graad: voorspeld.graad, collecties: voorspeld.collecties },
        klopteVoorspelling: voorspeld.graad === 'onbekend' ? null
          : (voorspeld.graad === 'gemeten' ? domein.length > 0 : domein.length === 0),
        gemeten: !bevestigNodig,
        reden: bevestigNodig
          ? 'deze stap leverde een VOORSTEL op; bevestigen is mensenwerk en dat doet dit script niet, ' +
            'dus wat erachter gebeurt blijft ongemeten'
          : (gewijzigd.length ? 'gemeten aan deze invoer' : 'draaide en raakte geen enkele collectie aan') });
      console.log('  ' + String(status).padEnd(4) + s.capability.padEnd(28) +
        (bevestigNodig ? '[voorstel: niet bevestigd]'
          : (domein.map(n => n.split(':').pop()).join(' ') || '(alleen huishouding)')) +
        '   voorspeld: ' + voorspeld.graad);
    }
  } finally {
    try { srv.klaar(); } catch (e) {}
  }

  const gemeten = stappen.filter(s => s.gemeten).length;
  const geraakt = [...new Set(stappen.flatMap(s => s.gewijzigd))].sort();
  const beoordeeld = stappen.filter(s => s.klopteVoorspelling !== null);
  const kloppend = beoordeeld.filter(s => s.klopteVoorspelling).length;
  const uit = {
    uitleg: 'Een plan werkelijk uitgevoerd tegen een wegwerpserver met een eigen datamap, en per stap ' +
      'gemeten welke collecties bewogen. Dit is een waarneming aan DEZE invoer, geen projectie.',
    doel: plan.doel, stappen,
    telling: { stappen: stappen.length, gemeten, nietGemeten: stappen.length - gemeten, collecties: geraakt.length,
      voorspellingBeoordeeld: beoordeeld.length, voorspellingKlopt: kloppend,
      voorspellingOnbekend: stappen.length - beoordeeld.length },
    huishouding: { sporen: SPOREN,
      uitleg: 'deze collecties schrijft ELKE oproep, ook een die alleen leest; ze staan apart ' +
        'zodat het gevolg van de handeling zelf zichtbaar blijft' },
    geraakteCollecties: geraakt,
    /* Waar de projectie en de waarneming uit elkaar lopen. Dit is de opbrengst
       van de droogloop: gevolg.js kan alleen zeggen wat een EERDERE proef zag,
       en die proef had andere invoer. */
    afwijkingen: stappen.filter(s => s.klopteVoorspelling === false).map(s => ({
      capability: s.capability, voorspeld: s.voorspeld.graad, waargenomen: s.domein,
      reden: s.voorspeld.graad === 'geen-effect-gemeten'
        ? 'de proefronde zag niets veranderen; met deze invoer veranderde er wel iets'
        : 'de proefronde zag iets veranderen; met deze invoer bleef het domein onaangeroerd' })),
    grenzen: [
      'een stap op niveau `voorstel` wordt niet bevestigd: bevestigen is mensenwerk, dus wat daarachter gebeurt blijft ongemeten',
      'de gegevens komen uit de zaaiset; een plan dat op de gegevens van een echt lid leunt doet hier iets anders',
      'alles buiten de opslag blijft onzichtbaar: mail, een betaalprovider, een derde partij',
      'gemeten wordt WELKE collectie bewoog, niet hoeveel erin veranderde',
      'een voorspelling op `onbekend` wordt niet beoordeeld: onbekend kan niet fout zijn, en dat als goed tellen zou de uitslag opkloppen'
    ]
  };
  Object.assign(uit, { stempel: stempel() });
  fs.writeFileSync(path.join(WORTEL, 'DROOGLOOP.json'), JSON.stringify(uit, null, 1) + '\n');
  console.log('\n  ' + gemeten + ' van ' + stappen.length + ' stappen gemeten; ' +
    geraakt.length + ' collectie(s) bewogen.');
  console.log('  voorspelling: ' + kloppend + ' van ' + beoordeeld.length + ' beoordeelde stappen klopte; ' +
    (stappen.length - beoordeeld.length) + ' stond op onbekend en is niet beoordeeld.');
  for (const a of uit.afwijkingen)
    console.log('  afwijking: ' + a.capability + ' -- voorspeld ' + a.voorspeld +
      ', waargenomen ' + (a.waargenomen.map(n => n.split(':').pop()).join(' ') || 'niets'));
  console.log('\nDROOGLOOP.json geschreven.');
}

if (require.main === module) main().catch(e => { console.error('droogloop: ' + e.message); process.exit(1); });
module.exports = { opslagBeeld, inhoudsBeeld, verschil, isSpoor, SPOREN, STANDAARDPLAN };
