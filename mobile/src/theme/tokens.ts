import { Platform, TextStyle, ViewStyle } from "react-native";

/**
 * Design tokens do Bus On. As telas nunca usam cores/tamanhos soltos:
 * tudo vem daqui via useTema() / criarEstilos().
 */

export interface Paleta {
  fundo: string;
  superficie: string;
  superficieAlt: string;
  borda: string;
  bordaForte: string;
  texto: string;
  textoSuave: string;
  textoFraco: string;
  primaria: string; // texto, ícones e destaques
  primariaForte: string; // fundo de botões primários
  primariaSuave: string; // fundos leves (chips, avatares)
  sobrePrimaria: string;
  destaque: string; // cartão principal (marinho)
  sobreDestaque: string;
  sobreDestaqueSuave: string;
  sucesso: string;
  sucessoFundo: string;
  alerta: string;
  alertaFundo: string;
  perigo: string;
  perigoFundo: string;
  perigoForte: string; // fundo de botões destrutivos
  sombra: string;
  overlay: string;
  qrFundo: string; // o QR Code é sempre escuro sobre branco (legível pelo leitor em qualquer tema)
  qrCor: string;
}

export const paletaClara: Paleta = {
  fundo: "#F4F7FB",
  superficie: "#FFFFFF",
  superficieAlt: "#EEF3F9",
  borda: "#E3EAF2",
  bordaForte: "#B6C4D5",
  texto: "#0D2F52",
  textoSuave: "#475569",
  textoFraco: "#5F6E82",
  primaria: "#1E5AA8",
  primariaForte: "#1E5AA8",
  primariaSuave: "#E7F0FB",
  sobrePrimaria: "#FFFFFF",
  destaque: "#0D2F52",
  sobreDestaque: "#FFFFFF",
  sobreDestaqueSuave: "#BFD6EF",
  sucesso: "#137047",
  sucessoFundo: "#E3F4EC",
  alerta: "#8A4E00",
  alertaFundo: "#FFF1D6",
  perigo: "#B42828",
  perigoFundo: "#FCEBEB",
  perigoForte: "#C53030",
  sombra: "#0D2F52",
  overlay: "rgba(8, 20, 34, 0.45)",
  qrFundo: "#FFFFFF",
  qrCor: "#0D2F52",
};

export const paletaEscura: Paleta = {
  fundo: "#0B1520",
  superficie: "#13202E",
  superficieAlt: "#1A2A3B",
  borda: "#223447",
  bordaForte: "#34495F",
  texto: "#E8EFF7",
  textoSuave: "#AFBDCD",
  textoFraco: "#8C9DB1",
  primaria: "#7EB3F0",
  primariaForte: "#2563B8",
  primariaSuave: "#1B3553",
  sobrePrimaria: "#FFFFFF",
  destaque: "#16365A",
  sobreDestaque: "#FFFFFF",
  sobreDestaqueSuave: "#B9D2EE",
  sucesso: "#62D09B",
  sucessoFundo: "#12331F",
  alerta: "#F2BB55",
  alertaFundo: "#3A2A0C",
  perigo: "#F48A8A",
  perigoFundo: "#3D1B1E",
  perigoForte: "#C53030",
  sombra: "#000000",
  overlay: "rgba(0, 0, 0, 0.6)",
  qrFundo: "#FFFFFF",
  qrCor: "#0D2F52",
};

export const espaco = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const raio = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

const numeros: TextStyle = { fontVariant: ["tabular-nums"] };

/** Escala tipográfica única do app. */
export const tipo = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: "800" },
  titulo: { fontSize: 22, lineHeight: 28, fontWeight: "800" },
  subtitulo: { fontSize: 17, lineHeight: 23, fontWeight: "700" },
  corpo: { fontSize: 15, lineHeight: 21, fontWeight: "400" },
  corpoForte: { fontSize: 15, lineHeight: 21, fontWeight: "600" },
  pequeno: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
  pequenoForte: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  legenda: { fontSize: 12, lineHeight: 16, fontWeight: "500" },
  sobrescrito: { fontSize: 11, lineHeight: 14, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  micro: { fontSize: 10, lineHeight: 13, fontWeight: "600" },
  numeroDestaque: { fontSize: 44, lineHeight: 52, fontWeight: "800", ...numeros },
  numeroGrande: { fontSize: 34, lineHeight: 40, fontWeight: "800", ...numeros },
  numero: { fontSize: 22, lineHeight: 28, fontWeight: "800", ...numeros },
  numeroMedio: { fontSize: 18, lineHeight: 24, fontWeight: "800", ...numeros },
} satisfies Record<string, TextStyle>;

export type VarianteTexto = keyof typeof tipo;

/** Sombra suave no claro; no escuro a separação vem da borda. */
export function elevacao(p: Paleta, escuro: boolean, nivel: 1 | 2 = 1): ViewStyle {
  if (escuro) return { borderWidth: 1, borderColor: p.borda };
  const sombra = nivel === 1 ? { y: 2, blur: 8, alpha: 0.06 } : { y: 8, blur: 24, alpha: 0.12 };
  return Platform.select<ViewStyle>({
    web: { boxShadow: `0 ${sombra.y}px ${sombra.blur}px rgba(13, 47, 82, ${sombra.alpha})` },
    default: {
      shadowColor: p.sombra,
      shadowOpacity: sombra.alpha * 1.6,
      shadowRadius: sombra.blur / 2,
      shadowOffset: { width: 0, height: sombra.y / 2 },
      elevation: nivel === 1 ? 2 : 6,
    },
  })!;
}

/** Tons usados por avisos, pílulas e estatísticas. */
export type Tom = "neutro" | "info" | "sucesso" | "alerta" | "perigo";

export function coresDoTom(p: Paleta, tom: Tom): { cor: string; fundo: string } {
  switch (tom) {
    case "info":
      return { cor: p.primaria, fundo: p.primariaSuave };
    case "sucesso":
      return { cor: p.sucesso, fundo: p.sucessoFundo };
    case "alerta":
      return { cor: p.alerta, fundo: p.alertaFundo };
    case "perigo":
      return { cor: p.perigo, fundo: p.perigoFundo };
    default:
      return { cor: p.textoSuave, fundo: p.superficieAlt };
  }
}
