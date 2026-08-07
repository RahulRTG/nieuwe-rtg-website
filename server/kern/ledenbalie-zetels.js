/* Kern-module "ledenbalie-zetels": WIE er aan de ledenbalie mag zitten.

   Het RTG-kantoor is vandaag een ongedeelde ruimte: je komt binnen met een
   GEDEELDE code, en die code wijst niemand aan. Voor de meeste schermen kan dat
   -- een omzetgrafiek is van niemand in het bijzonder. Maar wie een lid helpt
   met zijn abonnement of zijn wachtwoord raakt het ACCOUNT van dat lid, en dan
   moet achteraf te zeggen zijn wie dat deed. Een anonieme code kan die vraag
   niet beantwoorden. Precies de redenering die de boardroom zelf al voert (zie
   kern/kantoor/index.js): toegang tot iemands dossier vraagt een identiteit.

   Vandaar de zetel: uitgedeeld door de eigenaar, gekoppeld aan een echte inlog
   (key 'user-<id>'), en bewaard zoals de boardroomsleutels dat doen
   (db.data.boardroomToegang) -- zelfde vorm, zelfde duurzame opslag, zodat er
   niet twee soorten toegangslijsten naast elkaar ontstaan die uiteenlopen.

   Los van ledenbalie.js omdat hier de TOEGANG woont en daar het WERK: de zetel
   bepaalt wie er mag zitten, het dossier bepaalt wat er dan te zien is. Ze
   delen geen state en hebben elk hun eigen afhankelijkheden; de knip loopt dus
   langs een echte naad en houdt beide bestanden onder de 10 KB. */
'use strict';

module.exports = ({ db, save, accounts, magBoardroom }) => {
  function lijst() {
    if (!Array.isArray(db.data.balieZetels)) db.data.balieZetels = [];
    return db.data.balieZetels;
  }

  /* Alleen codenamen en momenten naar buiten -- nooit een naam. De key is het
     pseudoniem waarop de rest van het kantoor ook draait; wie er een codenaam
     bij wil tonen, vraagt die aan de gids. */
  function balieZetels() {
    return lijst().map(z => ({ key: z.key, sinds: z.at }));
  }

  /* Een zetel geven. De key moet een ECHTE inlog zijn: 'user-<id>' van een
     bestaand account. Een backoffice-sessie zonder account heeft geen
     identiteit, en dan zijn we terug bij de gedeelde code waar dit hele
     ontwerp een antwoord op is. Twee keer geven is geen fout, maar ook geen
     tweede regel: dubbele rijen zouden het intrekken half laten werken. */
  function balieZetelZet(key) {
    const k = String(key || '').trim();
    if (!/^user-\d+$/.test(k))
      return { status: 400, error: 'Een baliezetel hangt aan een persoonlijke RTG-inlog, niet aan een gedeelde kantoorcode.' };
    let u = null;
    try { u = accounts.getUserById(Number(k.slice(5))); } catch (e) { u = null; }
    if (!u) return { status: 404, error: 'Dit account kennen we niet.' };
    const l = lijst();
    if (!l.some(z => z.key === k)) {
      l.push({ key: k, at: new Date().toISOString() });
      save();
    }
    return { ok: true };
  }

  /* Intrekken mag altijd slagen, ook als de zetel er niet was: de uitkomst die
     de eigenaar wil ("deze persoon zit er niet meer") is dan gewoon waar. */
  function balieZetelWeg(key) {
    const k = String(key || '').trim();
    const l = lijst();
    const rest = l.filter(z => z.key !== k);
    if (rest.length !== l.length) { db.data.balieZetels = rest; save(); }
    return { ok: true };
  }

  /* De boardroom mag altijd aan de balie zitten: die deur is strenger (alleen
     de eigenaar, of wie van hem de sleutel kreeg) en hangt al aan een echte
     inlog. Wie de zwaardere kamer in mag, hoeft niet apart de lichtere te
     krijgen -- dat zou alleen een tweede lijst opleveren die kan verlopen. */
  function magBalie(key) {
    if (!key) return false;
    if (typeof magBoardroom === 'function' && magBoardroom(key)) return true;
    return lijst().some(z => z.key === key);
  }

  return { balieZetels, balieZetelZet, balieZetelWeg, magBalie };
};
