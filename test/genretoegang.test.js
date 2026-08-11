/* ============================================================================
   DE TOEGANGSSTAND VAN EEN GENRE: EEN WAARHEID, EN GEEN STILLE OMZETTING.

   WAAROM DIT BESTAAT

   Het register kende 73 genres. kern/aanmeldingen/bedrijf.js kende er 31, met
   de hand overgetypt, en deed voor al het andere:

       type: GENRES.includes(data.type) ? data.type : 'zzp'

   Twee lijsten over dezelfde vraag (LAT-regel 4) plus een stille omzetting.
   Wie een juwelier, een wellness-zaak of een kinderopvang aanvroeg, kreeg
   zonder enige melding een zzp-zaak: de zzp-caps, het vangnet-dorp en de
   verkeerde tools. Er kwam geen fout, er bleef geen spoor achter, en de
   ondernemer merkte het pas als zijn scherm niet klopte.

   WAT ER WORDT VASTGELEGD

   1. Elk genre heeft een geldige toegangsstand.
   2. De aanvraaglijst wordt GELEZEN uit het register, niet overgetypt.
   3. Een gesloten genre wordt geweigerd -- en wordt nooit een ander genre.
   4. Een uitnodiging tilt precies een stand op, en niet meer dan die ene.
   5. De stand overleeft de reis naar de database, ook bij een bestaande
      database die hem nog niet had.

   DE MUTATIE DIE DEZE TOETS MOET VANGEN
   Zet in kern/aanmeldingen/bedrijf.js de oude regel terug (`: 'zzp'`) en toets
   3 zakt. Dat is gedaan en gecontroleerd; zie het slot van dit bestand.
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { startServer, stop } = require('./helper');

const register = require('../server/seed/genres');
const bedrijfMod = require('../server/kern/aanmeldingen/bedrijf');

/* De module is een fabriek; voor zetBedrijf() is alleen `kap` nodig. */
const maakBedrijf = () => bedrijfMod({
  db: { data: {} }, save: () => {}, nu: () => '2026-08-11T00:00:00.000Z',
  kap: (v, n) => String(v == null ? '' : v).trim().slice(0, n),
  accounts: { createStaffSync: () => ({ id: 1 }) }
});

test('elk genre heeft een toegangsstand die het register kent', () => {
  const standen = Object.keys(register.TOEGANG);
  assert.ok(standen.length >= 5, 'de standen horen in het register te staan');
  for (const [id, def] of Object.entries(register.GENRES)) {
    assert.ok(def.status, id + ' heeft geen toegangsstand');
    assert.ok(standen.includes(def.status),
      id + ' draagt een stand die het register niet kent: ' + def.status);
    assert.equal(register.toegangVan(id), def.status, 'toegangVan wijkt af voor ' + id);
  }
  /* De som moet kloppen: elk genre zit in precies een stand. */
  const totaal = standen.reduce((n, s) => n + register.genresMetStand(s).length, 0);
  assert.equal(totaal, Object.keys(register.GENRES).length,
    'een genre zit in twee standen of in geen enkele');
});

test('de aanvraaglijst wordt gelezen uit het register, niet overgetypt', () => {
  const uitRegister = register.aanvraagbareGenres().slice().sort();
  const uitModule = bedrijfMod.GENRES.slice().sort();
  assert.deepEqual(uitModule, uitRegister,
    'kern/aanmeldingen/bedrijf.js hoort zijn lijst uit het register te lezen');

  /* En de lijst moet meebewegen: dat is het hele punt van een gelezen lijst.
     Zou hij overgetypt zijn, dan verandert er hier niets. */
  const bron = fs.readFileSync(
    path.join(__dirname, '..', 'server', 'kern', 'aanmeldingen', 'bedrijf.js'), 'utf8');
  assert.ok(/require\(['"]\.\.\/\.\.\/seed\/genres['"]\)/.test(bron),
    'de module hoort het register te requiren');
  assert.equal(/const GENRES = \[/.test(bron), false,
    'er staat weer een met de hand ingetikte genrelijst in bedrijf.js');
});

test('een gesloten genre wordt geweigerd en wordt nooit een ander genre', () => {
  const { zetBedrijf } = maakBedrijf();

  /* De drie gesloten standen, elk met een genre dat hem draagt.

     `bewijs` STOND HIER EN STAAT ER NIET MEER, en dat is geen versoepeling. Die
     stand was dicht met een reden die erbij stond: een `bewijsNodig`-vlag die
     niemand handhaaft is een open deur met een bordje ernaast. Die handhaving
     bestaat nu (kern/aanmeldingen/bewijs.js houdt de provisioning tegen tot een
     mens het stuk aftekent), dus de deur mag open. De toets daarop staat in
     test/concern-voorstel.test.js -- en zonder die toets hoort deze regel
     terug. */
  /* AFGELEID UIT HET REGISTER EN NIET OVERGETYPT. Hier stonden drie standen met
     de hand, en toen `binnenkort` leegliep (alle 24 bleken bediend; zie
     test/genredekking.test.js) viel deze toets om op een undefined -- terwijl er
     inhoudelijk niets mis was. Nu loopt hij over de standen die WERKELIJK
     gesloten genres hebben, dus hij beweegt mee als er een stand leegloopt of
     bijkomt. */
  const gesloten = Object.keys(register.TOEGANG)
    .filter(stand => !register.TOEGANG[stand].mag)
    .map(stand => [stand, register.genresMetStand(stand)[0]])
    .filter(([, genre]) => genre);
  assert.ok(gesloten.length >= 2,
    'er horen minstens twee gesloten standen met genres te zijn, anders toetst dit niets');
  for (const [stand, genre] of gesloten) {
    const a = {};
    const r = zetBedrijf(a, { naam: 'Proefzaak', type: genre, plaats: 'Ibiza' });
    assert.equal(r.ok, undefined, stand + ': ' + genre + ' hoort geweigerd te worden');
    assert.equal(r.stand, stand, 'de stand hoort in de weigering te staan (' + genre + ')');
    assert.ok(r.error && r.uitleg, 'een weigering hoort te zeggen wat er aan de hand is');
    /* DE KERN VAN DEZE TOETS: er is niets geschreven, en zeker geen zzp. */
    assert.equal(a.bedrijf, undefined,
      genre + ' is stilletjes toch een zaak geworden -- de fallback is terug');
  }

  // een onbekend genre wordt ook geen zzp
  const a2 = {};
  const r2 = zetBedrijf(a2, { naam: 'Proefzaak', type: 'ditbestaatniet' });
  assert.equal(r2.stand, 'onbekend');
  assert.equal(a2.bedrijf, undefined, 'een onbekend genre werd een zaak');

  // en zonder branche wordt er niets ingevuld
  const a3 = {};
  const r3 = zetBedrijf(a3, { naam: 'Proefzaak' });
  assert.equal(r3.status, 400);
  assert.equal(a3.bedrijf, undefined, 'zonder branche werd er toch een zaak gezet');

  // een open genre gaat gewoon door, ongewijzigd
  const a4 = {};
  const r4 = zetBedrijf(a4, { naam: 'Cafe Vidal', type: 'restaurant', plaats: 'Ibiza' });
  assert.equal(r4.ok, true);
  assert.equal(a4.bedrijf.type, 'restaurant', 'een open genre hoort ongewijzigd door te gaan');
  assert.equal(a4.bedrijf.bewijsNodig, undefined, 'en geen bewijsvraag te krijgen die er niet is');

  /* Een `bewijs`-genre komt er ook door -- maar draagt de eis MEE. Zonder die
     vlag zou de poort in de provisioning niets te controleren hebben, en dan
     staat de deur alsnog open met een bordje ernaast. */
  const a6 = {};
  const bewijsGenre = register.genresMetStand('bewijs')[0];
  const r6 = zetBedrijf(a6, { naam: 'Apotheek Noord', type: bewijsGenre });
  assert.equal(r6.ok, true, bewijsGenre + ' hoort aangevraagd te kunnen worden');
  assert.equal(a6.bedrijf.bewijsNodig, true,
    'de bewijseis hoort op de aanmelding te belanden; anders handhaaft de poort niets');

  // geen bedrijf meegestuurd is geen fout: niet elke aanmelding gaat over een zaak
  const a5 = {};
  assert.equal(zetBedrijf(a5, undefined).ok, true);
  assert.equal(zetBedrijf(a5, { plaats: 'Ibiza' }).ok, true, 'een bedrijf zonder naam is geen aanvraag');
  assert.equal(a5.bedrijf, undefined);
});

test('een uitnodiging tilt precies een stand op, en niet meer dan die ene', () => {
  const { zetBedrijf } = maakBedrijf();
  const opUitnodiging = register.genresMetStand('uitnodiging')[0];
  const intern = register.genresMetStand('intern')[0];

  const a = {};
  assert.equal(zetBedrijf(a, { naam: 'Eenheid', type: opUitnodiging }, { viaUitnodiging: true }).ok, true,
    opUitnodiging + ' hoort met een uitnodiging open te gaan');
  assert.equal(a.bedrijf.type, opUitnodiging);

  const b = {};
  const r = zetBedrijf(b, { naam: 'Ministerie', type: intern }, { viaUitnodiging: true });
  assert.equal(r.stand, 'intern', 'een uitnodiging hoort een intern genre NIET te openen');
  assert.equal(b.bedrijf, undefined);

  /* En zonder uitnodiging blijft de deur dicht. */
  const c = {};
  assert.equal(zetBedrijf(c, { naam: 'Eenheid', type: opUitnodiging }).stand, 'uitnodiging');
  assert.equal(c.bedrijf, undefined);
});

test('de toegangsstand haalt de database, ook een database die hem nog niet had', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-genretoegang-'));
  try {
    const eerste = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
    await stop(eerste);

    /* Een bestaande database nabootsen: standen eruit, en op twee genres de
       oude `besloten`-vlag terugzetten die door de status is vervangen. */
    const db = new DatabaseSync(path.join(TMP, 'store.db'));
    const types = JSON.parse(db.prepare("SELECT val FROM kv WHERE key = 'supplierTypes'").get().val);
    let gestript = 0;
    for (const t of Object.values(types)) if (t.status) { delete t.status; gestript++; }
    types.defensie.besloten = true;
    db.prepare("UPDATE kv SET val = ? WHERE key = 'supplierTypes'").run(JSON.stringify(types));
    db.close();
    assert.ok(gestript > 0, 'er moesten standen te strippen zijn, anders toetst dit niets');

    const tweede = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
    try {
      const db2 = new DatabaseSync(path.join(TMP, 'store.db'), { readOnly: true });
      const na = JSON.parse(db2.prepare("SELECT val FROM kv WHERE key = 'supplierTypes'").get().val);
      db2.close();
      for (const [id, def] of Object.entries(register.GENRES)) {
        assert.equal(na[id] && na[id].status, def.status, 'stand niet aangevuld voor ' + id);
      }
      assert.equal(na.defensie.besloten, undefined,
        'de oude besloten-vlag hoort te verdwijnen; twee velden over dezelfde vraag lopen uiteen');
    } finally { await stop(tweede); }
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});

/* ----------------------------------------------------------------------------
   DE MUTATIES DIE ZIJN GEDAAN (LAT-regel 2: een toets die je niet hebt zien
   zakken is geen toets)

   1. `: 'zzp'` terug in zetBedrijf()            -> toets 3 zakt (4 standen)
   2. de 31 namen terug als const GENRES = [...] -> toets 2 zakt
   3. status van een genre weggehaald            -> toets 1 zakt
   4. `if (!t[id].status)`-regel uit zetRegister -> toets 5 zakt
   5. `viaUitnodiging` ook 'intern' laten openen -> toets 4 zakt
   -------------------------------------------------------------------------- */
