/* DE RECHTSVORMEN BUITEN NEDERLAND.

   Los van ./rechtsvorm.js, en niet omdat het bestand te groot werd: het is een
   andere soort kennis. Daar staat de Nederlandse werkelijkheid waar de rest van
   dit huis op rekent (KvK, notaris, btw-nummer, IB-aftrekken); hier staat wat
   elders geldt, en dat weten wij aantoonbaar minder goed.

   WAT WIJ NIET WETEN, STAAT ER NIET. Er is geen regel die "de bv van dit land"
   verzint uit de bv die wij kennen. Voor een land dat hieronder ontbreekt geeft
   de laag een expliciet "wij kennen de rechtsvormen van dit land niet" terug --
   met de vraag om het bij een lokale adviseur na te gaan. Dat is het enige
   eerlijke antwoord, en het is oneindig veel beter dan een lijst die klopt voor
   het verkeerde land: wie daarop afgaat, gaat naar de verkeerde instantie.

   DE CAPS ZIJN HIER MET OPZET NEUTRAAL. `urencriterium`, `startersaftrek`,
   `mkb-winstvrijstelling` en `dga-loon` zijn Nederlandse fiscale begrippen. Zou
   een Duitse GmbH `dga-loon` dragen, dan zou ./belasting.js er vrolijk een
   Nederlandse berekening op loslaten. Buiten Nederland staat er daarom
   `winst-bij-eigenaar` of `winstbelasting-rechtspersoon` -- wat er WAAR is,
   zonder te doen alsof wij het tarief kennen.

   EN DE OPRICHTINGSSTAPPEN NOEMEN DE ECHTE INSTANTIE. "Inschrijven bij de KvK"
   is in Belgie de KBO en in Duitsland het Handelsregister. Een stap die de
   verkeerde instantie noemt, is erger dan een stap die ontbreekt.

   Deze tabel is de INGEBOUWDE BASIS. ./rechtsvormwacht.js kan hem bijwerken uit
   een bron; zonder bron draait alles hierop door. */
'use strict';


const { PRIVE, RECHTSPERSOON_WINST } = require('./rechtsvorm-woorden');

/* De twee tabellen bij elkaar. Ze staan los omdat ze een andere rechtstraditie
   beschrijven -- daar staat per bestand waarom -- en hier omdat de rest van het
   huis maar een ingang hoort te kennen. */
const LANDEN = Object.assign({},
  require('./rechtsvorm-europa').LANDEN,
  require('./rechtsvorm-angelsaksisch').LANDEN);

/* De caps die hier voorkomen en die ./rechtsvorm.js nog niet kent. Ze staan
   apart zodat de vocabulaire-controle van ./rechtsvormwacht.js ze meeneemt --
   een cap die nergens in een tabel staat, kan een bron ook niet aanzetten. */
const EXTRA_CAPS = [PRIVE, RECHTSPERSOON_WINST, 'btw-aangifte'];

module.exports = { LANDEN, EXTRA_CAPS, PRIVE, RECHTSPERSOON_WINST };
