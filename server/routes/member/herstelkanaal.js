/* ============================================================================
   MIJN RTG: DE HERSTELKANALEN -- het telefoonnummer en het e-mailadres.

   Afgesplitst van ./sessies.js op een echte naad: sessies gaan over WAAR u nu
   bent, herstelkanalen over HOE u terugkomt als u eruit ligt. Ze horen op
   hetzelfde scherm thuis en niet in hetzelfde bestand.

   DE REGEL DIE BEIDE ROUTES DRAAGT. Een herstelkanaal VERVANGEN is de eerste
   stap van een accountovername; het wachtwoord is pas de tweede. Toch eiste
   alleen die tweede stap een bevestiging. Beide routes hier vragen daarom
   hetzelfde als /api/auth/password -- geen nieuwe drempel, maar het rechttrekken
   van een scheve.

   De grendel zelf staat NIET hier maar in accounts (setPhone, setEmail): op een
   route dek je de aanroepers die je kent, in de kern ook die van volgend jaar.
   Deze routes zijn de enige die de vlag `vervangenMag` zetten, en ze doen dat
   pas nadat de mens opnieuw is gecontroleerd.

   HET VERSCHIL TUSSEN DE TWEE. Een telefoonnummer wisselt in een stap: wij
   kunnen niet toetsen of iemand de simkaart heeft, dus het wachtwoord is het
   enige slot dat er is. Een e-mailadres wisselt in twee stappen, omdat wij daar
   wel kunnen toetsen of de aanvrager bij het nieuwe adres kan -- en omdat een
   typefout in een inlognaam anders een account is waar niemand meer in kan.
   ========================================================================== */
'use strict';
const klok = require('../../lib/klok');

module.exports = (kern) => {
  const { app, auth, accounts, handelingsspoor, mail, appUrl } = kern;
  /* Dezelfde schakelaar als in routes/auth.js, en hier opnieuw gedefinieerd
     omdat hij dáár een lokale constante is en niet op de kern staat. UIT is de
     stand die je krijgt als je niets doet: alleen met RTG_DEV_LINKS=1 komt de
     bevestigingslink in het antwoord terug in plaats van alleen in de mailbox.
     Een echte server zet hem niet, en dan is er niets te vergeten. */
  const DEV_VELDEN = () => process.env.RTG_DEV_LINKS === '1';

  const eisLid = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'Alleen voor leden.' }); return false; }
    if (!req.session.account) { res.status(403).json({ error: 'Dit hoort bij een eigen RTG-account.' }); return false; }
    return true;
  };
  const spoor = (req, wat, extra) => {
    try { if (handelingsspoor) handelingsspoor.leg(req.session.key, wat, extra || {}); } catch (e) {}
  };

  /* ------------------------------------------------------------------------
     HET HERSTELKANAAL WIJZIGEN.

     Deze route bestaat omdat accounts.setPhone een VERVANGING weigert zonder
     her-authenticatie: het nummer is de weg waarlangs /api/auth/reset een sms
     stuurt, en dat verleggen is de eerste stap van een accountovername.

     Hij vraagt hetzelfde als /api/auth/password: het huidige wachtwoord. Dat is
     geen nieuwe drempel maar het rechttrekken van een scheve: het wachtwoord
     WIJZIGEN eiste al een bevestiging, terwijl het herstelkanaal -- dat je nodig
     hebt om het wachtwoord te resetten -- zonder bevestiging te vervangen was.

     Hij staat hier en niet bij /api/gegevens: dat gesprek gaat over een
     bestelling en hoort geen wachtwoord te vragen. Twee verschillende
     handelingen op twee verschillende plekken, elk met de zwaarte die erbij
     hoort.

     WAT DIT NIET IS: een tweede plek waar een nummer kan worden gezet. Het
     EERSTE nummer zetten kan gewoon in het gesprek en bij de onboarding -- daar
     is nog geen kanaal om te kapen. Deze route is er alleen voor vervangen.
     ---------------------------------------------------------------------- */
  app.post('/api/mijn/herstelkanaal/telefoon', auth, async (req, res) => {
    if (!eisLid(req, res)) return;
    const u = req.session.account;
    if (!u || !u.password_hash) {
      return res.status(403).json({ error: 'Dit account heeft geen wachtwoord om mee te bevestigen. Neem contact op met RTG.' });
    }
    if (!await accounts.verifyPassword(String(req.body.huidig || ''), u.password_hash)) {
      spoor(req, 'herstelkanaal-geweigerd', { reden: 'wachtwoord' });
      return res.status(403).json({ error: 'Het wachtwoord klopt niet.' });
    }
    const nummer = String(req.body.telefoon || '').replace(/[^\d+ ]/g, '').trim().slice(0, 30);
    if (nummer.replace(/\D/g, '').length < 8) {
      return res.status(400).json({ error: 'Dat lijkt geen volledig telefoonnummer.' });
    }
    const uit = accounts.setPhone(u.id, nummer, { vervangenMag: true });
    if (!uit || uit.error) return res.status(400).json({ error: (uit && uit.reden) || 'Kon het nummer niet bewaren.' });
    spoor(req, 'herstelkanaal-gewijzigd', {});
    res.json({ ok: true,
      /* Eerlijk over het gevolg: dit verandert waar een herstelcode HEEN gaat.
         Wie dat leest en het niet zelf deed, hoort meteen te weten dat er iets
         mis is -- daarom staat het er als gevolg en niet als bevestiging. */
      gevolg: 'Een herstelcode gaat vanaf nu naar dit nummer. Herkent u deze wijziging niet, sluit dan meteen uw andere sessies en wijzig uw wachtwoord.' });
  });

  /* ------------------------------------------------------------------------
     HET E-MAILADRES WIJZIGEN -- in twee stappen, en met de oude houder ingelicht.

     Dit adres is de inlognaam EN het herstelkanaal. Daarom drie sloten:

       1. HET WACHTWOORD, net als hierboven en bij /api/auth/password.
       2. BEVESTIGING OP HET NIEUWE ADRES -- ook bescherming tegen een typefout:
          ging het meteen in, dan is een verkeerde letter een account waar
          niemand meer in kan.
       3. EEN BERICHT NAAR HET OUDE ADRES, zonder goedkeurlink maar wel met wat
          er gaat gebeuren. Wie dat leest en het niet zelf deed, kan het nog
          voor zijn -- dat is het enige moment waarop dat kan.

     HET AANGEVRAAGDE ADRES LIGT IN HET LEDENDOSSIER en niet in db.data: dat gaat
     versleuteld de kolom in (accounts/dossier.js). Een e-mailadres in de
     operationele opslag ligt buiten de kluis, en dat is precies wat de
     codenaam-opzet voorkomt.
     ---------------------------------------------------------------------- */
  const WISSEL_MS = 24 * 3600 * 1000;

  app.post('/api/mijn/herstelkanaal/email', auth, async (req, res) => {
    if (!eisLid(req, res)) return;
    const u = req.session.account;
    if (!u || !u.password_hash) return res.status(403).json({ error: 'Dit account heeft geen wachtwoord om mee te bevestigen.' });
    if (!await accounts.verifyPassword(String(req.body.huidig || ''), u.password_hash)) {
      spoor(req, 'mailwissel-geweigerd', { reden: 'wachtwoord' });
      return res.status(403).json({ error: 'Het wachtwoord klopt niet.' });
    }
    const nieuw = String(req.body.email || '').trim().toLowerCase().slice(0, 160);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(nieuw)) return res.status(400).json({ error: 'Dat is geen geldig e-mailadres.' });
    const oud = accounts.emailOf(u);
    if (String(oud || '').toLowerCase() === nieuw) return res.status(400).json({ error: 'Dat is het adres dat er al staat.' });
    /* Of het adres vrij is, wordt PAS bij de bevestiging hard getoetst. Hier
       alvast kijken zou dit een manier maken om te ontdekken welke adressen een
       RTG-account hebben, en dat is precies de vraag die de kluis niet hoort te
       beantwoorden. */
    const md = accounts.getMemberState(u.id) || {};
    md.mailwissel = { naar: nieuw, tot: klok.nu() + WISSEL_MS };
    accounts.saveMemberState(u.id, md);
    const tok = accounts.issueActionToken(u.id, 'mailwissel', WISSEL_MS);
    const url = appUrl(req) + '/apps/app.html?mailwissel=' + tok;
    try {
      mail.send(nieuw, 'Bevestig uw nieuwe e-mailadres bij Rahul Travel Group',
        'U heeft gevraagd dit adres in te stellen als uw RTG-inlognaam. Bevestig dat via deze link:\n' + url +
        '\n\nHeeft u dit niet aangevraagd, dan hoeft u niets te doen: zonder deze bevestiging verandert er niets.');
    } catch (e) {}
    try {
      if (oud) mail.send(oud, 'Er is een wijziging van uw e-mailadres aangevraagd',
        'Iemand die is ingelogd op uw RTG-account heeft gevraagd het e-mailadres te wijzigen.\n\n' +
        'Er zit GEEN link in dit bericht om dat goed te keuren; de wijziging gaat pas in als de houder van het nieuwe adres bevestigt.\n\n' +
        'Heeft u dit niet zelf gedaan, wijzig dan meteen uw wachtwoord en sluit uw andere sessies in "Waar ben ik aanwezig".');
    } catch (e) {}
    spoor(req, 'mailwissel-aangevraagd', {});
    res.json({ ok: true,
      gevolg: 'Er staat een bevestiging klaar op het nieuwe adres. Zolang daar niet op geklikt is, blijft uw huidige adres gelden. Het oude adres heeft bericht gekregen dat dit is aangevraagd.',
      ...(DEV_VELDEN() ? { devWisselUrl: url } : {}) });
  });

  /* De bevestiging komt uit de mailbox van het NIEUWE adres en dus zonder
     sessie: dat is het hele punt -- hij bewijst dat iemand daar bij kan. */
  app.post('/api/mijn/herstelkanaal/email/bevestig', (req, res) => {
    const u = accounts.verifyActionToken(req.body.token, 'mailwissel');
    if (!u) return res.status(400).json({ error: 'Ongeldige of verlopen bevestigingslink.' });
    const md = accounts.getMemberState(u.id) || {};
    const w = md.mailwissel;
    if (!w || !w.naar || Number(w.tot || 0) < klok.nu()) {
      return res.status(400).json({ error: 'Er staat geen wijziging meer open.' });
    }
    const uit = accounts.setEmail(u.id, w.naar, { vervangenMag: true });
    if (uit && uit.error === 'inGebruik') {
      return res.status(409).json({ error: 'Dit adres hoort inmiddels bij een ander RTG-account.' });
    }
    if (!uit || uit.error) return res.status(400).json({ error: (uit && uit.reden) || 'Kon het adres niet wijzigen.' });
    delete md.mailwissel;
    accounts.saveMemberState(u.id, md);
    /* Het token is voor EEN keer. Zonder dit blijft de link een dag lang
       bruikbaar, en een mailbox is precies de plek waar zoiets blijft liggen. */
    try { accounts.trekInActie(req.body.token, 'mailwissel'); } catch (e) {}
    res.json({ ok: true, gevolg: 'Uw inlognaam is nu dit adres. Log de volgende keer hiermee in.' });
  });
};
