/* ============================================================================
   De `state` van een inlogpoging: versleuteld meegegeven, niet onthouden.

   Tussen "wij sturen de bezoeker naar zijn provider" en "de provider stuurt hem
   terug met een code" moeten we drie dingen onthouden:

     - welke koppeling het was (anders wisselt een aanvaller de code in bij een
       ANDERE provider);
     - de nonce (die koppelt het straks binnenkomende token aan DEZE poging);
     - de PKCE-verifier (die bewijst dat wij degene zijn die de poging startte).

   De voor de hand liggende oplossing is een Map op de server. Die valt hier af:
   met meerdere instances achter een load balancer komt de terugkeer vaak op een
   ANDERE instance binnen dan waar de poging begon, en dan is de poging weg.

   Dus doen we het zoals de sessietokens: alles gaat versleuteld en ondertekend
   mee in de state-parameter zelf. De bezoeker draagt hem, maar kan hem niet
   lezen (AES-256-GCM met de kluissleutel) en niet wijzigen (GCM merkt elke
   verandering). Vervalt na TTL_MS, want een inlogpoging die een uur later
   terugkomt is geen inlogpoging meer.

   WAAROM DE VERIFIER MEE MAG. Bij PKCE hoort de verifier geheim te blijven voor
   de bezoeker. Hier is de "client" onze server, en de bezoeker krijgt hem
   VERSLEUTELD mee -- hij ziet cijferruis. Alleen wij kunnen hem uitpakken, dus
   de eigenschap blijft overeind. Zonder versleuteling zou dit PKCE waardeloos
   maken, en daarom staat het hier expliciet.
   ========================================================================== */
'use strict';
const crypto = require('crypto');
const kluis = require('../accounts/kluis');

const TTL_MS = 600000; // tien minuten: ruim voor een inlogscherm, kort voor een aanvaller

/* De PKCE-verifier en zijn challenge (RFC 7636, S256). */
function maakVerifier() { return crypto.randomBytes(32).toString('base64url'); }
function challengeVan(verifier) {
  return crypto.createHash('sha256').update(String(verifier)).digest('base64url');
}
function maakNonce() { return crypto.randomBytes(16).toString('base64url'); }

/* Waar mag de bezoeker na afloop heen? Alleen een pad op onze eigen site.
   Een volledige URL zou dit een open redirect maken: dan stuurt "log in bij
   RTG" iemand na een geslaagde inlog door naar een site van een ander, met de
   herkenbaarheid van ons domein eromheen. Klassiek phishing-hulpmiddel. */
function veiligTerug(pad) {
  const p = String(pad || '');
  if (!p.startsWith('/') || p.startsWith('//') || p.includes('\\')) return '/';
  return p.slice(0, 300);
}

function inpakken({ org, nonce, verifier, terug }) {
  const inhoud = JSON.stringify({
    org: String(org), nonce: String(nonce), verifier: String(verifier),
    terug: veiligTerug(terug), tot: Date.now() + TTL_MS
  });
  /* kluis.enc geeft base64; de state gaat door een URL heen, dus base64url. */
  return Buffer.from(kluis.enc(inhoud), 'base64').toString('base64url');
}

function uitpakken(state) {
  let ruw;
  try { ruw = kluis.dec(Buffer.from(String(state || ''), 'base64url').toString('base64')); }
  catch (e) { return null; }
  if (!ruw) return null; // verkeerde sleutel of geknoeid: GCM heeft het gemerkt
  let o;
  try { o = JSON.parse(ruw); } catch (e) { return null; }
  if (!o || typeof o !== 'object') return null;
  if (!o.tot || Number(o.tot) < Date.now()) return null; // verlopen poging
  if (!o.org || !o.nonce || !o.verifier) return null;
  o.terug = veiligTerug(o.terug);
  return o;
}

module.exports = { maakVerifier, challengeVan, maakNonce, inpakken, uitpakken, veiligTerug, TTL_MS };
