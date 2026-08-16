/* Kleine, dependencyvrije ClamAV-client. Bestanden gaan als INSTREAM over het
   afgeschermde Docker-datanetwerk; clamd krijgt dus nooit een pad op de
   app-schijf en de app hoeft de quarantaine niet met de scanner te delen. */
'use strict';

const fs = require('fs');
const net = require('net');

const MAX_ANTWOORD = 8192;

function maakClamd(opties) {
  opties = opties || {};
  const host = String(opties.host || process.env.RTG_CLAMD_HOST || '').trim();
  const port = Number(opties.port || process.env.RTG_CLAMD_PORT || 3310);
  const timeout = Number(opties.timeout || process.env.RTG_CLAMD_TIMEOUT_MS || 15000);
  const maxBytes = Number(opties.maxBytes || 16 * 1024 * 1024);
  if (!host) return null;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('RTG_CLAMD_PORT is ongeldig.');
  if (!Number.isFinite(timeout) || timeout < 250 || timeout > 120000) throw new Error('RTG_CLAMD_TIMEOUT_MS is ongeldig.');

  async function scanBestand(pad) {
    const stat = await fs.promises.stat(pad);
    if (!stat.isFile()) throw new Error('De quarantainescanner kreeg geen gewoon bestand.');
    if (stat.size > maxBytes) throw new Error('Het quarantainebestand is groter dan de scanlimiet.');

    return new Promise((resolve, reject) => {
      let klaar = false;
      let antwoord = Buffer.alloc(0);
      const sok = net.createConnection({ host, port });
      const stroom = fs.createReadStream(pad, { highWaterMark: 64 * 1024 });

      const stop = (fout, resultaat) => {
        if (klaar) return;
        klaar = true;
        stroom.destroy();
        sok.destroy();
        if (fout) reject(fout); else resolve(resultaat);
      };
      sok.setTimeout(timeout, () => stop(new Error('ClamAV antwoordde niet op tijd.')));
      sok.on('error', e => stop(new Error('ClamAV is niet bereikbaar: ' + e.message)));
      stroom.on('error', e => stop(new Error('Quarantainebestand is niet leesbaar: ' + e.message)));
      sok.on('connect', () => {
        sok.write(Buffer.from('zINSTREAM\0'));
        stroom.on('data', stuk => {
          stroom.pause();
          const kop = Buffer.allocUnsafe(4);
          kop.writeUInt32BE(stuk.length, 0);
          sok.write(kop);
          sok.write(stuk, () => stroom.resume());
        });
        stroom.on('end', () => sok.write(Buffer.alloc(4)));
      });
      sok.on('data', stuk => {
        antwoord = Buffer.concat([antwoord, stuk]);
        if (antwoord.length > MAX_ANTWOORD) return stop(new Error('ClamAV gaf een onbegrensd antwoord.'));
        if (!antwoord.includes(0)) return;
        const tekst = antwoord.subarray(0, antwoord.indexOf(0)).toString('utf8').trim();
        if (/:\s+OK$/i.test(tekst)) return stop(null, { verdict: 'schoon', antwoord: tekst });
        const raak = /:\s+(.+)\s+FOUND$/i.exec(tekst);
        if (raak) return stop(null, { verdict: 'besmet', naam: raak[1].slice(0, 160), antwoord: tekst });
        return stop(new Error('ClamAV gaf geen geldig oordeel: ' + tekst.slice(0, 200)));
      });
      sok.on('end', () => {
        if (!klaar) stop(new Error('ClamAV sloot de verbinding zonder oordeel.'));
      });
    });
  }

  return { scanBestand, host, port };
}

module.exports = { maakClamd };
