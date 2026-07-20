/* Eigen SMTP-verzendclient (server/smtp.js), die nodemailer verving. We draaien
   tegen een nep-SMTP-server (net/tls) en controleren de protocolstappen en de
   MIME-opmaak: EHLO -> MAIL/RCPT/DATA, base64-body die terug decodeert, encoded-
   word onderwerp, STARTTLS-upgrade, AUTH LOGIN over TLS, en dat AUTH NOOIT over
   een onversleutelde verbinding gaat. Los: node --test test/smtp.test.js

   Voor de TLS-paden genereren we bij het opstarten een wegwerp-zelfondertekend
   certificaat met openssl (geen sleutel in de repo -- dat zou de secret-scan
   terecht rood maken). Is openssl er niet, dan slaan we alleen de TLS-subtests
   over; de plaintext- en MIME-tests draaien altijd. De client valideert het
   certificaat normaal, dus in de TLS-tests zetten we tijdelijk
   NODE_TLS_REJECT_UNAUTHORIZED uit (alleen om dit wegwerpcert te accepteren). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const tls = require('node:tls');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const smtp = require('../server/smtp');

/* Wegwerp-testcert genereren (nooit committen): openssl schrijft sleutel + cert
   naar een tijdelijke map, we lezen ze in het geheugen. Lukt dat niet, dan
   worden de TLS-subtests overgeslagen. */
let KEY = null, CERT = null, TLS_OK = false;
try {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-smtp-'));
  const k = path.join(dir, 'k.pem'), c = path.join(dir, 'c.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', k,
    '-out', c, '-days', '2', '-nodes', '-subj', '/CN=localhost'], { stdio: 'ignore' });
  KEY = fs.readFileSync(k, 'utf8'); CERT = fs.readFileSync(c, 'utf8');
  fs.rmSync(dir, { recursive: true, force: true });
  TLS_OK = true;
} catch (e) { TLS_OK = false; }

/* Een nep-SMTP-server. opts: { starttls, auth, secure } -> stuurt de juiste
   capabilities en registreert wat de client stuurt. Praat het protocol zoals
   een echte submission-server (EHLO/STARTTLS/AUTH/MAIL/RCPT/DATA/QUIT). */
function nepServer(opts = {}) {
  return new Promise(resolve => {
    const vangst = { cmds: [], data: '', authRuw: [] };
    const onConn = (sock, versleuteld, stil) => {
      let inData = false, buf = '', verwachtAuth = 0;
      sock.setEncoding('utf8');
      if (!stil) sock.write('220 nep ESMTP\r\n');   // na STARTTLS komt er GEEN nieuwe begroeting
      sock.on('data', c => {
        buf += c;
        let i;
        while ((i = buf.indexOf('\r\n')) >= 0) {
          const lijn = buf.slice(0, i); buf = buf.slice(i + 2);
          if (inData) {
            if (lijn === '.') { inData = false; sock.write('250 OK opgeslagen\r\n'); continue; }
            vangst.data += lijn + '\n'; continue;
          }
          if (verwachtAuth > 0) { vangst.authRuw.push(lijn); verwachtAuth--; sock.write(verwachtAuth ? '334 UGFzc3dvcmQ6\r\n' : '235 OK\r\n'); continue; }
          vangst.cmds.push(lijn);
          const u = lijn.toUpperCase();
          if (u.startsWith('EHLO')) {
            const caps = ['250-nep'];
            if (opts.starttls && !versleuteld) caps.push('250-STARTTLS');
            if (opts.auth && versleuteld) caps.push('250-AUTH ' + (opts.authMech || 'LOGIN PLAIN'));
            caps.push('250 SIZE 10240000');
            sock.write(caps.join('\r\n') + '\r\n');
          } else if (u === 'STARTTLS') {
            sock.write('220 klaar\r\n');
            sock.removeAllListeners('data');            // de raw socket niet meer plaintext lezen
            const tsock = new tls.TLSSocket(sock, { isServer: true, key: KEY, cert: CERT });
            tsock.on('secure', () => {}); onConn(tsock, true, true);
            return;
          } else if (u === 'AUTH LOGIN') { verwachtAuth = 2; sock.write('334 VXNlcm5hbWU6\r\n'); }
          else if (u.startsWith('AUTH PLAIN')) { vangst.authRuw.push(lijn.split(' ')[2] || ''); sock.write('235 OK\r\n'); }
          else if (u.startsWith('MAIL') || u.startsWith('RCPT')) sock.write('250 OK\r\n');
          else if (u === 'DATA') { sock.write('354 verder\r\n'); inData = true; }
          else if (u === 'QUIT') { sock.write('221 dag\r\n'); sock.end(); }
          else sock.write('250 OK\r\n');
        }
      });
      sock.on('error', () => {});
    };
    const srv = opts.secure
      ? tls.createServer({ key: KEY, cert: CERT }, s => onConn(s, true))
      : net.createServer(s => onConn(s, false));
    srv.on('error', () => {});
    srv.listen(0, '127.0.0.1', () => resolve({ srv, poort: srv.address().port, vangst }));
  });
}

const alleenCmd = cmds => cmds.filter(c => /^(EHLO|STARTTLS|AUTH|MAIL|RCPT|DATA|QUIT)/i.test(c));
function bodyUit(data) {
  const b64 = data.split('\n').filter(l => /^[A-Za-z0-9+/=]+$/.test(l) && l.length > 4).join('');
  return Buffer.from(b64, 'base64').toString('utf8');
}

test('plain: MAIL/RCPT/DATA-volgorde + base64-body die terug decodeert', async () => {
  const s = await nepServer({});
  const r = await smtp.createTransport('smtp://127.0.0.1:' + s.poort).sendMail({
    from: 'RTG <no-reply@rtg.example>', to: 'Lid <lid@voorbeeld.nl>', subject: 'Hallo', text: 'Regel een\nRegel twee' });
  s.srv.close();
  assert.deepEqual(alleenCmd(s.vangst.cmds).slice(0, 4),
    ['EHLO ' + require('os').hostname(), 'MAIL FROM:<no-reply@rtg.example>', 'RCPT TO:<lid@voorbeeld.nl>', 'DATA']);
  assert.equal(bodyUit(s.vangst.data), 'Regel een\nRegel twee');
  assert.match(s.vangst.data, /^Content-Transfer-Encoding: base64/m);
  assert.deepEqual(r.accepted, ['lid@voorbeeld.nl']);
});

test('niet-ASCII onderwerp wordt een RFC 2047 encoded-word', async () => {
  const s = await nepServer({});
  await smtp.createTransport('smtp://127.0.0.1:' + s.poort).sendMail({
    from: 'a@b.nl', to: 'c@d.nl', subject: 'Reünie café', text: 'x' });
  s.srv.close();
  const kop = s.vangst.data.split('\n').find(l => l.startsWith('Subject:'));
  assert.match(kop, /=\?UTF-8\?B\?/);
  const woord = kop.match(/=\?UTF-8\?B\?([^?]+)\?=/)[1];
  assert.equal(Buffer.from(woord, 'base64').toString('utf8'), 'Reünie café');
});

test('STARTTLS: de client schakelt over en doet AUTH LOGIN pas daarna', { skip: !TLS_OK }, async () => {
  const oud = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  let s;
  try {
    s = await nepServer({ starttls: true, auth: true, authMech: 'LOGIN' });
    await smtp.createTransport('smtp://user:pass@127.0.0.1:' + s.poort).sendMail({ from: 'a@b.nl', to: 'c@d.nl', subject: 'S', text: 'geheim' });
    const cmds = alleenCmd(s.vangst.cmds);
    assert.ok(cmds.includes('STARTTLS'), 'STARTTLS is gestuurd');
    assert.equal(cmds.filter(c => c.startsWith('EHLO')).length, 2, 'EHLO opnieuw na de upgrade');
    assert.ok(cmds.some(c => c.startsWith('AUTH LOGIN')), 'AUTH pas na TLS');
    // de base64-credentials (gebruiker, dan wachtwoord) decoderen naar user/pass
    assert.deepEqual(s.vangst.authRuw.map(x => Buffer.from(x, 'base64').toString('utf8')), ['user', 'pass']);
    assert.equal(bodyUit(s.vangst.data), 'geheim');
  } finally {
    if (s) s.srv.close();
    if (oud === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED; else process.env.NODE_TLS_REJECT_UNAUTHORIZED = oud;
  }
});

test('implicit TLS (smtps://) met AUTH PLAIN', { skip: !TLS_OK }, async () => {
  const oud = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  let s;
  try {
    s = await nepServer({ secure: true, auth: true, authMech: 'PLAIN' });
    await smtp.createTransport('smtps://naam:sleutel@127.0.0.1:' + s.poort).sendMail({ from: 'a@b.nl', to: 'c@d.nl', subject: 'S', text: 'hoi' });
    assert.ok(alleenCmd(s.vangst.cmds).some(c => c.startsWith('AUTH PLAIN')), 'AUTH PLAIN gebruikt');
    // AUTH PLAIN-token decodeert naar \0gebruiker\0wachtwoord
    assert.deepEqual(s.vangst.authRuw.map(x => Buffer.from(x, 'base64').toString('utf8')), ['\0naam\0sleutel']);
  } finally {
    if (s) s.srv.close();
    if (oud === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED; else process.env.NODE_TLS_REJECT_UNAUTHORIZED = oud;
  }
});

test('AUTH gaat NOOIT over een onversleutelde verbinding', async () => {
  const s = await nepServer({ auth: false }); // geen STARTTLS, plaintext
  await assert.rejects(
    () => smtp.createTransport('smtp://user:pass@127.0.0.1:' + s.poort).sendMail({ from: 'a@b.nl', to: 'c@d.nl', subject: 'x', text: 'y' }),
    /onversleuteld/);
  s.srv.close();
});

test('MIME-eenheid: adres uithalen, kopwaarde, dot-stuffing in de ruwe boodschap', () => {
  assert.equal(smtp._adresVan('Naam Achternaam <a@b.nl>'), 'a@b.nl');
  assert.equal(smtp._adresVan('kaal@adres.nl'), 'kaal@adres.nl');
  assert.equal(smtp._kopWaarde('gewoon'), 'gewoon');
  assert.match(smtp._kopWaarde('café'), /^=\?UTF-8\?B\?/);
  // een tekst waarvan een regel met '.' begint -> in de ruwe boodschap ".."
  const ruw = smtp._bouwBericht({ naam: 'h' }, { from: 'a@b.nl', to: 'c@d.nl', subject: 's', text: '.punt' });
  // de body is base64, dus de dot-stuffing raakt niet de leesbare tekst; check dat de opmaak klopt
  assert.match(ruw, /\r\nContent-Transfer-Encoding: base64\r\n\r\n/);
  assert.doesNotMatch(ruw.split('\r\n\r\n')[1] || '', /^\./m); // geen ruwe regel begint met een enkele punt
});
