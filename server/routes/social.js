/* Sociale laag (aparte module, draait op de gedeelde kern): de vriendenlaag
   over RTG en RTFoundation, plus snaps, 24-uurs verhalen en het bellen.
   Praat alleen via de kern met de gedeelde data en realtime, zodat dit domein
   later als een eigen proces kan draaien zonder de routes aan te passen. */
module.exports = (kern) => {
  const { app, express, auth, geenGast, db, save, rtf, webpush, socialZoek, socialVerbind, ouderVerbind, socialAntwoord, socialConnecties, socialDm, socialDmSend, socialGoedkeur, socialTeKeuren, liveCodename, connectieTussen, verbActief, dmSleutel, codenaamVan, sseToCustomer, sseClients, sseSend, snapSturen, snapsVoor, snapOpenen, verhaalPlaatsen, verhalenVoor, verhaalBekijken, dagOpdracht, speelOpnieuw, isGeblokkeerd, blokkeer, deblokkeer, meldMisbruik, kindContacten, kindVerwijder, onboarding, lidBoard, lidBoardZet } = kern;

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
  const sctx = { kern, isKindVanGezin, rtfOnbSess, rtfSociaal };
  require('./social/leden')(sctx);
  require('./social/gezinnen')(sctx);


// web-push: publieke sleutel + subscription opslaan
app.get('/api/push/key', (req, res) => {
  res.json({ key: webpush && db.data.vapid ? db.data.vapid.publicKey : null });
});

/* ICE-servers voor WebRTC-bellen (leden onderling en de RTFoundation-gezinnen).
   STUN werkt voor de meeste verbindingen; achter een streng mobiel netwerk
   (symmetrische NAT) is een TURN-server nodig om het beeld er altijd doorheen te
   krijgen. Zet die aan met de omgevingsvariabelen TURN_URL/TURN_USER/TURN_PASS.
   Zie docs/turn-server.md voor de volledige productie-opzet. */
/* TURN: het relais dat (video)bellen ook door strenge firewalls en 4G-NAT
   heen laat werken. Voorkeursroute: TURN_SECRET (coturn "use-auth-secret"),
   dan maakt de server per aanvraag KORTLEVENDE inloggegevens (1 uur geldig,
   HMAC over het verloopmoment) in plaats van een vast wachtwoord dat op
   straat kan komen. Vast TURN_USER/TURN_PASS blijft werken als terugval. */
function iceServers() {
  const list = [{ urls: (process.env.STUN_URL || 'stun:stun.l.google.com:19302').split(',').map(s => s.trim()) }];
  const urls = process.env.TURN_URL ? process.env.TURN_URL.split(',').map(s => s.trim()) : null;
  if (urls && process.env.TURN_SECRET) {
    const nodeCrypto = require('crypto');
    const username = Math.floor(Date.now() / 1000 + 3600) + ':rtg';
    const credential = nodeCrypto.createHmac('sha1', process.env.TURN_SECRET).update(username).digest('base64');
    list.push({ urls, username, credential });
  } else if (urls && process.env.TURN_USER && process.env.TURN_PASS) {
    list.push({ urls, username: process.env.TURN_USER, credential: process.env.TURN_PASS });
  }
  return list;
}
app.get('/api/ice', (req, res) => res.json({ iceServers: iceServers() }));
};
