/* ============================================================================
   EEN GEVERIFIEERD SIGNATURE-LID -- de zwaarste sleutel van dit huis.

   HET PROBLEEM. Vijfentwintig routes weigeren op een KYC-poort, en de zin
   zegt precies wat er ontbreekt: "Verifieer eerst uw identiteit. Zo weet ieder
   lid dat de ander echt is" (17x), "Activeer eerst uw RTG-geverifieerde
   paspoort" (6x), "Dit lid heeft geen RTG-geverifieerd paspoort" (2x). Het is
   de poort van Rendez-vous en Vonk, en hij vraagt DRIE dingen tegelijk
   (routes/member/rendezvous.js, eis()):

     1. een tier `lifestyle` of `business`
     2. een ACCOUNT met `verified === 'verified'`
     3. een leeftijd van 18 of ouder

   Geen van de bestaande sleutels heeft ze alle drie. `member-lifestyle` is een
   demo-PASsessie zonder account (zie ./accountroutes.js) en `member-account`
   is een gratis account zonder pas.

   DE WEG IS DE ECHTE WEG, en die is met opzet lang. CLAUDE.md is er stellig
   over: een Lifestyle- of Business Pass ontstaat UITSLUITEND na menselijke
   goedkeuring, en zelf-registreren geeft ze niet. Dat staat ook in de code, in
   zoveel woorden (kern/aanmeldingen/besluit.js): "De poort van het merk: een
   Lifestyle-/Business Pass ontstaat hier, door dit menselijke besluit, en
   nergens anders." Deze wereld loopt die weg af en gaat er niet omheen:

     /api/auth/register            een gewoon gratis account (tier rtg)
     /api/aanmelding/aanvraag      datzelfde account vraagt een Lifestyle Pass
     /api/aanmelding/beslis        het KANTOOR accepteert -- en pas dat besluit
                                   tilt de tier op (accounts.setTier)
     /api/auth/login               opnieuw inloggen; nu met de nieuwe pas
     /api/office/verify            het kantoor keurt de identiteit goed

   HET CONTRACTBEDRAG IS GEEN GOK. De kern weigert een akkoord onder de bodem
   met de reden erbij: "RTG Lifestyle Pass kost minimaal EUR 20.000 per maand;
   EUR 2.000 kan niet." Dat is de ondergrens uit kern/pasladder.js, en die
   wordt hier NIET overschreven maar gerespecteerd -- een bodem is geen prijs
   (PRIJZEN.md), en de proef hoort hem niet te omzeilen.

   WAT DIT NIET IS. Geen achterdeur en geen vlag: elke stap is een route die
   een mens ook loopt, met dezelfde poort ervoor. Wat de proef wint is een lid
   dat werkelijk is wie het zegt te zijn -- precies wat die 25 routes eisen. */
'use strict';

const EMAIL = 'proef.signature@rtg.test';
const WACHTWOORD = 'ProefWachtwoord-Signature-2026!';
/* Achtendertig jaar oud: ruim boven de 18 van de ontmoetpoort, en een vaste
   datum zodat twee rondes hetzelfde meten. */
const GEBOREN = '1988-03-03';

async function zetSignatureKlaar({ post, tokens }) {
  const stappen = [];
  /* OP NAAM, en niet de gedeelde kantoorcode. Beide besluiten hieronder zeggen
     dat zelf, en ze zeggen ook waarom: "Een Lifestyle Pass wordt alleen
     toegekend door een herleidbaar persoon" en "wat hier gebeurt, komt in het
     inzagejournaal te staan, en daar hoort een mens bij en geen gedeelde
     code." Dat is dezelfde regel als in ./kantoorroutes.js, hier voor het
     eerst aan de BOUWkant in plaats van aan de meetkant. */
  const kantoor = (tokens || {})['kantoor-op-naam'];
  if (!kantoor) {
    return { klaar: false, extra: {}, stappen,
      reden: 'er is geen kantoorsessie OP NAAM; een gedeelde code kent geen pas toe en keurt geen identiteit goed' };
  }

  const doe = async (naam, pad, lijf, tok) => {
    let a = null;
    try { a = await post(pad, lijf, tok); } catch (e) { a = null; }
    const ok = a && a.status >= 200 && a.status < 300;
    stappen.push({ naam, pad, status: a ? a.status : 0, ok,
      waarom: ok ? null : ((a && a.data && a.data.error) || 'geen antwoord') });
    return ok ? a.data : null;
  };

  /* 1. Een gewoon gratis account. Bestaat hij al (een tweede ronde op dezelfde
        datamap), dan gewoon inloggen -- stil falen mag niet. */
  let acc = await doe('een gratis account', '/api/auth/register',
    { name: 'Proef Signature', email: EMAIL, password: WACHTWOORD,
      geboortedatum: GEBOREN, tier: 'rtg', pasApp: 'rtg' }, null);
  if (!acc) {
    acc = await doe('anders: inloggen op dat account', '/api/auth/login',
      { login: EMAIL, password: WACHTWOORD, pasApp: 'rtg' }, null);
  }
  const user = acc && acc.state && acc.state.user;
  const userId = user && user.id;
  if (!acc || !acc.token || !userId) {
    return { klaar: false, extra: {}, stappen, reden: 'er kwam geen account met een id; zie stappen' };
  }

  /* 2. Dat account vraagt de pas aan, en 3. het kantoor beslist. Het bedrag is
        de ondergrens van de ladder; lager weigert de kern met reden. */
  const aanvraag = await doe('de aanvraag voor een Lifestyle Pass', '/api/aanmelding/aanvraag',
    { pas: 'lifestyle', naam: 'Proef Signature', contact: EMAIL }, acc.token);
  const aanmeldingId = aanvraag && aanvraag.aanmelding && aanvraag.aanmelding.id;
  if (aanmeldingId) {
    await doe('het kantoor accepteert -- pas hier ontstaat de pas', '/api/aanmelding/beslis',
      { id: aanmeldingId, besluit: 'geaccepteerd', contractEuro: 20000,
        notitie: 'proefopstelling' }, kantoor);
  }

  /* 4. Opnieuw inloggen: de tier zit in de SESSIE, en die is van voor het
        besluit. */
  const opnieuw = await doe('opnieuw inloggen, nu met de pas', '/api/auth/login',
    { login: EMAIL, password: WACHTWOORD, pasApp: 'lifestyle' }, null);
  const token = (opnieuw && opnieuw.token) || acc.token;
  const tier = opnieuw && opnieuw.state && opnieuw.state.user && opnieuw.state.user.tier;

  /* 5. En de identiteit. Dit is de zwaarste handeling die het kantoor kent en
        hij laat een regel na in het inzagejournaal -- ook hier. */
  await doe('het kantoor keurt de identiteit goed', '/api/office/verify',
    { userId, decision: 'approve', faceMatch: true, nationaliteit: 'NL' }, kantoor);

  const klaar = tier === 'lifestyle' || tier === 'business';
  return {
    klaar, token, userId, tier: tier || null, stappen,
    extra: { userId },
    reden: klaar ? null
      : 'het account draagt tier `' + (tier || 'onbekend') + '`; de pas is niet toegekend, zie stappen'
  };
}

module.exports = { zetSignatureKlaar, EMAIL, GEBOREN };
