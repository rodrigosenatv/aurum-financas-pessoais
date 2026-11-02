/**
 * Constantes de tema compartilhadas entre o servidor (layout) e o cliente.
 * Sem "use client": o layout precisa importar o script inline.
 */

export const THEME_STORAGE_KEY = "aurum-theme";

/** Cor da barra do navegador/sistema para cada tema (meta theme-color). */
export const THEME_COLORS = {
  light: "#f4f5ef",
  dark: "#060807",
} as const;

/**
 * Roda antes da primeira pintura: aplica o tema salvo (ou o do sistema) em
 * <html data-theme>, evitando o "flash" do tema errado ao carregar a página.
 */
export const THEME_SCRIPT = `(function(){try{var d=document.documentElement,p=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)}),t=p==="light"||p==="dark"?p:(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");d.setAttribute("data-theme",t);if(p==="light"||p==="dark"){var c=t==="light"?${JSON.stringify(
  THEME_COLORS.light,
)}:${JSON.stringify(
  THEME_COLORS.dark,
)};var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++)m[i].setAttribute("content",c);}}catch(e){}})();`;
