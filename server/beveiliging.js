/* Beveiligingsmeldingen ("inbraakdetectie") voor het technische Backoffice-bord.

   Vangt de hoog-signaal-gebeurtenissen op die op "we worden aangevallen" wijzen
   en zet ze op het beveiligde bord van de eigenaar:
   - brute force: te veel mislukte inlogpogingen (de rate-limit sloeg aan);
   - iemand die aan de eigenaar-deur morrelt: mislukte login op de technische
     pagina, of een geldig account dat toegang tot de technische pagina probeert
     zonder recht (mogelijke rechten-escalatie);
   - massale noodschakelingen (bijv. "alles uit") en andere verdachte patronen.

   Meldingen worden samengevoegd (dezelfde soort + bron binnen twee minuten telt
   op i.p.v. een nieuwe regel), begrensd bewaard als audit-spoor, en bij ernst
   'kritiek' krijgt de eigenaar meteen een melding (push + e-mail), met een
   ingebouwde rem zodat één aanval geen honderd meldingen stuurt.

   Automatische noodrem: houdt een aanval aan (brute force vanaf meerdere
   bronnen binnen tien minuten), dan laat het systeem zelf de zekeringen
   springen: eerst de registratie (geen nieuwe accounts meer), en bij een nog
   bredere aanval de onderhoudsstand (de hele app op slot, alleen de eigenaar
   komt er nog in). Alleen de eigenaar doet de zekeringen er weer in, op de
   technische pagina; daar kan hij de noodrem ook aan- of uitzetten.

   Zuiver en testbaar: alle afhankelijkheden komen via ctx binnen. */
const crypto = require('crypto');
const { standaardZekeringen } = require('./techniek');

const ERNST = { info: 0, waarschuwing: 1, kritiek: 2 };
const MAX = 200;                 // audit-staart: hoeveel regels we bewaren
const SAMENVOEG_MS = 2 * 60000;  // zelfde soort+bron hierbinnen -> tellen
const ESCALATIE_MS = 5 * 60000;  // niet vaker dan 1x per 5 min per soort escaleren
const NOODREM_VENSTER_MS = 10 * 60000; // aanvalsvenster voor de automatische noodrem
const NOODREM_REGISTRATIE = 3;   // brute force vanaf zoveel bronnen -> registratie tijdelijk dicht
const NOODREM_INLOGPAUZE = 6;    // ... vanaf zoveel bronnen -> inlogpaden tijdelijk dicht
const NOODREM_REG_MS = 60 * 60000;   // de registratie dooft vanzelf na een uur
const NOODREM_LOGIN_MS = 10 * 60000; // de inlogpauze dooft vanzelf na tien minuten

module.exports = (ctx) => {
  const { db, save, notifyOwner } = ctx;
  /* Trede 1 van de noodrem-ladder. De Wacht bestaat nog niet als dit object
     gebouwd wordt (die krijgt juist ONS mee); daarom een zetter, gezet in
     opzet/diensten2.js zodra hij er is. Zonder haak vallen trede 2 en 3 niet
     weg -- er is dan alleen geen per-bron-quarantaine. */
  let isoleerBron = null;
  const laatstGemeld = new Map(); // sleutel -> ts van laatste escalatie (in geheugen)

  function lijst() {
    if (!db.data.techniek) db.data.techniek = {};
    if (!Array.isArray(db.data.techniek.beveiliging)) db.data.techniek.beveiliging = [];
    return db.data.techniek.beveiliging;
  }
  const score = e => ERNST[e] == null ? 0 : ERNST[e];
  function zekeringen() {
    if (!db.data.techniek) db.data.techniek = {};
    if (!db.data.techniek.zekeringen) db.data.techniek.zekeringen = standaardZekeringen();
    return db.data.techniek.zekeringen;
  }
  // de noodrem staat standaard AAN; de eigenaar kan hem uitzetten
  function autoStaat() {
    if (!db.data.techniek) db.data.techniek = {};
    if (!db.data.techniek.autoReactie) db.data.techniek.autoReactie = { aan: true };
    return db.data.techniek.autoReactie;
  }
  function zetAuto(aan) { autoStaat().aan = !!aan; save(); return autoStaat().aan; }

  /* Meld een gebeurtenis. ernst: 'info' | 'waarschuwing' | 'kritiek'.
     meta.bron identificeert de bron (bijv. IP of bucket) voor het samenvoegen. */
  function meld(type, ernst, tekst, meta) {
    ernst = ERNST[ernst] == null ? 'waarschuwing' : ernst;
    const arr = lijst();
    const nu = Date.now();
    const bron = (meta && meta.bron) || '';
    const sleutel = type + '|' + bron;
    const kop = arr[0];
    if (kop && kop.sleutel === sleutel && !kop.afgehandeld && (nu - kop.atMs) < SAMENVOEG_MS) {
      kop.aantal = (kop.aantal || 1) + 1;
      kop.atMs = nu; kop.at = new Date(nu).toISOString();
      kop.tekst = tekst;
      if (score(ernst) > score(kop.ernst)) kop.ernst = ernst;
    } else {
      arr.unshift({ id: crypto.randomBytes(4).toString('hex'), sleutel, type, ernst,
        tekst, meta: meta || {}, aantal: 1, afgehandeld: false, at: new Date(nu).toISOString(), atMs: nu });
      if (arr.length > MAX) arr.length = MAX;
    }
    save();
    if (ernst === 'kritiek') escaleer(sleutel, tekst);
    if (type === 'brute-force') noodrem();
    return arr[0];
  }

  /* DE NOODREM-LADDER: van lokaal en tijdelijk naar breed en tijdelijk, en
     nooit meer vanzelf naar "hele app op slot".

     De eerste versie trok bij zes bronnen de ONDERHOUDS-zekering: totale
     uitval, permanent tot de eigenaar hem resette. De mega-beproeving liet
     zien wat dat waard is -- de storm spoofte zes bronnen op de inlog en de
     hele app stond de rest van de run op 503. Een verdediging die van een
     brute force een totale uitval maakt, is een DoS-versterker; en flood.js
     zei het huisprincipe al: een reflex die blijft hangen is geen
     bescherming.

     De ladder, elke trede tijdgebonden en met de eigenaar op de hoogte:
       1. ELKE bron met een brute-force-alarm gaat individueel in quarantaine
          (de bestaande, zelf-dovende isoleer van De Wacht) -- lokaal eerst.
       2. Vanaf drie bronnen: de REGISTRATIE dicht, dooft na een uur.
       3. Vanaf zes bronnen: de INLOGPAUZE -- alleen de in- en
          uitschrijfpaden dicht, dooft na tien minuten. Wie al is ingelogd
          merkt niets: de schade-scope is de aanvals-scope.
     De onderhouds-zekering springt nooit meer automatisch; die is van de
     eigenaar. */
  function noodrem() {
    if (!autoStaat().aan) return;
    const nu = Date.now();
    /* De ECHTE bron (meta.bron), niet de meldingssleutel 'type|bron': de
       quarantaine van trede 1 moet een adres isoleren, geen etiket. */
    const bronnen = new Set(lijst()
      .filter(m => m.type === 'brute-force' && (nu - m.atMs) < NOODREM_VENSTER_MS)
      .map(m => (m.meta && m.meta.bron) || '').filter(Boolean));
    if (isoleerBron) {
      for (const bron of bronnen) { try { isoleerBron(bron, 'noodrem: brute force'); } catch (e) {} }
    }
    if (bronnen.size >= NOODREM_REGISTRATIE) spring('registratie', bronnen.size, NOODREM_REG_MS);
    if (bronnen.size >= NOODREM_INLOGPAUZE) spring('inlogpauze', bronnen.size, NOODREM_LOGIN_MS);
  }
  function spring(id, aantalBronnen, totMs) {
    const z = zekeringen()[id];
    if (!z || z.aan === false) return; // al gesprongen: niets te doen
    z.aan = false;
    z.reden = 'automatische noodrem: brute force vanaf ' + aantalBronnen + ' bronnen';
    z.sindsGesprongen = Date.now();
    z.tot = Date.now() + (totMs || NOODREM_LOGIN_MS);   // tijdgebonden: dooft vanzelf
    save();
    meld('auto-reactie', 'kritiek',
      'Automatische noodrem: de zekering "' + z.naam + '" is eruit gehaald (brute force vanaf ' +
      aantalBronnen + ' bronnen binnen tien minuten). Hij dooft vanzelf over ' +
      Math.round((totMs || NOODREM_LOGIN_MS) / 60000) + ' min; op de technische pagina kun je hem eerder resetten.',
      { bron: 'zekering:' + id });
  }

  // Bij een kritieke gebeurtenis de eigenaar waarschuwen, met een rem per soort.
  function escaleer(sleutel, tekst) {
    const nu = Date.now();
    if ((nu - (laatstGemeld.get(sleutel) || 0)) < ESCALATIE_MS) return;
    laatstGemeld.set(sleutel, nu);
    if (typeof notifyOwner === 'function') {
      try { notifyOwner({ title: 'Beveiligingsalarm', body: tekst }); } catch (e) {}
    }
  }

  // Overzicht voor het bord: open (onafgehandelde) meldingen, tellers per ernst.
  function samenvatting(limiet = 40) {
    const arr = lijst();
    const open = arr.filter(m => !m.afgehandeld);
    return {
      open: open.length,
      kritiek: open.filter(m => m.ernst === 'kritiek').length,
      waarschuwing: open.filter(m => m.ernst === 'waarschuwing').length,
      autoReactie: autoStaat().aan,
      recent: arr.slice(0, limiet).map(m => ({ id: m.id, type: m.type, ernst: m.ernst,
        tekst: m.tekst, aantal: m.aantal, at: m.at, afgehandeld: m.afgehandeld }))
    };
  }

  // Aantal open kritieke meldingen (voor het actiecentrum van de Backoffice).
  function openKritiek() { return lijst().filter(m => !m.afgehandeld && m.ernst === 'kritiek').length; }
  function openTotaal() { return lijst().filter(m => !m.afgehandeld).length; }

  // De eigenaar handelt een melding af (of alles ineens).
  function handelAf(id) {
    const arr = lijst();
    let n = 0;
    for (const m of arr) if ((!id || m.id === id) && !m.afgehandeld) { m.afgehandeld = true; m.afgehandeldAt = new Date().toISOString(); n++; }
    if (n) save();
    return n;
  }

  return { meld, samenvatting, handelAf, openKritiek, openTotaal, zetAuto, autoAan: () => autoStaat().aan, zetIsoleer: (fn) => { isoleerBron = fn; } };
};
