/* Onderneming-deelmodule "draaiend": de ingangen van een bedrijf dat AL DRAAIT.

   Los van ./index.js omdat dat bestand over de 10 kB van het modulebeleid ging,
   en de naad loopt langs de LEVENSFASE: daar staat wat een onderneming is en
   wordt (aanmaken, rechtsvorm, plan, oprichting, aanvraag, het dagbeeld dat
   alles samenbrengt), hier staan de lagen die pas iets te zeggen hebben zodra
   er een zaak onder hangt -- geld, werk, mensen, verkoop en toegang.

   Het is bewust een KAART en geen laag: elke regel wijst naar de module die het
   werk doet. Zou hier logica ontstaan, dan is er een derde plek waar iets over
   een onderneming wordt beslist. */
'use strict';

module.exports = (L, hulp) => {
  const { save, ondernemingBeeld, ondernemingVerkenning } = hulp;
  const { rel, deb, cred, con, bel, kas, cap, pij, vrd, klu, tgn, ontw, bst,
    regie, wrv, boek, opr, mp } = L;

  return {
    ondernemingRelaties: rel.relaties,
    ondernemingDebiteuren: deb.debiteuren,
    ondernemingCrediteuren: cred.crediteuren,
    ondernemingContracten: con.contracten,
    ondernemingBelasting: bel.belasting,
    ondernemingKas: (o, nu, dagen) => {
      const t = Number.isFinite(nu) ? nu : Date.now();
      return kas.kas(o, deb.debiteuren(o, t), cred.crediteuren(o, t), bel.belasting(o, t), t, dagen);
    },
    ondernemingKasSaldo: kas.kasSaldoZet,
    ondernemingCapaciteit: cap.capaciteit,
    ondernemingPijplijn: pij.pijplijn,
    ondernemingVoorraad: vrd.voorraad,
    ondernemingKlussen: klu.klussen,
    ondernemingToegang: tgn.toegang,
    ONDERNEMING_ONTWERPER: ontw.ONTWERPER_OPDRACHTEN,
    /* De AI krijgt de feiten MEE en haalt ze niet zelf op: de verkenning en het
       mallprofiel worden hier al gemaakt, en twee keer ophalen kan twee
       antwoorden geven op dezelfde vraag. */
    ondernemingOntwerp: (req, o, opdracht, vraag) => {
      const feiten = opdracht === 'mall'
        ? ontw.feitenVanMall(o, mp.ondernemingMallProfiel(o), ondernemingBeeld(o))
        : ontw.feitenVanOntwerp(o, ondernemingVerkenning(o));
      return ontw.ontwerp(req, opdracht, vraag, feiten);
    },
    ondernemingBestuur: bst.bestuur,
    ondernemingBestuurderZet: bst.bestuurderZet,
    ondernemingBestuurderAf: bst.bestuurderAf,
    ondernemingAandeelZet: bst.aandeelZet,
    ondernemingAandeelWeg: bst.aandeelWeg,
    ondernemingRegie: regie.regieBeeld,
    ondernemingProvisioningStand: regie.provisioningStand,
    ondernemingProvisioningZet: regie.provisioningZet,
    ondernemingBijdrageZet: regie.bijdrageZet,
    ondernemingBijdrageOver: regie.bijdrageOver,
    ondernemingWerving: (o, nu) => {
      const t = Number.isFinite(nu) ? nu : Date.now();
      return wrv.werving(o, cap.capaciteit(o, t), t);
    },
    ondernemingWerkruimte: (o, code) => con.ondernemingWerkruimte(o, code, save),
    ondernemingKlantNotitie: boek.klantNotitie,
    ondernemingOprichting: opr.oprichtingsproject,
    ondernemingOprichtingZet: opr.oprichtingZet,
  };
};
