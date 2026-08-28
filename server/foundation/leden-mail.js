/* Persoonlijke mail voor RTFoundation-leden.

   Naar buiten blijft uitsluitend de codenaam zichtbaar:
     codenaam@rahultravelfoundation.com
   Het adres wordt uit de gezinssessie afgeleid. Een client kan dus niet het
   postvak of de codenaam van een ander kiezen. Gasten krijgen geen RTF-adres. */
'use strict';

const buitenpost=require('../mail');

module.exports = ({ router, G, save, sessieVan, isGast, schoolMailBrug }) => {
  const mailPubliek=require('../kern/mail-publiek')({});
  const dienst=() => schoolMailBrug && schoolMailBrug.dienst;
  const motor=res => {
    const d=dienst();
    if (!d || !d.rtmail) { res.status(503).json({ error:'RTF Mail wordt nog veilig gestart. Probeer het zo opnieuw.' }); return null; }
    return d.rtmail;
  };
  const sessie=(req,res) => {
    const s=sessieVan(req,res);
    if (!s) return null;
    if (isGast(s.p)) { res.status(403).json({ error:'Een gast gebruikt het eigen RTG-account; een Foundation-adres is voor RTF-leden.' }); return null; }
    return s;
  };
  const adresVan=(rt,p) => rt.adresVoor('rtf', p.codenaam);
  const extern=a => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(a || '').trim()) &&
    !String(a || '').toLowerCase().endsWith('.rtg');

  function adresActief(adres) {
    const d=dienst(); if (!d || !d.rtmail) return false;
    const intern=mailPubliek.intern(adres) || String(adres || '').trim().toLowerCase();
    return Object.values(G()).some(g => Object.values(g.profielen || {}).some(p =>
      !isGast(p) && p.codenaam && d.rtmail.zelfdeBus(adresVan(d.rtmail, p), intern)));
  }

  router.post('/mail/overzicht', (req,res) => {
    const s=sessie(req,res), rt=s && motor(res); if (!rt) return;
    const adres=adresVan(rt,s.p), publiekAdres=mailPubliek.foundationAdres(adres);
    res.json({ ok:true, adres, publiekAdres, persoonlijk:true,
      publiekActief:!!publiekAdres, ongelezen:rt.ongelezen(adres),
      uitleg:publiekAdres
        ? 'Je codenaam is ook je publieke Foundation-adres; je echte naam blijft privé.'
        : 'Je Foundation-adres werkt intern. Publieke mail gaat pas open na registratie en beveiliging van rahultravelfoundation.com.' });
  });
  router.post('/mail/inbox', (req,res) => {
    const s=sessie(req,res), rt=s && motor(res); if (!rt) return;
    const adres=adresVan(rt,s.p);
    res.json({ ok:true, adres, berichten:rt.postvak(adres) });
  });
  router.post('/mail/verzonden', (req,res) => {
    const s=sessie(req,res), rt=s && motor(res); if (!rt) return;
    const adres=adresVan(rt,s.p);
    res.json({ ok:true, adres, berichten:rt.verzonden(adres) });
  });
  router.post('/mail/lees', (req,res) => {
    const s=sessie(req,res), rt=s && motor(res); if (!rt) return;
    const r=rt.lees(adresVan(rt,s.p), String(req.body.id || ''));
    if (r.error) return res.status(404).json(r);
    res.json({ ok:true, bericht:r });
  });
  router.post('/mail/stuur', (req,res) => {
    const s=sessie(req,res), rt=s && motor(res); if (!rt) return;
    const van=adresVan(rt,s.p), naar=String(req.body.naar || '').trim().toLowerCase().slice(0,160);
    const onderwerp=String(req.body.onderwerp || '').trim().slice(0,160);
    const tekst=String(req.body.tekst || '').trim().slice(0,8000);
    if (!naar || !tekst) return res.status(400).json({ error:'Vul een ontvanger en een bericht in.' });
    if (extern(naar)) {
      if (!mailPubliek.foundationActief) return res.status(503).json({
        error:'Publieke Foundation-mail staat nog dicht totdat rahultravelfoundation.com geregistreerd en beveiligd is.' });
      if (buitenpost.sendAls) buitenpost.sendAls(van, naar, onderwerp || '(geen onderwerp)', tekst);
      else buitenpost.send(naar, onderwerp || '(geen onderwerp)', tekst);
      const m=rt.stuur({ van, naar, onderwerp, tekst, soort:'buitenpost', bron:'lid' });
      return res.json({ ok:true, buiten:true, echt:!!buitenpost.configured, bericht:m });
    }
    const m=rt.stuur({ van, naar, onderwerp, tekst, soort:'foundationmail', bron:'lid' });
    if (m.error) return res.status(400).json(m);
    res.json({ ok:true, buiten:false, bericht:m });
  });

  return { foundationMailAdresActief:adresActief };
};
