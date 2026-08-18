/* De SMTP-ONTVANGER: post van buiten aannemen.

   Wat hier bewezen wordt, en waarom juist dit:

     geen relay    een RCPT TO naar een adres dat hier geen postvak is, krijgt
                   550 -- en wel VOOR de inhoud. Dit is de belangrijkste regel
                   van server/smtp-in.js; zonder hem is dit binnen een dag een
                   spamrelay en een bron van backscatter.
     de keten      een compleet gesprek levert een bericht in het postvak van
                   het lid op, langs dezelfde weg als de HTTP-buitenpoort --
                   want die keten hoort maar een keer te bestaan.
     dot-stuffing  een regel die met een punt begint komt ongeschonden aan
     de grenzen    te veel commando's, te veel ontvangers, een te groot bericht
     geen oogst    VRFY doet geen uitspraak over wie hier woont
     echt luisteren  hetzelfde gesprek over een echte socket, want een protocol
                   dat alleen met arrays werkt is nog geen server

   Draai: node --test test/smtp-in.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

const maakGesprek = require('../server/smtp-in');
const { antwoordCode, maakOntvangst, MAX_BYTES } = require('../server/smtp-in-data');

/* Een nep-aanname: hij onthoudt wat hij kreeg en kent precies EEN adres. Zo
   toetst dit bestand het PROTOCOL en niet de bezorging -- die staat in
   kern/mailaanname.js en heeft zijn eigen toetsen hieronder. */
function nepAanname(kent) {
  const gezien = [];
  return {
    gezien,
    kentAdres: (a) => (String(a).toLowerCase() === kent ? { soort: 'lid', adres: kent } : null),
    neemAan: async (o) => { gezien.push(o); return { ok: true, id: 'b' + gezien.length }; }
  };
}
/* Het gesprek voeren met twee arrays in plaats van een netwerk. Dat kan omdat
   server/smtp-in.js geen socket kent (zelfde splitsing als bij IMAP). */
async function praat(aanname, regels, opties) {
  const uit = [];
  const g = maakGesprek(Object.assign({ aanname, naam: 'proef' }, opties || {}));
  const s = g.sessie((t) => uit.push(t), { ip: '203.0.113.9' });
  s.begroet();
  const einden = [];
  for (const r of regels) einden.push(await s.regel(r));
  return { uit, einden, stand: s._stand(), gesprek: g };
}
// de laatste antwoordcode op een regel; het gesprek schrijft "250 tekst\r\n"
const codes = (uit) => uit.join('').split('\r\n').filter(Boolean).map(r => Number(r.slice(0, 3)));

/* ===================== het protocol, zonder netwerk ====================== */
test('een adres dat hier geen postvak is, wordt geweigerd VOOR de inhoud', async () => {
  const a = nepAanname('gouden-ibis-4473@rtgpass.rtg');
  const { uit } = await praat(a, [
    'EHLO buiten.test',
    'MAIL FROM:<jan@buiten.test>',
    'RCPT TO:<niemand@rtgpass.rtg>',
    'DATA'
  ]);
  const c = codes(uit);
  assert.equal(c[c.length - 2], 550, 'de RCPT wordt geweigerd: ' + uit.join(''));
  assert.equal(c[c.length - 1], 503, 'en zonder geldige ontvanger komt DATA er niet doorheen');
  assert.equal(a.gezien.length, 0, 'er is geen enkele byte inhoud aangenomen');
});

test('een compleet gesprek levert het bericht af, met envelop en IP erbij', async () => {
  const a = nepAanname('gouden-ibis-4473@rtgpass.rtg');
  const { uit } = await praat(a, [
    'EHLO buiten.test',
    'MAIL FROM:<jan@buiten.test> SIZE=1234',
    'RCPT TO:<Gouden-Ibis-4473@RTGPASS.RTG>',
    'DATA',
    'From: Jan <jan@buiten.test>',
    'Subject: Hallo',
    '',
    'Tot 14 september.',
    '.'
  ]);
  assert.equal(codes(uit).pop(), 250, uit.join(''));
  assert.equal(a.gezien.length, 1);
  const g = a.gezien[0];
  assert.match(g.ruw, /Subject: Hallo/);
  /* De envelop en het IP gaan MEE. Zonder die twee is een SPF-uitslag geen
     uitslag -- dat is het hele idee van SPF, en het is precies wat de
     HTTP-buitenpoort alleen kan als iemand het erbij typt. */
  assert.equal(g.envelopeVan, 'jan@buiten.test');
  assert.equal(g.ip, '203.0.113.9');
  assert.equal(g.helo, 'buiten.test');
});

test('een regel die met een punt begint komt ongeschonden aan', async () => {
  /* Dot-stuffing (RFC 5321, 4.5.2). Gaat dit fout, dan merk je het zelden --
     de meeste post heeft geen zin die met een punt begint. */
  const a = nepAanname('x@rtgpass.rtg');
  await praat(a, ['EHLO b', 'MAIL FROM:<j@b.test>', 'RCPT TO:<x@rtgpass.rtg>', 'DATA',
    'From: j@b.test', '', '..dit begon met een punt', 'gewone regel', '.']);
  assert.match(a.gezien[0].ruw, /\n\.dit begon met een punt/, a.gezien[0].ruw);
  assert.doesNotMatch(a.gezien[0].ruw, /\.\.dit/);
});

test('EHLO belooft alleen wat er echt is', async () => {
  const a = nepAanname('x@rtgpass.rtg');
  const zonder = (await praat(a, ['EHLO b'])).uit.join('');
  assert.doesNotMatch(zonder, /STARTTLS/, 'zonder sleutel geen STARTTLS-belofte');
  assert.match(zonder, /SIZE 26214400/, 'de omvangsgrens staat er wel, zodat een verzender hem vooraf weet');

  const met = (await praat(a, ['EHLO b'], { starttls: true })).uit.join('');
  assert.match(met, /250-STARTTLS|250 STARTTLS/, 'met sleutel wel');
});

test('STARTTLS gooit alles weg wat ervoor is gezegd', async () => {
  /* Niet uit netheid: alles voor de handshake kan door een meelezer zijn
     geschreven. Wie dat laat staan, laat een aanvaller de envelop bepalen. */
  const a = nepAanname('x@rtgpass.rtg');
  const r = await praat(a, ['EHLO buiten.test', 'MAIL FROM:<j@b.test>', 'RCPT TO:<x@rtgpass.rtg>', 'STARTTLS'],
    { starttls: true });
  assert.equal(r.einden[r.einden.length - 1], 'starttls', 'de laag eronder moet overschakelen');
  assert.equal(r.stand.helo, '', 'de begroeting is vergeten');
  assert.equal(r.stand.van, null, 'de afzender is vergeten');
  assert.deepEqual(r.stand.naar, [], 'de ontvangers zijn vergeten');
});

test('de grenzen zijn er, en ze zeggen wat ze doen', async () => {
  const a = nepAanname('x@rtgpass.rtg');

  // te veel ontvangers
  const veel = ['EHLO b', 'MAIL FROM:<j@b.test>'];
  for (let i = 0; i < 12; i++) veel.push('RCPT TO:<x@rtgpass.rtg>');
  const rv = await praat(a, veel);
  assert.ok(codes(rv.uit).includes(452), 'de elfde ontvanger krijgt 452: ' + codes(rv.uit).join(','));

  // te veel commando's -> de verbinding gaat dicht
  const lang = [];
  for (let i = 0; i < 105; i++) lang.push('NOOP');
  const rl = await praat(a, lang);
  assert.ok(codes(rl.uit).includes(421), 'na honderd commando\'s: 421');
  assert.ok(rl.einden.includes('sluiten'), 'en de verbinding mag dicht');

  // een te groot bericht
  const groot = ['EHLO b', 'MAIL FROM:<j@b.test>', 'RCPT TO:<x@rtgpass.rtg>', 'DATA', 'From: j@b.test', ''];
  const regel = 'x'.repeat(4000);
  for (let i = 0; i < 7000; i++) groot.push(regel);
  groot.push('.');
  const rg = await praat(a, groot);
  assert.equal(codes(rg.uit).pop(), 552, 'over de grens: 552');
  assert.equal(a.gezien.length, 0, 'en er is niets bezorgd');
});

test('VRFY verraadt niet wie hier woont', async () => {
  /* De oudste adressen-oogstmachine die er is. Dit huis draait op codenamen;
     een vreemde hoort er geen ledenlijst mee op te kunnen bouwen. */
  const a = nepAanname('x@rtgpass.rtg');
  const bestaat = await praat(a, ['EHLO b', 'VRFY x@rtgpass.rtg']);
  const niet = await praat(a, ['EHLO b', 'VRFY niemand@rtgpass.rtg']);
  assert.equal(codes(bestaat.uit).pop(), 252);
  assert.deepEqual(codes(bestaat.uit), codes(niet.uit),
    'het antwoord is hetzelfde, of het adres nu bestaat of niet');
});

test('volgorde is volgorde: RCPT zonder MAIL, DATA zonder RCPT', async () => {
  const a = nepAanname('x@rtgpass.rtg');
  /* HELO en niet EHLO: dat antwoord is EEN regel, dus de codes hieronder staan
     op de plek waar je ze verwacht. Met EHLO (vier regels) telde deze toets de
     verkeerde antwoorden en zakte hij om de verkeerde reden. */
  const r = await praat(a, ['HELO b', 'RCPT TO:<x@rtgpass.rtg>', 'DATA', 'PIROUETTE']);
  const c = codes(r.uit);
  assert.deepEqual(c, [220, 250, 503, 503, 500],
    'begroeting, HELO, RCPT zonder MAIL FROM, DATA zonder ontvanger, onbekend commando');
});

test('wat onverwacht misgaat is TIJDELIJK, wat definitief is is definitief', () => {
  /* De verkeerde kant op kiezen kost echt iets: 4xx waar 5xx hoort laat een
     verzender dagen doorproberen op een adres dat nooit gaat bestaan; 5xx waar
     4xx hoort gooit post weg omdat onze database even klemzat. */
  assert.equal(antwoordCode({ status: 550 }), 550, 'onbekend adres: definitief');
  assert.equal(antwoordCode({ status: 400 }), 550, 'onleesbaar bericht: opnieuw sturen helpt niet');
  assert.equal(antwoordCode(null), 451, 'niets teruggekregen: dan ligt het aan ons');
  assert.equal(antwoordCode({ status: 500 }), 451, 'onze fout: de verzender mag het opnieuw proberen');
});

test('de omvangsgrens stopt het BEWAREN, niet het LEZEN', () => {
  /* Wie de verbinding afkapt midden in een bericht, laat de andere kant het
     hele bericht straks gewoon opnieuw sturen. */
  const o = maakOntvangst();
  const regel = 'y'.repeat(5000);
  for (let i = 0; i < 6000; i++) assert.equal(o.regel(regel), null, 'blijft regels aannemen');
  const af = o.regel('.');
  assert.equal(af.klaar, true, 'en hij rondt gewoon af op de punt');
  assert.equal(af.teGroot, true);
  assert.equal(af.ruw, '', 'maar er is niets bewaard');
  assert.ok(MAX_BYTES > 0);
});

/* ================== de ontvangertoets, als eenheid ======================== */
test('een adres buiten onze domeinen is nooit van ons -- ook niet als er post voor ligt', () => {
  /* DIT IS DE REGEL DIE EEN RELAY VOORKOMT, en hij is niet overbodig naast "geen
     postvak, geen post". Waarom niet:

     kern/werkmail.js schrijft UITGAANDE post naar buiten OOK in RTMAIL weg, als
     logregel, met het externe adres als ontvanger (de buitenpost, regel 124).
     Zodra een partner dus een klant op gmail mailt, ligt er in RTMAIL "post" op
     dat gmail-adres. Zonder de domeincontrole zou de ontvangertoets daarop
     antwoorden met "hier woont iemand" -- en dan nemen wij post aan voor
     gmail-adressen die onze eigen partners ooit hebben gemaild. Dat is een open
     relay, gevoed door onze eigen uitgaande post.

     Deze toets staat er omdat de mutatie die de domeincontrole weghaalde
     AFSLOEG: de socket-toetsen gebruikten een vreemd adres waar toevallig geen
     post voor lag, dus was er niets te zien (regel 2 van de lat). */
  const gelogd = { id: 'x', van: 'eigenaar@zaak.rtg', naar: 'klant@gmail.com', onderwerp: 'offerte' };
  const rtmailStub = {
    normAdres: (a) => String(a || '').trim().toLowerCase(),
    // precies wat de buitenpost achterlaat: er LIGT post op dat externe adres
    postvak: (a) => (a === 'klant@gmail.com' ? [gelogd] : [])
  };
  const { mailAanname } = require('../server/kern/mailaanname')({ rtmail: rtmailStub,
    mailIn: {}, mailBijlage: {}, mailAuth: null, werkmail: null, findSupplier: null, team: null });

  assert.equal(mailAanname.kentAdres('klant@gmail.com'), null,
    'een gmail-adres is niet van ons, ook al ligt er een logregel op');
  assert.equal(mailAanname.kentAdres('wie-dan-ook@ergens.example'), null);
});

/* ================= tegen een echte server, over een socket ================ */
let BASE, child, lidAdres;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-smtpin-'));
const SMTP_POORT = 3300 + (process.pid % 300);

const post = async (pad, body, tok) => {
  const h = { 'Content-Type': 'application/json' };
  if (tok) h.Authorization = 'Bearer ' + tok;
  const r = await fetch(BASE + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return r.json().catch(() => ({}));
};

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '',
    MAIL_IN_POORT: String(SMTP_POORT), MAIL_IN_HOST: '127.0.0.1' } }));
  const reg = await post('/api/auth/register', { name: 'Smtp Lid', email: 'smtp@x.nl',
    phone: '0612345663', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  lidAdres = (await post('/api/member/rtmail/adres', {}, reg.token)).adres;
  assert.ok(lidAdres, 'het lid heeft een postadres');
  BASE_TOKEN = reg.token;
});
let BASE_TOKEN;
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* Een echt SMTP-gesprek over een echte verbinding.

   DE LOKSTAP IS DE HELE TRUC HIER, en de eerste versie had hem fout: die stuurde
   de volgende regel zodra er iets binnenkwam dat op \r\n eindigde. Een
   EHLO-antwoord bestaat uit VIER regels en komt in meer dan een stuk binnen, dus
   liep alles een antwoord uit de pas -- de inhoud werd verstuurd voordat de
   server 354 had gezegd. De toets zakte daarop, en dat was terecht: hij zakte op
   de toets en niet op de server.

   Een antwoord is pas AF als er een regel komt met een SPATIE na de code; een
   streepje betekent "er volgt nog meer" (RFC 5321, 4.2.1). */
function smtp(regels) {
  return new Promise((res, rej) => {
    const sok = net.connect(SMTP_POORT, '127.0.0.1');
    let buf = '', uit = '', i = 0;
    const klaar = setTimeout(() => { sok.destroy(); rej(new Error('geen antwoord; kreeg: ' + uit)); }, 30000);
    sok.setEncoding('utf8');
    sok.on('data', (d) => {
      uit += d; buf += d;
      let j;
      while ((j = buf.indexOf('\r\n')) >= 0) {
        const regel = buf.slice(0, j);
        buf = buf.slice(j + 2);
        if (!/^\d{3} /.test(regel)) continue;      // nog niet af
        if (i < regels.length) { sok.write(regels[i++] + '\r\n'); continue; }
        clearTimeout(klaar); sok.end(); res(uit); return;
      }
    });
    sok.on('error', (e) => { clearTimeout(klaar); rej(e); });
  });
}

test('de poort luistert echt, en een bericht komt in het postvak van het lid', async () => {
  const uit = await smtp([
    'EHLO buiten.test',
    'MAIL FROM:<balie@buiten.test>',
    'RCPT TO:<' + lidAdres + '>',
    'DATA',
    ['From: Balie <balie@buiten.test>', 'To: ' + lidAdres, 'Subject: Over de lijn',
      '', 'Dit kwam over poort ' + SMTP_POORT + '.', '.'].join('\r\n'),
    'QUIT'
  ]);
  assert.match(uit, /^220 /, 'hij begroet: ' + uit.slice(0, 60));
  assert.match(uit, /250 Aangenomen/, uit);

  const vak = await post('/api/member/rtmail/inbox', {}, BASE_TOKEN);
  const m = (vak.berichten || []).find(x => x.onderwerp === 'Over de lijn');
  assert.ok(m, 'het bericht ligt in het postvak');
  assert.equal(m.van, 'balie@buiten.test');
  assert.equal(m.bron, 'extern', 'en het staat in de onbetrouwde baan');
  assert.equal(m.vertrouwd, false);
});

test('over die echte poort komt post voor een vreemde er niet doorheen', async () => {
  const uit = await smtp([
    'EHLO buiten.test',
    'MAIL FROM:<spam@buiten.test>',
    'RCPT TO:<iemand@ergens-anders.example>',
    'QUIT'
  ]);
  assert.match(uit, /550 /, 'geen doorstuurdienst voor vreemden: ' + uit);
});

test('zonder eigen mailsleutel biedt de poort toch STARTTLS aan -- die van de site', async () => {
  /* De terugval waar het om gaat. Zonder hem was versleuteld het geval waarin je
     twee EXTRA variabelen had gezet, en plat het geval waarin je niets deed --
     op een machine die allang een certificaat voor haar eigen site heeft. Op
     poort 25 is TLS opportunistisch: de verzendende kant pakt hem als hij wordt
     aangeboden. Een certificaat dat niet exact bij het mailadres hoort is daar
     dus nog altijd veel beter dan geen.

     Deze toets zet MAIL_IN_KEY/MAIL_IN_CERT NIET en alleen RTG_TLS_KEY/CERT, en
     kijkt of EHLO STARTTLS noemt. Dat is de enige plek waar je het van buiten
     kunt zien -- en het is ook precies wat een verzendende server afgaat. */
  const x509 = require('../server/lib/x509');
  const ss = x509.selfSigned({ names: ['localhost', '127.0.0.1'] });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-smtptls-'));
  const kPad = path.join(dir, 'site.key'), cPad = path.join(dir, 'site.crt');
  fs.writeFileSync(kPad, ss.keyPem); fs.writeFileSync(cPad, ss.certPem);

  const poort = SMTP_POORT + 1;
  const eigen = await startServer({ env: { RTG_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-smtptls-d-')),
    SMTP_URL: '', MAIL_IN_POORT: String(poort), MAIL_IN_HOST: '127.0.0.1',
    RTG_TLS_KEY: kPad, RTG_TLS_CERT: cPad } });
  try {
    const uit = await new Promise((res, rej) => {
      const sok = net.connect(poort, '127.0.0.1');
      let alles = '', buf = '', gestuurd = false;
      const klaar = setTimeout(() => { sok.destroy(); rej(new Error('geen antwoord; kreeg: ' + alles)); }, 20000);
      sok.setEncoding('utf8');
      sok.on('data', (d) => {
        alles += d; buf += d;
        let j;
        while ((j = buf.indexOf('\r\n')) >= 0) {
          const regel = buf.slice(0, j); buf = buf.slice(j + 2);
          if (!/^\d{3} /.test(regel)) continue;
          if (!gestuurd) { gestuurd = true; sok.write('EHLO buiten.test\r\n'); continue; }
          clearTimeout(klaar); sok.end(); res(alles); return;
        }
      });
      sok.on('error', (e) => { clearTimeout(klaar); rej(e); });
    });
    assert.match(uit, /STARTTLS/, 'de poort hoort STARTTLS aan te bieden op het cert van de site: ' + uit);
  } finally {
    if (eigen && eigen.child) try { eigen.child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
});

test('een adres in ONS EIGEN domein is nog geen postvak', async () => {
  /* Dit is de regel die de postberg voorkomt, en hij is scherper dan de vorige
     toets. Die weigert een VREEMD domein -- daar hoort iedereen het over eens te
     zijn. Hier gaat het om rtgpass.rtg zelf: het domein is van ons, maar dit
     linkerdeel is van niemand.

     Deze toets staat er omdat de mutatie die kern/mailaanname.js elk adres in
     onze eigen domeinen liet accepteren, AFSLOEG: de andere toetsen keken naar
     een vreemd domein of gebruikten een nep-aanname, dus niemand merkte het
     (regel 2 van de lat). Zonder deze regel ontstaat er een postvak zodra
     iemand een naam verzint, en groeit de database met post voor niemand. */
  const uit = await smtp([
    'EHLO buiten.test',
    'MAIL FROM:<spam@buiten.test>',
    'RCPT TO:<bestaatvastniet@rtgpass.rtg>',
    'QUIT'
  ]);
  assert.match(uit, /550 /, 'ook in ons eigen domein: geen postvak, geen post -- ' + uit);
});

test('de HTTP-buitenpoort weigert diezelfde onbekende ontvanger', async () => {
  /* EEN keten, twee deuren (kern/mailaanname.js). Deze toets is de tegenproef
     op die belofte: wat de SMTP-kant weigert, hoort de HTTP-kant ook te
     weigeren -- anders is de gedeelde keten een bewering en geen feit. */
  const bericht = ['From: Spam <spam@buiten.test>', 'To: bestaatvastniet@rtgpass.rtg',
    'Subject: Hoi', '', 'Tekst.', ''].join('\r\n');
  const r = await fetch(BASE + '/api/mail/binnen', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bericht }) });
  assert.equal(r.status, 404);
  assert.match((await r.json()).error, /bestaat hier niet/);

  // en aan een adres dat WEL bestaat komt hij gewoon aan
  const goed = ['From: Balie <balie@buiten.test>', 'To: ' + lidAdres,
    'Subject: Wel bekend', '', 'Tekst.', ''].join('\r\n');
  const ok = await fetch(BASE + '/api/mail/binnen', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bericht: goed }) });
  assert.equal(ok.status, 200);
});
