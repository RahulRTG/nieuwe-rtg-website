/* ============================================================================
   DE LIVEGANG-SCHOONMAAK: welke zaken verdwijnen er zonder RTG_DEMO, en welke
   niet.

   WAT ER MISGING

   De opruiming stond in initdata/deel7-salon.js en draaide dus VOOR deel8,
   deel9 en deel10. Die drie zetten hun zaken pas daarna neer, en die
   overleefden daardoor precies de opruiming die hen moest weghalen. Het gevolg
   was zichtbaar in een echte database: geen hotel, geen restaurant, geen bar,
   geen taxi en geen jet (die gingen er wel uit, want die komen uit deel1 en de
   basis-seed), maar wel een tandarts, een wasserij, een garage en een club. Een
   productiecatalogus met zeventien demozaken erin, en de zes bekendste eruit.

   De tweede fout zat in de lijst waarop werd opgeruimd. Die was met de hand
   bijgehouden, beloofde in het commentaar "dekt alle geseede partners", en
   miste er vijftien -- waaronder ZENITH, CLARA, BODE, MERIDIAAN en SEGUR. Twee
   plekken die dezelfde waarheid vasthielden (LAT-regel 4) met een belofte in
   tekst die niet meer waar was (regel 6).

   En het personeel bleef achter. In de aangetroffen database stonden 181
   personeelsrijen bij 70 zaakcodes, terwijl er nog 38 zaken in de catalogus
   stonden: achtendertig codes met namen en pincodes van bedrijven die niet meer
   bestonden. Dat is precies wat de identiteitskluis niet hoort te doen.

   WAT DEZE TOETS VASTLEGT

   1. Met RTG_DEMO=1 staan de demozaken er, uit ELK zaai-deel.
   2. Zonder RTG_DEMO zijn ze weg -- ook de late (deel8/9/10) en ook de zaken
      die niet op de oude handlijst stonden.
   3. Ook op een database die ooit ALS DEMO IS BEGONNEN. Dat is het geval dat
      de oude opzet niet kon: de zaken staan er dan al, dus het zaaien slaat ze
      over en er was niets meer aan te zien dat ze uit de seed kwamen.
   4. Het personeel van een opgeruimde zaak staat niet meer actief in de kluis.
   5. Een ECHTE partner blijft staan. Zonder deze toets zou "ruim alles op wat
      niet gemerkt is" ook betalende partners wissen, en dat is de dure kant van
      deze fout.
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { startServer, stop } = require('./helper');

/* SQLITE OPENEN ZOALS DE SERVER DAT DOET, en dat was hier het gat.

   De server zet op elke verbinding `PRAGMA busy_timeout=5000` (zie
   server/db/sqlite.js, met de reden erbij: zonder die wachttijd werd parallelle
   opstart incidenteel rood met "database is locked"). Deze toets opende zijn
   eigen verbinding ZONDER die pragma, en schrijft op een moment dat een zojuist
   gestopte server nog kan wegschrijven -- write-behind is niet klaar op het
   moment dat het proces "gestopt" heet.

   Gevolg: een op de drie volle rondes viel dit bestand om op een lock, en dan
   niet op wat het beweert (overleeft een echte partner de opruiming) maar op
   het moment waarop het toevallig schreef. Een toets die om zoiets rood geeft,
   leert iedereen zijn uitslag wegkijken. */
function opslag(pad, opties) {
  const db = opties ? new DatabaseSync(pad, opties) : new DatabaseSync(pad);
  db.exec('PRAGMA busy_timeout=5000');
  return db;
}

/* Zaken uit verschillende zaai-delen, want juist de spreiding was het probleem.
   HOSHI komt uit de basis-seed, SAKURA uit deel1, CASTELL uit deel8, TALLER uit
   deel9 en SOMBRA uit deel10. De laatste drie overleefden de oude opruiming. */
const UIT_DE_SEED = {
  HOSHI: 'basis-seed (server/seed/leveranciers.js)',
  SAKURA: 'deel1-basis',
  CASTELL: 'deel8-bouw',
  TALLER: 'deel9-vakken',
  SOMBRA: 'deel10-genres'
};
/* Stond niet op de oude handlijst en bleef daardoor hoe dan ook staan. */
const GEMIST_OP_DE_OUDE_LIJST = ['ZENITH', 'BODE'];

async function zaakBekend(base, code) {
  const r = await fetch(base + '/api/supplier/roster', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Forwarded-Proto': 'https' },
    body: JSON.stringify({ code })
  });
  const d = await r.json().catch(() => ({}));
  return !!(d && d.supplier && d.supplier.code === code);
}

/* Buiten de demo is /api/supplier/roster terecht geen anonieme cataloguslezer
   meer: zonder leveranciersidentiteit antwoordt die deur 403. De schoonmaak
   toetsen daarom rechtstreeks op de autoritatieve leverancierscollectie. Een
   403 als `niet gevonden` uitleggen maakte de oude assertions immers groen,
   óók als de demozaak nog gewoon in de database stond. */
function zaakBewaard(dataDir, code) {
  const db = opslag(path.join(dataDir, 'store.db'), { readOnly: true });
  try {
    const rij = db.prepare("SELECT val FROM kv WHERE key = 'suppliers'").get();
    const zaken = rij ? JSON.parse(rij.val) : [];
    return zaken.some(z => z.code === code);
  } finally { db.close(); }
}

function actiefPersoneel(dataDir, code) {
  const db = opslag(path.join(dataDir, 'rtg.db'), { readOnly: true });
  try {
    return db.prepare('SELECT COUNT(*) AS n FROM supplier_staff WHERE supplier_code = ? AND active = 1')
      .get(String(code)).n;
  } finally { db.close(); }
}

test('met RTG_DEMO=1 staan de demozaken uit elk zaai-deel in de catalogus', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-demozaken-aan-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  try {
    for (const [code, herkomst] of Object.entries(UIT_DE_SEED))
      assert.ok(await zaakBekend(srv.base, code), code + ' hoort er in de demo-stand te staan (' + herkomst + ')');
    // en het personeel hoort te bestaan, anders bewijst de opruimtoets hieronder niets
    assert.ok(actiefPersoneel(TMP, 'CASTELL') > 0, 'CASTELL hoort personeel te hebben in de demo-stand');
  } finally {
    await stop(srv);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});

test('zonder RTG_DEMO gaan ALLE geseede zaken eruit, ook de late en ook op een database die als demo begon', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-demozaken-uit-'));
  try {
    /* Eerst een ronde MET de demo-stand: dit maakt precies de database die de
       oude opzet niet kon opruimen -- de zaken staan er al, dus het zaaien
       gaat ze de tweede keer overslaan. */
    const demo = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
    let personeelVoor = 0;
    try {
      assert.ok(await zaakBekend(demo.base, 'CASTELL'), 'de demo-ronde moet CASTELL neerzetten');
      personeelVoor = actiefPersoneel(TMP, 'CASTELL');
      assert.ok(personeelVoor > 0, 'de demo-ronde moet personeel bij CASTELL zetten');
    } finally { await stop(demo); }

    // en nu dezelfde database zonder de demo-stand
    const echt = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '' } });
    try {
      for (const [code, herkomst] of Object.entries(UIT_DE_SEED))
        assert.equal(zaakBewaard(TMP, code), false,
          code + ' hoort zonder RTG_DEMO uit de catalogus te zijn (' + herkomst + ')');
      for (const code of GEMIST_OP_DE_OUDE_LIJST)
        assert.equal(zaakBewaard(TMP, code), false,
          code + ' stond niet op de oude handlijst en hoort er nu wel uit te gaan');
      assert.equal(actiefPersoneel(TMP, 'CASTELL'), 0,
        'het personeel van een opgeruimde zaak hoort niet actief in de kluis te blijven');
    } finally { await stop(echt); }
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});

test('een database van VOOR het merkteken wordt alsnog opgeruimd', async () => {
  /* Het geval waar de terugval in de zaai-delen voor is. In de toets hierboven
     zet de zaaironde het merkteken zelf, dus die raakt die terugval nooit -- en
     code die een toets niet kan laten zakken bewijst niets (LAT-regel 9).

     Hier maken we de echte oude situatie na: een database die met de demo-stand
     is gevuld TOEN het merkteken nog niet bestond. Dat doen we door de tekens
     er weer af te halen. Het zaaien slaat die zaken de volgende ronde over (ze
     bestaan al), dus alleen de terugval kan ze nog herkennen. */
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-demozaken-oud-'));
  try {
    const demo = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
    try { assert.ok(await zaakBekend(demo.base, 'CASTELL'), 'zaaironde moet gelopen hebben'); }
    finally { await stop(demo); }

    // alle merktekens eraf: nu is het een database van voor deze wijziging
    const db = opslag(path.join(TMP, 'store.db'));
    const zaken = JSON.parse(db.prepare("SELECT val FROM kv WHERE key = 'suppliers'").get().val);
    let gestript = 0;
    for (const z of zaken) if (z.geseed) { delete z.geseed; gestript++; }
    db.prepare("UPDATE kv SET val = ? WHERE key = 'suppliers'").run(JSON.stringify(zaken));
    db.close();
    assert.ok(gestript > 0, 'er moesten merktekens te strippen zijn, anders toetst dit niets');

    const echt = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '' } });
    try {
      for (const [code, herkomst] of Object.entries(UIT_DE_SEED))
        assert.equal(zaakBewaard(TMP, code), false,
          code + ' hoort ook op een database van voor het merkteken weg te gaan (' + herkomst + ')');
    } finally { await stop(echt); }
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});

test('een echte partner overleeft de opruiming', async () => {
  /* De opruiming gaat op een merkteken dat alleen het zaaien zet. Een zaak die
     via de aanmelding is ontstaan draagt dat teken niet en moet blijven staan --
     dit is de toets die "ruim alles op wat je niet herkent" onmogelijk maakt. */
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-demozaken-echt-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  let dataBestand = null;
  try {
    assert.ok(await zaakBekend(srv.base, 'CASTELL'), 'zaaironde moet gelopen hebben');
  } finally { await stop(srv); }

  try {
    /* Een echte partner erbij zetten zoals de aanmelding dat doet: zonder
       merkteken. De opslag is sqlite (kv-tabel) zodra er een datamap is. */
    dataBestand = path.join(TMP, 'store.db');
    const db = opslag(dataBestand);
    const rij = db.prepare("SELECT val FROM kv WHERE key = 'suppliers'").get();
    const zaken = JSON.parse(rij.val);
    zaken.push({ code: 'ECHTEPARTNER', name: 'Echte Partner BV', type: 'bouw',
      city: 'Ibiza', loc: null, rate: 0, menu: [], photos: [] });
    db.prepare("UPDATE kv SET val = ? WHERE key = 'suppliers'").run(JSON.stringify(zaken));
    db.close();

    const echt = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '' } });
    try {
      assert.ok(zaakBewaard(TMP, 'ECHTEPARTNER'),
        'een partner zonder merkteken hoort de opruiming te overleven');
      assert.equal(zaakBewaard(TMP, 'CASTELL'), false,
        'en de geseede zaak hoort in diezelfde ronde wel weg te zijn');
    } finally { await stop(echt); }
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
