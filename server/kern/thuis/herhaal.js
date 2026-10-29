/* RTG Thuis, deelbestand "herhaal": DE HERHAALSLEUTEL VAN EEN AANVRAAG
   (19 oktober 2026). Na een afgebroken aanvraag zei de herhaling "deze periode
   is al bezet" -- door de eigen boeking. Het scherm stuurt per aanvraag een
   sleutel; die staat op de boeking, dus ook na een herstart geeft dezelfde
   sleutel de bestaande aanvraag terug. Dezelfde sleutel voor een ander verzoek
   is een 409. Apart van ./boeken.js omdat dat anders over de 10 kB ging. */
'use strict';
function sleutelVan(data) {
  return typeof data.idem === 'string' && data.idem.trim() ? data.idem.trim().slice(0, 80) : null;
}
function eerdereAanvraag(boekingen, codenaam, data, idem, gastZicht) {
  const al = idem && boekingen.find(b => b.gast === codenaam && b.idem === idem);
  if (!al) return null;
  return al.huisId === String(data.id || '') && al.van === data.van && al.tot === data.tot
    ? { ok: true, boeking: gastZicht(al), herhaald: true }
    : { status: 409, error: 'Deze herhaalsleutel hoort bij een andere aanvraag.' };
}
module.exports = { sleutelVan, eerdereAanvraag };
