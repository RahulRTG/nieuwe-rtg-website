/* Kern-module "gegevensgesprek": Rahul vraagt in een gesprek precies wat er voor
   deze ene handeling nodig is, en niet meer.

   Waarom een vaste stappenmachine en niet de vrije AI: wat hier gevraagd wordt
   gaat de kluis in en bepaalt of een bestelling doorgaat. Dat moet elke keer
   hetzelfde gaan, toetsbaar zijn, en nooit iets anders vragen dan de poort zegt.
   Rahul klinkt hier dus als Rahul, maar hij improviseert niet.

   Hij spreekt kort, net als aan de poort: een zin per veld. Op "waarom?" volgt het
   eerlijke antwoord uit de gegevenspoort. Overslaan kan niet -- niet uit
   onvriendelijkheid, maar omdat de handeling zonder die gegevens gewoon niet kan;
   afbreken kan altijd, en dan gaat de bestelling simpelweg niet door.

   Wat waar landt: het telefoonnummer in de kluis (enc_phone, gebonden aan de rij),
   het adres in het ledendossier (member_state.adres, versleuteld en gebonden).
   Identiteit loopt NIET hier maar via de bestaande verificatie; dit gesprek wijst
   er alleen naar.

   EN DE WOONPLAATS GAAT MEE, want die had nog een tweede lezer. Het
   ledenregister van het kantoor toont leden per stad en haalt die stad uit het
   onboardingprofiel (kern/ledenregister.js leest p.velden.woonplaats). De intake
   vroeg hem vroeger; sinds de velden een moment dragen doet hij dat niet meer, en
   daarmee is DEZE stap de enige voeding die er nog is. Schrijft hij de woonplaats
   niet mee, dan valt elk nieuw lid stil in de bak "Onbekend" en klaagt niets --
   precies de stille soort van LAT.md regel 5. Hij wordt geschreven met dezelfde
   functie waarmee de intake dat deed (onboarding.slaOp), zodat er maar een
   schrijver is. */

const TTL_MS = 20 * 60 * 1000;
const MAX_GESPREKKEN = 500;
const MAX_BEURTEN = 30;

/* De plaats uit wat het lid ZELF typte: een letterlijk stuk van zijn eigen zin,
   nooit iets bijgeschaafd of aangevuld. Twee vormen die zeker zijn -- achter een
   Nederlandse postcode, of het laatste stuk achter een komma als daar alleen
   letters in staan. Twijfel is geen uitkomst: kunnen we hem niet met zekerheid
   aanwijzen (een buitenlands adres, "Damstraat 5 Berlijn"), dan RADEN we niet
   maar vragen we het gewoon. Een verzonnen woonplaats is erger dan een lege. */
const PLAATS_KERN = "[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'. -]{1,38}";   // een plaatsnaam, een keer beschreven
const PLAATS = new RegExp('^' + PLAATS_KERN + '$');
const NA_POSTCODE = new RegExp('\\b[1-9]\\d{3}\\s*[A-Za-z]{2}\\b[,\\s]+(' + PLAATS_KERN + ')$');
function plaatsUit(adres) {
  const s = String(adres || '').trim();
  const m = NA_POSTCODE.exec(s);
  if (m) return m[1].trim();
  const delen = s.split(',');
  const laatste = delen.length > 1 ? delen[delen.length - 1].trim() : '';
  return PLAATS.test(laatste) ? laatste : null;
}

function maakGegevensgesprek({ accounts, gegevenspoort, saveMemberState, getMemberState, schoon, onboarding }) {
  const gesprekken = new Map();   // id -> { key, userId, soort, wachtrij, at, beurten }
  const nu = () => Date.now();

  function opruimen() {
    if (gesprekken.size < MAX_GESPREKKEN) return;
    for (const [id, g] of gesprekken) if (nu() - g.at > TTL_MS) gesprekken.delete(id);
    while (gesprekken.size >= MAX_GESPREKKEN) gesprekken.delete(gesprekken.keys().next().value);
  }

  const vraagVan = (m) => {
    if (m.veld === 'telefoon') return 'Waar kan de zaak je bereiken? Je telefoonnummer.';
    if (m.veld === 'adres') return 'Waar mag het heen? Straat, huisnummer, postcode en plaats.';
    /* Het reisdocument vraagt hij NIET uit in dit gesprek, en dat is geen
       gemakzucht. De strook onderaan een paspoort bevat nummer, geldigheid,
       nationaliteit en geboortedatum in een keer (shared/mrz.js leest hem al);
       diezelfde vier met de hand laten intypen is trager en levert tikfouten op
       in precies de gegevens waarop je aan de balie wordt afgerekend. Hij wijst
       dus naar de scan, en zegt erbij van wie die eis komt. */
    if (m.veld === 'reisdocument') return 'Voor deze vlucht wil de maatschappij je paspoortgegevens: nummer, geldigheid, nationaliteit en geboortedatum. Dat is hun eis, niet de onze. Scan je paspoort een keer, dan staat het er meteen goed.';
    return 'Hiervoor moet je identiteit geverifieerd zijn. Dat doe je met je identiteitsbewijs in je profiel; daarna kan dit gewoon.';
  };

  // het adreswerk staat apart: zie ./gegevensgesprek/adres.js
  const { maakAdreshulp } = require('./gegevensgesprek/adres');
  const { bewaarAdres } = maakAdreshulp({ onboarding });

  /* Start: kijk wat er voor deze soort handeling ontbreekt en vraag het eerste. */
  function gegevensStart(sessie, soort) {
    const mist = gegevenspoort.ontbreekt(sessie, String(soort || ''));
    if (!mist.length) return { status: 200, klaar: true, tekst: 'Ik heb alles al; ga je gang.' };
    opruimen();
    const id = 'gg' + nu().toString(36) + Math.random().toString(36).slice(2, 8);
    gesprekken.set(id, {
      key: sessie.key, userId: sessie.account ? sessie.account.id : null,
      soort: String(soort || ''), wachtrij: mist, at: nu(), beurten: 0
    });
    const eerste = mist[0];
    return { status: 200, id, tekst: vraagVan(eerste), veld: eerste.veld,
      viaVerificatie: !!eerste.viaVerificatie, viaScan: !!eerste.viaScan, nog: mist.length };
  }

  /* Een antwoord verwerken. Klopt het, dan gaat het de kluis in en volgt het
     volgende veld; is alles binnen, dan meldt hij dat de handeling door kan. */
  function gegevensZeg(sessie, id, ruw) {
    const g = gesprekken.get(String(id || ''));
    if (!g) return { status: 404, error: 'Dit gesprek ken ik niet (meer). Begin gerust opnieuw.' };
    if (g.key !== sessie.key) return { status: 403, error: 'Dit gesprek is niet van jou.' };
    if (++g.beurten > MAX_BEURTEN) { gesprekken.delete(id); return { status: 429, error: 'Dit duurde wel erg lang; begin even opnieuw.' }; }
    g.at = nu();
    const tekst = schoon(String(ruw || ''), 200);
    const huidig = g.wachtrij[0];
    if (!huidig) { gesprekken.delete(id); return { status: 200, klaar: true, tekst: 'Alles staat er.' }; }

    if (/\b(waarom|hoezo|waarvoor)\b/i.test(tekst)) return { status: 200, tekst: huidig.waarom, veld: huidig.veld };
    if (/\b(stop|laat maar|annuleer|toch niet)\b/i.test(tekst)) {
      gesprekken.delete(id);
      return { status: 200, gestopt: true, tekst: 'Prima, dan laten we het hierbij. Zonder deze gegevens gaat het alleen niet door.' };
    }

    if (huidig.veld === 'telefoon') {
      const cijfers = tekst.replace(/\D/g, '');
      if (cijfers.length < 8) return { status: 200, tekst: 'Dat lijkt me te kort voor een telefoonnummer. Voluit?', veld: 'telefoon' };
      const nummer = tekst.replace(/[^\d+ ]/g, '').trim().slice(0, 30);
      if (g.userId == null || !accounts.setPhone) return { status: 500, error: 'Kon het nummer niet bewaren.' };
      accounts.setPhone(g.userId, nummer);
    } else if (huidig.veld === 'adres') {
      if (g.wachtPlaats) {
        /* De tweede helft van de adresstap: de plaats, omdat we hem niet met
           zekerheid uit de vorige zin konden halen. */
        const plaats = schoon(tekst, 40);
        if (!PLAATS.test(plaats)) return { status: 200, tekst: 'Daar lees ik geen plaatsnaam in. Alleen de plaats?', veld: 'adres' };
        g.wachtPlaats = false;
        bewaarAdres(sessie, g.adres, plaats);
      } else {
        const adres = schoon(tekst, 120);
        // een adres heeft op zijn minst een cijfer (huisnummer) en wat letters
        if (adres.length < 8 || !/\d/.test(adres) || !/[A-Za-zÀ-ÿ]/.test(adres)) {
          return { status: 200, tekst: 'Daar kan ik geen adres uit halen. Straat, huisnummer, postcode en plaats?', veld: 'adres' };
        }
        if (g.userId == null) return { status: 500, error: 'Kon het adres niet bewaren.' };
        const md = getMemberState(g.userId) || {};
        md.adres = adres;
        saveMemberState(g.userId, md);
        const plaats = plaatsUit(adres);
        if (!plaats) {
          g.adres = adres; g.wachtPlaats = true;
          return { status: 200, tekst: 'Genoteerd. In welke plaats is dat?', veld: 'adres' };
        }
        bewaarAdres(sessie, adres, plaats);
      }
    } else if (huidig.veld === 'reisdocument') {
      /* Dit gesprek lost het reisdocument niet op, en dat is met opzet: getypte
         paspoortgegevens zijn precies het soort veld waar een tikfout je aan de
         balie laat stranden. De scan leest de vier gegevens in een keer goed.
         viaScan zegt het scherm dat het de scanner moet openen, zoals
         viaVerificatie dat voor de identiteitscontrole doet. */
      return { status: 200, viaScan: true, veld: 'reisdocument',
        tekst: 'Dit gaat met de scanner, niet met typen: houd de onderste twee regels van je paspoort voor de camera, dan staan nummer, geldigheid, nationaliteit en geboortedatum er in een keer goed.' };
    } else {
      // identiteit: dit gesprek lost dat niet op, en dat zeggen we eerlijk
      return { status: 200, viaVerificatie: true, veld: 'identiteit',
        tekst: 'Dit regel je met je identiteitsbewijs in je profiel; zodra dat is goedgekeurd, kan het gewoon.' };
    }

    g.wachtrij.shift();
    if (!g.wachtrij.length) {
      gesprekken.delete(id);
      return { status: 200, klaar: true, tekst: 'Genoteerd. Ga je gang.' };
    }
    const volgende = g.wachtrij[0];
    return { status: 200, tekst: 'Genoteerd. ' + vraagVan(volgende), veld: volgende.veld,
      viaVerificatie: !!volgende.viaVerificatie, viaScan: !!volgende.viaScan, nog: g.wachtrij.length };
  }

  return { gegevensStart, gegevensZeg };
}

module.exports = { maakGegevensgesprek };
