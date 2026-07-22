/* Het aanmeld-pad van het aanmeldgesprek (kern/aanmeldgesprek.js): de stappen
   nadat Rahul heeft ontdekt dat iemand nieuw is, van "hoe gaat het" tot het
   wachtwoord. Aan het eind levert het precies de velden op die de ENE
   registratieroute al kent. De motor (aanmeldgesprek.js) roept dit aan voor
   alle niet-inlog-stappen; ctx bundelt de gedeelde hulp. */

module.exports = function aanmeldStap(g, tekst, ruwTekst, id, ctx) {
  const { schoon, leeftijdVan, toon, gesprekken } = ctx;
  switch (g.stap) {
    case 'hallo': {
      g.stap = 'naam';
      const somber = /\b(slecht|niet zo|moe|druk|stress|rot)\b/i.test(tekst);
      const opening = somber
        ? 'Dank dat je dat gewoon zegt; dat hoeft hier niet mooier dan het is. '
        : toon(g, 'Goed om te horen. ', 'Mooi zo! ');
      return { tekst: opening + 'Hoe mag ik je noemen? Je volledige naam graag, zoals in je paspoort; in de app krijg je gewoon een codenaam.' };
    }
    case 'naam': {
      const naam = schoon(tekst.replace(/^(ik ben|ik heet|mijn naam is)\s+/i, ''), 80);
      if (naam.length < 2 || !/[A-Za-zÀ-ÿ]/.test(naam)) return { tekst: 'Die naam kan ik niet goed lezen; hoe staat hij in je paspoort?' };
      g.velden.name = naam;
      g.stap = 'email';
      const voornaam = naam.split(' ')[0];
      return { tekst: 'Aangenaam, ' + voornaam + (g.velden.woonplaats ? '. En ' + g.velden.woonplaats + ', mooie plek' : '') + '. Waar mag ik je bevestiging naartoe sturen? Een e-mailadres is genoeg.' };
    }
    case 'email': {
      const m = /[^@\s]+@[^@\s]+\.[^@\s]+/.exec(tekst);
      if (!m) return { tekst: 'Ik zie er geen e-mailadres in; typ hem even voluit (met @).' };
      g.velden.email = m[0].toLowerCase();
      g.stap = 'telefoon';
      return { tekst: toon(g, 'Genoteerd. ', 'Staat erin! ') + 'En een mobiel nummer? Dat is voor herstel en belangrijke seintjes, niet voor spam.' };
    }
    case 'telefoon': {
      const cijfers = tekst.replace(/\D/g, '');
      if (cijfers.length < 8) return { tekst: 'Dat lijkt me te kort voor een mobiel nummer; typ hem even helemaal.' };
      g.velden.phone = tekst.replace(/[^\d+ ]/g, '').trim().slice(0, 30);
      // de woonplaats: het liefst kwam hij al terloops voorbij; zo niet,
      // dan een keer subtiel vragen, met de reden erbij, en overslaan mag
      if (!g.velden.woonplaats) {
        g.stap = 'woonplaats';
        return { tekst: toon(g, 'Dank je. ', 'Top. ') + 'En waar woon je zoal? Alleen de plaats; dat helpt me straks met reistijden en aanraders in de buurt. Liever niet zeggen is ook gewoon goed.' };
      }
      g.stap = 'geboren';
      return { tekst: 'Dan de enige echt formele vraag: wanneer ben je geboren, precies zoals in je paspoort? (Vraag gerust waarom.)' };
    }
    case 'woonplaats': {
      const slaatOver = /\b(overslaan|liever niet|zeg ik (liever )?niet|priv[eé]|gaat je niks aan|skip)\b/i.test(tekst);
      if (!slaatOver && !g.velden.woonplaats) {
        // een kale plaatsnaam is ook een antwoord ("Ibiza", "Den Haag")
        const kaal = schoon(tekst.replace(/^(in|uit|ik woon in|gewoon)\s+/i, '').replace(/[.,!?].*$/, ''), 40);
        if (/^[A-Za-zÀ-ÿ' -]{2,40}$/.test(kaal)) g.velden.woonplaats = kaal;
      }
      g.stap = 'geboren';
      const dank = slaatOver || !g.velden.woonplaats
        ? 'Helemaal goed, hoort er niet per se bij. '
        : (g.velden.woonplaats + ', mooi. ');
      return { tekst: dank + 'Dan de enige echt formele vraag: wanneer ben je geboren, precies zoals in je paspoort? (Vraag gerust waarom.)' };
    }
    case 'geboren': {
      let d = null;
      let m = /(\d{4})-(\d{2})-(\d{2})/.exec(tekst);
      if (m) d = m[1] + '-' + m[2] + '-' + m[3];
      else if ((m = /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(tekst))) d = m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
      const lft = d ? leeftijdVan(d) : null;
      if (lft == null || lft > 120) return { tekst: 'Die datum kan ik niet plaatsen; schrijf hem als dag-maand-jaar, bijvoorbeeld 14-03-1992.' };
      if (lft < 15) return { tekst: 'Eerlijk is eerlijk: het RTG-lidmaatschap kan vanaf 15 jaar. Tot die tijd is er de RTFoundation-wereld; die is er juist voor jou.' };
      g.velden.geboortedatum = d;
      g.stap = 'wachtwoord';
      return { tekst: (lft < 18 ? 'Dank je. Voor jouw leeftijd gelden beschermende regels; die regel ik automatisch goed. ' : 'Dank je. ') + 'Kies tot slot een wachtwoord van minstens 6 tekens. Het gaat versleuteld de kluis in; ik kan het zelf niet teruglezen.' };
    }
    case 'wachtwoord': {
      if (tekst.length < 6) return { tekst: 'Net te kort; minstens 6 tekens. Een zinnetje werkt vaak het best.' };
      g.velden.password = String(ruwTekst).slice(0, 200);
      g.stap = 'klaar';
      g.velden.tier = 'rtg';
      const interesse = g.velden.interesse === 'business'
        ? ' Je noemde je bedrijf: de Business Pass gaat op uitnodiging of na menselijke goedkeuring, dus die kan en wil ik je niet beloven; ik noteer je interesse eerlijk en dan hoor je ervan.'
        : (g.velden.interesse === 'lifestyle' ? ' De Lifestyle Pass gaat op uitnodiging; ik noteer je interesse, beloven kan ik niets.' : '');
      const werk = g.werkgever
        ? ' En je zei dat je bij ' + g.werkgever.naam + ' werkt: na je aanmelding koppel ik je personeelstoegang, met je eigen pincode als bewijs.'
        : '';
      const velden = { name: g.velden.name, email: g.velden.email, phone: g.velden.phone, geboortedatum: g.velden.geboortedatum, password: g.velden.password, tier: 'rtg' };
      const uit = { tekst: 'Dat was alles; geen formulier aan te pas gekomen. Ik zet je aanmelding door voor de RTG Pass; welk type account je nodig had, heb ik onderweg gewoon voor je bepaald.' + interesse + werk,
        klaar: true, velden, werkgever: g.werkgever, woonplaats: g.velden.woonplaats || null };
      gesprekken.delete(id);
      return uit;
    }
    default:
      return { tekst: 'Zullen we opnieuw beginnen? Dat praat makkelijker.' };
  }
};
