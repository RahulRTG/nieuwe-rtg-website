/* Plaatslaag, deel "opslag": de drie lijsten, het opruimen en het actielog.

   Afgesplitst van ./venster.js toen dat over de leesgrens ging, en de knip loopt
   langs een echte naad: hier staat WAT ER LIGT en hoe het weer weggaat, in
   ./venster.js staat de TOESTEMMING, en in ./waarnemen.js staat WAT ERBINNEN
   VALT. Alle drie de bestanden delen deze accessors, en dat is met opzet één
   plek: drie kopieen van "een waarneming leeft zolang haar venster leeft" lopen
   uiteen, en dan blijft er precies datgene liggen dat weg hoorde te zijn.

   DE LIJSTEN ZIJN BEGRENSD, EN DAT IS HIER GEEN VERLIES. Elders in dit huis is
   een afgekapte staart een bug (zie server/db/tx/index.js, waar boeking 50.001
   verdween). Hier is vergeten het doel: een waarneming die buiten haar venster
   valt hoort weg te zijn, en een grens op het aantal is een tweede slot op
   hetzelfde. Wie dit ooit duurzaam wil maken, leest eerst PLAATS.md par. 5. */
'use strict';

const WAARNEEM_MAX = 200;             // per lid; genoeg voor een lange dienst met veel hekken
const LOG_MAX = 400;                  // het actielog, per lid

module.exports = ({ db, save, crypto }) => {
  const nu = () => new Date().toISOString();
  const id = () => crypto.randomBytes(9).toString('hex');

  const bak = (naam) => { if (!Array.isArray(db.data[naam])) db.data[naam] = []; return db.data[naam]; };
  const vensters = () => bak('plaatsVensters');
  const waarnemingen = () => bak('plaatsWaarnemingen');
  const logboek = () => bak('plaatsLog');

  const open = (v) => v && new Date(v.sluit).getTime() > Date.now();

  /* Verlopen vensters gaan weg, en hun waarnemingen met ze mee. Dit draait bij
     elke aanraking van de laag in plaats van op een timer: een opruimer die
     alleen loopt als er een timer tikt, loopt niet in een proces dat net is
     herstart, en dan blijft er precies datgene liggen dat weg hoorde te zijn. */
  function ruim() {
    const voor = vensters().length + waarnemingen().length;
    const levend = new Set(vensters().filter(open).map(v => v.id));
    db.data.plaatsVensters = vensters().filter(v => levend.has(v.id));
    db.data.plaatsWaarnemingen = waarnemingen().filter(w => levend.has(w.venster));
    if (vensters().length + waarnemingen().length !== voor) save();
  }

  /* De gegevens gaan er EERST in en de handeling erna. Andersom overschreef een
     veld uit `gegevens` de naam van de handeling zelf: een waarneming van
     'binnen' kwam als handeling 'binnen' in het log te staan in plaats van als
     'waargenomen'. Dat is precies het soort stille fout waar een actielog niet
     tegen kan -- een regel die iets anders beweert dan er gebeurd is, is erger
     dan geen regel. (Om dezelfde reden heet de richting hieronder `richting` en
     niet `wat`: twee velden met dezelfde naam op een rij vragen erom.) */
  function schrijfLog(codenaam, wat, gegevens) {
    const l = logboek();
    l.unshift({ id: id(), codenaam, ...gegevens, wat, at: nu() });
    const mijn = l.filter(r => r.codenaam === codenaam);
    if (mijn.length > LOG_MAX) {
      const weg = new Set(mijn.slice(LOG_MAX).map(r => r.id));
      db.data.plaatsLog = l.filter(r => !weg.has(r.id));
    }
  }

  return { nu, id, bak, vensters, waarnemingen, logboek, open, ruim, schrijfLog,
    WAARNEEM_MAX, LOG_MAX };
};
