import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { criarEstilos } from "../theme/TemaProvider";
import { confirmar } from "../utils/feedback";
import { nomePapel } from "../utils/rotulos";
import { Texto } from "./Texto";
import { Folha } from "./Folha";
import { Botao } from "./Botao";
import { Pilula } from "./Pilula";

export function iniciaisDe(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

/** Avatar com as iniciais; ao tocar, mostra a conta e o botão de sair. */
export function MenuConta() {
  const { usuario, logout } = useAuth();
  const s = useEstilos();
  const [aberto, setAberto] = useState(false);
  if (!usuario) return null;

  async function sair() {
    if (await confirmar("Sair da conta", "Deseja realmente sair?", { textoConfirmar: "Sair", destrutivo: true })) {
      setAberto(false);
      logout();
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
        <Botao titulo="Sair da conta" icone="log-out-outline" variante="perigoFantasma" onPress={sair} style={{ marginTop: 8 }} />
      </Folha>
    </>
  );
}

const useEstilos = criarEstilos((t) => ({
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: t.cores.primariaSuave, alignItems: "center", justifyContent: "center" },
  perfil: { flexDirection: "row", alignItems: "center", gap: t.espaco.lg, paddingVertical: t.espaco.md },
  avatarGrande: { width: 64, height: 64, borderRadius: 32, backgroundColor: t.cores.primariaSuave, alignItems: "center", justifyContent: "center" },
}));
