import { RequestHandler, Router } from "express";
import { autenticar } from "../middlewares/auth";
import { Permissao } from "../auth/permissoes";
import { caminhoMontado } from "../routes/montar";

/** Uma rota da API como o Express a conhece: método, caminho completo e quem pode chamar. */
export interface RotaInventariada {
  metodo: "get" | "post" | "put" | "patch" | "delete";
  /** Caminho no formato do Express, relativo a /api/v1 (ex.: "/alunos/:id") */
  caminho: string;
  autenticada: boolean;
  /** Basta uma delas (vazio = qualquer usuário logado) */
  permissoes: Permissao[];
}

// Partes internas do Express 4 que o inventário lê (não fazem parte dos tipos públicos)
interface Camada {
  handle: RequestHandler & { stack?: Camada[]; permissoes?: Permissao[] };
  route?: { path: string; methods: Record<string, boolean>; stack: Camada[] };
}

interface Acesso {
  autenticada: boolean;
  permissoes: Permissao[];
}

function aplicar(acesso: Acesso, camada: Camada): Acesso {
  if (camada.handle === autenticar) return { ...acesso, autenticada: true };
  // Middlewares em sequência (router.use(a), depois router.use(b)) precisam de TODAS: fica a última exigida
  if (camada.handle.permissoes) return { ...acesso, permissoes: camada.handle.permissoes };
  return acesso;
}

function percorrer(roteador: Router, prefixo: string, herdado: Acesso, saida: RotaInventariada[]) {
  let acesso = herdado;
  for (const camada of (roteador as unknown as { stack: Camada[] }).stack) {
    if (camada.route) {
      const daRota = camada.route.stack.reduce(aplicar, acesso);
      for (const metodo of Object.keys(camada.route.methods) as RotaInventariada["metodo"][]) {
        saida.push({ metodo, caminho: prefixo + (camada.route.path === "/" && prefixo ? "" : camada.route.path), ...daRota });
      }
    } else if (camada.handle.stack) {
      const caminho = caminhoMontado(camada.handle as unknown as Router);
      if (caminho === undefined) throw new Error("Sub-roteador montado sem montar(): a documentação não sabe o caminho dele");
      percorrer(camada.handle as unknown as Router, prefixo + caminho, acesso, saida);
    } else {
      acesso = aplicar(acesso, camada);
    }
  }
  return saida;
}

/** Todas as rotas do roteador principal, na ordem em que o Express as avalia. */
export function inventariarRotas(raiz: Router): RotaInventariada[] {
  return percorrer(raiz, "", { autenticada: false, permissoes: [] }, []);
}
