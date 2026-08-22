/* Persoonlijke Werkmail: ieder adres is aan het personeels-id gebonden. */
module.exports = ({ db, save, crypto, rtmail, mail, accounts }) => {
  const mailPubliek = require('./mail-publiek')({});
  const W = () => {
    if (!db.data.werkmail) db.data.werkmail = { domeinen: {}, adressen: [] };
    return db.data.werkmail;
  };
  const nu = () => new Date().toISOString();
  const slug = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'zaak';
  const naamLokaal = s => String(s == null ? '' : s).trim().toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '')
    .replace(/\.+/g, '.').slice(0, 48) || 'medewerker';

  // het domein van een zaak: een keer gemaakt, daarna vast
  function domeinVan(code, naam) {
    const w = W();
    if (w.domeinen[code]) return w.domeinen[code];
    const basis = slug(naam || code);
    let d = basis + '.rtg', n = 2;
    const schoolDomeinen = Object.values((((db.data || {}).foundation || {}).scholen) || {})
      .map(s => s && s.rtgMailDomein).filter(Boolean);
    while (Object.values(w.domeinen).includes(d) || schoolDomeinen.includes(d) ||
        mailPubliek.isGereserveerdWerkDomein(d)) {
      d = basis.slice(0, 25) + '-' + (n++) + '.rtg';
    }
    w.domeinen[code] = d;
    save();
    return d;
  }
  const vindAdres = a => W().adressen.find(x => x.adres === rtmail.normAdres(a));
  const isPersoonlijk = a => !!(a && a.persoonlijk && a.staffId != null);
  const isEigen = (a, actor) => isPersoonlijk(a) && actor && actor.staffId != null &&
    Number(a.staffId) === Number(actor.staffId);
  const magGebruiken = (code, adres, actor) => {
    const a = vindAdres(adres);
    if (!a || a.zaak !== code || !a.actief) return false;
    return isPersoonlijk(a) ? isEigen(a, actor) : !!(actor && actor.manager);
  };
  const pubAdres = (a, actor) => {
    const toegang = isPersoonlijk(a) ? isEigen(a, actor) : !!(actor && actor.manager);
    return { adres:a.adres, label:a.label, rol:a.rol, actief:!!a.actief,
      publiekAdres:mailPubliek.publiek(a.adres),
      persoonlijk:isPersoonlijk(a), staffId:isPersoonlijk(a) ? Number(a.staffId) : null,
      toegang, ongelezen:a.actief && toegang ? rtmail.ongelezen(a.adres) : null };
  };

  function adresMaak(code, domein, lokaal, label, rol, extra) {
    const local = extra && extra.persoonlijk ? naamLokaal(lokaal) : slug(lokaal);
    const adres = rtmail.normAdres(local + '@' + domein);
    if (!adres || adres.startsWith('@')) return { error: 'Geen geldig adres.' };
    const bestaand = vindAdres(adres);
    if (bestaand) {
      if (bestaand.zaak !== code) return { error: 'Dit adres is al vergeven.' };
      return { ok: true, adres:bestaand, bestond:true };
    }
    const a = Object.assign({ adres, zaak:code, label:String(label || '').slice(0, 60) || lokaal,
      rol, actief:true, at:nu() }, extra || {});
    W().adressen.push(a);
    save();
    return { ok:true, adres:a };
  }

  function uniekPersoneelsAdres(code, domein, staff) {
    const bestaand = W().adressen.find(a => a.zaak === code && isPersoonlijk(a) &&
      Number(a.staffId) === Number(staff.id));
    if (bestaand) return bestaand;
    const basis = naamLokaal(staff.name);
    let lokaal = basis, n = 2;
    while (vindAdres(lokaal + '@' + domein)) lokaal = basis.slice(0, 44) + '-' + n++;
    return adresMaak(code, domein, lokaal, staff.name,
      staff.role === 'manager' ? 'management' : 'personeel',
      { persoonlijk:true, staffId:Number(staff.id), uitgegevenAan:String(staff.name).slice(0, 60) }).adres;
  }

  // Idempotente uitgifte; na uitdiensttreding gaat het adres dicht.
  function zorgStandaard(supplier) {
    const code = supplier.code;
    const domein = domeinVan(code, supplier.name);
    adresMaak(code, domein, 'eigenaar', 'De eigenaar', 'eigenaar');
    adresMaak(code, domein, 'rahul', 'Rahul, de AI van het huis', 'rahul');
    const actief = accounts.listStaff(code) || [], ids = new Set(actief.map(s => Number(s.id)));
    for (const st of actief) uniekPersoneelsAdres(code, domein, st);
    for (const a of W().adressen) {
      if (a.zaak !== code || !isPersoonlijk(a) || ids.has(Number(a.staffId)) || !a.actief) continue;
      a.actief = false; a.ingetrokkenAt = nu(); a.intrekReden = 'uit-dienst';
    }
    save();
    return domein;
  }
  function lijst(supplier, actor) {
    const domein = zorgStandaard(supplier);
    return { ok: true, domein, echteBuitenpost: !!(mail && mail.configured),
      magBeheren:!!(actor && actor.manager),
      internDomein:true,
      publiekActief:mailPubliek.groepActief, publiekBasis:mailPubliek.basis,
      uitleg:mailPubliek.groepActief
        ? 'Het *.rtg-adres blijft intern; naam@bedrijf.' + mailPubliek.basis + ' is het publieke internetadres.'
        : '*.rtg is RTG-intern. Publieke aliassen worden pas aangezet nadat mail-DNS en de provider zijn gekeurd.',
      adressen:W().adressen.filter(a => a.zaak === supplier.code)
        .filter(a => actor && actor.manager ? true : isEigen(a, actor))
        .map(a => pubAdres(a, actor)) };
  }
  function maak(supplier, lokaal, label, actor) {
    if (!String(lokaal || '').trim()) return { error: 'Voor wie is het adres?' };
    const r = adresMaak(supplier.code, zorgStandaard(supplier), lokaal, label, 'gedeeld');
    if (r.error) return r;
    return { ok:true, adres:pubAdres(r.adres, actor), bestond:!!r.bestond };
  }
  // afpakken: het adres gaat op slot; het postvak blijft van de zaak
  function intrek(code, adres, aan) {
    const a = vindAdres(adres);
    if (!a || a.zaak !== code) return { error: 'Dit adres is niet van deze zaak.' };
    if (a.rol === 'rahul' || a.rol === 'eigenaar') return { error: 'Het eigenaar- en Rahul-adres horen bij het huis en zijn niet in te trekken.' };
    a.actief = aan === true;
    a.intrekReden = a.actief ? null : 'handmatig';
    a.ingetrokkenAt = a.actief ? null : nu();
    save();
    return { ok:true, adres:pubAdres(a, { manager:true, staffId:a.staffId }) };
  }
  function trekPersoneelIn(code, staffId) {
    let n = 0;
    for (const a of W().adressen) {
      if (a.zaak !== code || !isPersoonlijk(a) || Number(a.staffId) !== Number(staffId) || !a.actief) continue;
      a.actief=false; a.ingetrokkenAt=nu(); a.intrekReden='uit-dienst'; n++;
    }
    if (n) save();
    return n;
  }
  const isZaakAdres = (code, adres) => { const a = vindAdres(adres); return !!(a && a.zaak === code); };
  const isActiefZaakAdres = (code, adres) => { const a = vindAdres(adres); return !!(a && a.zaak === code && a.actief); };
  // Voor RCPT TO: bestaat er ongeacht de zaak een actief intern postvak?
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

  // Intern via RTMAIL, extern via de buitenpost; nooit namens Rahul.
  function stuur(code, vanAdres, naar, onderwerp, tekst, actor) {
    const van = vindAdres(vanAdres);
    if (!van || van.zaak !== code || !van.actief) return { error: 'Verstuur vanaf een actief adres van de zaak.' };
    if (!magGebruiken(code, vanAdres, actor)) return { status:403, error:'Dit postvak hoort niet bij uw persoonlijke inlog.' };
    if (van.rol === 'rahul') return { error: 'Rahul schrijft zelf; u mailt niet namens hem.' };
    if (isExtern(naar)) {
      const n = String(naar).trim().toLowerCase().slice(0, 120);
      const buitenOnderwerp=String(onderwerp || '(geen onderwerp)').slice(0, 160);
      const buitenTekst=String(tekst || '').slice(0, 8000) + '\n\n-- \nVerzonden vanaf ' +
        (mailPubliek.publiek(van.adres) || van.adres) + ' via RTG Werkmail.';
      if (mailPubliek.groepActief && mail && mail.sendAls) mail.sendAls(van.adres, n, buitenOnderwerp, buitenTekst);
      else mail.send(n, buitenOnderwerp, buitenTekst);
      const log = rtmail.stuur({ van: van.adres, naar: n, onderwerp, tekst, soort: 'buitenpost', bron: 'zaak' });
      return { ok: true, buiten: true, echt: !!(mail && mail.configured), bericht: log };
    }
    const r = rtmail.stuur({ van: van.adres, naar, onderwerp, tekst, soort: 'werkmail', bron: 'zaak' });
    if (r.error) return r;
    const doel = vindAdres(r.naar);
    if (doel && doel.rol === 'rahul' && doel.actief) rahulAntwoord(doel.adres, van.adres, onderwerp);
    return { ok: true, buiten: false, bericht: r };
  }

  // Buitenpost is altijd onbetrouwde post en krijgt geen automatisch antwoord.
  function buitenIn(naar, vanExtern, onderwerp, tekst) {
    const doel = vindAdres(mailPubliek.intern(naar) || naar);
    if (!doel || !doel.actief) return { error: 'Onbekend adres.' };
    const r = rtmail.stuur({ van: String(vanExtern || 'onbekend@buiten').slice(0, 120), naar: doel.adres,
      onderwerp, tekst, soort: 'extern' }); // bewust GEEN bron: onbetrouwd
    return r.error ? r : { ok: true, bericht: r };
  }

  return { werkmail: { domeinVan, zorgStandaard, lijst, maak, intrek, trekPersoneelIn,
    stuur, buitenIn, isZaakAdres, isActiefZaakAdres, zaakAdresActief, isExtern,
    magGebruiken, isPersoonlijk, naamLokaal, publiekAdres:mailPubliek.publiek,
    internAdres:mailPubliek.intern, publiekActief:mailPubliek.groepActief } };
};
