/* Lokale https, de terminal-kant: de QR-code in het venster en het lijstje
   bij het opstarten. De certificaten en het loket zelf staan in
   ./lokaal-tls.js; dat bestand exporteert deze functies mee, dus aanroepers
   blijven gewoon require('./lokaal-tls') gebruiken. */

/* Een QR-code in het Terminal-venster, met onze eigen codec (public/shared/qr.js).

   Het adres van deze computer overtypen op een telefoon gaat vaak mis: één
   spatie of een autocorrectie en de browser maakt er een zoekopdracht van, en
   dan komt u ergens heel anders uit. Met een QR hoeft er niets getypt te
   worden: camera erop, tikken op de melding, klaar.

   Twee beeldrijen per tekstregel via de halve blokjes, anders wordt de code
   twee keer zo hoog als een terminalvenster.

   Twee dingen die een camera anders laten afhaken, en die allebei niet te zien
   zijn als je alleen naar de code kijkt:

   De rustzone. Een QR heeft rondom vier lege blokjes nodig; met minder vindt
   een camera de hoeken niet terug. Dat is geen marge maar onderdeel van de
   code.

   De polariteit. De blokjes worden getekend in de kleuren van het venster, en
   een Terminal met een witte achtergrond keert de code daarmee om: donker
   wordt licht. Voor een mens ziet dat er nog steeds uit als een QR, voor een
   camera is het onleesbaar. We zetten de kleuren daarom zelf: wit op zwart,
   ongeacht het profiel van de gebruiker. Zonder kleur (kleur:false) blijft de
   oude tekening over, voor logbestanden en tests. */
function qrInTerminal(tekst, opties) {
  opties = opties || {};
  const kleur = opties.kleur !== false;
  let matrix;
  try { matrix = require('../public/shared/qr').encode(tekst, { ecc: 'M' }).matrix; }
  catch (e) { return ''; }
  const rand = 4;
  const n = matrix.length + rand * 2;
  const aan = (r, k) => {
    const y = r - rand, x = k - rand;
    return y >= 0 && x >= 0 && y < matrix.length && x < matrix.length && matrix[y][x];
  };
  // wit is aan: een QR is donker-op-licht, dus een donker blokje laten we leeg
  const AAN = '\x1b[97;40m', UIT = '\x1b[0m';
  const regels = [];
  for (let r = 0; r < n; r += 2) {
    let regel = '';
    for (let k = 0; k < n; k++) {
      const boven = aan(r, k), onder = (r + 1 < n) ? aan(r + 1, k) : false;
      regel += boven && onder ? ' ' : boven ? '▄' : onder ? '▀' : '█';
    }
    regels.push('  ' + (kleur ? AAN + regel + UIT : regel));
  }
  return regels.join('\n');
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
  if (cert.netwerk.length) {
    const loket = 'https://' + cert.netwerk[0] + ':' + poort + '/lokaal';
    regels.push('  Richt de camera van uw telefoon op deze code, en tik op de melding:');
    regels.push('');
    const qr = qrInTerminal(loket);
    if (qr) { regels.push(qr); regels.push(''); }
    regels.push('  Uw browser waarschuwt eenmalig dat de verbinding niet veilig is. Dat klopt:');
    regels.push('  het certificaat staat nog niet op uw telefoon, en dat is precies wat u daar');
    regels.push('  gaat ophalen. Tik op "Toon details" en daarna op "Bezoek deze website".');
    regels.push('');
    regels.push('  (of typ het over: ' + loket + ')');
    regels.push('  (zonder die waarschuwing, maar alleen als "Alleen HTTPS" uit staat:');
    regels.push('   http://' + cert.netwerk[0] + ':' + (poort + 10) + ')');
  }
  regels.push('  Het certificaat staat ook los op schijf: ' + cert.caPad);
  regels.push('');
  return regels.join('\n');
}

module.exports = { qrInTerminal, startUitleg };
