/* ============================================================================
   EEN PASSKEY ALS TWEEDE MOMENT -- de step-up die onafhankelijk is van hoe je
   binnenkwam.

   HET GAT DAT DIT DICHT, en het is er een die deze laag zelf heeft gemaakt.
   Sinds alle zes deuren hun manier wegschrijven, draagt een sessie van de
   identiteitsprovider van de klant de band `overgenomen`. Dat is juist: wij
   weten niet hoe hard die provider heeft geverifieerd, dus vraagt laag 3 bij
   een zware handeling zelf een moment erbij.

   Alleen kon zo'n mens dat moment niet GEVEN. Beide bevestigingsdeuren vroegen
   om iets wat een SSO-account niet heeft: de technische deur vraagt een
   wachtwoord, en de werkruimtedeur weigert een RTG-sessie die zelf te zacht is.
   Dat is "nodig, maar onmogelijk" een laag hoger dan waar die zin vandaan komt,
   en hij is niet met een uitzondering op te lossen -- een deur die zachter
   wordt zodra iemand er niet doorheen komt, is geen deur.

   EEN PASSKEY IS HET ANTWOORD OMDAT HIJ NIETS ERFT. Hij is de enige manier in
   dit huis met de band `sterk`, hij zit aan een apparaat en niet aan een
   geheim dat te herhalen is, en hij staat volledig los van de manier waarop de
   sessie is ontstaan. Dat is precies wat een step-up hoort te zijn: een tweede,
   ONAFHANKELIJKE bewijsvoering -- en niet dezelfde sleutel nog een keer.

   DRIE DINGEN DIE HIER NIET MOGEN, en ze zijn alle drie een manier om deze
   deur van binnenuit uit te hollen:

   1. HIJ MAG GEEN SESSIE MUNTEN. /api/webauthn/login doet dat wel, en die
      route is dus NIET te hergebruiken: wie hem als step-up zou inzetten,
      levert een tweede sessietoken op bij elke bevestiging. Deze weg
      controleert en geeft niets uit.
   2. DE PASSKEY MOET VAN DEZE MENS ZIJN. De ceremonie is al aan een account
      gebonden (kern/webauthn.js bewaart de login bij de challenge), maar de
      uitkomst wordt hier nog een keer tegen het verwachte account gelegd.
      Dubbelop met opzet: zonder die tweede vergelijking is "iemand met een
      geldige passkey" genoeg, en dat is iedereen met een eigen account.
   3. EEN CEREMONIE IS VOOR EEN KEER. Dat regelt pakChallenge() al -- hij haalt
      hem weg bij het ophalen. Wie hier een eigen challenge-opslag naast zou
      zetten, bouwt een tweede waarheid over wat er nog geldig is.

   WAT DIT NIET OPLOST, en dat hoort erbij: wie geen passkey heeft, heeft deze
   weg niet. Voor een SSO-account zonder passkey blijft de stand dus zoals hij
   was, en de deur zegt dat met zoveel woorden in plaats van een vage 403.
   ========================================================================== */
'use strict';

module.exports = ({ webauthnLoginOpties, webauthnLoginMaak, accounts, appUrl }) => {
  const loginVan = (user) => { try { return accounts.emailOf(user); } catch (e) { return null; } };

  /* DE GRENS WAARBINNEN EEN PASSKEY GELDT, en die komt uit onze eigen
     configuratie en NOOIT uit een kop van het verzoek. Wie de Host- of
     Origin-kop mag verzinnen, verzint anders de grens waartegen zijn eigen
     assertie wordt gecontroleerd -- en dan is de handtekening geldig binnen een
     domein dat hij zelf koos. Dezelfde afleiding als in routes/auth/webauthn.js;
     hij staat hier zodat de twee bevestigingsdeuren hem niet elk apart doen. */
  const oorsprong = (req) => { try { return new URL(appUrl(req)).origin; } catch (e) { return ''; } };
  const gastheer = (req) => { try { return new URL(oorsprong(req)).hostname; } catch (e) { return req && req.hostname; } };

  /* De uitnodiging. Aan het account gebonden, zodat de authenticator weet welke
     sleutel hij mag aanbieden -- en zodat de bevestiging hieronder niet met de
     passkey van een ander te doen is. */
  async function opties(user, req) {
    const login = loginVan(user);
    if (!login) return { status: 409,
      error: 'Dit account heeft geen login waar een passkey aan hangt, dus er valt niets te vragen.' };
    return webauthnLoginOpties(login, gastheer(req));
  }

  /* De controle. Levert { ok: true } of een reden -- nooit een sessie. */
  async function keur(user, req, bewijs) {
    const login = loginVan(user);
    if (!login) return { ok: false, status: 409,
      reden: 'Dit account heeft geen login waar een passkey aan hangt.' };
    const b = bewijs || {};
    const r = await webauthnLoginMaak(login, b.ceremonie, b.antwoord, oorsprong(req), gastheer(req));
    if (!r || r.error) return { ok: false, status: r && r.status ? r.status : 401,
      reden: (r && r.error) || 'De passkey kon niet worden geverifieerd.' };
    /* Zie punt 2 in de kop: dubbelop, en met opzet. */
    if (!r.user || String(r.user.id) !== String(user.id)) return { ok: false, status: 403,
      reden: 'Deze passkey hoort bij een ander account dan de sessie waarmee u dit doet.' };
    return { ok: true };
  }

  return { opties, keur };
};
