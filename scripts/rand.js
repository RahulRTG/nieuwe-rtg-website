/* DE RAND -- alles wat BUITEN de code ligt, gemeten aan een draaiende installatie.

   De testsuite draait op een machine zonder TLS, zonder reverse proxy en met
   een verse database. Precies de dingen die daardoor buiten beeld blijven,
   zijn de dingen die op de echte hosting misgaan: een vergeten HSTS, een
   .env die de webserver gewoon uitserveert, een proxy die de client zijn eigen
   IP laat verzinnen. Dit script kijkt daarnaar, van buitenaf, zoals een
   bezoeker dat kan.

   Draai tegen de ECHTE omgeving:
     node scripts/rand.js https://rtg.example.com

   Uitslag: ✗ blokkeert (exitcode 1), ⚠ verdient een blik, ✓ in orde.

   WAT DIT NIET IS: een TLS-audit. Er wordt gekeken naar het protocol en het
   certificaat, niet naar de volledige cipher-configuratie -- daar is
   gespecialiseerd gereedschap voor (testssl.sh, SSL Labs). En het blijft, net
   als de aanvalsronde, geschreven door dezelfde partij die de server schreef. */
'use strict';
const tls = require('tls');

const BASIS = (process.argv[2] || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const url = new URL(BASIS);
const https = url.protocol === 'https:';

const uit = [];
const blokkeer = (t) => uit.push(['✗', t, true]);
const waarschuw = (t) => uit.push(['⚠', t, false]);
const goed = (t) => uit.push(['✓', t, false]);

async function haal(pad, opties) {
  try {
    const r = await fetch(BASIS + pad, { redirect: 'manual', ...(opties || {}) });
    return { status: r.status, kop: r.headers, tekst: (await r.text()).slice(0, 400) };
  } catch (e) { return { status: 0, kop: new Headers(), tekst: String(e.message) }; }
}

/* 1. Het certificaat en het protocol. */
function certificaat() {
  return new Promise((klaar) => {
    const s = tls.connect({ host: url.hostname, port: url.port || 443, servername: url.hostname, timeout: 8000 }, () => {
      const c = s.getPeerCertificate();
      const dagen = c && c.valid_to ? Math.round((Date.parse(c.valid_to) - Date.now()) / 86400000) : null;
      const proto = s.getProtocol();
      if (!s.authorized) blokkeer('Certificaat niet vertrouwd: ' + (s.authorizationError || 'onbekende reden'));
      else goed('Certificaat geldig voor ' + url.hostname + ' (' + proto + ', nog ' + dagen + ' dagen).');
      if (dagen != null && dagen < 21) waarschuw('Het certificaat verloopt over ' + dagen + ' dagen; controleer de automatische vernieuwing.');
      if (proto && /TLSv1(\.[01])?$/.test(proto)) blokkeer('Verouderd TLS in gebruik: ' + proto + '. Alleen TLS 1.2 en 1.3 horen aan te staan.');
      s.end(); klaar();
    });
    s.on('error', (e) => { blokkeer('Geen TLS-verbinding mogelijk: ' + e.message); klaar(); });
    s.on('timeout', () => { blokkeer('TLS-verbinding liep in een timeout.'); s.destroy(); klaar(); });
  });
}

/* 2. De kopregels op een gewone pagina. */
async function koppen() {
  const r = await haal('/');
  if (!r.status) { blokkeer('De site antwoordt niet op ' + BASIS + ': ' + r.tekst); return; }
  const k = (n) => r.kop.get(n) || '';

  const hsts = k('strict-transport-security');
  const maanden = /max-age=(\d+)/.exec(hsts);
  if (!https) waarschuw('Gemeten over http, dus HSTS en certificaat zeggen hier niets. Draai dit tegen het https-adres.');
  else if (!hsts) blokkeer('Geen Strict-Transport-Security: een bezoeker kan de eerste keer nog over http binnenkomen.');
  else if (maanden && Number(maanden[1]) < 15552000) waarschuw('HSTS max-age is kort (' + maanden[1] + 's); een half jaar of meer is gebruikelijk.');
  else goed('HSTS staat aan (' + hsts + ').');

  /* Bij de CSP telt WAAR de versoepeling staat. script-src 'unsafe-inline' is
     het gat waar cross-site scripting doorheen komt; style-src 'unsafe-inline'
     is vervelend maar van een andere orde. Een controle die die twee op één
     hoop gooit, leert je af om naar de uitslag te kijken. */
  const csp = k('content-security-policy');
  /* De richtlijnnaam moet EXACT eindigen waar hij eindigt. Zonder de
     woordgrens vond `style-src` ook `style-src-attr`, en dan las deze controle
     de verkeerde regel voor -- precies het soort meting dat je aanleert weg te
     kijken. */
  const deel = (naam) => (new RegExp('(?:^|;)\\s*' + naam + '(\\s[^;]*)').exec(csp) || [, ''])[1] || '';
  if (!csp) blokkeer('Geen Content-Security-Policy op de hoofdpagina.');
  else {
    const script = deel('script-src');
    if (/unsafe-inline|unsafe-eval/.test(script)) blokkeer("script-src staat 'unsafe-inline' of 'unsafe-eval' toe: dat is het gat waar cross-site scripting doorheen komt.");
    else if (/nonce-/.test(script)) goed('CSP: script-src werkt met een nonce, zonder unsafe-inline.');
    else goed('CSP: script-src zonder unsafe-inline.');
    const stijl = deel('style-src');
    if (/unsafe-inline/.test(stijl)) waarschuw("style-src staat 'unsafe-inline' toe. Lager risico dan bij scripts, maar het kan strakker met een nonce.");
    else if (/nonce-/.test(stijl)) goed('CSP: style-src werkt met een nonce; een ingespoten <style>-blok draait niet.');
    /* En dan het eerlijke deel: de attributen. style-src-attr valt terug op
       style-src, dus als hij er NIET staat is dat geen versoepeling. Staat hij
       er wel met 'unsafe-inline', dan is dat een bewuste openstaande post en
       hoort hij als zodanig in de uitslag -- niet verzwegen omdat de regel
       ernaast er goed uitziet. */
    if (/unsafe-inline/.test(deel('style-src-attr')))
      waarschuw("style-src-attr staat 'unsafe-inline' toe: style=\"...\"-attributen mogen nog. Openstaande post, geen vergissing.");
    if (!/frame-ancestors/.test(csp)) waarschuw('De CSP noemt geen frame-ancestors: clickjacking is dan niet afgedekt.');
  }

  if (k('x-content-type-options').toLowerCase() !== 'nosniff') blokkeer('X-Content-Type-Options: nosniff ontbreekt.');
  else goed('X-Content-Type-Options: nosniff.');
  if (!k('referrer-policy')) waarschuw('Geen Referrer-Policy: paden met codenamen kunnen naar externe sites lekken.');
  else goed('Referrer-Policy: ' + k('referrer-policy'));
  if (!k('permissions-policy')) waarschuw('Geen Permissions-Policy (camera, microfoon, locatie).');
  else goed('Permissions-Policy aanwezig.');

  for (const banner of ['server', 'x-powered-by']) {
    const v = k(banner);
    if (v && /\d/.test(v)) waarschuw('De kop "' + banner + ': ' + v + '" verklapt welke software en versie er draait.');
  }
}

/* 3. Wordt kaal http doorgestuurd naar https? */
async function httpNaarHttps() {
  if (!https) return;
  try {
    const r = await fetch('http://' + url.hostname + '/', { redirect: 'manual' });
    const naar = r.headers.get('location') || '';
    if (r.status >= 300 && r.status < 400 && /^https:/i.test(naar)) goed('Kaal http wordt doorgestuurd naar https (' + r.status + ').');
    else blokkeer('http://' + url.hostname + ' stuurt NIET door naar https (status ' + r.status + ').');
  } catch (e) { goed('Poort 80 is dicht; er valt niets onversleuteld te bereiken.'); }
}

/* 4. Staat er iets op straat wat er niet hoort? */
async function geheimenOpStraat() {
  const paden = [
    ['/.env', 'het geheimenbestand'], ['/.env.productie', 'het productie-geheimenbestand'],
    ['/.git/config', 'de git-configuratie'], ['/package.json', 'de pakketlijst'],
    ['/server/data/db.json', 'de database'], ['/server/data/vault.key', 'de kluissleutel'],
    ['/server/server.js', 'de serverbron'], ['/node_modules/', 'de modulemap'], ['/server/', 'de servermap']
  ];
  let raak = 0;
  for (const [pad, wat] of paden) {
    const r = await haal(pad);
    if (r.status >= 200 && r.status < 300) { blokkeer('OP STRAAT: ' + pad + ' (' + wat + ') is gewoon op te halen.'); raak++; }
  }
  if (!raak) goed('Geen van de gevoelige paden (.env, .git, server/data, bronbestanden) is bereikbaar.');
}

/* 5. Laat de proxy de bezoeker zijn eigen IP verzinnen?

   Dit is de externe controle op de bevinding uit test/proxykop.test.js: als een
   verzonnen X-Forwarded-For telt, dan is elke snelheidslimiet met een kop te
   omzeilen. We vuren dus bewust over de grens van de vertaalrem heen, elke keer
   met een ander verzonnen adres, en verwachten alsnog een 429. */
async function remOmzeilen() {
  let ge429 = false;
  for (let i = 0; i < 45 && !ge429; i++) {
    const r = await haal('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '9.9.' + i + '.' + i },
      body: JSON.stringify({ text: 'rand-controle', to: 'en' })
    });
    if (r.status === 429) ge429 = true;
  }
  if (ge429) goed('De rem houdt stand ondanks een verzonnen X-Forwarded-For per verzoek.');
  else blokkeer('SNELHEIDSLIMIET TE OMZEILEN: met een eigen X-Forwarded-For per verzoek loopt de rem niet vol. Controleer de proxy-instelling (trust proxy) en of er echt een proxy vóór de app staat.');
}

(async () => {
  if (https) await certificaat();
  await koppen();
  await httpNaarHttps();
  await geheimenOpStraat();
  await remOmzeilen();

  uit.sort((a, b) => (b[2] ? 1 : 0) - (a[2] ? 1 : 0));
  console.log('\n=== RTG randcontrole tegen ' + BASIS + ' ===\n');
  for (const [teken, tekst] of uit) console.log(' ' + teken + ' ' + tekst);
  const blokkers = uit.filter(x => x[2]).length;
  console.log('\nWat hier NIET in staat (en wel moet gebeuren):');
  console.log(' - een volledige TLS-/cipher-audit (testssl.sh of SSL Labs);');
  console.log(' - een onafhankelijke pentest: dit script is van dezelfde hand als de server.');
  console.log(blokkers ? '\nNIET in orde: ' + blokkers + ' blokkerend punt(en).\n' : '\nDe rand is in orde.\n');
  process.exit(blokkers ? 1 : 0);
})();
