/**
 * Gerador de PDF mínimo (Helvetica, texto simples) usado nos relatórios do mês
 * e no envio de relatórios pelo Telegram. Fica fora de route.ts porque arquivos
 * de rota do Next só podem exportar handlers HTTP e configs.
 */

const ascii = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "-");
const pdfEscape = (value: string) => ascii(value).replace(/([\\()])/g, "\\$1");

export function createPdf(title: string, lines: string[]): Uint8Array {
  const pages = Array.from({ length: Math.max(1, Math.ceil(lines.length / 38)) }, (_, page) =>
    lines.slice(page * 38, page * 38 + 38),
  );
  const pageObjectIds = pages.map((_, index) => 4 + index * 2);
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  pages.forEach((pageLines, index) => {
    const pageId = pageObjectIds[index];
    const contentId = pageId + 1;
    objects[pageId - 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    const commands = [
      "BT /F1 17 Tf 48 794 Td",
      `(${pdfEscape(title)}) Tj`,
      "0 -28 Td /F1 9 Tf",
      ...pageLines.flatMap((line) => [`(${pdfEscape(line.slice(0, 105))}) Tj`, "0 -18 Td"]),
      `0 -18 Td (Pagina ${index + 1} de ${pages.length}) Tj ET`,
    ].join("\n");
    objects[contentId - 1] = `<< /Length ${Buffer.byteLength(commands, "latin1")} >>\nstream\n${commands}\nendstream`;
  });
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = Buffer.byteLength(pdf, "latin1");
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}
