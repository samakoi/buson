import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { api } from "../../../services/api";
import { Rota, Universidade } from "../../../types";
import { useCarregamento } from "../../../hooks/useCarregamento";
import { criarEstilos, useTema } from "../../../theme/TemaProvider";
import { Aviso, Botao, BotaoIcone, Campo, Card, Carregando, EstadoVazio, Folha, ItemLista, Rotulo, Texto } from "../../../components/ui";
import { avisar, confirmar, mensagemDeErro } from "../../../utils/feedback";
import { BarraSecao } from "./BarraSecao";

export default function RotasCadastro() {
  const { cores } = useTema();
  const s = useEstilos();
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [universidades, setUniversidades] = useState<Universidade[]>([]);
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  // Universidades na ordem em que foram tocadas = ordem das paradas
  const [paradas, setParadas] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const { carregando, recarregar } = useCarregamento(async () => {
    const [r, u] = await Promise.all([api.get<Rota[]>("/rotas"), api.get<Universidade[]>("/universidades")]);
    setRotas(r.data);
    setUniversidades(u.data);
  });

  function alternarParada(id: string) {
    setParadas((atual) => (atual.includes(id) ? atual.filter((p) => p !== id) : [...atual, id]));
  }

  function fechar() {
    setAberto(false);
    setNome("");
    setParadas([]);
    setErro(null);
  }

  async function adicionar() {
    if (nome.trim().length < 2) return setErro("Informe o nome da rota.");
    if (paradas.length === 0) return setErro("Toque nas universidades na ordem das paradas.");
    setErro(null);
    setSalvando(true);
    try {
      await api.post("/rotas", { nome: nome.trim(), universidadeIds: paradas });
      fechar();
      await recarregar();
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível cadastrar a rota."));
    } finally {
      setSalvando(false);
    }
  }

  async function remover(r: Rota) {
    const ok = await confirmar("Excluir rota", `Excluir a rota ${r.nome}?`, { textoConfirmar: "Excluir", destrutivo: true });
    if (!ok) return;
    try {
      await api.delete(`/rotas/${r.id}`);
      await recarregar();
    } catch (err) {
      avisar("Não foi possível excluir", mensagemDeErro(err, "Tente novamente.") + " Rotas com viagens cadastradas não podem ser excluídas.");
    }
  }

  if (carregando) return <Carregando />;

  const nomeDe = (id: string) => universidades.find((u) => u.id === id)?.nome ?? "";

  return (
    <View>
      <BarraSecao texto={`${rotas.length} rota(s)`} onAdicionar={() => setAberto(true)} />

      <Card semPadding>
        {rotas.map((r, i) => (
          <ItemLista
            key={r.id}
            icone="git-commit-outline"
            titulo={r.nome}
            subtitulo={r.pontos.map((p) => p.universidade.nome).join(" → ")}
            ultimo={i === rotas.length - 1}
            direita={<BotaoIcone icone="trash-outline" rotulo={`Excluir ${r.nome}`} cor={cores.perigo} onPress={() => remover(r)} />}
          />
        ))}
        {rotas.length === 0 && <EstadoVazio icone="map-outline" titulo="Nenhuma rota" acao={{ titulo: "Adicionar rota", icone: "add", onPress: () => setAberto(true) }} />}
      </Card>

      <Folha visivel={aberto} onFechar={fechar} titulo="Nova rota">
        {erro && <Aviso tipo="erro" titulo={erro} />}
        <Campo rotulo="Nome" value={nome} onChangeText={setNome} placeholder="Ex.: Rota Noturna 02" />

        <Rotulo>Paradas — toque na ordem do trajeto</Rotulo>
        <View style={s.paradas}>
          {universidades.map((u) => {
            const ordem = paradas.indexOf(u.id);
            const ativa = ordem >= 0;
            return (
              <Pressable
                key={u.id}
                onPress={() => alternarParada(u.id)}
                style={[s.parada, ativa && s.paradaAtiva]}
                accessibilityRole="button"
                accessibilityState={{ selected: ativa }}
              >
                {ativa && (
                  <View style={s.ordem}>
                    <Texto variante="legenda" cor="primaria" style={{ fontWeight: "800" }}>
                      {ordem + 1}
                    </Texto>
                  </View>
                )}
                <Texto variante="pequenoForte" cor={ativa ? "sobrePrimaria" : "texto"}>
                  {u.nome}
                </Texto>
              </Pressable>
            );
          })}
          {universidades.length === 0 && (
            <Texto variante="pequeno" cor="textoFraco">
              Cadastre universidades primeiro.
            </Texto>
          )}
        </View>
        {paradas.length > 0 && (
          <Texto variante="pequenoForte" cor="primaria" style={{ marginTop: 12 }}>
            {paradas.map(nomeDe).join(" → ")}
          </Texto>
        )}

        <Botao titulo="Adicionar rota" icone="add" onPress={adicionar} carregando={salvando} style={{ marginTop: 24 }} />
      </Folha>
    </View>
  );
}

const useEstilos = criarEstilos((t) => ({
  paradas: { flexDirection: "row", flexWrap: "wrap", gap: t.espaco.sm },
  parada: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: t.espaco.sm,
    borderRadius: t.raio.pill,
    borderWidth: 1.5,
    borderColor: t.cores.borda,
    backgroundColor: t.cores.superficie,
    paddingHorizontal: t.espaco.md,
  },
  paradaAtiva: { backgroundColor: t.cores.primariaForte, borderColor: t.cores.primariaForte },
  ordem: { width: 22, height: 22, borderRadius: 11, backgroundColor: t.cores.superficie, alignItems: "center", justifyContent: "center" },
}));
