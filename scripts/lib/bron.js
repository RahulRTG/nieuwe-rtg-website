/* BRONTEKST ONTDOEN VAN COMMENTAAR.

   Stond als losse functie in scripts/check.js en werd daar dertien keer
   gebruikt. Toen scripts/keuring.js hem ook nodig had, was de keuze: een kopie,
   of een plek. Een kopie is LAT.md regel 4 -- twee plekken die dezelfde waarheid
   vasthouden lopen uiteen, zeker als de tweede zich later "even" aanpast aan een
   nieuw geval.

   WAT HIJ WEL EN NIET DOET. Commentaar eruit, strings ERIN. Dat is bewust: elke
   keuring die hierop leunt zoekt naar wat de code aanroept, en dat staat in
   strings ('/api/bank/overzicht'). Wie strings ook weg wil hebben, heeft
   scripts/kruisscan.js nodig; wie de REGELNUMMERS heel wil houden heeft een
   derde vorm nodig (blokcommentaar wordt hier tot een spatie geplet). Die drie
   staan met reden uit elkaar; zie de kop van regel 29 in check.js.

   ============================================================================
   HIJ AT 224.031 TEKENS BRONCODE OP, EN NIEMAND ZAG HET

   Dit stond hier als twee regexen achter elkaar: eerst een niet-gulzige
   blokcommentaar-regex (van een opener tot de eerstvolgende sluiter), daarna een
   regelcommentaar-regex met uitzonderingen voor een dubbele punt en een quote
   ervoor. De git-historie van dit bestand heeft ze woordelijk.

   De eerste zoekt `/*` zonder te weten waar hij staat. En `/*` staat in dit huis
   op een hoop plekken die geen commentaar zijn:

     accept="image/*"                  18 bestanden met een fotoknop
     express.raw({ type: '*\/*' })     de betaal-webhook, in server/opzet/
     'serverkern (server/**\/*.js)'    een glob in scripts/samenhang.js
     t.startsWith('/*')                een string IN DEZE KEURING zelf
     // ... (alleen voor image/*)      een `/*` binnen een REGELcommentaar

   (De twee regels met `*\/` dragen een backslash die in de echte bron niet
   staat. Zonder die streep sluit het voorbeeld deze uitleg zelf af -- dezelfde
   fout, een verdieping hoger. Hij is hier gemaakt en niet bedacht.)

   Elk daarvan opende een commentaar dat pas eindigde bij de eerstvolgende
   sluiter -- soms tienduizenden tekens later. Gemeten over 4333 bestanden: 47
   bestanden waren deels onzichtbaar voor elke keuring die hierop leunt, samen
   224.031 tekens. De ergste drie:

     public/apps/leverancier.js    84.605 tekens weg
     public/apps/app.html          59.166 tekens weg  (784 regels markup + script)
     public/apps/websitestudio.html 16.429 tekens weg

   In app.html vielen daardoor twee <video>-elementen buiten het bereik van elke
   scanner, in server/opzet/kaartwebhooks.js 3.270 tekens serverbron met routes
   erin, en in scripts/check.js viel het staartstuk van regel 7 en het begin van
   regel 8 weg -- deze keuring keek dus niet naar zichzelf. Er was geen melding
   en geen afwijkende telling: precies de stille vorm van LAT.md regel 10, waar
   een meter niet "in orde" zegt maar "ik heb niet gekeken".

   DE OORZAAK, NIET HET GEVAL. Een MIME-uitzondering voor `image/*` erbij zetten
   had de vier andere vormen laten staan. De oorzaak is dat een
   commentaar-verwijderaar moet WETEN waar een string staat, ook als hij die
   string laat staan -- en dat een blokcommentaar niet mag beginnen binnen een
   regelcommentaar. Dus loopt hij nu een keer door de tekst, in volgorde, met
   drie standen: code, string, commentaar.

   EEN QUOTE IS PER REGEL BEGRENSD, EEN BACKTICK NIET. Deze functie krijgt ook
   HTML te lezen, en daar staat proza in ("pagina's", "'s ochtends"). Een losse
   apostrof mag dan hoogstens de rest van DIE REGEL verstoren en niet de rest van
   het bestand -- dezelfde soort schade als hierboven, alleen dan omgekeerd.

   Hier stond dat een meerregelige template literal met een openend
   commentaarteken erin daardoor nog steeds als commentaar werd gelezen, en dat
   dat "exact het oude gedrag" was zodat geen enkele keuring er blinder van
   werd. Dat eerste klopte; dat tweede niet. De meter die na 17 augustus is
   gebouwd (bronBlindeBestanden, zie ./bronblind.js) kruist deze functie met de
   lexer van de AST-scanner, en wees ZEVEN bestanden aan waar wel degelijk bron
   verdween -- allemaal CSS in een backtick-string met commentaar erin. Onschuldig
   in die zeven gevallen, want het IS commentaar, alleen van een andere taal;
   maar het mechanisme is precies dat van 17 augustus, en een template met een
   openende opener zonder sluiter erin eet wel door de echte code heen.

   Een backtick loopt daarom nu over regels en een quote niet, en dat is geen
   uitzondering op de regel hierboven maar de reden erachter, scherper gesteld:
   de grens per regel bestaat voor de apostrof in PROZA, en een backtick komt in
   proza niet voor. Nagemeten: de kruisproef gaat van zeven naar nul, geen enkele
   NORM-meter beweegt de verkeerde kant op, en de vangrail hieronder (nooit meer
   weghalen dan de oude regex) blijft staan.

   GEMETEN, NIET AANGENOMEN: over alle 4333 bestanden ziet deze versie 224.031
   tekens MEER en 0 tekens minder dan de vorige. De richting is dus eenzijdig.
   test/bron.test.js houdt de vijf vormen hierboven vast, elk met de mutatie
   erbij die hem laat zakken.
*/
'use strict';

function zonderCommentaar(bron) {
  const s = String(bron);
  const n = s.length;
  let uit = '';
  let i = 0;
  while (i < n) {
    const c = s[i];
    /* Blokcommentaar. Zonder afsluiting is de rest van het bestand commentaar --
       dat is wat een JS-parser er ook van maakt. */
    if (c === '/' && s[i + 1] === '*') {
      const eind = s.indexOf('*/', i + 2);
      uit += ' ';
      if (eind < 0) break;
      i = eind + 2;
      continue;
    }
    /* Regelcommentaar. De uitzonderingen komen uit de vorige versie: `http://`
       (voorafgegaan door een dubbele punt) en een `//` direct achter een quote
       of backslash zijn geen commentaar. */
    if (c === '/' && s[i + 1] === '/') {
      const voor = i > 0 ? s[i - 1] : '';
      if (voor !== ':' && voor !== '"' && voor !== "'" && voor !== '\\') {
        const nl = s.indexOf('\n', i);
        if (nl < 0) break;
        i = nl;
        continue;
      }
    }
    /* EEN REGEXLITERAAL IS EEN VIERDE STAND, en hij ontbrak.

       Deze functie kende code, string en commentaar. Een regex is geen van
       drieen, en er staan er honderden in dit huis met QUOTES erin:

           .replace(/^['\"`]|['\"`]$/g, '')      in scripts/lib/staatscan.js
           .replace(/^Je bent \"[^\"]+\"/, ...)    in server/foundation/buddy.js

       Zonder deze stand las hij die quotes als een string die begint. De
       apostrof-grens houdt de schade dan nog binnen een regel -- maar een
       BACKTICK in een tekenklasse loopt met opzet over regels, en die at hier
       een heel commentaarblok op. Gevolg: het commentaar bleef STAAN in de
       uitvoer, en keuring 7 las de zin "wie `const { DATA_DIR } =
       require('./opslag')` schrijft" als code en meldde een kapot pad dat
       nergens wordt aangeroepen.

       Dat is de spiegel van 17 augustus. Toen verdween er code; nu bleef er
       commentaar staan. De kruisproef in ./bronblind.js bewaakt alleen die
       eerste richting (elke token van de lexer hoort in de uitvoer te staan),
       dus deze kant kwam er ongemerkt doorheen -- precies zoals de kop hierboven
       waarschuwt dat een zesde vorm dat zou doen.

       De vraag "regex of deling" beantwoordt een lexer met het vorige token.
       Hier volstaat het laatste betekenisvolle teken: staat er een naam, een
       cijfer, of een sluiter (`)`, `]`) voor, dan is het een DELING; in alle
       andere gevallen (na `=`, `(`, `,`, `:`, `!`, `&&`, `return`) begint een
       regex. Net als een quote loopt hij tot het einde van de regel en niet
       verder, zodat een verkeerde gok hoogstens EEN regel kan verstoren en nooit
       het bestand. De tekenklasse telt mee: een `/` binnen [...] sluit niet af. */
    if (c === '/') {
      let k = uit.length - 1;
      while (k >= 0 && /\s/.test(uit[k])) k--;
      const vorige = k >= 0 ? uit[k] : '';
      const isDeling = /[\w$)\]]/.test(vorige);
      if (!isDeling) {
        let j = i + 1, inKlasse = false, dicht = -1;
        while (j < n && s[j] !== '\n') {
          const d = s[j];
          if (d === '\\') { j += 2; continue; }
          if (d === '[') inKlasse = true;
          else if (d === ']') inKlasse = false;
          else if (d === '/' && !inKlasse) { dicht = j; break; }
          j++;
        }
        /* `dicht > i + 1` en niet `> i`: `//` zou anders een lege regex zijn.
           NIET GETOETST, en dat staat er liever dan een toets die niet kan
           zakken (LAT-regel 9): ik heb geen bereikbaar geval kunnen bouwen --
           de regelcommentaar-tak hierboven vangt `//` al af, en de gevallen die
           daar doorheen komen (`http://`) staan altijd in een string, die weer
           eerder wordt afgehandeld. Het is een vangrail, geen gedrag. */
        if (dicht > i + 1) {
          let e = dicht + 1;
          while (e < n && /[a-z]/.test(s[e])) e++;  // de vlaggen: g, i, m, s, u, y
          uit += s.slice(i, e);
          i = e;
          continue;
        }
      }
    }
    /* Een string blijft staan, maar wordt wel OVERGESLAGEN: wat er binnenin
       staat is geen commentaar. Sluit hij niet op dezelfde regel, dan is het
       vermoedelijk geen string maar een apostrof in proza; dan gaat alleen dit
       teken mee en lezen we verder als code. */
    if (c === '"' || c === "'" || c === '`') {
      /* EEN BACKTICK MAG WEL OVER REGELS LOPEN, en dat is geen uitzondering op
         de regel hierboven maar de reden ERACHTER, scherper gesteld. De grens
         per regel bestaat om de apostrof in proza ("pagina's") hoogstens EEN
         regel te laten verstoren. Een backtick komt in proza niet voor; hij is
         in JavaScript altijd een template literal, en die loopt per definitie
         vaak over regels.

         Dat het oude gedrag hier geen enkele keuring blinder maakte, klopte
         niet helemaal: zeven bestanden raakten er wel degelijk bron door kwijt
         (de meter bronBlindeBestanden telde ze). Het gaat om CSS in een
         backtick-string met commentaar erin -- vandaag onschuldig, want het IS
         commentaar, alleen van een andere taal. Maar het mechanisme is precies
         dat van 17 augustus: een template met een openende /* zonder sluiter
         erin eet wel degelijk door de echte code heen. */
      const meerRegelig = c === '`';
      let j = i + 1;
      while (j < n && s[j] !== c && (meerRegelig || s[j] !== '\n')) { if (s[j] === '\\') j++; j++; }
      if (j < n && s[j] === c) { uit += s.slice(i, j + 1); i = j + 1; continue; }
    }
    uit += c;
    i++;
  }
  return uit;
}

module.exports = { zonderCommentaar };
