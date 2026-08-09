/* WANNEER IS EEN BOEKING, en hoe rekenen we met tijden.

   Vier regels die in kern/vakwerk/index.js inline stonden. Ze zijn klein, maar
   ze dragen een gedeelde waarheid: waar de datum en de tijd van een boeking
   vandaan komen. Zou de capaciteitslaag ze overtypen, dan breken de twee
   plekken verschillend zodra dat veld ooit anders gaat heten -- en dat is
   precies het geval waarin je het pas maanden later merkt (lat-regel 4).

   `wanneer` is 'JJJJ-MM-DD' of 'JJJJ-MM-DDTHH:MM'. Een boeking zonder tijd is
   geldig (een klus op een dag, zonder afgesproken uur); tijdVan geeft dan null
   en niet '00:00', want middernacht is een tijd en "geen tijd" is dat niet. */
'use strict';

const datumVan = (b) => (b && b.wanneer ? String(b.wanneer).slice(0, 10) : null);
const tijdVan = (b) => (b && b.wanneer && String(b.wanneer).length > 10
  ? String(b.wanneer).slice(11, 16) : null);

const geldigeTijd = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || ''));
const naarMin = (t) => { const m = String(t).match(/^(\d{2}):(\d{2})$/); return m ? (+m[1]) * 60 + (+m[2]) : null; };
const naarTijd = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

module.exports = { datumVan, tijdVan, geldigeTijd, naarMin, naarTijd };
