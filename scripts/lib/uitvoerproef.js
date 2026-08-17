/* ============================================================================
   DE UITVOER-SCHAKEL: KIJKT IEMAND NAAR DE INHOUD VAN HET ANTWOORD?

   HET GAT, EN HET STOND IN EEN REGEL. scripts/lib/rolproef.js weegt elk
   antwoord met weegAntwoord(), en die begint zo:

     if (status >= 200 && status < 300) return { tweexx: true, lek: null };

   Een 2xx wordt dus geteld als "de rol kwam binnen" en daarna kijkt niemand
   meer wat er IN dat antwoord stond. De lekmerkers -- e-mailadres, IBAN, echte
   naam uit de kluis, geheim veld, telefoonnummer -- draaien alleen over
   WEIGERINGEN. In de bewijsmatrix was OUTPUT daardoor 0 van 3987 routes
   bewezen: van geen enkele route lag vast dat het antwoord niets teruggeeft dat
   er niet in hoort. Voor een huis dat op codenamen draait met de echte namen in
   een gescheiden kluis is dat de kolom die je het hardst wilt hebben.

   WAAROM DE LEKMERKERS NIET ZOMAAR OVER EEN 2xx MOGEN. Op een weigering is elk
   e-mailadres verdacht. Op een DOORLAAT niet: je eigen naam, je eigen adres en
   je eigen telefoonnummer horen in je eigen antwoord te staan -- dat is geen
   lek maar de functie. Wie de merkers blind over succesantwoorden haalt, bouwt
   een alarm dat bij /api/auth/mij afgaat, en na drie loze alarmen zet iemand de
   proef uit (dezelfde les als de vals-alarmronde in rolproef.js).

   DUS KANARIES. De proef zet een SLACHTOFFER-account neer met waarden die
   nergens anders voorkomen -- een naam, een e-mailadres en een telefoonnummer
   met een eigen kenmerk erin -- en doet daarna alle verzoeken als een TWEEDE
   account. Staat een kanarie van het slachtoffer in het 2xx-antwoord van de
   aanvaller, dan is dat geen smaakkwestie en geen meetverschil: dan is er data
   van iemand anders uit de deur gelopen. Nul valse alarmen, en het meet precies
   de belofte van de identiteitskluis.

   ERBIJ: het geheime veld. Een wachtwoordhash of sessietoken van wie dan ook --
   ook van jezelf -- hoort niet in een antwoordlijf, dus die telt zonder kanarie.
   Maar de VELDNAAM alleen is niet genoeg: `sleutel` betekent in dit huis net zo
   vaak "key van een datastructuur", en dat gaf zeven valse alarmen op acht in de
   eerste volledige ronde. De waarde moet er dus ook als een geheim uitzien; zie
   lijktGeheim() hieronder, met de gemeten voorbeelden erbij.

   NIET WAT HET HUIS ZELF VAN PLAN WAS, en dat is een keuze. In
   scripts/bewijsmatrix.js staat bij OUTPUT als `nodig`: "de liegpoort per ROUTE
   i.p.v. per toetsbestand". Dat is een andere en zwaardere weg (elke route een
   eigen liegronde). Deze proef meet niet hetzelfde: de liegpoort zou aantonen
   dat een route zijn antwoord uit de ECHTE bron haalt, deze proef toont aan dat
   het antwoord geen ANDERMANS gegevens bevat. Beide horen in OUTPUT; deze is te
   bouwen zonder de liegpoort om te bouwen, dus begint de kolom hier.

   Los toetsbaar: test/uitvoerproef.test.js toetst weegUitvoer() zonder server.
   ========================================================================== */
'use strict';
const { LEKMERKERS } = require('./rolproef');

/* Alleen de geheim-veld-merker uit de gedeelde lijst mag blind over een
   doorlaat: een wachtwoordhash of sessietoken is nooit legitiem in een
   antwoordlijf. De rest (e-mail, naam, telefoon, IBAN) kan je EIGEN gegeven
   zijn en gaat daarom via de kanaries.

   MAAR DE VELDNAAM ALLEEN IS OP EEN DOORLAAT NIET GENOEG, en dat is gemeten.
   De eerste volledige ronde gaf acht bevindingen en zeven daarvan waren vals:

     "sleutel":"sociaal"   (een app-slug in de Mall-catalogus)
     "sleutel":"week"      (de naam van een tijdvenster)
     "sleutel":"basissalaris"  (een looncomponent)

   `sleutel` staat in de gedeelde lijst omdat het "geheime sleutel" kan
   betekenen, maar in dit huis is het net zo vaak gewoon de key van een
   datastructuur. In WEIGERINGEN komt zo'n veld nooit voor -- daar is de lijst
   voor gemaakt -- en op DOORLATEN staat het overal. Zeven valse alarmen op acht
   is precies hoe een proef binnen een week wordt uitgezet.

   Dus blijft de woordenlijst gedeeld (een plek die zegt welke veldnamen
   verdacht zijn) en komt er hier een eis over de WAARDE bij: het moet er ook
   als een geheim uitzien. Een geheim in dit huis is lang en niet-talig --
   scrypt-hashes, hex-tokens, base64-sleutels. Een woord van zeven letters is
   dat niet. */
const GEHEIMWOORDEN = /^(?:[a-z0-9]+_)?(wachtwoord|password|hash|secret|sleutel|apikey|api_key|token|pin)(?:_[a-z0-9]+)?$/i;

/* Ziet deze waarde eruit als een geheim? Ruim aan de veilige kant: liever een
   lange onbekende waarde melden dan een hash missen. */
function lijktGeheim(waarde) {
  const v = String(waarde || '');
  if (v.length < 16) return false;                    // te kort voor een hash of token
  if (/^[0-9a-f]{16,}$/i.test(v)) return true;        // hex: token, id, hash
  if (/\$/.test(v) && v.length >= 20) return true;    // scrypt/bcrypt-vorm: alg$params$zout$hash
  if (/^[A-Za-z0-9+/=_-]{20,}$/.test(v) && /[0-9]/.test(v) && /[A-Za-z]/.test(v)) return true; // base64/base64url
  return false;
}

/* Zoekt "veldnaam": "waarde"-paren waarvan de naam verdacht is EN de waarde er
   als een geheim uitziet. Vervangt het blind toepassen van de merker-regex. */
function geheimVeld(tekst) {
  const re = /"([A-Za-z0-9_]+)"\s*:\s*"([^"]{1,400})"/g;
  let m;
  while ((m = re.exec(tekst))) {
    if (GEHEIMWOORDEN.test(m[1]) && lijktGeheim(m[2])) return 'geheim veld (' + m[1] + ')';
  }
  return null;
}

/* De gedeelde lijst blijft de bron van de veldnamen; deze controle bewaakt dat
   die twee niet uit elkaar lopen zonder dat iemand het merkt. */
const GEHEIMMERKER = LEKMERKERS.find(m => m.naam === 'geheim veld');

/* Kanaries maken. Het kenmerk moet door gewone validatie komen (een e-mailadres
   moet op een e-mailadres lijken) en tegelijk nergens anders voorkomen. */
function maakKanaries(kenmerk) {
  const k = String(kenmerk);
  return {
    naam: 'Kanarie' + k + 'Slachtoffer',
    email: 'kanarie' + k + '@slachtoffer.test',
    telefoon: '06' + String(k).padStart(8, '4').slice(-8)
  };
}

function kanarieLijst(kanaries) {
  return [
    { naam: 'echte naam van een ander', waarde: kanaries.naam },
    { naam: 'e-mailadres van een ander', waarde: kanaries.email },
    { naam: 'telefoonnummer van een ander', waarde: kanaries.telefoon }
  ].filter(x => x.waarde && String(x.waarde).length >= 6);
}

/* HET OORDEEL.

   `gemeten: false` op alles wat geen 2xx is, en dat is geen tekortkoming maar
   de afbakening: een weigering is het werk van ACL (rolproef) en INPUT
   (invoerproef). Wie hier ook weigeringen zou wegen, bouwt een tweede waarheid
   naast die twee -- precies waar dit huis al een keer op is gestruikeld.

   `gemeten: true, lek: null` is dus een echte bewering: deze route heeft met de
   JUISTE rol een antwoord gegeven, en daar zat niets van iemand anders in. */
function weegUitvoer(status, lijf, kanaries) {
  if (!(status >= 200 && status < 300)) return { gemeten: false, lek: null };
  const tekst = typeof lijf === 'string' ? lijf : JSON.stringify(lijf == null ? '' : lijf);
  const geheim = geheimVeld(tekst);
  if (geheim) return { gemeten: true, lek: geheim };
  for (const k of kanarieLijst(kanaries || {})) {
    if (tekst.toLowerCase().includes(String(k.waarde).toLowerCase())) return { gemeten: true, lek: k.naam };
  }
  return { gemeten: true, lek: null };
}

/* De ronde. Zelfde vorm als draaiInvoerproef: de aanroeper levert post() en de
   tokens, wij leveren het oordeel per route.

   EEN ROUTE DIE NOOIT EEN 2xx GAF IS ONGEMETEN EN GEEN GROEN. Dat is de hele
   discipline van deze familie van proeven, en de reden dat 'poort' een eigen
   waarde is in plaats van stilzwijgend onder 'schoon' te vallen. */
async function draaiUitvoerproef({ post, routes, tokenVoor, lijfVoor, kanaries, hernieuw, maxPogingen }) {
  const perRoute = {};
  const bevindingen = { lekken: [], nooit2xx: [] };
  let pogingen = 0, hernieuwd = 0, gemeten = 0;

  for (const r of routes) {
    if (maxPogingen && pogingen >= maxPogingen) break;
    const sleutel = r.method + ' ' + r.pad;
    const bij = perRoute[sleutel] || (perRoute[sleutel] = { methode: r.method, pad: r.pad, rol: r.rol, uitvoer: 'poort' });

    let uit = await post(r.pad, lijfVoor(r), tokenVoor(r.rol));
    pogingen++;
    /* Een verlopen token levert 401 en dus 'poort' -- dat zou als ongemeten
       wegvallen terwijl de route prima te meten was. Eenmaal opnieuw inloggen. */
    if (uit.status === 401 && hernieuw && await hernieuw(r.rol)) {
      hernieuwd++;
      uit = await post(r.pad, lijfVoor(r), tokenVoor(r.rol));
      pogingen++;
    }

    const oordeel = weegUitvoer(uit.status, uit.data, kanaries);
    if (!oordeel.gemeten) { bevindingen.nooit2xx.push(sleutel + ' [' + uit.status + ']'); continue; }
    gemeten++;
    if (oordeel.lek) {
      bij.uitvoer = 'GEZAKT';
      const lijf = typeof uit.data === 'string' ? uit.data : JSON.stringify(uit.data || {});
      bevindingen.lekken.push(sleutel + ' [' + uit.status + '] ' + oordeel.lek + ': ' +
        lijf.slice(0, 160).replace(/\s+/g, ' '));
    } else {
      bij.uitvoer = 'schoon';
    }
  }

  return { perRoute, bevindingen, pogingen, hernieuwd, gemeten };
}

module.exports = { weegUitvoer, draaiUitvoerproef, maakKanaries, kanarieLijst,
  lijktGeheim, geheimVeld, GEHEIMWOORDEN, GEHEIMMERKER };
