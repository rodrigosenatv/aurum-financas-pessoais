import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "aurum · finanças pessoais",
    short_name: "aurum",
    description: "Tracker de finanças pessoais: fluxo de caixa, cartões, orçamentos e metas financeiras.",
    start_url: "/",
    display: "standalone",
    background_color: "#060807",
    theme_color: "#060807",
    orientation: "portrait-primary",
    scope: "/",
    lang: "pt-BR",
    categories: ["finance", "productivity", "utilities"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
    shortcuts: [
      {
        name: "Novo Lançamento",
        short_name: "Novo",
        description: "Adicionar nova receita ou despesa",
        url: "/?action=new",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Visão Geral",
        short_name: "Resumo",
        description: "Ver resumo e gráficos financeiros",
        url: "/?tab=overview",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Transações",
        short_name: "Extrato",
        description: "Ver extrato detalhado de lançamentos",
        url: "/?tab=transactions",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
