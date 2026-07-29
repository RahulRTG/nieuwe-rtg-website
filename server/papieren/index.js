/* DE PAPIEREN: Rahul vraagt uit, de mens vult in, het document schrijft zichzelf.

   De vragen staan in ./vragen.js; hier staat wat ermee gebeurt. Vier dingen:

   1. VRAGEN AANREIKEN. volgende() geeft de eerstvolgende openstaande vraag,
      inclusief het waarom. Rahul stelt er één tegelijk -- een formulier met
      twintig velden is precies het ding dat niemand invult.

   2. ANTWOORDEN VASTLEGGEN. antwoord() slaat op wat er letterlijk gezegd is,
      met wie het zei en wanneer. Er zit GEEN generatie in deze module: er is
      geen enkel pad waarlangs een antwoord ontstaat zonder dat een mens het
      heeft ingetypt. Dat is met opzet en het hoort zo te blijven. Een verzonnen
      KvK-nummer is erger dan een leeg veld, want een leeg veld ziet iedereen.

   3. HET DOCUMENT VULLEN. vulIn() vervangt de {{merktekens}} in het
      verwerkingsregister en het datalek-draaiboek door de echte antwoorden.
      Wat nog niet beantwoord is, blijft zichtbaar als openstaand -- het
      document liegt nooit over zijn eigen volledigheid.

   4. HET DOCUMENT LEVEREN. document() leest het bestand van schijf en geeft de
      ingevulde versie terug. De bestanden in git houden hun merktekens; de
      ingevulde versie ontstaat op het moment dat iemand hem opvraagt. Zo staan
      privénummers nergens in de repository.

   Parkeren mag. Weet iemand iets even niet, dan legt hij dat vast als "nog niet
   bekend" en telt het gewoon als open; npm run golive blijft erop blokkeren.
   Parkeren is eerlijk, doen alsof niet. */

const fs = require('fs');
const path = require('path');
const { VRAGEN } = require('./vragen');
const opslag = require('./opslag');

const OP_ID = new Map(VRAGEN.map(v => [v.id, v]));
const OP_VELD = new Map(VRAGEN.map(v => [v.veld, v]));
const MAX = 4000; // een antwoord is een feit, geen opstel

const DOCUMENTEN = {
  verwerkingsregister: { bestand: 'VERWERKINGSREGISTER.md', waarvoor: 'het verwerkingsregister (AVG art. 30)' },
  datalek: { bestand: 'DATALEK.md', waarvoor: 'het datalek-draaiboek (72-uursklok, art. 33)' }
};

/* Wat er in het document komt te staan zolang een veld nog leeg is. Bewust
   opvallend: wie dit in een afgedrukt register ziet staan, weet meteen dat het
   nog niet af is. Dat is het hele punt. */
const NIET_GEVRAAGD = '_(Rahul heeft dit nog niet uitgevraagd)_';
const GEPARKEERD = '_(nog niet bekend -- Rahul vraagt dit opnieuw)_';

const schoon = (t) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, MAX);

/* Is dit een antwoord of een schouderophalen? Wie het niet weet mag parkeren,
   maar dan wel expliciet -- niet door "geen idee" als feit te laten vastleggen. */
const WEET_NIET = /^(geen idee|weet ik niet|weet niet|nvt|n\.v\.t\.|\?+|onbekend|later|nog niet)$/i;

/* Een antwoord vastleggen. Geeft { ok } of { fout } terug; nooit een verzinsel.
   parkeer: true legt vast dat het nog niet bekend is (blijft open tellen). */
function antwoord(id, waarde, opties) {
  const o = opties || {};
  const v = OP_ID.get(String(id || ''));
  if (!v) return { fout: 'Die vraag ken ik niet.' };
  const s = opslag.laad();

  const tekst = schoon(waarde);
  const parkeer = !!o.parkeer || (tekst && WEET_NIET.test(tekst));

  if (parkeer) {
    s.antwoorden[v.id] = { parkeer: true, waarde: null, notitie: tekst || null,
      door: schoon(o.door) || null, at: new Date().toISOString() };
    s.bijgewerkt = s.antwoorden[v.id].at;
    opslag.bewaar(s);
    return { ok: true, geparkeerd: true,
      terug: 'Genoteerd als nog niet bekend. Ik vraag het later opnieuw; zo lang blijft dit punt openstaan en gaat de keuring er niet overheen.' };
  }

  if (!tekst) return { fout: 'Daar staat nog niets. Zeg het gerust in uw eigen woorden, of laat het parkeren als u het nu niet weet.' };

  if (v.soort === 'ja-nee-reden') {
    // ja of nee mag, maar dan mét toelichting -- een kaal "ja" is geen dossier
    if (tekst.length < 4)
      return { fout: 'Een kaal ja of nee kan ik niet vastleggen. Zet erbij met wie, of per wanneer.' };
  } else if (tekst.length < (v.min || 4)) {
    return { fout: 'Dat is wel erg kort voor dit veld. ' + (v.voorbeeld ? 'Zoiets als: ' + v.voorbeeld : '') };
  }

  s.antwoorden[v.id] = { waarde: tekst, parkeer: false, door: schoon(o.door) || null, at: new Date().toISOString() };
  s.bijgewerkt = s.antwoorden[v.id].at;
  opslag.bewaar(s);
  return { ok: true, terug: 'Genoteerd.' };
}

/* Wat staat er nog open? Een geparkeerd antwoord telt als open. */
function openVragen() {
  const a = opslag.laad().antwoorden;
  return VRAGEN.filter(v => !a[v.id] || a[v.id].parkeer || !a[v.id].waarde);
}

/* De eerstvolgende vraag, in Rahuls woorden. Null = alles is beantwoord. */
function volgende() {
  const open = openVragen();
  const v = open[0];
  if (!v) return null;
  const eerder = opslag.laad().antwoorden[v.id];
  return {
    id: v.id, groep: v.groep, soort: v.soort,
    vraag: v.vraag, waarom: v.waarom,
    voorbeeld: v.voorbeeld || null,
    jaVraag: v.jaVraag || null, neeVraag: v.neeVraag || null,
    eerderGeparkeerd: !!(eerder && eerder.parkeer),
    open: open.length, totaal: VRAGEN.length
  };
}

/* Het overzicht voor het techniekbord: per vraag de stand, nooit half. */
function overzicht() {
  const s = opslag.laad();
  const a = s.antwoorden;
  const regels = VRAGEN.map(v => {
    const g = a[v.id];
    return { id: v.id, groep: v.groep, vraag: v.vraag,
      status: !g ? 'open' : (g.parkeer ? 'geparkeerd' : 'ingevuld'),
      waarde: g && !g.parkeer ? g.waarde : null,
      door: g ? g.door : null, at: g ? g.at : null };
  });
  const open = regels.filter(r => r.status !== 'ingevuld').length;
  return { totaal: VRAGEN.length, open, klaar: open === 0, bijgewerkt: s.bijgewerkt, regels };
}

const klaar = () => openVragen().length === 0;

/* Het document invullen. Elk {{merkteken}} wordt het echte antwoord; wat nog
   openstaat blijft zichtbaar als openstaand. Een register dat zijn eigen gaten
   verbergt is gevaarlijker dan een register met gaten. */
function vulIn(tekst) {
  const s = opslag.laad();
  const a = s.antwoorden;
  return String(tekst == null ? '' : tekst).replace(/\{\{(\w+)\}\}/g, (heel, veld) => {
    // {{bijgewerkt}} is geen vraag maar een feit dat het systeem zelf weet:
    // wanneer is er voor het laatst een antwoord veranderd?
    if (veld === 'bijgewerkt') return s.bijgewerkt ? s.bijgewerkt.slice(0, 10) : NIET_GEVRAAGD;
    const v = OP_VELD.get(veld);
    if (!v) return heel;
    const g = a[v.id];
    if (g && !g.parkeer && g.waarde) return g.waarde;
    return g && g.parkeer ? GEPARKEERD : NIET_GEVRAAGD;
  });
}

/* Het ingevulde document. Geeft ook terug hoeveel plekken er nog openstaan,
   zodat de aanroeper dat niet zelf hoeft te tellen (en niet vergeet). */
function document(naam) {
  const d = DOCUMENTEN[String(naam || '')];
  if (!d) return { fout: 'Onbekend document.' };
  let bron;
  try { bron = fs.readFileSync(path.join(__dirname, '..', '..', d.bestand), 'utf8'); }
  catch (e) { return { fout: d.bestand + ' staat niet op zijn plek.' }; }
  const tekst = vulIn(bron);
  const gaten = (tekst.match(/_\(Rahul heeft dit nog niet|_\(nog niet bekend/g) || []).length;
  return { bestand: d.bestand, waarvoor: d.waarvoor, tekst, gaten };
}

module.exports = { VRAGEN, DOCUMENTEN, volgende, antwoord, overzicht, openVragen, klaar, vulIn, document };
