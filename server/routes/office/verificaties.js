/* Backoffice (deelmodule): de identiteitsverificaties.

   De wachtrij, het besluit (goedkeuren of afwijzen) en wat er daarna met het
   bewijs gebeurt. Dat laatste is de reden dat dit een eigen bestand is
   geworden: sinds de bewaarveger hoort bij een AFWIJZING het bewijs direct de
   kluis uit, en bij een goedkeuring wordt de klok van de bewaartermijn
   gestempeld. Die twee regels horen zichtbaar bij het besluit te staan, niet
   verstopt tussen de nudges en de dagbriefing.

   Afgesplitst uit ./werk.js toen dat bestand door de 10 KB van keuringsregel
   13 ging. `wieKijkt` blijft daar wonen en komt hier via de context binnen:
   twee kopieen van "wie kijkt er in de kluis" is precies de dubbeling waar
   LAT.md regel 4 over gaat. */
module.exports = (octx, gedeeld) => {
  const { kern } = octx;
  const { UPLOAD_DIR, accounts, app, mail, notify, officeAuth, pendingVerifications } = kern;
  const { wieKijkt } = gedeeld;

  app.post('/api/office/verifications', officeAuth, (req, res) => res.json({ pending: pendingVerifications(wieKijkt(req)) }));

  app.post('/api/office/verify', officeAuth, (req, res) => {
    const user = accounts.getUserById(Number(req.body.userId));
    if (!user) return res.status(404).json({ error: 'Account niet gevonden.' });
    const status = req.body.decision === 'approve' ? 'verified' : 'rejected';
    accounts.setVerification(user.id, status);
    // gezichtscontrole (selfie x paspoort) en nationaliteit vastleggen bij goedkeuren:
    // zo weten we dat het paspoort bij de codenaam en de persoon hoort (eis 5)
    if (status === 'verified') {
      const md = accounts.getMemberState(user.id) || {};
      if (req.body.faceMatch !== undefined) md.faceMatch = req.body.faceMatch === true;
      if (req.body.nationaliteit) md.nationaliteit = String(req.body.nationaliteit).slice(0, 40);
      /* DE GEBOORTEDATUM VAN HET DOCUMENT, en dit was het gat.

         `md.geboren` komt uit het aanmeldformulier -- het lid typt hem zelf
         (routes/auth/account.js zegt daar met zoveel woorden "het paspoort komt
         pas later"). Bij de goedkeuring werden nationaliteit, geslacht en de
         gezichtscontrole wel van het document overgenomen en de geboortedatum
         niet. Daardoor rustte elke leeftijdsclaim in dit huis -- 18plus naar een
         dienst, alcohol aan de bar, de progressiegrens -- op een zelf ingetypte
         datum, ook bij een volledig goedgekeurd paspoort. De keurder KIJKT naar
         het document; hij legt hem nu ook vast.

         Optioneel, want een bestaande keuringsstroom mag hier niet op stuklopen:
         zonder datum blijft de opgegeven staan, en dan blijft de bron eerlijk
         'opgegeven'. Wat er WEL binnenkomt, wordt gecontroleerd -- een
         onleesbare datum is erger dan geen datum, want die ziet eruit als
         bewijs. */
      const gebIn = String(req.body.geboortedatum || '').slice(0, 10);
      if (gebIn) {
        const jaar = Number(gebIn.slice(0, 4));
        const nuJaar = new Date().getFullYear();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(gebIn) || isNaN(Date.parse(gebIn)) || jaar < nuJaar - 120 || jaar > nuJaar) {
          return res.status(400).json({ error: 'Die geboortedatum lijkt niet te kloppen; controleer hem op het document.' });
        }
        md.geboren = gebIn;
        md.geborenBron = 'paspoort';
      }
      // geslacht uit het paspoort vastleggen (v/m/x); stuurt de "naar de vrouw"-regel bij ontmoetingen
      const g = String(req.body.geslacht || '').toLowerCase();
      if (g === 'v' || g === 'm' || g === 'x') md.geslacht = g;
      /* De klok van de bewaartermijn: een jaar na DEZE datum wist de
         bewaarveger de scan en de selfie (besluit van de eigenaar in het
         papierwerkregister, 2 augustus 2026). */
      md.geverifieerdOp = new Date().toISOString();
      accounts.saveMemberState(user.id, md);
    } else {
      /* Afgewezen = direct wissen. De afwijzingsmail vraagt om een nieuwe,
         scherpere foto; het oude bewijs heeft dan geen doel meer en blijft
         zonder deze regel eeuwig als restant in de kluis staan. */
      const md = accounts.getMemberState(user.id) || {};
      try { require('../../identiteitsmap').maakIdentiteitsmap(UPLOAD_DIR).wisAllesVan(user.id); } catch (e) {}
      accounts.setVerification(user.id, status, null);
      if (md.selfie) { delete md.selfie; accounts.saveMemberState(user.id, md); }
    }
    mail.send(accounts.emailOf(user), status === 'verified' ? 'Uw identiteit is geverifieerd' : 'Uw verificatie is afgewezen',
      'Beste ' + accounts.realNameOf(user) + ',\n\n' +
      (status === 'verified' ? 'Uw identiteit is geverifieerd. U kunt nu in een tik boeken.' :
       'We konden uw document niet goedkeuren. Probeer het opnieuw met een duidelijkere foto.') +
      '\n\nRahul Travel Group');
    notify(user.tier, { icon: status === 'verified' ? 'pas' : 'meldingen',
      title: status === 'verified' ? 'Identiteit geverifieerd' : 'Verificatie afgewezen',
      body: status === 'verified' ? 'U kunt nu in één tik boeken.' : 'Probeer een duidelijkere foto van uw document.' });
    res.json({ ok: true, status, pending: pendingVerifications(wieKijkt(req)) });
  });

  /* ---- paspoort-incidenten: RTG beoordeelt of een opgeeiste identiteit vrijkomt ---- */
};
