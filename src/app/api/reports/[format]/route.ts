import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import { apiError, sanitizeCsvCell } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createPdf } from "@/lib/pdf";
import { and, desc, eq, like } from "drizzle-orm";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ format: string }> };
const MONTH_RE = /^\d{4}-\d{2}$/;
const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

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
