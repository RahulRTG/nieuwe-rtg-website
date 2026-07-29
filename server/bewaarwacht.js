/* DE BEWAARWACHT -- de helft van het bewaarbeleid die anders wordt vergeten.

   bewaartermijnen.js zegt HOE LANG we wat houden. Dit bestand zorgt dat er ook
   echt iemand kijkt. Een bewaarbeleid waar niemand naar omkijkt is geen beleid
   maar een bestand: het rapport klopt, het staat er, en niemand opent het.

   Wat de wacht doet: tellen, vastleggen, en melden zodra er iets over zijn
   termijn staat.

   WAT HIJ NOOIT DOET IS WISSEN. Dat is geen omissie maar de kern van het
   ontwerp. Een automaat die uit zichzelf gegevens weggooit is precies de ramp
   die je pas ziet als hij al gebeurd is -- en bij zeven jaar administratie is
   "oeps" geen herstelbare fout. Wissen blijft een menselijke handeling met een
   bevestiging (bewaartermijnen.veeg + 'WIS' op het techniekbord).

   Hij meldt hoogstens eens per MELD_NA_MS. Dat is met opzet: een wacht die elke
   dag hetzelfde roept, leer je wegklikken, en dan is hij minder waard dan geen
   wacht. Het moment van de laatste melding staat in de DATABASE en niet in het
   geheugen -- anders zou elke herstart de teller resetten en kreeg je bij een
   onrustige server alsnog elke dag dezelfde melding. */

const bewaartermijnen = require('./bewaartermijnen');

const DAG = 86400000;
const MELD_NA_MS = 30 * DAG;

/* De stand van de wacht hoort bij de techniek-tak, naast de rest van het bord. */
function wachtStaat(db) {
  if (!db || !db.data || typeof db.data !== 'object') return null;
  if (!db.data.techniek) db.data.techniek = {};
  const t = db.data.techniek;
  if (!t.bewaarwacht) t.bewaarwacht = { laatst: null, laatstGemeld: null, verlopen: 0, gaten: 0 };
  return t.bewaarwacht;
}

/* De meldtekst noemt de grootste posten bij naam. "1240 items over hun termijn"
   zegt niets en leidt tot niets; "meldingen (1200), sollicitaties (30)" laat
   meteen zien waar het zit en of het erg is. */
function meldTekst(r, gaten) {
  const top = r.regels.filter(x => x.verlopen > 0).sort((a, b) => b.verlopen - a.verlopen)
    .slice(0, 3).map(x => x.label + ' (' + x.verlopen + ')').join(', ');
  let t = r.verlopenTotaal + ' item(s) staan over hun bewaartermijn: ' + top + '.'
    + ' Er is niets gewist -- opruimen gaat met de hand via het techniekbord.';
  if (gaten > 0) t += ' Daarnaast hebben ' + gaten + ' tak(ken) nog helemaal geen termijn.';
  return t;
}

/* Een ronde. opties: { beveilig, save, nu }.
   Geeft terug wat hij zag en of hij gemeld heeft, zodat een test hem kan
   nalopen zonder op een timer te wachten. */
function ronde(db, opties) {
  const o = opties || {};
  const nu = Number(o.nu) || Date.now();
  const r = bewaartermijnen.rapport(db);
  const gaten = bewaartermijnen.zonderBeleid(db).length;
  const uit = { verlopen: r.verlopenTotaal, gaten, gemeld: false, tekst: null };

  const s = wachtStaat(db);
  if (!s) return uit;                    // lege of rare db: tellen kan, onthouden niet
  s.laatst = new Date(nu).toISOString();
  s.verlopen = r.verlopenTotaal;
  s.gaten = gaten;

  const eerder = s.laatstGemeld ? Date.parse(s.laatstGemeld) : NaN;
  const langGenoegGeleden = Number.isNaN(eerder) || (nu - eerder) >= MELD_NA_MS;
  if (r.verlopenTotaal > 0 && langGenoegGeleden) {
    s.laatstGemeld = new Date(nu).toISOString();
    uit.gemeld = true;
    uit.tekst = meldTekst(r, gaten);
    if (o.beveilig && typeof o.beveilig.meld === 'function') {
      // een melding die niet lukt mag de ronde nooit omtrekken
      try { o.beveilig.meld('bewaartermijn-verlopen', 'waarschuwing', uit.tekst, { bron: 'bewaarwacht' }); }
      catch (e) {}
    }
  }
  if (typeof o.save === 'function') { try { o.save(); } catch (e) {} }
  return uit;
}

module.exports = { ronde, MELD_NA_MS };
