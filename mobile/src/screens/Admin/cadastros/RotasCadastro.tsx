import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { api } from "../../../services/api";
import { PontoEmbarque, Rota, Universidade } from "../../../types";
import { useCarregamento } from "../../../hooks/useCarregamento";
import { criarEstilos, useTema } from "../../../theme/TemaProvider";
import { Aviso, Botao, BotaoIcone, Campo, Card, Carregando, EstadoVazio, Folha, ItemLista, Rotulo, Texto } from "../../../components/ui";
import { avisar, confirmar, mensagemDeErro } from "../../../utils/feedback";
import { BarraSecao } from "./BarraSecao";

/** Seleção em que a ordem dos toques define a ordem (paradas / pontos de embarque). */
function SelecaoOrdenada({
  opcoes,
  selecionados,
  onChange,
  vazio,
}: {
  opcoes: { id: string; nome: string }[];
  selecionados: string[];
  onChange: (ids: string[]) => void;
  vazio: string;
}) {
  const s = useEstilos();
  const alternar = (id: string) => onChange(selecionados.includes(id) ? selecionados.filter((x) => x !== id) : [...selecionados, id]);
  const nomeDe = (id: string) => opcoes.find((o) => o.id === id)?.nome ?? "";
  return (
    <>
      <View style={s.paradas}>
        {opcoes.map((o) => {
          const ordem = selecionados.indexOf(o.id);
          const ativa = ordem >= 0;
          return (
            <Pressable
              key={o.id}
              onPress={() => alternar(o.id)}
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
                {o.nome}
              </Texto>
            </Pressable>
          );
        })}
        {opcoes.length === 0 && (
          <Texto variante="pequeno" cor="textoFraco">
            {vazio}
          </Texto>
        )}
      </View>
      {selecionados.length > 0 && (
        <Texto variante="pequenoForte" cor="primaria" style={{ marginTop: 12 }}>
          {selecionados.map(nomeDe).join(" → ")}
        </Texto>
      )}
    </>
  );
}

export default function RotasCadastro() {
  const { cores } = useTema();
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [universidades, setUniversidades] = useState<Universidade[]>([]);
  const [pontosEmbarque, setPontosEmbarque] = useState<PontoEmbarque[]>([]);
  const [aberto, setAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  // Itens na ordem em que foram tocados = ordem do trajeto
  const [paradas, setParadas] = useState<string[]>([]);
  const [pontos, setPontos] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const { carregando, recarregar } = useCarregamento(async () => {
    const [r, u, p] = await Promise.all([
      api.get<Rota[]>("/rotas"),
      api.get<Universidade[]>("/universidades"),
      api.get<PontoEmbarque[]>("/pontos-embarque"),
    ]);
    setRotas(r.data);
    setUniversidades(u.data);
    setPontosEmbarque(p.data);
  });

  function abrir(r?: Rota) {
    setEditandoId(r?.id ?? null);
    setNome(r?.nome ?? "");
    setParadas(r?.pontos.map((p) => p.universidade.id) ?? []);
    setPontos(r?.pontosEmbarque.map((p) => p.pontoEmbarque.id) ?? []);
    setErro(null);
    setAberto(true);
  }

  function fechar() {
    setAberto(false);
    setEditandoId(null);
  }

  async function salvar() {
    if (nome.trim().length < 2) return setErro("Informe o nome da rota.");
    if (paradas.length === 0) return setErro("Toque nas universidades na ordem das paradas.");
    setErro(null);
    setSalvando(true);
    try {
      const dados = { nome: nome.trim(), universidadeIds: paradas, pontosEmbarqueIds: pontos };
      if (editandoId) await api.patch(`/rotas/${editandoId}`, dados);
      else await api.post("/rotas", dados);
      fechar();
      await recarregar();
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível salvar a rota."));
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

  const rotaEditada = rotas.find((r) => r.id === editandoId);
  const saemParadas = rotaEditada?.pontos.some((p) => !paradas.includes(p.universidade.id));
  const saemPontos = rotaEditada?.pontosEmbarque.some((p) => !pontos.includes(p.pontoEmbarque.id));

  return (
    <View>
      <BarraSecao texto={`${rotas.length} rota(s)`} onAdicionar={() => abrir()} />

      <Card semPadding>
        {rotas.map((r, i) => (
          <ItemLista
            key={r.id}
            icone="git-commit-outline"
            titulo={r.nome}
            subtitulo={
              r.pontos.map((p) => p.universidade.nome).join(" → ") +
              (r.pontosEmbarque.length ? `\nEmbarque: ${r.pontosEmbarque.map((p) => p.pontoEmbarque.nome).join(" → ")}` : "")
            }
            ultimo={i === rotas.length - 1}
            direita={
              <View style={{ flexDirection: "row" }}>
                <BotaoIcone icone="create-outline" rotulo={`Editar ${r.nome}`} onPress={() => abrir(r)} />
                <BotaoIcone icone="trash-outline" rotulo={`Excluir ${r.nome}`} cor={cores.perigo} onPress={() => remover(r)} />
              </View>
            }
          />
        ))}
        {rotas.length === 0 && <EstadoVazio icone="map-outline" titulo="Nenhuma rota" acao={{ titulo: "Adicionar rota", icone: "add", onPress: () => abrir() }} />}
      </Card>

      <Folha visivel={aberto} onFechar={fechar} titulo={editandoId ? "Editar rota" : "Nova rota"}>
        {erro && <Aviso tipo="erro" titulo={erro} />}
        <Campo rotulo="Nome" value={nome} onChangeText={setNome} placeholder="Ex.: Rota Noturna 02" />

        <Rotulo>Pontos de embarque — toque na ordem em que o ônibus passa</Rotulo>
        <SelecaoOrdenada
          opcoes={pontosEmbarque}
          selecionados={pontos}
          onChange={setPontos}
          vazio="Nenhum ponto cadastrado (opcional). Cadastre em Cadastros › Pontos."
        />

        <Rotulo>Instituições — toque na ordem do trajeto</Rotulo>
        <SelecaoOrdenada opcoes={universidades} selecionados={paradas} onChange={setParadas} vazio="Cadastre universidades primeiro." />

        {(saemParadas || saemPontos) && (
          <Aviso tipo="alerta" titulo="Alunos serão avisados" style={{ marginTop: 16, marginBottom: 0 }}>
            {saemParadas ? "Alunos de instituições que saem da rota perdem os dias nela. " : ""}
            {saemPontos ? "Quem embarca num ponto removido precisará escolher outro." : ""}
          </Aviso>
        )}

        <Botao titulo={editandoId ? "Salvar rota" : "Adicionar rota"} icone={editandoId ? "checkmark" : "add"} onPress={salvar} carregando={salvando} style={{ marginTop: 24 }} />
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
