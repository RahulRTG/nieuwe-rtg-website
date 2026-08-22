/* DE INLOGREM MOET OOK EEN VERSPREIDE AANVAL ZIEN, EN DE EIGENAAR NOOIT BUITEN
   ZETTEN.

   WAT ER MIS WAS. /api/auth/login telde mislukkingen op een emmer per
   IP+account. Dat remt tien gokken van EEN adres op EEN account en verder
   niets: veertig adressen op hetzelfde account zijn veertig verse emmers.
   Gemeten op de stand van daarvoor: veertig gokken op een account vanaf veertig
   adressen leverden nul remmen op, en het echte wachtwoord werkte daarna nog
   gewoon. De passkey-kant (routes/auth/webauthn.js) deed het al goed met een
   bron- en een doelemmer; de wachtwoordkant liep achter.

   WAT DEZE TOETS BEWAAKT, en de tweede helft is even belangrijk als de eerste:

     1. een verspreide aanval op EEN account wordt geremd, ook als elke gok van
        een ander adres komt;
     2. die rem is een VERTRAGING en geen slot, want een slot zou een vreemde de
        macht geven om een lid uit zijn eigen account te houden -- vijfentwintig
        gokken verbranden en de eigenaar staat buiten. Wie het wachtwoord weet
        komt hier dus zonder vertraging binnen, tijdens de aanval;
     3. de bestaande rem per adres blijft staan (tien gokken, dan 429).

   Waarom de tijd wordt gemeten en niet een statuscode: het gedrag IS de
   vertraging. Een trage machine maakt de gemeten duur alleen langer, nooit
   korter, dus de ondergrens hieronder kan niet omslaan in een valse groene.

   Draai los: node --test test/inlogrem.test.js */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

/* Ruim boven het echte antwoord (tientallen ms) en ruim onder de vertraging van
   twee seconden, zodat de grens ook op een tobbende machine niet gaat wiebelen. */
const VERTRAAGD_MS = 1500;

async function metAccount(werk) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-inlogrem-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 900 + 100);
    const mail = 'remproef' + u + '@x.nl';
    const wachtwoord = 'hetechtewachtwoord1';
    const uit = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Remproef', email: mail, phone: '06' + u.slice(0, 8),
        password: wachtwoord, geboortedatum: '1990-03-03', tier: 'rtg', pasApp: 'rtg' })
    }).then(r => r.json());
    assert.ok(uit.token, 'het proefaccount bestaat');

    /* Elke poging krijgt zijn eigen adres mee. De voordeurketen vertrouwt een
       hop (RTG_PROXY_HOPS, standaard 1), dus dit is precies wat een aanvaller
       met een botnet doet: hetzelfde doel, elke keer een andere bron. */
    const poging = async (ip, ww) => {
      const t = Date.now();
      const r = await fetch(base + '/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
        body: JSON.stringify({ login: mail, password: ww })
      });
      return { status: r.status, ms: Date.now() - t };
    };
    await werk({ poging, wachtwoord });
  } finally {
    await stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* weg is weg */ }
  }
}

test('een verspreide aanval op een account wordt vertraagd, en nooit met een slot', async () => {
  await metAccount(async ({ poging, wachtwoord }) => {
    const duren = [];
    let sloten = 0;
    for (let i = 0; i < 30; i++) {
      const r = await poging('198.51.100.' + i, 'fout' + i);
      duren.push(r.ms);
      if (r.status === 429) sloten += 1;
      else assert.equal(r.status, 401, 'een foute gok hoort 401 te zijn');
    }

    const vertraagde = duren.filter(ms => ms >= VERTRAAGD_MS).length;
    assert.ok(vertraagde > 0,
      'een verspreide aanval hoort geremd te worden; geen enkele van de 30 gokken werd vertraagd (duren: ' + duren.join(',') + ')');
    assert.equal(sloten, 0,
      'de rem op het doel hoort een vertraging te zijn en geen slot, anders sluit een vreemde de eigenaar buiten');

    /* De kern van de keuze: tijdens de aanval komt de eigenaar gewoon binnen. */
    const eigenaar = await poging('198.51.100.200', wachtwoord);
    assert.equal(eigenaar.status, 200, 'met het juiste wachtwoord komt de eigenaar binnen, ook tijdens een aanval');
    assert.ok(eigenaar.ms < VERTRAAGD_MS,
      'en hij wacht daar niet op: de vertraging hangt aan een MISLUKTE poging, niet aan het account (' + eigenaar.ms + 'ms)');
  });
});

/* WAT ER NA TIEN GOKKEN GEBEURT, en waarom hier twee codes mogen staan.

   Deze toets eiste een 429 van de snelheidsrem. Sinds de noodrem-ladder en de
   bron-maatstaf in dezelfde stand samenkomen, komt er eerst iets ANDERS: trede 1
   van de ladder zet de bron zelf in de zelf-dovende quarantaine van De Wacht, en
   die antwoordt met 403. Dat is geen regressie maar precies wat beide kanten
   apart bedoelden en geen van beide alleen kon: de ladder wilde "een adres
   isoleren, geen etiket", en pas sinds de melding het aanvallende ADRES draagt
   (in plaats van de emmer, waar de inlognaam in zit) is er een adres om te
   isoleren.

   De bewering blijft dus wat hij was -- wie blijft gokken wordt gestopt -- maar
   hij noemt beide manieren waarop dat mag gebeuren. Haalt iemand allebei de
   remmen weg, dan blijven de statussen 401 en zakt hij alsnog. */
test('de rem per adres blijft staan: tien gokken van een bron, daarna dicht', async () => {
  await metAccount(async ({ poging }) => {
    const statussen = [];
    for (let i = 0; i < 12; i++) statussen.push((await poging('203.0.113.9', 'fout' + i)).status);
    assert.ok(statussen.some(s => s === 429 || s === 403),
      'een bron die op een account blijft gokken hoort na tien pogingen te worden gestopt -- '
      + '429 van de snelheidsrem of 403 van de quarantaine (' + statussen.join(',') + ')');
    assert.equal(statussen.slice(0, 10).every(s => s === 401), true,
      'en de eerste tien pogingen komen gewoon met 401 terug, zodat een typefout geen slot oplevert');
  });
});
