/* RTMAIL (deelmodule): het adres per lidmaatschap.

   Tot nu toe had iedereen hetzelfde domein: "<code>@rtmail". Dat werkte, maar
   het zei niets. Vanaf nu draagt het adres zelf welk huis je hoort:

     rahultravelgroup.rtg        RTG-personeel en het kantoor
     rahultravelfoundation.rtg   RTFoundation, leden en personeel
     rtgpass.rtg                 leden met de RTG Pass
     business.rtg                leden met de Business Pass
     lifestyle.rtg               leden met de Lifestyle Pass
     partner.rtg                 partners en leveranciers
     gouvernement.rtg            overheid

   DRIE REGELS DIE HIER NIET ONDERHANDELBAAR ZIJN:

   1. HET LINKERDEEL VAN EEN LEDENADRES IS DE CODENAAM, NOOIT DE ECHTE NAAM.
      Een adres reist: het belandt in andermans postvak en blijft daar staan.
      Zou er een echte naam in staan, dan was het codenaam-ontwerp (accounts.js,
      de gescheiden kluis) voor iedereen die ooit post kreeg meteen omzeild.
      Voor PERSONEEL, ZAKEN en OVERHEID ligt dat anders: dat zijn functionele
      identiteiten die naar buiten toe al openbaar zijn -- een zaak handelt onder
      haar naam, een ambtenaar handelt in een functie. Daar is het linkerdeel dus
      de werknaam of de zaakcode, precies zoals je hem op een visitekaartje zet.

   2. JE OUDE ADRES BLIJFT WERKEN. Wie van de RTG Pass naar de Lifestyle Pass
      gaat, krijgt een nieuw adres -- maar post aan het oude adres komt gewoon
      aan. Een lidmaatschap dat verandert mag geen post laten verdwijnen. Dat
      geldt ook voor het oude "@rtmail" uit de tijd voor deze ronde.
      Technisch: het POSTVAK hangt aan het linkerdeel; het domein zegt welk huis.

   3. HET DOMEIN WORDT AFGELEID, NOOIT GEKOZEN. Je kunt jezelf geen
      "@rahultravelgroup.rtg" geven door het in te typen: het volgt uit je pas en
      je bewezen rollen (kern/eenaccount.js). Anders was het adres een bewering
      in plaats van een feit -- precies de fout die Metier ook al weigert. */

// De enige lijst; wie er een domein bij wil, doet het hier en nergens anders.
const DOMEINEN = {
  personeel: 'rahultravelgroup.rtg',
  kantoor: 'rahultravelgroup.rtg',
  rtf: 'rahultravelfoundation.rtg',
  rtg: 'rtgpass.rtg',
  business: 'business.rtg',
  lifestyle: 'lifestyle.rtg',
  zaak: 'partner.rtg',
  overheid: 'gouvernement.rtg'
};
// Het domein van vóór deze ronde. Blijft geldig, voor altijd: er ligt post op.
const OUD = 'rtmail';
const ALLE = Object.values(DOMEINEN).concat([OUD]);

/* Het linkerdeel. Spaties worden streepjes, hoofdletters worden klein, en wat
   niet in een adres hoort valt weg. "Gouden Panter" wordt "gouden-panter". */
function lokaalVan(naam) {
  const s = String(naam == null ? '' : naam).trim().toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9.-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '');
  return s.slice(0, 40);
}

const domeinVoor = (soort) => DOMEINEN[String(soort || '').toLowerCase()] || DOMEINEN.rtg;

/* Namen die het huis zelf gebruikt. Niemand krijgt ze, want dan zou zijn postvak
   samenvallen met dat van de systeem-afzender (rtg@rtmail). Wie zo heet, krijgt
   er een streepje en zijn soort achter -- lelijk noch verwarrend, en van hem. */
const GERESERVEERD = ['rtg', 'rtmail', 'postmaster', 'systeem', 'admin', 'noreply'];

/* Een adres opbouwen. `soort` komt uit de pas of de rol, `naam` is de codenaam
   (lid) of de werknaam/zaakcode (personeel, zaak, overheid). */
function adresVoor(soort, naam) {
  let l = lokaalVan(naam);
  if (!l) return '';
  if (GERESERVEERD.includes(l)) l = lokaalVan(l + '-' + soort);
  return l + '@' + domeinVoor(soort);
}

/* Een adres uit elkaar halen. `binnenshuis` zegt of het domein van ons is --
   alles daarbuiten is per definitie onvertrouwd (zie kern/rtmail.js). */
function ontleed(adres) {
  const s = String(adres == null ? '' : adres).trim().toLowerCase();
  const i = s.lastIndexOf('@');
  const lokaal = lokaalVan(i < 0 ? s : s.slice(0, i));
  const domein = i < 0 ? OUD : s.slice(i + 1).replace(/[^a-z0-9.-]/g, '');
  const binnenshuis = ALLE.includes(domein);
  const soort = Object.keys(DOMEINEN).find(k => DOMEINEN[k] === domein) || null;
  return { lokaal, domein, binnenshuis, soort, adres: lokaal ? lokaal + '@' + domein : '' };
}

/* De vergelijkingssleutel van een linkerdeel: zonder streepjes en punten.

   WAAROM DIT MOET. De normalisatie van vóór deze ronde WISTE spaties
   ("Saffieren Ooievaar" werd "saffierenooievaar"), de nieuwe maakt er streepjes
   van ("saffieren-ooievaar") omdat dat leesbaar is op een visitekaartje. Zonder
   deze sleutel zou post die onder het oude schema bezorgd is in een ander
   postvak liggen dan het nieuwe adres -- precies de belofte die deze module
   doet, gebroken. Een toets ving dat; vandaar dat het hier expliciet staat.

   Het risico is theoretisch: twee identiteiten die alleen in streepjes
   verschillen zouden samenvallen. Codenamen worden gegenereerd met een eigen
   hex-staart, dus dat kan niet botsen. */
const sleutel = (lokaal) => String(lokaal || '').replace(/[.-]/g, '');

/* Twee adressen zijn hetzelfde postvak als het linkerdeel gelijk is en beide
   domeinen van ons huis zijn. Zo blijft post aan je oude pas gewoon aankomen.
   Van buiten het huis is niets hetzelfde als iets binnen: dat zou een vreemde
   toegang tot een postvak geven. */
function zelfdeBus(a, b) {
  const x = ontleed(a), y = ontleed(b);
  if (!x.lokaal || !y.lokaal) return false;
  if (!x.binnenshuis || !y.binnenshuis) return x.adres === y.adres;
  return sleutel(x.lokaal) === sleutel(y.lokaal);
}

/* Van een sessie of een rol naar de soort. De volgorde is met opzet: een
   BEWEZEN rol weegt zwaarder dan een pas, want die is met een PIN of een
   bedrijfsinlog aangetoond (kern/eenaccount.js), terwijl een pas gewoon een
   lidmaatschap is. Wie bij RTG werkt EN een RTG Pass heeft, krijgt dus het
   werkadres -- dat is het adres waarop hij aanspreekbaar is. */
function soortVoor({ tier, rollen, handle } = {}) {
  const r = Array.isArray(rollen) ? rollen.map(x => (x && x.rol) || x) : [];
  if (r.includes('kantoor')) return 'kantoor';
  if (r.includes('personeel')) return 'personeel';
  if (r.includes('zaak')) return 'zaak';
  if (typeof handle === 'string' && handle.startsWith('rtf:')) return 'rtf';
  const t = String(tier || '').toLowerCase();
  return DOMEINEN[t] ? t : 'rtg';
}

module.exports = { DOMEINEN, OUD, ALLE, GERESERVEERD, lokaalVan, domeinVoor, adresVoor, ontleed, zelfdeBus, soortVoor };
