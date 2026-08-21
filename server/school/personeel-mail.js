/* Persoonlijke RTG Mail voor ieder actief schoolpersoneelslid.

   Het adres volgt dezelfde regel als Werkmail:
     voornaam.achternaam@schoolnaam.rtg
   en is blijvend aan het personeels-id gebonden. De directie beheert de
   personeelstoegang, maar krijgt daarmee geen route om de persoonlijke inbox
   te lezen. Intrekken van de schooltoegang sluit ook dit postvak.

   De RTMAIL-motor wordt later in de boot gekoppeld via schoolMailBrug. De
   Foundation-router bestaat eerder dan de postlaag; een levende brug voorkomt
   een tweede mailsysteem of een circulaire require. */
'use strict';

const buitenpost = require('../mail');

module.exports = sctx => {
  const { router, save, personeelVan, S, schoolMailBrug } = sctx;
  const mailPubliek = require('../kern/mail-publiek')({});
  const slug = s => String(s == null ? '' : s).trim().toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36) || 'school';
  const naamLokaal = s => String(s == null ? '' : s).trim().toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '')
    .replace(/\.+/g, '.').slice(0, 48) || 'medewerker';
  const dienst = () => schoolMailBrug && schoolMailBrug.dienst;
  const allePersoneel = () => Object.values(S()).flatMap(sch => Object.values(sch.personeel || {}));

  function domeinVan(sch) {
    if (sch.rtgMailDomein) return sch.rtgMailDomein;
    const basis=slug(sch.naam), bezet = d => Object.values(S()).some(x => x !== sch && x.rtgMailDomein === d) ||
      !!(dienst() && dienst().domeinBezet && dienst().domeinBezet(d));
    let d=basis + '.rtg', n=2;
    while (bezet(d) || mailPubliek.isGereserveerdWerkDomein(d)) d=basis.slice(0, 31) + '-' + n++ + '.rtg';
    sch.rtgMailDomein=d; save(); return d;
  }
  function zorgAdres(sch, p) {
    if (p.rtgMail) return p.rtgMail;
    const domein=domeinVan(sch), basis=naamLokaal(p.naam);
    const bestaat = a => allePersoneel().some(x => x !== p && x.rtgMail === a) ||
      !!(dienst() && dienst().adresBestaat && dienst().adresBestaat(a));
    let lokaal=basis, n=2, adres=lokaal + '@' + domein;
    while (bestaat(adres)) { lokaal=basis.slice(0, 44) + '-' + n++; adres=lokaal + '@' + domein; }
    p.rtgMail=adres; p.rtgMailAt=new Date().toISOString(); save(); return adres;
  }
  function adresActief(adres) {
    const a=mailPubliek.intern(adres) || String(adres || '').trim().toLowerCase();
    return Object.values(S()).some(sch => (sch.status || 'actief') === 'actief' &&
      Object.values(sch.personeel || {}).some(p => p.status === 'actief' && String(p.rtgMail || '').toLowerCase() === a));
  }
  const motor = (res) => {
    const d=dienst();
    if (!d || !d.rtmail) { res.status(503).json({ error:'RTG Mail wordt nog veilig gestart. Probeer het zo opnieuw.' }); return null; }
    return d.rtmail;
  };
  const mijn = (req, res) => {
    const pv=personeelVan(req, res); if (!pv) return null;
    return { ...pv, adres:zorgAdres(pv.sch, pv.p) };
  };
  const extern = a => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(a || '').trim()) && !String(a).toLowerCase().endsWith('.rtg');

  router.post('/school/personeel/mail/overzicht', (req, res) => {
    const pv=mijn(req, res); if (!pv) return;
    res.json({ ok:true, adres:pv.adres, domein:domeinVan(pv.sch), persoonlijk:true,
      publiekAdres:mailPubliek.publiek(pv.adres), publiekActief:mailPubliek.groepActief,
      internDomein:true, ongelezen:dienst() && dienst().rtmail ? dienst().rtmail.ongelezen(pv.adres) : 0,
      uitleg:mailPubliek.groepActief
        ? 'Je korte *.rtg-adres werkt binnen RTG; het langere adres is bereikbaar via het publieke internet.'
        : 'Dit persoonlijke *.rtg-adres werkt binnen RTG. Publieke mail gaat pas open nadat DNS en de mailprovider zijn gekeurd.' });
  });
  router.post('/school/personeel/mail/inbox', (req, res) => {
    const pv=mijn(req, res), rt=pv && motor(res); if (!rt) return;
    res.json({ ok:true, adres:pv.adres, berichten:rt.postvak(pv.adres) });
  });
  router.post('/school/personeel/mail/verzonden', (req, res) => {
    const pv=mijn(req, res), rt=pv && motor(res); if (!rt) return;
    res.json({ ok:true, adres:pv.adres, berichten:rt.verzonden(pv.adres) });
  });
  router.post('/school/personeel/mail/lees', (req, res) => {
    const pv=mijn(req, res), rt=pv && motor(res); if (!rt) return;
    const r=rt.lees(pv.adres, String(req.body.id || ''));
    if (r.error) return res.status(404).json(r); res.json({ ok:true, bericht:r });
  });
  router.post('/school/personeel/mail/stuur', (req, res) => {
    const pv=mijn(req, res), rt=pv && motor(res); if (!rt) return;
    const naar=String(req.body.naar || '').trim().toLowerCase().slice(0, 160);
    const onderwerp=String(req.body.onderwerp || '').trim().slice(0, 160);
    const tekst=String(req.body.tekst || '').trim().slice(0, 8000);
    if (!naar || !tekst) return res.status(400).json({ error:'Vul een ontvanger en een bericht in.' });
    if (extern(naar)) {
      const buitenOnderwerp=onderwerp || '(geen onderwerp)';
      const buitenTekst=tekst + '\n\n-- \nVerzonden via ' +
        (mailPubliek.publiek(pv.adres) || pv.adres) + ' (RTG School Mail).';
      if (mailPubliek.groepActief && buitenpost.sendAls) buitenpost.sendAls(pv.adres, naar, buitenOnderwerp, buitenTekst);
      else buitenpost.send(naar, buitenOnderwerp, buitenTekst);
      const m=rt.stuur({ van:pv.adres, naar, onderwerp, tekst, soort:'buitenpost', bron:'school' });
      return res.json({ ok:true, buiten:true, echt:!!buitenpost.configured, bericht:m });
    }
    const m=rt.stuur({ van:pv.adres, naar, onderwerp, tekst, soort:'schoolmail', bron:'school' });
    if (m.error) return res.status(400).json(m); res.json({ ok:true, buiten:false, bericht:m });
  });

  return { zorgPersoneelsMail:zorgAdres, schoolMailAdresActief:adresActief,
    schoolMailNaamLokaal:naamLokaal, schoolMailPubliekAdres:mailPubliek.publiek };
};
