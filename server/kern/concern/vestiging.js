/* CONCERN (deelmodule): DE VESTIGING, EN DE ZAAK ALS OPERATING UNIT. Stap 2.

   ZES BEGRIPPEN, EN DIT BESTAND DRAAGT ER TWEE. CONCERN.md legt vast dat
   concern, entiteit, registratie, vestiging, merk en operating unit zes
   verschillende dingen zijn. Hier staan de laatste twee:

     Establishment   de vestiging: een plek waar gewerkt wordt
     Operating Unit  wat daar draait: het restaurant, het hotel, de garage

   Waarom dat niet hetzelfde is: op één adres kan een hotel MET een restaurant
   zitten. Dat zijn twee operating units op één vestiging, met twee genres, twee
   sets caps en mogelijk twee menu's -- maar één huurcontract, één vergunning en
   één brandveiligheidsdossier. Zou dit één begrip zijn, dan moet je kiezen
   welke van de twee je kapotmaakt.

   DE BESTAANDE `supplier` WORDT DE OPERATING UNIT. Hij verdwijnt niet en hij
   verhuist niet: de vestiging WIJST hem aan, precies zoals de onderneming de
   zaak aanwijst en de entiteit de onderneming. Dat is in dit huis inmiddels een
   patroon met een reden -- wie overschrijft, verliest wat de andere laag wist.
   Al het bestaande blijft dus werken: het menu, de vloot, het personeel, de
   PDA, de kassa.

   EN DIT IS DE PLEK WAAR EEN ACTIVITEIT KAN SLUITEN ZONDER DAT DE ENTITEIT
   VERDWIJNT. Een hotelgroep die stopt met haar restaurant sluit één operating
   unit. De caps van dat restaurant vallen weg (kern/werkvormen.js rekent dat
   vanzelf uit zodra de zaak geen menu meer voert), de vestiging blijft, de
   entiteit blijft, en het personeel houdt zijn dienstverband bij de entiteit.
   Dat is precies wat CONCERN.md §4 belooft. */
'use strict';

module.exports = (ctx) => {
  const { db, save, crypto, schoon, findSupplier, tijdVandaag, opslag } = ctx;

  const nu = () => new Date().toISOString();

  const bak = () => opslag.tak('vestigingen');

  const vind = (id) => bak()[String(id || '')] || null;
  const vanEntiteit = (entiteitId) => Object.values(bak()).filter(v => v.entiteit === entiteitId && !v.gesloten);
  const alleVanEntiteit = (entiteitId) => Object.values(bak()).filter(v => v.entiteit === entiteitId);

  /* ---- een vestiging openen ---- */
  function vestigingNieuw(e, body) {
    const b = body || {};
    const naam = schoon(b.naam, 120);
    if (!naam) return { status: 400, error: 'Hoe heet deze vestiging? (bijvoorbeeld de plaats)' };
    const v = {
      id: 'ves_' + crypto.randomBytes(6).toString('hex'),
      entiteit: e.id,
      naam,
      plaats: schoon(b.plaats, 80) || null,
      adres: schoon(b.adres, 200) || null,
      land: String(b.land || e.land).trim().toUpperCase().slice(0, 2),
      vestigingsnummer: schoon(b.vestigingsnummer, 40) || null,
      units: [],
      geopend: b.geopend && /^\d{4}-\d{2}-\d{2}$/.test(b.geopend) ? b.geopend : tijdVandaag(),
      gesloten: null,
      gemaakt: nu()
    };
    bak()[v.id] = v;
    save();
    return { ok: true, vestiging: vestigingBeeld(v) };
  }

  /* ---- de operating unit: de bestaande zaak aanwijzen ----

     EEN ZAAK HOORT BIJ PRECIES EEN VESTIGING. Zou dezelfde zaakcode op twee
     vestigingen staan, dan is niet meer te zeggen waar het personeel werkt,
     welke vergunning geldt en welk adres op de factuur hoort. Dat is dezelfde
     regel die ondernemingKoppel() hanteert, en om dezelfde reden.

     Het bewijs komt van de aanroeper: die weet WIE er klopt. Deze module weet
     WELK bewijs nodig is. Zonder bewijsfunctie gaat de deur niet open -- een
     ontbrekende controle is geen reden om iets toe te staan. */
  function vestigingUnit(v, code, magKoppelen) {
    const s = findSupplier(code);
    if (!s) return { status: 404, error: 'Deze zaak bestaat niet.' };
    if ((v.units || []).includes(s.code)) return { ok: true, vestiging: vestigingBeeld(v) };
    const bezet = Object.values(bak()).find(x => (x.units || []).includes(s.code));
    if (bezet) {
      return { status: 409, error: 'Deze zaak hoort al bij een andere vestiging.',
        uitleg: 'Een zaak draait op één plek. Verplaatsen doet u door hem hier los te maken en daar aan te wijzen.' };
    }
    if (typeof magKoppelen !== 'function' || magKoppelen(s.code) !== true) {
      return { status: 403, error: 'Deze zaak is niet van u.',
        uitleg: 'Aanwijzen kan met een zaak waar u als beheerder in het personeelsregister staat, of die uit uw eigen aanvraag is voortgekomen.' };
    }
    v.units = (v.units || []).concat(s.code);
    save();
    return { ok: true, vestiging: vestigingBeeld(v) };
  }

  function vestigingUnitLos(v, code) {
    const c = String(code || '').toUpperCase();
    if (!(v.units || []).includes(c)) return { status: 404, error: 'Deze zaak hangt niet aan deze vestiging.' };
    v.units = v.units.filter(x => x !== c);
    save();
    return { ok: true, vestiging: vestigingBeeld(v) };
  }

  /* Sluiten en niet verwijderen: een vestiging die dicht is, is geen vestiging
     die er nooit was. Het personeel dat er werkte hoort terug te vinden zijn.
     De zaken gaan er WEL af -- die draaien niet meer op een gesloten plek --
     maar de zaken zelf blijven bestaan en kunnen elders worden aangewezen. */
  function vestigingSluit(v, per) {
    if (v.gesloten) return { status: 409, error: 'Deze vestiging is al gesloten.' };
    const d = per && /^\d{4}-\d{2}-\d{2}$/.test(per) ? per : tijdVandaag();
    if (d < String(v.geopend)) return { status: 400, error: 'De sluitingsdatum ligt voor de opening.' };
    v.gesloten = d;
    v.losgemaakt = v.units || [];
    v.units = [];
    save();
    return { ok: true, vestiging: vestigingBeeld(v),
      uitleg: (v.losgemaakt.length ? v.losgemaakt.length + ' zaak/zaken zijn losgemaakt; ze bestaan nog en kunnen elders worden aangewezen. ' : '') +
        'Dienstverbanden op deze vestiging blijven staan en horen apart te worden overgezet of beëindigd.' };
  }

  /* ---- lezen ---- */
  function vestigingBeeld(v) {
    const units = (v.units || []).map(code => {
      const s = findSupplier(code);
      return s ? { code: s.code, naam: s.name, genre: s.type } : { code, naam: null, genre: null, weg: true };
    });
    return {
      id: v.id, entiteit: v.entiteit, naam: v.naam, plaats: v.plaats, adres: v.adres,
      land: v.land, vestigingsnummer: v.vestigingsnummer,
      units, aantalUnits: units.length,
      geopend: v.geopend, gesloten: v.gesloten || null, open: !v.gesloten
    };
  }

  /* Waar draait deze zaak? De vraag andersom, die de bestaande lagen nodig
     hebben zodra zij willen weten bij welke entiteit een zaak hoort. */
  function vestigingVanUnit(code) {
    const c = String(code || '').toUpperCase();
    return Object.values(bak()).find(v => (v.units || []).includes(c)) || null;
  }

  return { vestigingVind: vind, vestigingVanEntiteit: vanEntiteit,
    vestigingAlleVanEntiteit: alleVanEntiteit, vestigingNieuw, vestigingUnit,
    vestigingUnitLos, vestigingSluit, vestigingBeeld, vestigingVanUnit };
};
