/* ============================================================================
   DE SESSIEWACHT -- een 401 betekent pas iets als je sessie nog leeft.

   DE FOUT DIE DIT BESTAAN GEEFT, en hij zat in DRIE instrumenten tegelijk. Een
   proef die alle schrijfroutes langsloopt, loopt ook langs /api/logout. Vanaf
   dat punt is het eigen token ongeldig en gebeurt er iets veel ergers dan
   stoppen: de proef gaat vrolijk door en leest elke 401 als een uitspraak.

     de IDOR-proef      telde elke volgende 401 als "bewezen gescheiden" --
                        honderden routes als bewijs in een register terwijl er
                        alleen maar geen sessie was;
     de rolproef        oogstte niets meer voor zijn objectpool, en zijn
                        vingerafdruk ging dood; de ijking zette de hele proef
                        stil met "DE METER IS BLIND", terecht maar op de
                        verkeerde plek;
     scripts/waarom.js  deelde routes in op een antwoord dat alleen maar
                        "u bent niet ingelogd" was.

   DE REGEL. Niet "sla /api/logout over" -- dan blijft de volgende route die
   een sessie beeindigt onopgemerkt, en dat is precies het soort lijstje dat
   stil veroudert (LAT.md regel 4). Wel: een 401 niet geloven voordat is
   vastgesteld dat de sessie nog leeft. Is hij dood, haal een verse en doe de
   route over; pas dat tweede antwoord telt.

   TWEE MANIEREN OM DAT VAST TE STELLEN, en welke past hangt af van de rol:

     met een probe   goedkoper als er een lichte route bestaat die alleen
                     zegt of je er nog bent (/api/auth/me voor een lid): een
                     extra aanroep, en alleen bij een echte dode sessie ook
                     een inlog en een herhaling.
     zonder probe    altijd bruikbaar, ook voor rollen zonder zo'n route:
                     haal een VERS token en doe de route over. Een 401 met een
                     gegarandeerd verse sessie is een echte weigering.

   WIE HEM GEBRUIKT, EN WIE NIET. De IDOR-proef, de rolproef en scripts/waarom.js
   draaien hierop. Drie andere instrumenten hadden hun eigen herstel al
   (invoerproef 15 hernieuwingen in de laatste ronde, idemproef 22, staatproef
   met een eigen reden) en houden dat: de staatproef mag alleen bij de EERSTE
   aanroep hernieuwen, want een login schrijft zelf in securityLog en sessions
   en zou binnen zijn meetvenster vallen. Die uitzondering past niet in deze
   wacht en hoort dus ook niet verstopt te worden in een gedeelde functie die
   hem stilzwijgend anders doet.

   WAT DEZE WACHT NIET DOET: hij raakt 403 en 404 niet aan. Die zeggen "u mag
   dit niet" en "dit bestaat niet", en dat zijn antwoorden van een server die
   je wel degelijk herkent. Alleen 401 is de statuscode die "wie bent u?"
   betekent, en alleen die is dubbelzinnig tussen een weigering en een
   verdwenen sessie.
   ========================================================================== */
'use strict';

/* `post(pad, lijf, tok)` levert { status, ... }. `rollen` is per rolnaam:
     vers()        haalt een nieuw token voor die rol (of null)
     leeft(tok)    optioneel: true als de sessie nog leeft
     zet(tok)      optioneel: hang het verse token terug waar de aanroeper het
                   bewaart, zodat de volgende route hem meteen gebruikt
   Geeft { roep, hernieuwd } terug; `hernieuwd()` telt hoe vaak een sessie
   werkelijk dood bleek. Blijft dat getal nul terwijl de proef langs een
   uitlogroute komt, dan doet deze wacht niets en hoort dat op te vallen. */
function maakSessiewacht({ post, rollen }) {
  let teller = 0;
  async function roep(pad, lijf, rol, tok) {
    const r = rollen[rol];
    const eerste = await post(pad, lijf, tok);
    if (eerste.status !== 401 || !r || typeof r.vers !== 'function') return eerste;
    /* Met een probe: leeft de sessie, dan is de 401 een echte weigering en
       blijven we er met onze handen vanaf. */
    if (typeof r.leeft === 'function' && await r.leeft(tok)) return eerste;
    const vers = await r.vers();
    if (!vers) return eerste;
    if (typeof r.zet === 'function') r.zet(vers);
    /* Zonder probe weten we het pas na de herhaling. Alleen als die ANDERS
       uitvalt was de sessie het probleem; blijft het 401, dan telde de eerste
       al goed en tellen we deze niet als herstel. */
    const tweede = await post(pad, lijf, vers);
    if (typeof r.leeft === 'function' || tweede.status !== 401) teller++;
    return tweede;
  }
  return { roep, hernieuwd: () => teller };
}

module.exports = { maakSessiewacht };
