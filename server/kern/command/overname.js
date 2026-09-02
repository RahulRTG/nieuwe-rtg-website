/* OVERNAMEMODUS -- de administratie van een overgenomen bedrijf inlezen.

   VIER STAPPEN, EN DE VOLGORDE IS DE HELE VEILIGHEID:

     1 inlezen     de rijen komen binnen zoals ze zijn, en er verandert niets
     2 afbeelden   welk veld van hen is welk veld van ons (met een VOORSTEL,
                   gemeten uit hun eigen rijen, dat een mens bevestigt)
     3 droogloop   wat zou er gebeuren, en wat gaat er mis
     4 uitvoeren   alleen wat door de droogloop kwam, en alleen met het zegel
                   van precies díe droogloop

   HET ZEGEL IS HET PUNT. Uitvoeren zonder droogloop kan niet, en uitvoeren op
   een andere partij dan je hebt bekeken ook niet: het zegel is een hash van de
   rijen plus de afbeelding. Verandert er tussendoor iets -- iemand laadt een
   nieuw bestand, iemand schuift een veld -- dan past het zegel niet meer en
   weigert de uitvoering. Zonder dat kun je een keurig rapport goedkeuren en
   iets anders importeren, en dat is precies hoe een migratie stil misgaat.

   ER WORDT NOOIT IETS OVERSCHREVEN. Een rij waarvan de sleutel al bestaat is
   een BOTSING en geen bijwerking. Bijwerken lijkt behulpzaam en is het niet:
   dan overschrijft een overgenomen administratie stilletjes de onze, en is
   achteraf niet te zien welke waarde van wie kwam.

   EN ALLES WAT ERIN GAAT DRAAGT ZIJN PARTIJ (overnameBatch). Daardoor is
   terug() geen tweede motor maar dezelfde handeling omgekeerd: precies de rijen
   van deze partij eruit, en geen enkele andere. */
'use strict';

const { s } = require('./register');

const { NIVEAUS } = require('../frictie');

const MAX_RIJEN = 5000;

function maakOvername({ db, save, crypto, journaal, register, opslag }) {
  function alle() {
    return opslag.bak('overnames');
  }
  const nu = () => new Date().toISOString();

  function zegelVan(o) {
    return crypto.createHash('sha256')
      .update(JSON.stringify({ rijen: o.rijen, afbeelding: o.afbeelding, soort: o.soort }))
      .digest('hex').slice(0, 16);
  }

  /* Stap 1. De rijen komen binnen zoals ze zijn; er wordt niets geraden en
     niets weggegooid. */
  function lees(naam, soort, rijen, door) {
    const k = register.OP_TYPE.get(String(soort));
    if (!k) return { error: 'Onbekende soort: ' + soort, status: 404 };
    if (!Array.isArray(rijen) || !rijen.length) return { error: 'Er zaten geen rijen in.', status: 400 };
    if (rijen.length > MAX_RIJEN) {
      return { error: 'Meer dan ' + MAX_RIJEN + ' rijen in één partij. Knip hem op; een partij die je ' +
        'niet meer kunt nalopen, keurt niemand echt goed.', status: 400 };
    }
    const id = crypto.randomUUID().slice(0, 8);
    alle()[id] = {
      id, naam: String(naam || 'partij ' + id).slice(0, 80), soort: k.type, at: nu(),
      door: String(door || 'onbekend'), stand: 'ingelezen',
      rijen: rijen.slice(0, MAX_RIJEN), afbeelding: null, rapport: null, uitgevoerd: null
    };
    save();
    return { partij: kort(alle()[id]), voorstel: voorstel(id) };
  }

  /* Stap 2, het voorstel: welk veld van hen is welk veld van ons. Dat wordt
     GEMETEN uit hun eigen rijen en staat in ./overnamevoorstel.js. */
  const voorstel = (id) => require('./overnamevoorstel')
    .voorstel(alle()[String(id)], register, s);

  function beeldAf(id, afbeelding, door) {
    const o = alle()[String(id)];
    if (!o) return { error: 'Die partij bestaat niet.', status: 404 };
    const k = register.OP_TYPE.get(o.soort);
    const a = afbeelding && typeof afbeelding === 'object' ? afbeelding : null;
    if (!a || !a[k.sleutel]) {
      return { error: 'De afbeelding moet in elk geval zeggen welk veld onze sleutel (' + k.sleutel +
        ') draagt.', status: 400 };
    }
    o.afbeelding = a;
    o.stand = 'afgebeeld';
    o.rapport = null;                 // een nieuwe afbeelding is een nieuwe proef
    o.door = String(door || o.door);
    save();
    return { partij: kort(o) };
  }

  function bestaandeSleutels(k) {
    const set = new Set();
    for (const r of register.rijen(db, k)) { const v = s(r && r[k.sleutel]); if (v) set.add(v.toLowerCase()); }
    return set;
  }

  /* Stap 3. Rekent alles uit en raakt niets aan. */
  function droogloop(id) {
    const o = alle()[String(id)];
    if (!o) return { error: 'Die partij bestaat niet.', status: 404 };
    if (!o.afbeelding) return { error: 'Beeld eerst af welk veld welk veld is.', status: 409 };
    const k = register.OP_TYPE.get(o.soort);
    const bestaat = bestaandeSleutels(k);
    const gezien = new Set();
    const goed = [], mis = [];

    for (let i = 0; i < o.rijen.length; i++) {
      const bron = o.rijen[i] || {};
      const rij = {};
      for (const [onsVeld, hunVeld] of Object.entries(o.afbeelding)) {
        if (!hunVeld) continue;
        if (bron[hunVeld] !== undefined) rij[onsVeld] = bron[hunVeld];
      }
      const sleutel = s(rij[k.sleutel]);
      if (!sleutel) { mis.push({ regel: i, waarom: 'geen sleutel (' + k.sleutel + ') na afbeelding' }); continue; }
      const laag = sleutel.toLowerCase();
      if (bestaat.has(laag)) {
        mis.push({ regel: i, sleutel, waarom: 'die sleutel bestaat hier al; overschrijven doet deze laag niet' });
        continue;
      }
      if (gezien.has(laag)) { mis.push({ regel: i, sleutel, waarom: 'die sleutel zit twee keer in deze partij' }); continue; }
      gezien.add(laag);
      goed.push(rij);
    }

    o.rapport = {
      at: nu(), zegel: zegelVan(o), aangeboden: o.rijen.length,
      erin: goed.length, mis: mis.length, misVoorbeelden: mis.slice(0, 25),
      velden: Object.keys(o.afbeelding).filter(v => o.afbeelding[v])
    };
    o.stand = 'gedroogd';
    save();
    return { partij: kort(o), rapport: o.rapport, voorbeelden: goed.slice(0, 10) };
  }

  /* Stap 4. Alleen met het zegel van precies deze droogloop. */
  function voer(id, zegel, door, reden) {
    const o = alle()[String(id)];
    if (!o) return { error: 'Die partij bestaat niet.', status: 404 };
    if (!o.rapport) return { error: 'Draai eerst een droogloop.', status: 409 };
    if (o.uitgevoerd) return { error: 'Deze partij is al uitgevoerd.', status: 409 };
    if (zegelVan(o) !== o.rapport.zegel) {
      return { error: 'De partij is veranderd sinds de droogloop. Draai hem opnieuw; anders keur je ' +
        'het ene rapport goed en importeer je iets anders.', status: 409 };
    }
    if (String(zegel || '') !== o.rapport.zegel) {
      return { error: 'Het zegel klopt niet. Neem het zegel over uit het rapport dat je hebt bekeken.', status: 409 };
    }
    const k = register.OP_TYPE.get(o.soort);
    const doel = register.rijen(db, k);
    const uit = droogloop(id);        // opnieuw rekenen: de waarheid is de data, niet het rapport
    const bestaat = bestaandeSleutels(k);
    let erin = 0;
    for (const rij of hergeef(o, k, bestaat)) { doel.push(Object.assign({ overnameBatch: o.id }, rij)); erin++; }
    o.uitgevoerd = { at: nu(), door: String(door || 'onbekend'), erin, reden: String(reden || '') };
    o.stand = 'uitgevoerd';
    save();
    if (journaal) {
      journaal.noteer({ actie: 'overname uitgevoerd', actor: door, niveau: NIVEAUS.hand,
        objectType: o.soort, objectId: o.id, reden: String(reden || ''),
        na: { erin, aangeboden: o.rijen.length } });
    }
    return { partij: kort(o), erin, overgeslagen: uit.rapport.mis };
  }

  function hergeef(o, k, bestaat) {
    const gezien = new Set();
    const uit = [];
    for (const bron of o.rijen) {
      const rij = {};
      for (const [onsVeld, hunVeld] of Object.entries(o.afbeelding)) {
        if (hunVeld && bron && bron[hunVeld] !== undefined) rij[onsVeld] = bron[hunVeld];
      }
      const sleutel = s(rij[k.sleutel]).toLowerCase();
      if (!sleutel || bestaat.has(sleutel) || gezien.has(sleutel)) continue;
      gezien.add(sleutel);
      uit.push(rij);
    }
    return uit;
  }

  /* Terugdraaien: precies de rijen van deze partij en geen andere. */
  function terug(id, door) {
    const o = alle()[String(id)];
    if (!o || !o.uitgevoerd) return { error: 'Die partij is niet uitgevoerd.', status: 404 };
    const k = register.OP_TYPE.get(o.soort);
    const doel = register.rijen(db, k);
    let weg = 0;
    for (let i = doel.length - 1; i >= 0; i--) {
      if (doel[i] && doel[i].overnameBatch === o.id) { doel.splice(i, 1); weg++; }
    }
    o.uitgevoerd = null;
    o.stand = 'teruggedraaid';
    save();
    if (journaal) journaal.noteer({ actie: 'overname teruggedraaid', actor: door, niveau: NIVEAUS.hand,
      objectType: o.soort, objectId: o.id, reden: weg + ' rijen eruit' });
    return { partij: kort(o), weg };
  }

  const kort = (o) => ({ id: o.id, naam: o.naam, soort: o.soort, at: o.at, door: o.door,
    stand: o.stand, rijen: o.rijen.length, afbeelding: o.afbeelding,
    rapport: o.rapport, uitgevoerd: o.uitgevoerd });

  function lijst() {
    const l = alle();
    return { partijen: Object.keys(l).map(id => kort(l[id])),
      soorten: register.SOORTEN.map(k => ({ type: k.type, label: k.label, sleutel: k.sleutel })),
      uitleg: 'inlezen, afbeelden, droogloop, uitvoeren. Uitvoeren kan alleen met het zegel van precies ' +
        'de droogloop die je hebt bekeken, en er wordt nooit iets overschreven.' };
  }

  return { lees, voorstel, beeldAf, droogloop, voer, terug, lijst };
}

module.exports = { maakOvername, MAX_RIJEN };
