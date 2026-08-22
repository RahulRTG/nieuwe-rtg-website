/* HOE EEN AANMELDING ONTSTAAT, EN HOE HIJ ERUITZIET.

   ../aanmeldingen.js is de LEVENSLOOP: de wachtrij, de menselijke ja of nee, het
   aftekenen van een termijn, het klaarzetten van de zaak. Dit bestand gaat over
   de eerste stap en over de vorm: de reis opbouwen in de toon van de pas, de
   aanmelding aanmaken, en het beeld dat een scherm te zien krijgt.

   DE POORT VAN HET MERK STAAT HIER MET NAAM. Lifestyle en Business gaan
   uitsluitend na menselijke goedkeuring of op uitnodiging. De AANVRAAG mag
   altijd binnenkomen -- de reis is voorbereiding en geen toelating, en de AI
   belooft niets -- maar alleen `beslis()` door een mens kent een pas toe. Zie
   CLAUDE.md: de AI mag nooit zelf toegang beloven of verlenen.

   HET ACCOUNT-ID KOMT UITSLUITEND UIT HET GEVERIFIEERDE TOKEN via de route, en
   nooit uit de body. Anders tilde je met een aanvraag andermans account op. */
'use strict';

module.exports = ({ A, PASSEN, REIS, accounts, bedrijfMod, kap, nu, rid, save }) => {

  // De geautomatiseerde reis opbouwen in de toon van de pas. Elke stap is meteen
  // 'gedaan': de AI verzorgt hem automatisch. Alleen het besluit blijft open.
  function bouwReis(stem) {
    const t = nu();
    return REIS.map(s => ({ id: s.id, naam: s.naam, tekst: stem === 'u' ? s.u : s.je, auto: true, at: t }));
  }

  function beeld(a) {
    return { id: a.id, pas: a.pas, pasNaam: (PASSEN[a.pas] || {}).naam || a.pas,
      naam: a.naam, contact: a.contact, status: a.status,
      reis: a.reis, welkom: a.welkom, viaUitnodiging: !!a.viaUitnodiging,
      gekoppeld: !!a.accountId,  // account gekoppeld? dan tilt een akkoord het op
      bedrijf: a.bedrijf || null, gezaakt: a.gezaakt || null,
      besluit: a.besluit || null, at: a.at, bijgewerkt: a.bijgewerkt };
  }

  /* Een nieuwe aanmelding. De AI verzorgt meteen de hele reis (berichten,
     onboarding-bevestiging, rondleiding, RTF, veiligheid, privacy). De status
     komt op 'in behandeling': klaar voor de menselijke ja of nee. Voor Lifestyle
     en Business wordt NOOIT toegang beloofd of gezet -- de reis is voorbereiding,
     geen toelating. */
  function aanvraag(b, aanvragerId) {
    b = b || {};
    const pas = String(b.pas || '');
    const def = PASSEN[pas];
    if (!def) return { status: 400, error: 'Kies een geldige pas (RTG, Lifestyle of Business).' };
    const naam = kap(b.naam, 80);
    if (naam.length < 2) return { status: 400, error: 'Vul de naam van de aanvrager in.' };
    const contact = kap(b.contact, 120);
    const viaUitnodiging = !!b.viaUitnodiging;
    // Was de aanvrager ingelogd, dan koppelen we zijn account (zodat een akkoord
    // dat kan optillen). Het id komt UITSLUITEND uit het geverifieerde token via
    // de route, nooit uit de body -- anders tilde je andermans account op.
    const accountId = (aanvragerId && accounts && accounts.getUserById(aanvragerId)) ? aanvragerId : null;
    // De poort van het merk: Lifestyle/Business alleen na menselijke goedkeuring
    // of op uitnodiging. De aanvraag zelf mag altijd binnenkomen (de AI belooft
    // niets); alleen beslis() door een mens kent hem later toe.
    const a = { id: rid(), pas, naam, contact, viaUitnodiging, accountId,
      welkom: def.welkom, reis: bouwReis(def.stem),
      status: 'in behandeling', besluit: null, at: nu(), bijgewerkt: nu() };
    // de ondernemersintake; een gesloten genre wordt geweigerd en niet stil
    // iets anders gemaakt. Zie CONCERN.md.
    const bedrijf = bedrijfMod.zetBedrijf(a, b.bedrijf, { viaUitnodiging });
    if (!bedrijf.ok) return bedrijf;
    A().unshift(a);
    if (A().length > 5000) A().pop();
    save();
    return { ok: true, aanmelding: beeld(a) };
  }

  // De wachtrij voor het personeel (optioneel op status gefilterd).
  function lijst(status) {
    let L = A();
    if (status) L = L.filter(a => a.status === String(status));
    return { ok: true, aantal: L.length,
      openstaand: A().filter(a => a.status === 'in behandeling').length,
      aanmeldingen: L.slice(0, 200).map(beeld) };
  }

  return { bouwReis, beeld, aanvraag, lijst };
};
