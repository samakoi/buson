import { describe, expect, it } from "vitest";
import { detectarFormato, nomeSeguro } from "./formatos";

describe("detectarFormato (pelos primeiros bytes, não pela extensão)", () => {
  it.each([
    ["PDF", Buffer.from("%PDF-1.7 ..."), "application/pdf"],
    ["PNG", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]), "image/png"],
    ["JPEG", Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg"],
  ])("reconhece %s", (_nome, conteudo, mimeType) => {
    expect(detectarFormato(conteudo)?.mimeType).toBe(mimeType);
  });

  it.each([
    ["executável", Buffer.from([0x4d, 0x5a, 0x90, 0x00])],
    ["HTML disfarçado", Buffer.from("<html><script>")],
    ["arquivo vazio", Buffer.alloc(0)],
    ["começo incompleto de PNG", Buffer.from([0x89, 0x50])],
  ])("recusa %s", (_nome, conteudo) => {
    expect(detectarFormato(conteudo)).toBeNull();
  });
});

describe("nomeSeguro", () => {
  it("tira pastas e caracteres de controle", () => {
    expect(nomeSeguro("../../etc/passwd", "pdf")).toBe("passwd");
    expect(nomeSeguro("pasta/matrícula.pdf", "pdf")).toBe("matrícula.pdf");
    expect(nomeSeguro("doc\r\nSet-Cookie: x.pdf", "pdf")).toBe("docSet-Cookie: x.pdf");
  });

  it("usa um nome padrão quando não vem nada útil", () => {
    expect(nomeSeguro(undefined, "jpg")).toBe("documento.jpg");
    expect(nomeSeguro("   ", "png", "anexo")).toBe("anexo.png");
  });

  it("limita o tamanho a 180 caracteres", () => {
    expect(nomeSeguro("a".repeat(500) + ".pdf", "pdf")).toHaveLength(180);
  });
});
