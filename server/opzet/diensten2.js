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

const envelop = require('./envelop');
const kostenhaak = require('../kern/kosten/haak');

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
/* Trede 1 van de noodrem-ladder (beveiliging.js): elke brute-force-bron gaat
   individueel in de zelf-dovende quarantaine van De Wacht, voordat er ook
   maar een zekering aan te pas komt. */
beveilig.zetIsoleer((bron, reden) => wacht.isoleer(bron, reden));
const atelierweb = require('../kern/atelierweb')({ db, save, crypto, schoon });
// de persoonlijke naamlaag: eigen etiketten op codenamen, alleen in het eigen account
const naamlaag = require('../kern/naamlaag')({ db, save, schoon });
{
  const t = setInterval(() => { try { wacht.meet(); } catch (e) {} }, 10000);
  if (t.unref) t.unref();
}

/* De Ontsmetter (kern/antivirus.js): de platform-malware-scanner. Elk bestand
   dat RTG binnenkomt wordt gescand (handtekeningen + heuristiek + entropie);
   besmette inhoud wordt geweigerd, gemeld op het bord, en de bron wordt via De
   Wacht ter afsnijding voorgesteld. */
const antivirus = require('../kern/antivirus')({ db, save, beveilig, wacht });
/* Onbekende bytes staan eerst in een niet-geserveerde werkmap. In Docker
   keurt daarnaast een losse ClamAV-container de exacte bytes via INSTREAM;
   als die engine niet antwoordt, komt geen upload bij een route terecht. */
const uploadquarantaine = require('../kern/uploadquarantaine').maakUploadquarantaine({ dir: DATA_DIR, antivirus });
// De bestandenkluis gebruikt dezelfde poort ook nadat losse uploadstukken op
// de server tot één bestand zijn samengevoegd.
antivirus.keurDataUrl = uploadquarantaine.keurDataUrl;

/* DE POSTLAAG. Elf modules die samen RTG Mail zijn: bezorgen, adressen, teams,
   postvakken, gesprekken, schrijven, regels, dossiers, klok, rechten en
   bewaarbeleid. Ze staan in ./postlaag.js omdat dit bestand anders over de tien
   kilobyte gaat -- en omdat de BOUWVOLGORDE daar iets betekent: de haak na de
   bezorging kan pas gezet worden als de regels en de klok bestaan.

   STAAT HIER EN NIET HOGEROP omdat de bijlagenlaag De Ontsmetter nodig heeft.
   Dat is geen willekeurige volgorde maar de regel zelf: zonder scanner bewaart
   die laag geen enkele bijlage, en een postlaag die vóór de scanner wordt
   gebouwd zou hem stilzwijgend missen. */
const post = require('./postlaag')({ db, save, crypto, findSupplier, antivirus, DATA_DIR });
const { mailQ, mailIn, mailAuth, mailBijlage, mailSleutel, rtmailAi, rtmail, rtmailTeam, rtmailVak, rtmailDraad, rtmailSchrijf, rtmailRegels,
  rtmailDossier, rtmailSla, rtmailRecht, rtmailBewaar } = post;
// De automatiseringen (draaiboeken) lopen over de RTMAIL-rail
const automatisering = require('../kern/automatisering')({ rtmail, db });
// Werkmail: het zakelijke adresboek per zaak boven op RTMAIL (domein <naam>.rtg,
// eigenaar- en managementadressen, rahul@<domein>, de buitenpost en -poort)
const { werkmail } = require('../kern/werkmail')({ db, save, crypto, rtmail, mail, accounts });
// Foundation bestond al vóór de postlaag; nu krijgt School de levende motor.
try { rtf.setAutomatisering(automatisering); } catch (e) {}
try { rtf.setSchoolMail({ rtmail,
  domeinBezet:d => Object.values((db.data.werkmail && db.data.werkmail.domeinen) || {}).includes(d),
  adresBestaat:a => !!((db.data.werkmail && db.data.werkmail.adressen) || []).find(x => x.adres === rtmail.normAdres(a))
}); } catch (e) {}
/* Post van buiten AANNEMEN, op een plek (kern/mailaanname.js). Twee deuren
   komen hier binnen -- de HTTP-buitenpoort (/api/mail/binnen) en de
   SMTP-ontvanger (server/smtp-in.js) -- en de keten erachter hoort er maar een
   keer te staan. Staat NA werkmail en de teams, want de ontvangertoets vraagt
   die twee of een adres hier een postvak is. */
const { mailAanname } = require('../kern/mailaanname')({ rtmail, mailIn, mailBijlage, mailAuth,
  werkmail, findSupplier, team: rtmailTeam, accounts,
  schoolAdresActief:rtf.schoolMailAdresActief,
  foundationAdresActief:rtf.foundationMailAdresActief });

/* Universeel scan-net: elke schrijf-aanvraag wordt door De Ontsmetter gehaald.
   Zit er een BESMETTE beeld-/PDF-data-URL in de body (waar dan ook, hoe diep
   ook), dan weigeren we hem hier -- zo zijn ALLE upload-plekken (snaps, De Salon,
   markt, clips, en alles wat later bijkomt) in één klap gedekt zonder elke route
   apart aan te raken. Verdacht mag door (staat wel op het bord). /api/verify/*
   scant al expliciet; /api/techniek/* en health blijven ongemoeid.

   Hij wordt hier GEBOUWD maar veel eerder INGEHANGEN (zie het doorgeefluik bij
   app.use(jsonGzip())), want een middleware die na een router staat ziet de
   verzoeken van die router nooit. */
const scanNet = require('../middleware/malwarescan')({ antivirus, uploadquarantaine, log: deps.log });

/* Het sessieregister van MIJN RTG (blok 1). Het houdt de CONTEXT van een sessie
   bij -- waarmee zij ontstond, aan welk toestel zij gebonden is, namens wie er
   gehandeld wordt -- en verleent zelf geen enkele toegang. Zie de kop van
   kern/identiteit/sessieregister.js voor waarom dat een apart ding moet zijn. */
const sessieregister = require('../kern/identiteit/sessieregister').maakSessieregister({ db, save });
/* Het toestelregister hoort naast het sessieregister en niet erin: een toestel
   overleeft zijn sessies, en een sessie kan aan een toestel gebonden zijn zonder
   dat het toestel bij die sessie hoort. Twee levensduren, twee registers. */
const toestellen = require('../kern/identiteit/toestellen').maakToestellen({ db, save });

/* Een token kan een demo-sessie zijn (in-memory) of een echt account-token
   (ondertekend, staatloos). Beide leveren een sessie met tier + unieke key.

   SINDS BLOK 1 hangt er een sid en een context aan, en dat gebeurt HIER omdat
   dit de enige plek is waar beide soorten sessies samenkomen. Twee dingen die
   niet mogen verschuiven:

     1. de context beslist NIETS. Hij komt er additief bij, na de geldigheids-
        toets, en een ontbrekend of vervallen register verandert nooit of iemand
        binnenkomt. Een storing in de bewijslaag hoort niet te klinken als een
        overtreding (CONTROLPLANE.md: ONBEKEND is geen WEIGEREN).
     2. de context wordt GELEZEN, niet aangevuld. Een claim vastleggen gebeurt
        op het moment van authenticatie; wie dat hier zou doen, legt bij elk
        verzoek opnieuw een 'afgeleide' vast en verliest daarmee het bewijs dat
        op het inlogmoment wel te halen was. */
function resolveSession(token) {
  if (!token) return null;
  const demo = sessionFor(token);
  if (demo) return demo.sid ? metContext(demo, demo.sid) : demo;
  const user = accounts.verifyToken(token);
  if (user) {
    const sid = typeof accounts.sessieVan === 'function' ? accounts.sessieVan(token) : null;
    const sess = { tier: user.tier, key: 'user-' + user.id, account: user };
    return sid ? metContext(sess, sid) : sess;
  }
  return null;
}

/* Additief: req.session blijft precies wat hij was, hier komt alleen `sid` en
   een gelezen `sessieContext` bij. Een oud token (drie delen, geen sid) krijgt
   `sid: null` -- "deze sessie heeft geen identiteit", en dat is waar. */
function metContext(sess, sid) {
  sess.sid = sid;
  const rij = sessieregister.lees(sid);
  if (rij) { sess.sessieContext = rij.context; sessieregister.raak(sid); }
  return sess;
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
  /* DE ENVELOP (server/opzet/envelop.js). Additief: req.session blijft precies
     wat hij was, hier komt alleen de canonieke vorm bij zodat een teller, een
     rem of een bonnetje niet zeven vormen hoeft te kennen. `capability` draagt
     de functie-id uit de boardroom -- de enige plek in dit huis waar een
     poortwachter vandaag al een RECHT kent en geen rol. */
  envelop.zet(req, { soort: 'lid', id: sess.key || null, rol: sess.tier || null,
    capability: _fid || null });
  dirTouch(sess);
  /* WIE DRAAGT DE KOSTEN VAN DIT VERZOEK -- één keer, op het keelgat waar elke
     leden-route langs moet; verderop vindt alles de eigenaar in de async-context
     (kern/kosten/haak.js). Het verzoek telt mee, anders leest een gebruiker die
     nooit met de AI praat als kosteloos. */
  const drager = kostenhaak.drager('lid', sess.key);
  kostenhaak.meld('verzoek', 1, { drager, pas: sess.tier });
  kostenhaak.binnen(drager, next, sess.tier);
}

/* Schoonmaakhulp voor vrije tekstvelden: knipt op lengte en haalt < en >
   weg, zodat door gebruikers ingevoerde namen en berichten nooit als
   opmaak in andermans scherm kunnen belanden. */

/* De ledengids (dirTouch, ledenAantal, gidsHaal, gidsZoekCodenaam,
   keyVanCodenaam) staat in server/kern/gids.js en is hierboven, direct na de
   live-laag, opgezet. */

  return {
    aiPoort, antivirus, archief, atelierweb, auth, automatisering, beveilig, naamlaag, 
    resolveSession, sessieregister, toestellen, mailQ, mailIn, mailAuth, mailBijlage, mailSleutel, rtmailAi, rtmail, rtmailTeam, rtmailVak, rtmailDraad, rtmailSchrijf, rtmailRegels, rtmailDossier, rtmailSla, rtmailRecht, rtmailBewaar, mailAanname, scanNet, wacht, werkmail
  };
};
