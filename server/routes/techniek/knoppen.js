/* DRIE KNOPPEN VAN DE EIGENAAR: de zelfproef van de alarmweg, de zekering, en
   het wissen van de storingslijst.

   Ze staan samen omdat ze hetzelfde soort ding zijn -- een handeling die iets
   aan- of uitzet en die ALLEEN de eigenaar mag doen -- en apart van
   ../techniek.js omdat dat bestand iets anders doet: het monteert de domeinen.
   Een montagebestand waar ook drie handelingen in staan, groeit met elke vierde
   handeling en met elk vijfde domein tegelijk. En het liep tegen de 10 kB.

   Alle drie eigenaar-only, en per stuk om een eigen reden. Die redenen staan bij
   de routes zelf, want daar hoort de grens uitgelegd te worden. */
'use strict';

module.exports = ({ app, kern, accounts, staat, save, log, beveilig, techAuth, eigenaarAlleen }) => {
  /* DE ZELFPROEF VAN DE ALARMWEG.

     Op de go-live-lijst stond "er komt een testfout binnen" als vinkje. Dat is
     niet af te vinken zonder met de hand een echte storing te veroorzaken, dus
     werd het afgevinkt op vertrouwen -- en juist die regel wees naar
     SENTRY_DSN, een variabele die niets leest. Een alarm dat je niet kunt
     beproeven is geen alarm.

     Deze knop stuurt een echte POST naar de ingestelde webhook, met soort
     "zelfproef" zodat de ontvanger weet dat het geen storing is, en WACHT op
     het antwoord. Je krijgt terug of het adres klopt, in plaats van te hopen.

     Alleen de eigenaar: het adres van de alarmweg is bedrijfsgevoelig, en een
     knop die verkeer naar buiten stuurt hoort niet bij iedereen met toegang
     tot het techniekbord te liggen. */
  app.post('/api/techniek/alarm/proef', techAuth, eigenaarAlleen, async (req, res) => {
    const melder = kern.foutmelder;
    if (!melder) return res.status(503).json({ ok: false, reden: 'de fout-melder is niet bedraad.' });
    const wie = (() => { try { return req.techUser ? accounts.realNameOf(req.techUser) : 'eigenaar'; } catch (e) { return 'eigenaar'; } })();
    const r = await melder.zelfproef(wie);
    res.json(Object.assign({ ok: !!r.ok }, r, { stand: melder.stand() }));
  });

  // Zekering resetten ("er weer in doen") of met de hand uitschakelen.
  app.post('/api/techniek/zekering', techAuth, eigenaarAlleen, (req, res) => {
    const t = staat();
    /* hasOwnProperty, geen kale indexering: met id "__proto__" leverde
       t.zekeringen[id] het prototype van Object op. Dat is truthy, dus de
       controle hieronder liet hem door, en de regels erna zetten .aan en
       .reden op Object.prototype -- vanaf dat moment heeft ELK object in dit
       proces die velden. Dat is niet alleen rommel: code die ergens
       `if (x.aan === false)` doet, verandert dan stil van gedrag. Alleen de
       eigenaar komt hier, maar een grendel die op vertrouwen leunt is geen
       grendel. */
    const zid = String(req.body.id || '');
    const z = Object.prototype.hasOwnProperty.call(t.zekeringen, zid) ? t.zekeringen[zid] : null;
    if (!z) return res.status(404).json({ error: 'Onbekende zekering.' });
    if (req.body.actie === 'reset') { z.aan = true; z.reden = null; z.sindsGesprongen = null; }
    else if (req.body.actie === 'spring') { z.aan = false; z.reden = String(req.body.reden || 'handmatig uitgeschakeld').slice(0, 120); z.sindsGesprongen = Date.now(); }
    else return res.status(400).json({ error: 'Actie moet reset of spring zijn.' });
    save();
    res.json({ ok: true, id: zid, aan: z.aan });
  });

  // De storingslijst (eigen fout-aggregatie) wissen: tellers terug naar nul.
  app.post('/api/techniek/fouten/wis', techAuth, eigenaarAlleen, (req, res) => {
    /* Wissen mag -- het is de storingslijst van de eigenaar -- maar niet
       spoorloos. Deze lijst is het enige wat vertelt dat er iets mis is
       geweest; een knop die hem leegt zonder een regel achter te laten is een
       knop om een incident te laten verdwijnen. Het aantal gaat mee, want juist
       "er stonden er 400 en nu nul" is wat je later wilt kunnen teruglezen. */
    const hoeveel = (log.foutenSamenvatting() || {}).totaal || 0;
    log.foutenReset();
    if (beveilig) beveilig.meld('fouten-gewist', 'waarschuwing',
      'De storingslijst is gewist (' + hoeveel + ' geteld) door user-' + (req.techUser && req.techUser.id) + '.',
      { bron: 'user:' + (req.techUser && req.techUser.id) });
    res.json({ ok: true, gewist: hoeveel });
  });
};
