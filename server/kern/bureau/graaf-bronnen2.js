/* Het Privekantoor, deelbestand "graaf-bronnen2": het vervolg van
   ./graaf-bronnen.js. Zie daar de uitleg; hier staan de reizen, de gelegenheden,
   de collecties, de kring, de filantropie en de twee besloten kamers.

   De laatste twee zijn de reden dat dit bestand niet zomaar "de rest" is:
   gezondheid en nalatenschap dragen gevoeligheid BESLOTEN, en graaf.js zet hun
   bereik daarmee hoe dan ook op het lid. Dat het hier ook expliciet staat is
   geen dubbeling maar de bedoeling opschrijven waar iemand hem leest. */
'use strict';

const H = require('./graaf-hulp');
const { OPEN, PERSOONLIJK, VERTROUWELIJK, BESLOTEN, isDatum, straks, lijst, obj, volgendeJaardag } = H;

const DEEL2 = [
  /* ---- De digitale tweeling: ruimtes en installaties onder een woning.

     Dit is de reden dat de tweeling geen eigen waarschuwingssysteem heeft. Elke
     pomp, ketel en lift levert hier zijn onderhouds- en garantiedatum in, en
     vanaf dat punt is hij niet meer te onderscheiden van een verzekering of een
     paspoort: dezelfde Control Tower, dezelfde Situation Room, dezelfde
     achterstalligheid. De installatie hangt met `ouder` aan de bezitting, zodat
     de tower "Villa Ibiza" bij de beurt kan zetten. ---- */
  { kamer: 'huishouden', knopen(l, K) {
    const alle = obj(l.twin), uit = [];
    for (const [huisId, t] of Object.entries(alle)) {
      const huis = 'bezit:' + huisId;
      for (const r of lijst(obj(t).ruimtes)) {
        for (const i of lijst(r.installaties)) {
          const id = 'inst:' + i.id;
          uit.push(K({ id, soort: 'installatie', naam: (r.naam ? r.naam + ' · ' : '') + i.naam,
            kamer: 'huishouden', bron: 'Woningtweeling', gevoelig: PERSOONLIJK,
            deel: 'rechterhand', ouder: huis }));
          for (const [veld, wat] of [['onderhoudOp', 'onderhoud'], ['garantieTot', 'garantie']]) {
            if (!isDatum(i[veld])) continue;
            uit.push(K({ id: id + ':' + wat, soort: 'termijn', naam: i.naam + ' · ' + wat,
              kamer: 'huishouden', bron: 'Woningtweeling', gevoelig: PERSOONLIJK,
              deel: 'rechterhand', vervalt: i[veld], vervaltWat: wat, ouder: id }));
          }
        }
      }
    }
    return uit;
  } },

    /* ---- Reisboek: de reizen en hun documenten ---- */
    { kamer: 'reizen', knopen(l, K) {
      const uit = [];
      for (const r of lijst(l.reizen)) {
        const id = 'reis:' + r.id;
        uit.push(K({ id, soort: 'reis', naam: r.naam, kamer: 'reizen', bron: 'Reisboek',
          gevoelig: VERTROUWELIJK, deel: 'rechterhand',
          vervalt: straks(r.van), vervaltWat: 'vertrek' }));
        for (const d of lijst(r.documenten)) {
          if (!isDatum(d.geldigTot)) continue;
          uit.push(K({ id: id + ':doc:' + d.id, soort: 'termijn',
            naam: (d.houder ? d.houder + ' · ' : '') + d.soort, kamer: 'reizen', bron: 'Reisboek',
            gevoelig: VERTROUWELIJK, deel: 'rechterhand',
            vervalt: d.geldigTot, vervaltWat: d.soort || 'reisdocument', ouder: id }));
        }
      }
      return uit;
    } },

    /* ---- Table: de gelegenheden die nog komen ---- */
    { kamer: 'gelegenheden', knopen(l, K) {
      return lijst(l.tables).map(e => K({ id: 'gelegenheid:' + e.id, soort: 'gelegenheid', naam: e.naam,
        kamer: 'gelegenheden', bron: 'Table', gevoelig: PERSOONLIJK, deel: 'kantoor',
        vervalt: straks(e.datum), vervaltWat: 'gelegenheid' }));
    } },

    /* ---- Cellier: de kelder. Het drinkvenster is een jaartal, dus wordt het
       hier 31 december van dat jaar -- de laatste dag dat de bewering "hij is
       op zijn mooist" nog klopt. ---- */
    { kamer: 'collectie', knopen(l, K) {
      return lijst(l.cellier).map(f => K({ id: 'fles:' + f.id, soort: 'fles',
        naam: f.naam + (f.jaargang ? ' ' + f.jaargang : ''), kamer: 'collectie', bron: 'Cellier',
        gevoelig: OPEN, deel: 'kantoor', waarde: (Number(f.waarde) || 0) * (Number(f.aantal) || 0),
        vervalt: f.drinkTot ? f.drinkTot + '-12-31' : '', vervaltWat: 'drinkvenster' }));
    } },

    /* ---- Garde-robe ---- */
    { kamer: 'collectie', knopen(l, K) {
      const g = obj(l.garderobe);
      return lijst(g.stukken).map(s => K({ id: 'stuk:' + s.id, soort: 'stuk', naam: s.naam,
        kamer: 'collectie', bron: 'Garde-robe', gevoelig: OPEN, deel: 'kantoor' }));
    } },

    /* ---- Cercle: de clubs ---- */
    { kamer: 'kring', knopen(l, K) {
      return lijst(l.cercle).map(c => K({ id: 'club:' + c.id, soort: 'club', naam: c.naam,
        kamer: 'kring', bron: 'Cercle', gevoelig: OPEN, deel: 'kantoor' }));
    } },

    /* ---- Mecenaat: toegezegde giften die nog betaald moeten worden ---- */
    { kamer: 'filantropie', knopen(l, K) {
      return lijst(l.mecenaat).map(g => K({ id: 'gift:' + g.id, soort: 'gift', naam: g.doel,
        kamer: 'filantropie', bron: 'Mecenaat', gevoelig: PERSOONLIJK, deel: 'rechterhand',
        waarde: g.bedrag, vervalt: g.betaald ? '' : straks(g.datum), vervaltWat: 'toezegging' }));
    } },

    /* ---- Gezondheid: BESLOTEN. graaf.js zet `deel` hier hoe dan ook op 'lid';
       dat het hier ook staat is geen dubbeling maar de bedoeling opschrijven op
       de plek waar iemand hem leest. ---- */
    { kamer: 'gezondheid', knopen(l, K) {
      return lijst(l.afspraken).map(a => K({ id: 'afspraak:' + a.id, soort: 'afspraak', naam: a.wat,
        kamer: 'gezondheid', bron: 'Gezondheid', gevoelig: BESLOTEN, deel: 'lid',
        vervalt: straks(a.datum), vervaltWat: 'afspraak' }));
    } },

    /* ---- Nalatenschap: BESLOTEN. Alleen dat het bestaat en hoe het heet; de
       inhoud staat versleuteld in zijn eigen app en komt de graaf niet in. ---- */
    { kamer: 'nalatenschap', knopen(l, K) {
      const n = obj(l.nalatenschap);
      return lijst(n.documenten).map(d => K({ id: 'nadoc:' + d.id, soort: 'document', naam: d.titel,
        kamer: 'nalatenschap', bron: 'Nalatenschap', gevoelig: BESLOTEN, deel: 'lid' }));
    } }
];

module.exports = DEEL2;
