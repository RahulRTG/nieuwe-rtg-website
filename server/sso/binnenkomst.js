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
const eigenaar = require('../eigenaar');
const { log } = require('../log');

const OVERDRACHT = 'sso-overdracht';
const OVERDRACHT_MS = 60000;

/* Een herkenbare tijdelijke fout voor beide vervoerlagen (OIDC en SAML). De
   binnenkant staat in het log, de browser krijgt alleen te horen dat er GEEN
   sessie is geopend en dat opnieuw proberen veilig is. */
function werkSyncFout(org, oorzaak) {
  const detail = oorzaak && oorzaak.message ? oorzaak.message
    : (oorzaak && oorzaak.reden ? oorzaak.reden : String(oorzaak || 'onbekende fout'));
  log.error('tenant.brug mislukt', { org, fout: detail });
  const e = new Error('De zakelijke groepssync kon niet veilig worden bevestigd.');
  e.status = 503;
  e.code = 'SSO_WERKSYNC';
  return e;
}

function foutAntwoord(e) {
  if (e && e.code === 'SSO_WERKSYNC') {
    return {
      status: 503,
      retryAfter: '30',
      bericht: 'Uw zakelijke toegang kon niet veilig worden bijgewerkt. Er is geen sessie geopend; probeer het over een moment opnieuw.'
    };
  }
  return { status: 401, retryAfter: null, bericht: 'Inloggen via uw organisatie is niet gelukt.' };
}

/* Een organisatie zonder tenant mag alleen als gewone RTG-inlog eindigen als
   dat account aantoonbaar geen Werk OS-deur open heeft. De accounttoken is
   namelijk niet tot een wereld beperkt: /api/bedrijf/mijn kan er elk actief
   lid-token mee ophalen. Ontbrekende opslagcontext is daarom geen lege lijst
   maar onbekend, en onbekend blijft dicht. Ook de platformeigenaar is niet
   gescheiden: diens eerste aanroep maakt juist automatisch een werkruimte. */
function persoonlijkGescheiden(kern, user) {
  if (!kern || !kern.db || !kern.db.data || !user || user.id == null) {
    return { ok: false, reden: 'Werk OS-koppelingen konden niet veilig worden vastgesteld' };
  }
  try {
    if (eigenaar.isEigenaar(kern.accounts, user)) {
      return { ok: false, reden: 'platformeigenaar krijgt automatisch Werk OS-toegang' };
    }
  } catch (e) {
    return { ok: false, reden: 'eigenaarsrol kon niet veilig worden vastgesteld' };
  }

  const key = 'user-' + user.id;
  for (const w of Object.values(kern.db.data.werkruimtes || {})) {
    for (const l of Object.values(w && w.leden || {})) {
      if (l && l.rtgKey === key && l.status === 'actief') {
        return { ok: false, reden: 'actieve Werk OS-koppeling buiten een synchroniseerbare tenant' };
      }
    }
  }
  return { ok: true };
}

/* DE IDENTITEITSBRUG IS ONDERDEEL VAN DE ZAKELIJKE AUTHENTICATIE.

   Een RTG-account en een Werk OS-lidmaatschap zijn twee identiteiten, maar een
   gewone RTG-sessie kan via /api/bedrijf/mijn de lid-tokens van de tweede
   ophalen. Daarom is "persoonlijke inlog wel, groepssync niet" hier GEEN veilige
   scheiding. Bij een gebonden tenant ontstaat pas een overdrachtsbewijs nadat
   de rollen opnieuw zijn vastgesteld. Faalt dat, dan ontstaat helemaal geen
   sessie. Een org zonder tenant is alleen anders wanneer een afzonderlijke
   controle bewijst dat dit account nergens actieve Werk OS-toegang heeft. */
function brug(kern, k, user, claims) {
  const tenant = kern && kern.tenant;
  if (!tenant || !tenant.register || typeof tenant.register.haal !== 'function') {
    throw werkSyncFout(k && k.org, new Error('tenantregister niet beschikbaar'));
  }

  let gebonden;
  try {
    gebonden = tenant.register.haal(k.org);
  } catch (e) {
    throw werkSyncFout(k.org, e);
  }
  if (!gebonden) {
    const scheiding = persoonlijkGescheiden(kern, user);
    if (!scheiding.ok) throw werkSyncFout(k.org, scheiding);
    return { ok: true, werkruimtes: [], nietVanToepassing: 'persoonlijk-zonder-werktoegang' };
  }
  if (!tenant.brug || typeof tenant.brug.uitClaims !== 'function') {
    throw werkSyncFout(k.org, new Error('tenantbrug niet beschikbaar'));
  }

  try {
    /* DE TWEE BRONNEN VAN GROEPSLIDMAATSCHAP, SAMEN. De claim zegt wat de
       provider NU meestuurt; de SCIM-tabel wat hij ons eerder heeft geduwd.
       Alleen de claim lezen zou betekenen dat een inlog de rollen wist die via
       /Groups zijn gezet -- en dan is de nieuwe deur zijn eigen sloper. Alleen
       SCIM lezen zou een provider zonder /Groups buitensluiten. Dus de UNIE. */
    const uitScim = scimGroepen.groepenVan(k.org, user.id);
    const alle = [...new Set([].concat(Array.isArray(claims.groups) ? claims.groups : [], uitScim))];
    const uit = tenant.brug.uitClaims(k.org, alle, 'user-' + user.id, claims.name);
    if (!uit || uit.ok !== true || !Array.isArray(uit.werkruimtes)) {
      throw werkSyncFout(k.org, uit || new Error('tenantbrug gaf geen bevestiging'));
    }
    /* Een eerdere /Groups-503 kan dit account in de blijvende herstelrij hebben
       gezet. Deze geslaagde SSO-sync heeft exact dezelfde actuele groepen
       verwerkt en mag die rij daarom afronden. */
    scimGroepen.syncKlaar(k.org, user.id);
    if (uit.ok && uit.werkruimtes.length) log.info('tenant.brug', { org: k.org, werkruimtes: uit.werkruimtes.length });
    return uit;
  } catch (e) {
    if (e && e.code === 'SSO_WERKSYNC') throw e;
    throw werkSyncFout(k.org, e);
  }
}

/* Van gecontroleerde claims naar de terugreis naar de app. Gooit door als de
   aanmelding zelf niet mag (verkeerd domein, adres niet bevestigd); de
   aanroeper vertaalt dat naar een antwoord dat een buitenstaander niets
   verklapt over onze inrichting. */
async function binnen(kern, koppeling, claims, req, res, terug, soort) {
  const { accounts, logInlog } = kern;
  const { user, nieuw, gekoppeld } = await sso.aanmelden(accounts, koppeling, claims);

  /* Eerst de rollen vaststellen, PAS DAN zeggen dat de inlog gelukt is en een
     overdrachtsbewijs maken. Anders schrijft een storing zowel "gelukt" als
     "mislukt" en, erger, heeft de browser het bewijs al in handen. */
  brug(kern, koppeling, user, claims);

  /* Wat er WEL in het logboek komt: dat er is ingelogd, via welke koppeling, en
     of het een nieuw account was. Niet het e-mailadres, niet de naam -- het
     codenaam-ontwerp geldt ook voor onze eigen logregels. */
  log.info('sso.inlog', { org: koppeling.org, codenaam: user.codename, nieuw, gekoppeld, soort: soort || 'oidc' });
  if (typeof logInlog === 'function') logInlog('sso', true, koppeling.org, req);

  const bewijs = accounts.issueActionToken(user.id, OVERDRACHT, OVERDRACHT_MS);
  const pas = user.tier === 'lifestyle' || user.tier === 'business' ? user.tier : 'rtg';
  res.redirect(302, '/apps/app.html?pas=' + pas + '&sso=' + encodeURIComponent(bewijs) +
    '&terug=' + encodeURIComponent(terug || '/'));
  return user;
}

module.exports = { binnen, brug, foutAntwoord, werkSyncFout, persoonlijkGescheiden, OVERDRACHT, OVERDRACHT_MS };
