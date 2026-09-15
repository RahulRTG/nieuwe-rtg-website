/* DE GEZINSDEUR VAN FOUNDATION CONNECT -- de poort en de twee mens-uitlezers.

   WAAROM DIT EEN EIGEN BESTAND IS. routes/connect.js kwam met de gastgrens op
   10,5 KB en dat is over keuringsregel 13. Dit is de natuurlijke naad: daar
   staan de DEUREN, hier staat wie erdoorheen komt.

   WAT HIER NIET HEEN GAAT: de ROUTES. Die blijven in routes/connect.js staan,
   alle tweeentwintig bij elkaar. Dat is met opzet en het is de duurste les van
   routes/labfonds-gezinsdeur.js: acht /api/rtf/samen-routes zijn eerder in een
   tweede bestand geschreven terwijl een ander bestand ze al registreerde, en
   Express kwam er nooit aan toe -- dood spoor, en geen enkele toets zag het.
   Een deur verhuizen mag; zijn adres verhuizen niet.

   En de NAAM blijft precies zoals hij was. `gezinsPoort` staat als zodanig
   verklaard in server/kern/handlerpoorten/buiten.js en scripts/lib/bewakers.js,
   en keuringsregel 28 leest de naam die VOOR de handler staat. Een poort
   hernoemen omdat hij verhuist, maakt hem voor drie registers tegelijk
   onzichtbaar. */
'use strict';

module.exports = ({ rtf }) => {
  /* DE GEZINSDEUR als POORTWACHTER en niet als controle in de handler. Zelfde
     vorm en zelfde naam als routes/labfonds-gezinsdeur.js: `gezinsPoort` staat
     als zodanig verklaard in kern/handlerpoorten/buiten.js, en keuringsregel 28
     leest de naam die VOOR de handler staat. Een eigen naam hier zou hem voor
     de bewakerskaart onzichtbaar maken. */
  function gezinsPoort(req, res, next) {
    const b = req.body || {};
    const sess = rtf && rtf.verifieerProfiel ? rtf.verifieerProfiel(b.code, b.token) : null;
    if (!sess) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
    /* GASTEN ERBUITEN, en dat hoort bij de NAAM. kern/handlerpoorten/buiten.js
       verklaart `gezinsPoort` als "rtf.verifieerProfiel(code, token), gasten
       eruit"; een zachtere variant onder diezelfde naam holt dat verklaarde
       contract stil uit -- precies waar de kop van routes/labfonds-gezinsdeur.js
       voor waarschuwt.

       INHOUDELIJK KLOPT HET OOK, en dat is belangrijker dan het register. Bij
       /api/rtf/knelpunt mag een gast WEL kijken, want die route rekent en
       bewaart niets. Hier bewaart elke deur iets van de mens zelf, en de vierde
       voorwaarde van het leerdossier is dat het aan de CODENAAM hangt -- en
       foundation/gezinshulp.js roept `ensureCodenaam` juist NIET aan voor een
       gast. Een gast een dossier geven zou dus of die voorwaarde breken, of een
       record opleveren dat aan een tijdelijk profiel hangt en bij het volgende
       bezoek wees is. Beter dicht, met de reden. */
    if (sess.gast) return res.status(403).json({
      error: 'Dit is voor de gezinsleden zelf. Wat u hier ontdekt en leert, wordt bij uw eigen profiel ' +
        'bewaard, en een gastprofiel heeft er geen.' });
    req.gezinslid = sess;
    next();
  }

  /* De twee dingen die een handler van een mens nodig heeft, en verder niets:
     een sleutel om zijn eigen spullen aan te hangen, en of hij beschermd is. */
  const lid = (req) => ({ sleutel: req.session.key, beschermd: false });
  const gezin = (req) => ({ sleutel: req.gezinslid.handle, beschermd: !!req.gezinslid.beschermd });

  return { gezinsPoort, lid, gezin };
};
