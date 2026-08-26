/* SNI ALLEEN BIJ EEN NAAM.

   WAAROM DEZE TOETS BESTAAT, en dat is de les. test/smtp.test.js was hier altijd
   groen en in CI altijd rood, met:

     TypeError [ERR_INVALID_ARG_VALUE]: The property 'options.servername'
     Setting the TLS ServerName to an IP address is not permitted

   Geen omgevingsgril maar een NODE-VERSIE: 24 (deze machine) waarschuwt er
   alleen over -- DEP0123, "this will be ignored in a future version" -- en 26
   (de werkstroom) weigert hard. Een deprecatiewaarschuwing die niemand leest is
   een toekomstige storing met een datum erop.

   Daarom toetst dit bestand de REGEL en niet het gedrag van tls.connect: zo bijt
   hij op elke Node-versie, ook op de versie die het nog toestaat. Wie de
   IP-controle uit server/lib/sni.js haalt, laat deze toets zakken -- en dat is
   nagemeten, niet aangenomen.

   Draai los: node --test test/sni.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { sniVan, isIpAdres } = require('../server/lib/sni');

test('een IP-adres levert GEEN servername op', () => {
  for (const ip of ['127.0.0.1', '10.0.0.1', '192.168.178.206', '255.255.255.255']) {
    assert.deepEqual(sniVan(ip), {}, ip + ' is een IP en hoort geen SNI te krijgen');
    assert.equal(isIpAdres(ip), true, ip);
  }
});

test('IPv6 ook niet, en die kan sowieso geen SNI-naam zijn', () => {
  for (const ip of ['::1', '2001:db8::1', 'fe80::1%lo0']) {
    assert.deepEqual(sniVan(ip), {}, ip + ' is IPv6');
    assert.equal(isIpAdres(ip), true, ip);
  }
});

test('een NAAM krijgt hem wel, want zonder SNI klopt het certificaat niet', () => {
  for (const naam of ['mail.rahultravelgroup.com', 'smtp.example.org', 'localhost']) {
    assert.deepEqual(sniVan(naam), { servername: naam }, naam + ' is een naam');
    assert.equal(isIpAdres(naam), false, naam);
  }
});

test('leeg of onzin levert nooit een kapotte optie op', () => {
  /* Een lege host is geen IP en geen naam. Hij mag geen uitzondering geven en
     ook geen `servername: undefined` -- dat laatste is precies het soort veld
     dat een TLS-stack anders behandelt dan een ontbrekend veld. */
  assert.deepEqual(sniVan(''), { servername: '' });
  assert.deepEqual(sniVan(null), { servername: '' });
  assert.deepEqual(sniVan(undefined), { servername: '' });
});

test('de drie clients gebruiken ALLEMAAL deze ene regel', () => {
  /* De regel stond in smtp-direct.js en nergens anders; smtp.js en redis.js
     zetten de servername onvoorwaardelijk. Een regel die op een plek klopt en op
     twee andere niet, is geen regel maar een gelukje. Deze bewering zakt zodra
     iemand er weer eentje los neerzet. */
  const fs = require('fs');
  const path = require('path');
  const wortel = path.join(__dirname, '..', 'server');
  const los = [];
  for (const naam of ['smtp.js', 'smtp-direct.js', 'redis.js']) {
    const bron = fs.readFileSync(path.join(wortel, naam), 'utf8');
    if (!bron.includes("require('./lib/sni')")) los.push(naam + ' haalt de regel niet op');
    for (const regel of bron.split('\n')) {
      if (/servername:/.test(regel) && !/sniVan|lib\/sni/.test(regel)) los.push(naam + ': ' + regel.trim().slice(0, 70));
    }
  }
  assert.deepEqual(los, [], 'deze plekken zetten een servername buiten server/lib/sni.js om');
});
