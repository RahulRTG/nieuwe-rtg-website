/* ============================================================================
   MIJN RTG: DE TWEEDE FACTOR -- TOTP met een set herstelcodes.

   Afgesplitst van ./herstelkanaal.js op de 10 kB-grens, en op een naad die er
   werkelijk een is: een herstelkanaal is een plek waar RTG iets HEENSTUURT (een
   sms, een link), een tweede factor is iets dat u zelf voortbrengt. Ze horen bij
   dezelfde vraag -- hoe komt u binnen en hoe komt u terug -- maar het zijn niet
   dezelfde dingen, en ze falen ook anders: een gekaapt kanaal levert een
   aanvaller een bericht op, een gekaapte factor levert hem toegang.

   De werking staat in server/kern/identiteit/tweefactor.js; hier alleen de deur
   en de sloten ervoor.
   ========================================================================== */
'use strict';

const { legInlogVast } = require('../../kern/identiteit/inlogherkomst');

module.exports = (kern) => {
  const { app, auth, accounts, handelingsspoor, tweefactor, stateFor, sessieregister } = kern;

  const eisLid = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'Alleen voor leden.' }); return false; }
    if (!req.session.account) { res.status(403).json({ error: 'Dit hoort bij een eigen RTG-account.' }); return false; }
    return true;
  };
  const spoor = (req, wat, extra) => {
    try { if (handelingsspoor) handelingsspoor.leg(req.session.key, wat, extra || {}); } catch (e) {}
  };

  /* ------------------------------------------------------------------------
     DE TWEEDE FACTOR.

     Hij hoort in dit bestand omdat hij bij dezelfde vraag hoort als de twee
     kanalen hierboven: hoe komt u binnen, en hoe komt u terug als het misgaat.
     De herstelcodes zijn letterlijk dat tweede.

     AANZETTEN IS TWEE STAPPEN (begin, dan bevestigen met een code uit uw eigen
     app). Zou het geheim meteen gelden, dan sluit een verkeerd gescande QR het
     lid buiten -- en dat merkt hij pas bij de volgende inlog.

     UITZETTEN VRAAGT EEN GELDIGE CODE en niet alleen het wachtwoord: wie een
     open sessie kaapt heeft dat wachtwoord vaak al.
     ---------------------------------------------------------------------- */
  app.post('/api/mijn/tweefactor', auth, (req, res) => {
    if (!eisLid(req, res)) return;
    res.json(tweefactor.standVan(req.session.account));
  });

  app.post('/api/mijn/tweefactor/begin', auth, async (req, res) => {
    if (!eisLid(req, res)) return;
    const u = req.session.account;
    /* Het wachtwoord VOORAF, want dit antwoord bevat het geheim zelf. Wie een
       open sessie kaapt, zou anders een eigen tweede factor kunnen aanzetten en
       de rechtmatige houder buitensluiten. */
    if (!u.password_hash || !await accounts.verifyPassword(String(req.body.huidig || ''), u.password_hash)) {
      spoor(req, 'tweefactor-geweigerd', { reden: 'wachtwoord' });
      return res.status(403).json({ error: 'Het wachtwoord klopt niet.' });
    }
    const r = tweefactor.begin(u, 'Rahul Travel Group', accounts.emailOf(u) || 'lid');
    res.status(r.status || 200).json(r);
  });

  app.post('/api/mijn/tweefactor/bevestig', auth, (req, res) => {
    if (!eisLid(req, res)) return;
    const r = tweefactor.bevestig(req.session.account, req.body.code);
    if (r.ok) spoor(req, 'tweefactor-aan', {});
    res.status(r.status || 200).json(r);
  });

  app.post('/api/mijn/tweefactor/codes', auth, async (req, res) => {
    if (!eisLid(req, res)) return;
    const u = req.session.account;
    if (!u.password_hash || !await accounts.verifyPassword(String(req.body.huidig || ''), u.password_hash)) {
      return res.status(403).json({ error: 'Het wachtwoord klopt niet.' });
    }
    const r = tweefactor.nieuweCodes(u);
    if (r.ok) spoor(req, 'tweefactor-codes-vernieuwd', {});
    res.status(r.status || 200).json(r);
  });

  app.post('/api/mijn/tweefactor/uit', auth, async (req, res) => {
    if (!eisLid(req, res)) return;
    const u = req.session.account;
    if (!u.password_hash || !await accounts.verifyPassword(String(req.body.huidig || ''), u.password_hash)) {
      return res.status(403).json({ error: 'Het wachtwoord klopt niet.' });
    }
    const r = tweefactor.uit(u, req.body.code);
    if (r.ok) spoor(req, 'tweefactor-uit', {});
    res.status(r.status || 200).json(r);
  });

  /* ------------------------------------------------------------------------
     DE TWEEDE STAP VAN DE INLOG.

     Geen `auth` ervoor, en dat is het punt: wie hier komt heeft nog geen sessie.
     Het bewijs uit /api/auth/login IS de geloofsbrief -- een doelgebonden token
     van vijf minuten dat alleen zegt "het wachtwoord van dit account klopte".

     DRIE DINGEN DIE HIER NIET MOGEN SCHUIVEN:

     1. het bewijs wordt INGETROKKEN zodra het is gebruikt. Zonder dat blijft het
        vijf minuten lang inwisselbaar, en het reist over dezelfde lijn als de
        code;
     2. een verkeerde code trekt het bewijs NIET in. Anders is een typefout een
        nieuwe inlog waard, en dan gaan mensen hun tweede factor uitzetten;
     3. er komt hier geen enkele route bij die het bewijs alleen al genoeg maakt.
        Het wachtwoord is stap een, de code is stap twee, en beide zijn nodig.
     ---------------------------------------------------------------------- */
  app.post('/api/auth/tweede', (req, res) => {
    const u = accounts.verifyActionToken(req.body.bewijs, 'inlog2');
    if (!u) return res.status(401).json({ error: 'Deze inlogpoging is verlopen. Log opnieuw in.' });
    const r = tweefactor.toets(u, req.body.code);
    if (!r.ok) return res.status(403).json({ error: r.error || 'Die code klopt niet.' });
    try { accounts.trekInActie(req.body.bewijs, 'inlog2'); } catch (e) {}

    const token = accounts.issueToken(u.id);
    const sess = { tier: u.tier, key: 'user-' + u.id, account: u };
    /* De herkomst zegt WELKE tweede factor het was. Een herstelcode is geen
       authenticator: hij is eenmalig, staat op papier en kan al maanden ergens
       liggen. Dat als "wachtwoord+totp" opschrijven zou de vertrouwensstand
       laten zeggen dat er een authenticator in het spel was. */
    legInlogVast({ sessieregister, accounts, token, lidKey: sess.key,
      type: r.soort === 'herstelcode' ? 'wachtwoord+herstelcode' : 'wachtwoord+totp',
      assurance: 'kennis+bezit', methode: 'gemeten', bron: 'auth/tweede' });
    res.json({ token, state: stateFor(sess, req.body.lang),
      ...(r.let ? { let: r.let } : {}), ...(r.soort ? { soort: r.soort } : {}) });
  });
};
