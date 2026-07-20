/* Eigen, kleine SMTP-verzendclient, i.p.v. het pakket nodemailer.

   Let op de nuance bij regel 1 (docs/de-lijn.md): we schrijven hier GEEN eigen
   cryptografie. De versleuteling van de verbinding komt volledig uit node:tls
   (implicit TLS of STARTTLS). Wij zetten alleen de bekende SMTP-protocolstappen
   op elkaar -- EHLO, STARTTLS, AUTH, MAIL/RCPT/DATA -- plus een correcte MIME-
   opmaak (headers, UTF-8, base64-body, dot-stuffing). Dat is protocol-assemblage,
   geen crypto.

   Scope, bewust smal en eerlijk: dit is een SUBMISSION-client naar een
   geconfigureerde smarthost (SMTP_URL van een provider), geen volwaardige MTA.
   Geen MX-resolutie, geen eigen wachtrij met herproberen -- dat doet de provider
   erachter, en zonder SMTP_URL valt server/mail.js sowieso terug op de outbox.
   Credentials gaan NOOIT over een onversleutelde verbinding (anders weigeren we).

   Zelfde vorm als het pakket, zodat server/mail.js niets merkt:
       const t = require('./smtp').createTransport(SMTP_URL);
       await t.sendMail({ from, to, subject, text });   // belofte, net als nodemailer */
'use strict';
const net = require('net');
const tls = require('tls');
const os = require('os');
const crypto = require('crypto');

const CRLF = '\r\n';

function createTransport(url, opts) {
  const cfg = ontleedUrl(url, opts || {});
  return { sendMail(bericht) { return verstuur(cfg, bericht); } };
}

function ontleedUrl(url, opts) {
  const u = new URL(url);
  const secure = u.protocol === 'smtps:';
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : (secure ? 465 : 587),
    secure,                                            // implicit TLS vanaf de eerste byte
    user: u.username ? decodeURIComponent(u.username) : '',
    pass: u.password ? decodeURIComponent(u.password) : '',
    timeout: opts.timeout || 20000,
    naam: opts.name || os.hostname() || 'localhost'
  };
}

/* Een adres uit "Naam <adres@host>" of een kaal adres halen (voor MAIL/RCPT). */
function adresVan(s) {
  const m = String(s).match(/<([^>]+)>/);
  return (m ? m[1] : String(s)).trim();
}
function adressen(to) {
  const lijst = Array.isArray(to) ? to : String(to).split(',');
  return lijst.map(adresVan).filter(Boolean);
}

/* RFC 5322-datum met +0000 (Node's toUTCString eindigt op GMT). */
function rfcDatum(d) {
  const dg = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const mn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p = n => String(n).padStart(2, '0');
  return `${dg[d.getUTCDay()]}, ${p(d.getUTCDate())} ${mn[d.getUTCMonth()]} ${d.getUTCFullYear()} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} +0000`;
}

/* Een header-waarde met niet-ASCII veilig maken (RFC 2047 encoded-word, base64). */
function kopWaarde(s) {
  s = String(s == null ? '' : s);
  if (/^[\x20-\x7E]*$/.test(s)) return s;             // pure ASCII: laat staan
  return '=?UTF-8?B?' + Buffer.from(s, 'utf8').toString('base64') + '?=';
}

/* De volledige RFC 5322-boodschap: headers + lege regel + base64-body.
   Base64 voor de body vermijdt alle quoted-printable-randgevallen; regels op 76. */
function bouwBericht(cfg, bericht) {
  const from = bericht.from || cfg.user || 'no-reply@localhost';
  const koppen = [
    'From: ' + from,
    'To: ' + (Array.isArray(bericht.to) ? bericht.to.join(', ') : bericht.to),
    'Subject: ' + kopWaarde(bericht.subject),
    'Date: ' + rfcDatum(new Date()),
    'Message-ID: <' + crypto.randomBytes(16).toString('hex') + '@' + cfg.naam + '>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64'
  ];
  const body = Buffer.from(String(bericht.text == null ? '' : bericht.text), 'utf8')
    .toString('base64').replace(/(.{76})/g, '$1' + CRLF);
  let ruw = koppen.join(CRLF) + CRLF + CRLF + body;
  // dot-stuffing: een regel die met '.' begint krijgt er een '.' bij (RFC 5321 §4.5.2)
  ruw = ruw.replace(/\r\n\./g, CRLF + '..').replace(/^\./, '..');
  return ruw;
}

/* Leest SMTP-antwoorden uit een socket. Groepeert meerregelige antwoorden
   ("250-...\r\n250 ...") tot één { code, tekst }. */
function maakLezer(socket) {
  let buf = '';
  let huidig = [];
  const klaar = [];        // afgeronde antwoorden die nog niet zijn opgehaald
  const wachters = [];     // { resolve, reject } die op een antwoord wachten
  let stuk = null;         // fout/afsluiting: verdere lezers krijgen dit

  const lever = resp => { if (wachters.length) wachters.shift().resolve(resp); else klaar.push(resp); };
  const breek = err => { stuk = err; while (wachters.length) wachters.shift().reject(err); };

  socket.on('data', chunk => {
    buf += chunk.toString('utf8');
    let i;
    while ((i = buf.indexOf(CRLF)) >= 0) {
      const lijn = buf.slice(0, i); buf = buf.slice(i + 2);
      huidig.push(lijn);
      if (/^\d{3}-/.test(lijn)) continue;             // continuatie
      if (/^\d{3}( |$)/.test(lijn)) {
        const code = parseInt(lijn.slice(0, 3), 10);
        const tekst = huidig.map(l => l.slice(4)).join('\n');
        huidig = []; lever({ code, tekst });
      }
    }
  });
  socket.on('error', breek);
  socket.on('close', () => breek(new Error('SMTP: verbinding gesloten')));

  return {
    lees() {
      if (klaar.length) return Promise.resolve(klaar.shift());
      if (stuk) return Promise.reject(stuk);
      return new Promise((resolve, reject) => wachters.push({ resolve, reject }));
    }
  };
}

async function verwacht(lezer, codes, wat) {
  const resp = await lezer.lees();
  if (!codes.includes(resp.code)) {
    const e = new Error('SMTP ' + wat + ': onverwacht antwoord ' + resp.code + ' ' + resp.tekst.split('\n')[0]);
    e.code = resp.code; throw e;
  }
  return resp;
}
function schrijf(socket, regel) { socket.write(regel + CRLF); }
async function commando(socket, lezer, regel, codes, wat) { schrijf(socket, regel); return verwacht(lezer, codes, wat); }

function verstuur(cfg, bericht) {
  return new Promise((resolve, reject) => {
    let socket, afgerond = false;
    const klaarMislukt = e => { if (afgerond) return; afgerond = true; try { socket && socket.destroy(); } catch (x) {} reject(e); };
    const gelukt = r => { if (afgerond) return; afgerond = true; resolve(r); };

    const start = (sock, versleuteld) => {
      socket = sock;
      socket.setTimeout(cfg.timeout, () => klaarMislukt(new Error('SMTP: tijd verstreken')));
      const lezer = maakLezer(socket);
      loop(socket, lezer, versleuteld).then(gelukt, klaarMislukt);
    };

    const sock = cfg.secure
      ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host }, () => start(sock, true))
      : net.connect({ host: cfg.host, port: cfg.port }, () => start(sock, false));
    sock.on('error', klaarMislukt);
  });

  async function loop(socket, lezer, versleuteld) {
    await verwacht(lezer, [220], 'begroeting');
    let ehlo = await commando(socket, lezer, 'EHLO ' + cfg.naam, [250], 'EHLO');
    let caps = ehlo.tekst.toUpperCase();

    if (!versleuteld && /STARTTLS/.test(caps)) {
      await commando(socket, lezer, 'STARTTLS', [220], 'STARTTLS');
      socket = await new Promise((res, rej) => {
        const t = tls.connect({ socket, servername: cfg.host }, () => res(t));
        t.on('error', rej);
      });
      socket.setTimeout(cfg.timeout, () => { throw new Error('SMTP: tijd verstreken'); });
      lezer = maakLezer(socket);
      ehlo = await commando(socket, lezer, 'EHLO ' + cfg.naam, [250], 'EHLO(TLS)');
      caps = ehlo.tekst.toUpperCase();
      versleuteld = true;
    }

    if (cfg.user) {
      if (!versleuteld) throw new Error('SMTP: weiger AUTH over een onversleutelde verbinding');
      await authenticeer(socket, lezer, caps);
    }

    const van = adresVan(bericht.from || cfg.user);
    await commando(socket, lezer, 'MAIL FROM:<' + van + '>', [250], 'MAIL FROM');
    const rcpts = adressen(bericht.to);
    if (!rcpts.length) throw new Error('SMTP: geen geldige ontvanger');
    for (const r of rcpts) await commando(socket, lezer, 'RCPT TO:<' + r + '>', [250, 251], 'RCPT TO');

    await commando(socket, lezer, 'DATA', [354], 'DATA');
    socket.write(bouwBericht(cfg, bericht) + CRLF + '.' + CRLF);
    await verwacht(lezer, [250], 'einde DATA');

    try { await commando(socket, lezer, 'QUIT', [221], 'QUIT'); } catch (e) { /* sommige servers kappen het gewoon af */ }
    try { socket.end(); } catch (e) {}
    return { accepted: rcpts, response: '250 verzonden' };
  }

  async function authenticeer(socket, lezer, caps) {
    const b64 = s => Buffer.from(String(s), 'utf8').toString('base64');
    if (/AUTH[^\n]*\bPLAIN\b/.test(caps)) {
      await commando(socket, lezer, 'AUTH PLAIN ' + b64('\0' + cfg.user + '\0' + cfg.pass), [235], 'AUTH PLAIN');
    } else if (/AUTH[^\n]*\bLOGIN\b/.test(caps)) {
      await commando(socket, lezer, 'AUTH LOGIN', [334], 'AUTH LOGIN');
      await commando(socket, lezer, b64(cfg.user), [334], 'AUTH gebruiker');
      await commando(socket, lezer, b64(cfg.pass), [235], 'AUTH wachtwoord');
    } else {
      throw new Error('SMTP: server biedt geen AUTH PLAIN/LOGIN');
    }
  }
}

module.exports = { createTransport, _bouwBericht: bouwBericht, _adresVan: adresVan, _kopWaarde: kopWaarde, _rfcDatum: rfcDatum };
