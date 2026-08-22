/* ============================================================================
   HET REGRESSIECORPUS VAN DE ZEEF.

   scripts/lib/geenlek.js bepaalt wat er WEL en NIET in klaartekst in een log
   belandt. Een fout de ene kant op lekt een wachtwoord; een fout de andere kant
   op maakt een keuring onbruikbaar ("een map ontbreekt" -- welke?) en dan wordt
   hij niet meer gedraaid. Beide kanten staan hieronder, en de tweede helft
   -- WAT ER MOET BLIJVEN STAAN -- is de helft die makkelijk sneuvelt.

   DE MUTATIE VOOR DIT BESTAND: haal het verbindingsreeks-patroon weg
   -> "een wachtwoord in een verbindingsreeks verdwijnt" zakt.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { maskerEmail, zonderGeheim } = require('../scripts/lib/geenlek');

test('een e-mailadres blijft herkenbaar en wordt niet leesbaar', () => {
  /* Genoeg om in een gesprek te bevestigen "ja, dat is mijn adres", te weinig
     om er post naartoe te sturen -- of om een codenaam mee terug te voeren naar
     een mens, en dat laatste is waar het ontwerp van dit huis om draait. */
  assert.equal(maskerEmail('roellie.i@gmail.com'), 'r***@g***.com');
  assert.equal(maskerEmail('a@b.nl'), 'a***@b***.nl');
  assert.ok(!/roellie|gmail/.test(maskerEmail('roellie.i@gmail.com')));
});

test('wat geen adres is, wordt niet half doorgelaten', () => {
  assert.equal(maskerEmail(''), '');
  assert.equal(maskerEmail(null), '');
  assert.equal(maskerEmail('geen adres'), '(adres)', 'bij twijfel niets tonen');
});

test('een wachtwoord in een verbindingsreeks verdwijnt, de rest blijft leesbaar', () => {
  /* Dit is het echte geval: golive.js stelt DATABASE_URL zelf samen uit het
     wachtwoordbestand, en een driverfout neemt die reeks nogal eens mee. */
  const uit = zonderGeheim('connect ECONNREFUSED postgresql://rtg:Zeer%24Geheim99@postgres:5432/rtg');
  assert.ok(!/Geheim99/.test(uit), 'het wachtwoord is weg: ' + uit);
  assert.match(uit, /postgresql:\/\/rtg:\*\*\*@postgres:5432\/rtg/,
    'en de rest staat er nog, anders is de fout niet te lezen');
  assert.match(uit, /ECONNREFUSED/, 'de eigenlijke fout blijft staan');
});

test('sleutels en tokens verdwijnen', () => {
  assert.ok(!/deadbeef/.test(zonderGeheim('sleutel a3f2deadbeefdeadbeefdeadbeefdead9911aa22')));
  assert.match(zonderGeheim('token=eyJhbGciOiJIUzI1NiJ9'), /token=\*\*\*/);
  assert.match(zonderGeheim('secret: hunter2'), /secret: \*\*\*/);
  assert.match(zonderGeheim('WACHTWOORD=Zeer$Geheim'), /WACHTWOORD=\*\*\*/i);
});

test('PADEN blijven staan -- dit is de helft die makkelijk sneuvelt', () => {
  /* Een keuring die niet meer zegt WELK pad ontbreekt, wordt niet gedraaid. Dat
     is geen theoretisch bezwaar: het is de reden dat "log gewoon minder" hier
     geen oplossing is. */
  const p = '/var/rtg/backups/off-site ontbreekt of is onleesbaar.';
  assert.equal(zonderGeheim(p), p);
});

test('hostnamen, poorten en bestandsrechten blijven staan', () => {
  const h = 'RTG_TLS_DOMAIN moet gelijk zijn aan de host uit APP_URL (app.rahultravelgroup.com).';
  assert.equal(zonderGeheim(h), h, 'een hostnaam is geen geheim');
  const m = '/run/secrets/rtg is te breed leesbaar (644); vereist 600.';
  assert.equal(zonderGeheim(m), m, 'rechten en paden zijn juist de informatie');
  assert.equal(zonderGeheim('poort 5432 antwoordt niet'), 'poort 5432 antwoordt niet');
});

test('een commit-hash van veertig tekens wordt wel gemaskeerd, en dat is geaccepteerd', () => {
  /* EERLIJK OVER DE PRIJS. Een hex-reeks van 32 of meer tekens is niet van een
     sleutel te onderscheiden, dus een commit-hash gaat er ook onder. Dat is de
     goede kant om fout te zitten -- maar het hoort te worden opgeschreven en
     niet ontdekt. Korte hashes (zeven tekens) blijven gewoon staan. */
  assert.match(zonderGeheim('commit 41560b44'), /41560b44/, 'een korte hash blijft');
  assert.doesNotMatch(zonderGeheim('commit 41560b4400112233445566778899aabbccddeeff'),
    /41560b4400/, 'een volledige hash niet');
});

test('de zeef is IDEMPOTENT en laat de spatie ervoor staan', () => {
  /* De zeef loopt twee keer over dezelfde tekst: bij de bron (maskerEmail) en
     bij het afdrukken (zonderGeheim als vangnet). Zonder deze eigenschap komt er
     "technische pagina:***@g***.com" uit -- zonder spatie en zonder de eerste
     letter, want het patroon at ze allebei op. Dat is precies wat er bij het
     bouwen van dit bestand gebeurde, en het viel alleen op doordat het script
     één keer echt is gedraaid. */
  const een = zonderGeheim('Eigenaar: ' + maskerEmail('roellie.i@gmail.com'));
  assert.equal(een, 'Eigenaar: r***@g***.com');
  assert.equal(zonderGeheim(een), een, 'nog een ronde verandert niets meer');
  assert.equal(zonderGeheim(zonderGeheim('mail naar roellie.i@gmail.com toe')),
    zonderGeheim('mail naar roellie.i@gmail.com toe'));
});

test('lege en niet-tekstuele invoer valt niet om', () => {
  assert.equal(zonderGeheim(null), '');
  assert.equal(zonderGeheim(undefined), '');
  assert.equal(zonderGeheim(42), '42');
  assert.equal(zonderGeheim(new Error('boem').message), 'boem');
});
