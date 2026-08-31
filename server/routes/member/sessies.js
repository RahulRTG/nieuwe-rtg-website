/* ============================================================================
   MIJN RTG: MIJN SESSIES -- waar ben ik aanwezig, en hoe zet ik dat uit.

   Dit is blok 2 van MIJNRTG.md, en het kon pas nadat blok 1 er stond. De reden
   staat in de kop van kern/identiteit/sessieregister.js: een lid-token is
   staatloos, dus tot voor kort BESTOND een sessie niet als ding en was deze
   lijst niet leeg maar onmogelijk.

   DRIE DINGEN DIE HIER NIET MOGEN VERSCHUIVEN.

   1. WAT ER STAAT, IS GEMETEN. Elke regel toont per veld zijn bewijsgraad met
      de reden erbij, en een veld dat nooit is vastgesteld zegt dat -- het wordt
      niet weggelaten en er wordt niets voor verzonnen. Dit scherm is precies
      het scherm waar een verzonnen "iPhone 16 Pro, Amsterdam" vanzelf ontstaat
      als niemand die grens bewaakt (MIJNRTG.md par. 2).

   2. SLUITEN WERKT ECHT. Een knop die {ok:true} teruggeeft terwijl het token
      blijft werken, is precies de fout die aanvalsronde 2 punt 14 hier al een
      keer vond bij /api/logout. Vandaar dat het intrekken op de SID gebeurt
      (accounts/intreklijst.js) en niet op het token: het token van dat andere
      toestel heb je niet, en dat is nou juist het toestel dat je kwijt bent.

   3. DE HUIDIGE SESSIE IS GEEN BIJZONDER GEVAL DAT JE OVERSLAAT. Je mag hem
      sluiten -- dat is gewoon uitloggen. Maar "sluit alle andere" doet hem
      nooit, want anders zet een mens zichzelf buiten terwijl hij juist bezig is
      een indringer buiten te zetten.
   ========================================================================== */
'use strict';

/* De maximale levensduur van een token; de intreklijst wil weten tot wanneer
   hij een sid moet onthouden en een sid draagt zelf geen tijd. Te ruim schatten
   is de veilige kant: de regel blijft dan iets langer liggen dan nodig. */
const TOKEN_MAX_MS = 30 * 24 * 3600 * 1000;

module.exports = (kern) => {
  const { app, auth, accounts, sessieregister, toestellen, handelingsspoor } = kern;

  const eisLid = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'Alleen voor leden.' }); return false; }
    if (!req.session.account) { res.status(403).json({ error: 'Dit hoort bij een eigen RTG-account.' }); return false; }
    return true;
  };

  /* Een spoor bij elke sluiting. Wie een sessie sluit doet iets aan zijn eigen
     beveiliging, en dat is precies wat je bij een incident wilt terugzien. Het
     draagt de sid en nooit een token. */
  const spoor = (req, wat, extra) => {
    try { if (handelingsspoor) handelingsspoor.leg(req.session.key, wat, extra || {}); } catch (e) {}
  };

  /* ---- de lijst ---- */
  app.post('/api/mijn/sessies', auth, (req, res) => {
    if (!eisLid(req, res)) return;
    const rijen = (sessieregister ? sessieregister.vanLid(req.session.key) : []).map(r => {
      /* DE NAAM KOMT HIER BIJ ELKAAR, en niet uit de sessie. De sessie draagt
         alleen de toestelId (kern/identiteit/sessievelden.js verbiedt de naam,
         want een sessie repliceert over een bus); het toestelregister draagt de
         naam die het lid zelf gaf. Onbekend of ingetrokken toestel geeft null,
         nooit een gok -- anders staat er "MacBook" bij iets anders. */
      const tid = r.toestelId;
      return Object.assign({}, r, { toestelNaam: tid && toestellen ? toestellen.naamVan(req.session.key, tid) : null });
    });
    /* WAAROM HIER EEN UITLEG BIJ ZIT EN GEEN AANTAL. Een lijst met "3 actieve
       apparaten" nodigt uit tot geruststelling; deze lijst hoort te zeggen wat
       zij NIET weet. Sessies van voor blok 1 dragen geen sid en staan er dus
       niet in -- dat verzwijgen zou de lijst laten liegen over hoeveel ingangen
       er open staan. */
    res.json({
      huidige: req.session.sid || null,
      sessies: rijen,
      nietGetoond: req.session.sid ? null :
        'Deze sessie is gestart voordat RTG sessies kon identificeren. Zij staat niet in de lijst en is hier niet te sluiten; log uit en opnieuw in om haar zichtbaar te maken.',
      uitleg: 'Elke regel toont per onderdeel hoe zeker RTG het weet. Wat wij nooit hebben vastgesteld, staat er als onbekend -- daar vullen wij niets voor in.'
    });
  });

  /* ---- een sessie sluiten ---- */
  app.post('/api/mijn/sessies/sluit', auth, (req, res) => {
    if (!eisLid(req, res)) return;
    const sid = String(req.body.sid || '');
    const rij = sessieregister && sessieregister.lees(sid);
    /* EIGENDOM EERST. Zonder deze regel kan ieder lid met een geldige sessie de
       sid van een ander opgeven en die uitloggen -- een sid is geen geheim, hij
       staat in een token dat iemand anders draagt. Hetzelfde antwoord voor
       "bestaat niet" en "niet van u", zodat dit geen manier wordt om te
       ontdekken welke sids bestaan. */
    if (!rij || rij.lidKey !== req.session.key) {
      return res.status(404).json({ error: 'Die sessie kennen wij niet.' });
    }
    accounts.trekInSessie(sid, Date.now() + TOKEN_MAX_MS);
    sessieregister.sluit(sid);
    spoor(req, 'sessie-gesloten', { sid, eigen: sid === req.session.sid });
    res.json({ ok: true, gesloten: sid, ditWasUzelf: sid === req.session.sid,
      bewijs: 'Het token van deze sessie is ingetrokken. Een volgend verzoek ermee wordt geweigerd, ook als het toestel offline was toen u dit deed.' });
  });

  /* ---- alle andere sluiten ---- */
  app.post('/api/mijn/sessies/sluit-overige', auth, (req, res) => {
    if (!eisLid(req, res)) return;
    const hier = req.session.sid;
    const rijen = sessieregister ? sessieregister.vanLid(req.session.key) : [];
    const gesloten = [];
    for (const r of rijen) {
      if (r.sid === hier) continue;              // nooit de sessie waarin u dit doet
      accounts.trekInSessie(r.sid, Date.now() + TOKEN_MAX_MS);
      sessieregister.sluit(r.sid);
      gesloten.push(r.sid);
    }
    spoor(req, 'sessies-gesloten', { aantal: gesloten.length });
    res.json({ ok: true, aantal: gesloten.length, gesloten,
      /* Eerlijk over de reikwijdte: dit sluit wat wij KENNEN. Een sessie zonder
         sid valt hier buiten, en dat hoort een mens te weten voordat hij denkt
         dat hij klaar is. */
      nietGeraakt: hier ? 'Deze sessie blijft open. Sessies van voor de invoering van sessie-identiteit staan niet in de lijst en zijn hiermee niet gesloten; wijzig uw wachtwoord als u die ook wilt beeindigen.'
        : 'Deze sessie draagt geen identiteit en kon zichzelf niet uitzonderen; er is niets gesloten.' });
  });
};
