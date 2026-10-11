import { Router } from "express";

// Caminho em que cada sub-roteador foi montado (o Express não guarda isso de forma legível)
const caminhos = new WeakMap<Router, string>();

/** pai.use(caminho, filho), registrando o caminho para a documentação OpenAPI (docs/openapi.ts). */
export function montar(pai: Router, caminho: string, filho: Router) {
  caminhos.set(filho, caminho);
  pai.use(caminho, filho);
}

export function caminhoMontado(roteador: Router): string | undefined {
  return caminhos.get(roteador);
}
