/* ============================================================================
   DE HERSCHRIJFKETEN: VIJF LAGEN, EN DE VOLGORDE IS DRAGEND.

   Een pagina gaat op weg naar de browser door vijf herschrijvingen. Die stonden
   in ./voordeur.js midden in de responsafhandeling, tussen het lezen van het
   bestand en het comprimeren ervan -- met per laag een alinea over WAAROM hij
   op die plek staat. Dat maakte dat bestand niet alleen te groot (10.129 bytes,
   111 onder de harde grens), het maakte de belangrijkste eigenschap van deze
   keten ook het moeilijkst te vinden: de volgorde.

   WANT DE VOLGORDE IS GEEN SMAAK. Twee lagen tellen blokken op volgnummer en
   twee andere veranderen het aantal blokken; staan ze verkeerd om, dan levert
   de pagina het VERKEERDE blok uit of verschuift de cascade. Dat is een fout
   die geen enkele toets op een losse laag ooit vindt, want elke laag klopt dan
   op zichzelf. Daarom staat de keten nu op een plek waar hij als KETEN te lezen
   en te toetsen is.

   Wat hier NIET in zit, met opzet: het stempelen met een nonce, de CSP-kop en
   de compressie. Dat is geen herschrijven van inhoud maar het afleveren ervan,
   en dat hoort bij de voordeur. Deze module krijgt HTML en geeft HTML.
   ========================================================================== */
'use strict';
const { herschrijfHtml: stijlbundelHtml } = require('./stijlbundel');
const { herschrijfHtml: scriptbundelHtml } = require('./scriptbundel');
const { herschrijfHtml: stijlafsplitsingHtml } = require('./stijlafsplitsing');
const { herschrijfHtml: versieadresHtml } = require('./versieadres');
const { herschrijfHtml: scriptafsplitsingHtml } = require('./scriptafsplitsing');
const { magnaatHtml } = require('./csp');

/* html in, html uit. `rel` is het paginapad (/apps/app.html) -- de twee
   afsplitsingslagen zetten dat in de verwijzing die zij achterlaten, zodat de
   uitleverkant het blok terug kan zoeken zonder servergeheugen. */
function herschrijfPagina(html, rel, publicDir, magnaat) {
  /* HET GROTE INLINE <script>-BLOK ALS EERSTE, op de RAUWE bron.

     Dit moet hier staan en nergens anders. De uitleverkant zoekt het blok
     terug op VOLGNUMMER in het bronbestand, dus de telling hier en daar
     moeten over dezelfde tekst gaan. magnaatHtml hieronder maskeert een
     <script>-tag en scriptbundelHtml verderop vervangt een hele RIJ
     <script>-tags door een; draait deze laag daarna, dan telt hij anders
     dan de bron en levert de pagina het VERKEERDE blok uit.

     Andersom kan het wel: wat hier een <script src> wordt, was een gewoon
     (niet-uitgesteld) blok en blijft dat ook -- het breekt een rij
     uitgestelde scripts precies zoals het inline blok dat deed, dus de
     lagen hieronder zien hetzelfde. Zie ./scriptafsplitsing.js.

     (De stijlkant heeft dit probleem niet: geen enkele laag hieronder
     verandert het aantal <style>-blokken, dus die mag later draaien.) */
  html = scriptafsplitsingHtml(html, rel);
  html = magnaatHtml(html, magnaat);
  /* Een rij opeenvolgende stijlbladen wordt EEN verwijzing. Dit gaat voor de
     stempels uit: wat hier verdwijnt hoeft geen nonce meer. Zie
     ./stijlbundel.js voor wat er wel en niet in mag. */
  html = stijlbundelHtml(html);
  /* En een groot inline <style>-blok wordt een eigen blad. Dit staat NA de
     stijlbundel met opzet: die bepaalt zijn rijen met het blok nog op zijn
     plek (een <style> breekt een rij, zie stijlbundel-rij.js), zodat de
     nieuwe verwijzing niet alsnog een rij in wordt getrokken en de cascade
     verschuift. Zie ./stijlafsplitsing.js. */
  html = stijlafsplitsingHtml(html, rel);
  /* En hetzelfde voor een rij UITGESTELDE scripts. Dat mocht lang niet,
     omdat een fout in het ene script het volgende zou meeslepen; in de
     bundel krijgt elk bestand daarom zijn eigen try/catch, waarmee dat
     verschil weg is. Zie ./scriptbundel.js. */
  html = scriptbundelHtml(html);
  /* En als laatste rewrite: elke overgebleven verwijzing naar een .js of
     .css krijgt de vingerafdruk van dat bestand mee, zodat een
     herhaalbezoek er niet meer naar hoeft te vragen. Staat NA de twee
     bundels met opzet: die maken hun eigen adressen met een querystring,
     en die blijven ongemoeid. Zie ./versieadres.js. */
  html = versieadresHtml(html, publicDir);
  return html;
}

module.exports = { herschrijfPagina };
