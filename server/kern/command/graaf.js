/* DE KENNISGRAAF -- wat hangt waaraan vast, en hoe kom je van hier naar daar.

   Het objectdossier (./object.js) beantwoordt één vraag: wie verwijst naar DIT
   object? Dat is één stap. De graaf beantwoordt de vraag erachter: hoe hangt
   dit geheel samen, en wat ligt er twee of drie stappen verderop -- de klant
   achter de bestelling achter de rit die vastloopt.

   HIJ WORDT GEMETEN, NIET GETEKEND. Er is geen schema dat zegt welke soort aan
   welke hangt. De randen komen uit ./kwaliteit.js, dat meet welk veld in de
   praktijk vrijwel altijd een bestaande sleutel van een andere soort bevat. Dat
   is dezelfde meting, één keer gedaan en twee keer gebruikt: daar levert hij de
   wezen op, hier de randen. Een tweede schema zou binnen een maand iets anders
   beweren dan de gegevens.

   EN HIJ IS BEGRENSD, MET DE GRENS IN DE UITSLAG. Een graaf over een echt
   platform is groot genoeg om een scherm mee te laten vastlopen. Wandelen gaat
   daarom tot een diepte en een breedte die de aanroeper kiest, en het antwoord
   zegt of hij tegen die grens aan liep. Een graaf die stil afkapt, laat je
   geloven dat het pad er niet is.

   HIJ ERFT DE SCOPE VAN ZIJN REGISTER. Krijgt hij het register van één zaak,
   dan bestaat de rest van het platform voor hem niet -- niet omdat er gefilterd
   wordt maar omdat de soorten er niet in zitten. Zo hoort het: de graaf is het
   gevaarlijkste stuk om ongescoped te laten, want hij loopt juist wél door. */
'use strict';

const { s } = require('./register');

const MAX_SCAN = 20000;
const MAX_BUREN = 40;      // per soort, per knoop
const MAX_KNOPEN = 400;    // een wandeling in het geheel

function maakGraaf({ db, register, kwaliteit }) {
  /* De randen: van welke soort, via welk veld, naar welke soort. Eén keer per
     aanroep opgebouwd uit dezelfde meting die de kwaliteitslaag doet. */
  function randen() {
    const uit = [];
    for (const soort of register.SOORTEN) {
      for (const ref of kwaliteit.verwijzingenVan(soort)) {
        uit.push({ van: soort.type, veld: ref.veld, naar: ref.wijstNaar, deel: ref.deel });
      }
    }
    return uit;
  }

  /* De vorm van de graaf: welke soorten er zijn, hoeveel objecten erin zitten
     en welke randen ertussen lopen. Dit is het antwoord op "hoe hangt dit
     samen" zonder één object te noemen. */
  function vorm() {
    const knopen = register.SOORTEN.map(so => ({
      type: so.type, label: so.label, meervoud: so.meervoud, domein: so.domein,
      aantal: register.rijen(db, so).length
    }));
    const r = randen();
    return {
      knopen, randen: r,
      dicht: r.length ? Math.round((r.length / (knopen.length * Math.max(1, knopen.length - 1))) * 100) : 0,
      losse: knopen.filter(k => !r.some(x => x.van === k.type || x.naar === k.type)).map(k => k.type),
      uitleg: 'de randen zijn gemeten uit de gegevens, niet uit een schema: een veld heet een verwijzing ' +
        'zodra het in de praktijk vrijwel altijd een bestaande sleutel van een andere soort bevat'
    };
  }

  function rijMet(soort, sleutel) {
    const alle = register.rijen(db, soort);
    const k = String(sleutel).toLowerCase();
    const grens = Math.min(alle.length, MAX_SCAN);
    for (let i = 0; i < grens; i++) {
      const r = alle[i];
      if (r && s(r[soort.sleutel]).toLowerCase() === k) return r;
    }
    return null;
  }

  /* De buren van één knoop: beide kanten op. Vooruit langs de velden die dit
     object draagt, achteruit langs de objecten die dit object noemen. */
  function buren(type, id, r) {
    const uit = [];
    const alleRanden = randen();
    const soort = register.OP_TYPE.get(type);
    if (!soort) return uit;

    for (const rand of alleRanden.filter(x => x.van === type)) {
      const w = s(r[rand.veld]);
      if (!w) continue;
      const doel = register.OP_TYPE.get(rand.naar);
      const rij = doel ? rijMet(doel, w) : null;
      if (rij) uit.push({ richting: 'naar', type: rand.naar, id: s(rij[doel.sleutel]),
        titel: register.kort(doel, rij).titel, via: rand.veld });
    }

    const sleutel = s(r[soort.sleutel]).toLowerCase();
    for (const rand of alleRanden.filter(x => x.naar === type)) {
      const bron = register.OP_TYPE.get(rand.van);
      if (!bron) continue;
      const alle = register.rijen(db, bron);
      const grens = Math.min(alle.length, MAX_SCAN);
      let n = 0;
      for (let i = 0; i < grens && n < MAX_BUREN; i++) {
        const q = alle[i];
        if (!q || s(q[rand.veld]).toLowerCase() !== sleutel) continue;
        n++;
        uit.push({ richting: 'van', type: rand.van, id: s(q[bron.sleutel]),
          titel: register.kort(bron, q).titel, via: rand.veld });
      }
    }
    return uit;
  }

  /* Wandelen vanaf één object tot een gekozen diepte. Breedte-eerst, want dan
     is "twee stappen verderop" ook echt twee stappen en niet toevallig een
     lange tak die als eerste werd afgelopen. */
  function wandel(type, id, diepte) {
    const start = register.OP_TYPE.get(String(type));
    if (!start) return { error: 'Onbekende soort: ' + type, status: 404 };
    const rij = rijMet(start, id);
    if (!rij) return { error: 'Niet gevonden: ' + type + ' ' + id, status: 404 };

    const max = Math.max(1, Math.min(Number(diepte || 2), 4));
    const gezien = new Set([type + ':' + s(rij[start.sleutel])]);
    const lagen = [[{ type: String(type), id: s(rij[start.sleutel]),
      titel: register.kort(start, rij).titel, rij }]];
    let afgekapt = false;

    for (let d = 0; d < max; d++) {
      const volgende = [];
      for (const knoop of lagen[d]) {
        for (const b of buren(knoop.type, knoop.id, knoop.rij)) {
          const sleutel = b.type + ':' + b.id;
          if (gezien.has(sleutel)) continue;
          if (gezien.size >= MAX_KNOPEN) { afgekapt = true; break; }
          gezien.add(sleutel);
          const so = register.OP_TYPE.get(b.type);
          const r2 = so ? rijMet(so, b.id) : null;
          if (r2) volgende.push(Object.assign({}, b, { rij: r2, vanaf: knoop.type + ':' + knoop.id }));
        }
        if (afgekapt) break;
      }
      if (!volgende.length) break;
      lagen.push(volgende);
    }

    return {
      start: { type: String(type), id: s(rij[start.sleutel]), titel: register.kort(start, rij).titel },
      diepte: lagen.length - 1, knopen: gezien.size, afgekapt,
      lagen: lagen.map((laag, i) => ({ stap: i, aantal: laag.length,
        objecten: laag.map(k => ({ type: k.type, id: k.id, titel: k.titel, via: k.via || null,
          richting: k.richting || null, vanaf: k.vanaf || null })) })),
      grens: afgekapt ? 'de wandeling raakte de grens van ' + MAX_KNOPEN + ' knopen; er ligt meer achter' : null
    };
  }

  return { vorm, wandel, buren, randen };
}

module.exports = { maakGraaf, MAX_KNOPEN, MAX_BUREN };
