/* De drie remmen die voor elk API-verzoek hangen.

   Ze staan bewust in deze volgorde, van goedkoop naar duur: eerst tellen we
   verzoeken per IP, dan kijken we of de opslag klaar is, dan pas of de
   hoofdzekering erin zit. Zo doet een verzoek dat er toch niet doorheen komt
   zo min mogelijk werk. */

/* 1. Rem op de deur.
   Een IP mag 300 API-verzoeken per minuut; daarboven 429. Ruim genoeg voor elk
   normaal gebruik, en het haalt de scherpte van scripts en scrapers. De
   live-streams tellen niet mee: dat zijn langlopende verbindingen, geen
   verzoeken. Alleen in productie, of met RTG_RATELIMIT=1. */
function remOpDeDeur(app, aan) {
  /* De async-context voor de AI-rem staat BUITEN de aan/uit van de deurrem:
     hij remt zelf niets, hij noteert alleen wie het verzoek doet, zodat
     ../ai-rem.js en ../ai-budget.js weten wie een modelaanroep op zijn naam krijgt. Zonder deze
     laag valt die rem terug op "geen context, dus geen rem". */
  app.use(require('../ai-context').contextMiddleware());
  if (!aan) return;
  const rem = require('../rem');
  app.use(rem({
    windowMs: 60000,
    limit: 300,
    skip: req => !req.path.startsWith('/api/') || req.path.endsWith('/stream'),
    handler: (req, res) => res.status(429).json({ error: 'Even rustig aan: te veel verzoeken. Probeer het over een minuut opnieuw.' })
  }));
}

/* 2. De opslag-poortwachter.

   Een instance die zijn duurzame staat nog niet volledig geladen heeft
   (Postgres herstart: de gedeelde data en het RAM-venster zijn nog onderweg)
   mag GEEN API-verkeer beantwoorden. Zou hij dat wel doen, dan serveert hij de
   verouderde lokale snapshot, en kan een schrijfactie in dat venster, geld,
   de echte Postgres-staat daarna overschrijven.

   Dat is geen theorie: precies dit ving fase D van de beproeving op
   65M-schaal, met saldi die een herstart niet 'overleefden'.

   Health, ready en techniek blijven bereikbaar, zodat de load balancer en de
   eigenaar de instance gewoon kunnen zien. */
function opslagPoort(opslagKlaar) {
  return (req, res, next) => {
    const p = req.path || '';
    if (!p.startsWith('/api/')) return next();
    if (p === '/api/health' || p === '/api/ready' || p.startsWith('/api/techniek') || p.startsWith('/api/cluster')) return next();
    let klaar = true;
    try { klaar = opslagKlaar(); } catch (e) { klaar = false; }
    if (klaar) return next();
    res.set('Retry-After', '2');
    res.status(503).json({ error: 'De server laadt zijn gegevens nog; een ogenblik.' });
  };
}

/* 3. De hoofdzekering.

   Staat de onderhouds-zekering uit, dan is de app in onderhoud en geven alle
   API's 503. Behalve de technische pagina en de health-checks, en behalve
   verzoeken van de eigenaar met een geldig token: die moet de app bewust
   spanningsloos kunnen maken en er zelf bij blijven om de zekering er weer in
   te doen. */
function hoofdzekering({ db, accounts, eigenaar }) {
  const { zekeringGesprongen } = require('../techniek');
  return (req, res, next) => {
    const z = db.data && db.data.techniek && db.data.techniek.zekeringen && db.data.techniek.zekeringen.onderhoud;
    /* zekeringGesprongen laat een tijdgebonden zekering hier vanzelf doven;
       de onderhouds-zekering is sinds de noodrem-ladder alleen nog handmatig
       (geen 'tot'), dus voor hem verandert er niets -- maar de lezing hoort
       overal dezelfde te zijn (een waarheid, een plek). */
    if (!zekeringGesprongen(z)) return next(); // normaal: stroom staat erop
    const p = req.path;
    if (p.startsWith('/api/techniek') || p === '/api/health' || p === '/api/ready') return next();
    try {
      const tok = (req.get('authorization') || '').replace(/^Bearer\s+/i, '') || req.query.token;
      const u = tok ? accounts.verifyToken(tok) : null;
      if (eigenaar.isEigenaar(accounts, u)) return next(); // de eigenaar mag er wel bij
    } catch (e) {}
    if (p.startsWith('/api/')) return res.status(503).json({ error: 'De app is in onderhoud. Probeer het later opnieuw.' });
    next();
  };
}

/* 4. De inlogpauze -- de kleine degraded mode van de noodrem-ladder.

   Alleen de paden waarlangs iemand een sessie of account KRIJGT gaan dicht;
   alles wat een bestaande sessie doet blijft gewoon werken. Dat is de hele
   pointe van de ladder: een brute force richt zich op de inlog, dus de
   verdediging sluit de inlog -- niet de app. De zekering draagt een 'tot' en
   dooft vanzelf (zekeringGesprongen); de eigenaar kan hem eerder resetten of
   juist handmatig trekken (dan zonder 'tot'). */
const INLOG_PADEN = ['/api/login', '/api/auth/login', '/api/auth/register', '/api/auth/forgot',
  '/api/auth/reset', '/api/office/login', '/api/supplier/login', '/api/staff/login'];
function inlogpauzePoort({ db }) {
  const { zekeringGesprongen } = require('../techniek');
  return (req, res, next) => {
    if (!INLOG_PADEN.includes(req.path)) return next();
    const z = db.data && db.data.techniek && db.data.techniek.zekeringen && db.data.techniek.zekeringen.inlogpauze;
    if (!zekeringGesprongen(z)) return next();
    res.set('Retry-After', '60');
    res.status(503).json({ error: 'Inloggen is enkele minuten gepauzeerd wegens een aanval op de inlog. Wie al is ingelogd merkt hier niets van.' });
  };
}

module.exports = { remOpDeDeur, opslagPoort, hoofdzekering, inlogpauzePoort, INLOG_PADEN };
