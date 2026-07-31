/* Het aanmeld-pad van het aanmeldgesprek (kern/aanmeldgesprek.js): de stappen
   nadat Rahul heeft ontdekt dat iemand nieuw is. Aan het eind levert het precies
   de velden op die de ENE registratieroute al kent. De motor (aanmeldgesprek.js)
   roept dit aan voor alle niet-inlog-stappen; ctx bundelt de gedeelde hulp.

   Een gratis RTG-account vraagt VIER dingen: volledige naam, geboortedatum (de
   leeftijd bepaalt wat er opengaat), e-mailadres en een wachtwoord. Verder niets.
   Telefoonnummer, adres en paspoortgegevens horen hier NIET: die vraagt Rahul pas
   op het moment dat er iets geregeld moet worden waar een derde partij bij komt --
   een bestelling, een reservering, een bezorging. Wie alleen rondkijkt hoeft ze
   nooit te geven.

   Rahul spreekt hier kort. Aan de poort staat iemand die binnen wil, niet iemand
   die een gesprek zoekt: een zin per stap, geen uitweidingen. Op "waarom?" volgt
   het eerlijke antwoord uit WAAROM (./aanmeldgesprek-hulp.js); daar mag het iets
   langer, want dan is er om uitleg gevraagd. */

module.exports = function aanmeldStap(g, tekst, ruwTekst, id, ctx) {
  const { schoon, leeftijdVan, toon, gesprekken } = ctx;
  switch (g.stap) {
    case 'hallo': {
      g.stap = 'naam';
      const somber = /\b(slecht|niet zo|moe|druk|stress|rot)\b/i.test(tekst);
      const opening = somber ? 'Dank dat je het zegt. ' : toon(g, 'Mooi. ', 'Mooi zo! ');
      return { tekst: opening + 'Je volledige naam?' };
    }
    case 'naam': {
      const naam = schoon(tekst.replace(/^(ik ben|ik heet|mijn naam is)\s+/i, ''), 80);
      if (naam.length < 2 || !/[A-Za-zÀ-ÿ]/.test(naam)) return { tekst: 'Die naam lees ik niet goed. Hoe schrijf je hem?' };
      g.velden.name = naam;
      g.stap = 'email';
      /* Noemde iemand zijn woonplaats terloops, dan laat Rahul kort merken dat hij
         luisterde. Twee woorden is genoeg -- hij vraagt er nooit zelf om (een adres
         hoort bij een bestelling, niet bij de poort), maar wat je vertelt onthoudt
         hij wel. */
      const plek = g.velden.woonplaats ? g.velden.woonplaats + ', mooi. ' : '';
      return { tekst: 'Aangenaam, ' + naam.split(' ')[0] + '. ' + plek + 'Je e-mailadres?' };
    }
    case 'email': {
      const m = /[^@\s]+@[^@\s]+\.[^@\s]+/.exec(tekst);
      if (!m) return { tekst: 'Daar zie ik geen e-mailadres in. Voluit, met @?' };
      g.velden.email = m[0].toLowerCase();
      g.stap = 'geboren';
      return { tekst: 'Genoteerd. Je geboortedatum? Die bepaalt wat er voor je opengaat.' };
    }
    case 'geboren': {
      let d = null;
      let m = /(\d{4})-(\d{2})-(\d{2})/.exec(tekst);
      if (m) d = m[1] + '-' + m[2] + '-' + m[3];
      else if ((m = /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(tekst))) d = m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
      const lft = d ? leeftijdVan(d) : null;
      if (lft == null || lft > 120) return { tekst: 'Die datum kan ik niet plaatsen. Als dag-maand-jaar, bijvoorbeeld 14-03-1992?' };
      if (lft < 15) return { tekst: 'RTG kan vanaf 15 jaar. Tot die tijd is er de RTFoundation-wereld; die is er juist voor jou.' };
      g.velden.geboortedatum = d;
      g.stap = 'wachtwoord';
      const jong = lft < 18 ? 'Voor jouw leeftijd gelden beschermende regels; die regel ik. ' : '';
      return { tekst: jong + 'Tot slot een wachtwoord, minstens 6 tekens. Het gaat versleuteld de kluis in.' };
    }
    case 'wachtwoord': {
      if (tekst.length < 6) return { tekst: 'Net te kort; minstens 6 tekens.' };
      g.velden.password = String(ruwTekst).slice(0, 200);
      g.stap = 'klaar';
      g.velden.tier = 'rtg';
      const interesse = g.velden.interesse === 'business'
        ? ' Je noemde je bedrijf: de Business Pass gaat op uitnodiging; ik noteer je interesse, beloven kan ik niets.'
        : (g.velden.interesse === 'lifestyle' ? ' De Lifestyle Pass gaat op uitnodiging; ik noteer je interesse, beloven kan ik niets.' : '');
      // eerlijk: de werkgever wordt herkend en genoteerd, niet meer dan dat
      const werk = g.werkgever ? ' Je werkt bij ' + g.werkgever.naam + '; dat noteer ik.' : '';
      /* Alleen de vier velden. `phone` gaat hier NIET mee: dat vraagt Rahul pas
         wanneer er iets bezorgd of gereserveerd moet worden. */
      const velden = { name: g.velden.name, email: g.velden.email, geboortedatum: g.velden.geboortedatum, password: g.velden.password, tier: 'rtg' };
      const uit = { tekst: 'Klaar. Je RTG Pass staat op je naam.' + interesse + werk,
        klaar: true, velden, werkgever: g.werkgever, woonplaats: g.velden.woonplaats || null };
      gesprekken.delete(id);
      return uit;
    }
    default:
      return { tekst: 'Laten we opnieuw beginnen.' };
  }
};
