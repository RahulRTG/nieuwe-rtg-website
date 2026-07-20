/* Eigen SMTP-verzendclient (server/smtp.js), die nodemailer verving. We draaien
   tegen een nep-SMTP-server (net/tls) en controleren de protocolstappen en de
   MIME-opmaak: EHLO -> MAIL/RCPT/DATA, base64-body die terug decodeert, encoded-
   word onderwerp, STARTTLS-upgrade, AUTH LOGIN over TLS, en dat AUTH NOOIT over
   een onversleutelde verbinding gaat. Los: node --test test/smtp.test.js

   Voor de TLS-paden staat hier een zelfondertekend testcertificaat; de client
   valideert normaal het certificaat, dus in deze test zetten we tijdelijk
   NODE_TLS_REJECT_UNAUTHORIZED uit (alleen om het testcert te accepteren). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const tls = require('node:tls');
const smtp = require('../server/smtp');

const CERT = `-----BEGIN CERTIFICATE-----
MIIDCzCCAfOgAwIBAgIUfj8BGKAK/84tF+17RNynX7DeMawwDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJbG9jYWxob3N0MCAXDTI2MDcyMDE1MzQyOVoYDzIxMjYw
NjI2MTUzNDI5WjAUMRIwEAYDVQQDDAlsb2NhbGhvc3QwggEiMA0GCSqGSIb3DQEB
AQUAA4IBDwAwggEKAoIBAQC7dEwjxw3XByhgmTez+yloRPIii0gn+8WeUWmGr86o
R7Y8MR9GSqMUmxphtEbUrIz+8J4JAGStyPIyDKskJCkOq+3ZfBB7z3/7nS+E/rx4
fzpzdk7ABEuCwIK2Xo3rFRZ+86bbGCpKifbhdgTD2iAUaw5ku+idvUaW/dKYmOGJ
ET8UkQsrNo8R3DE9h29wHoFXNlX6pxk/anndf7z5kzzolVJFgNRZhCOEkjIPJ7/G
ckFWV1CH6JmijBbuHRAXSosj3SUJULRQaqQoltN7e1qZhrr3LkK9utQlDdQkxQ1q
jlJe276Cea6Y6RTiHSG+UCUpDDotDrm+XPSno/axkHTtAgMBAAGjUzBRMB0GA1Ud
DgQWBBSF+/V4lkMUzfqgQAJqm4w6z9HNGDAfBgNVHSMEGDAWgBSF+/V4lkMUzfqg
QAJqm4w6z9HNGDAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQCA
ljUPCUoi/lSZzbOssDbhCD0MtonEFlwJf3wN+PYOiDg6iQFwVEkRqONcEcGsprfs
fKTQ0rktUPFmx/mDYmahSa3wJ6B9Xh5AkWMlqvjn360QglU8ddLDXo5IziZAZi4W
HyWbUSOQVBEBll/nr+8GfsxTPSvxWlfJfZLozsCOgvZNoo+cV9lY3sokE09Y5Qq6
3vgwFaqrGlMueLaLDJT8Bc6NSjZRxALj4Rqeh6dBgjNqt4O3lag6pQdbgU1qQMeN
tdSzXjpaFuwJ7AhsV5mhM01J/zyBQ/SLBOujbmQu3HNcNyKkaA/vyeboId+wyEQf
708r2C+4E9zymZmBFSCj
-----END CERTIFICATE-----`;
const KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7dEwjxw3XByhg
mTez+yloRPIii0gn+8WeUWmGr86oR7Y8MR9GSqMUmxphtEbUrIz+8J4JAGStyPIy
DKskJCkOq+3ZfBB7z3/7nS+E/rx4fzpzdk7ABEuCwIK2Xo3rFRZ+86bbGCpKifbh
dgTD2iAUaw5ku+idvUaW/dKYmOGJET8UkQsrNo8R3DE9h29wHoFXNlX6pxk/annd
f7z5kzzolVJFgNRZhCOEkjIPJ7/GckFWV1CH6JmijBbuHRAXSosj3SUJULRQaqQo
ltN7e1qZhrr3LkK9utQlDdQkxQ1qjlJe276Cea6Y6RTiHSG+UCUpDDotDrm+XPSn
o/axkHTtAgMBAAECggEACfX/l8UbkKoSNLPfmGJHzIEhZsGE947y7NtBosUT07Bf
2Cn6EfekW9N0Hu3/94wlv+RUWYEaWHu9lvhCXdzIC74KGQz1KUcY82tiW4xXwoVs
Ozd1rtFrm8qUB5HVs8C+ncdfvfO2R5i2NDvbu/aKztrzfFnZ3gvxRNO/DZnOHkTj
XzLN6Eu/32O09AmTRKhYGpnD53mkZ9AWZwY3hkHnnRzbBzpSuKHNkG7nS0smJ6QO
o9Pmkno+SQakatUtlFWRocR8qrzRGXq+7yBj+dura5V+hMHAwLWFaej3wcHFSG7t
GNYPLO7q6Vky0CtjJfpiQf4JnhsHJpltQFvcAvQdVwKBgQD42I0cj53i+zjsSkcm
lJXoyWzIXhK6s8yiUAz64q1BH/1kV6Xe1sd2Nx0dUIR3rwxu0tBV4btC9V1uFJm0
qyH2gUK3z34ll3VHb/LZs3zX/Qf7cx6sw/deuSUxOchltLGqOoEy5NjmmRSftTjL
9rGX1fvdcs3DfJyA8JDdowJwKwKBgQDA1+sBFprBP8w559rawjNznnJxZxjq1+JW
fy2xCXOAI0VUgbuAFMN/vtl6wzyEkbQXG4HN0RWAe++ErzNrxxR6XgJgDQ5L9AkR
wAEkgl5+jLJYSe5SWU6Rbx16Zax9NNX3Eqm3GQIoPd1XMVyAUMAqbOGQlCC+2346
6EgbwPSLRwKBgQCecUNn7AmbfFnCGYk0B2dr0NRyv3MtbU3eCxo4pBusW7H7MdNr
D1Xw7yaag6nUiqBf79q21ANnntLeRD+ZyVzWl3bjkjm/ta/2zFDUTHQxEesDL0lY
t23J4hjMPv5Zw7Nbr+STgyKXsOBwz/JZ67kn9Bdp6K8ayTzc3E9gz2m+AQKBgCtO
EXLsHZJ5/iWewFHRvHYhRbfbnAfYtPYRlzQjWDGVOhNxEqb/gqtkMzhTMXrfsV5j
CfIrGrYAntff9B8m1J1qEQR6yhQaWBMJV/hX4lpuw/n5mDAb5/3WwvribCqtu8LB
CSWZ0xcwVU0oQ4p5F74vNzQdX4EcjysxUEgTO5cvAoGAA6n8eNjHwmyFQdOdR6Fq
iD+3Fav9kfhvhDKJlZeUPOuFhFcteWre8zErFbV3SOABvUFWMbt07zaG43ObGluY
cVS1fSnwSoDuFTpk9XgEuGfXPeHMGDieqiV/plx7ECRoRFCI0cLDld8vpwFZmYwN
ByOfll5hbpez9ppf5B4o0AM=
-----END PRIVATE KEY-----`;

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

test('STARTTLS: de client schakelt over en doet AUTH LOGIN pas daarna', async () => {
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

test('implicit TLS (smtps://) met AUTH PLAIN', async () => {
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
