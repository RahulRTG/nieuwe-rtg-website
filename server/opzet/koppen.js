/* ============================================================================
   SECURITY-HEADERS OP ELK ANTWOORD.

   Eén middleware, en elke regel erin heeft een reden die het onthouden waard
   is. Ze staat apart van de rest van de voordeurketen omdat dit het antwoord
   is op een vraag die je los kunt stellen: wat vertellen we de browser over wat
   hij met dit antwoord mag doen?
   ========================================================================== */
'use strict';

module.exports = function koppen({ app }) {
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    // SAMEORIGIN i.p.v. DENY: het RTG-bureaublad (zelfde origin) mag onze eigen
    // apps schermvullend insluiten; andere sites kunnen ons nog steeds niet
    // framen (clickjacking-bescherming blijft tegen derden overeind).
    res.set('X-Frame-Options', 'SAMEORIGIN');
    /* Referrer-Policy is hier geen formaliteit. De live-verbindingen (SSE)
       kunnen geen Authorization-header meesturen -- EventSource kan dat niet --
       dus daar reist het sessietoken mee als ?token= in de URL. Met deze regel
       krijgt een externe partij hooguit onze origin te zien, nooit de hele URL,
       en lekt dat token dus niet via de Referer-header weg.
       Wat dit NIET oplost: een reverse proxy of CDN legt standaard de complete
       URL vast in zijn access log. Onze eigen logger doet dat niet (die schrijft
       req.path, zonder querystring; test/loghygiene.test.js bewaakt het), maar
       de proxy moet apart worden ingesteld -- zie PRODUCTION.md. */
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    // 9+-hardening: eigen vensters delen geen proces met vreemden (COOP), onze
    // bestanden zijn niet als bron voor andere sites bruikbaar (CORP), de
    // browser lekt geen DNS-voorkennis, en gevoelige browser-API's staan
    // expliciet dicht behalve wat de apps zelf nodig hebben.
    res.set('Cross-Origin-Opener-Policy', 'same-origin');
    res.set('Cross-Origin-Resource-Policy', 'same-origin');
    res.set('X-DNS-Prefetch-Control', 'off');
    res.set('X-Permitted-Cross-Domain-Policies', 'none');
    res.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), serial=(), bluetooth=(), midi=()');
    /* DE TERUGVAL-CSP, EN WAAROM HIER GEEN 'unsafe-inline' MEER STAAT.

       HTML-pagina's krijgen hun CSP van cspNonce (middleware/voordeur.js): een
       verse nonce per verzoek, geen unsafe-inline. Deze regel geldt voor al het
       ANDERE -- JSON-antwoorden, statische bestanden, foutpagina's -- en gold
       tot nu toe ook voor elke HTML-pagina die cspNonce om wat voor reden dan
       ook niet oppakte.

       Dat is geen theorie: de kop van voordeur.js beschrijft precies zo'n geval,
       waarin "/" terugviel op deze regel en juist de meest bezochte pagina de
       zwakste bescherming kreeg. Een terugval die stiller is dan het origineel
       is de verkeerde kant op falen. Zonder unsafe-inline breekt zo'n pagina
       zichtbaar in plaats van dat ze haar bescherming stilletjes verliest. */
    /* En style-src evenmin. Een nonce kan hier niet -- dit antwoord kan een
       JSON-blob of een bestand zijn, er is geen pagina om te stempelen -- dus
       staat er alleen 'self'. Een HTML-pagina die hier terechtkomt, verliest
       daarmee de opmaak uit haar eigen <style>-blokken. Dat is met opzet: dat is
       precies het geval dat hierboven wordt beschreven, en het hoort ZICHTBAAR
       te zijn in plaats van een pagina die er goed uitziet met de zwakste regel
       van het huis. test/csp.e2e.js loopt de vlaggenschepen langs en eist nul
       blokkades, dus zo'n terugval valt op.

       style-src-attr houdt wel 'unsafe-inline' -- zie de uitleg in
       middleware/voordeur.js: er staan 8957 style="..."-attributen in public/,
       en CSP kent geen stempel voor een attribuut. */
    res.set('Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; " +
      "font-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; " +
      "connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'");
    next();
  });
};
