import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { useSessao } from "../store/sessao";
import { criarEstilos } from "../theme/TemaProvider";
import { avisar, confirmar, mensagemDeErro } from "../utils/feedback";
import { nomePapel } from "../utils/rotulos";
import { Texto } from "./Texto";
import { Folha } from "./Folha";
import { Botao } from "./Botao";
import { Pilula } from "./Pilula";
import { infoDaVersao, procurarEAplicarAtualizacao } from "../features/atualizacao/versao";

export function iniciaisDe(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

/** Avatar com as iniciais; ao tocar, mostra a conta e o botão de sair. */
export function MenuConta() {
  const { usuario, logout, sairDeTodos } = useSessao();
  const s = useEstilos();
  const [aberto, setAberto] = useState(false);
  const [procurando, setProcurando] = useState(false);
  if (!usuario) return null;

  async function procurarAtualizacao() {
    setProcurando(true);
    try {
      const r = await procurarEAplicarAtualizacao();
      if (r === "sem-novidade") avisar("Tudo em dia", "Você já está com a versão mais recente do Bus On.");
      if (r === "indisponivel") avisar("Atualizações", "Neste modo (Expo Go ou navegador) o app não recebe atualizações pela internet.");
    } catch (err) {
      avisar("Não foi possível atualizar", mensagemDeErro(err, "Confira a internet e tente de novo."));
    } finally {
      setProcurando(false);
    }
  }

  async function sair() {
    if (await confirmar("Sair da conta", "Deseja realmente sair?", { textoConfirmar: "Sair", destrutivo: true })) {
      setAberto(false);
      logout();
    }
  }

  async function sairDeTodosOsAparelhos() {
    const ok = await confirmar(
      "Sair de todos os aparelhos",
      "Sua conta será desconectada deste e de todos os outros aparelhos. Use se perdeu o celular ou entrou num aparelho de outra pessoa.",
      { textoConfirmar: "Sair de todos", destrutivo: true }
    );
    if (!ok) return;
    try {
      setAberto(false);
      await sairDeTodos();
    } catch (err) {
      avisar("Não foi possível sair", mensagemDeErro(err, "Tente novamente."));
    }
  }

  return (
    <>
      <Pressable
        onPress={() => setAberto(true)}
        accessibilityRole="button"
        accessibilityLabel={`Conta de ${usuario.nome}`}
        hitSlop={6}
        style={({ pressed }) => [s.avatar, pressed && { opacity: 0.8 }]}
      >
        <Texto variante="pequenoForte" cor="primaria">
          {iniciaisDe(usuario.nome)}
        </Texto>
      </Pressable>

      <Folha visivel={aberto} onFechar={() => setAberto(false)} titulo="Sua conta">
        <View style={s.perfil}>
          <View style={s.avatarGrande}>
            <Texto variante="titulo" cor="primaria">
              {iniciaisDe(usuario.nome)}
            </Texto>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Texto variante="subtitulo">{usuario.nome}</Texto>
            <Texto variante="pequeno" cor="textoSuave">
              {usuario.email}
            </Texto>
            <Pilula texto={nomePapel[usuario.papel]} tom="info" />
          </View>
        </View>
        <Botao titulo="Sair deste aparelho" icone="log-out-outline" variante="perigoFantasma" onPress={sair} style={{ marginTop: 8 }} />
        <Botao titulo="Sair de todos os aparelhos" icone="phone-portrait-outline" variante="fantasma" onPress={sairDeTodosOsAparelhos} />
        <View style={s.versao}>
          <Texto variante="pequeno" cor="textoFraco" alinhar="center">
            Bus On {infoDaVersao().texto}
          </Texto>
          <Botao titulo="Procurar atualização" icone="refresh-outline" variante="fantasma" carregando={procurando} onPress={procurarAtualizacao} />
        </View>
      </Folha>
    </>
  );
}

const useEstilos = criarEstilos((t) => ({
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: t.cores.primariaSuave, alignItems: "center", justifyContent: "center" },
  perfil: { flexDirection: "row", alignItems: "center", gap: t.espaco.lg, paddingVertical: t.espaco.md },
  versao: { marginTop: t.espaco.md, paddingTop: t.espaco.md, borderTopWidth: 1, borderTopColor: t.cores.borda, gap: t.espaco.xs },
  avatarGrande: { width: 64, height: 64, borderRadius: 32, backgroundColor: t.cores.primariaSuave, alignItems: "center", justifyContent: "center" },
}));
