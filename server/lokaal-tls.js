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

/* Het lijstje dat we bij het opstarten tonen: waar u de site vandaan haalt en,
   als de CA net gemaakt is, hoe u hem op uw telefoon vertrouwt. */
function startUitleg(cert, poort) {
  const regels = [];
  regels.push('');
  regels.push('  Beveiligde verbinding (https) actief.');
  regels.push('  Op deze computer:  https://localhost:' + poort);
  for (const ip of cert.netwerk) regels.push('  Op uw telefoon:    https://' + ip + ':' + poort);
  if (!cert.netwerk.length) {
    regels.push('  Deze computer heeft nu geen netwerkadres; een telefoon kan er dus niet bij.');
    regels.push('  Zit hij op wifi?');
  }
  regels.push('');
  regels.push('  Eenmalig op de telefoon: het bestand RTG-CA.crt vertrouwen.');
  regels.push('  Het staat hier: ' + cert.caPad);
  regels.push('  Of haal het op met de telefoon via http://<adres hierboven>:' + (poort + 10) + '/rtg-ca.crt');
  regels.push('');
  return regels.join('\n');
}

module.exports = { certVoorDezeMachine, adressenVanDezeMachine, netwerkAdressen, startUitleg };
