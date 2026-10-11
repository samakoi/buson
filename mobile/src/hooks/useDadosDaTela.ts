import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

/** O que a tela precisa de uma consulta do React Query (useQuery / useInfiniteQuery). */
interface Consulta {
  refetch: () => Promise<unknown>;
  /** Primeira carga em andamento (sem dados ainda); consulta desligada não conta */
  isLoading: boolean;
}

/**
 * Comportamento padrão das telas que buscam dados com o React Query:
 *  - `carregando`: só na primeira carga (spinner de tela cheia)
 *  - `atualizando` + `atualizar()`: para o "puxar para atualizar"
 *  - `recarregar()`: busca de novo (depois de salvar algo, por exemplo)
 *  - recarrega ao voltar para a tela e, se pedido, a cada `intervaloMs` enquanto ela está visível
 * O cache fica no React Query: telas que mostram os mesmos dados não buscam duas vezes.
 */
export function useDadosDaTela(consultas: Consulta | Consulta[], { intervaloMs }: { intervaloMs?: number } = {}) {
  const lista = Array.isArray(consultas) ? consultas : [consultas];

  // Sempre a versão mais recente das consultas, sem reiniciar o foco/intervalo
  const atuais = useRef(lista);
  useEffect(() => {
    atuais.current = lista;
  });

  const recarregar = useCallback(async () => {
    await Promise.all(atuais.current.map((c) => c.refetch()));
  }, []);

  // A primeira busca já acontece ao montar (useQuery); depois, a cada vez que a tela volta ao foco
  const montada = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (montada.current) recarregar();
      else montada.current = true;
      if (!intervaloMs) return;
      const id = setInterval(recarregar, intervaloMs);
      return () => clearInterval(id);
    }, [recarregar, intervaloMs])
  );

  const [atualizando, setAtualizando] = useState(false);
  const atualizar = useCallback(async () => {
    setAtualizando(true);
    try {
      await recarregar();
    } finally {
      setAtualizando(false);
    }
  }, [recarregar]);

  return { carregando: lista.some((c) => c.isLoading), atualizando, atualizar, recarregar };
}
