/* Sociale laag (aparte module, draait op de gedeelde kern): de vriendenlaag
   over RTG en RTFoundation, plus snaps, 24-uurs verhalen en het bellen.
   Praat alleen via de kern met de gedeelde data en realtime, zodat dit domein
   later als een eigen proces kan draaien zonder de routes aan te passen. */
const turnConfig = require('../config/turn');

function iceServers(req, env = process.env) {
  // Standaard onze EIGEN STUN-server (server/stun.js), afgeleid van de host waarop
  // het lid de app bereikt (of STUN_PUBLIC_HOST/STUN_URL). Geen Google meer, tenzij
  // je die expliciet als terugval aanzet met STUN_FALLBACK_GOOGLE=1.
  const publiekeProductie = env.NODE_ENV === 'production' && env.RTG_PRIVATE_BETA !== '1';
  const stunProjectie = turnConfig.projecteerStun({ APP_URL:env.APP_URL,
    STUN_URL:env.STUN_URL, STUN_PUBLIC_HOST:env.STUN_PUBLIC_HOST, STUN_PORT:env.STUN_PORT },
  { publiekeProductie, requestHost:req && req.hostname });
  const stun = stunProjectie.urls ? [...stunProjectie.urls] : [];
  if (!publiekeProductie && env.STUN_FALLBACK_GOOGLE === '1') stun.push('stun:stun.l.google.com:19302');
  const list = [];
  if (stun.length) list.push({ urls:stun });
  // Expliciete allowlist: de TURN-laag krijgt geen volledige procesomgeving en
  // de statische configuratie-audit kan zien welke runtimevelden echt werken.
  const relay = turnConfig.projecteerTurn({ TURN_URL:env.TURN_URL,
    TURN_SECRET:env.TURN_SECRET, TURN_USER:env.TURN_USER, TURN_PASS:env.TURN_PASS },
  { publiekeProductie });
  if (relay.server) list.push(relay.server);
  return list;
}

function socialeRoutes(kern) {
  const { app, db, rtf, webpush, pinBeveiliging } = kern;

  // Hoort dit kind-handle echt bij het gezin van deze beheerder? (voogd-check)
  const isKindVanGezin = (gezinCode, kindHandle) =>
    rtf.socialProfielen().some(sp => sp.handle === kindHandle && sp.gezinCode === gezinCode && sp.beschermd);
  // Een RTF-profiel als onboarding-sessie: de handle is de sleutel, tier 'rtf'.
  const rtfOnbSess = (s) => ({ key: s.handle, tier: 'rtf', account: null });
/* ---------- vriendenlaag en snaps: RTFoundation-kant (gezin-token) ----------
   Een gezinslid (geen gast) doet mee met dezelfde vriendenlaag als de RTG-app,
   zodat RTF en RTG elkaar op codenaam vinden, chatten, snappen en verhalen delen.
   Kinderen hebben ouderakkoord nodig. */
function rtfSociaal(req, res) {
  const sess = rtf.verifieerProfiel(req.body.code, req.body.token);
  if (!sess) { res.status(403).json({ error: 'Log opnieuw in bij je gezin.' }); return null; }
  if (sess.gast) { res.status(403).json({ error: 'Als oppas of familielid doe je hier niet mee.' }); return null; }
  return sess;
}


  /* De leden- en gezinnenlaag draaien als submodules op de gedeelde kern
     plus de sessie-helpers, een keer gemount bij het opstarten. */
  /* DE BON VAN RTG LINK, EEN KEER (LINK.md par. 4, stap 6). Hij stond in
     ./social/pin.js, en toen de gezinskant zijn eigen linkdeur kreeg zou dat de
     tweede kopie zijn geworden -- met als uitkomst dat "mijn koppelingen" aan de
     ene kant wel en aan de andere kant niet vertelt wat je hebt gedaan. Precies
     dat gat vond test/linkgezin.test.js.

     linkBon wordt OP AANROEPMOMENT uit de kern gehaald: de sociale routes hangen
     eerder dan RTG Link (opzet/aanbouw2.js), dus hierboven uitlezen levert voor
     altijd undefined op.

     Hij mag het verzoek nooit omgooien -- dat is al gelukt als we hier zijn --
     maar ook niet stil mislukken (LAT.md regel 5): een lege bonnenlijst leest
     als "ik heb niets gedaan", en dat is dan niet waar. */
  function linkBon(wie, vorm, naar) {
    try {
      if (typeof kern.linkBon !== 'function') throw new Error('de linklaag draait hier niet');
      kern.linkBon({ wie, type: 'persoon', intentie: 'contact.verbinden', vorm, naar });
    } catch (e) { console.warn('[link] bon niet geschreven voor ' + vorm + '-verbinding: ' + (e && e.message)); }
  }

  const pinClusterRem = require('../kern/sociaal/pin-clusterrem')({ crypto: kern.crypto });
  const sctx = { kern, isKindVanGezin, rtfOnbSess, rtfSociaal, linkBon, pinClusterRem, pinBeveiliging };
  require('./social/leden')(sctx);
  require('./social/pin')(sctx);
  require('./social/snaps')(sctx);
  require('./social/naamlaag')(sctx);
  require('./social/gezinnen')(sctx);
  require('./social/klets')(sctx);


// web-push: publieke sleutel + subscription opslaan
app.get('/api/push/key', (req, res) => {
  res.json({ key: webpush && db.data.vapid ? db.data.vapid.publicKey : null });
});

/* ICE-servers voor WebRTC-bellen (leden, personeel, kantoor en de
   RTFoundation-gezinnen). STUN gaat naar iedereen; een TURN-credential alleen
   naar een GEAUTHENTICEERDE actor en, in publieke productie, alleen als de
   relaystand bewezen gereed is (kern/rtc/ijs.js, kern/rtc/relaystand.js). De
   actor komt uit de sessie, nooit uit het verzoeklichaam. Zie
   docs/turn-server.md voor de productie-opzet. */
const ijs = require('../kern/rtc/ijs');
app.get('/api/ice', (req, res) => ijs.stuur(res, ijs.antwoord(ijs.bearerActor(req, kern.resolveSession), { hostname: req.hostname })));
app.post('/api/ice', (req, res) => ijs.stuur(res, ijs.antwoord(ijs.bearerActor(req, kern.resolveSession), { hostname: req.hostname })));
/* De relaystand voor de bewaking en de release-sonde: AFGELEID bij elke vraag,
   zonder credentials of geheimen. Alleen lezen; er bestaat geen schrijfroute. */
const relaystand = require('../kern/rtc/relaystand');
app.get('/api/rtc/stand', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const st = relaystand.stand();
  res.json({ beschikbaar: st.beschikbaar, relayVereist: st.relayVereist, geverifieerd: st.geverifieerd,
    reden: st.reden, laatsteProef: relaystand.publiekeUitslag() });
});
relaystand.start(process.env);
}

socialeRoutes.iceServers = iceServers;
module.exports = socialeRoutes;
