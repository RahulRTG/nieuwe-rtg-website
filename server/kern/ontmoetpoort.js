/* DE ONTMOETPOORT -- de ene plek waar staat wie er mag daten.

   RTG heeft twee datingapps met een bewust verschillend karakter (ONTMOETEN.md):
   Vonk is breed en eindig, Rendez-vous is besloten en gecureerd. Wat ze DELEN is
   de toegangseis, en die eis is de enige in dit huis waar een fout meteen een
   mens raakt in plaats van een boeking: er praat een volwassene met een
   volwassene, en allebei zijn ze wie ze zeggen dat ze zijn.

   WAAROM DIT EEN EIGEN MODULE IS. Vonk had deze poort al, in kern/vonk/index.js,
   en Rendez-vous had hem NIET -- daar stond alleen een pas-eis (lifestyle of
   business) op de route. Dat was precies de verkeerde kant op: de exclusieve app
   liet iedere minderjarige met een Lifestyle Pass toe, terwijl de brede app 18+
   en KYC eiste. Die fout kon alleen ontstaan doordat de regel in een app woonde
   in plaats van naast de apps.

   CLAUDE.md doet dit al zo voor de 18+-grens op progressie ("de grens staat op
   een plek in de code, `progressieMag` in kern/spellen/grens.js; nieuwe
   progressievormen hangen daaraan en krijgen geen eigen kopie van de regel").
   Dit is dezelfde constructie voor dezelfde soort grens. Een derde datingvorm
   hangt hieraan en schrijft de eis niet over.

   WAT DE POORT WEL EN NIET DOET

   Wel: is er een echt account, is het paspoort door RTG geverifieerd, en is de
   houder 18 of ouder volgens de geboortedatum die bij die verificatie hoort.

   Niet: de pas-eis. Welke pas een app vraagt, is een productkeuze en verschilt
   per app (Vonk: elke pas; Rendez-vous: Lifestyle of Business). Die blijft waar
   hij hoort, op de route. Zou hij hier staan, dan moest elke nieuwe app deze
   module openbreken -- en dan is het geen grens meer maar een configuratie.

   DE LEEFTIJD KOMT UIT HET PASPOORT, NIET UIT EEN INVULVELD. `leeftijdVan` rekent
   met `member_state.geboren`, en die staat er alleen als het kantoor een document
   heeft gezien. Een zelf ingetikte geboortedatum zonder verificatie levert dus
   geen leeftijd op en de poort gaat niet open -- de twee eisen dekken elkaar
   bewust af in plaats van naast elkaar te staan. */

const MIN_LEEFTIJD = 18;

function maakOntmoetpoort({ accounts, leeftijdVan }) {
  /* Alleen een echt account heeft een sleutel van de vorm user-<id>. De
     demo-persona's draaien op hun tiernaam ('lifestyle', 'business') en horen
     hier niet door: een persona heeft geen paspoort en dus geen leeftijd. */
  function accountVanKey(key) {
    const m = /^user-(\d+)$/.exec(String(key || ''));
    if (!m) return null;
    try { return accounts.getUserById(Number(m[1])); } catch (e) { return null; }
  }

  /* `app` is alleen de naam in de afwijzing. De EIS is voor elke app gelijk;
     zou hij dat niet zijn, dan hoort de afwijkende app zijn eigen extra controle
     te doen en niet deze poort te verbuigen. */
  function ontmoetPoort(key, app) {
    const naam = app || 'Deze app';
    const u = accountVanKey(key);
    if (!u) return { ok: false, reden: naam + ' is voor RTG-leden met een eigen account.' };
    if (u.verified !== 'verified')
      return { ok: false, reden: 'Activeer eerst uw RTG-geverifieerde paspoort (KYC); zo weet iedereen op ' + naam + ' dat de ander echt is.' };
    let md = {};
    try { md = accounts.getMemberState(u.id) || {}; } catch (e) {}
    const lft = md.geboren ? leeftijdVan(md.geboren) : null;
    if (lft == null || lft < MIN_LEEFTIJD) return { ok: false, reden: naam + ' is vanaf ' + MIN_LEEFTIJD + ' jaar.' };
    return { ok: true, leeftijd: lft };
  }

  return { ontmoetPoort, MIN_LEEFTIJD };
}

module.exports = { maakOntmoetpoort, MIN_LEEFTIJD };
