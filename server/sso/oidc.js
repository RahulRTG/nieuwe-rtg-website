/* ============================================================================
   De OIDC-dans zelf: heenreis, terugreis, en het token dat er uit komt.

   Drie stappen:
     1. ontdek()      -- vraag de provider waar zijn deuren zitten
     2. startAdres()  -- stuur de bezoeker naar zijn eigen provider
     3. wisselCode()  -- ruil de teruggekomen code om voor een ID-token

   We gebruiken de authorization code flow MET PKCE. Niet de impliciete flow:
   die zet tokens in de URL, en een URL belandt in browsergeschiedenis, in de
   Referer-kop en in access logs. PKCE erbij, ook al hebben we een client-geheim:
   het geheim beschermt tegen een vreemde CLIENT, PKCE beschermt tegen een
   onderschepte CODE. Dat zijn twee verschillende aanvallen.

   De discovery wordt onthouden (providers wijzigen dit zelden en het is een
   extra rondje bij elke inlog), maar de sleutelbos heeft zijn eigen kast met
   eigen regels -- zie jwks.js.
   ========================================================================== */
'use strict';
const { haalJson, postForm } = require('./haal');
const jwks = require('./jwks');
const jwt = require('./jwt');

const ONTDEK_HOUDBAAR_MS = 3600000;
const ontdekt = new Map(); // issuer -> { doc, gehaald }

/* De provider vertelt zelf waar zijn endpoints staan (RFC 8414 / OIDC
   Discovery). We nemen dat over MAAR controleren de issuer: een document dat
   een andere issuer noemt dan het adres waar we het vandaan halen, is precies
   hoe je een provider laat wijzen naar de deuren van een aanvaller. */
async function ontdek(issuer, ophaler) {
  const basis = String(issuer).replace(/\/+$/, '');
  const nu = Date.now();
  const staat = ontdekt.get(basis);
  if (staat && nu - staat.gehaald < ONTDEK_HOUDBAAR_MS) return staat.doc;

  const doc = await (ophaler || haalJson)(basis + '/.well-known/openid-configuration');
  if (!doc || typeof doc !== 'object') throw new Error('De provider gaf geen bruikbaar discovery-document.');
  if (String(doc.issuer || '').replace(/\/+$/, '') !== basis)
    throw new Error('Het discovery-document noemt een andere issuer dan het adres waar het vandaan komt.');
  for (const veld of ['authorization_endpoint', 'token_endpoint', 'jwks_uri'])
    if (!doc[veld]) throw new Error('Het discovery-document mist ' + veld + '.');
  ontdekt.set(basis, { doc, gehaald: nu });
  return doc;
}

/* Stap 2: het adres waar we de bezoeker heen sturen. */
function startAdres(doc, { clientId, redirectUri, state, nonce, challenge, hint }) {
  const u = new URL(doc.authorization_endpoint);
  const p = u.searchParams;
  p.set('response_type', 'code');
  p.set('client_id', clientId);
  p.set('redirect_uri', redirectUri);
  p.set('scope', 'openid email profile');
  p.set('state', state);
  p.set('nonce', nonce);
  p.set('code_challenge', challenge);
  p.set('code_challenge_method', 'S256');
  // Alleen een hint: de provider mag hem negeren, en wij geloven straks
  // uitsluitend wat er in het ondertekende token staat -- niet dit.
  if (hint) p.set('login_hint', hint);
  return u.toString();
}

/* Stap 3: de code omruilen, en het ID-token controleren.

   De code komt via de BROWSER van de bezoeker binnen; die is dus niet te
   vertrouwen. De tokenwissel gaat rechtstreeks server-naar-server, en pas het
   ondertekende ID-token dat daaruit komt geloven we -- en ook dat pas nadat
   jwt.verifieer() er zijn hele lijst overheen heeft gehad. */
async function wisselCode(doc, { clientId, clientSecret, redirectUri, code, verifier }, gereedschap) {
  const g = gereedschap || {};
  const post = g.postForm || postForm;
  const bos = (g.bos || jwks.maakBos(g.haalJson));

  const velden = {
    grant_type: 'authorization_code',
    code: String(code),
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: String(verifier)
  };
  const opties = {};
  // client_secret_basic waar het kan; sommige providers accepteren alleen die.
  if (clientSecret) opties.basic = clientId + ':' + clientSecret;

  const antwoord = await post(doc.token_endpoint, velden, opties);
  if (!antwoord || !antwoord.id_token) throw new Error('De provider gaf geen id_token terug.');

  const eisen = { iss: doc.issuer, aud: clientId, nonce: g.nonce };
  let claims;
  try {
    claims = jwt.verifieer(antwoord.id_token, await bos.bos(doc.jwks_uri), eisen);
  } catch (e) {
    /* Een onbekende kid kan een verse sleutel zijn. Een keer opnieuw proberen
       met een verversde bos -- de rem daarop zit in jwks.js. */
    if (!e.onbekendeKid) throw e;
    claims = jwt.verifieer(antwoord.id_token, await bos.ververs(doc.jwks_uri), eisen);
  }
  return { claims, tokens: antwoord };
}

function leegOntdek(issuer) { if (issuer) ontdekt.delete(String(issuer).replace(/\/+$/, '')); else ontdekt.clear(); }

module.exports = { ontdek, startAdres, wisselCode, leegOntdek, ONTDEK_HOUDBAAR_MS };
