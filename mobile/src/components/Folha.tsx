import React from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { criarEstilos } from "../theme/TemaProvider";
import { Texto } from "./Texto";
import { BotaoIcone } from "./BotaoIcone";

/** Painel que sobe do rodapé (bottom sheet) — formulários e menus sem sair da tela. */
export function Folha({
  visivel,
  onFechar,
  titulo,
  children,
}: {
  visivel: boolean;
  onFechar: () => void;
  titulo: string;
  children: React.ReactNode;
}) {
  const s = useEstilos();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visivel} transparent animationType="slide" onRequestClose={onFechar} statusBarTranslucent>
      <KeyboardAvoidingView style={s.raiz} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={s.fundo} onPress={onFechar} accessibilityLabel="Fechar" />
        <View style={[s.folha, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.alca} />
          <View style={s.cabecalho}>
            <Texto variante="subtitulo" style={{ flex: 1 }}>
              {titulo}
            </Texto>
            <BotaoIcone icone="close" rotulo="Fechar" onPress={onFechar} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.corpo}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useEstilos = criarEstilos((t) => ({
  raiz: { flex: 1, justifyContent: "flex-end" },
  fundo: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.cores.overlay },
  folha: {
    maxHeight: "92%",
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    backgroundColor: t.cores.superficie,
    borderTopLeftRadius: t.raio.xl,
    borderTopRightRadius: t.raio.xl,
  },
  alca: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: t.cores.bordaForte, marginTop: t.espaco.sm },
  cabecalho: { flexDirection: "row", alignItems: "center", paddingLeft: t.espaco.xl, paddingRight: t.espaco.sm, paddingTop: t.espaco.xs },
  corpo: { paddingHorizontal: t.espaco.xl, paddingBottom: t.espaco.sm },
}));
