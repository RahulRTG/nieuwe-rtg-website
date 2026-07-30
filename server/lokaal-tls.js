/* Lokale https voor het eigen netwerk.

   Op http://localhost werkt alles, maar zodra u de site op een telefoon opent
   via het netwerkadres van de computer (http://192.168.x.x:3000) zet iOS en
   Android een aantal dingen uit: de camera, Face ID en passkeys, meldingen, en
   het toevoegen aan het beginscherm als echte app. Niet omdat er iets stuk is,
   maar omdat een browser die alleen op een beveiligde verbinding toestaat.

   Deze laag maakt daarom een eigen certificaat voor déze computer. Hij gebruikt
   de interne CA die er al is (server/lib/ca.js); die CA vertrouwt u eenmalig op
   uw telefoon, en daarna is elk certificaat dat hier wordt uitgegeven meteen
   goed -- ook als uw netwerkadres morgen verandert.

   Het certificaat wordt bij elke start opnieuw uitgegeven voor de adressen die
   deze computer op dít moment heeft. Zo hoeft u nooit iets bij te werken als u
   van wifi wisselt.

   Alleen voor uw eigen netwerk. Voor een echte site op internet staat de
   ACME/Let's Encrypt-weg in server.js (RTG_ACME=1). */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { maakCA } = require('./lib/ca');

/* Alle IPv4-adressen waarop deze computer in het netwerk te bereiken is.
   Loopback hoort er altijd bij; virtuele adressen van Docker en dergelijke
   laten we staan -- ze doen geen kwaad in het certificaat. */
function adressenVanDezeMachine() {
  const uit = ['localhost', '127.0.0.1'];
  const netten = os.networkInterfaces();
  for (const naam of Object.keys(netten)) {
    for (const net of netten[naam] || []) {
      if (net.family !== 'IPv4' && net.family !== 4) continue;
      if (net.internal) continue;
      if (!uit.includes(net.address)) uit.push(net.address);
    }
  }
  return uit;
}

/* De adressen waarop een telefoon de site kan openen: de loopback laten we
   weg, want daar heeft een ander apparaat niets aan. */
function netwerkAdressen() {
  return adressenVanDezeMachine().filter(a => a !== 'localhost' && a !== '127.0.0.1');
}

/* Het certificaat voor deze computer, ondertekend door de eigen CA. Geeft de
   sleutel en het certificaat terug zoals https.createServer ze wil, plus waar
   het CA-bestand staat dat op de telefoon vertrouwd moet worden. */
function certVoorDezeMachine(opties) {
  opties = opties || {};
  const basis = opties.dataDir || process.env.RTG_DATA_DIR || path.join(__dirname, 'data');
  const dir = path.join(basis, 'tls', 'lokaal');
  try { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); } catch (e) {}

  const ca = maakCA({ dataDir: basis, naam: 'RTG lokaal (' + os.hostname() + ')' });
  const namen = adressenVanDezeMachine();
  const uitgifte = ca.geefUitServer({ cn: 'localhost', names: namen, org: 'RTG lokaal', days: 397 });

  const keyPad = path.join(dir, 'server.key');
  const certPad = path.join(dir, 'server.crt');
  const caPad = path.join(dir, 'RTG-CA.crt');
  try {
    fs.writeFileSync(keyPad, uitgifte.keyPem, { mode: 0o600 });
    fs.writeFileSync(certPad, uitgifte.chainPem, { mode: 0o600 });
    // het CA-bestand mag gewoon leesbaar zijn: het bevat geen geheim, alleen
    // de publieke sleutel waarmee de telefoon onze certificaten herkent
    fs.writeFileSync(caPad, ca.caCertPem, { mode: 0o644 });
  } catch (e) {}

  return {
    key: uitgifte.keyPem,
    cert: uitgifte.chainPem,
    caPem: ca.caCertPem,
    caPad,
    namen,
    netwerk: netwerkAdressen(),
    caVers: ca.vers
  };
}

/* De pagina van het http-loketje. Dit is het eerste wat een telefoon van deze
   computer te zien krijgt, en het moet twee vragen beantwoorden: kom ik hier
   binnen, en wat moet ik nu doen. Vandaar een echte pagina in plaats van een
   kaal bestand -- een leeg scherm of een foutmelding van de browser vertelt een
   mens niet of het aan het netwerk lag of aan het adres.

   Bewust zonder opsmuk: dit draait op een onbeveiligde verbinding en hoort
   niets anders te doen dan het certificaat aanreiken. */
function loketPagina(poort, naamVanDeMachine) {
  return '<!doctype html><html lang="nl"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>RTG: deze computer is bereikbaar</title><style>' +
    ':root{color-scheme:dark}' +
    'body{margin:0;background:#0E0E0D;color:#F2EFEA;font:16px/1.6 -apple-system,system-ui,sans-serif;' +
    'padding:2.2rem 1.3rem;max-width:34rem;margin:0 auto;}' +
    'h1{font-size:1.35rem;font-weight:600;margin:0 0 .3rem;}' +
    'p{color:rgba(242,239,234,.66);margin:0 0 1rem;}' +
    '.goed{color:#69B891;font-weight:600;}' +
    'a.knop{display:block;text-align:center;background:#C9A24B;color:#0C0C0B;font-weight:600;' +
    'text-decoration:none;border-radius:12px;padding:.9rem 1rem;margin:1.4rem 0;}' +
    'ol{padding-left:1.2rem;margin:0 0 1.4rem;} li{margin-bottom:.5rem;}' +
    'code{background:#1C1A19;border-radius:6px;padding:.1rem .35rem;font-size:.9em;}' +
    '.stil{font-size:.85rem;color:rgba(242,239,234,.42);border-top:1px solid rgba(255,255,255,.09);padding-top:1rem;}' +
    '</style></head><body>' +
    '<h1><span class="goed">Gelukt.</span> Deze computer is bereikbaar.</h1>' +
    '<p>U kijkt naar ' + naamVanDeMachine + '. Uw telefoon zit op hetzelfde netwerk; ' +
    'dat deel werkt dus. Nog twee dingen en de site kan alles.</p>' +
    '<a class="knop" href="/rtg-ca.crt">1 · Haal het certificaat op</a>' +
    '<p>Tik hierboven, en daarna op <b>Sta toe</b>. Ga dan naar ' +
    '<b>Instellingen</b>: bovenin staat nu <b>Profiel gedownload</b>: en tik op ' +
    '<b>Installeer</b>.</p>' +
    '<h1 style="margin-top:1.8rem;">2 · Zet het vertrouwen aan</h1>' +
    '<p>Deze stap wordt het vaakst vergeten, en zonder deze stap werkt het niet:</p>' +
    '<ol><li><b>Instellingen</b> → <b>Algemeen</b> → <b>Info</b></li>' +
    '<li>Helemaal naar beneden: <b>Certificaatvertrouwensinstellingen</b></li>' +
    '<li>Zet de schakelaar bij <b>RTG lokaal</b> aan</li></ol>' +
    '<a class="knop" href="https://' + naamVanDeMachine + ':' + poort + '/">3 · Open de site</a>' +
    '<p class="stil">Dit loketje draait op een onbeveiligde verbinding en doet niets anders dan ' +
    'het certificaat aanreiken. De site zelf staat op <code>https://' + naamVanDeMachine + ':' + poort + '</code>.</p>' +
    '</body></html>';
}

/* Het loket beantwoordt twee adressen: het CA-bestand zelf en de uitlegpagina.
   Ze hangen bewust aan twee kanten: aan het kale http-loketje, en aan de
   beveiligde site zelf.

   Dat tweede is nodig omdat Safari en Chrome een stand kennen waarin ze elk
   http-adres botweg weigeren ("Alleen HTTPS" / "Altijd beveiligde
   verbindingen"). Staat die aan, dan komt het http-loket niet eens van de
   grond, en zou de gebruiker eerst een beveiliging op zijn telefoon moeten
   uitzetten om er een bij te kunnen zetten. Via https werkt het met die stand
   gewoon aan; de browser waarschuwt dan eenmalig over het certificaat, en dat
   is precies het certificaat dat hier wordt opgehaald.

   Geeft true terug als het verzoek hier is afgehandeld. */
function loketAntwoord(req, res, cert, poort) {
  const pad = String(req.url || '/').split('?')[0];
  if (pad === '/rtg-ca.crt') {
    res.writeHead(200, { 'Content-Type': 'application/x-x509-ca-cert',
      'Content-Disposition': 'attachment; filename="RTG-CA.crt"' });
    res.end(cert.caPem);
    return true;
  }
  if (pad === '/lokaal') {
    const gastheer = String(req.headers.host || '').split(':')[0] || 'localhost';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(loketPagina(poort, gastheer));
    return true;
  }
  return false;
}

/* De QR-code in het Terminal-venster en het opstart-lijstje staan in
   ./lokaal-tls-uitleg.js; ze horen bij dezelfde voordeur en verhuizen mee
   in de export, zodat aanroepers niets merken. */
const { qrInTerminal, startUitleg } = require('./lokaal-tls-uitleg');

module.exports = { certVoorDezeMachine, adressenVanDezeMachine, netwerkAdressen, startUitleg, loketPagina, loketAntwoord, qrInTerminal };
