/* RTG School, de Learning Fabric: de structuur waar elk vak op draait.

   Dit bestand gaat over de GRAAF, ./leerstof.js over de stroom. Dat is een
   echte knip en geen opdeling om de omvang: hier staat wat een leerdoel IS en
   of de lijnen kloppen; daar staat wat een leerling ermee doet (de leerlijn
   per groep, de les, de oefensessie).

   De keuring hieronder draait bij het OPSTARTEN en niet in een toets ernaast:
   een leerlijn die naar een niet-bestaand doel verwijst is kapot, en kapot
   hoort luid te zijn. */
const { FASEN } = require('./onderwijs-ladder');

/* ---------- de Fabric: waaruit een leerdoel bestaat ----------
   Een leerdoel was tot nu toe een naam, een zin uitleg en een generator. Dat
   draagt een oefenmotor maar geen onderwijs: je kunt er niet mee zeggen WAT
   iemand hiervoor nodig had, en je kunt hetzelfde doel niet ANDERS uitleggen.
   Beide zijn geen extraatje maar de kern van de zaak -- een kind dat vastloopt
   heeft meestal geen twintig extra sommen nodig maar een ontbrekende bouwsteen
   of een tweede uitleg.

   Daarom draagt een doel er drie velden bij, allemaal optioneel zodat de
   bestaande leerlijnen precies blijven werken zoals ze werkten:

   - vereist: de leerdoelen die hieraan voorafgaan (de voorkennisgraaf);
   - uitleg:  dezelfde stof in andere vormen (zie SOORTEN hieronder);
   - meting:  hoeveel opgaven, en hoeveel goed telt als behaald.

   De invarianten staan hieronder in keurLeerstof() en draaien BIJ HET
   OPSTARTEN, niet in een toets ernaast: een leerlijn die naar een niet-bestaand
   doel verwijst is kapot, en kapot hoort luid te zijn. */
const UITLEG_SOORTEN = ['eenvoudig', 'stap', 'visueel', 'praktijk', 'verhaal', 'analogie', 'hoger'];
const STANDAARD_METING = { opgaven: 5, drempel: 4 };

/* De volgorde van een doel in de leerlijn: eerst de groepen (po), daarna de
   fasen in de volgorde van de ladder. Nodig voor de invariant dat voorkennis
   ERVOOR ligt -- een voorwaarde die verderop staat, is geen voorwaarde. */
function volgorde(d) {
  if (d.groep != null) return d.groep;
  const ix = FASEN.findIndex(f => f.id === d.fase);
  return 100 + (ix < 0 ? 99 : ix);
}

/* De keuring van de leerlijnen. Draait een keer bij het opstarten en gooit,
   want een leerlijn met een gat is geen leerlijn. Vijf regels:

   1. een vereiste die niet bestaat, is een typefout die als lege les eindigt;
   2. voorkennis ligt ervoor, nooit erna of ernaast in dezelfde stap;
   3. geen kringetje: A vereist B vereist A laat elk pad oneindig lopen;
   4. een uitlegsoort komt uit de vaste lijst (anders kiest elk scherm zijn eigen);
   5. je kunt niet meer goed nodig hebben dan er opgaven zijn. */
function keurLeerstof(doelen) {
  for (const d of Object.values(doelen)) {
    for (const v of (d.vereist || [])) {
      if (!doelen[v]) throw new Error('leerstof: ' + d.id + ' vereist ' + v + ', maar dat leerdoel bestaat niet');
      if (volgorde(doelen[v]) > volgorde(d)) throw new Error('leerstof: ' + d.id + ' vereist ' + v + ', dat verderop in de leerlijn staat');
    }
    for (const u of (d.uitleg || [])) {
      if (!UITLEG_SOORTEN.includes(u.soort)) throw new Error('leerstof: ' + d.id + ' heeft een onbekende uitlegsoort: ' + u.soort);
      if (!String(u.tekst || '').trim()) throw new Error('leerstof: ' + d.id + ' heeft een lege uitleg (' + u.soort + ')');
    }
    const m = d.meting;
    if (m && (!(m.opgaven >= 1) || !(m.drempel >= 1) || m.drempel > m.opgaven))
      throw new Error('leerstof: ' + d.id + ' heeft een onmogelijke meting (' + m.drempel + ' van ' + m.opgaven + ')');
  }
  // kringetjes: diepte-eerst met een pad-stempel
  const bezig = {}, klaar = {};
  const loop = (id, pad) => {
    if (klaar[id]) return;
    if (bezig[id]) throw new Error('leerstof: kringetje in de voorkennis: ' + pad.concat([id]).join(' -> '));
    bezig[id] = true;
    for (const v of (doelen[id].vereist || [])) loop(v, pad.concat([id]));
    bezig[id] = false; klaar[id] = true;
  };
  for (const id of Object.keys(doelen)) loop(id, []);
  return doelen;
}
/* De weg naar een doel. De doelenlijst komt MEE in plaats van hier te wonen:
   deze laag beschrijft de graaf en bezit hem niet -- anders staat de data op
   twee plekken en is de tweede binnen een maand de verkeerde.
   De weg naar een doel: welke voorkennis staat er onder, en wat daarvan is nog
   niet behaald. Dit is het antwoord op "waarom lukt dit niet" dat geen enkel
   percentage geeft. Diepte-eerst, voorkennis eerst, elk doel een keer. */
function pad(doelId, behaald, doelen) {
  const uit = [], gezien = {};
  const loop = (id) => {
    const d = doelen[id];
    if (!d || gezien[id]) return;
    gezien[id] = true;
    for (const v of (d.vereist || [])) loop(v);
    uit.push({ id, naam: d.naam, vak: d.vak, groep: d.groep != null ? d.groep : null,
      fase: d.fase || null, behaald: !!(behaald || {})[id] });
  };
  loop(doelId);
  return uit;
}

module.exports = { UITLEG_SOORTEN, STANDAARD_METING, volgorde, keurLeerstof, pad };
