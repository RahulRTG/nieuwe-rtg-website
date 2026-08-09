/* Werkmail (kern/werkmail): het zakelijke adresboek boven op RTMAIL. Elke
   zaak krijgt een eigen domein "<naam>.rtg"; de eigenaar en elke manager
   krijgen daar STANDAARD een adres op, en "rahul@<domein>" is de AI van het
   huis die zelf terugschrijft. De werkgever (manager-inlog) maakt adressen
   aan en pakt ze weer af; het postvak blijft dan van de zaak.

   De zwaarste stand voor alles wat van buiten komt, geerfd van RTMAIL en
   hier nog eens hard gemaakt:
   - bijlagen BESTAAN niet: er wordt nooit iets opgeslagen dat te openen valt
   - alles zonder geverifieerde bron valt in de onbetrouwde baan ('extern'):
     links zijn daar nooit te openen, alleen als onklikbare tekst te zien
   - de buitenpoort levert ALTIJD in die baan af, wat de afzender ook beweert
   - naar buiten mailen kan wel: via de buitenpost (SMTP; zonder sleutel de
     outbox), en Rahul schrijft nooit automatisch terug naar buiten
     (geen backscatter). */
module.exports = ({ db, save, crypto, rtmail, mail, accounts }) => {
  const W = () => {
    if (!db.data.werkmail) db.data.werkmail = { domeinen: {}, adressen: [] };
    return db.data.werkmail;
  };
  const nu = () => new Date().toISOString();
  const slug = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'zaak';

  // het domein van een zaak: een keer gemaakt, daarna vast
  function domeinVan(code, naam) {
    const w = W();
    if (w.domeinen[code]) return w.domeinen[code];
    const basis = slug(naam || code);
    let d = basis + '.rtg', n = 2;
    while (Object.values(w.domeinen).includes(d)) d = basis + '-' + (n++) + '.rtg';
    w.domeinen[code] = d;
    save();
    return d;
  }
  const vindAdres = a => W().adressen.find(x => x.adres === rtmail.normAdres(a));
  const pubAdres = a => ({ adres: a.adres, label: a.label, rol: a.rol, actief: a.actief,
    ongelezen: a.actief ? rtmail.ongelezen(a.adres) : 0 });

  function adresMaak(code, domein, lokaal, label, rol) {
    const adres = rtmail.normAdres(slug(lokaal) + '@' + domein);
    if (!adres || adres.startsWith('@')) return { error: 'Geen geldig adres.' };
    const bestaand = vindAdres(adres);
    if (bestaand) {
      if (bestaand.zaak !== code) return { error: 'Dit adres is al vergeven.' };
      return { ok: true, adres: pubAdres(bestaand), bestond: true };
    }
    const a = { adres, zaak: code, label: String(label || '').slice(0, 60) || lokaal, rol, actief: true, at: nu() };
    W().adressen.push(a);
    save();
    return { ok: true, adres: pubAdres(a) };
  }

  /* De standaard-uitgifte: eigenaar@, rahul@ en een adres per manager
     (voornaam; de achternaam blijft in de kluis). Idempotent. */
  function zorgStandaard(supplier) {
    const code = supplier.code;
    const domein = domeinVan(code, supplier.name);
    adresMaak(code, domein, 'eigenaar', 'De eigenaar', 'eigenaar');
    adresMaak(code, domein, 'rahul', 'Rahul, de AI van het huis', 'rahul');
    for (const st of (accounts.listStaff(code) || [])) {
      if (st.role !== 'manager') continue;
      const voornaam = String(st.name || '').trim().split(/\s+/)[0] || ('manager' + st.id);
      adresMaak(code, domein, voornaam, voornaam + ' (management)', 'management');
    }
    return domein;
  }
  function lijst(supplier) {
    const domein = zorgStandaard(supplier);
    return { ok: true, domein, echteBuitenpost: !!(mail && mail.configured),
      adressen: W().adressen.filter(a => a.zaak === supplier.code).map(pubAdres) };
  }
  // de werkgever maakt een adres voor een medewerker (rol 'personeel')
  function maak(supplier, lokaal, label) {
    if (!String(lokaal || '').trim()) return { error: 'Voor wie is het adres?' };
    return adresMaak(supplier.code, zorgStandaard(supplier), lokaal, label, 'personeel');
  }
  // afpakken: het adres gaat op slot; het postvak blijft van de zaak
  function intrek(code, adres, aan) {
    const a = vindAdres(adres);
    if (!a || a.zaak !== code) return { error: 'Dit adres is niet van deze zaak.' };
    if (a.rol === 'rahul' || a.rol === 'eigenaar') return { error: 'Het eigenaar- en Rahul-adres horen bij het huis en zijn niet in te trekken.' };
    a.actief = aan === true;
    save();
    return { ok: true, adres: pubAdres(a) };
  }
  const isZaakAdres = (code, adres) => { const a = vindAdres(adres); return !!(a && a.zaak === code); };
  const isActiefZaakAdres = (code, adres) => { const a = vindAdres(adres); return !!(a && a.zaak === code && a.actief); };
  /* Bestaat dit zaakadres en staat het aan -- ONGEACHT welke zaak. De regel
     hierboven vraagt "is dit adres van DEZE zaak"; de SMTP-ontvanger moet bij
     RCPT TO iets anders weten, namelijk of dit adres hier uberhaupt een postvak
     is. Een ingetrokken adres telt niet mee: dat is geen postvak meer, en post
     ervoor aannemen levert een berg op die niemand leest. */
  const zaakAdresActief = (adres) => { const a = vindAdres(adres); return !!(a && a.actief); };

  // extern = een echt e-mailadres buiten het huis (niet @rtmail, niet *.rtg)
  const isExtern = naar => {
    const n = String(naar || '').trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(n) && !n.endsWith('@rtmail') && !n.endsWith('.rtg');
  };

  const RAHUL_ZINNEN = [
    'Ik heb het gelezen en leg het klaar voor de juiste kamer.',
    'Goede vraag; ik zet de feiten op een rij en kom erop terug in dit postvak.',
    'Ik heb er direct een notitie van gemaakt voor het dagoverzicht.',
    'Helder. Als er een besluit nodig is, leg ik het de eigenaar voor; ik besluit zelf niets.'
  ];
  function rahulAntwoord(rahulAdres, naar, onderwerp) {
    const zin = RAHUL_ZINNEN[crypto.randomInt(0, RAHUL_ZINNEN.length)];
    rtmail.stuur({ van: rahulAdres, naar, onderwerp: 'Re: ' + String(onderwerp || '').slice(0, 150),
      tekst: 'U schreef Rahul over "' + String(onderwerp || 'uw bericht').slice(0, 120) + '". ' + zin, soort: 'rahul', bron: 'systeem' });
  }

  /* Versturen vanaf een zaak-adres: intern over RTMAIL (vertrouwde baan),
     naar buiten via de buitenpost. Je mailt nooit ALS Rahul. */
  function stuur(code, vanAdres, naar, onderwerp, tekst) {
    const van = vindAdres(vanAdres);
    if (!van || van.zaak !== code || !van.actief) return { error: 'Verstuur vanaf een actief adres van de zaak.' };
    if (van.rol === 'rahul') return { error: 'Rahul schrijft zelf; u mailt niet namens hem.' };
    if (isExtern(naar)) {
      const n = String(naar).trim().toLowerCase().slice(0, 120);
      mail.send(n, String(onderwerp || '(geen onderwerp)').slice(0, 160),
        String(tekst || '').slice(0, 8000) + '\n\n-- \nVerzonden vanaf ' + van.adres + ' via RTG Werkmail.');
      const log = rtmail.stuur({ van: van.adres, naar: n, onderwerp, tekst, soort: 'buitenpost', bron: 'zaak' });
      return { ok: true, buiten: true, echt: !!(mail && mail.configured), bericht: log };
    }
    const r = rtmail.stuur({ van: van.adres, naar, onderwerp, tekst, soort: 'werkmail', bron: 'zaak' });
    if (r.error) return r;
    const doel = vindAdres(r.naar);
    if (doel && doel.rol === 'rahul' && doel.actief) rahulAntwoord(doel.adres, van.adres, onderwerp);
    return { ok: true, buiten: false, bericht: r };
  }

  /* De buitenpoort: post van buiten het huis. Alleen voor bestaande, actieve
     adressen, en ALTIJD in de onbetrouwde baan -- geen bron-claim komt erdoor,
     links gaan op slot en een bijlage bestaat niet. Rahul antwoordt bewust
     nooit automatisch naar buiten. */
  function buitenIn(naar, vanExtern, onderwerp, tekst) {
    const doel = vindAdres(naar);
    if (!doel || !doel.actief) return { error: 'Onbekend adres.' };
    const r = rtmail.stuur({ van: String(vanExtern || 'onbekend@buiten').slice(0, 120), naar: doel.adres,
      onderwerp, tekst, soort: 'extern' }); // bewust GEEN bron: onbetrouwd
    return r.error ? r : { ok: true, bericht: r };
  }

  return { werkmail: { domeinVan, zorgStandaard, lijst, maak, intrek, stuur, buitenIn, isZaakAdres, isActiefZaakAdres, zaakAdresActief, isExtern } };
};
