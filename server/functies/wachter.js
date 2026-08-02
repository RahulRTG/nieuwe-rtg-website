/* De storingswachter: de automaat van de schakelkast.

   De schakelkast had alleen handen: de eigenaar zet een functie aan of uit,
   en "storing" was een oranje vlag die iemand zelf moest hijsen. Wat er
   ontbrak is de nacht: een functie die om 03:00 stukgaat, staat om 03:00
   niemand uit te zetten. Elke gebruiker die hem raakt krijgt dan een kale
   500, en de fout blijft hameren op wat er stuk is.

   DE REGELS, EN WAAROM ZE ZO STAAN:

   1. DICHT OP BEWIJS, NIET OP EEN ENKEL INCIDENT. Pas bij `drempel`
      serverfouten binnen het venster EN als de fouten de meerderheid van de
      antwoorden zijn. Een functie die 5x faalt tussen 500 successen heeft een
      bug, geen uitval; dichtgooien zou de 500 tevreden gebruikers straffen
      voor de 5.
   2. EEN 503 TELT NIET MEE. Dat is de taal van "bewust dicht" (de schakelaar
      zelf, de opslagpoort, de hoofdzekering). De wachter die zijn eigen
      slotwerk als storing telt, klapt zichzelf in een kringetje dicht.
   3. DE HAND WINT ALTIJD. De automaat raakt uitsluitend standen aan die hij
      zelf heeft gezet (herkenbaar aan `automaat` op de stand). Wat de
      eigenaar bewust dicht zette blijft dicht; zet de eigenaar iets aan, dan
      wist de schakelroute het automaat-merk en is de stand weer van de mens.
   4. PROEFOPENING MET GEDULD. Na `herstelMs` gaat de functie weer open --
      een dichte functie kan immers nooit bewijzen dat hij hersteld is. Valt
      hij meteen weer om, dan verdubbelt de wachttijd (tot een uur). Blijft
      hij tien proefvensters heel, dan is hij hersteld en vergeet de wachter
      de rondes.
   5. ALLES ZICHTBAAR. Elke greep van de automaat staat in het wachterlogboek
      (boardroom) en gaat als sync over de office-SSE, zodat het bord live
      meekleurt. Een automaat waar je niet op kunt kijken is geen bewaker
      maar een spookschakelaar.

   Per functie uit te zetten met stand.wachter = false (de boardroom-knop
   "automaat"), voor functies waar een mens elke schakeling wil wegen. */
const { functieVoorPad } = require('./toegang');

const STANDAARD = {
  vensterMs: 60000,     // het meetvenster
  drempel: 5,           // minimaal aantal 5xx in het venster
  aandeel: 0.5,         // en de fouten zijn meer dan dit deel van de antwoorden
  herstelMs: 120000,    // eerste proefopening na 2 minuten; verdubbelt per ronde
  maxWachtMs: 3600000,  // nooit langer dan een uur dicht per ronde
  proefMs: 120000       // een proefvenster; 10 hele vensters = hersteld
};

function maakWachter({ db, save, sseToOffice, log, nu, instel }) {
  const I = Object.assign({}, STANDAARD, instel || {});
  const klok = nu || (() => Date.now());
  const ramen = new Map();   // functie-id -> [{ t, fout }], begrensd per venster

  const staat = () => {
    db.data.techniek = db.data.techniek || {};
    return db.data.techniek.functies = db.data.techniek.functies || {};
  };
  function schrijfLog(regel) {
    const t = db.data.techniek;
    t.wachterLog = t.wachterLog || [];
    t.wachterLog.unshift(Object.assign({ at: new Date(klok()).toISOString() }, regel));
    if (t.wachterLog.length > 200) t.wachterLog.length = 200;
  }
  function zeg(regel) {
    if (log && log.schrijf) { try { log.schrijf('warn', 'wachter', regel); } catch (e) {} }
    if (sseToOffice) { try { sseToOffice('sync', { scope: 'functies' }); } catch (e) {} }
  }

  // Elke afgeronde API-respons komt hier langs (goedkoop: een prefix-match
  // plus een array-push). Alleen een echte serverfout start een evaluatie.
  function meet(pad, status) {
    if (status === 503) return;                      // regel 2
    const f = functieVoorPad(pad);
    if (!f) return;
    const t = klok();
    let raam = ramen.get(f.id);
    if (!raam) ramen.set(f.id, raam = []);
    raam.push({ t, fout: status >= 500 });
    while (raam.length && raam[0].t < t - I.vensterMs) raam.shift();
    if (status >= 500) evalueer(f.id, raam);
  }

  function evalueer(id, raam) {
    const st = staat();
    const cur = st[id] || {};
    if (cur.wachter === false) return;               // automaat uit voor deze functie
    if (cur.aan === false) return;                   // staat al dicht (hand of automaat)
    const fouten = raam.filter(x => x.fout).length;
    if (fouten < I.drempel) return;                  // regel 1a
    if (fouten <= raam.length * I.aandeel) return;   // regel 1b
    st[id] = cur;
    const ronde = ((cur.automaat && cur.automaat.ronde) || 0) + 1;
    cur.aan = false;
    cur.storing = { reden: 'Automaat: ' + fouten + ' serverfouten binnen een minuut (ronde ' + ronde + ')',
      at: new Date(klok()).toISOString() };
    cur.automaat = { dichtAt: klok(), ronde };
    save();
    schrijfLog({ id, wat: 'dicht', fouten, ronde });
    zeg('functie ' + id + ' automatisch dicht: ' + fouten + ' serverfouten (ronde ' + ronde + ')');
  }

  /* De herstelronde (elke ~30s): proefopeningen en het vergeten van oude
     rondes. Raakt uitsluitend automaat-standen aan (regel 3). */
  function herstelronde() {
    const st = staat();
    let geraakt = false;
    for (const id of Object.keys(st)) {
      const cur = st[id];
      if (!cur || !cur.automaat) continue;
      if (cur.aan === false && cur.automaat.dichtAt) {
        const wacht = Math.min(I.herstelMs * Math.pow(2, cur.automaat.ronde - 1), I.maxWachtMs);
        if (klok() - cur.automaat.dichtAt < wacht) continue;
        cur.aan = true;
        cur.storing = null;
        cur.automaat = { ronde: cur.automaat.ronde, proefAt: klok() };
        ramen.delete(id);
        geraakt = true;
        schrijfLog({ id, wat: 'proefopen', ronde: cur.automaat.ronde });
        zeg('functie ' + id + ' gaat op proef weer open (ronde ' + cur.automaat.ronde + ')');
      } else if (cur.aan !== false && cur.automaat.proefAt &&
                 klok() - cur.automaat.proefAt > 10 * I.proefMs) {
        delete cur.automaat;
        geraakt = true;
        schrijfLog({ id, wat: 'hersteld' });
        zeg('functie ' + id + ' is hersteld; de automaat vergeet de rondes');
      }
    }
    if (geraakt) save();
    return geraakt;
  }

  function start() {
    const t = setInterval(herstelronde, 30000);
    if (t.unref) t.unref();
    return t;
  }

  return { meet, herstelronde, start, instel: I };
}

module.exports = { maakWachter, STANDAARD };
