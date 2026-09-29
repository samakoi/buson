import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { Motorista, Onibus, Programacao, Rota } from "../../types";
import { criarEstilos } from "../../theme/TemaProvider";
import { Aviso, Botao, Campo, Card, Carregando, Chips, EstadoVazio, Folha, Pilula, Rotulo, Texto } from "../../components/ui";
import { avisar, confirmar, mensagemDeErro } from "../../utils/feedback";
import { DIAS_SEMANA, listarDias, mascararHora } from "../../utils/datas";
import { useExcluirProgramacao, useGerarViagens, useProgramacoes, useSalvarProgramacao } from "./api";

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const DIAS_UTEIS = [1, 2, 3, 4, 5];

type Formulario = {
  id?: string;
  rotaId: string | null;
  motoristaId: string | null;
  onibusId: string | null;
  horarioIda: string;
  horarioVolta: string;
  diasSemana: number[];
};

const novo: Formulario = { rotaId: null, motoristaId: null, onibusId: null, horarioIda: "", horarioVolta: "", diasSemana: DIAS_UTEIS };

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

/** Seleção de vários dias da semana (Dom … Sáb). */
function DiasDaSemana({ valor, onChange }: { valor: number[]; onChange: (dias: number[]) => void }) {
  const s = useEstilos();
  return (
    <View style={s.diasSemana}>
      {DIAS_SEMANA.map((nome, dia) => {
        const ativo = valor.includes(dia);
        return (
          <Pressable
            key={dia}
            onPress={() => onChange(ativo ? valor.filter((d) => d !== dia) : [...valor, dia].sort())}
            style={[s.botaoDia, ativo && s.botaoDiaAtivo]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: ativo }}
          >
            <Texto variante="pequenoForte" cor={ativo ? "sobrePrimaria" : "texto"}>
              {nome}
            </Texto>
          </Pressable>
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
  rotas,
  onibus,
  motoristas,
  aoMudarViagens,
}: {
  rotas: Rota[];
  onibus: Onibus[];
  motoristas: Motorista[];
  /** Chamado quando viagens podem ter sido criadas/alteradas (para a lista de viagens recarregar). */
  aoMudarViagens: () => void;
}) {
  const s = useEstilos();
  const { data: programacoes = [], isLoading } = useProgramacoes();
  const [form, setForm] = useState<Formulario | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useSalvarProgramacao(() => {
    setForm(null);
    aoMudarViagens();
  });
  const excluir = useExcluirProgramacao();
  const gerar = useGerarViagens();

  function abrir(p?: Programacao) {
    setErro(null);
    setForm(
      p
        ? { id: p.id, rotaId: p.rotaId, motoristaId: p.motoristaId, onibusId: p.onibusId, horarioIda: p.horarioIda, horarioVolta: p.horarioVolta ?? "", diasSemana: p.diasSemana }
        : novo
    );
  }

  function escolherMotorista(id: string) {
    if (!form) return;
    // Sugere o ônibus do motorista
    const doMotorista = motoristas.find((m) => m.id === id)?.onibusId;
    setForm({ ...form, motoristaId: id, onibusId: doMotorista ?? form.onibusId });
  }

  async function confirmarFormulario() {
    if (!form) return;
    if (!form.rotaId) return setErro("Selecione a rota.");
    if (!form.motoristaId) return setErro("Selecione o motorista.");
    if (!form.onibusId) return setErro("Selecione o ônibus.");
    if (!HORA.test(form.horarioIda)) return setErro("Informe o horário da ida (HH:MM).");
    if (form.horarioVolta && !HORA.test(form.horarioVolta)) return setErro("Informe o horário da volta (HH:MM) ou deixe em branco.");
    if (form.diasSemana.length === 0) return setErro("Escolha ao menos um dia da semana.");
    setErro(null);
    try {
      await salvar.mutateAsync({
        id: form.id,
        dados: {
          rotaId: form.rotaId,
          motoristaId: form.motoristaId,
          onibusId: form.onibusId,
          horarioIda: form.horarioIda,
          horarioVolta: form.horarioVolta || null,
          diasSemana: form.diasSemana,
        },
      });
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível salvar a programação."));
    }
  }

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
      avisar("Viagens em dia", criadas > 0 ? `${criadas} viagem(ns) criada(s) para os próximos dias.` : "Todas as viagens dos próximos 7 dias já estavam criadas.");
    } catch (err) {
      avisar("Não foi possível gerar", mensagemDeErro(err, "Tente novamente."));
    }
  }

  if (isLoading) return <Carregando />;

  const rotaTemProgramacao = new Set(programacoes.filter((p) => p.ativa).map((p) => p.rotaId));
  const onibusEscolhido = onibus.find((o) => o.id === form?.onibusId);

  return (
    <View>
      <View style={s.barra}>
        <Texto variante="pequenoForte" cor="textoSuave" style={{ flex: 1 }}>
          As viagens dos próximos 7 dias são criadas sozinhas, a cada hora.
        </Texto>
      </View>
      <View style={s.acoes}>
        <Botao titulo="Nova" icone="add" onPress={() => abrir()} style={{ flex: 1 }} />
        <Botao titulo="Gerar agora" icone="refresh" variante="secundario" onPress={gerarAgora} carregando={gerar.isPending} style={{ flex: 1 }} />
      </View>

      {programacoes.length === 0 && (
        <Card>
          <EstadoVazio
            icone="repeat-outline"
            titulo="Nenhuma programação"
            texto="Programe cada rota uma vez (dias, horários, ônibus e motorista) e as viagens passam a ser criadas automaticamente."
            acao={{ titulo: "Nova programação", icone: "add", onPress: () => abrir() }}
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
            {listarDias(p.diasSemana)} • Ida {p.horarioIda}
            {p.horarioVolta ? ` • Volta ${p.horarioVolta}` : " • sem volta"}
          </Texto>
          <Texto variante="pequeno" cor="textoSuave">
            {p.onibus.placa} ({p.onibus.capacidade} lugares) • {p.motorista.usuario.nome}
          </Texto>
          {p.onibus.emManutencao && <Pilula texto="Ônibus em manutenção" tom="alerta" icone="construct" />}

          <Rotulo>Alunos com dia fixo</Rotulo>
          <OcupacaoDias dias={p.ocupacao} />

          <View style={[s.acoes, { marginTop: 16, marginBottom: 0 }]}>
            <Botao titulo="Editar" icone="create-outline" variante="secundario" onPress={() => abrir(p)} style={{ flex: 1, minHeight: 44 }} />
            <Botao
              titulo={p.ativa ? "Suspender" : "Reativar"}
              icone={p.ativa ? "pause-circle-outline" : "play-circle-outline"}
              variante="secundario"
              onPress={() => alternarAtiva(p)}
              style={{ flex: 1, minHeight: 44 }}
            />
          </View>
          <Botao titulo="Excluir programação" icone="trash-outline" variante="perigoFantasma" onPress={() => remover(p)} style={{ minHeight: 40 }} />
        </Card>
      ))}

      <Folha visivel={!!form} onFechar={() => setForm(null)} titulo={form?.id ? "Editar programação" : "Nova programação"}>
        {form && (
          <>
            {erro && <Aviso tipo="erro" titulo={erro} />}

            <Rotulo>Rota</Rotulo>
            {form.id ? (
              <Texto variante="corpoForte">{rotas.find((r) => r.id === form.rotaId)?.nome}</Texto>
            ) : (
              <Chips
                opcoes={rotas.map((r) => ({
                  valor: r.id,
                  rotulo: r.nome,
                  detalhe: rotaTemProgramacao.has(r.id) ? "já programada" : r.pontos.map((p) => p.universidade.nome).join(" → "),
                  desabilitado: rotaTemProgramacao.has(r.id),
                }))}
                valor={form.rotaId}
                onChange={(rotaId) => setForm({ ...form, rotaId })}
                vazio="Cadastre uma rota na aba Cadastros."
              />
            )}

            <Rotulo>Dias da semana</Rotulo>
            <DiasDaSemana valor={form.diasSemana} onChange={(diasSemana) => setForm({ ...form, diasSemana })} />

            <View style={s.horarios}>
              <View style={{ flex: 1 }}>
                <Campo
                  rotulo="Saída da ida"
                  value={form.horarioIda}
                  onChangeText={(t) => setForm({ ...form, horarioIda: mascararHora(t) })}
                  placeholder="HH:MM"
                  keyboardType="number-pad"
                  maxLength={5}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Campo
                  rotulo="Saída da volta"
                  value={form.horarioVolta}
                  onChangeText={(t) => setForm({ ...form, horarioVolta: mascararHora(t) })}
                  placeholder="Opcional"
                  keyboardType="number-pad"
                  maxLength={5}
                />
              </View>
            </View>

            <Rotulo>Motorista</Rotulo>
            <Chips
              opcoes={motoristas.map((m) => ({ valor: m.id, rotulo: m.usuario.nome, detalhe: m.onibus?.placa }))}
              valor={form.motoristaId}
              onChange={escolherMotorista}
              vazio="Cadastre um motorista na aba Cadastros."
            />

            <Rotulo>Ônibus</Rotulo>
            <Chips
              opcoes={onibus.map((o) => ({ valor: o.id, rotulo: o.placa, detalhe: o.emManutencao ? "em manutenção" : `${o.capacidade} lugares` }))}
              valor={form.onibusId}
              onChange={(onibusId) => setForm({ ...form, onibusId })}
              vazio="Cadastre um ônibus na aba Cadastros."
            />
            {onibusEscolhido && (
              <Texto variante="legenda" cor="textoFraco" style={{ marginTop: 8 }}>
                Cada dia comporta {onibusEscolhido.capacidade} alunos com dia fixo — a capacidade do ônibus.
              </Texto>
            )}

            {form.id && (
              <Aviso tipo="info" titulo="Vale também para as próximas viagens" style={{ marginTop: 16, marginBottom: 0 }}>
                As viagens que ainda não começaram recebem os novos horários, ônibus e motorista. Dias removidos têm as viagens canceladas e os alunos avisados.
              </Aviso>
            )}

            <Botao titulo={form.id ? "Salvar programação" : "Criar programação"} icone="checkmark" onPress={confirmarFormulario} carregando={salvar.isPending} style={{ marginTop: 24 }} />
          </>
        )}
      </Folha>
    </View>
  );
}

const useEstilos = criarEstilos((t) => ({
  barra: { marginBottom: t.espaco.md },
  acoes: { flexDirection: "row", gap: t.espaco.sm, marginBottom: t.espaco.lg },
  cartao: { marginBottom: t.espaco.md, gap: t.espaco.xs },
  topo: { flexDirection: "row", alignItems: "center", gap: t.espaco.sm, marginBottom: t.espaco.xs },
  horarios: { flexDirection: "row", gap: t.espaco.md },
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
  diasSemana: { flexDirection: "row", flexWrap: "wrap", gap: t.espaco.sm },
  botaoDia: {
    minWidth: 52,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.raio.pill,
    borderWidth: 1.5,
    borderColor: t.cores.borda,
    backgroundColor: t.cores.superficie,
    paddingHorizontal: t.espaco.md,
  },
  botaoDiaAtivo: { backgroundColor: t.cores.primariaForte, borderColor: t.cores.primariaForte },
}));
