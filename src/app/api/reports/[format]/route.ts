import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import { apiError, sanitizeCsvCell } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { and, desc, eq, like } from "drizzle-orm";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ format: string }> };
const MONTH_RE = /^\d{4}-\d{2}$/;
const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
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

export async function GET(request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const format = (await ctx.params).format.toLowerCase();
    const month = new URL(request.url).searchParams.get("month") ?? "";
    if (!MONTH_RE.test(month)) return NextResponse.json({ error: "Mês inválido." }, { status: 400 });
    if (format !== "csv" && format !== "pdf")
      return NextResponse.json({ error: "Formato inválido." }, { status: 400 });
    const rows = await db
      .select({
        date: transactions.date,
        description: transactions.description,
        type: transactions.type,
        category: categories.name,
        amountCents: transactions.amountCents,
        installmentNumber: transactions.installmentNumber,
        installmentTotal: transactions.installmentTotal,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(eq(transactions.userId, user.id), like(transactions.date, `${month}%`)))
      .orderBy(desc(transactions.date), desc(transactions.id));
    const income = rows.reduce((sum, row) => sum + (row.type === "income" ? row.amountCents : 0), 0);
    const expense = rows.reduce((sum, row) => sum + (row.type === "expense" ? row.amountCents : 0), 0);
    const filename = `aurum-${month}.${format}`;
    if (format === "csv") {
      const header = ["Data", "Descrição", "Tipo", "Categoria", "Parcela", "Valor (R$)"];
      const content = [
        header.map(sanitizeCsvCell).join(";"),
        ...rows.map((row) =>
          [
            row.date,
            row.description,
            row.type === "income" ? "Receita" : "Despesa",
            row.category,
            row.installmentTotal ? `${row.installmentNumber}/${row.installmentTotal}` : "",
            money(row.amountCents),
          ].map(sanitizeCsvCell).join(";"),
        ),
      ].join("\r\n");
      return new Response(`\ufeff${content}`, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }
    const lines = [
      `Receitas: R$ ${money(income)} | Despesas: R$ ${money(expense)} | Saldo: R$ ${money(income - expense)}`,
      "",
      ...rows.map((row) =>
        `${row.date} | ${row.type === "income" ? "+" : "-"} R$ ${money(row.amountCents)} | ${row.category} | ${row.description}${
          row.installmentTotal ? ` (${row.installmentNumber}/${row.installmentTotal})` : ""
        }`,
      ),
    ];
    const pdf = createPdf(`Aurum - relatorio ${month}`, lines);
    const pdfBody = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
    return new Response(pdfBody, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
