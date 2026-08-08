/* Het Privekantoor, deelbestand "graaf-bronnen": waar de knopen vandaan komen.

   Elke bron leest EEN lijst uit het dossier van het lid en levert knopen. Meer
   doet hij niet: geen opslag, geen zijeffecten, geen save(). Zo blijft ./graaf.js
   de engine en staat hier alleen de vertaalslag per app.

   TWEE SOORTEN KNOPEN, en het verschil doet ertoe voor de Control Tower:

     het DING zelf        een huis, een toestel, een persoon, een fles. Draagt
                          waarde en relaties, maar zelden een datum.
     de TERMIJN eronder   de verzekering van dat huis, het visum van die persoon,
                          de keuring van dat toestel. Draagt de datum, en hangt
                          met `ouder` aan het ding.

   Dat een bezitting drie termijnen kan hebben (verzekering, taxatie, onderhoud)
   is precies waarom het zo moet: een knoop met een enkel `vervalt`-veld zou er
   twee laten vallen. Nu is elke termijn zijn eigen knoop en telt de tower ze
   allemaal.

   WAT HIER NIET GEBEURT: verbanden verzinnen die niet in de data staan. Maison
   kent staf en taken, maar koppelt staf NIET aan een bepaald huis -- dus hangen
   de personeelsleden hier aan het huishouden en niet aan een villa. Een lijn
   trekken die het lid nooit heeft getrokken is een bewering doen namens hem, en
   die komt later terug als een chauffeur die op het verkeerde adres staat.

   Dit bestand draagt de bezittingen, het huishouden en het vervoer; de kring, de
   reizen en de collecties staan in ./graaf-bronnen2.js. De knip zit op tien KB
   en niet op een inhoudelijke grens -- de lijst is een lijst. Het gedeelde
   gereedschap staat in ./graaf-hulp.js, zodat de twee helften niet ieder hun
   eigen uitleg van "voorbij" kunnen krijgen. */
'use strict';

const H = require('./graaf-hulp');
const { PERSOONLIJK, VERTROUWELIJK, isDatum, straks, lijst, obj, volgendeJaardag } = H;

// Waar hoort een bezitting thuis? Het register kent een soort; de kamers van het
// Privekantoor zijn grover. Deze tabel is de enige plek waar dat verband ligt.
const BEZIT_KAMER = { vastgoed: 'huishouden', voertuig: 'vervoer', vaartuig: 'vervoer',
  kunst: 'collectie', horloge: 'collectie', sieraad: 'collectie', overig: 'vermogen' };

/* De termijnen die aan een bezitting hangen. Alle drie dezelfde vorm, dus een
   tabel in plaats van drie keer bijna dezelfde regel. */
const BEZIT_TERMIJNEN = [
  { veld: 'verzekerdTot', wat: 'verzekering' },
  { veld: 'taxatieOp', wat: 'taxatie' },
  { veld: 'onderhoudOp', wat: 'onderhoud' }
];

const DEEL1 = [

    /* ---- Bezittingenregister: huizen, voertuigen, kunst, de rest ---- */
    { kamer: 'vermogen', knopen(l, K) {
      const uit = [];
      for (const b of lijst(l.bezittingen)) {
        const kamer = BEZIT_KAMER[b.soort] || 'vermogen';
        const id = 'bezit:' + b.id;
        uit.push(K({ id, soort: b.soort === 'vastgoed' ? 'huis' : 'bezit', naam: b.naam, kamer,
          bron: 'Bezittingenregister', gevoelig: PERSOONLIJK, deel: 'rechterhand', waarde: b.waarde }));
        for (const t of BEZIT_TERMIJNEN) {
          if (!isDatum(b[t.veld])) continue;
          uit.push(K({ id: id + ':' + t.wat, soort: 'termijn', naam: t.wat, kamer,
            bron: 'Bezittingenregister', gevoelig: PERSOONLIJK, deel: 'rechterhand',
            vervalt: b[t.veld], vervaltWat: t.wat, ouder: id }));
        }
      }
      return uit;
    } },

    /* ---- Maison: het huishouden, zijn staf en de lopende taken ---- */
    { kamer: 'huishouden', knopen(l, K) {
      const m = obj(l.maison), uit = [];
      for (const s of lijst(m.staf)) {
        uit.push(K({ id: 'staf:' + s.id, soort: 'persoon', naam: s.naam, kamer: 'staf',
          bron: 'Maison', eigenaar: s.naam, gevoelig: VERTROUWELIJK, deel: 'rechterhand' }));
      }
      for (const t of lijst(m.taken)) {
        if (t.klaar) continue;
        uit.push(K({ id: 'taak:' + t.id, soort: 'taak', naam: t.wat, kamer: 'huishouden',
          bron: 'Maison', gevoelig: PERSOONLIJK, deel: 'rechterhand',
          vervalt: straks(t.dag), vervaltWat: 'taak',
          ouder: t.voor ? 'staf:' + t.voor : null }));
      }
      return uit;
    } },

    /* ---- Hangar: toestellen en de vluchten die nog komen ---- */
    { kamer: 'vervoer', knopen(l, K) {
      const h = obj(l.hangar), uit = [];
      for (const t of lijst(h.toestellen)) {
        uit.push(K({ id: 'toestel:' + t.id, soort: 'toestel', naam: t.naam, kamer: 'vervoer',
          bron: 'Hangar', gevoelig: PERSOONLIJK, deel: 'rechterhand' }));
      }
      for (const v of lijst(h.vluchten)) {
        const dag = straks(v.datum);
        if (!dag) continue;
        uit.push(K({ id: 'vlucht:' + v.id, soort: 'vlucht', naam: (v.van || '?') + ' → ' + (v.naar || '?'),
          kamer: 'vervoer', bron: 'Hangar', gevoelig: VERTROUWELIJK, deel: 'rechterhand',
          vervalt: dag, vervaltWat: 'vlucht', ouder: 'toestel:' + v.toestelId }));
      }
      return uit;
    } },

    /* ---- Logboek: jachten, oldtimers en hun onderhoudsregels ---- */
    { kamer: 'vervoer', knopen(l, K) {
      const o = obj(l.onderhoud), uit = [];
      for (const x of lijst(o.objecten)) {
        uit.push(K({ id: 'object:' + x.id, soort: 'object', naam: x.naam, kamer: 'vervoer',
          bron: 'Logboek', gevoelig: PERSOONLIJK, deel: 'rechterhand' }));
      }
      for (const r of lijst(o.regels)) {
        if (!isDatum(r.volgende)) continue;
        uit.push(K({ id: 'regel:' + r.id, soort: 'termijn', naam: r.wat, kamer: 'vervoer',
          bron: 'Logboek', gevoelig: PERSOONLIJK, deel: 'rechterhand',
          vervalt: r.volgende, vervaltWat: r.soort || 'onderhoud', ouder: 'object:' + r.objectId }));
      }
      return uit;
    } },

    /* ---- Entourage: de mensen om het lid heen, met hun documenten ----
       Vertrouwelijk: dit zijn andere mensen dan het lid. Hun paspoortnummer is
       niet iets waar een concierge bij hoort te kunnen; de DATUM waarop het
       verloopt wel, want daar moet iemand op tijd iets mee. Vandaar dat de
       persoon en zijn termijn allebei tot de Rechterhand reiken en geen van
       beide tot het bureau. */
    { kamer: 'gezelschap', knopen(l, K) {
      const uit = [];
      for (const p of lijst(l.entourage)) {
        const id = 'persoon:' + p.id;
        uit.push(K({ id, soort: 'persoon', naam: p.naam, kamer: 'gezelschap',
          bron: 'Entourage', eigenaar: p.naam, gevoelig: VERTROUWELIJK, deel: 'rechterhand' }));
        const docs = lijst(p.documenten).slice();
        // het oude losse paspoortveld telt mee zolang er geen echt document is
        if (p.paspoortTot && !docs.some(d => d.soort === 'paspoort')) docs.push({ id: 'paspoort-oud', soort: 'paspoort', tot: p.paspoortTot });
        for (const d of docs) {
          if (!isDatum(d.tot)) continue;
          uit.push(K({ id: id + ':doc:' + d.id, soort: 'termijn', naam: d.soort || 'document',
            kamer: 'gezelschap', bron: 'Entourage', eigenaar: p.naam, gevoelig: VERTROUWELIJK,
            deel: 'rechterhand', vervalt: d.tot, vervaltWat: d.soort || 'document', ouder: id }));
        }
      }
      return uit;
    } },

    /* ---- Attenties: relaties, en de dag waarop ze iets verdienen ---- */
    { kamer: 'kring', knopen(l, K) {
      const a = obj(l.attenties), uit = [];
      for (const r of lijst(a.relaties)) {
        const id = 'relatie:' + r.id;
        uit.push(K({ id, soort: 'relatie', naam: r.naam, kamer: 'kring',
          bron: 'Attenties', eigenaar: r.naam, gevoelig: PERSOONLIJK, deel: 'rechterhand' }));
        for (const [veld, wat] of [['verjaardag', 'verjaardag'], ['jubileum', 'jubileum']]) {
          const dag = volgendeJaardag(r[veld]);
          if (!dag) continue;
          uit.push(K({ id: id + ':' + wat, soort: 'termijn', naam: wat, kamer: 'kring',
            bron: 'Attenties', eigenaar: r.naam, gevoelig: PERSOONLIJK, deel: 'rechterhand',
            vervalt: dag, vervaltWat: wat, ouder: id }));
        }
      }
      return uit;
    } }
];

/* De volledige lijst: de drie helften met wat het LID invulde, plus
   ./graaf-platform.js met wat het PLATFORM al van hem weet (boekingen, agenda).
   Die laatste staat achteraan omdat hij als enige buiten het lifestyle-dossier
   kijkt en daarvoor de sleutel nodig heeft; zie het contract in ./graaf.js. */
module.exports = { ALLE: DEEL1.concat(require('./graaf-bronnen2'), require('./graaf-bronnen3'),
  require('./graaf-platform')) };
