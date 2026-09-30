import React, { useEffect, useState } from "react";
import { AppState, Linking, Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Botao } from "../../components/Botao";
import { Logo } from "../../components/Logo";
import { Texto } from "../../components/Texto";
import { API_URL } from "../../services/api";
import { criarEstilos } from "../../theme/TemaProvider";
import { baixarAtualizacaoEmSegundoPlano, infoDaVersao } from "./versao";

interface VersaoMinima {
  versaoMinima: number;
  link: string | null;
}

/** Pergunta à API qual é o versionCode mínimo do APK (rota pública). */
async function buscarVersaoMinima(): Promise<VersaoMinima | null> {
  try {
    const r = await fetch(`${API_URL}/app/versao`);
    if (!r.ok) return null;
    const corpo = await r.json();
    return corpo?.data?.android ?? null;
  } catch {
    return null; // sem internet: não bloqueia o app
  }
}

/**
 * Envolve o app. Quando uma mudança nativa exige um APK novo, o admin sobe
 * APP_VERSAO_MINIMA_ANDROID na API e quem tem um APK mais antigo vê esta tela.
 * Também baixa as atualizações pela internet sempre que o app volta para a tela.
 */
export function AtualizacaoObrigatoria({ children }: { children: React.ReactNode }) {
  const [exigida, setExigida] = useState<VersaoMinima | null>(null);
  const s = useEstilos();

  useEffect(() => {
    const { build } = infoDaVersao();
    const conferir = () => {
      void baixarAtualizacaoEmSegundoPlano();
      if (Platform.OS !== "android" || !build) return;
      void buscarVersaoMinima().then((v) => setExigida(v && build < v.versaoMinima ? v : null));
    };
    conferir();
    const assinatura = AppState.addEventListener("change", (estado) => estado === "active" && conferir());
    return () => assinatura.remove();
  }, []);

  if (!exigida) return <>{children}</>;
  return (
    <SafeAreaView style={s.tela}>
      <View style={s.conteudo}>
        <Logo tamanho={88} />
        <Texto variante="titulo" alinhar="center">
          Atualize o Bus On
        </Texto>
        <Texto cor="textoSuave" alinhar="center">
          Esta versão do app não é mais aceita. Instale a versão nova para continuar — seus dados e seu login continuam os mesmos.
        </Texto>
        {exigida.link ? (
          <Botao titulo="Baixar a versão nova" icone="download-outline" tamanho="grande" onPress={() => Linking.openURL(exigida.link!)} style={s.botao} />
        ) : (
          <Texto variante="pequenoForte" alinhar="center">
            Peça o link do app novo à administração do transporte.
          </Texto>
        )}
        <Texto variante="pequeno" cor="textoFraco" alinhar="center">
          Versão instalada: {infoDaVersao().texto}
        </Texto>
      </View>
    </SafeAreaView>
  );
}

const useEstilos = criarEstilos((t) => ({
  tela: { flex: 1, backgroundColor: t.cores.fundo },
  conteudo: { flex: 1, alignItems: "center", justifyContent: "center", gap: t.espaco.lg, padding: t.espaco.xxl },
  botao: { alignSelf: "stretch" },
}));
