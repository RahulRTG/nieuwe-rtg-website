/* ============================================================================
   Wat er gebeurt NADAT een provider ons heeft overtuigd -- en dat is voor OIDC
   en SAML precies hetzelfde.

   Dit bestand bestaat om een reden die in LAT.md regel 4 staat: twee deuren die
   hetzelfde doen, lopen uiteen. De OIDC-terugkeer deed vijf dingen na een
   geslaagde controle (aanmelden, loggen, de identiteitsbrug, het
   overdrachtsbewijs, de terugreis), en de SAML-deur moet er precies dezelfde
   vijf doen. Ze twee keer schrijven betekent dat over een jaar de ene deur wel
   een groepenunie kent en de andere niet -- en dan hangt iemands rol af van
   welke knop hij heeft gebruikt.

   HET CLAIMCONTRACT IS DE GRENS. Wat hierboven binnenkomt is altijd dezelfde
   vorm: `{ sub, email, email_verified, name, groups }`. Wat een OIDC-token of
   een SAML-assertie daarvoor moest doen, is de zorg van de laag ervoor. Hier
   staat geen enkele `if (saml)`.
   ========================================================================== */
'use strict';
const sso = require('./index');
const scimGroepen = require('../scim/groepen');
const { log } = require('../log');

const OVERDRACHT = 'sso-overdracht';
const OVERDRACHT_MS = 60000;

/* De identiteitsbrug. Een fout hier laat de INLOG staan en wordt luid gelogd:
   dit gaat over de werkplek en niet over het account. Iemand buitensluiten uit
   zijn eigen RTG-omgeving omdat een journaalregel in een werkruimte niet wegkwam,
   is het verkeerde antwoord op het verkeerde probleem. Stil mag het nooit zijn --
   dan lopen rollen ongemerkt uit de pas met de provider. */
function brug(kern, k, user, claims) {
  try {
    if (!kern.tenant) return;
    /* DE TWEE BRONNEN VAN GROEPSLIDMAATSCHAP, SAMEN. De claim zegt wat de
       provider NU meestuurt; de SCIM-tabel wat hij ons eerder heeft geduwd.
       Alleen de claim lezen zou betekenen dat een inlog de rollen wist die via
       /Groups zijn gezet -- en dan is de nieuwe deur zijn eigen sloper. Alleen
       SCIM lezen zou een provider zonder /Groups buitensluiten. Dus de UNIE. */
    const uitScim = scimGroepen.groepenVan(k.org, user.id);
    const alle = [...new Set([].concat(Array.isArray(claims.groups) ? claims.groups : [], uitScim))];
    const uit = kern.tenant.brug.uitClaims(k.org, alle, 'user-' + user.id, claims.name);
    if (uit.ok && uit.werkruimtes.length) log.info('tenant.brug', { org: k.org, werkruimtes: uit.werkruimtes.length });
  } catch (e) {
    log.error('tenant.brug mislukt', { org: k.org, fout: e.message });
  }
}

/* Van gecontroleerde claims naar de terugreis naar de app. Gooit door als de
   aanmelding zelf niet mag (verkeerd domein, adres niet bevestigd); de
   aanroeper vertaalt dat naar een antwoord dat een buitenstaander niets
   verklapt over onze inrichting. */
async function binnen(kern, koppeling, claims, req, res, terug, soort) {
  const { accounts, logInlog } = kern;
  const { user, nieuw, gekoppeld } = await sso.aanmelden(accounts, koppeling, claims);

  /* Wat er WEL in het logboek komt: dat er is ingelogd, via welke koppeling, en
     of het een nieuw account was. Niet het e-mailadres, niet de naam -- het
     codenaam-ontwerp geldt ook voor onze eigen logregels. */
  log.info('sso.inlog', { org: koppeling.org, codenaam: user.codename, nieuw, gekoppeld, soort: soort || 'oidc' });
  if (typeof logInlog === 'function') logInlog('sso', true, koppeling.org, req);

  brug(kern, koppeling, user, claims);

  const bewijs = accounts.issueActionToken(user.id, OVERDRACHT, OVERDRACHT_MS);
  const pas = user.tier === 'lifestyle' || user.tier === 'business' ? user.tier : 'rtg';
  res.redirect(302, '/apps/app.html?pas=' + pas + '&sso=' + encodeURIComponent(bewijs) +
    '&terug=' + encodeURIComponent(terug || '/'));
  return user;
}

module.exports = { binnen, brug, OVERDRACHT, OVERDRACHT_MS };
