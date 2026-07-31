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
   er alleen naar. */

const TTL_MS = 20 * 60 * 1000;
const MAX_GESPREKKEN = 500;
const MAX_BEURTEN = 30;

function maakGegevensgesprek({ accounts, gegevenspoort, saveMemberState, getMemberState, schoon }) {
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
    return 'Hiervoor moet je identiteit geverifieerd zijn. Dat doe je met je identiteitsbewijs in je profiel; daarna kan dit gewoon.';
  };

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
      viaVerificatie: !!eerste.viaVerificatie, nog: mist.length };
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
      const adres = schoon(tekst, 120);
      // een adres heeft op zijn minst een cijfer (huisnummer) en wat letters
      if (adres.length < 8 || !/\d/.test(adres) || !/[A-Za-zÀ-ÿ]/.test(adres)) {
        return { status: 200, tekst: 'Daar kan ik geen adres uit halen. Straat, huisnummer, postcode en plaats?', veld: 'adres' };
      }
      if (g.userId == null) return { status: 500, error: 'Kon het adres niet bewaren.' };
      const md = getMemberState(g.userId) || {};
      md.adres = adres;
      saveMemberState(g.userId, md);
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
      viaVerificatie: !!volgende.viaVerificatie, nog: g.wachtrij.length };
  }

  return { gegevensStart, gegevensZeg };
}

module.exports = { maakGegevensgesprek };
