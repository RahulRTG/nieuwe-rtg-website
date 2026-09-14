/* DE GEZINSDEUR VAN HET LAB-FONDS -- de poort, de verfijner en de afhandeling.

   WAAROM DIT EEN EIGEN BESTAND IS. routes/labfonds.js kwam met deze tweede
   deur op 9907 bytes en dat is binnen de waarschuwingsband van
   keuringsregel 13 (> 9400, grens 10240): `keuringOmvang` in NORM.json ging
   van 327 naar 328, en die ratel mag alleen dalen. De keuring zegt er zelf bij
   wat de bedoeling is -- "knip er een deelbestand af zolang het rustig kan" --
   en dit is de natuurlijke naad.

   WAT HIER NIET HEEN GAAT: de ROUTES. Die blijven in routes/labfonds.js staan,
   alle zestien bij elkaar. Dat is met opzet en het is de duurste les van deze
   tak: acht /api/rtf/samen-routes zijn eerder in een tweede bestand
   geschreven terwijl routes/rtfschool.js ze al registreerde, en Express kwam
   er nooit aan toe -- dood spoor, en geen enkele toets zag het. Een deur
   verhuizen mag; zijn adres verhuizen niet.

   En de NAMEN blijven precies zoals ze waren. `gezinsPoort` en `nietBeschermd`
   staan als zodanig verklaard in server/kern/handlerpoorten/buiten.js en
   scripts/lib/bewakers.js, en keuringsregel 28 leest de naam die VOOR de
   handler staat. Een poort hernoemen omdat hij verhuist, maakt hem voor drie
   registers tegelijk onzichtbaar.

   De uitleg bij elk van de drie stukken staat hieronder, waar het stuk woont. */
'use strict';
const envelop = require('../opzet/envelop');

module.exports = ({ rtf, veilig }) => {
  /* DE GEZINSDEUR, als POORTWACHTER en niet als controle binnen de handler.

     Dat is geen stijlkeuze. Een poort die inline in de afhandeling staat, is
     voor de router onzichtbaar en dus ook voor de bewakerskaart, de
     schaduwmeting en keuringsregel 28 -- die laatste leest wat er VOOR de
     handler staat, en terecht: valse goedkeuring is daar de gevaarlijke
     richting. Als middleware staat hij op precies een plek, is hij per route te
     zien, en kan hij niet per ongeluk bij een volgende route wegvallen. Zelfde
     vorm als routes/rtfleerling.js. */
  function gezinsPoort(req, res, next) {
    const b = req.body || {};
    const sess = rtf.verifieerProfiel(b.code, b.token);
    if (!sess) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
    /* GASTEN ERBUITEN, ook om te kijken -- en dat is de naam die dit contract
       draagt. server/kern/handlerpoorten/buiten.js verklaart `gezinsPoort` als
       "rtf.verifieerProfiel(code, token)" met gasten eruit, en routes/tiener.js
       en baby.js doen dat al zo. Hier een zachtere variant onder dezelfde naam
       bouwen zou dat verklaarde contract stil uithollen. Inhoudelijk klopt het
       ook: gezinshulp.js sluit een gast uit van de privezaken van het gezin, en
       geld is daar het eerste voorbeeld van. */
    if (sess.gast) return res.status(403).json({ error: 'Dit is van de gezinsleden zelf.' });
    req.gezinslid = sess;
    envelop.zet(req, { soort: 'gezinslid', id: sess.handle || sess.profielId || null,
      rol: sess.rol || null, identiteit: 'bewezen',
      tenantSoort: 'gezin', tenantId: String(b.code || '').toUpperCase() || null });
    next();
  }

  /* TOEZEGGEN EN STEMMEN VRAGEN EEN VOLWASSEN PROFIEL, en de verfijner heet
     `nietBeschermd` omdat die naam AL bestaat met precies deze betekenis:
     scripts/lib/bewakers.js verklaart hem als "sluit een beschermd kind uit
     binnen gezinsPoort", en routes/social/gezinnen.js gebruikt hem zo. Mijn
     eerste versie heette `volwassenGezin`, en de idemproef meldde hem prompt
     als "bewaker van onbekende soort" -- terecht: een tweede naam voor dezelfde
     verfijner maakt de bewakerskaart onleesbaar. De TEKST verschilt wel, en dat
     hoort: bij vrienden toevoegen leest een kind "je ouder voegt vrienden voor
     je toe", hier gaat het over geld.

     Dat is geen nieuwe regel
     maar twee bestaande naast elkaar gelegd: server/foundation/gezinshulp.js
     zegt bij isGast met zoveel woorden dat een gast niet bij de privezaken van
     het gezin mag komen "(geld, ...)", en isBeschermd markeert de
     minderjarige profielen. Een kind laten toezeggen en laten meestemmen over
     onderzoeksgeld zou allebei die grenzen passeren.

     KIJKEN MAG HET HELE GEZIN, ook een gast en ook een kind: wie MAG KIJKEN
     begrenzen zou hier een oordeel zijn over wie zijn eigen fonds mag zien, en
     dat is precies wat FOUNDATION.md par. 5 verbiedt. Deze laag staat daarom
     NAAST gezinAuth en niet erin. */
  const nietBeschermd = (req, res, next) => {
    if (req.gezinslid.beschermd) {
      return res.status(403).json({ error: 'Toezeggen en stemmen doet een volwassene uit het gezin.' });
    }
    next();
  };

  /* De HANDLE is de sleutel in het grootboek en niet de gezinscode: hij draagt
     het voorvoegsel `rtf:` en kan daardoor structureel niet botsen met de
     sleutel van een lid. Wie hier de gezinscode zou doorgeven, laat het hele
     gezin als EEN toezegger in het boek staan -- nagemeten: een gezin dat 25
     toezegt en een lid dat 40 toezegt houden ieder hun eigen bijdrage, en de
     pot telt 65. */
  const alsGezin = (werk) => (req, res) => {
    const sess = req.gezinslid;
    veilig(res, () => werk(sess.handle, sess.codenaam || 'Gezinslid', req.body || {}));
  };

  return { gezinsPoort, nietBeschermd, alsGezin };
};
