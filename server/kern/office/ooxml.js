/* RTG Office: wat XLSX en DOCX delen -- de pakketrelaties, de
   documenteigenschappen en het ontsnappen van tekst in XML.

   De classificatie staat hier als EIGENSCHAP van het bestand (docProps/
   custom.xml, `RTG-Classificatie`) en als categorie in de kern-eigenschappen.
   Dat is de plek waar een ontvangend kantoorpakket of een DLP-scanner haar
   zoekt; de zichtbare markering (koptekst) zet elk formaat zelf. */
'use strict';

// tekens die XML 1.0 niet toestaat gaan eruit; de rest wordt ontsnapt
function xmlEsc(t) {
  return String(t == null ? '' : t)
    .replace(/[^\x09\x0A\x0D\x20-퟿-�]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function kantoorProps({ hoofd, titel, label }) {
  const KOP = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  return {
    '_rels/.rels': KOP + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="' + NS_R + '/officeDocument" Target="' + hoofd + '"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '<Relationship Id="rId3" Type="' + NS_R + '/custom-properties" Target="docProps/custom.xml"/>' +
      '</Relationships>',
    'docProps/core.xml': KOP + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
      'xmlns:dc="http://purl.org/dc/elements/1.1/">' +
      '<dc:title>' + xmlEsc(titel) + '</dc:title><dc:creator>RTG Office</dc:creator>' +
      '<cp:category>' + xmlEsc(label) + '</cp:category>' +
      '<cp:keywords>' + xmlEsc('Classificatie: ' + label) + '</cp:keywords></cp:coreProperties>',
    'docProps/custom.xml': KOP + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" ' +
      'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
      '<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="RTG-Classificatie">' +
      '<vt:lpwstr>' + xmlEsc(label) + '</vt:lpwstr></property></Properties>'
  };
}

module.exports = { xmlEsc, kantoorProps };
