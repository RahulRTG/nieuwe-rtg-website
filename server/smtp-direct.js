/* ============================================================================
   EIGEN BEZORGING: de post gaat rechtstreeks naar de mailserver van de
   ontvanger, zonder provider ertussen.

   server/smtp.js is de andere helft: die levert AF bij een smarthost die je
   hebt ingehuurd. Dit bestand doet wat die smarthost normaal voor je doet --
   het MX-record van het ontvangende domein opzoeken, verbinden, STARTTLS, en
   het bericht afgeven. Samen met server/dkim.js is dat een eigen postkantoor.

   VIER DINGEN DIE CODE NIET KAN OPLOSSEN, en die hier hardop staan omdat een
   verzendlaag die dat verzwijgt, mail wegstuurt die nergens aankomt:

   1. POORT 25 UIT IS BIJNA OVERAL DICHT. AWS, Google, Azure en Hetzner
      blokkeren uitgaand verkeer op 25 standaard. Zonder open poort werkt
      directe bezorging niet, hoe goed de code ook is. `beschikbaar()`
      hieronder PROBEERT het en zegt eerlijk wat eruit komt.
   2. PTR (omgekeerde DNS) van het verzendende IP moet kloppen met de naam
      waarmee we ons voorstellen. Dat regelt de hostingpartij, niet wij.
   3. SPF EN DMARC zijn DNS-records. server/dkim.js schrijft ze voor u uit;
      publiceren is mensenwerk.
   4. REPUTATIE. Een vers IP mag weinig. Grote ontvangers laten de eerste dagen
      maar een handvol berichten door; dat is geen storing maar beleid.

   WAT DIT WEL GOED DOET: het onderscheid tussen TIJDELIJK (4xx, verbinding
   mislukt -- opnieuw proberen) en PERMANENT (5xx -- niet opnieuw proberen, de
   ontvanger bestaat niet). Een verzendlaag die dat niet scheidt, blijft dagen
   bonzen op een adres dat niet bestaat, en dat is precies hoe je een IP
   verbrandt.
   ========================================================================== */
'use strict';
const net = require('net');
const tls = require('tls');
const { sniVan } = require('./lib/sni');
const dns = require('dns').promises;
const os = require('os');

const CRLF = '\r\n';
const TIJD = Number(process.env.MAIL_TIMEOUT_MS || 20000);

// de mailservers van een domein, op voorkeur gesorteerd
async function mxVan(domein) {
  try {
    const rijen = await dns.resolveMx(domein);
    if (rijen && rijen.length) return rijen.slice().sort((a, b) => a.priority - b.priority);
  } catch (e) { /* geen MX: dan is de A-record van het domein de mailserver (RFC 5321) */ }
  return [{ exchange: domein, priority: 0, viaA: true }];
}

/* Een gesprek met een mailserver. Bewust klein: verbinden, antwoorden lezen,
   commando's sturen, en bij elke stap de CODE teruggeven -- want die code
   bepaalt of we later opnieuw mogen proberen. */
function praat(sok) {
  let buffer = '';
  const wachtenden = [];
  sok.setEncoding('binary');
  sok.on('data', (stuk) => {
    buffer += stuk;
    let m;
    // een antwoord is af zodra er een regel staat als "250 tekst" (zonder streepje)
    while ((m = /^(?:\d{3}-[^\r\n]*\r\n)*(\d{3}) [^\r\n]*\r\n/.exec(buffer)) !== null) {
      const heel = buffer.slice(0, m[0].length);
      buffer = buffer.slice(m[0].length);
      const w = wachtenden.shift();
      if (w) w({ code: Number(m[1]), tekst: heel.trim() });
    }
  });
  const lees = () => new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('de mailserver antwoordde niet binnen ' + TIJD + ' ms')), TIJD);
    wachtenden.push((a) => { clearTimeout(t); res(a); });
  });
  const zeg = (regel) => { sok.write(regel + CRLF, 'binary'); return lees(); };
  return { lees, zeg };
}

const tijdelijk = (code) => code >= 400 && code < 500;
const goed = (code) => code >= 200 && code < 400;

/* Afleveren bij EEN mailserver. Geeft altijd een uitslag terug met een soort:
   'bezorgd', 'tijdelijk' of 'permanent'. Nooit een kale exception naar boven --
   de aanroeper moet kunnen beslissen of hij het later nog eens probeert. */
async function bijServer(host, poort, { van, naar, bericht, naam }) {
  let sok;
  try {
    sok = await new Promise((res, rej) => {
      const s = net.createConnection({ host, port: poort || 25, timeout: TIJD }, () => res(s));
      s.once('error', rej);
      s.once('timeout', () => { s.destroy(); rej(new Error('verbinding met ' + host + ' liep in een time-out')); });
    });
  } catch (e) {
    return { soort: 'tijdelijk', host, waarom: e.message };
  }

  try {
    let g = praat(sok);
    let a = await g.lees();
    if (!goed(a.code)) return { soort: tijdelijk(a.code) ? 'tijdelijk' : 'permanent', host, code: a.code, waarom: a.tekst };

    const ik = naam || process.env.MAIL_HELO || os.hostname();
    a = await g.zeg('EHLO ' + ik);
    const kanTls = /STARTTLS/i.test(a.tekst);
    if (!goed(a.code)) return { soort: 'tijdelijk', host, code: a.code, waarom: a.tekst };

    if (kanTls) {
      const s = await g.zeg('STARTTLS');
      if (goed(s.code)) {
        /* STARTTLS is alleen bescherming als het certificaat ook bij de MX-host
           hoort. Een onbekend certificaat wordt daarom een tijdelijke fout:
           opnieuw proberen is veilig, doorsturen via een mogelijke MITM niet. */
        /* SNI alleen bij een NAAM -- de regel woont sinds 26 augustus 2026 in
           ./lib/sni.js, omdat hij hier wel stond en in smtp.js en redis.js niet. */
        sok = tls.connect(Object.assign({ socket: sok, rejectUnauthorized: true }, sniVan(host)));
        await new Promise((res, rej) => { sok.once('secure', res); sok.once('error', rej); });
        g = praat(sok);
        a = await g.zeg('EHLO ' + ik);
        if (!goed(a.code)) return { soort: 'tijdelijk', host, code: a.code, waarom: a.tekst };
      }
    }

    a = await g.zeg('MAIL FROM:<' + van + '>');
    if (!goed(a.code)) return { soort: tijdelijk(a.code) ? 'tijdelijk' : 'permanent', host, code: a.code, waarom: a.tekst };
    a = await g.zeg('RCPT TO:<' + naar + '>');
    if (!goed(a.code)) return { soort: tijdelijk(a.code) ? 'tijdelijk' : 'permanent', host, code: a.code, waarom: a.tekst };
    a = await g.zeg('DATA');
    if (!goed(a.code)) return { soort: tijdelijk(a.code) ? 'tijdelijk' : 'permanent', host, code: a.code, waarom: a.tekst };

    // dot-stuffing: een regel die met een punt begint zou het bericht beeindigen
    const lijf = String(bericht).replace(/\r?\n/g, CRLF).replace(/^\./gm, '..');
    sok.write(lijf + CRLF + '.' + CRLF, 'binary');
    a = await g.lees();
    if (!goed(a.code)) return { soort: tijdelijk(a.code) ? 'tijdelijk' : 'permanent', host, code: a.code, waarom: a.tekst };
    try { await g.zeg('QUIT'); } catch (e) { /* de deur dichtdoen is beleefdheid, geen eis */ }
    return { soort: 'bezorgd', host, code: a.code, tekst: a.tekst, tls: kanTls };
  } catch (e) {
    return { soort: 'tijdelijk', host, waarom: e.message };
  } finally {
    try { sok.destroy(); } catch (e) {}
  }
}

/* Bezorgen bij een adres: alle MX-servers op voorkeur af, tot er een lukt.
   `mx` en `poort` zijn er voor de toets en voor een vaste route; laat ze weg en
   het DNS bepaalt de weg. */
async function bezorg({ van, naar, bericht, naam, mx, poort }) {
  const adres = String(naar || '');
  const domein = adres.split('@')[1];
  if (!domein) return { ok: false, soort: 'permanent', waarom: 'dat is geen e-mailadres' };
  const servers = mx && mx.length ? mx : await mxVan(domein);
  const pogingen = [];
  for (const s of servers) {
    const uit = await bijServer(s.exchange, poort, { van, naar: adres, bericht, naam });
    pogingen.push(uit);
    if (uit.soort === 'bezorgd') return { ok: true, soort: 'bezorgd', via: uit.host, code: uit.code, pogingen };
    if (uit.soort === 'permanent') return { ok: false, soort: 'permanent', waarom: uit.waarom, code: uit.code, pogingen };
  }
  return { ok: false, soort: 'tijdelijk', pogingen,
    waarom: 'geen van de ' + servers.length + ' mailserver(s) van ' + domein + ' nam het bericht aan; later opnieuw proberen' };
}

/* Kan deze machine uberhaupt zelf bezorgen? Dit PROBEERT het in plaats van het
   te beweren: een TCP-verbinding naar een echte mailserver op poort 25. Bij de
   meeste hosters is die dicht, en dan hoort dat te blijken voordat iemand de
   knop omzet -- niet uit een stapel niet-bezorgde mail een week later. */
async function beschikbaar(proefHost) {
  const host = proefHost || 'aspmx.l.google.com';
  return new Promise((res) => {
    const s = net.createConnection({ host, port: 25, timeout: 8000 });
    const klaar = (ok, waarom) => { try { s.destroy(); } catch (e) {} res({ poort25: ok, host, waarom }); };
    s.once('connect', () => klaar(true, null));
    s.once('timeout', () => klaar(false, 'de verbinding liep in een time-out; poort 25 uit is bij deze hoster waarschijnlijk dicht'));
    s.once('error', (e) => klaar(false, e.message + ' -- poort 25 uit is bij deze hoster waarschijnlijk dicht'));
  });
}

module.exports = { bezorg, bijServer, mxVan, beschikbaar };
