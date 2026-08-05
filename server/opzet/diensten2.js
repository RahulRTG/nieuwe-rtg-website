/* ============================================================================
   DE DIENSTEN EN DE TWEE POORTWACHTERS.

   Vervolg van ./diensten.js. Daar staat de LAAG (bus, sse, meldingen,
   rekenaars); hier staat wat die laag gebruikt: het archief, de beveiliging, de
   Wacht, RTmail met zijn teams en automatiseringen, het atelierweb, de naamlaag,
   de antivirus met zijn netscan, en resolveSession + auth -- de twee
   poortwachters waar bijna elke route van dit huis achter staat.

   Gescheiden omdat samen ze over de 10 kB-grens gaan. De naad is niet op maat
   gekozen maar met scripts/blokscan.js nagemeten: op dit punt gaan er zeventien
   namen door de deur en komen er vijftien terug, en er loopt geen enkele draad
   terug. Een naad met nul draden is een echte naad.
   ========================================================================== */
'use strict';

module.exports = function maakDiensten2(deps) {
  const {
    DATA_DIR, PERSONAS, accounts, crypto, db, dirTouch, eigenaarAccount, findSupplier, 
    lidBoardUit, lidPadFunctie, mail, rtf, save, schild, schoon, sendPushToUser, sessionFor
  } = deps;
/* De archiefkast: houdt de levende kast klein door afgeronde tickets ouder
   dan een afgesloten kwartaal naar append-only maandbestanden te verhuizen. */
const archief = require('../archief')({ db, save, DATA_DIR });

const beveilig = require('../beveiliging')({
  db, save,
  notifyOwner: (note) => {
    const o = eigenaarAccount();
    if (!o) return;
    try { sendPushToUser(o.id, { title: note.title, body: note.body, tag: 'beveiliging' }); } catch (e) {}
    try { mail.send(accounts.emailOf(o), note.title,
      'Beste ' + accounts.realNameOf(o) + ',\n\n' + note.body +
      '\n\nOpen de technische pagina (Beveiliging) om te zien wat er speelt.\n\nRahul Travel Group'); } catch (e) {}
  }
});

/* De Wacht (kern/wacht.js): het immuunsysteem + de raadkamer. Leest zijn meters
   uit het schild (verzoeken, bans, actieve IP's, aanvalstreffers) en uit de
   beveiligingsmeldingen; de quarantaine wordt door het schild afgedwongen. Elke
   ~10 s een momentopname voor de grafiek. `wacht` is hierboven al gedeclareerd
   (het schild raadpleegt hem voor de quarantaine). */
const wacht = require('../kern/wacht')({ db, save, beveilig, lees: schild.signalen });
/* DE POSTLAAG. Elf modules die samen RTG Mail zijn: bezorgen, adressen, teams,
   postvakken, gesprekken, schrijven, regels, dossiers, klok, rechten en
   bewaarbeleid. Ze staan in ./postlaag.js omdat dit bestand anders over de tien
   kilobyte gaat -- en omdat de BOUWVOLGORDE daar iets betekent: de haak na de
   bezorging kan pas gezet worden als de regels en de klok bestaan. */
const post = require('./postlaag')({ db, save, crypto, findSupplier });
const { mailQ, mailIn, rtmailAi, rtmail, rtmailTeam, rtmailVak, rtmailDraad, rtmailSchrijf, rtmailRegels,
  rtmailDossier, rtmailSla, rtmailRecht, rtmailBewaar } = post;
// De automatiseringen (draaiboeken) lopen over de RTMAIL-rail
const automatisering = require('../kern/automatisering')({ rtmail });
// Werkmail: het zakelijke adresboek per zaak boven op RTMAIL (domein <naam>.rtg,
// eigenaar- en managementadressen, rahul@<domein>, de buitenpost en -poort)
const { werkmail } = require('../kern/werkmail')({ db, save, crypto, rtmail, mail, accounts });
const atelierweb = require('../kern/atelierweb')({ db, save, crypto, schoon });
// de persoonlijke naamlaag: eigen etiketten op codenamen, alleen in het eigen account
const naamlaag = require('../kern/naamlaag')({ db, save, schoon });
// het welkom-draaiboek ook voor nieuwe RTF-profielen (foundation, eigen router)
try { rtf.setAutomatisering(automatisering); } catch (e) {}
{
  const t = setInterval(() => { try { wacht.meet(); } catch (e) {} }, 10000);
  if (t.unref) t.unref();
}

/* De Ontsmetter (kern/antivirus.js): de platform-malware-scanner. Elk bestand
   dat RTG binnenkomt wordt gescand (handtekeningen + heuristiek + entropie);
   besmette inhoud wordt geweigerd, gemeld op het bord, en de bron wordt via De
   Wacht ter afsnijding voorgesteld. */
const antivirus = require('../kern/antivirus')({ db, save, beveilig, wacht });

/* Universeel scan-net: elke schrijf-aanvraag wordt door De Ontsmetter gehaald.
   Zit er een BESMETTE beeld-/PDF-data-URL in de body (waar dan ook, hoe diep
   ook), dan weigeren we hem hier -- zo zijn ALLE upload-plekken (snaps, De Salon,
   markt, clips, en alles wat later bijkomt) in één klap gedekt zonder elke route
   apart aan te raken. Verdacht mag door (staat wel op het bord). /api/verify/*
   scant al expliciet; /api/techniek/* en health blijven ongemoeid.

   Hij wordt hier GEBOUWD maar veel eerder INGEHANGEN (zie het doorgeefluik bij
   app.use(jsonGzip())), want een middleware die na een router staat ziet de
   verzoeken van die router nooit. */
const scanNet = (req, res, next) => {
  const m = req.method;
  if (m !== 'POST' && m !== 'PUT' && m !== 'PATCH') return next();
  const p = req.path || '';
  if (p.startsWith('/api/techniek') || p.startsWith('/api/verify') || p === '/api/health' || p === '/api/ready') return next();
  if (!req.body || (typeof req.body !== 'object' && typeof req.body !== 'string')) return next();
  try {
    const raak = antivirus.scanBody(req.body, { bron: req.ip, naam: p });
    if (raak) return res.status(422).json({ error: 'Dit bestand is geweigerd door de beveiliging (mogelijke malware).' });
  } catch (e) { /* een scanfout mag nooit een verzoek breken */ }
  next();
};

/* Een token kan een demo-sessie zijn (in-memory) of een echt account-token
   (ondertekend, staatloos). Beide leveren een sessie met tier + unieke key. */
function resolveSession(token) {
  if (!token) return null;
  const demo = sessionFor(token);
  if (demo) return demo;
  const user = accounts.verifyToken(token);
  if (user) return { tier: user.tier, key: 'user-' + user.id, account: user };
  return null;
}

/* De AI-poort deelt resolveSession met auth hieronder: een vertaalverzoek en een
   gewone API-aanroep horen dezelfde sessies te herkennen. */
const aiPoort = require('../kern/aipoort').maakAiPoort({ resolveSession });

function auth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const sess = resolveSession(token);
  if (!sess) return res.status(401).json({ error: 'Niet ingelogd.' });
  // Alleen leden-sessies horen hier: een echt account, of een demo-pas met een
  // bekende persona-tier. Leverancier- en kantoor-sessies (met een eigen auth
  // en zonder tier) worden geweigerd i.p.v. verderop de ledengids te laten
  // crashen op een ontbrekende codenaam.
  if (!sess.account && !PERSONAS[sess.tier]) return res.status(401).json({ error: 'Niet ingelogd als lid.' });
  req.session = sess;
  // Handhaving van de eigen boardroom: heeft het lid (of, via de kind-sleutel,
  // de ouder) deze functie uitgezet, dan gaat de API ook echt dicht. Alles staat
  // standaard aan, dus dit raakt pas iets zodra iemand bewust iets omzet.
  const _fid = lidPadFunctie(req.path);
  if (_fid && sess.key && lidBoardUit(sess.key, _fid)) {
    return res.status(403).json({ error: 'Deze functie staat uit in je boardroom.', functieUit: _fid });
  }
  dirTouch(sess);
  next();
}

/* Schoonmaakhulp voor vrije tekstvelden: knipt op lengte en haalt < en >
   weg, zodat door gebruikers ingevoerde namen en berichten nooit als
   opmaak in andermans scherm kunnen belanden. */

/* De ledengids (dirTouch, ledenAantal, gidsHaal, gidsZoekCodenaam,
   keyVanCodenaam) staat in server/kern/gids.js en is hierboven, direct na de
   live-laag, opgezet. */

  return {
    aiPoort, antivirus, archief, atelierweb, auth, automatisering, beveilig, naamlaag, 
    resolveSession, mailQ, mailIn, rtmailAi, rtmail, rtmailTeam, rtmailVak, rtmailDraad, rtmailSchrijf, rtmailRegels, rtmailDossier, rtmailSla, rtmailRecht, rtmailBewaar, scanNet, wacht, werkmail
  };
};
