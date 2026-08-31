/* DE BOARDROOM-POORT -- de kamer van de eigenaar, en een eigen bestand.

   Hij stond in ./index.js, tot dat bestand over de tienkilobytegrens van
   keuringsregel 13 groeide. De naad ligt waar ./kluispoort.js en ./metrics.js
   hem al hadden gelegd: index.js draagt de backofficedeur zelf (officeAuth, de
   stand en de KYC-wachtrij), en elke STRENGERE poort erachter woont naast hem.

   Dit is de strengste van de drie: waar officeAuth een anonieme kantoorcode
   toelaat, vraagt de boardroom een IDENTITEIT -- en dat verschil is de hele
   reden dat hij niet als vlag op officeAuth is gebouwd.
   ========================================================================== */
'use strict';

module.exports = function maakBoardroom({ db, sessionFor, accounts, eigenaar, officeAuth, envelop }) {
/* ---- de boardroom-poort: de kamer van de eigenaar ----
   De boardroom is van de eigenaar (Rahul Imran Ismail) alleen; hij kan
   anderen toegang geven en die ook weer intrekken. Toegang vraagt dus een
   IDENTITEIT: het eigen RTG-account (direct, of als kantoor-rol via het
   ene account). Een anonieme backoffice-code heeft geen identiteit en
   komt er daarom nooit in; de rest van het kantoor blijft gewoon open. */
function boardroomLijst() {
  if (!Array.isArray(db.data.boardroomToegang)) db.data.boardroomToegang = [];
  return db.data.boardroomToegang;
}
function boardroomWie(req) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  const sess = sessionFor(token);
  if (sess && sess.role === 'office') return sess.lidKey || null;
  try { const u = accounts.verifyToken(token); if (u) return 'user-' + u.id; } catch (e) {}
  return null;
}
function boardroomBaas(key) {
  if (!key || !String(key).startsWith('user-')) return false;
  const u = accounts.getUserById(Number(String(key).slice(5)));
  return eigenaar.isEigenaar(accounts, u);
}
function magBoardroom(key) {
  return boardroomBaas(key) || (!!key && boardroomLijst().some(t => t.key === key));
}
function boardroomAuth(req, res, next) {
  officeAuth(req, res, () => {
    const key = boardroomWie(req);
    if (!magBoardroom(key)) {
      return res.status(403).json({ error: 'De boardroom is gesloten: alleen de eigenaar komt binnen, of wie van hem toegang heeft gekregen. Log in met het eigen RTG-account.' });
    }
    req.boardroomKey = key;
    req.boardroomBaas = boardroomBaas(key);
    // scherper dan officeAuth: een sleutel EN waar de bevoegdheid vandaan komt
    envelop.zet(req, { soort: req.boardroomBaas ? 'eigenaar' : 'kantoor', id: key,
      identiteit: 'bewezen', gezagBron: req.boardroomBaas ? 'eigenaar' : 'toegekend',
      gezagBaas: !!req.boardroomBaas });
    next();
  });
}

  return { boardroomLijst, boardroomWie, boardroomBaas, magBoardroom, boardroomAuth };
};
