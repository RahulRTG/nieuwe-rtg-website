/* Genootschap (deelmodule): de DRAGER -- een organisatie die een genootschap
   draagt (B1, GEMEENSCHAP-FASE0.md par. 4.1).

   DE DRAGER IS EEN VERWIJZING EN GEEN LEDENBEZIT. Het genootschap blijft de
   enige plek waar leden staan; `draagOrg` noemt alleen WIE het draagt, in welke
   stand, en wie dat vroeg en erkende. Er wordt hier geen lid gekopieerd, geen
   ledenlijst teruggegeven aan de organisatie en geen aantal: de organisatie ziet
   de naam van het genootschap en de stand van de vraag, en verder niets
   (regel 2 van par. 2: een organisatie verleent geen macht in de groep).
   test/genootschap-drager.test.js leest deze bron en zakt zodra hier iets naar
   `leden` schrijft.

   TWEE KANTEN, ELK LANGS HAAR EIGEN POORT. Vragen en losmaken doet een
   BEHEERDER van het genootschap met zijn eigen sessie. Erkennen doet de
   organisatie langs haar eigen deur -- voor een RTF-partnerstichting is dat de
   partnercode (routes/rtfos/portalen.js). Een organisatiecode wordt nooit in een
   ledenroute geplakt, en de beheerder geeft alleen de verwijzing (`ref`) mee die
   de partner in zijn eigen portaal ziet.

   EEN ERKENNING, NIET TWEE. Of een stichting erkend is, beslist het
   partnerregister van de RTFoundation (kern/rtfos/partners.js: landelijk
   goedgekeurd of actief, niet opgeschort, niet beeindigd, niet verlopen). Deze
   module krijgt die vraag als functie (`erkendePartner`) en heeft geen eigen
   lijst of eigen oordeel.

   WAT HIER MET OPZET NIET OPENGAAT (besluiten van de eigenaar, par. 9):
   - een genootschap over GELOOF of ZORG krijgt geen drager (besluit 6: pas na de
     juridische en privacyvragen). Er wordt hier geen onderwerpveld OPGESLAGEN --
     dat zou het art. 9-gegeven zelf zijn -- maar een gemelde of herkende
     gevoelige categorie wordt geweigerd met de reden;
   - in een gedragen genootschap komt niemand die RTG niet als volwassene heeft
     gezien (volwassen(): eigen account, A3, 18+). Een gezinsprofiel heeft geen
     eigen account en haalt dat dus nooit. Minderjarigen in een gemeenschap met
     een organisatie wachten op G5 (par. 5.3).
   - van de vier dragersoorten uit het ontwerp is alleen de RTF-partner gebouwd;
     de andere drie weigeren met de reden in plaats van stil te ontbreken. */
'use strict';

const R = require('./drager-regels');
const { SOORTEN, NOG_NIET, gedragen, gevoeligeReden, beschermdeReden, beeld } = R;

module.exports = ({ save, notify, genootschap, volwassen, erkendePartner }) => {
  const nu = () => new Date().toISOString();
  const partner = (ref) => {
    if (typeof erkendePartner !== 'function') return { status: 503, error: 'Het partnerregister is niet bereikbaar.' };
    return erkendePartner(ref) || { status: 404, error: 'Deze stichting staat niet in het partnerregister.' };
  };

  /* De beheerder vraagt een organisatie om het genootschap te dragen. */
  function vraag(sess, groepId, invoer) {
    const gr = genootschap.groepMet(groepId);
    if (!gr || !genootschap.isLid(gr, sess.key)) return { status: 404, error: 'Dit genootschap bestaat niet.' };
    if (!genootschap.isBeheer(gr, sess.key)) return { status: 403, error: 'Alleen een beheerder vraagt een drager.' };
    const v = invoer || {};
    const soort = String(v.soort || 'rtfpartner');
    if (NOG_NIET[soort]) return { status: 400, error: NOG_NIET[soort] };
    if (!SOORTEN.includes(soort)) return { status: 400, error: 'Kies een dragersoort (' + SOORTEN.join(', ') + ').' };
    const gv = gevoeligeReden(gr, v.onderwerp);
    if (gv) return { status: 409, error: gv, wacht: 'besluit-6' };
    for (const l of gr.leden || []) {
      // neutraal: de beheerder hoort dat het met deze leden niet kan, niet over wie
      if (beschermdeReden(l.key, volwassen)) return { status: 409, error: R.REDEN_LEDEN_NEUTRAAL, wacht: 'G5' };
    }
    const ref = String(v.ref || '').trim().slice(0, 40);
    if (!ref) return { status: 400, error: 'Welke stichting? Geef de verwijzing uit haar partnerportaal.' };
    const p = partner({ id: ref });
    if (!p.ok) return { status: p.status || 403, error: p.error };
    const d = gr.draagOrg;
    if (gedragen(gr)) {
      if (d.soort === soort && d.ref === p.id) return { ok: true, al: true, drager: beeld(gr) };
      return { status: 409, error: 'Dit genootschap heeft al een drager. Maak die eerst los.' };
    }
    gr.draagOrg = { soort, ref: p.id, stand: 'gevraagd', gevraagdDoor: sess.key, at: nu() };
    save();
    return { ok: true, drager: beeld(gr), partner: p.naam };
  }

  /* Losmaken mag altijd en de groep blijft (par. 4.1). Een herhaling verandert
     niets aan het eerste losmaken. */
  function los(sess, groepId) {
    const gr = genootschap.groepMet(groepId);
    if (!gr || !genootschap.isLid(gr, sess.key)) return { status: 404, error: 'Dit genootschap bestaat niet.' };
    if (!genootschap.isBeheer(gr, sess.key)) return { status: 403, error: 'Alleen een beheerder maakt de drager los.' };
    if (!gedragen(gr)) return { ok: true, al: true, drager: beeld(gr) };
    gr.draagOrg.stand = 'ingetrokken';
    gr.draagOrg.losAt = nu();
    gr.draagOrg.losDoor = { soort: 'beheerder', key: sess.key };
    save();
    return { ok: true, drager: beeld(gr) };
  }

  /* Wat een partner in zijn portaal ziet: genootschappen die HEM vroegen. Naam en
     stand, geen leden en geen aantal. */
  function voorPartner(code) {
    const p = partner({ code });
    if (!p.ok) return { status: p.status || 403, error: p.error };
    const groepen = genootschap.S().groepen
      .filter(gr => gr.draagOrg && gr.draagOrg.soort === 'rtfpartner' && gr.draagOrg.ref === p.id && gr.draagOrg.stand !== 'ingetrokken')
      .map(gr => ({ groep: gr.id, naam: gr.naam, stand: gr.draagOrg.stand, at: gr.draagOrg.at }));
    return { ok: true, ref: p.id, groepen };
  }

  /* De partner erkent: alleen een vraag die op ZIJN verwijzing staat. Voor elke
     andere partner bestaat de vraag niet (404, geen raadsel over andermans). */
  function erken(code, groepId) {
    const p = partner({ code });
    if (!p.ok) return { status: p.status || 403, error: p.error };
    const gr = genootschap.groepMet(groepId);
    const d = gr && gr.draagOrg;
    if (!d || d.soort !== 'rtfpartner' || d.ref !== p.id || d.stand === 'ingetrokken') {
      return { status: 404, error: 'Er ligt geen vraag van dit genootschap bij uw stichting.' };
    }
    if (d.stand === 'erkend') return { ok: true, al: true, groep: gr.id, stand: d.stand };
    const gv = gevoeligeReden(gr);
    if (gv) return { status: 409, error: gv, wacht: 'besluit-6' };
    d.stand = 'erkend';
    d.erkendDoor = { soort: 'rtfpartner', id: p.id };
    d.erkendAt = nu();
    save();
    for (const l of gr.leden || []) {
      if (l.rol !== 'beheerder') continue;
      // de erkenning staat al; een melding die niet aankomt maakt hem niet ongedaan, maar zwijgt ook niet
      try { if (notify) notify(l.key, { title: 'Genootschap', body: 'Uw genootschap ' + gr.naam + ' heeft nu een drager.' }); }
      catch (e) { console.error('[genootschap/drager] melding niet verstuurd:', e && e.message); }
    }
    return { ok: true, groep: gr.id, stand: d.stand };
  }

  return { vraag, los, voorPartner, erken, beeld };
};

module.exports.regels = R;
