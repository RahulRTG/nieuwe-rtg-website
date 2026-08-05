/* ============================================================================
   DE OPSLAG AANZETTEN -- EN BLIJVEN PROBEREN.

   Realtime, de gedeelde JSON-opslag (Redis), de kruisproces-synchronisatie van
   SQLite, en PostgreSQL. Dat laatste is de reden dat dit een eigen bestand is:

   POSTGRES BLIJVEN PROBEREN, IN PLAATS VAN VOORGOED OP 503 TE STAAN.

   Hier stond een enkele aanroep met een .catch die de fout logde en verder
   niets. In de Postgres-stand geeft opslagKlaar() dan false, en de
   opslagpoortwachter beantwoordt ELKE API met 503 -- voorgoed. Is de database
   bij het opstarten een halve minuut niet bereikbaar (een herstart, een
   netwerkhikje, een container die net iets eerder start), dan is de instance
   dood tot iemand hem met de hand herstart. Dat is geen storing van een halve
   minuut maar een storing tot er iemand kijkt.

   Nu opnieuw proberen met oplopende pauzes, tot een halve minuut. Bewust
   ZONDER bovengrens op het aantal pogingen: een server die wacht op zijn
   database is precies wat je wilt, en zolang hij niet klaar is laat de
   poortwachter er ook niets door. Bij elke poging een regel in het log, zodat
   het zichtbaar is en niet als stilte overkomt.

   Dezelfde behandeling voor de accounts-spiegel. Die wedgt de server niet op
   503, maar viel bij een mislukte eerste poging stil terug op alleen de lokale
   kluis: een registratie op instance A kwam dan nooit op B, zonder dat iets dat
   later nog rechtzette.

   Wat hier NIET wordt opgelost: wat de server moet doen als Postgres wegvalt
   terwijl hij DRAAIT. Doorgaan op de lokale kopie of dichtgaan is een
   bedrijfskeuze en geen bugfix; die vraag ligt bij de eigenaar.
   ========================================================================== */
'use strict';

module.exports = function opslagStart(deps) {
  const { log, accounts, initRealtime, startGedeeld, startSqliteSync, startPostgres,
    DEMO, zetEigenaarsAccount } = deps;

  initRealtime();
  // Gedeelde data via Redis aanzetten (JSON-opslag, lees-replica's).
  startGedeeld().catch(e => console.warn('[db] gedeelde data mislukt:', e.message));
  // Kruisproces-synchronisatie voor de SQLite-opslag (echt losse schrijvende servers).
  startSqliteSync();

  // De eerste pauze; verdubbelt tot een halve minuut. Instelbaar zodat een toets
  // niet seconden hoeft te wachten om te zien DAT er opnieuw geprobeerd wordt.
  const PG_HERKANS_MS = Math.max(50, Number(process.env.PG_HERKANS_MS || 1000));
  function blijfProberen(naam, doe, poging) {
    poging = poging || 0;
    Promise.resolve().then(doe).catch(e => {
      // De stack een keer, niet bij elke herkansing: anders vult een database die
      // een minuut wegblijft het log met twintig keer hetzelfde spoor en is de
      // regel die er wel toe doet niet meer te vinden.
      if (poging === 0) log.uitzondering(e instanceof Error ? e : new Error(String(e)), { bron: naam, poging: 1 });
      const wacht = Math.min(30000, PG_HERKANS_MS * Math.pow(2, Math.min(poging, 5)));
      console.warn('[db] ' + naam + ' nog niet gelukt (poging ' + (poging + 1) + ': ' + e.message +
        '); opnieuw over ' + Math.round(wacht / 100) / 10 + ' s.');
      const t = setTimeout(() => blijfProberen(naam, doe, poging + 1), wacht);
      if (t.unref) t.unref();
    });
  }
  blijfProberen('startPostgres', startPostgres);
  // Accounts eveneens delen via PostgreSQL (zodat een registratie op instance A ook
  // op instance B werkt); zonder DATABASE_URL blijft dit inert.
  blijfProberen('accounts.startPostgres', () => accounts.startPostgres()
    /* NOGMAALS de eigenaars-bootstrap. startPostgres() trekt de gedeelde
       users-tabel binnen met "Postgres wint" -- terecht voor echte data, maar het
       draaide de demo-bootstrap in server.js terug en liet de eigenaar buiten
       staan. Alleen in demostand; in productie draait dit nooit. */
    .then(() => { if (DEMO) { try { zetEigenaarsAccount(); } catch (e) { log.warn && log.warn('[demo] eigenaars-bootstrap na de pull mislukt: ' + e.message); } } }));

  return { blijfProberen };
};
