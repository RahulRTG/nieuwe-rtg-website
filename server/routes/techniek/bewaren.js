/* Techniek (deelmodule): de bewaartermijnen.

   Twee dingen die bij elkaar horen en daarom samen in een bestand staan:
   het OVERZICHT (wat staat er over zijn termijn, en welke takken hebben er nog
   helemaal geen) en de KNOP die het opruimt. Het beleid zelf -- welke termijn
   voor welke categorie, en waarom -- staat in server/bewaartermijnen.js.

   Gemount vanuit routes/techniek.js. */
const bewaartermijnen = require('../../bewaartermijnen');
const bewaarwacht = require('../../bewaarwacht');
const { log } = require('../../log');

module.exports = (tctx) => {
  const { app, db, save, beveilig, techAuth, eigenaarAlleen } = tctx;

  /* Het overzicht dat op het techniekbord komt. Twee getallen tellen echt:
     hoeveel er over zijn termijn is, en hoeveel takken er GEEN termijn hebben.
     Dat tweede is het eerlijke -- het toont het gat in plaats van te doen alsof
     het beleid compleet is. */
  function statusDeel() {
    try {
      const r = bewaartermijnen.rapport(db);
      r.zonderBeleid = bewaartermijnen.zonderBeleid(db).slice(0, 20);
      // wanneer keek de wacht voor het laatst, en wanneer meldde hij? Zonder die
      // twee data weet je niet of een groen bord "het is in orde" betekent of
      // "er heeft al een maand niemand gekeken".
      r.wacht = (db.data.techniek && db.data.techniek.bewaarwacht) || null;
      return r;
    } catch (e) { return null; }
  }

  /* DE WACHT: de ronde die vanzelf draait (zie server/bewaarwacht.js).

     Dagelijks tellen is goedkoop -- hij leest alleen datums -- en houdt "laatst
     gecontroleerd" vers. Het MELDEN staat op maandelijks; dat zit in de wacht
     zelf en is in de database vastgelegd, zodat een herstart de teller niet
     wist. Zo blijft het een herinnering en wordt het geen ruis.

     Hij wist nooit iets. Opruimen blijft de knop hieronder, met de hand.

     unref(): een achtergrondtimer mag een afsluitend proces nooit openhouden.
     Bewust GEEN ronde bij het opstarten: het bord rekent zijn cijfers toch live
     uit, dus een ronde bij boot voegt niets toe en zou bij elke herstart van
     elke testserver werk doen dat niemand gevraagd heeft. */
  const RONDE_MS = Number(process.env.RTG_BEWAARRONDE_MS || 24 * 60 * 60 * 1000);
  const wachtTimer = setInterval(() => {
    try { bewaarwacht.ronde(db, { beveilig, save }); }
    catch (e) { log.warn('bewaarronde-mislukt', { fout: e && e.message }); }
  }, RONDE_MS);
  if (wachtTimer.unref) wachtTimer.unref();

  /* Toepassen: wat over zijn termijn is, gaat weg.

     Twee sloten, allebei met reden. Alleen de eigenaar, want dit wist gegevens
     van leden. En zonder { bevestig: 'WIS' } draait hij als PROEF: je ziet wat
     er zou verdwijnen, er verandert niets. Wissen is onomkeerbaar, en een lijst
     die je niet eerst hebt gelezen voer je niet uit -- zo raak je per ongeluk
     zeven jaar administratie kwijt. */
  app.post('/api/techniek/bewaren/veeg', techAuth, eigenaarAlleen, (req, res) => {
    const echt = req.body && req.body.bevestig === 'WIS';
    const r = bewaartermijnen.veeg(db, { echt });
    if (echt && r.totaal) {
      save();
      log.warn('bewaartermijnen-geveegd', { totaal: r.totaal, door: req.techUser && req.techUser.id });
      if (beveilig) beveilig.meld('bewaartermijnen-geveegd', 'waarschuwing',
        r.totaal + ' item(s) verwijderd omdat ze over hun bewaartermijn waren.',
        { bron: 'user:' + (req.techUser && req.techUser.id) });
    }
    res.json({
      ...r,
      uitleg: echt
        ? 'Verwijderd. Dit is niet terug te draaien; herstellen kan alleen uit een backup.'
        : 'Dit was een PROEF: er is niets verwijderd. Stuur bevestig: "WIS" mee om het echt te doen.'
    });
  });

  return { statusDeel };
};
