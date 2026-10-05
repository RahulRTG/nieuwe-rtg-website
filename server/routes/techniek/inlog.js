/* Techniek (deelmodule): de inlog op de technische pagina.

   Gewone accountgegevens, maar de toegang wordt hier meteen gecontroleerd: een
   geldig wachtwoord is niet genoeg, het account moet ook op de toegangslijst
   staan (of de eigenaar zijn).

   TWEE DINGEN ZATEN HIER FOUT, en ze versterkten elkaar.

   Er was GEEN REM. Elke andere inlog in dit huis loopt langs tooManyTries /
   noteFailedTry -- tien mislukte pogingen, dan vijf minuten dicht, en een
   melding op het veiligheidsbord. Uitgerekend de zwaarste pagina had die niet,
   dus onbeperkt raden.

   En het antwoord VERSCHILDE. Bij een fout wachtwoord kwam er 401 "Onjuiste
   inloggegevens", maar bij een JUIST wachtwoord zonder recht op deze pagina een
   403 met een eigen tekst. Dat is een orakel: wie het verschil ziet weet dat
   het wachtwoord klopte -- en dat wachtwoord opent elders in het huis wel
   deuren. Zonder rem was dat een werkende manier om wachtwoorden af te lopen.

   De aanroeper krijgt nu in beide gevallen exact hetzelfde. De ECHTE reden gaat
   naar het veiligheidsbord, want die is voor ons en niet voor wie aanklopt. Dat
   kost een legitieme medewerker zonder rechten een verwarrend moment; die hoort
   hier ook niet te zijn, en de eigenaar ziet zijn poging gewoon op het bord.

   EN DE TWEEDE FACTOR GELDT OOK HIER (N1 van de V1-audit, besluit van de
   eigenaar op 5 oktober 2026). Deze deur gaf op alleen het wachtwoord een
   accounttoken, juist voor de zwaarste accounts van het huis: de eigenaar en de
   techniektoegangslijst. Met de tweede factor aan komt er nu eerst een kort
   BEWIJS uit, net als bij /api/auth/login, en dezelfde route ruilt dat met een
   code om. Het bewijs heeft een eigen doel (`tech2`): /api/auth/tweede ruilt het
   niet om en geeft dus ook geen token van 30 dagen voor deze pagina, en
   andersom ruilt deze deur geen gewoon inlogbewijs om. De rem op de code is
   die van ../../kern/identiteit/tweedestap-rem.js, gedeeld met de andere deuren.

   Afgesplitst uit routes/techniek.js toen die de 10 KB passeerde. */
module.exports = (tctx) => {
  const { app, accounts, beveilig, magInzien, isEigenaar, tooManyTries, noteFailedTry, loginFails, kern } = tctx;
  const tweefactor = kern && kern.tweefactor, rem = tweefactor && tweefactor.rem;
  if (!tweefactor || !rem) throw new Error('techniek/inlog: zonder tweefactor en zijn rem kan deze deur de tweede factor niet vragen');
  const sessie = (user) => ({ token: accounts.issueToken(user.id, 1), eigenaar: isEigenaar(user), naam: accounts.realNameOf(user) });

  /* De tweede stap: bewijs uit stap een plus een code. */
  async function tweedeStap(req, res) {
    const user = accounts.verifyActionToken(req.body.bewijs, 'tech2');
    if (!user) return res.status(401).json({ error: 'Deze inlogpoging is verlopen. Log opnieuw in.' });
    if (rem.dicht(res, user.id, req.ip)) return;
    // het recht kan in de vijf minuten van het bewijs zijn ingetrokken
    if (!magInzien(user)) return res.status(401).json({ error: 'Onjuiste inloggegevens.' });
    const r = tweefactor.toets(user, req.body.code);
    if (!r.ok) { rem.mis(user.id, req.ip); return res.status(403).json({ error: r.error || 'Die code klopt niet.' }); }
    rem.gelukt(user.id, req.ip);
    await accounts.trekInActie(req.body.bewijs, 'tech2');
    if (accounts.wachtIntrekkingen) await accounts.wachtIntrekkingen();
    res.json(sessie(user));
  }

  app.post('/api/techniek/inloggen', async (req, res) => {
    if (req.body && req.body.bewijs) return tweedeStap(req, res);
    const login = String(req.body.login || '').toLowerCase().slice(0, 60);
    const bucket = 'tech:' + req.ip + ':' + login;
    if (tooManyTries(res, bucket)) return;
    const zelfde = () => res.status(401).json({ error: 'Onjuiste inloggegevens.' });
    const user = accounts.findByLogin(req.body.login);
    if (!user || !await accounts.verifyPassword(String(req.body.wachtwoord || ''), user.password_hash)) {
      noteFailedTry(bucket, req.ip);
      if (beveilig) beveilig.meld('tech-login-mislukt', 'waarschuwing',
        'Mislukte inlogpoging op de technische pagina (login: ' + String(req.body.login || '').slice(0, 40) + ').',
        { bron: req.ip });
      return zelfde();
    }
    if (!magInzien(user)) {
      // telt WEL mee voor de rem: anders is een account zonder rechten een
      // gratis orakel om onbeperkt wachtwoorden op te proberen
      noteFailedTry(bucket, req.ip);
      /* De identiteitssleutel, niet de echte naam: die staat in de kluis en
         hoort niet via een melding in de gedeelde database te belanden (en de
         opvraging ging bovendien langs het inzagejournaal heen). Zie de
         uitgebreidere uitleg bij dezelfde melding in ../techniek.js. */
      if (beveilig) beveilig.meld('tech-login-zonder-recht', 'kritiek',
        'Account user-' + user.id + ' logde correct in maar heeft geen recht op de technische pagina.',
        { bron: 'user:' + user.id });
      return zelfde();
    }
    loginFails.delete(bucket);
    if (tweefactor.standVan(user).aan) {
      return res.json({ tweedeFactorNodig: true, bewijs: accounts.issueActionToken(user.id, 'tech2', 5 * 60 * 1000),
        uitleg: 'Uw wachtwoord klopt. Typ nu de code uit uw authenticator, of een van uw herstelcodes.' });
    }
    res.json(sessie(user));
  });
};
