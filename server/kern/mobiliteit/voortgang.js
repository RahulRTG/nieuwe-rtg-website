/* Mobility OS (deelmodule): de voortgang van een opdracht. Statusovergangen,
   de gebeurtenissen die eruit vallen, locatie-updates en annuleren.

   EEN OVERGANG GAAT ALTIJD LANGS DE KETEN (./keten, magNaar). Er is geen
   tweede weg om een status te zetten, ook niet voor de dispatcher en ook niet
   voor het AI-stuur -- die lopen allemaal over dezelfde functie. Was er wel
   een tweede weg, dan zou de keten precies zo lang kloppen als de discipline
   van degene die de volgende route schrijft.

   DE GEBEURTENISSEN ZIJN HET KOPPELVLAK. Taxi, bedrijfsvervoer, pendel en
   later OV hangen allemaal aan dezelfde namen (ride.accepted, driver.arrived,
   trip.completed). Daardoor hoeft een nieuwe vervoersmodule geen nieuwe
   meldingen, geen nieuw dispatch-scherm en geen nieuwe rapportage.

   WAT HIER NIET GEBEURT IS GELD VERPLAATSEN. 'afgerekend' zetten legt de
   opdracht vast en schrijft de gebeurtenis; het daadwerkelijke afrekenen
   loopt via de betaalkern (kern/pay), net als bij elke andere RTG-betaling.
   Een tweede plek waar geld beweegt is precies wat LAT.md regel 4 verbiedt. */

const { magNaar, MELDING, GEBEURTENIS, EIND, KETEN, UITZONDERINGEN, VOLGENDE } = require('./keten');

const GEBEURTENIS_MAX = 60;        // per opdracht; genoeg voor een lange rit met stops

module.exports = (ctx) => {
  const { db, save, nu, schoon, notify, opdrachtMet, opdrachtBeeld, sseToOffice, sseToCustomer } = ctx;

  function schrijf(o, soort, door, extra) {
    o.gebeurtenissen = (o.gebeurtenissen || []).concat([
      Object.assign({ soort, at: nu(), door: door || 'systeem' }, extra || {})]);
    // de staart afkappen aan de VOORKANT: het begin van een rit (aanvraag,
    // prijs, toewijzing) is bewijs, de honderdste locatieprik is dat niet
    if (o.gebeurtenissen.length > GEBEURTENIS_MAX) {
      const kop = o.gebeurtenissen.slice(0, 6);
      o.gebeurtenissen = kop.concat(o.gebeurtenissen.slice(-(GEBEURTENIS_MAX - 6)));
    }
  }

  /* De enige weg naar een andere status. `door` is wie hem zet (lid,
     chauffeur, dispatcher, systeem); die naam belandt in de gebeurtenis, want
     achteraf willen weten wie een rit op no-show zette is een reele vraag. */
  function opdrachtNaar(ref, status, door, extra = {}) {
    const o = opdrachtMet(ref);
    if (!o) return { status: 404, error: 'Opdracht niet gevonden.' };
    const check = magNaar(o.status, status);
    if (!check.mag) return { status: 409, error: check.reden, van: o.status };
    /* Wacht deze rit op akkoord van de werkgever, dan beweegt hij niet --
       behalve naar 'geannuleerd', want afzeggen mag altijd. De grendel staat
       HIER, op de enige weg naar een andere status, en niet bij het planbord:
       een filter op een scherm wordt door de volgende ingang omzeild en dan
       rijdt de wagen voordat de leidinggevende ja heeft gezegd. */
    if (o.goedkeuring && o.goedkeuring.status === 'wacht' && status !== 'geannuleerd')
      return { status: 409, error: 'Deze rit wacht op akkoord van de werkgever.', van: o.status };

    const vorige = o.status;
    o.status = status;
    o[status + 'At'] = nu();

    if (status === 'geaccepteerd' && extra.chauffeur) o.chauffeur = extra.chauffeur;
    if (status === 'geaccepteerd' && extra.voertuig) o.voertuig = extra.voertuig;
    if (status === 'vervangend-voertuig') { o.voertuig = null; o.chauffeur = null; }
    if (status === 'incident') o.incident = { reden: schoon(extra.reden, 200) || 'gemeld door ' + (door || 'systeem'), at: nu() };
    if (status === 'afgerekend') o.afgerekend = { bedrag: Number.isFinite(extra.bedrag) ? extra.bedrag : o.prijs, at: nu() };

    schrijf(o, GEBEURTENIS[status], door, extra.reden ? { reden: schoon(extra.reden, 200) } : null);
    save();

    // de reiziger hoort het, in gewone taal en nooit als kale statusnaam
    if (o.reiziger)
      notify(o.reiziger, { icon: 'auto', title: 'RTG Vervoer',
        body: MELDING[status] || 'Uw rit is bijgewerkt.', scope: 'mobiliteit' });
    if (o.reiziger) sseToCustomer(o.reiziger, 'sync', { scope: 'mobiliteit' });
    sseToOffice('sync', { scope: 'mobiliteit' });
    return { ok: true, van: vorige, opdracht: opdrachtBeeld(o, true) };
  }

  /* Een locatieprik tijdens de rit. Bewust GEEN statusovergang: hij mag vaak
     komen, hij verandert niets aan de keten, en hij hoort alleen te bestaan
     zolang de rit loopt. Na afloop nog posities aannemen zou een
     bewegingsprofiel opbouwen van een rit die al voorbij is. */
  function opdrachtPositie(ref, punt, door) {
    const o = opdrachtMet(ref);
    if (!o) return { status: 404, error: 'Opdracht niet gevonden.' };
    if (EIND.has(o.status)) return { status: 409, error: 'De rit is al ' + o.status + '.' };
    if (!Number.isFinite(punt.lat) || !Number.isFinite(punt.lng)) return { status: 400, error: 'Geen geldige positie.' };
    o.positie = { lat: punt.lat, lng: punt.lng, at: nu() };
    schrijf(o, 'trip.location_updated', door, { lat: punt.lat, lng: punt.lng });
    save();
    if (o.reiziger) sseToCustomer(o.reiziger, 'sync', { scope: 'mobiliteit' });
    return { ok: true, positie: o.positie };
  }

  /* Annuleren, met de voorwaarde die BIJ DE BOEKING is vastgelegd en niet met
     de voorwaarde van vandaag. Wie na de gratis termijn annuleert betaalt een
     deel; wie annuleert voordat er een chauffeur op weg was, betaalt niets --
     er is dan ook niemand die iets is misgelopen. */
  function opdrachtAnnuleer(ref, door, reden) {
    const o = opdrachtMet(ref);
    if (!o) return { status: 404, error: 'Opdracht niet gevonden.' };
    const check = magNaar(o.status, 'geannuleerd');
    if (!check.mag) return { status: 409, error: check.reden, van: o.status };
    const v = o.annulering || { gratisTotMin: 5, kostenDeel: 0 };
    const minutenSinds = (Date.now() - new Date(o.geaccepteerdAt || o.gemaakt).getTime()) / 60000;
    const naToewijzing = ['geaccepteerd', 'onderweg', 'aangekomen'].includes(o.status);
    const kosten = (naToewijzing && minutenSinds > v.gratisTotMin)
      ? Math.round(o.prijs * (v.kostenDeel || 0)) : 0;
    o.annuleerKosten = kosten;
    const r = opdrachtNaar(ref, 'geannuleerd', door, { reden });
    if (r.error) return r;
    return Object.assign(r, { kosten, kostenUitleg: kosten
      ? 'Er was al een chauffeur onderweg; ' + Math.round((v.kostenDeel || 0) * 100) + '% annuleringskosten.'
      : 'Geen annuleringskosten.' });
  }

  // wat mag er nu, gezien de status? voedt de knoppen in dispatch en de app
  const opdrachtVolgende = o => (VOLGENDE[o.status] || []).concat(
    EIND.has(o.status) ? [] : ['geannuleerd', 'incident'].filter(s => s !== o.status && !(VOLGENDE[o.status] || []).includes(s)));

  return { opdrachtNaar, opdrachtPositie, opdrachtAnnuleer, opdrachtVolgende,
    KETEN, UITZONDERINGEN, MOB_GEBEURTENIS: GEBEURTENIS };
};
