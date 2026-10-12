/* INSTEMMEN OP EEN VASTE VERSIE -- ieder voor zich, en alles of niets.

   Stap 4 van "Five People. Five Private Contexts. One Shared Outcome". Tot
   hier was alles `voorlopig`: een groepsbeeld dat met elke opgave verschuift.
   Een gezamenlijk BESLUIT is iets anders, en het verschil zit in vier regels:

   1 DE REIZIGER LEGT EEN OPTIE VOOR, en die wordt bevroren tot een VERSIE: de
     optie zelf (titel, prijs, data, kenmerken), een vingerafdruk daarvan, en de
     deelnemers op dat moment. Hij kan alleen een optie voorleggen die op dat
     moment voor iedereen past; een voorstel waarvan de server al weet dat het
     iemand niet past, is geen voorstel maar een drukmiddel.
   2 IEDER STEMT ZELF IN, op precies die versie. Het verzoek draagt het
     versienummer en de vingerafdruk die de deelnemer zag; klopt een van de
     twee niet meer, dan is het nee met de reden. Niemand stemt in namens een
     ander, en de reiziger is ook een deelnemer: hij stemt net zo in.
   3 EEN RELEVANTE WIJZIGING LAAT DE VERSIE VERVALLEN, en daarmee alle
     instemmingen erop. Relevant is: de optie veranderde of verdween, er kwam
     iemand bij of ging iemand weg, of de optie past niet meer voor iedereen
     (iemand stelde zijn wensen bij). Dat wordt bij elke lezing BEREKEND en niet
     opgeslagen: een vervallen versie die toevallig nog op `open` stond, kan dan
     niet bestaan.
   4 ALLES OF NIETS. Een versie is pas `aangenomen` als ieder van de bevroren
     deelnemers instemde. Een nee en nog-geen-antwoord zijn voor de anderen
     hetzelfde: ze zien hoeveel er instemden, niet wie, en niet wie nee zei.

   WAT AANGENOMEN NIET IS: geboekt, betaald of bevestigd bij een aanbieder. Het
   is een gezamenlijk besluit binnen het gezelschap. Klaarzetten en uitvoeren
   is stap 5, en geld verlaat het huis daar niet vanzelf.

   OPSLAG op de sleutel van wie het betreft, zodat vergeten het meeneemt: de
   versies bij de reiziger (`reisVoorleggingen`), een instemming bij wie hem gaf
   (`reisInstemmingen`). */
'use strict';

const MAX_VERSIES = 20;

module.exports.maakInstemming = ({ db, save, klok, crypto, reisVan, opgave, optieVan, pastBij }) => {
  const nu = () => klok.datum().toISOString();
  const eigen = require('./eigencollectie')({ db, domein: 'kern/reisgezelschap-instemming',
    bezit: { reisVoorleggingen: 'kaart', reisInstemmingen: 'kaart' } });
  const sl = (eigenaar, reisId) => eigenaar + '|' + reisId;
  const afdruk = (o) => crypto.createHash('sha256')
    .update(JSON.stringify([o.titel, o.prijsPP, o.van, o.tot, o.kenmerken || []])).digest('hex').slice(0, 16);

  function versies(eigenaar, reisId, maak) {
    const k = eigen.bak('reisVoorleggingen');
    if (!k[eigenaar]) { if (!maak) return []; k[eigenaar] = {}; }
    if (!k[eigenaar][reisId]) { if (!maak) return []; k[eigenaar][reisId] = []; }
    return k[eigenaar][reisId];
  }
  const mijnAntwoord = (key, eigenaar, reisId) => ((eigen.bak('reisInstemmingen')[key] || {})[sl(eigenaar, reisId)]) || null;

  /* Is deze versie nog dezelfde als toen hij werd voorgelegd? `null` = ja,
     anders de reden waarom niet. */
  function waaromVervallen(v, eigenaar, reisId) {
    const o = optieVan(eigenaar, reisId, v.optieId);
    if (!o) return 'De reiziger haalde deze optie weg.';
    if (afdruk(o) !== v.vingerafdruk) return 'De optie is veranderd sinds hij werd voorgelegd.';
    const rijen = opgave.voorDeBerekening(eigenaar, reisId);
    const nuWie = rijen.map(r => r.key).sort().join(',');
    if (nuWie !== v.deelnemers.slice().sort().join(',')) return 'Het gezelschap is veranderd sinds het voorstel.';
    if (!rijen.every(r => r.opgave && pastBij(o, r.opgave).past)) return 'De optie past niet meer voor iedereen.';
    return null;
  }

  /* De stand van de laatste versie, voor DEZE lezer. Gedeeld deel en eigen deel
     gescheiden, zoals in de werkruimte. */
  function beeld(eigenaar, reisId, key) {
    const lijst = versies(eigenaar, reisId, false);
    const v = lijst[lijst.length - 1];
    if (!v) return { groep: null, jij: null };
    const reden = v.ingetrokken ? 'De reiziger trok dit voorstel in.' : waaromVervallen(v, eigenaar, reisId);
    const ja = reden ? 0 : v.deelnemers.filter(k => {
      const a = mijnAntwoord(k, eigenaar, reisId);
      return a && a.versie === v.versie && a.vingerafdruk === v.vingerafdruk && a.ja === true;
    }).length;
    const stand = reden ? (v.ingetrokken ? 'ingetrokken' : 'vervallen') : ja === v.deelnemers.length ? 'aangenomen' : 'open';
    const mijn = mijnAntwoord(key, eigenaar, reisId);
    return {
      groep: { versie: v.versie, vingerafdruk: v.vingerafdruk, optie: v.optie, stand, reden,
        instemmingen: { ja, totaal: v.deelnemers.length }, voorgelegdOp: v.op },
      jij: { instemming: !reden && mijn && mijn.versie === v.versie && mijn.vingerafdruk === v.vingerafdruk ? (mijn.ja ? 'ja' : 'nee') : null,
        deelnemer: v.deelnemers.includes(key) }
    };
  }

  function legVoor(key, reisId, optieId) {
    if (!reisVan(key, reisId)) return { status: 404, error: 'Alleen de reiziger legt een voorstel voor.' };
    const o = optieVan(key, reisId, optieId);
    if (!o) return { status: 404, error: 'Die optie bestaat niet.' };
    const rijen = opgave.voorDeBerekening(key, reisId);
    if (!rijen.every(r => r.opgave)) return { status: 409, error: 'Nog niet iedereen heeft zijn wensen opgegeven.' };
    if (!rijen.every(r => pastBij(o, r.opgave).past)) {
      return { status: 409, error: 'Deze optie past niet voor iedereen. Leg een optie voor die dat wel doet, of pas hem aan.' };
    }
    const lijst = versies(key, reisId, true);
    const laatste = lijst[lijst.length - 1];
    const vingerafdruk = afdruk(o);
    // dezelfde optie, onveranderd en nog geldig: geen nieuwe versie (een dubbeltik)
    if (laatste && !laatste.ingetrokken && laatste.optieId === o.id && laatste.vingerafdruk === vingerafdruk &&
      !waaromVervallen(laatste, key, reisId)) return { status: 200, ok: true, versie: laatste.versie, nieuw: false };
    if (lijst.length >= MAX_VERSIES) return { status: 409, error: 'Deze reis heeft al ' + MAX_VERSIES + ' voorstellen gehad.' };
    const v = { versie: (laatste ? laatste.versie : 0) + 1, optieId: o.id, vingerafdruk,
      optie: { titel: o.titel, prijsPP: o.prijsPP, van: o.van, tot: o.tot, kenmerken: (o.kenmerken || []).slice() },
      deelnemers: rijen.map(r => r.key), op: nu() };
    lijst.push(v); save();
    return { status: 200, ok: true, versie: v.versie, nieuw: true };
  }

  function trekVoorstelIn(key, reisId) {
    if (!reisVan(key, reisId)) return { status: 404, error: 'Alleen de reiziger trekt een voorstel in.' };
    const lijst = versies(key, reisId, false), v = lijst[lijst.length - 1];
    if (v && !v.ingetrokken) { v.ingetrokken = nu(); save(); }
    return { status: 200, ok: true };
  }

  /* Instemmen of weigeren, alleen op de versie die de deelnemer ZAG. Hetzelfde
     antwoord nog eens is geen nieuw antwoord. */
  function antwoord(key, reisId, versie, vingerafdruk, ja) {
    const d = opgave.deelnameVan(key, reisId);
    if (!d) return { status: 404, error: 'U reist niet mee met deze reis.' };
    const lijst = versies(d.eigenaar, reisId, false), v = lijst[lijst.length - 1];
    if (!v) return { status: 404, error: 'Er ligt geen voorstel voor.' };
    if (Number(versie) !== v.versie || String(vingerafdruk || '') !== v.vingerafdruk) {
      return { status: 409, error: 'Het voorstel is veranderd. Bekijk versie ' + v.versie + ' voordat u antwoordt.', versie: v.versie };
    }
    if (!v.deelnemers.includes(key)) return { status: 409, error: 'U was geen deelnemer toen dit voorstel werd voorgelegd.' };
    const reden = v.ingetrokken ? 'De reiziger trok dit voorstel in.' : waaromVervallen(v, d.eigenaar, reisId);
    if (reden) return { status: 409, error: reden + ' Er valt niets meer op in te stemmen.' };
    const k = eigen.bak('reisInstemmingen');
    k[key] = k[key] || {};
    const oud = k[key][sl(d.eigenaar, reisId)];
    if (oud && oud.versie === v.versie && oud.vingerafdruk === v.vingerafdruk && oud.ja === (ja === true)) {
      return { status: 200, ok: true, gewijzigd: false };
    }
    k[key][sl(d.eigenaar, reisId)] = { versie: v.versie, vingerafdruk: v.vingerafdruk, ja: ja === true, op: nu() };
    save();
    return { status: 200, ok: true, gewijzigd: true };
  }

  /* Een eigen antwoord terugnemen. Daarna is het weer "nog geen antwoord". */
  function neemTerug(key, reisId) {
    const d = opgave.deelnameVan(key, reisId);
    if (!d) return { status: 404, error: 'U reist niet mee met deze reis.' };
    const k = eigen.bak('reisInstemmingen');
    if (k[key] && k[key][sl(d.eigenaar, reisId)]) {
      delete k[key][sl(d.eigenaar, reisId)]; if (!Object.keys(k[key]).length) delete k[key]; save();
    }
    return { status: 200, ok: true };
  }

  /* Wie uit het gezelschap gaat, neemt zijn antwoord mee. De versie vervalt dan
     vanzelf (het gezelschap veranderde). */
  function wisVoorLid(lid, eigenaar, reisId) {
    const k = eigen.bak('reisInstemmingen');
    if (k[lid] && k[lid][sl(eigenaar, reisId)]) { delete k[lid][sl(eigenaar, reisId)]; if (!Object.keys(k[lid]).length) delete k[lid]; }
  }

  return { beeld, legVoor, trekVoorstelIn, antwoord, neemTerug, wisVoorLid, afdruk };
};
