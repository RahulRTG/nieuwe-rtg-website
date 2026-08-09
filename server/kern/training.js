/* Training: uw eigen schema, en wat u er echt van deed.

   DEZELFDE VORM ALS HET MEDICATIESCHEMA, EN OM DEZELFDE REDEN. RTG schrijft geen
   trainingsschema voor. Geen sets, geen herhalingen, geen gewichten, geen
   opbouw van 5 naar 10 kilometer, geen hartslagzones en geen belastingscore.
   Dat is werk voor een coach of een fysiotherapeut die u kent en u heeft zien
   bewegen -- het "professional-supported" niveau uit kern/zorgniveau.js, en dat
   staat hier niet.

   Wat er wel is: u (of uw coach) zet het schema erin, RTG houdt het vast, en u
   tekent af wat u heeft gedaan. Dat aftekenen schrijft een BEWEGING-meting weg
   via kern/metingen.js, met herkomst "zelf" -- want u bent degene die het zegt.
   Er komt dus geen tweede beweegcijfer naast het cijfer dat er al was
   (LAT.md regel 4).

   WAT ER DAAROM NIET IS:
   - Een belastingsmodel (ACWR, "u traint te hard"). Dat vraagt hartslag, slaap,
     herstel en een normgroep, en het is een uitspraak over uw gezondheid.
   - Een oefeningenbibliotheek met voorgeschreven uitvoering. Verkeerd uitgevoerd
     krachtwerk is een blessure, en een plaatje is geen begeleiding.
   - Reeksen en scores. Een week overslaan is geen gebeurtenis.

   De duur is het enige getal dat RTG aanraakt, en alleen omdat u het invult. */

const dagVan = d => new Date(d).toISOString().slice(0, 10);
const MAX_SCHEMA = 12;

module.exports = ({ db, save, schoon, crypto, metingZet }) => {
  const bak = () => {
    if (!db.data.training) db.data.training = {};
    return db.data.training;
  };
  const mijn = key => {
    const b = bak();
    if (!b[key]) b[key] = { schema: [], gedaan: [] };
    return b[key];
  };

  function toon(t) {
    return { id: t.id, naam: t.naam, wat: t.wat, dagen: t.dagen,
      duurMin: t.duurMin, vanWie: t.vanWie, gemaakt: t.gemaakt };
  }

  /* Dagen zijn dagnummers 1..7 (maandag..zondag). Wat geen dag is valt weg, en
     dat wordt gemeld -- stil afvallen leest als ingevuld. */
  function dagenVan(in_) {
    const ruw = (Array.isArray(in_) ? in_ : String(in_ || '').split(','))
      .map(x => String(x || '').trim()).filter(Boolean);
    const goed = [...new Set(ruw.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 7))].sort();
    return { goed, weg: ruw.length - goed.length };
  }

  function beeld(key, nu = new Date()) {
    const m = mijn(key);
    const vandaag = dagVan(nu);
    // getDay(): 0 = zondag. Wij tellen 1 = maandag, dus zondag wordt 7.
    const dagnr = new Date(vandaag + 'T00:00:00Z').getUTCDay() || 7;
    const vandaagGedaan = m.gedaan.filter(g => g.op === vandaag);

    return {
      ok: true, vandaag,
      schema: m.schema.map(toon),
      /* Wat er vandaag volgens uw eigen schema staat. Geen aansporing en geen
         "u bent al drie dagen niet geweest": dat is een verwijt met een teller. */
      vandaagOpSchema: m.schema.filter(t => t.dagen.includes(dagnr)).map(t => ({
        ...toon(t), gedaan: vandaagGedaan.some(g => g.schemaId === t.id)
      })),
      gedaan: m.gedaan.slice(-30).reverse().map(g => ({ id: g.id, op: g.op, wat: g.wat, duurMin: g.duurMin })),
      uitleg: 'Dit schema is van u of van uw coach. RTG stelt niets voor, rekent geen '
        + 'belasting uit en zegt niet of u te hard of te zacht traint.',
      grens: {
        kop: 'RTG schrijft geen training voor',
        tekst: 'Over opbouw, uitvoering, herstel en blessures zegt RTG niets. Dat is werk '
          + 'voor iemand die u kent en u heeft zien bewegen.',
        wegen: [
          { naam: 'Een coach of trainer', hoe: 'Voor opbouw en uitvoering' },
          { naam: 'Uw fysiotherapeut of huisarts', hoe: 'Bij pijn, blessures of twijfel' }
        ]
      }
    };
  }

  function zet(key, body) {
    const m = mijn(key);
    const naam = schoon(body.naam, 60);
    if (!naam) return { status: 400, error: 'Hoe heet deze training?' };
    const d = dagenVan(body.dagen);

    const bestaand = body.id ? m.schema.find(t => t.id === String(body.id)) : null;
    if (body.id && !bestaand) return { status: 404, error: 'Die training staat niet in uw schema.' };
    if (!bestaand && m.schema.length >= MAX_SCHEMA) {
      return { status: 400, error: 'Er staan er al ' + MAX_SCHEMA + ' in uw schema.' };
    }

    const t = bestaand || { id: crypto.randomBytes(4).toString('hex'), gemaakt: new Date().toISOString() };
    t.naam = naam;
    /* Wat u doet, in uw eigen woorden. RTG kent geen oefeningen en biedt er ook
       geen aan: dit is een briefje, geen bibliotheek. */
    t.wat = schoon(body.wat, 600);
    t.dagen = d.goed;
    const duur = Number(body.duurMin);
    t.duurMin = Number.isFinite(duur) && duur > 0 && duur <= 600 ? Math.round(duur) : null;
    t.vanWie = schoon(body.vanWie, 60);
    if (!bestaand) m.schema.push(t);
    save();

    const uit = beeld(key);
    if (d.weg) uit.gewaarschuwd = d.weg + ' dag(en) vielen af: een dag is een nummer van 1 (maandag) tot 7 (zondag).';
    return uit;
  }

  function weg(key, id) {
    const m = mijn(key);
    const i = m.schema.findIndex(t => t.id === String(id));
    if (i < 0) return { status: 404, error: 'Die training staat niet in uw schema.' };
    m.schema.splice(i, 1);
    save();
    return beeld(key);
  }

  /* Aftekenen: wat u werkelijk deed. De duur gaat als BEWEGING naar
     kern/metingen.js, want daar woont dat cijfer al -- hier een tweede
     beweegtotaal bijhouden zou twee waarheden maken. Faalt dat schrijven, dan
     staat dat in het antwoord en niet alleen in de logs (LAT.md regel 5). */
  function deed(key, body, nu = new Date()) {
    const m = mijn(key);
    const schemaId = body.schemaId ? String(body.schemaId) : null;
    const uitSchema = schemaId ? m.schema.find(t => t.id === schemaId) : null;
    if (schemaId && !uitSchema) return { status: 404, error: 'Die training staat niet in uw schema.' };

    const wat = schoon(body.wat, 80) || (uitSchema && uitSchema.naam) || '';
    if (!wat) return { status: 400, error: 'Wat heeft u gedaan?' };
    const duur = Number(body.duurMin != null ? body.duurMin : (uitSchema && uitSchema.duurMin));
    if (!Number.isFinite(duur) || duur <= 0 || duur > 600) {
      return { status: 400, error: 'Hoeveel minuten heeft u getraind?' };
    }

    const g = { id: crypto.randomBytes(4).toString('hex'), op: dagVan(nu),
      schemaId: uitSchema ? uitSchema.id : null, wat, duurMin: Math.round(duur), at: nu.toISOString() };
    m.gedaan.push(g);
    if (m.gedaan.length > 400) m.gedaan = m.gedaan.slice(-400);
    save();

    const uit = beeld(key, nu);
    uit.meting = naarBeweging(key, m, g, metingZet, nu);
    return uit;
  }

  function wegGedaan(key, id, nu = new Date()) {
    const m = mijn(key);
    const i = m.gedaan.findIndex(g => g.id === String(id));
    if (i < 0) return { status: 404, error: 'Die training staat niet in uw logboek.' };
    /* De dag van de VERWIJDERDE regel, niet die van wat er toevallig nog staat:
       anders wordt de verkeerde dag herteld. */
    const op = m.gedaan[i].op;
    m.gedaan.splice(i, 1);
    save();
    const uit = beeld(key, nu);
    /* De dagmeting wordt opnieuw gezet uit wat er OVER is, en niet blind
       afgetrokken: aftrekken zou een negatief getal kunnen opleveren als het lid
       de meting intussen zelf heeft aangepast. */
    uit.meting = naarBeweging(key, m, { op }, metingZet, nu, true);
    return uit;
  }

  return { trainingVan: beeld, trainingZet: zet, trainingWeg: weg,
    trainingDeed: deed, trainingWegGedaan: wegGedaan };
};

/* De brug naar de dagmeting. Het totaal van de dag wordt opnieuw opgeteld uit
   het logboek en weggeschreven met herkomst "zelf". Dat is eerlijker dan
   optellen bij wat er stond: wie twee keer aftekent en er een weghaalt, houdt
   anders een cijfer over dat nergens meer op slaat. */
function naarBeweging(key, m, g, metingZet, nu, hertellen) {
  if (typeof metingZet !== 'function') {
    return { ok: false, uitleg: 'Uw beweegmeting is niet bijgewerkt: die laag is niet aangesloten.' };
  }
  const op = g && g.op ? g.op : dagVan(nu);
  const totaal = m.gedaan.filter(x => x.op === op).reduce((s, x) => s + x.duurMin, 0);
  if (hertellen && !totaal) {
    return { ok: true, uitleg: 'Er staat voor die dag geen training meer; uw beweegmeting is niet '
      + 'op nul gezet, want u kunt die dag ook zonder training hebben bewogen.' };
  }
  try {
    const r = metingZet(key, { onderwerp: 'beweging', waarde: totaal, op }, nu);
    if (r && r.status && r.status >= 400) {
      return { ok: false, uitleg: 'Uw beweegmeting is niet bijgewerkt: ' + (r.error || 'onbekende fout') };
    }
    return { ok: true, minuten: totaal,
      uitleg: 'Uw beweging van ' + op + ' staat nu op ' + totaal + ' minuten, op uw eigen woord.' };
  } catch (e) {
    return { ok: false, uitleg: 'Uw beweegmeting is niet bijgewerkt: de metingenlaag gaf een fout.' };
  }
}

module.exports.MAX_SCHEMA = MAX_SCHEMA;
