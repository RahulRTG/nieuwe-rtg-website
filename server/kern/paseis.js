/* WIE HEEFT ER EEN PAS. Eén lijst, want twee deuren stellen dezelfde vraag.

   Een bedrijf aanmelden bij RTG kan langs twee wegen: het formulier Partner
   worden (routes/member/partnerkanaal.js) en het vinkje in de onboarding
   (kern/onboarding/meebouwen.js). Allebei vragen ze hetzelfde: staat er een LID
   achter dit bedrijf? Er gaat namelijk iets echts de deur uit -- een
   bedrijfscode en een beheer-inlog, of een wens die een mens gaat behandelen --
   en dat geven we niet aan een anonieme post.

   WAT HET NADRUKKELIJK NIET IS: een eis dat het de Business Pass moet zijn. Een
   pas is een lidmaatschapsniveau en geen vergunning om te ondernemen; wie met
   een gewone RTG Pass een zaak runt, is niet minder ondernemer. Dat is dezelfde
   grens die CONCERN.md al aan de werknemerskant trekt: niemand koopt hier een
   pas om te mogen werken.

   De gratis gast-laag (tier 'guest') valt erbuiten. Die grens staat hier één
   keer; wie er een derde deur bij bouwt, leest deze lijst en schrijft hem niet
   over (LAT-regel 4). */
'use strict';

const PASSEN = ['rtg', 'lifestyle', 'business'];

const heeftPas = (tier) => PASSEN.includes(String(tier || ''));

// dezelfde zin op beide deuren, zodat een lid niet twee verhalen hoort
const PAS_FOUT = 'Een bedrijf meldt u aan als lid: log in met uw RTG-, Lifestyle- of Business Pass en probeer het opnieuw.';

module.exports = { PASSEN, heeftPas, PAS_FOUT };
