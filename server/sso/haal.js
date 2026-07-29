/* ============================================================================
   JSON ophalen bij een identiteitsprovider. Klein met opzet: dit is de enige
   plek waar de server op verzoek van een INSTELLING een adres aanroept, en dat
   is precies het soort deur waar een SSRF doorheen komt.

   Wat hier dichtstaat:

   - ALLEEN https. Een IdP-koppeling over http betekent dat wie tussen de servers
     zit de sleutelbos mag vervangen, en dan verifieren we tokens tegen de
     sleutel van de aanvaller. Dat is erger dan geen verificatie, want het ziet
     eruit alsof het klopt.
   - GEEN INTERNE ADRESSEN. Een issuer die naar 169.254.169.254 (de metadata-
     dienst van vrijwel elke cloud) of naar 10.x wijst, laat de server zijn eigen
     netwerk uitlezen en het antwoord teruggeven. De koppelingen worden alleen
     door de eigenaar gezet, dus dit is een tweede slot -- maar het tweede slot
     is juist het slot dat helpt als het eerste een keer openstaat.
   - EEN GROOTTELIMIET. Zonder limiet is een provider die eindeloos blijft
     sturen genoeg om het geheugen vol te laten lopen.
   - EEN TIJDSLIMIET. Een provider die de verbinding openhoudt zonder te
     antwoorden, houdt anders een inlogpoging (en een verbinding) vast.

   De omleiding volgen we NIET. Een 302 naar een intern adres is precies hoe je
   de controle hierboven omzeilt; een IdP die zijn discovery achter een omleiding
   zet, moet het echte adres in de koppeling zetten.
   ========================================================================== */
'use strict';
const https = require('https');
const { URL } = require('url');

const MAX_BYTES = 512 * 1024;
const TIJDSLIMIET_MS = 8000;

/* Dezelfde vorm als de proxy-controle in web/verrijk.js: alles wat niet op het
   open internet hoort. Ook de IPv6-vormen, want ::ffff:10.0.0.1 is 10.0.0.1. */
const INTERN = /^(::1|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|::ffff:(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)|f[cd])/i;

function keurUrl(adres) {
  let u;
  try { u = new URL(String(adres)); } catch (e) { throw new Error('Geen geldig adres: ' + adres); }
  if (u.protocol !== 'https:') throw new Error('Een identiteitsprovider moet over https bereikbaar zijn (' + u.protocol + ' geweigerd).');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || INTERN.test(host))
    throw new Error('Dit adres wijst naar het interne netwerk; een identiteitsprovider hoort op het open internet te staan.');
  return u;
}

/* De echte ophaler. Apart gehouden zodat tests er een eigen functie voor in de
   plaats kunnen zetten zonder een netwerk nodig te hebben. */
function haalJson(adres) {
  const u = keurUrl(adres);
  return new Promise((klaar, mis) => {
    const verzoek = https.get(u, { timeout: TIJDSLIMIET_MS, headers: { accept: 'application/json' } }, (res) => {
      /* Een omleiding volgen we bewust niet (zie de kop). */
      if (res.statusCode >= 300 && res.statusCode < 400) {
        res.resume();
        return mis(new Error('De provider stuurt een omleiding (' + res.statusCode + '); zet het uiteindelijke adres in de koppeling.'));
      }
      if (res.statusCode !== 200) { res.resume(); return mis(new Error('De provider antwoordde met status ' + res.statusCode + '.')); }
      let lengte = 0; const stukken = [];
      res.on('data', (d) => {
        lengte += d.length;
        if (lengte > MAX_BYTES) { verzoek.destroy(); return mis(new Error('Het antwoord van de provider is groter dan ' + MAX_BYTES + ' bytes.')); }
        stukken.push(d);
      });
      res.on('end', () => {
        try { klaar(JSON.parse(Buffer.concat(stukken).toString('utf8'))); }
        catch (e) { mis(new Error('De provider stuurde geen geldige JSON.')); }
      });
    });
    verzoek.on('timeout', () => { verzoek.destroy(); mis(new Error('De provider antwoordde niet binnen ' + TIJDSLIMIET_MS + ' ms.')); });
    verzoek.on('error', (e) => mis(new Error('De provider is niet bereikbaar: ' + e.message)));
  });
}

/* De tokenwissel is een POST met een formulier-body. Zelfde sloten als hierboven;
   de basicAuth-variant bestaat omdat een deel van de providers het client-geheim
   liever in de Authorization-kop ziet dan in de body (OIDC laat allebei toe).

   Het geheim staat bewust NIET in de query maar in de body of de kop: een
   querystring belandt in access logs, en dan ligt ons wachtwoord bij de
   provider op schijf bij iedereen die de log mag lezen. */
function postForm(adres, velden, opties) {
  const u = keurUrl(adres);
  const o = opties || {};
  const body = new URLSearchParams(velden).toString();
  const headers = {
    'content-type': 'application/x-www-form-urlencoded',
    'content-length': Buffer.byteLength(body),
    accept: 'application/json'
  };
  if (o.basic) headers.authorization = 'Basic ' + Buffer.from(o.basic).toString('base64');
  return new Promise((klaar, mis) => {
    const verzoek = https.request(u, { method: 'POST', timeout: TIJDSLIMIET_MS, headers }, (res) => {
      let lengte = 0; const stukken = [];
      res.on('data', (d) => {
        lengte += d.length;
        if (lengte > MAX_BYTES) { verzoek.destroy(); return mis(new Error('Het antwoord van de provider is te groot.')); }
        stukken.push(d);
      });
      res.on('end', () => {
        const tekst = Buffer.concat(stukken).toString('utf8');
        let json = null;
        try { json = JSON.parse(tekst); } catch (e) { /* hieronder afgehandeld */ }
        if (res.statusCode !== 200) {
          /* De foutmelding van de provider mag terug, maar alleen de velden die
             het protocol daarvoor kent -- niet de rest van het antwoord, want
             daar kan van alles in staan wat wij niet horen door te geven. */
          const kort = json && json.error ? json.error + (json.error_description ? ': ' + json.error_description : '') : 'status ' + res.statusCode;
          return mis(new Error('De provider wees de tokenwissel af (' + kort + ').'));
        }
        if (!json) return mis(new Error('De provider stuurde geen geldige JSON bij de tokenwissel.'));
        klaar(json);
      });
    });
    verzoek.on('timeout', () => { verzoek.destroy(); mis(new Error('De provider antwoordde niet binnen ' + TIJDSLIMIET_MS + ' ms.')); });
    verzoek.on('error', (e) => mis(new Error('De provider is niet bereikbaar: ' + e.message)));
    verzoek.end(body);
  });
}

module.exports = { haalJson, postForm, keurUrl, MAX_BYTES, TIJDSLIMIET_MS };
