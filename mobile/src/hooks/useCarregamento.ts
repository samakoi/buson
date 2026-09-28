import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

interface Opcoes {
  /** Recarrega sozinho a cada N ms enquanto a tela está visível. */
  intervaloMs?: number;
}

/**
 * Carrega os dados da tela ao focar, com:
 *  - `carregando`: só na primeira carga (spinner de tela cheia)
 *  - `atualizando` + `atualizar()`: para o pull-to-refresh
 *  - recarga silenciosa periódica (opcional)
 */
export function useCarregamento(carregar: () => Promise<void>, { intervaloMs }: Opcoes = {}) {
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);

  // Sempre chama a versão mais recente de `carregar` sem reiniciar o foco/intervalo
  const carregarRef = useRef(carregar);
  useEffect(() => {
    carregarRef.current = carregar;
  });

  const executar = useCallback(async () => {
    try {
      await carregarRef.current();
    } catch (err) {
      console.warn("Falha ao carregar dados", err);
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      executar();
      if (!intervaloMs) return;
      const id = setInterval(executar, intervaloMs);
      return () => clearInterval(id);
    }, [executar, intervaloMs])
  );

  const atualizar = useCallback(async () => {
    setAtualizando(true);
    await executar();
    setAtualizando(false);
  }, [executar]);

  return { carregando, atualizando, atualizar, recarregar: executar };
}
