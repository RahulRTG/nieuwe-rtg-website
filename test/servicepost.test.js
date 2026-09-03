/* RTMAIL ALS INGANG VAN RTG SERVICE -- en de twee dingen die daar mis kunnen gaan.

   Het besluit van de eigenaar was: de melder wordt teruggevonden via de
   IDENTITEITSKLUIS. Deze toetsen leggen vast wat die keuze kost en waar zij
   ophoudt.

   1. EEN VERVALSTE AFZENDER OPENT NIETS. `From:` is door iedereen te typen. Wie
      daarop vertrouwt, opent een zaak op naam van een ANDER lid -- en die zaak
      verschijnt daarna in de app van dat lid, met de tekst van een vreemde erin.
      Zonder een geslaagde DKIM of DMARC wordt de kluis dus niet eens bevraagd.
   2. EEN ONBEKEND ADRES OPENT NIETS, en dat is geen strengheid maar een
      ondergrens: zonder melder kan niemand deze melding beantwoorden.
   3. Een bevestigde afzender die wel bekend is, levert een zaak met kanaal
      `mail`, en het BERICHT gaat mee als verwijzing en nooit als inhoud.
   4. In de kluis KIJKEN laat een spoor na. Bij een adres dat wij niet kennen is
      er niemand om een regel over te schrijven; bij een treffer moet hij er
      staan, ook als de zaak daarna zou stranden.
   5. Het adres `hulp@` bestaat vanaf de eerste dag: de eerste melder krijgt geen
      bounce omdat wij nog niets van hem hadden.

   Wat deze toetsen NIET doen is een echt ondertekend bericht door de hele
   buitenpoort sturen: daarvoor zou de proef DKIM moeten kunnen ondertekenen. De
   keten tot en met de weigering is wel echt (punt 5), de rest staat op
   moduleniveau.
   Draai: node --test test/servicepost.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

const GESLAAGD = { dkim: 'geslaagd', spf: 'niet gemeld', dmarc: 'niet gemeld' };

/* Een kluis van een regel. De echte staat in server/accounts/; wat deze module
   ervan gebruikt is precies een functie, en die grens is het punt. */
function maakLaag({ kent = {}, journaal = [] } = {}) {
  const crypto = require('crypto');
  const db = { data: {} };
  const save = () => {};
  const zaken = require('../server/kern/service/zaak')({ db, save, crypto });
  const loop = require('../server/kern/service/loop')({ zaken, save });
  const post = require('../server/kern/service/post')({
    zaken, loop,
    accounts: { findByLogin: (a) => kent[String(a).toLowerCase()] || null },
    inzagelog: { noteer: (r) => journaal.push(r) }
  });
  return { post, zaken, journaal };
}

test('een vervalste afzender opent geen zaak, en de kluis wordt niet eens bevraagd', () => {
  const journaal = [];
  const { post, zaken } = maakLaag({
    kent: { 'lid@buiten.test': { id: 7, codename: 'Zilverreiger' } }, journaal });

  const r = post.ontvang({ van: 'lid@buiten.test', onderwerp: 'Mijn boeking',
    tekst: 'Er ging iets mis', controles: { dkim: 'GEZAKT', dmarc: 'GEZAKT', spf: 'geslaagd' } });

  assert.equal(r.geweigerd, 'afzender', JSON.stringify(r));
  assert.match(r.error, /iemand anders/i, 'de weigering legt het gevaar niet uit');
  assert.equal(zaken.lijst({ max: 10 }).length, 0, 'er ontstond een zaak op een vervalste afzender');
  assert.equal(journaal.length, 0, 'de kluis werd bevraagd op een afzender die niet bevestigd is');
});

test('SPF alleen is niet genoeg: die spreekt over de envelop en niet over de From', () => {
  const { post } = maakLaag({ kent: { 'lid@buiten.test': { id: 7, codename: 'Zilverreiger' } } });
  const r = post.ontvang({ van: 'lid@buiten.test', onderwerp: 'Mijn boeking',
    controles: { spf: 'geslaagd', dkim: 'niet gemeld', dmarc: 'niet gemeld' } });
  assert.equal(r.geweigerd, 'afzender', JSON.stringify(r));
});

test('een onbekend adres opent geen zaak, en er valt niets te journaliseren', () => {
  const journaal = [];
  const { post, zaken } = maakLaag({ journaal });
  const r = post.ontvang({ van: 'vreemde@buiten.test', onderwerp: 'Hallo', controles: GESLAAGD });
  assert.equal(r.geweigerd, 'onbekend', JSON.stringify(r));
  assert.equal(zaken.lijst({ max: 10 }).length, 0);
  /* Geen treffer, dus ook geen regel OVER iemand -- er is niemand om over te
     schrijven. Dat is iets anders dan een gemiste regel: bij een treffer moet
     hij er wel staan, en dat is de volgende toets. */
  assert.equal(journaal.length, 0);
  assert.match(r.error, /in de app/i, 'de weigering wijst geen weg die wel werkt');
});

test('een bevestigde, bekende afzender krijgt een zaak op kanaal mail', () => {
  const journaal = [];
  const { post, zaken, journaal: j } = maakLaag({
    kent: { 'lid@buiten.test': { id: 7, codename: 'Zilverreiger' } }, journaal });

  const r = post.ontvang({ van: 'LID@Buiten.test', onderwerp: 'Mijn uitbetaling ontbreekt',
    tekst: 'Sinds vrijdag staat hij op pending.', controles: GESLAAGD, bericht: 'MSG-1' });

  assert.ok(r.zaak, JSON.stringify(r));
  assert.equal(r.zaak.kanaal, 'mail');
  const z = zaken.dossier(r.zaak.id).zaak;
  assert.equal(z.melder, 'Zilverreiger', 'de melder is geen codenaam maar: ' + z.melder);

  /* HET BERICHT IS EEN VERWIJZING EN NOOIT DE INHOUD. Soort plus code, en al het
     andere gooit zaak.js weg -- de grens uit par. 2 van SERVICE.md. */
  assert.deepEqual(z.betrokken, { soort: 'bericht', code: 'MSG-1' });

  /* En de kluisvraag liet een spoor na, met een reden die een mens kan lezen. */
  assert.equal(j.length, 1, 'in de kluis gekeken zonder journaalregel');
  assert.equal(j[0].over.codenaam, 'Zilverreiger');
  assert.match(j[0].waarom, /servicepostvak/i);
  assert.equal(j[0].bron, 'service/post');
});

test('het adres hulp@ bestaat vanaf de eerste dag en levert geen bounce', async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  try {
    const adres = require('../server/kern/rtmail-adres');
    const hulp = 'hulp@' + adres.domeinVoor('kantoor');

    /* `hulp` staat op de gereserveerde lijst: zonder die regel zou de eerste
       medewerker die zo heet dit adres als persoonlijk postvak krijgen -- of
       erger, de meldingen opslokken die voor de wachtrij bedoeld waren. */
    assert.ok(adres.GERESERVEERD.includes('hulp'), 'het serviceadres is niet gereserveerd');

    const ruw = ['From: Klant <klant@buiten.test>', 'To: ' + hulp,
      'Subject: Ik kom niet in mijn account', '', 'Sinds vanmorgen lukt inloggen niet.'].join('\r\n');
    const r = await fetch(srv.base + '/api/mail/binnen', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bericht: ruw, ip: '203.0.113.9' }) });
    const b = await r.json();

    /* AANGENOMEN, want het adres bestaat: geen 404. En er ontstond GEEN zaak,
       want deze afzender is niet bevestigd -- met de reden erbij in plaats van
       stil. Post die verdwijnt is erger dan post die geweigerd wordt. */
    assert.equal(r.status, 200, JSON.stringify(b).slice(0, 200));
    assert.ok(b.zaak, 'de mailkant meldt niets over de zaak: ' + JSON.stringify(b).slice(0, 200));
    assert.equal(b.zaak.geen, true, 'er ontstond een zaak op een onbevestigde afzender');
    assert.match(String(b.zaak.waarom), /bevestigd/i);
  } finally { await stop(srv); }
});
