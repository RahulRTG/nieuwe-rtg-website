/* RTG Office: de vaste onderdelen van een DOCX -- nummering, stijlen,
   inhoudstypen en relaties. Apart van ./docx-schrijf.js omdat dit de
   verpakking is en daar de vertaling van HTML naar alinea's staat. */
'use strict';

const { kantoorProps } = require('./ooxml');

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const KOP = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

// nums: per lijst in het document 0 (opsomming) of 1 (genummerd); numId = index + 1
function docxPakket({ document, koptekst, nums, titel, label }) {
  const nummering = KOP + '<w:numbering xmlns:w="' + W + '">' +
    [0, 1].map(a => '<w:abstractNum w:abstractNumId="' + a + '">' +
      Array.from({ length: 9 }, (_, n) => '<w:lvl w:ilvl="' + n + '"><w:start w:val="1"/><w:numFmt w:val="' +
        (a ? 'decimal' : 'bullet') + '"/><w:lvlText w:val="' + (a ? '%' + (n + 1) + '.' : '•') +
        '"/><w:pPr><w:ind w:left="' + (720 * (n + 1)) + '" w:hanging="360"/></w:pPr></w:lvl>').join('') +
      '</w:abstractNum>').join('') +
    nums.map((a, i) => '<w:num w:numId="' + (i + 1) + '"><w:abstractNumId w:val="' + a + '"/>' +
      '<w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>').join('') + '</w:numbering>';

  const stijl = (id, naam, ppr, rpr) => '<w:style w:type="paragraph" w:styleId="' + id + '"><w:name w:val="' + naam + '"/>' +
    '<w:basedOn w:val="Standaard"/>' + (ppr ? '<w:pPr>' + ppr + '</w:pPr>' : '') + (rpr ? '<w:rPr>' + rpr + '</w:rPr>' : '') + '</w:style>';
  const stijlen = KOP + '<w:styles xmlns:w="' + W + '">' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Standaard"><w:name w:val="Normal"/>' +
    '<w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="22"/></w:rPr></w:style>' +
    stijl('Kop1', 'heading 1', '<w:keepNext/><w:outlineLvl w:val="0"/>', '<w:b/><w:sz w:val="36"/>') +
    stijl('Kop2', 'heading 2', '<w:keepNext/><w:outlineLvl w:val="1"/>', '<w:b/><w:sz w:val="30"/>') +
    stijl('Kop3', 'heading 3', '<w:keepNext/><w:outlineLvl w:val="2"/>', '<w:b/><w:sz w:val="26"/>') +
    stijl('Citaat', 'Quote', '<w:ind w:left="720"/>', '<w:i/>') +
    stijl('Lijstalinea', 'List Paragraph', '<w:ind w:left="720"/>', '') + '</w:styles>';

  const T = 'application/vnd.openxmlformats-officedocument.wordprocessingml.';
  const bestanden = Object.assign({
    '[Content_Types].xml': KOP + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="' + T + 'document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="' + T + 'styles+xml"/>' +
      '<Override PartName="/word/numbering.xml" ContentType="' + T + 'numbering+xml"/>' +
      '<Override PartName="/word/header1.xml" ContentType="' + T + 'header+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/>' +
      '</Types>',
    'word/_rels/document.xml.rels': KOP + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rIdStijl" Type="' + NS_R + '/styles" Target="styles.xml"/>' +
      '<Relationship Id="rIdNum" Type="' + NS_R + '/numbering" Target="numbering.xml"/>' +
      '<Relationship Id="rIdKop" Type="' + NS_R + '/header" Target="header1.xml"/></Relationships>',
    'word/document.xml': document, 'word/styles.xml': stijlen, 'word/numbering.xml': nummering,
    'word/header1.xml': koptekst
  }, kantoorProps({ hoofd: 'word/document.xml', titel, label }));
  return bestanden;
}

module.exports = { docxPakket };
