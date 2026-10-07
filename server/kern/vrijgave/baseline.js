/* DE V1-BASELINE: wat de eigenaar voor de eerste productierelease AAN wil
   hebben, en wat daar met opzet NIET in zit.

   WAT DIT IS. Een machineleesbare weergave van een BESLUIT van de eigenaar
   (6 oktober 2026), geen schakelaar. Dit bestand zet niets aan: de stand komt
   uit ./stand.js (een mens met een passkey), het bewijs uit ./bewijs.js (een
   getekend dossier), de autorisatie uit de bevoegdheidslaag en de besluiten.
   Wat de baseline WEL doet, is zeggen wat de release-uitspraak moet eisen:

     IN DE BASELINE   moet in de releaseconfiguratie BESCHIKBAAR zijn (alle
                      assen, ./oordeel.js), anders zakt de releasepoort -- met de
                      assen die ontbreken erbij, en nooit als waarschuwing;
     NIET             moet aantoonbaar NIET beschikbaar zijn. Staat er een toch
                      open, dan zakt de poort ook: een capability die de eigenaar
                      uitdrukkelijk buiten V1 hield, hoort er niet stil bij;
     BESLUIT-OPEN     de eigenaar heeft nog niet besloten. Tot dat besluit valt,
                      geldt hetzelfde als NIET: in productie aantoonbaar dicht.

   WAAROM EEN BESTAND EN GEEN VELD IN HET REGISTER. Het register (./register.js)
   zegt wat een capability IS en wat hij nodig heeft; dat verandert niet per
   release. De baseline zegt wat er bij DEZE release aan hoort, en die wisselt
   per release. Twee dingen die op een ander ritme veranderen, horen niet in een
   object -- anders wordt een releasebesluit een wijziging aan de definitie.

   WAT HIER NIET STAAT: een stand. Er is geen `enabled: true` en er komt er geen.
   test/vrijgave-baseline.test.js zakt zodra dit bestand iets anders draagt dan
   de drie soorten hieronder, of zodra een capability uit het register er niet in
   staat (onbekend is geen "niet": het is een vergeten besluit). */
'use strict';

const NAAM = 'V1';
const VASTGESTELD = '2026-10-06';
const BRON = 'Besluit van de eigenaar, 6 oktober 2026: de V1-baseline voor de eerste productierelease.';

const SOORTEN = Object.freeze(['in-baseline', 'niet', 'besluit-open']);

/* `via`: voor een capability die per verzoek een provider kiest (./register.js
   `provider: 'per-verzoek'`), de provider waarover de baseline hem belooft. Een
   inkomende betaling "via Stripe" is iets anders dan een inkomende betaling
   via Mollie, en die tweede hoort er in V1 niet bij. */
const r = (soort, waarom, via) => Object.freeze(Object.assign({ soort, waarom }, via ? { via } : {}));

const BASELINE = Object.freeze({
  'geld.inkomend': r('in-baseline', 'Betalingen ontvangen, via Stripe.', 'stripe'),
  'geld.provider.stripe': r('in-baseline', 'Stripe is in V1 de enige betaalprovider.'),
  'geld.terugbetaling': r('in-baseline', 'Een ontvangen betaling terugbetalen naar de oorspronkelijke betaalwijze.', 'stripe'),
  'geld.partnerafrekening': r('in-baseline', 'Partners afrekenen naar hun verbonden account.'),
  'geld.provider.stripe_connect': r('in-baseline', 'Stripe Connect draagt de partnerafrekening.'),

  'geld.terugstortbaar_saldo': r('niet', 'Terugstortbaar saldo is elektronisch geld (B3); niet in V1.'),
  'geld.lid_iban_uitbetaling': r('niet', 'Saldo van een lid naar zijn IBAN rust op B3 (elektronisch geld); niet in V1.'),
  'geld.provider.mollie': r('niet', 'In V1 is Stripe de enige provider.'),
  'geld.provider.adyen': r('niet', 'In V1 is Stripe de enige provider.'),

  'geld.intern_saldo': r('besluit-open', 'Het interne saldo (gesloten circuit): de eigenaar heeft nog niet besloten.'),
  'geld.opwaarderen': r('besluit-open', 'Saldo opwaarderen: de eigenaar heeft nog niet besloten.')
});

function vanCapability(id) {
  const b = BASELINE[id];
  return b ? b.soort : null;
}

/* HET OORDEEL OVER EEN OVERZICHT (de vorm van ./index.js `overzicht()` of van
   /api/office/vrijgave). Puur: geen omgeving, geen stand, alleen wat het
   overzicht zegt. Elke capability uit het register moet een baselinesoort
   hebben; een capability die in de baseline staat maar niet in het overzicht,
   is ook een fout (dan is het register korter geworden zonder dat het besluit
   meeging). */
function beoordeel(overzicht) {
  const fouten = [];
  const regels = [];
  const caps = (overzicht && Array.isArray(overzicht.capabilities)) ? overzicht.capabilities : null;
  if (!caps) return { ok: false, fouten: ['er is geen vrijgaveoverzicht om te beoordelen'], regels };
  if (overzicht.configuratiefout) fouten.push('configuratiefout in de vrijgavestand: ' + overzicht.configuratiefout);
  const gezien = new Set();
  const ASSEN = ['geimplementeerd', 'geverifieerd', 'geautoriseerd', 'ingeschakeld', 'afhankelijkhedenGezond'];
  for (const c of caps) {
    gezien.add(c.id);
    const soort = vanCapability(c.id);
    const b = BASELINE[c.id] || {};
    /* Per-verzoek-capabilities worden per provider beoordeeld (./index.js
       `overzicht()` `perProvider`). In de baseline telt de belofte-provider
       (`via`); erbuiten mag hij over GEEN ENKELE provider open staan. */
    const per = c.perProvider && typeof c.perProvider === 'object' ? c.perProvider : null;
    const gekozen = b.via ? (per && per[b.via]) || null : c;
    const open = soort === 'in-baseline'
      ? !!gekozen && gekozen.beschikbaarVoorRechthebbende === true
      : c.beschikbaarVoorRechthebbende === true || (!!per && Object.values(per).some(x => x && x.beschikbaarVoorRechthebbende === true));
    const bron = gekozen || c;
    const assen = ASSEN.filter(a => bron[a] !== true);
    const regel = { id: c.id, baseline: soort, via: b.via || null, beschikbaar: open, ontbrekendeAssen: assen,
      code: bron.code || null, intern: bron.intern || null };
    regels.push(regel);
    if (!soort) { fouten.push(c.id + ': staat niet in de ' + NAAM + '-baseline (een vergeten besluit, geen "niet")'); continue; }
    if (soort === 'in-baseline' && !open)
      fouten.push(c.id + ': hoort in de ' + NAAM + '-baseline beschikbaar te zijn, maar niet: ' +
        (assen.length ? assen.join(', ') : 'onbekend') + (b.via ? ' [via ' + b.via + ']' : '') +
        (regel.intern ? ' (' + regel.intern + ')' : ''));
    if (soort !== 'in-baseline' && open)
      fouten.push(c.id + ': staat ' + (soort === 'niet' ? 'buiten' : 'nog als besluit-open buiten') +
        ' de ' + NAAM + '-baseline maar is BESCHIKBAAR; dat hoort aantoonbaar dicht te zijn');
  }
  for (const id of Object.keys(BASELINE)) if (!gezien.has(id)) fouten.push(id + ': staat in de baseline maar niet in het register');
  return { ok: fouten.length === 0, fouten, regels, baseline: NAAM };
}

module.exports = { NAAM, VASTGESTELD, BRON, SOORTEN, BASELINE, vanCapability, beoordeel };
