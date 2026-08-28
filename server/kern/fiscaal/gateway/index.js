/* DE AANGIFTEGATEWAY: klaargezet, niet aangezet.

   RTG dient geen aangiften in. Dat is een productgrens en hij staat in het
   zekerheidsregister (`btw.verzenden` is `voorbehouden`). Deze laag verandert
   daar niets aan -- hij bouwt de machinerie die eromheen hoort, zodat die grens
   ooit een besluit kan zijn in plaats van een verbouwing.

   WAT ER DAN NU AL MOET STAAN, en waarom:

     verzegeling     wat is er EXACT klaargezet. Een zending draagt de hash van
                     zijn eigen inhoud, canoniek geserialiseerd. Zonder dat is
                     "wij hebben dit verstuurd" later een bewering.
     idempotentie    dezelfde inhoud levert dezelfde sleutel, dus een herhaalde
                     poging maakt nooit een tweede zending. Bij een instantie
                     die traag antwoordt is dat het verschil tussen een aangifte
                     en twee aangiften.
     staatmachine    een kant op, met AANGEBODEN en BEVESTIGD apart (./staten.js)
     keten           elke overgang draagt de zegel van de vorige, zoals in
                     kern/betaalwaarheid: een record dat achteraf is bijgewerkt,
                     verraadt zichzelf
     mandaat         zonder toestemming wordt er niet eens iets klaargezet
                     (./mandaat.js)
     retry           begrensd, en ALLEEN op dezelfde verzegelde inhoud

   DE ADAPTER IS INERT, EN DAT IS HET PUNT. ./sbr.js beschrijft het kanaal en
   weigert te versturen. `biedAan` vraagt het kanaal of het actief is EN het
   zekerheidsregister of dit mag; vandaag zegt het tweede nee, en dat is geen
   ontbrekende functie maar de grens zelf. Er is met opzet geen vlag, geen
   omgevingsvariabele en geen testmodus die daaromheen gaat: wie dit ooit
   aanzet, verandert het register en dat is een besluit met een naam eronder.

   WAT HIER DUS NOOIT MAG BINNENSLUIPEN: een `if (proces.env...)` die het
   alsnog laat lopen. Er staat er geen, en dat hoort zo te blijven. */
'use strict';

const { STATUS, mag, waarom } = require('./staten');
const { zekerheid } = require('../zekerheid');
const { maakZegel } = require('./zegel');

function maakGateway({ db, save, crypto, nu, mandaat, kanalen }) {
  const tijd = nu || (() => new Date().toISOString());
  /* De verzegeling en de keten staan in ./zegel.js; zie de kop daar. */
  const { canoniek, hash, gebeurtenis, controleer: keurKeten } = maakZegel({ crypto, nu: tijd });
  const MAX_POGINGEN = 5;

  function bak() {
    if (!Array.isArray(db.data.gatewayZendingen)) db.data.gatewayZendingen = [];
    return db.data.gatewayZendingen;
  }
  const vind = (id) => bak().find(z => z.id === id) || null;
  const kanaalVan = (naam) => (kanalen || {})[naam] || null;

  function zet(z, naar, soort, extra) {
    const nee = waarom(z.status, naar);
    if (nee) return { status: 409, error: nee };
    z.status = naar;
    gebeurtenis(z, soort, extra);
    save();
    return { ok: true, zending: z };
  }

  /* ---------- 1. klaarzetten ---------- */
  /* Verzegelt de inhoud en legt hem vast. Verstuurt NIETS -- dat kan hier ook
     niet, er is geen weg naar buiten in deze functie. */
  function maakKlaar({ code, soort, aangifteId, periode, payload, kanaal, door }) {
    const zaak = String(code || '').toUpperCase();
    const kan = kanaalVan(kanaal);
    if (!kan) return { status: 400, error: 'Onbekend kanaal: ' + kanaal + '.' };
    if (!payload || typeof payload !== 'object') return { status: 400, error: 'Er is niets om klaar te zetten.' };
    if (!String(door || '').trim()) return { status: 400, error: 'Noteer wie dit klaarzet.' };

    /* HET MANDAAT EERST. Niet omdat het versturen dan pas mag, maar omdat
       andermans cijfers klaarzetten zonder toestemming al een verwerking is. */
    const m = mandaat.geldt(zaak, soort, tijd().slice(0, 10));
    if (!m.ok) return { status: 403, error: 'Geen geldig mandaat: ' + m.reden };

    const zegelInhoud = hash(canoniek(payload));
    const idem = 'zdg_' + hash([kanaal, zaak, soort, zegelInhoud].join('|')).slice(0, 24);

    /* Dezelfde inhoud levert dezelfde sleutel. Dat is de idempotentie: een
       tweede keer klaarzetten geeft de BESTAANDE zending terug en maakt er geen
       nieuwe. Een ANDERE inhoud geeft een andere sleutel en dus een nieuwe
       zending -- de oude blijft staan als bewijs van wat er toen lag. */
    const bestaand = bak().find(z => z.idem === idem);
    if (bestaand) return { ok: true, ongewijzigd: true, zending: bestaand };

    const z = { id: idem, idem, code: zaak, soort, aangifteId: aangifteId || null,
      periode: periode || null, kanaal, kanaalNaam: kan.naam,
      payload, zegel: zegelInhoud, verzegeldOp: tijd(),
      status: STATUS.KLAAR, pogingen: 0, maxPogingen: MAX_POGINGEN,
      mandaat: { id: m.mandaat.id, doorNaam: m.mandaat.doorNaam, van: m.mandaat.van, tot: m.mandaat.tot },
      klaargezetDoor: String(door).trim(), klaargezetOp: tijd(),
      kenmerk: null, bevestigdOp: null, afgewezenOp: null, reden: null, gebeurtenissen: [] };
    gebeurtenis(z, 'klaargezet', { zegel_inhoud: zegelInhoud, door: z.klaargezetDoor, mandaat: z.mandaat.id });
    bak().unshift(z);
    if (bak().length > 20000) bak().length = 20000;
    save();
    return { ok: true, zending: z };
  }

  /* ---------- 2. aanbieden (de enige weg naar buiten) ---------- */
  /* Twee poorten, en ze staan allebei dicht. De eerste is het KANAAL: een
     adapter die niet actief is, verstuurt niet. De tweede is het REGISTER: zo
     lang `btw.verzenden` op `voorbehouden` staat, mag dit sowieso niet -- en
     dat is de grens zelf en geen ontbrekende koppeling.

     Er is geen omweg. Geen omgevingsvariabele, geen testvlag, geen `force`. */
  async function biedAan(id, door) {
    const z = vind(id);
    if (!z) return { status: 404, error: 'Deze zending kennen we niet.' };
    if (!String(door || '').trim()) return { status: 400, error: 'Noteer wie dit aanbiedt.' };
    const nee = waarom(z.status, STATUS.AANGEBODEN);
    if (nee) return { status: 409, error: nee };
    if (z.pogingen >= z.maxPogingen) return { status: 409,
      error: 'Deze zending is ' + z.pogingen + ' keer aangeboden en dat is het maximum. Zoek uit wat er misgaat.' };

    const grens = zekerheid(z.soort === 'btw' ? 'btw.verzenden' : 'loon.verzenden');
    if (grens.klasse === 'voorbehouden')
      return { status: 451, error: grens.waarom, grens: true, klasse: grens.klasse,
        let: 'De zending staat klaar en verzegeld; wat ontbreekt is geen koppeling maar een besluit.' };

    const kan = kanaalVan(z.kanaal);
    if (!kan || !kan.actief) return { status: 503,
      error: 'Het kanaal ' + z.kanaal + ' is niet actief.', let: (kan && kan.let) || null };

    z.pogingen += 1;
    const uit = await kan.verstuur(z);
    if (!uit || !uit.ok) {
      z.status = STATUS.MISLUKT;
      gebeurtenis(z, 'mislukt', { poging: z.pogingen, fout: (uit && uit.error) || 'onbekend' });
      save();
      return { status: 502, error: (uit && uit.error) || 'Het aanbieden ging mis.', zending: z };
    }
    return zet(z, STATUS.AANGEBODEN, 'aangeboden', { poging: z.pogingen, door: String(door).trim() });
  }

  /* ---------- 3. het ontvangstbewijs ---------- */
  /* MATCHEN OP DE IDEMPOTENTIESLEUTEL, want die is van de inhoud afgeleid en
     reist dus mee. Een bewijs dat nergens op past wordt BEWAARD en niet
     weggegooid: een ontvangstbewijs dat je niet kunt plaatsen is precies het
     signaal dat er iets is verstuurd dat je niet kent. */
  function ontvangstbewijs({ idem, kenmerk, aangenomen, reden }) {
    const k = String(kenmerk || '').trim();
    const z = bak().find(x => x.idem === idem || x.id === idem);
    if (!z) {
      if (!Array.isArray(db.data.gatewayLosseBewijzen)) db.data.gatewayLosseBewijzen = [];
      db.data.gatewayLosseBewijzen.unshift({ idem: String(idem || ''), kenmerk: k, at: tijd(), aangenomen: !!aangenomen });
      save();
      return { status: 404, error: 'Dit ontvangstbewijs hoort bij geen enkele zending die wij kennen.',
        bewaard: true, let: 'Het is vastgelegd; een bewijs dat je niet kunt plaatsen is een signaal en geen ruis.' };
    }
    if (aangenomen && k.length < 4) return { status: 400,
      error: 'Een aangenomen zending zonder kenmerk is een bevestiging zonder bewijs.' };
    if (aangenomen) { z.kenmerk = k; z.bevestigdOp = tijd(); return zet(z, STATUS.BEVESTIGD, 'bevestigd', { kenmerk: k }); }
    z.afgewezenOp = tijd(); z.reden = String(reden || '').trim().slice(0, 300) || null;
    return zet(z, STATUS.AFGEWEZEN, 'afgewezen', { reden: z.reden });
  }

  function trekIn(id, door, reden) {
    const z = vind(id);
    if (!z) return { status: 404, error: 'Deze zending kennen we niet.' };
    if (!String(door || '').trim()) return { status: 400, error: 'Intrekken gebeurt op naam.' };
    return zet(z, STATUS.INGETROKKEN, 'ingetrokken',
      { door: String(door).trim(), reden: String(reden || '').trim().slice(0, 300) || null });
  }

  /* ---------- 4. de keten nalopen ----------
     Wat "bewijs van wat exact is verzonden" betekent als je het serieus neemt:
     niet dat er een hash IN staat, maar dat hij nog klopt. Het rekenwerk staat
     in ./zegel.js. */
  function controleer(id) {
    const z = vind(id);
    if (!z) return { status: 404, error: 'Deze zending kennen we niet.' };
    return keurKeten(z);
  }

  const vanZaak = (code) => bak().filter(z => z.code === String(code || '').toUpperCase());

  return { gateway: { maakKlaar, biedAan, ontvangstbewijs, trekIn, controleer, vanZaak, haal: vind, canoniek } };
}

module.exports = { maakGateway };
