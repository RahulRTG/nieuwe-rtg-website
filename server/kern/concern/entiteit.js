/* CONCERN (deelmodule): DE JURIDISCHE ENTITEIT. Stap 1 uit CONCERN.md.

   EEN BEDRIJF IS NIET EEN KvK. Dat is de zin waar dit bestand op staat. Vandaar
   dat registratie hier geen VELD is maar een feit met een eigen loop: dezelfde
   entiteit kan in twee landen ingeschreven staan, een inschrijving kan eindigen
   zonder dat de entiteit ophoudt, en een entiteit kan bestaan voordat zij
   ergens is ingeschreven -- dat is precies de fase waarin een oprichting zit.

   DE ENTITEIT DRAAGT ZELF BIJNA NIETS. Naam, rechtsvorm, zetel, boekjaar,
   registraties, bestuur en aandelen staan als FEITEN in ./tijd.js, met een bron
   en een venster. Op het object blijft alleen wat nooit verandert zonder dat
   het een ander bedrijf wordt: het land, de eigenaar, het moment van aanmaken.
   Alles wat kan veranderen hoort een geschiedenis te hebben (wet 4), en een
   veld heeft geen geschiedenis.

   DE ONDERNEMING BLIJFT BESTAAN. kern/onderneming/ wordt niet vervangen: een
   entiteit WIJST hem aan, zoals de onderneming de zaak aanwijst. Overschrijven
   zou dezelfde fout zijn die de onderneming juist kwam oplossen. */
'use strict';

const RV = require('../onderneming/rechtsvorm');

module.exports = (ctx) => {
  const { db, save, crypto, schoon, tijdZet, tijdOpDatum, tijdOpDatumVan,
    tijdGeschiedenis, tijdVerwijderEntiteit, tijdVandaag, opslag } = ctx;

  const nu = () => new Date().toISOString();

  /* Het samenstellen van het beeld woont in ./entiteit-beeld.js -- de snede
     tussen schrijven en lezen. Hij wordt hier binnengehaald en niet nagebouwd:
     elke handeling hieronder geeft het verse beeld terug, en twee plekken die
     allebei een entiteit "samenstellen" lopen uiteen (LAT-regel 4). */
  const { entiteitBeeld } = require('./entiteit-beeld')(ctx);

  const bak = () => opslag.tak('entiteiten');

  const vind = (id) => bak()[String(id || '')] || null;
  const vanEigenaar = (key) => Object.values(bak()).filter(e => e.eigenaar === key);

  /* ---- aanmaken ----

     Een entiteit begint met een naam, een land en een rechtsvorm. De rechtsvorm
     MAG leeg blijven, om precies dezelfde reden als bij de onderneming: "ik
     weet nog niet wat ik word" is een echte stand in de oprichtingsfase en
     krijgt hier geen standaardwaarde aangemeten.

     De naam gaat NIET als veld op het object maar meteen als feit de tijdlijn
     in. Een statutaire naamswijziging is een juridische gebeurtenis met een
     datum en een akte, geen tekstveld dat je bijwerkt. */
  function entiteitNieuw(eigenaar, body) {
    if (!eigenaar) return { status: 401, error: 'Log in om een entiteit aan te maken.' };
    const b = body || {};
    const naam = schoon(b.naam, 160);
    if (!naam) return { status: 400, error: 'Hoe heet deze entiteit? Een werktitel is genoeg.' };

    const land = String(b.land || 'NL').trim().toUpperCase().slice(0, 2);
    if (!/^[A-Z]{2}$/.test(land)) return { status: 400, error: 'In welk land staat deze entiteit? (landcode van twee letters)' };

    const rv = b.rechtsvorm ? String(b.rechtsvorm) : null;
    if (rv && !RV.isRechtsvorm(rv)) return { status: 400, error: 'Deze rechtsvorm kennen we niet.' };
    /* De rechtsvorm moet bij het land horen. Een Nederlandse B.V. in een Spaanse
       entiteit is geen detailfout: hij trekt de hele fiscale as en de
       oprichtingsstappen scheef, en dat merk je pas bij de aangifte. */
    if (rv) {
      const vorm = RV.rechtsvormVan(rv);
      if (vorm && vorm.land && vorm.land !== land) {
        return { status: 400, error: 'Deze rechtsvorm hoort bij ' + vorm.land + ', niet bij ' + land + '.',
          uitleg: 'Kies een rechtsvorm van het land waar de entiteit staat, of wijzig het land.' };
      }
    }

    const e = {
      id: 'ent_' + crypto.randomBytes(6).toString('hex'),
      eigenaar, land,
      concern: b.concern ? String(b.concern) : null,
      onderneming: null,
      gestart: nu()
    };
    bak()[e.id] = e;
    save();

    /* De eerste feiten, met bron `mens`: de ondernemer heeft ze zojuist zelf
       ingevuld. Dat is de zwakste harde bron en dat hoort ook zo -- een
       uittreksel overschrijft dit later met bron `register`. */
    const wie = b.wie || eigenaar;
    tijdZet(e.id, 'naam', { waarde: naam, van: b.van, bronSoort: 'mens', wie });
    if (rv) tijdZet(e.id, 'rechtsvorm', { waarde: rv, van: b.van, bronSoort: 'mens', wie });
    return { ok: true, entiteit: entiteitBeeld(e) };
  }

  /* ---- de registratie ----
     Een inschrijving is een FEIT met een loop en niet een veld, want een
     entiteit kan er meer dan een hebben (twee landen) en er een verliezen
     zonder op te houden te bestaan. De sleutel is land+nummer: dezelfde
     inschrijving opnieuw invoeren werkt zijn loop bij, een tweede inschrijving
     komt ernaast te staan. */
  function entiteitRegistratie(e, body) {
    const b = body || {};
    const nummer = schoon(b.nummer, 40);
    if (!nummer) return { status: 400, error: 'Welk registratienummer hoort hierbij?' };
    const land = String(b.land || e.land).trim().toUpperCase().slice(0, 2);
    if (!/^[A-Z]{2}$/.test(land)) return { status: 400, error: 'Bij welk land hoort deze registratie?' };
    return tijdZet(e.id, 'registratie', {
      waarde: nummer, sleutel: land + ':' + nummer, van: b.van, tot: b.tot,
      bronSoort: b.bronSoort || 'mens', bronDetail: b.bronDetail, wie: b.wie || e.eigenaar,
      extra: { land, register: schoon(b.register, 80) || null, vestigingsnummer: schoon(b.vestigingsnummer, 40) || null }
    });
  }

  /* De onderneming van kern/onderneming/ aanwijzen. Idempotent, en een
     onderneming hoort bij precies EEN entiteit -- twee entiteiten op dezelfde
     onderneming zou de tweede waarheid terugzetten die deze laag opruimt. */
  function entiteitOnderneming(e, ondernemingId, magKoppelen) {
    const id = String(ondernemingId || '');
    if (!id) return { status: 400, error: 'Welke onderneming wijst u aan?' };
    if (e.onderneming === id) return { ok: true, entiteit: entiteitBeeld(e) };
    if (e.onderneming) return { status: 409, error: 'Deze entiteit wijst al een onderneming aan.' };
    const bezet = Object.values(bak()).find(x => x.onderneming === id);
    if (bezet) return { status: 409, error: 'Deze onderneming hoort al bij een andere entiteit.' };
    /* HET BEWIJS KOMT VAN DE AANROEPER EN NIET UIT HET LICHAAM. Dezelfde regel
       als ondernemingKoppel(): wie de onderneming niet bezit, koppelt hem niet
       aan zijn eigen entiteit en leest daarna zijn boekhouding. */
    if (typeof magKoppelen === 'function' && magKoppelen(id) !== true) {
      return { status: 403, error: 'Deze onderneming staat niet op uw naam.' };
    }
    e.onderneming = id;
    e.gekoppeld = nu();
    save();
    return { ok: true, entiteit: entiteitBeeld(e) };
  }

  /* ---- lezen ---- */

  const entiteitGeschiedenis = (e, soort, sleutel) => tijdGeschiedenis(e.id, soort, sleutel);

  /* Weghalen kan alleen zolang er niets aan hangt. Een entiteit met vestigingen
     of dienstverbanden verwijder je niet: die beëindig je, en dat is een andere
     handeling met een andere geschiedenis. */
  function entiteitVerwijder(e, hangtEraan) {
    const bezwaar = typeof hangtEraan === 'function' ? hangtEraan(e.id) : null;
    if (bezwaar) return { status: 409, error: 'Er hangt nog werk aan deze entiteit.', wat: bezwaar };
    tijdVerwijderEntiteit(e.id);
    delete bak()[e.id];
    save();
    return { ok: true };
  }

  return { entiteitVind: vind, entiteitVanEigenaar: vanEigenaar, entiteitNieuw,
    entiteitRegistratie, entiteitOnderneming, entiteitBeeld, entiteitGeschiedenis,
    entiteitVerwijder, entiteitAlle: () => Object.values(bak()),
    entiteitVandaag: tijdVandaag, entiteitOpDatumVan: tijdOpDatumVan };
};
