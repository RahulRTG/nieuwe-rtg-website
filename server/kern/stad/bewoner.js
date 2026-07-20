/* RTG Stad, deel "bewoner": de stad voor wie er WOONT. Twee dingen:

   1. Het bewonersbeeld: hetzelfde eerlijke stadsbeeld als de boardroom, maar
      zonder de bedrijfsvoering -- standen en waarden per domein, het scenario
      en de waarschuwingen; geen serienummers, sleutels of regimeknoppen.
   2. Meldingen: een bewoner meldt iets dat stuk of vol is (lantaarn, container,
      overlast). De melding wordt METEEN een klus op de werklijst van de
      veld-app; wordt hij daar klaargemeld, dan ziet de melder dat live terug.

   Privacy zoals overal: meldingen hangen aan de codenaam (pseudoniem), de
   melder ziet alleen zijn eigen meldingen, en de vrije tekst gaat NIET mee in
   de AI-dataset (geen vrije tekst van derden). Begrensd tegen misbruik:
   hooguit vijf open meldingen per bewoner. Krijgt de gedeelde ctx. */
module.exports = (ctx) => {
  const { d, save, crypto, schoon, nu, zones, regie, DOMEINEN, standVan, alerts, SCENARIOS, zorgBasis, simuleer, seintje } = ctx;

  const SOORTEN = { licht: 'kapotte verlichting', afval: 'volle of kapotte container', water: 'water op straat', geluid: 'geluidsoverlast', anders: 'iets anders' };
  const MAX_OPEN_PER_BEWONER = 5;

  function meldingen() { if (!Array.isArray(d().stadMeldingen)) d().stadMeldingen = []; return d().stadMeldingen; }

  // het beeld voor de bewoner: wat de stad doet, niet hoe hij bestuurd wordt
  function bewonerBeeld(codenaam) {
    zorgBasis(); simuleer();
    const s = SCENARIOS.find(x => x.naam === regie().scenario);
    return { status: 200,
      scenario: { naam: regie().scenario, label: s ? s.label : regie().scenario, uitleg: s ? s.uitleg : '' },
      domeinen: DOMEINEN.map(x => ({ id: x.id, label: x.label, eenheid: x.eenheid, ...standVan(x.id) })),
      alerts: alerts(), zones: zones().slice(), soorten: SOORTEN,
      mijnMeldingen: meldingen().filter(m => m.codenaam === codenaam).slice(0, 20)
        .map(m => ({ id: m.id, zone: m.zone, soort: m.soort, tekst: m.tekst, status: m.status, at: m.at, klaarAt: m.klaarAt || null })),
      privacy: 'de stad meet dingen, geen mensen; je melding hangt aan je codenaam en is alleen voor jou en de veldploeg zichtbaar' };
  }

  function meld({ codenaam, zone, soort, tekst }) {
    zorgBasis();
    const cn = String(codenaam || '').trim();
    if (!cn) return { status: 401, error: 'Log opnieuw in.' };
    const z = String(zone || '').trim();
    if (!zones().includes(z)) return { status: 400, error: 'Kies een bestaande zone: ' + zones().join(', ') + '.' };
    if (!SOORTEN[String(soort || '')]) return { status: 400, error: 'Kies wat er speelt: ' + Object.keys(SOORTEN).join(', ') + '.' };
    const t = schoon(tekst, 200);
    if (!t || t.length < 5) return { status: 400, error: 'Vertel in een paar woorden wat je ziet (minstens 5 tekens).' };
    if (meldingen().filter(m => m.codenaam === cn && m.status === 'open').length >= MAX_OPEN_PER_BEWONER)
      return { status: 429, error: 'Je hebt al ' + MAX_OPEN_PER_BEWONER + ' open meldingen; de veldploeg is ermee bezig.' };
    const m = { id: 'SM-' + crypto.randomBytes(3).toString('hex').toUpperCase(), codenaam: cn,
      zone: z, soort: String(soort), tekst: t, status: 'open', at: nu() };
    meldingen().unshift(m);
    if (meldingen().length > 5000) meldingen().length = 5000;
    save(); seintje(); // de veld-app en de boardroom zien de nieuwe klus meteen
    return { ok: true, melding: { id: m.id, zone: m.zone, soort: m.soort, status: m.status } };
  }

  /* De veldwerk-laag roept dit aan als een melding-klus wordt klaargemeld:
     de melding gaat op "klaar" en de melder krijgt een live seintje. */
  function meldingKlaar(id, wie) {
    const m = meldingen().find(x => x.id === id && x.status === 'open');
    if (!m) return null;
    m.status = 'klaar'; m.klaarDoor = schoon(wie, 60) || 'veld'; m.klaarAt = nu();
    save();
    if (ctx.bewonerSeintje) { try { ctx.bewonerSeintje(m.codenaam); } catch (e) {} }
    return m;
  }

  // de open meldingen als klussen voor de werklijst van de veld-app
  function openMeldingKlussen() {
    return meldingen().filter(m => m.status === 'open').slice(0, 50).map(m => ({
      sleutel: 'melding:' + m.id, soort: m.soort === 'anders' ? 'onderhoud' : m.soort, zone: m.zone,
      omschrijving: 'Bewonersmelding (' + (SOORTEN[m.soort] || m.soort) + ', ' + m.zone + '): ' + m.tekst }));
  }

  ctx.meldingKlaar = meldingKlaar;
  ctx.openMeldingKlussen = openMeldingKlussen;
  return { api: { stadBewonerBeeld: bewonerBeeld, stadBewonerMeld: meld } };
};
