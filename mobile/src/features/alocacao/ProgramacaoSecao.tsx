import React from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Programacao } from "../../types";
import type { PilhaAdmin } from "../../navigation/AdminTabs";
import { criarEstilos } from "../../theme/TemaProvider";
import { Botao, Card, Carregando, EstadoVazio, Pilula, Rotulo, Texto } from "../../components/ui";
import { avisar, confirmar, mensagemDeErro } from "../../utils/feedback";
import { DIAS_SEMANA, listarDias } from "../../utils/datas";
import { useExcluirProgramacao, useGerarViagens, useProgramacoes, useSalvarProgramacao } from "./api";

/** Ocupação de cada dia: alunos com dia fixo / lugares do ônibus. */
export function OcupacaoDias({ dias }: { dias: { diaSemana: number; alocados: number; capacidade: number }[] }) {
  const s = useEstilos();
  return (
    <View style={s.ocupacao}>
      {dias.map((d) => {
        const cheio = d.alocados >= d.capacidade;
        const quase = !cheio && d.alocados >= d.capacidade * 0.9;
        return (
          <View key={d.diaSemana} style={[s.dia, cheio && s.diaCheio, quase && s.diaQuase]}>
            <Texto variante="legenda" cor={cheio ? "perigo" : quase ? "alerta" : "textoSuave"}>
              {DIAS_SEMANA[d.diaSemana]}
            </Texto>
            <Texto variante="pequenoForte" cor={cheio ? "perigo" : quase ? "alerta" : "texto"}>
              {d.alocados}/{d.capacidade}
            </Texto>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Programação semanal de cada rota. Ela gera sozinha as viagens de ida e volta dos
 * próximos 7 dias (os alunos com dia fixo já entram com vaga garantida).
 */
export function ProgramacaoSecao({
  aoMudarViagens,
}: {
  /** Chamado quando viagens podem ter sido criadas/alteradas (para a lista de viagens recarregar). */
  aoMudarViagens: () => void;
}) {
  const s = useEstilos();
  const navegacao = useNavigation<NativeStackNavigationProp<PilhaAdmin>>();
  const { data: programacoes = [], isLoading } = useProgramacoes();
  const salvar = useSalvarProgramacao(aoMudarViagens);
  const excluir = useExcluirProgramacao();
  const gerar = useGerarViagens();
  // Criar e editar abrem a tela da viagem, com a rota (ida e volta) dentro dela
  const abrir = (p?: Programacao) => navegacao.navigate("EditarViagem", p ? { programacaoId: p.id } : undefined);

  async function alternarAtiva(p: Programacao) {
    if (p.ativa) {
      const ok = await confirmar(
        "Suspender programação",
        `As viagens futuras da ${p.rota.nome} serão canceladas e os alunos com dias fixos nela serão avisados para escolher outra rota. Continuar?`,
        { textoConfirmar: "Suspender", destrutivo: true }
      );
      if (!ok) return;
    }
    try {
      await salvar.mutateAsync({ id: p.id, dados: { ativa: !p.ativa } });
    } catch (err) {
      avisar("Não foi possível alterar", mensagemDeErro(err, "Tente novamente."));
    }
  }

  async function remover(p: Programacao) {
    const ok = await confirmar(
      "Excluir programação",
      `Excluir a programação da ${p.rota.nome}? As viagens futuras são canceladas (as já feitas continuam no histórico) e os alunos com dias fixos nela serão avisados.`,
      { textoConfirmar: "Excluir", destrutivo: true }
    );
    if (!ok) return;
    try {
      await excluir.mutateAsync(p.id);
      aoMudarViagens();
    } catch (err) {
      avisar("Não foi possível excluir", mensagemDeErro(err, "Tente novamente."));
    }
  }

  async function gerarAgora() {
    try {
      const { criadas } = await gerar.mutateAsync();
      aoMudarViagens();
      avisar(
        "Viagens em dia",
        criadas > 0 ? `${criadas} viagem(ns) criada(s) para os próximos dias.` : "Todas as viagens dos próximos 7 dias já estavam criadas."
      );
    } catch (err) {
      avisar("Não foi possível gerar", mensagemDeErro(err, "Tente novamente."));
    }
  }

  if (isLoading) return <Carregando />;

  return (
    <View>
      <View style={s.barra}>
        <Texto variante="pequenoForte" cor="textoSuave" style={{ flex: 1 }}>
          As viagens dos próximos 7 dias são criadas sozinhas, a cada hora.
        </Texto>
      </View>
      <View style={s.acoes}>
        <Botao titulo="Nova viagem" icone="add" onPress={() => abrir()} style={{ flex: 1 }} />
        <Botao
          titulo="Gerar agora"
          icone="refresh"
          variante="secundario"
          onPress={gerarAgora}
          carregando={gerar.isPending}
          style={{ flex: 1 }}
        />
      </View>

      {programacoes.length === 0 && (
        <Card>
          <EstadoVazio
            icone="repeat-outline"
            titulo="Nenhuma viagem programada"
            texto="Crie a viagem uma vez (ida e volta, dias, ônibus e motorista) e as viagens de cada dia passam a ser criadas sozinhas."
            acao={{ titulo: "Nova viagem", icone: "add", onPress: () => abrir() }}
          />
        </Card>
      )}

      {programacoes.map((p) => (
        <Card key={p.id} style={[s.cartao, !p.ativa && { opacity: 0.7 }]}>
          <View style={s.topo}>
            <Texto variante="subtitulo" style={{ flex: 1 }} numberOfLines={2}>
              {p.rota.nome}
            </Texto>
            <Pilula texto={p.ativa ? "Ativa" : "Suspensa"} tom={p.ativa ? "sucesso" : "neutro"} icone={p.ativa ? "repeat" : "pause"} />
          </View>
          <Texto variante="pequeno" cor="textoSuave">
            {listarDias(p.diasSemana)}
          </Texto>
          <Texto variante="pequeno">
            Ida {p.horarioIda} • {p.rota.trechos.ida.origem} → {p.rota.trechos.ida.destino}
          </Texto>
          <Texto variante="pequeno">
            {p.horarioVolta ? `Volta ${p.horarioVolta} • ${p.rota.trechos.volta.origem} → ${p.rota.trechos.volta.destino}` : "Sem volta"}
          </Texto>
          <Texto variante="pequeno" cor="textoSuave">
            {p.onibus.placa} ({p.onibus.capacidade} lugares) • {p.motorista.usuario.nome}
          </Texto>
          {p.onibus.emManutencao && <Pilula texto="Ônibus em manutenção" tom="alerta" icone="construct" />}

          <Rotulo>Alunos com dia fixo</Rotulo>
          <OcupacaoDias dias={p.ocupacao} />

          <View style={[s.acoes, { marginTop: 16, marginBottom: 0 }]}>
            <Botao
              titulo="Editar"
              icone="create-outline"
              variante="secundario"
              onPress={() => abrir(p)}
              style={{ flex: 1, minHeight: 44 }}
            />
            <Botao
              titulo={p.ativa ? "Suspender" : "Reativar"}
              icone={p.ativa ? "pause-circle-outline" : "play-circle-outline"}
              variante="secundario"
              onPress={() => alternarAtiva(p)}
              style={{ flex: 1, minHeight: 44 }}
            />
          </View>
          <Botao
            titulo="Excluir programação"
            icone="trash-outline"
            variante="perigoFantasma"
            onPress={() => remover(p)}
            style={{ minHeight: 40 }}
          />
        </Card>
      ))}
    </View>
  );
}

const useEstilos = criarEstilos((t) => ({
  barra: { marginBottom: t.espaco.md },
  acoes: { flexDirection: "row", gap: t.espaco.sm, marginBottom: t.espaco.lg },
  cartao: { marginBottom: t.espaco.md, gap: t.espaco.xs },
  topo: { flexDirection: "row", alignItems: "center", gap: t.espaco.sm, marginBottom: t.espaco.xs },
  ocupacao: { flexDirection: "row", flexWrap: "wrap", gap: t.espaco.sm },
  dia: {
    minWidth: 56,
    alignItems: "center",
    paddingVertical: t.espaco.xs + 2,
    paddingHorizontal: t.espaco.sm,
    borderRadius: t.raio.md,
    backgroundColor: t.cores.superficieAlt,
  },
  diaCheio: { backgroundColor: t.cores.perigoFundo },
  diaQuase: { backgroundColor: t.cores.alertaFundo },
}));
