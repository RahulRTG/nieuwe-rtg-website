/* DE EINDSTATUS: WAT ER WERKELIJK DE DEUR UITGING (N11 van de V1-audit, de
   herkeuring van 6 oktober 2026).

   DE FOUT. De drie idempotentielagen (./idem-poort.js, ./dubbeltik.js en
   ../middleware/idempotentie.js) onthielden een antwoord op het moment dat de
   route res.json aanriep. Dat is niet altijd het antwoord dat vertrekt: een
   laag die res.end bewaakt, kan er daarna nog iets anders van maken. De
   stand-bypoort doet dat (../opzet/standbypoort-antwoord.js): een 200 van een
   proces dat tijdens het verzoek werd afgezet, wordt een 503 met Retry-After: 2
   en de tekst dat het niet vaststaat. De kast hield de 200. De herhaling waar
   die 503 zelf om vraagt (dezelfde sleutel, twee seconden later) kreeg dan 200
   met herhaald:true, terwijl er niets was bewaard. Live gezien voor de kop
   Idempotency-Key, voor `idem` en `idempotentieSleutel` in het lijf, en voor
   een verklaarde route waar de client geen sleutel stuurt.

   DE REGEL: een antwoord wordt pas onthouden als vaststaat welke status
   werkelijk vertrok, en alleen als dat dezelfde is als toen de route json
   riep. Anders is wat er in de hand ligt niet wat de klant kreeg.

   WANNEER DAT VASTSTAAT. Twee momenten; het eerste wint en het tweede doet dan
   niets meer:
   - direct NA de aanroep van res.end. De wikkel wordt gezet bij de eerste
     aanroep van naEindstatus, dus terwijl de route json riep. Elke laag die
     eerder res.end omwikkelde (de stand-bypoort bij de ingang voorop) zit
     erbinnen en heeft dan beslist. Buiten PostgreSQL loopt die keten synchroon.
   - 'finish', VOORAAN in de rij. De eigen HTTP-motor (./http1-res.js) geeft
     'finish' BINNEN zijn end, en de dubbeltik ruimt op 'finish' een rij op die
     nog niet bewaard is. Zonder voorrang zou hij dat doen voordat hier besloten
     is.
   NIET op 'finish' alleen: een verbinding die al dicht was (de klant gaf het
   op, een load balancer probeert het opnieuw) geeft node:http geen 'finish'
   meer, en juist daar is een onthouden antwoord het meest waard.

   EN IN POSTGRESQL-MODUS WORDT ER NIET GEWACHT: daar stelt de verzoekgrens
   res.end uit tot na de commit (../db/postgres-verzoeken.js), en daar onthouden
   de lagen al via haakNaCommit. Die commit komt er bij een 503 niet. */
'use strict';

const verzoekcontext = require('../db/verzoekcontext');

const WACHT = Symbol('eindstatus');

/* fn(status) een keer, met de status die werkelijk vertrok. */
function naEindstatus(res, fn) {
  let w = res[WACHT];
  if (w) { if (w.gedaan) fn(res.statusCode || 200); else w.rij.push(fn); return; }
  w = res[WACHT] = { gedaan: false, rij: [fn] };
  const beslis = () => {
    if (w.gedaan) return;
    w.gedaan = true;
    const status = res.statusCode || 200;
    for (const f of w.rij.splice(0)) f(status);
  };
  const vorige = res.end;
  if (typeof vorige === 'function') {
    res.end = function (...a) { const uit = vorige.apply(this, a); beslis(); return uit; };
  }
  /* EEN BEKENDE LUISTERAAR EXTRA, EN DE GRENS GAAT EVEN MEE OMHOOG. Met een
     Idempotency-Key staan idem-poort en dubbeltik allebei op res, en dan was dit
     de elfde 'finish'-luisteraar: een MaxListenersExceededWarning per verzoek,
     ook op een gezonde leider (herkeuring N11). Geen lek, want het is er precies
     een per res (WACHT). Een grens van 0 is onbegrensd en blijft dat. De grens
     geldt per emitter, dus ook 'close' en 'pipe' krijgen er een bij. */
  if (typeof res.getMaxListeners === 'function' && typeof res.setMaxListeners === 'function') {
    const max = res.getMaxListeners();
    if (max > 0 && Number.isFinite(max)) res.setMaxListeners(max + 1);
  }
  if (typeof res.prependListener === 'function') res.prependListener('finish', beslis);
  else if (typeof res.on === 'function') res.on('finish', beslis);
}

/* De vorm die alle drie de lagen gebruiken: bewaar() in PostgreSQL na de
   commit, daarbuiten pas als de eindstatus gelijk is aan de status van nu.
   Is hij anders (een 503 van de stand-bypoort), dan gebeurt hier niets: wat
   een laag dan moet opruimen of vrijgeven, doet hij al op 'finish' en
   'close', net als bij elk antwoord dat hij niet bewaart. */
function bewaarBijEind(res, bewaar) {
  if (verzoekcontext.haakNaCommit(bewaar)) return;
  const status = res.statusCode || 200;
  naEindstatus(res, (eind) => { if (eind === status) bewaar(); });
}

module.exports = { naEindstatus, bewaarBijEind };
