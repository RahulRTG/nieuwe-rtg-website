/* Onderneming-deelmodule "aanvraag": van vastgelegd plan naar een echte zaak.

   Los van ./index.js omdat dat bestand over de 10 kB van het modulebeleid ging.
   De naad is inhoudelijk: index.js gaat over het object zelf, dit gaat over de
   overgang naar de bestaande partnerwereld.

   DE AANVRAAG LOOPT LANGS DE BESTAANDE WEG EN NIET LANGS EEN NIEUWE. Een
   zaak aanmaken betekent partner worden, en dat besluit is mensenwerk
   (kern/aanmeldingen.js: "er is geen automatische toekenning"). Deze functie
   maakt daarom een gewone aanmelding, precies zoals het aanmeldformulier dat
   doet -- alleen al ingevuld met wat we uit de intake weten. Zou het
   Ondernemers-OS zelf een supplier aanmaken, dan was er een tweede deur naast
   de deur waar een mens voor staat, en dat is precies de deur die niemand
   meer bewaakt.

   De nog openstaande oprichtingsstappen gaan mee als `behoeften`. De
   bestaande provisioning zet die om in de wensenlijst van de nieuwe zaak
   (routes/supplier/wensen.js), dus wat hier nog te doen stond, staat straks
   als startlijstje in de zaak zelf. */
'use strict';

module.exports = ({ save, scho, aanmeldingen, oprichtingsproject, ondernemingNaam, ondernemingKoppel, provisioningStand }) => {

  function ondernemingAanvraag(o, accountId, body) {
    if (o.supplierCode) return { status: 409, error: 'Deze onderneming heeft al een zaak.' };
    if (o.aanmeldingId) return { status: 409, error: 'Er loopt al een aanvraag voor deze onderneming.' };
    if (!(o.plan && o.plan.vastgelegd)) {
      return { status: 409, error: 'Leg eerst uw ondernemingsplan vast.',
        uitleg: 'De aanvraag draagt uw plan en uw branche mee; zonder vastgelegd plan zou er een lege aanvraag op de stapel komen.' };
    }
    const i = o.intake || { persoon: {}, idee: {} };
    if (!i.idee || !i.idee.branche) return { status: 409, error: 'Vul eerst uw branche in.' };

    const b = body || {};
    const pas = ['rtg', 'lifestyle', 'business'].includes(b.pas) ? b.pas : 'business';
    const project = oprichtingsproject(o);
    const open = (project.stappen || []).filter(s => !s.klaar).map(s => s.stap).slice(0, 8);

    const r = aanmeldingen.aanvraag({
      pas, naam: scho(b.naam, 80) || 'Onbekend', contact: scho(b.contact, 120),
      bedrijf: { naam: ondernemingNaam(o), type: i.idee.branche, plaats: i.idee.plaats, behoeften: open }
    }, accountId || null);
    if (!r || !r.ok) return r || { status: 500, error: 'De aanvraag kon niet worden ingediend.' };

    o.aanmeldingId = r.aanmelding.id;
    save();

    /* De provisioning-knop van de boardroom (kern/onderneming/regie.js). In de
       stand 'automatisch' wordt de zaak direct klaargezet, langs DEZELFDE
       provisioning die het personeel anders in gang zet -- er komt geen tweede
       manier bij om een zaak te maken. De PAS blijft in elke stand mensenwerk;
       dat is een andere knop en een andere regel. */
    const stand = provisioningStand ? provisioningStand() : 'mens';
    if (stand === 'automatisch' && aanmeldingen.provisioneerId) {
      const gezet = aanmeldingen.provisioneerId(r.aanmelding.id);
      if (gezet && gezet.code) {
        const k = ondernemingKoppel(o, gezet.code);
        if (k.ok) {
          return { ok: true, aanmelding: r.aanmelding, stand, zaak: { code: gezet.code },
            onderneming: k.onderneming,
            uitleg: 'Uw zaak staat klaar. RTG heeft het klaarzetten van zaken op automatisch staan; uw pas blijft een besluit van een mens.' };
        }
      }
    }

    return { ok: true, aanmelding: r.aanmelding, stand,
      uitleg: stand === 'na-termijn'
        ? 'Uw aanvraag staat op de stapel. Uw zaak wordt klaargezet zodra de eerste termijn is afgetekend.'
        : 'Uw aanvraag staat op de stapel. Een medewerker van RTG beoordeelt hem; wij kennen zelf geen toegang toe.' };
  }

  /* De stand van de aanvraag, en -- zodra de zaak er echt staat -- de
     koppeling. Dat koppelen gebeurt hier en niet in ondernemingBeeld(), want
     dat is een leesfunctie en die hoort niets te veranderen. */
  function ondernemingAanvraagStand(o) {
    if (!o.aanmeldingId) return { ok: true, stand: 'geen-aanvraag' };
    const r = aanmeldingen.een(o.aanmeldingId);
    if (!r || !r.ok) return { ok: true, stand: 'onvindbaar',
      uitleg: 'De aanvraag is niet meer terug te vinden. Neem contact op met RTG.' };
    const a = r.aanmelding;
    if (a.gezaakt && a.gezaakt.code && !o.supplierCode) {
      const k = ondernemingKoppel(o, a.gezaakt.code);
      if (k.ok) return { ok: true, stand: 'gekoppeld', aanmelding: a, onderneming: k.onderneming };
      return Object.assign({ ok: true, stand: 'koppelen-mislukt' }, k, { aanmelding: a });
    }
    return { ok: true, aanmelding: a,
      stand: a.status === 'geaccepteerd' ? 'geaccepteerd' : (a.besluit ? 'besloten' : 'in behandeling') };
  }

  return { ondernemingAanvraag, ondernemingAanvraagStand };
};
