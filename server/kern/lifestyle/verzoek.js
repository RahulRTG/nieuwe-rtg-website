/* Kern-module "lifestyle", deelbestand "verzoek": het concierge-verzoek van De
   Rechterhand, sinds 30 september 2026 een SCHIL over de concierge-lus.

   Er waren vijf concierge-ingangen (CONCIERGE.md par. 0), en deze was de oudste:
   een titel met vier statussen. `kern/bureau/cases.js` zei in zijn eigen kop al
   waarom dat breekt ("mijn moeder wordt 70, doe iets bijzonders" is geen
   verzoek maar een project), en toch bestonden ze allebei. Een nieuw verzoek is
   daarom vanaf nu een CASE in de lus (werkwijze 'voorstel'), en deze module
   vertaalt alleen: dezelfde routes, dezelfde velden, dezelfde vier statussen
   aan de buitenkant, en een waarheid eronder.

   DRIE DINGEN DIE HIER VASTLIGGEN:

   1. DE STATUS WORDT AFGELEID EN NIET OPGESLAGEN. `stand()` leest de case: wie
      een tweede statusveld naast de tijdlijn legt, heeft binnen een maand twee
      standen die elkaar tegenspreken.
   2. EEN OUD VERZOEK BLIJFT WAAR HET STAAT TOT HET KLAAR IS. Wat voor vandaag
      in `lifestyle[key].verzoeken` stond, wordt niet omgezet: een lopend verzoek
      halverwege naar een andere motor verhuizen is de manier om er een kwijt te
      raken. Het leest en loopt gewoon verder; alleen NIEUWE verzoeken zijn
      cases. Die overgang is eindig: er komt niets meer bij.
   3. "BEVESTIGD" IS EEN BEVESTIGD ONDERDEEL. Waar het kantoor vroeger een
      status zette met een notitie ("Tafel om 20:00 op uw naam"), zet het nu een
      onderdeel met die tekst vast. Daardoor kan "afgerond" alleen als er iets
      bevestigd is -- de grendel van de lus, die de oude keten niet had. */
'use strict';

module.exports = (ctx) => {
  const { save, schoon, rid, nu, notify, liveCodename, L, mijn, bureau, balie } = ctx;
  const CATEGORIEEN = ['reis', 'restaurant', 'evenement', 'cadeau', 'vervoer', 'huishouden', 'overig'];
  const CONCIERGE_STATUS = ['in behandeling', 'bevestigd', 'afgerond', 'afgewezen'];
  const OPEN = s => !['afgerond', 'afgewezen', 'ingetrokken'].includes(s);
  const STAP_NOTITIE = {
    'in behandeling': 'Wij zijn ermee aan de slag.',
    bevestigd: 'Het is voor u geregeld en bevestigd.',
    afgerond: 'Afgerond. Wij wensen u een fijne ervaring.',
    afgewezen: 'Helaas is dit niet gelukt; wij nemen persoonlijk contact met u op.'
  };

  function stand(c) {
    if (c.status === 'geregeld') return 'afgerond';
    if (c.status === 'afgewezen' || c.status === 'ingetrokken') return c.status;
    const actief = (c.onderdelen || []).filter(o => !o.vervangenDoor);
    if (actief.length && actief.every(o => o.stand === 'bevestigd' || o.stand === 'geleverd')) return 'bevestigd';
    if ((c.tijdlijn || []).some(r => r.door === 'kantoor')) return 'in behandeling';
    return 'aangevraagd';
  }
  const alsVerzoek = c => ({ id: c.id, titel: c.titel, details: c.details || '', categorie: c.categorie || 'overig',
    status: stand(c), at: c.at, zaak: true,
    updates: (c.tijdlijn || []).map(r => ({ status: r.status, op: r.op, notitie: r.notitie })) });

  const cases = key => ((bureau().cases(key) || {}).zaken || []).filter(c => c.bron === 'verzoek');
  const oud = key => L(key).verzoeken;

  function alle(key) {
    return oud(key).concat(cases(key).map(alsVerzoek)).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }

  function conciergeVraag(key, body) {
    const titel = schoon(body.titel, 100);
    if (!titel) return { status: 400, error: 'Waarmee kunnen wij u van dienst zijn?' };
    if (alle(key).filter(v => OPEN(v.status)).length >= 50)
      return { status: 400, error: 'U heeft veel lopende verzoeken. Wij ronden er graag eerst een paar met u af.' };
    const details = schoon(body.details, 800);
    const sleutel = schoon(body.sleutel, 80) || ('verzoek-' + rid() + rid() + rid());
    const r = bureau().lusIntake(key, { zin: titel + (details ? '. ' + details : ''), sleutel });
    if (r.error) return r;
    const c = r.zaak;
    Object.assign(c, { titel, details, categorie: CATEGORIEEN.includes(body.categorie) ? body.categorie : 'overig', bron: 'verzoek' });
    save();
    return { status: 200, ok: true, verzoek: alsVerzoek(c) };
  }

  function conciergeIntrek(key, id) {
    const v = oud(key).find(x => x.id === id);
    if (v) {
      if (v.status === 'afgerond') return { status: 400, error: 'Dit verzoek is al afgerond.' };
      v.status = 'ingetrokken'; v.updates.push({ status: 'ingetrokken', op: nu(), notitie: 'Op uw verzoek ingetrokken.' }); save();
      return { status: 200, ok: true };
    }
    if (!cases(key).some(c => c.id === id)) return { status: 404, error: 'Dit verzoek vinden wij niet terug.' };
    return bureau().caseIntrek(key, id);
  }

  function conciergeDesk() {
    const uit = [];
    for (const [key, l] of Object.entries(mijn.alleLezend())) {
      const rijen = (l.verzoeken || []).concat((l.cases || []).filter(c => c.bron === 'verzoek' && !c.besloten).map(alsVerzoek));
      for (const v of rijen) if (OPEN(v.status))
        uit.push({ key, codenaam: liveCodename ? liveCodename(key) : '', id: v.id, titel: v.titel, details: v.details,
          categorie: v.categorie, status: v.status, at: v.at, laatste: (v.updates[v.updates.length - 1] || {}).notitie || '',
          voorkeuren: l.voorkeuren || {}, zaak: !!v.zaak });
    }
    uit.sort((a, b) => String(a.at).localeCompare(String(b.at)));
    return { status: 200, verzoeken: uit, statussen: CONCIERGE_STATUS };
  }

  function meld(key, titel, status) {
    if (!notify) return;
    try { notify(key, { title: 'De Rechterhand', body: 'Uw verzoek "' + titel + '" is nu: ' + status + '.', scope: 'lifestyle' }); } catch (e) {}
  }

  function conciergeVoortgang(key, id, status, notitie) {
    if (!CONCIERGE_STATUS.includes(status)) return { status: 400, error: 'Onbekende status.' };
    const l = mijn.lees(key);
    const v = l && (l.verzoeken || []).find(x => x.id === id);
    if (v) {
      v.status = status;
      v.updates.push({ status, op: nu(), notitie: schoon(notitie, 300) || STAP_NOTITIE[status] });
      meld(key, v.titel, status);
      save();
      return { status: 200, ok: true };
    }
    const c = cases(key).find(x => x.id === id);
    if (!c) return { status: 404, error: 'Dit verzoek is er niet meer.' };
    const tekst = schoon(notitie, 300);
    let r;
    if (status === 'in behandeling') r = balie().lusNeem(key, id, { naam: null });
    else if (status === 'bevestigd') r = balie().lusOnderdeel(key, id, { wat: tekst || c.titel, bevestigd: true });
    else r = balie().voortgang(key, id, status === 'afgerond' ? 'geregeld' : 'afgewezen', tekst || STAP_NOTITIE[status]);
    if (r && r.error) return r;
    if (status === 'in behandeling' || status === 'bevestigd') meld(key, c.titel, status); // het bureau meldt de andere twee zelf
    return { status: 200, ok: true };
  }

  return { conciergeVraag, conciergeIntrek, conciergeDesk, conciergeVoortgang,
    conciergeVerzoeken: (key) => ({ status: 200, verzoeken: alle(key), categorieen: CATEGORIEEN }),
    verzoekenAlle: alle };
};
