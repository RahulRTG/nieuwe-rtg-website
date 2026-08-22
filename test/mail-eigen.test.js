/* Eigen post: DKIM-ondertekening (server/dkim.js) en directe bezorging bij de
   mailserver van de ontvanger (server/smtp-direct.js), plus de koppeling in
   server/mail.js.

   Waar dit op let, in volgorde van belang:

   1. Een handtekening die je nooit hebt zien VERIFIEREN kan onzin zijn. Elke
      DKIM-toets hier rekent hem ook echt na met de publieke sleutel, en kijkt
      of hij BREEKT zodra het lijf of een ondertekende kop wijzigt. Een
      handtekening die altijd goed is, meet niets.
   2. Het verschil tussen TIJDELIJK (4xx) en PERMANENT (5xx). Dat is de hele
      reden dat deze laag bestaat: bij 4xx mag je opnieuw, bij 5xx nooit. Een
      toets die alleen het gelukte geval doet, laat precies de fout door die een
      verzend-IP verbrandt.
   3. Dot-stuffing. Een regel die met een punt begint zou het bericht
      beeindigen; hier komt hij heel aan de andere kant aan.

   We draaien tegen een nep-mailserver op 127.0.0.1 en geven `mx` en `poort`
   expliciet mee -- daar zijn die twee parameters voor. Geen echte mail, geen
   echte DNS. Los: node --test test/mail-eigen.test.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const tls = require('node:tls');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const dkim = require('../server/dkim');
// Een lokale nep-MX hoort bij een mislukte TLS-handshake niet twintig seconden
// open te blijven; productie behoudt buiten deze test zijn ruimere timeout.
if (!process.env.MAIL_TIMEOUT_MS) process.env.MAIL_TIMEOUT_MS = '1500';
const direct = require('../server/smtp-direct');

/* Een sleutelpaar voor de hele toets. Wordt hier GEMAAKT en niet uit de repo
   gelezen: een private sleutel in git is precies wat de secret-scan hoort af te
   keuren. */
const SLEUTEL = dkim.maakSleutelpaar(2048);

/* Wegwerp-certificaat voor de STARTTLS-toets, net als in test/smtp.test.js.
   Zonder openssl slaat alleen die ene subtoets over. */
let KEY = null, CERT = null, TLS_OK = false;
try {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mx-'));
  const k = path.join(dir, 'k.pem'), c = path.join(dir, 'c.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', k,
    '-out', c, '-days', '2', '-nodes', '-subj', '/CN=localhost'], { stdio: 'ignore' });
  KEY = fs.readFileSync(k, 'utf8'); CERT = fs.readFileSync(c, 'utf8');
  fs.rmSync(dir, { recursive: true, force: true });
  TLS_OK = true;
} catch (e) { TLS_OK = false; }

/* Een nep-MX. opts: { begroeting, mail, rcpt, dataCmd, punt, starttls,
   eersteKeerWeigeren, adres }. Elk antwoord is instelbaar, want de hele toets
   draait om WELKE code er terugkomt. */
function nepMx(opts = {}) {
  return new Promise((resolve, reject) => {
    const vangst = { cmds: [], data: '', tls: false, verbindingen: 0 };
    const praat = (sock, versleuteld, stil) => {
      let inData = false, buf = '';
      sock.setEncoding('utf8');
      if (!stil) {
        const eerste = opts.eersteKeerWeigeren && vangst.verbindingen === 1;
        sock.write((eerste ? '421 te druk, probeer later' : (opts.begroeting || '220 nep.mx ESMTP')) + '\r\n');
        if (eerste) { sock.end(); return; }
      }
      sock.on('data', (c) => {
        buf += c;
        let i;
        while ((i = buf.indexOf('\r\n')) >= 0) {
          const lijn = buf.slice(0, i); buf = buf.slice(i + 2);
          if (inData) {
            if (lijn === '.') { inData = false; sock.write((opts.punt || '250 OK aangenomen') + '\r\n'); continue; }
            vangst.data += lijn + '\n'; continue;
          }
          vangst.cmds.push(lijn);
          const u = lijn.toUpperCase();
          if (u.startsWith('EHLO')) {
            const caps = ['250-nep.mx'];
            if (opts.starttls && !versleuteld) caps.push('250-STARTTLS');
            caps.push('250 SIZE 10240000');
            sock.write(caps.join('\r\n') + '\r\n');
          } else if (u === 'STARTTLS') {
            sock.write('220 klaar\r\n');
            sock.removeAllListeners('data');
            vangst.tls = true;
            praat(new tls.TLSSocket(sock, { isServer: true, key: KEY, cert: CERT }), true, true);
            return;
          } else if (u.startsWith('MAIL')) sock.write((opts.mail || '250 OK') + '\r\n');
          else if (u.startsWith('RCPT')) sock.write((opts.rcpt || '250 OK') + '\r\n');
          else if (u === 'DATA') {
            const r = opts.dataCmd || '354 ga uw gang';
            sock.write(r + '\r\n');
            if (r.startsWith('354')) inData = true;
          } else if (u === 'QUIT') { sock.write('221 dag\r\n'); sock.end(); }
          else sock.write('250 OK\r\n');
        }
      });
      sock.on('error', () => {});
    };
    const srv = net.createServer((s) => { vangst.verbindingen++; praat(s, false, false); });
    srv.on('error', reject);
    srv.listen(opts.poort || 0, opts.adres || '127.0.0.1', () => resolve({ srv, poort: srv.address().port, vangst }));
  });
}

const KOPPEN = () => ({
  From: 'RTG <post@rahultravelgroup.test>',
  To: 'lid@voorbeeld.test',
  Subject: 'Uw bevestiging',
  Date: 'Mon, 04 Aug 2026 10:00:00 +0000',
  'Message-ID': '<abc123@rahultravelgroup.test>',
  'MIME-Version': '1.0',
  'Content-Type': 'text/plain; charset=utf-8'
});
const ONDERTEKEN = (koppen, lijf) => dkim.onderteken({
  koppen, lijf, domein: 'rahultravelgroup.test', selector: 'rtg', priveSleutel: SLEUTEL.prive });

/* ---------------------------------------------------------------- DKIM ---- */

test('DKIM: de handtekening rekent na met de publieke sleutel', () => {
  const koppen = KOPPEN(), lijf = 'Beste lid,\r\n\r\nUw pas is klaar.\r\n';
  const uit = ONDERTEKEN(koppen, lijf);
  assert.ok(uit.ok, uit.waarom);
  assert.match(uit.kop, /^DKIM-Signature: v=1; a=rsa-sha256; c=relaxed\/relaxed; d=rahultravelgroup\.test; s=rtg;/);
  assert.deepEqual(uit.ondertekend, ['from', 'to', 'subject', 'date', 'message-id', 'mime-version', 'content-type']);
  const na = dkim.controleer({ koppen, lijf, veld: uit.veld, publiekeSleutel: SLEUTEL.publiek });
  assert.ok(na.ok, 'de handtekening hoort te verifieren: ' + na.waarom);
});

test('DKIM: een gewijzigd lijf breekt de handtekening', () => {
  const koppen = KOPPEN(), lijf = 'Uw bedrag is 100 euro.\r\n';
  const uit = ONDERTEKEN(koppen, lijf);
  const na = dkim.controleer({ koppen, lijf: 'Uw bedrag is 900 euro.\r\n', veld: uit.veld, publiekeSleutel: SLEUTEL.publiek });
  assert.equal(na.ok, false);
  assert.match(na.waarom, /lijf is gewijzigd/);
});

test('DKIM: een gewijzigde ONDERTEKENDE kop breekt de handtekening', () => {
  // het lijf blijft heel; alleen het onderwerp wijzigt -- dan moet de tweede
  // controle (de kophandtekening) hem vangen, niet de lijf-hash
  const koppen = KOPPEN(), lijf = 'Niets aan de hand.\r\n';
  const uit = ONDERTEKEN(koppen, lijf);
  const gesjoemeld = Object.assign(KOPPEN(), { Subject: 'Uw terugbetaling' });
  const na = dkim.controleer({ koppen: gesjoemeld, lijf, veld: uit.veld, publiekeSleutel: SLEUTEL.publiek });
  assert.equal(na.ok, false);
  assert.match(na.waarom, /klopt niet met de kop/);
});

test('DKIM: relaxed canonicalisatie -- overbodige witruimte mag niet uitmaken', () => {
  /* Dat is de hele belofte van relaxed: een tussenliggende server mag spaties
     aan het regeleinde weghalen zonder de handtekening te breken. */
  const koppen = KOPPEN(), lijf = 'regel een\r\nregel twee\r\n';
  const uit = ONDERTEKEN(koppen, lijf);
  const onderweg = 'regel  een   \r\nregel\ttwee\r\n\r\n\r\n';
  const na = dkim.controleer({ koppen, lijf: onderweg, veld: uit.veld, publiekeSleutel: SLEUTEL.publiek });
  assert.ok(na.ok, 'witruimte-wijzigingen horen relaxed te overleven: ' + na.waarom);
});

test('DKIM: zonder From wordt er niet ondertekend, en zonder sleutel ook niet', () => {
  const zonder = dkim.onderteken({ koppen: { Subject: 'x' }, lijf: 'y',
    domein: 'a.test', selector: 'rtg', priveSleutel: SLEUTEL.prive });
  assert.equal(zonder.ok, false);
  assert.match(zonder.waarom, /zonder From/);
  const geen = dkim.onderteken({ koppen: KOPPEN(), lijf: 'y', domein: 'a.test', selector: 'rtg' });
  assert.equal(geen.ok, false);
  assert.match(geen.waarom, /private sleutel/);
});

test('DKIM: dnsRegels geeft de drie records die een mens moet publiceren', () => {
  const r = dkim.dnsRegels({ domein: 'rahultravelgroup.test', selector: 'rtg',
    publiekeSleutel: SLEUTEL.publiek, ip: '203.0.113.7' });
  assert.equal(r.length, 3);
  assert.equal(r[0].naam, 'rtg._domainkey.rahultravelgroup.test');
  assert.ok(r[0].waarde.includes('p=' + SLEUTEL.p), 'de publieke sleutel staat plat in het record');
  assert.match(r[1].waarde, /^v=spf1 ip4:203\.0\.113\.7 -all$/);
  assert.equal(r[2].naam, '_dmarc.rahultravelgroup.test');
  assert.match(r[2].waarde, /^v=DMARC1; p=quarantine;/);
  assert.ok(r.every(x => x.soort === 'TXT' && x.wat), 'elk record legt uit waarvoor het dient');
});

/* ------------------------------------------------------- eigen bezorging -- */

test('bezorgen: een mailserver die het aanneemt levert soort "bezorgd"', async () => {
  const s = await nepMx();
  try {
    const uit = await direct.bezorg({ van: 'post@rtg.test', naar: 'lid@voorbeeld.test',
      bericht: 'Subject: hoi\r\n\r\nhet lijf', mx: [{ exchange: '127.0.0.1' }], poort: s.poort, naam: 'mx.rtg.test' });
    assert.equal(uit.ok, true);
    assert.equal(uit.soort, 'bezorgd');
    assert.equal(uit.via, '127.0.0.1');
    const c = s.vangst.cmds;
    assert.ok(c.includes('EHLO mx.rtg.test'), 'stelt zich voor met de meegegeven naam');
    assert.ok(c.includes('MAIL FROM:<post@rtg.test>'), 'MAIL FROM in punthaken');
    assert.ok(c.includes('RCPT TO:<lid@voorbeeld.test>'), 'RCPT TO in punthaken');
    assert.ok(c.includes('DATA') && c.includes('QUIT'));
    assert.match(s.vangst.data, /het lijf/);
  } finally { s.srv.close(); }
});

test('bezorgen: een 5xx is PERMANENT en wordt niet bij de volgende MX herhaald', async () => {
  const s = await nepMx({ rcpt: '550 5.1.1 die gebruiker bestaat hier niet' });
  try {
    const uit = await direct.bezorg({ van: 'post@rtg.test', naar: 'weg@voorbeeld.test',
      bericht: 'x', mx: [{ exchange: '127.0.0.1' }, { exchange: '127.0.0.1' }], poort: s.poort });
    assert.equal(uit.ok, false);
    assert.equal(uit.soort, 'permanent');
    assert.equal(uit.code, 550);
    assert.equal(uit.pogingen.length, 1, 'na een permanente weigering hoort de tweede MX NIET geprobeerd te worden');
    assert.equal(s.vangst.verbindingen, 1);
  } finally { s.srv.close(); }
});

test('bezorgen: een 4xx is TIJDELIJK -- ok blijft false, maar de soort verschilt', async () => {
  const s = await nepMx({ rcpt: '451 4.3.0 even geen ruimte' });
  try {
    const uit = await direct.bezorg({ van: 'post@rtg.test', naar: 'lid@voorbeeld.test',
      bericht: 'x', mx: [{ exchange: '127.0.0.1' }], poort: s.poort });
    assert.equal(uit.ok, false);
    assert.equal(uit.soort, 'tijdelijk');
    assert.equal(uit.pogingen[0].code, 451);
    assert.match(uit.waarom, /later opnieuw proberen/);
  } finally { s.srv.close(); }
});

test('bezorgen: na een tijdelijke weigering gaat hij door naar de volgende MX', async () => {
  // dezelfde server: de EERSTE verbinding krijgt 421, de tweede een gewone begroeting
  const s = await nepMx({ eersteKeerWeigeren: true });
  try {
    const uit = await direct.bezorg({ van: 'post@rtg.test', naar: 'lid@voorbeeld.test',
      bericht: 'x', mx: [{ exchange: '127.0.0.1' }, { exchange: '127.0.0.1' }], poort: s.poort });
    assert.equal(uit.ok, true, 'de tweede MX nam hem aan');
    assert.equal(uit.pogingen.length, 2);
    assert.equal(uit.pogingen[0].soort, 'tijdelijk');
    assert.equal(uit.pogingen[0].code, 421);
  } finally { s.srv.close(); }
});

test('bezorgen: dot-stuffing -- een regel die met een punt begint komt heel aan', async () => {
  const s = await nepMx();
  try {
    const uit = await direct.bezorg({ van: 'post@rtg.test', naar: 'lid@voorbeeld.test',
      bericht: 'Subject: s\r\n\r\neerste regel\r\n.verborgen regel\r\nlaatste regel',
      mx: [{ exchange: '127.0.0.1' }], poort: s.poort });
    assert.equal(uit.soort, 'bezorgd');
    /* De nep-server haalt de stuffing er niet af, dus hij ziet "..verborgen".
       Dat is precies het bewijs dat de punt verdubbeld is: zonder stuffing was
       het bericht op die regel afgekapt en had "laatste regel" nooit
       aangekomen. */
    assert.match(s.vangst.data, /^\.\.verborgen regel$/m);
    assert.match(s.vangst.data, /laatste regel/);
  } finally { s.srv.close(); }
});

test('bezorgen: iets dat geen e-mailadres is, is permanent fout', async () => {
  const uit = await direct.bezorg({ van: 'post@rtg.test', naar: 'geen-adres', bericht: 'x' });
  assert.equal(uit.ok, false);
  assert.equal(uit.soort, 'permanent');
  assert.match(uit.waarom, /geen e-mailadres/);
});

test('bezorgen: een onbereikbare mailserver is tijdelijk, geen exception', async () => {
  // een poort waar niets luistert: dat hoort GEEN kale fout naar boven te geven,
  // want de aanroeper moet kunnen besluiten het later nog eens te proberen
  const s = await nepMx();
  /* WACHTEN TOT DE POORT ECHT DICHT IS, en niet 30 ms gokken. Deze toets wil
     juist een poort waar NIETS luistert; is de server nog niet dicht als we
     verbinden, dan praten we met een levende nepserver en meet de bewering iets
     anders. server.close() roept zijn callback pas als de laatste verbinding weg
     is -- dat is het teken, en het staat gewoon in de API. */
  const dichte = s.poort;
  await new Promise(k => s.srv.close(k));
  const uit = await direct.bezorg({ van: 'post@rtg.test', naar: 'lid@voorbeeld.test',
    bericht: 'x', mx: [{ exchange: '127.0.0.1' }], poort: dichte });
  assert.equal(uit.soort, 'tijdelijk');
  assert.equal(uit.ok, false);
});

test('mxVan: een domein zonder MX valt terug op het domein zelf (RFC 5321)', async () => {
  /* .invalid bestaat gegarandeerd niet (RFC 2606), dus dit werkt met EN zonder
     werkend DNS: beide eindigen in de terugval, en dat is de belofte. */
  const r = await direct.mxVan('bestaat-echt-niet.invalid');
  assert.equal(r.length, 1);
  assert.equal(r[0].exchange, 'bestaat-echt-niet.invalid');
  assert.equal(r[0].viaA, true, 'de terugval is als zodanig gemerkt, niet stilletjes');
});

test('bezorgen: STARTTLS met een onbekend certificaat faalt dicht', { skip: !TLS_OK }, async () => {
  const s = await nepMx({ starttls: true });
  try {
    const uit = await direct.bezorg({ van: 'post@rtg.test', naar: 'lid@voorbeeld.test',
      bericht: 'Subject: s\r\n\r\nversleuteld', mx: [{ exchange: '127.0.0.1' }], poort: s.poort });
    assert.equal(uit.ok, false);
    assert.equal(uit.soort, 'tijdelijk', 'een geldig certificaat kan bij een volgende poging alsnog werken');
    assert.match([uit.pogingen[0].waarom, uit.waarom].filter(Boolean).join(' '),
      /self-signed|certificate|certificaat|antwoordde niet/i);
    assert.equal(s.vangst.tls, true, 'de handshake is geprobeerd');
    assert.equal(s.vangst.cmds.some(c => c.startsWith('MAIL FROM')), false,
      'zonder geverifieerde tegenpartij gaat geen envelop of bericht over de lijn');
  } finally { s.srv.close(); }
});

test('beschikbaar(): meet poort 25 echt, en zegt eerlijk wat eruit komt', async () => {
  /* Dit is de meter die voorkomt dat iemand MAIL_DIRECT aanzet op een machine
     waar poort 25 uit dicht is. Hij moet dus beide kanten op kunnen wijzen. */
  let srv = null;
  try {
    srv = await new Promise((res, rej) => {
      const s = net.createServer(() => {});
      s.on('error', rej);
      s.listen(25, '127.0.0.1', () => res(s));
    });
  } catch (e) { srv = null; }   // geen rechten op poort 25: dan alleen de dichte kant
  if (srv) {
    /* try/finally, en niet omdat het netjes staat: zonder dit blijft er bij een
       ZAKKENDE assertie een server op poort 25 luisteren, en dan HANGT de hele
       toetsloop in plaats van te falen. Een toets die vastloopt in plaats van
       rood te worden, verbergt precies wat hij zou moeten laten zien. */
    try {
      const open = await direct.beschikbaar('127.0.0.1');
      assert.equal(open.poort25, true, 'een luisterende poort 25 hoort als open gemeten te worden');
      assert.equal(open.waarom, null);
    } finally { await new Promise(r => srv.close(r)); }
  }
  const dicht = await direct.beschikbaar('127.0.0.1');
  assert.equal(dicht.poort25, false);
  assert.match(dicht.waarom, /poort 25 uit is bij deze hoster waarschijnlijk dicht/);
});

/* ----------------------------------------------------- koppeling in mail -- */

test('mail.bouwBericht: volledige koppen en een handtekening die naregent', () => {
  /* server/mail.js leest zijn omgeving bij het inladen, dus dit gebeurt in een
     eigen node-proces met de sleutel in de omgeving. Anders zou de toets van de
     volgorde van require() afhangen -- en dat is geen toets maar een gok. */
  const script = `
    const dkim = require(${JSON.stringify(path.resolve(__dirname, '../server/dkim.js'))});
    const mail = require(${JSON.stringify(path.resolve(__dirname, '../server/mail.js'))});
    const b = mail.bouwBericht('lid@voorbeeld.test', 'Uw reservering in het café', 'de tekst met een accent: café');
    const kop = b.rauw.split('\\r\\n\\r\\n')[0];
    const lijf = b.rauw.slice(kop.length + 4);
    const koppen = {};
    for (const r of kop.split('\\r\\n')) { const i = r.indexOf(': '); if (i > 0) koppen[r.slice(0, i)] = r.slice(i + 2); }
    const veld = koppen['DKIM-Signature'];
    const na = dkim.controleer({ koppen, lijf, veld, publiekeSleutel: process.env.DKIM_PUBLIC_TEST });
    console.log(JSON.stringify({ ondertekend: b.ondertekend, messageId: b.messageId,
      koppen: Object.keys(koppen), na, subject: koppen.Subject,
      lijfTerug: Buffer.from(lijf.replace(/\\r\\n/g, ''), 'base64').toString('utf8'),
      hoogsteByte: Math.max(0, ...Buffer.from(kop, 'utf8')) }));
  `;
  const uit = execFileSync(process.execPath, ['-e', script], {
    env: Object.assign({}, process.env, {
      MAIL_FROM: 'RTG <post@rahultravelgroup.test>',
      MAIL_DOMEIN: 'rahultravelgroup.test',
      DKIM_SELECTOR: 'rtg',
      DKIM_PRIVATE_KEY: SLEUTEL.prive,
      DKIM_PUBLIC_TEST: SLEUTEL.publiek,
      SMTP_URL: ''
    }), encoding: 'utf8'
  });
  const r = JSON.parse(uit.trim().split('\n').pop());
  assert.equal(r.ondertekend, true, 'met een sleutel in de omgeving hoort het bericht ondertekend te zijn');
  assert.match(r.messageId, /^<[0-9a-f]{24}@rahultravelgroup\.test>$/);
  for (const k of ['DKIM-Signature', 'From', 'To', 'Subject', 'Date', 'Message-ID', 'MIME-Version', 'Content-Type'])
    assert.ok(r.koppen.includes(k), 'kop ' + k + ' ontbreekt');
  assert.ok(r.na.ok, 'de handtekening uit mail.js hoort te verifieren: ' + r.na.waarom);
  /* Een onderwerp met een accent hoort als RFC 2047 encoded-word over de lijn
     te gaan en niet als hoge bytes in de kop: er is bij directe bezorging geen
     provider meer die dat rechtzet. */
  assert.match(r.subject, /^=\?UTF-8\?B\?/);
  assert.ok(r.hoogsteByte < 128, 'de koppen bevatten geen enkele byte boven 127');
  assert.equal(r.lijfTerug, 'de tekst met een accent: café\n', 'het lijf decodeert terug naar de oorspronkelijke tekst');
});

test('mail.bouwBericht: zonder sleutel gaat de post ONONDERTEKEND weg, niet stiekem', () => {
  const script = `
    const mail = require(${JSON.stringify(path.resolve(__dirname, '../server/mail.js'))});
    const b = mail.bouwBericht('lid@voorbeeld.test', 'x', 'y');
    console.log(JSON.stringify({ ondertekend: b.ondertekend, heeftKop: /DKIM-Signature/.test(b.rauw) }));
  `;
  const env = Object.assign({}, process.env, { MAIL_FROM: 'RTG <post@rahultravelgroup.test>', SMTP_URL: '' });
  delete env.DKIM_PRIVATE_KEY;
  const r = JSON.parse(execFileSync(process.execPath, ['-e', script], { env, encoding: 'utf8' }).trim());
  assert.equal(r.ondertekend, false);
  assert.equal(r.heeftKop, false, 'geen lege of nep-handtekening in de kop');
});
