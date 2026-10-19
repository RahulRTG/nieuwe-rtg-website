/* PARTNER NETWORK: de netwerkkant van een partnerzaak, uit bestaande domeinen.

   Besluit van de eigenaar (19 oktober 2026): het scherm wordt echt gebouwd, en
   er staat alleen een getal op als de server het uit echte gegevens rekent.
   Het scherm toonde tot dan vaste cijfers als live waarheid ("97 network fit",
   "96% mutual fit", "marge 18,4%", een tijdlijn van 12:31 tot 12:41) zonder
   enige bron. Die zijn weg.

   WAT DIT IS: een PROJECTIE die alleen leest. De zaak ziet op een plek wat er
   in vier bestaande domeinen voor haar klaarligt:
     - intenties:    vragen van leden die bij haar vak en werkgebied passen
                     (kern/mall/aanvragen.js, voorZaak) -- anoniem op codenaam;
     - beloften:     haar onderdelen in conciërge-cases (kern/bureau, de
                     deelnemerweergave van CON-02) en haar samenwerkings-
                     voorstellen met andere partners (kern/samenwerking.js);
     - capaciteit:   alleen waar een echte bron bestaat (kamers);
     - aandacht:     open klussen uit haar eigen werklijst.
   Schrijven gaat langs de routes van die domeinen; hier komt geen tweede
   werklijst bij.

   ELK GETAL DRAAGT ZIJN BRON. Een bron die er niet is, levert geen 0 op maar
   `nietGemeten` met de reden: een nul zegt "er is niets", en dat weten we dan
   niet. En wat het scherm vroeger beloofde maar niet bestaat, staat in
   `nietGebouwd` met de reden, niet als lege tegel. */
'use strict';

const NIET_GEBOUWD = [
  { wat: 'Experience Composer: meerdere partners samen in een pakket',
    reden: 'Er bestaat geen gezamenlijk contract tussen partners in RTG; een conciërge-case kent wel onderdelen per zaak, maar geen consortium dat samen belooft. Bouwen is een besluit.' },
  { wat: 'Match- en netwerkscores (mutual fit, network fit, partnerscores)',
    reden: 'Er is geen onderbouwde berekening voor zo\'n score; een getal zonder bron tonen we niet.' },
  { wat: 'Collectieve patronen over gasten',
    reden: 'Geen meting die zulke patronen uit echte gegevens afleidt, en ze raken de privacygrens van het consortium.' },
  { wat: 'Marge, werkdruk en waarde van andere partners',
    reden: 'Dat zijn gegevens van een andere zaak; die deelt RTG niet.' }
];

function mediaan(getallen) {
  const g = getallen.slice().sort((a, b) => a - b);
  if (!g.length) return null;
  const m = Math.floor(g.length / 2);
  return g.length % 2 ? g[m] : Math.round((g[m - 1] + g[m]) / 2);
}

module.exports = ({ db, mall, bureauZaak, samenwerking, nu = () => new Date() }) => {
  const gemeten = (waarde, bron) => ({ waarde, bron });
  const niet = (reden) => ({ waarde: null, nietGemeten: reden });

  function overzicht(s, beleid) {
    const code = s.code;
    const vandaag = nu().toISOString().slice(0, 10);
    const getallen = {}, aandacht = [];

    /* 1. intenties: de vragen van leden (Mall) */
    let aanvragen = null;
    try { aanvragen = mall && mall.mallAanvragen ? mall.mallAanvragen.voorZaak(s, beleid).aanvragen : null; } catch (e) { aanvragen = null; }
    if (Array.isArray(aanvragen)) {
      const mijnReactie = (a) => (a.reacties || []).find((r) => r.code === code && !r.ingetrokken);
      const wacht = aanvragen.filter((a) => a.status === 'open' && !mijnReactie(a));
      getallen.intentiesOpen = gemeten(wacht.length, '/api/supplier/mall/aanvragen');
      getallen.intentiesBeantwoord = gemeten(aanvragen.filter((a) => mijnReactie(a)).length, '/api/supplier/mall/aanvragen');
      const minuten = aanvragen.map((a) => { const r = mijnReactie(a); return r ? (Date.parse(r.at) - Date.parse(a.at)) / 60000 : NaN; })
        .filter((m) => Number.isFinite(m) && m >= 0);
      getallen.responstijdMin = minuten.length ? gemeten(Math.round(mediaan(minuten)), '/api/supplier/mall/aanvragen (mediaan van uw reacties)')
        : niet('U heeft nog op geen enkele vraag gereageerd.');
      for (const a of wacht.slice(0, 5)) aandacht.push({ soort: 'intentie', id: a.id, versie: a.versie, titel: a.wat, wanneer: a.wanneer || null, plek: a.plek || null, bron: '/api/supplier/mall/aanvragen' });
    } else {
      getallen.intentiesOpen = niet('De vraagkant van de Mall is op deze server niet beschikbaar.');
      getallen.intentiesBeantwoord = niet('De vraagkant van de Mall is op deze server niet beschikbaar.');
      getallen.responstijdMin = niet('De vraagkant van de Mall is op deze server niet beschikbaar.');
    }

    /* 2a. beloften: onderdelen in conciërge-cases */
    let opdrachten = null;
    try { opdrachten = bureauZaak ? (bureauZaak.opdrachten(code) || {}).opdrachten : null; } catch (e) { opdrachten = null; }
    if (Array.isArray(opdrachten)) {
      getallen.onderdelenOpen = gemeten(opdrachten.length, '/api/supplier/concierge/opdrachten');
      const vandaagLijst = opdrachten.filter((o) => String(o.datum || '').slice(0, 10) === vandaag);
      getallen.onderdelenVandaag = gemeten(vandaagLijst.length, '/api/supplier/concierge/opdrachten');
      for (const o of vandaagLijst.slice(0, 5)) aandacht.push({ soort: 'onderdeel', id: o.onderdeel, titel: o.wat, wanneer: o.datum || null, bron: '/api/supplier/concierge/opdrachten' });
    } else {
      getallen.onderdelenOpen = niet('De conciërge-lus is op deze server niet beschikbaar.');
      getallen.onderdelenVandaag = niet('De conciërge-lus is op deze server niet beschikbaar.');
    }

    /* 2b. beloften: samenwerkingen met andere partners */
    let sw = null;
    try { sw = samenwerking ? samenwerking.mijn(s) : null; } catch (e) { sw = null; }
    if (sw) {
      getallen.samenwerkingIn = gemeten((sw.in || []).length, '/api/supplier/samenwerking/mijn');
      getallen.samenwerkingUit = gemeten((sw.uit || []).length, '/api/supplier/samenwerking/mijn');
    } else {
      getallen.samenwerkingIn = niet('Samenwerkingen zijn op deze server niet beschikbaar.');
      getallen.samenwerkingUit = niet('Samenwerkingen zijn op deze server niet beschikbaar.');
    }

    /* 3. capaciteit: alleen met een echte bron */
    if (Array.isArray(s.rooms) && s.rooms.length) {
      getallen.kamersInVerkoop = gemeten(s.rooms.filter((r) => r && r.available).length, 'kamers die in de verkoop staan (supplier.rooms, available)');
      getallen.kamersTotaal = gemeten(s.rooms.length, 'de kamers van uw zaak (supplier.rooms)');
    } else {
      getallen.kamersInVerkoop = niet('Uw zaak heeft geen kamers in RTG; capaciteit van tafels of diensten heeft hier nog geen bron.');
      getallen.kamersTotaal = niet('Uw zaak heeft geen kamers in RTG.');
    }

    /* 4. aandacht: open klussen uit de eigen werklijst */
    const klussen = ((db.data.tickets || {})[code] || []).filter((t) => t && t.status !== 'klaar');
    getallen.klussenOpen = gemeten(klussen.length, 'de werklijst van uw zaak (tickets)');
    for (const t of klussen.slice(0, 5)) aandacht.push({ soort: 'klus', id: t.id, titel: t.text, wanneer: t.at || null, bron: 'de werklijst van uw zaak (tickets)' });

    return { ok: true, zaak: { code, naam: s.name, type: s.type || null }, getallen, aandacht,
      nietGebouwd: NIET_GEBOUWD,
      let: 'Elk getal hier komt uit de genoemde bron; staat er "niet gemeten", dan is er geen bron en dus ook geen nul.' };
  }

  return { overzicht, NIET_GEBOUWD };
};
