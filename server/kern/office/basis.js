/* RTG Office, de gedeelde basis: grenzen, sjablonen en de helpers die
   elke office-functie nodig heeft (opslag, rechten, namen bij sleutels
   en het schoonmaken van inhoud per soort). De soorten sleutels:
   leden op eigen account, teams als 'sup:CODE', de RTG-kantoren als
   'rtg:kantoor' en RTF-gezinsprofielen als 'rtf:CODE:handle'. */

const SOORTEN = ['tekst', 'blad', 'presentatie', 'formulier', 'schets'];
const MAX_DOCS = 200;            // per eigenaar (lid, zaak of kantoor)
const MAX_BYTES = 500000;        // per document (ruime kantoortekst, blad of deck)
const MAX_TITEL = 120;
const MAX_VERSIES = 15;
const MAX_DIAS = 60;
/* De celopmaak van een rekenblad en de indelingen van een dia: een korte,
   vaste lijst, zodat het scherm het kan tekenen en er nooit vreemde waarden
   in de opslag belanden. */
const OPMAAK = ['kop', 'geld', 'procent', 'getal', 'datum'];
const INDELINGEN = ['titel', 'punten', 'twee', 'citaat', 'cijfer'];
// de thema's van een deck; dezelfde vier als in apps/office/pres.js
const THEMAS = ['nacht', 'papier', 'bordeaux', 'goud'];
/* Het formulier en de schets: dezelfde aanpak als opmaak en indelingen --
   een korte vaste lijst per soort, en grenzen die het scherm ook hanteert. */
const VRAAGSOORTEN = ['open', 'keuze', 'schaal'];
const MAX_VRAGEN = 30;
const MAX_INZENDINGEN = 500;     // per formulier; een enquete, geen volkstelling
const VORMEN = ['kader', 'ovaal', 'ruit', 'pijl', 'tekst'];
const MAX_VORMEN = 300;
const VLAK_B = 1200, VLAK_H = 800; // het tekenvlak van een schets (viewBox)

const { SJABLONEN } = require('./sjablonen');

function maakBasis({ db, crypto, codenaamVan }) {
  const id = () => 'doc' + crypto.randomBytes(6).toString('hex');
  const nu = () => new Date().toISOString();

  function lijsten() {
    if (!db.data.officeDocs || typeof db.data.officeDocs !== 'object') db.data.officeDocs = {};
    return db.data.officeDocs;
  }
  const docMet = did => Object.values(lijsten()).find(d => d.id === String(did || '')) || null;
  // de grootte van de inhoud (JSON), zodat een document niet ongelimiteerd groeit
  const grootteVan = inhoud => { try { return Buffer.byteLength(JSON.stringify(inhoud || null)); } catch (e) { return Infinity; } };
  // de naam bij een sleutel: leden op codenaam, teams op zaakcode, RTG als kantoor
  const naamVan = key => {
    const k = String(key || '');
    if (k.startsWith('sup:')) return 'Team ' + k.slice(4);
    if (k === 'rtg:kantoor') return 'RTG Kantoor';
    if (k.startsWith('rtf:')) return k.split(':')[2] || 'gezinslid';
    return codenaamVan(k);
  };
  // de kring: een RTF-gezin deelt binnen het eigen gezin, nooit daarbuiten
  const inKring = (d, kring) => !!(kring && d.kring === kring && d.kringDeel);
  const magSchrijven = (d, key, kring) => d.key === key || (d.bewerkers || []).includes(key)
    || (inKring(d, kring) && d.kringDeel === 'bewerken');
  const magLezen = (d, key, kring) => magSchrijven(d, key, kring) || (d.gedeeldMet || []).includes(key)
    || inKring(d, kring);

  // de inhoud netjes begrenzen per soort (geen vreemde velden, geen enorme cellen)
  function schoonInhoud(soort, inhoud) {
    if (soort === 'blad') {
      const cellen = {};
      const bron = (inhoud.cellen && typeof inhoud.cellen === 'object') ? inhoud.cellen : {};
      let n = 0;
      for (const [ref, waarde] of Object.entries(bron)) {
        if (!/^[A-Z]{1,2}[0-9]{1,3}$/.test(ref) || n++ > 4000) continue;
        cellen[ref] = String(waarde == null ? '' : waarde).slice(0, 400);
      }
      // de opmaak per cel: alleen de vaste soorten, en alleen voor echte cellen
      const opmaak = {};
      const opBron = (inhoud.opmaak && typeof inhoud.opmaak === 'object') ? inhoud.opmaak : {};
      let m = 0;
      for (const [ref, soortje] of Object.entries(opBron)) {
        if (!/^[A-Z]{1,2}[0-9]{1,3}$/.test(ref) || m++ > 4000) continue;
        if (OPMAAK.includes(soortje)) opmaak[ref] = soortje;
      }
      // dezelfde grenzen als het scherm (apps/office/blad): wie hier strakker
      // klemt, knipt bij het bewaren stilletjes rijen uit andermans blad
      const rijen = Math.min(500, Math.max(1, parseInt(inhoud.rijen, 10) || 20));
      const kolommen = Math.min(60, Math.max(1, parseInt(inhoud.kolommen, 10) || 8));
      return { cellen, opmaak, rijen, kolommen };
    }
    if (soort === 'presentatie') {
      const bron = Array.isArray(inhoud.dias) ? inhoud.dias : [];
      const dias = bron.slice(0, MAX_DIAS).map(x => ({
        indeling: INDELINGEN.includes(x && x.indeling) ? x.indeling : 'punten',
        titel: String((x && x.titel) || '').slice(0, MAX_TITEL),
        tekst: String((x && x.tekst) || '').slice(0, 4000),
        notitie: String((x && x.notitie) || '').slice(0, 2000)
      }));
      return { dias: dias.length ? dias : [{ indeling: 'titel', titel: 'Titelblad', tekst: '', notitie: '' }],
        // een verzonnen thema wordt geen fout maar de standaard: het deck
        // blijft bruikbaar, alleen de kleur valt terug
        thema: THEMAS.includes(inhoud.thema) ? inhoud.thema : 'nacht' };
    }
    if (soort === 'formulier') {
      const bron = Array.isArray(inhoud.vragen) ? inhoud.vragen : [];
      const vragen = bron.slice(0, MAX_VRAGEN).map(v => ({
        tekst: String((v && v.tekst) || '').slice(0, 200),
        soort: VRAAGSOORTEN.includes(v && v.soort) ? v.soort : 'open',
        opties: (Array.isArray(v && v.opties) ? v.opties : []).slice(0, 8)
          .map(o => String(o == null ? '' : o).slice(0, 80))
      }));
      return { vragen: vragen.length ? vragen : [{ tekst: '', soort: 'open', opties: [] }],
        // codenaam is de standaard: wie invult staat er met codenaam bij;
        // 'anoniem' verbergt de invuller voor de eigenaar (niet voor RTG:
        // een inzending per persoon vraagt dat de server weet wie het was)
        wijze: inhoud.wijze === 'anoniem' ? 'anoniem' : 'codenaam' };
    }
    if (soort === 'schets') {
      const bron = Array.isArray(inhoud.vormen) ? inhoud.vormen : [];
      const klem = (x, min, max, sv) => {
        const n = Math.round(Number(x));
        return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : sv;
      };
      const vormen = [];
      for (const v of bron) {
        if (vormen.length >= MAX_VORMEN) break;
        // een onbekende vorm valt weg in plaats van als raadsel opgeslagen
        if (!v || !VORMEN.includes(v.soort)) continue;
        const s = { soort: v.soort, x: klem(v.x, 0, VLAK_B, 0), y: klem(v.y, 0, VLAK_H, 0),
          tekst: String(v.tekst == null ? '' : v.tekst).slice(0, 120) };
        if (v.soort === 'pijl') { s.x2 = klem(v.x2, 0, VLAK_B, s.x); s.y2 = klem(v.y2, 0, VLAK_H, s.y); }
        else if (v.soort !== 'tekst') { s.b = klem(v.b, 10, VLAK_B, 120); s.h = klem(v.h, 10, VLAK_H, 60); }
        vormen.push(s);
      }
      return { vormen };
    }
    return { tekst: String(inhoud.tekst || '').slice(0, MAX_BYTES) };
  }

  return { id, nu, lijsten, docMet, grootteVan, naamVan, inKring, magSchrijven, magLezen, schoonInhoud };
}

module.exports = { SOORTEN, MAX_DOCS, MAX_BYTES, MAX_TITEL, MAX_VERSIES, MAX_DIAS,
  OPMAAK, INDELINGEN, THEMAS, VRAAGSOORTEN, MAX_VRAGEN, MAX_INZENDINGEN,
  VORMEN, MAX_VORMEN, VLAK_B, VLAK_H, SJABLONEN, maakBasis };
