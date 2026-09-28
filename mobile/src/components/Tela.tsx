import React from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { criarEstilos, useTema } from "../theme/TemaProvider";

/**
 * Estrutura padrão de uma tela: respeita a área segura do topo, rola, tem
 * "puxar para atualizar" opcional, largura máxima (web/tablet) e um rodapé fixo
 * opcional para a ação principal.
 */
export function Tela({
  children,
  atualizando,
  onAtualizar,
  rodape,
}: {
  children: React.ReactNode;
  atualizando?: boolean;
  onAtualizar?: () => void;
  /** Ação principal fixa acima das abas (ex.: "Iniciar viagem"). */
  rodape?: React.ReactNode;
}) {
  const s = useEstilos();
  const { cores } = useTema();
  const insets = useSafeAreaInsets();
  return (
    <View style={s.raiz}>
      <ScrollView
        style={s.raiz}
        contentContainerStyle={[s.conteudo, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onAtualizar ? <RefreshControl refreshing={!!atualizando} onRefresh={onAtualizar} tintColor={cores.primaria} colors={[cores.primaria]} /> : undefined
        }
      >
        <View style={s.coluna}>{children}</View>
      </ScrollView>
      {rodape ? (
        <View style={s.rodape}>
          <View style={s.coluna}>{rodape}</View>
        </View>
      ) : null}
    </View>
  );
}

const useEstilos = criarEstilos((t) => ({
  raiz: { flex: 1, backgroundColor: t.cores.fundo },
  conteudo: { paddingHorizontal: t.espaco.lg, paddingBottom: t.espaco.xxxl },
  coluna: { width: "100%", maxWidth: 640, alignSelf: "center" },
  rodape: {
    paddingHorizontal: t.espaco.lg,
    paddingTop: t.espaco.md,
    paddingBottom: t.espaco.md,
    backgroundColor: t.cores.fundo,
    borderTopWidth: 1,
    borderTopColor: t.cores.borda,
  },
}));
