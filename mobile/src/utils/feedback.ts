import { Alert, Platform } from "react-native";

// No navegador o Alert do React Native não faz nada; lá usamos alert/confirm nativos.

export function avisar(titulo: string, mensagem?: string) {
  if (Platform.OS === "web") {
    window.alert(mensagem ? `${titulo}\n\n${mensagem}` : titulo);
    return;
  }
  Alert.alert(titulo, mensagem);
}

interface OpcoesConfirmacao {
  textoConfirmar?: string;
  destrutivo?: boolean;
}

/** Pergunta ao usuário e resolve `true` se ele confirmar. */
export function confirmar(titulo: string, mensagem: string, opcoes: OpcoesConfirmacao = {}): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(`${titulo}\n\n${mensagem}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      titulo,
      mensagem,
      [
        { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
        {
          text: opcoes.textoConfirmar ?? "Confirmar",
          style: opcoes.destrutivo ? "destructive" : "default",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

/** Mensagem de erro da API (campo `erro`) ou um texto padrão. */
export function mensagemDeErro(err: unknown, padrao: string): string {
  const e = err as { response?: { data?: { erro?: string } }; message?: string };
  if (e?.response?.data?.erro) return e.response.data.erro;
  if (e?.message === "Network Error") return "Sem conexão com o servidor. Verifique sua internet e tente novamente.";
  return padrao;
}
