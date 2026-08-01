/* De identiteitsmap: de paspoortscans en selfies op schijf.

   Dit is het zwaarste wat RTG van iemand bewaart. De bestanden staan
   versleuteld (met ONZE sleutel, dus "versleuteld" betekent hier: onleesbaar
   voor wie de schijf steelt, niet voor ons) en zijn via /api/office/doc op naam
   op te vragen.

   ER GING TWEE KEER HETZELFDE MIS, EN ALLEBEI STIL.

   1. Elke upload schreef een NIEUW bestand met een tijdstempel in de naam, maar
      de database onthield er maar EEN: setVerification overschreef id_doc.
      Probeerde iemand drie keer een scherpere foto -- wat de afwijzingsmail
      letterlijk aanraadt -- dan bleven de eerste twee als wees achter, voorgoed,
      en gewoon opvraagbaar.
   2. Bij "verwijder mijn gegevens" wiste kern/vergeten.js precies dat ene
      onthouden bestand. De wezen bleven staan, en de SELFIE werd nooit gewist:
      die naam stond in member_state, en die rij verdween mee met het account
      voordat iemand hem gelezen had. Het antwoord was "ok: true".

   De oplossing zit in de naam. Elk bestand van een account heet <id>-...:
   <id>-<tijd>.<ext> voor een identiteitsbewijs, <id>-selfie-<tijd>.<ext> voor
   een selfie. De MAP is dus de administratie, niet de database -- en dat is
   precies wat je wilt, want een opruiming die afhangt van wat er toevallig nog
   in een kolom staat, ruimt alleen op wat niet kwijt is.

   Het koppelteken doet het scheidingswerk: account 5 matcht "5-", en "55-..."
   begint daar niet mee. Geen kans op andermans scan.

   Bijkomend effect, en niet het kleinste: doordat een nieuwe upload de vorige
   opruimt, staat er per account hooguit een bewijs en een selfie. Daarmee is
   ook de onbegrensde groei van deze map weg -- er was geen plafond, geen
   bewaartermijn en geen opruimtaak, en 5 MB per verzoek loopt hard op. */
const fs = require('fs');
const path = require('path');

function maakIdentiteitsmap(UPLOAD_DIR) {
  const veiligId = (id) => String(id).replace(/[^0-9]/g, '');

  function lijst() {
    try { return fs.readdirSync(UPLOAD_DIR); } catch (e) { return []; }
  }
  function wis(naam) {
    try { fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(naam))); return true; }
    catch (e) { return false; }
  }

  // een identiteitsbewijs: <id>-<tijd>.<ext>   (geen "selfie" ertussen)
  const isBewijs = (id) => new RegExp('^' + veiligId(id) + '-\\d+\\.[A-Za-z0-9]+$');
  // een selfie:              <id>-selfie-<tijd>.<ext>
  const isSelfie = (id) => new RegExp('^' + veiligId(id) + '-selfie-\\d+\\.[A-Za-z0-9]+$');
  // alles van dit account
  const isVanAccount = (id) => new RegExp('^' + veiligId(id) + '-');

  /* Houd alleen het nieuwste identiteitsbewijs. Aanroepen NA het schrijven van
     de nieuwe, zodat een mislukte schrijfactie niet ook het oude bewijs kost. */
  function houdAlleenBewijs(id, behoud) {
    const re = isBewijs(id);
    let weg = 0;
    for (const n of lijst()) if (re.test(n) && n !== behoud && wis(n)) weg++;
    return weg;
  }
  function houdAlleenSelfie(id, behoud) {
    const re = isSelfie(id);
    let weg = 0;
    for (const n of lijst()) if (re.test(n) && n !== behoud && wis(n)) weg++;
    return weg;
  }

  /* Vergetelheid: alles van dit account, wat de database er ook nog van weet.
     Bewust op de MAP en niet op de kolommen -- zie de kop van dit bestand. */
  function wisAllesVan(id) {
    const re = isVanAccount(id);
    let weg = 0;
    for (const n of lijst()) if (re.test(n) && wis(n)) weg++;
    return weg;
  }

  return { houdAlleenBewijs, houdAlleenSelfie, wisAllesVan };
}

module.exports = { maakIdentiteitsmap };
