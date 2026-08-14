/* De serverbevestigde controlesheet voor bezorgen en afhalen. Zuiver: opent
   geen rekening, reserveert geen slot en gelooft geen prijs uit de browser. */
'use strict';

module.exports = ({ kern, horeca, bezorglaag, beleid, schoon }) => function checkoutVan(s, b, kanaal) {
  const magBestellen = beleid.magBestellen(s.code, kanaal);
  if (!magBestellen.mag) return { status: 403, error: magBestellen.uitleg, code: magBestellen.code };
  const wensen = Array.isArray(b.items) ? b.items.slice(0, 40) : [];
  if (!wensen.length) return { status: 400, error: 'Er staat niets in je bestelling.', code: 'leeg' };
  const kaart = kern.gastKaartVanZaak(s.code);
  const regels = [];
  for (const wens of wensen) {
    const item = kaart.find(x => x.id === String(wens.itemId || ''));
    const magItem = beleid.magItem(s.code, item, null);
    if (!magItem.mag) return { status: 409, error: magItem.uitleg, code: magItem.code,
      item: item ? item.naam : String(wens.itemId || '') };
    const aantal = Math.max(1, Math.min(99, parseInt(wens.aantal, 10) || 1));
    const happy = horeca.happyKorting(s.code, item.cat || null, horeca.nu());
    const centen = happy ? Math.round(item.centen * (100 - happy.procent) / 100) : item.centen;
    regels.push({ itemId: item.id, naam: item.naam, aantal, centen,
      totaalCenten: centen * aantal, happy: happy ? happy.naam + ' -' + happy.procent + '%' : null });
  }
  const subtotaalCenten = regels.reduce((t, r) => t + r.totaalCenten, 0);
  const sloten = bezorglaag.slotenVan(s.code, schoon(b.datum, 10));
  const vrijeSloten = sloten.sloten.filter(x => !x.vol).map(x => ({ tijd: x.tijd, vrij: x.vrij }));
  const gevraagdTijdstip = schoon(b.tijd, 5) || null;
  const nodigMinuten = Math.max(5, Math.min(120, regels.length * 5));
  const gekozenSlot = gevraagdTijdstip ? vrijeSloten.find(x => x.tijd === gevraagdTijdstip) : null;
  const tijdGeldig = !gevraagdTijdstip || !!(gekozenSlot && gekozenSlot.vrij >= nodigMinuten);
  let check = null, bezorgkostenCenten = 0, bevestigbaar = tijdGeldig;
  let blokkade = tijdGeldig ? null : 'Dit tijdslot heeft niet meer genoeg ruimte. Kies een ander tijdstip.';
  let blokkadeCode = tijdGeldig ? null : 'slot-vol';
  if (kanaal === 'bezorging') {
    check = bezorglaag.bezorgCheck(s.code, s, { postcode: b.postcode, lat: b.lat, lng: b.lng,
      bedragCenten: subtotaalCenten });
    if (check.error) return check;
    bezorgkostenCenten = check.bezorgbaar ? (check.kostenCenten || 0) : 0;
    if (!check.bezorgbaar) {
      bevestigbaar = false; blokkade = check.reden || check.redenDicht; blokkadeCode = check.code || 'bezorging-dicht';
    } else if (!check.haaltMinimum) {
      bevestigbaar = false;
      blokkade = 'Voeg nog € ' + ((check.tekort || 0) / 100).toFixed(2).replace('.', ',') + ' toe om het bestelminimum te halen.';
      blokkadeCode = 'minimum';
    } else if (!schoon(b.adres, 120)) {
      bevestigbaar = false; blokkade = 'Vul het bezorgadres in voordat je bevestigt.'; blokkadeCode = 'adres';
    }
  }
  return { ok: true, zaak: { code: s.code, naam: s.name }, kanaal,
    regels, subtotaalCenten, bezorgkostenCenten, totaalCenten: subtotaalCenten + bezorgkostenCenten,
    bevestigbaar, blokkade, blokkadeCode, datum: sloten.datum, sloten: vrijeSloten, tijd: gevraagdTijdstip,
    bezorg: check ? { bezorgbaar: !!check.bezorgbaar, zone: check.zone || null,
      minuten: check.zone ? check.zone.minuten : null, minimumCenten: check.minimumCenten || 0,
      tekortCenten: check.tekort || 0, gratisBezorging: !!check.gratisBezorging } : null,
    bevestiging: beleid.bevestigingNodig(s.code, { allergie: schoon(b.allergie, 120), totaalCenten: subtotaalCenten }),
    betaling: { status: 'openstaand', wijze: 'bij-ontvangst',
      label: kanaal === 'bezorging' ? 'Betaling volgt bij ontvangst' : 'Betaling volgt bij afhalen',
      onlineAfschrijving: false },
    gecontroleerdAt: horeca.nu(), _check: check };
};
