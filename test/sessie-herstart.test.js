/* Sessie-duurzaamheid: een ingelogd lid blijft na een serverherstart ingelogd,
   omdat de sessie (alleen de token-hash) in db.data.sessions staat en bij het
   opstarten terug in de Map wordt geladen. Dit dekt het herstelpad rond de
   maakSessies-fabriek (server/kern/sessies.js). Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, stopNet } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* ELKE FETCH MET EEN DEADLINE -- EEN TWEEDE SLOT, EN NIET DE OORZAAK.

   Eerlijk over de volgorde: ik heb dit als eerste gedaan met de gedachte dat het
   DE reparatie was voor de vastloper waar dit bestand voor in MUTATIES.json
   stond. Dat was fout -- na deze wijziging liep hij nog steeds vast. De echte
   oorzaak stond in het opruimen (zie de finally verderop) en kwam pas boven door
   de proef met de hand te draaien en naar de UITVOER te kijken.

   Dit blok blijft staan omdat het op zichzelf een echt gat dicht: een fetch zonder
   time-out in een toets kan blijven staan, en dan telt een begrensde wachtlus niet
   verder -- begrensde lus, onbegrensde stap. Het is een tweede slot op een deur
   die nu ook echt op slot zit, geen reparatie die ik als de oorzaak mag opvoeren.

   Wat er misging: onder de liegpoort (de motor laat de server op elk /api-pad
   liegen) kwam een van deze verzoeken nooit terug. De wachtlussen hieronder zijn
   WEL begrensd -- honderd of honderdvijftig pogingen van 200 ms -- maar een lus
   telt niet verder zolang een stap niet klaar is. Begrensde lus, onbegrensde stap.
   Gevolg: het proces sluit niet af, de motor noteert `vastgelopen`, en dat telt
   niet als gezakt: het gedrag was echt veranderd en geen assertie heeft het
   gemeld. Een toets die hangt is erger dan een toets die zakt.

   fetch wordt hier op MODULENIVEAU geschaduwd. Dat dekt alle aanroepen in dit
   bestand -- ook de geneste `await (await fetch(...)).json()` -- zonder ze een
   voor een aan te raken, en het verandert niets buiten dit bestand. Een
   meegegeven signal wint, dus wie zelf een AbortController gebruikt houdt zijn
   eigen gedrag. */
const _fetch = globalThis.fetch;
const fetch = (u, o) => _fetch(u, Object.assign({ signal: AbortSignal.timeout(10000) }, o));


async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return (await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })).json();
}

test('een ingelogd lid blijft na een serverherstart ingelogd (zelfde data-dir)', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-herstart-'));
  /* `s` staat BUITEN de try, want de finally moet hem kunnen stoppen. Hij stond
     eerst met `let` binnen de try, en toen ik het opruimen naar de finally
     verplaatste kon die `s` niet meer zien -- een ReferenceError die de catch
     eromheen netjes opslikte, waarna de server alsnog bleef staan en de toets ook
     ZONDER liegpoort hing. Een opruimer die de naam niet kan zien, ruimt niets op. */
  let s = null;
  try {
    // 1) starten, registreren en het token onthouden
    s = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
    const reg = await api(s.base, '/api/auth/register', { name: 'Herstart Lid', email: 'herstart@x.nl',
      phone: '0612349777', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
    assert.ok(reg.token, 'registratie geeft een token');
    const voor = await api(s.base, '/api/state', {}, reg.token);
    assert.ok(voor.state && voor.state.user, 'voor de herstart is het lid ingelogd');
    const codenaam = voor.state.user.codename;
    /* stopNet en niet stop() met 700 ms ernaast. Deze toets gaat over een NETTE
       herstart ("hetzelfde token moet het na een deploy nog doen"), dus SIGTERM
       hoort erbij -- en dan spoelt de server zijn sessies nog weg. `exit` is het
       teken dat hij van de datamap af is; 700 ms was een gok daarover. */
    await stopNet(s.child);

    // 2) herstarten met dezelfde data-dir; hetzelfde token moet nog werken
    s = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
    const na = await api(s.base, '/api/state', {}, reg.token);
    assert.ok(na.state && na.state.user, 'na de herstart is het lid nog ingelogd');
    assert.equal(na.state.user.codename, codenaam, 'het is dezelfde sessie/gebruiker');
  } finally {
    /* DE SERVER HOORT IN DE FINALLY, en dat was het lek waarvoor deze toets als
       `vastgelopen` in MUTATIES.json stond.

       Hier stond `stop(s.child)` als LAATSTE REGEL VAN DE TRY. Zakt een assertie
       ervoor -- en onder de liegpoort zakken ze, gemeten: `not ok 1` na 8,7 s --
       dan wordt die regel overgeslagen, blijft het opgestarte serverproces staan
       en kan node niet afsluiten. Het proces liep tot de time-out (exit 124), en
       dan telt de motor het niet als gezakt: het gedrag was echt veranderd en
       geen assertie heeft het gemeld, terwijl er wel een assertie zakte. Dat is
       de stilste vorm van stuk.

       De finally ruimde wel de tijdelijke map op. Dat is precies de val: het ZAG
       eruit als een toets die opruimt. `s` wordt onderweg opnieuw gezet; de eerste
       server is dan al gestopt en stop() op een dood kind doet niets, dus deze ene
       regel dekt beide. */
    try { stop(s && s.child); } catch (e) { /* al weg: prima */ }
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
