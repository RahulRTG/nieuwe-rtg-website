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

   Afgesplitst uit routes/techniek.js toen die de 10 KB passeerde. */
module.exports = (tctx) => {
  const { app, accounts, beveilig, magInzien, isEigenaar, tooManyTries, noteFailedTry, loginFails } = tctx;

  app.post('/api/techniek/inloggen', async (req, res) => {
    const login = String(req.body.login || '').toLowerCase().slice(0, 60);
    const bucket = 'tech:' + req.ip + ':' + login;
    if (tooManyTries(res, bucket)) return;
    const zelfde = () => res.status(401).json({ error: 'Onjuiste inloggegevens.' });
    const user = accounts.findByLogin(req.body.login);
    if (!user || !await accounts.verifyPassword(String(req.body.wachtwoord || ''), user.password_hash)) {
      noteFailedTry(bucket);
      if (beveilig) beveilig.meld('tech-login-mislukt', 'waarschuwing',
        'Mislukte inlogpoging op de technische pagina (login: ' + String(req.body.login || '').slice(0, 40) + ').',
        { bron: req.ip });
      return zelfde();
    }
    if (!magInzien(user)) {
      // telt WEL mee voor de rem: anders is een account zonder rechten een
      // gratis orakel om onbeperkt wachtwoorden op te proberen
      noteFailedTry(bucket);
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
    res.json({ token: accounts.issueToken(user.id, 1), eigenaar: isEigenaar(user), naam: accounts.realNameOf(user) });
  });
};
