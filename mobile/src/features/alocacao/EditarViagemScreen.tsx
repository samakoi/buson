import React, { useState } from "react";
import { Pressable, Switch, View } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import {
  Aviso,
  Botao,
  BotaoIcone,
  Cabecalho,
  Campo,
  Card,
  Carregando,
  Chips,
  ItemOrdenavel,
  Pilula,
  Rotulo,
  Secao,
  Tela,
  Texto,
} from "../../components/ui";
import type { PilhaAdmin } from "../../navigation/AdminTabs";
import { criarEstilos, useTema } from "../../theme/TemaProvider";
import { useDadosDaTela } from "../../hooks/useDadosDaTela";
import { DIAS_SEMANA } from "../../utils/datas";
import { avisar, codigoDeErro, confirmar, mensagemDeErro } from "../../utils/feedback";
import { Motorista, Onibus, Programacao, Rota } from "../../types";
import { DadosTrecho, useExcluirRota, useMotoristas, useOnibus, useRotas, useSalvarRota, useUniversidades } from "../cadastros/api";
import { usePontosEmbarque, useProgramacoes, useSalvarProgramacao } from "./api";
import { EditorTrecho } from "./EditorTrecho";
import { Formulario, formularioInicial, validarFormulario, voltaDaIda } from "./formularioViagem";

/**
 * Viagem programada com a rota dentro dela: dados gerais (dias, ônibus, motorista) e os dois
 * trechos, ida e volta, cada um com origem, destino, horário e paradas próprias.
 * Também edita uma rota ainda sem viagem programada (aberta pelos Cadastros).
 */
export default function EditarViagemScreen() {
  const navegacao = useNavigation();
  const params = useRoute<RouteProp<PilhaAdmin, "EditarViagem">>().params ?? {};
  const consultas = [useProgramacoes(), useRotas(), useUniversidades(), usePontosEmbarque(), useOnibus(), useMotoristas()] as const;
  const [cProgramacoes, cRotas, cUniversidades, cPontos, cOnibus, cMotoristas] = consultas;
  const { carregando, recarregar } = useDadosDaTela([...consultas]);
  // Muda ao recarregar a versão atual: o formulário recomeça com os dados novos
  const [geracao, setGeracao] = useState(0);

  const programacao = (cProgramacoes.data ?? []).find(
    (p) => (params.programacaoId && p.id === params.programacaoId) || (params.rotaId && p.rotaId === params.rotaId)
  );
  const rota = programacao?.rota ?? (cRotas.data ?? []).find((r) => r.id === params.rotaId);
  const editando = !!(params.programacaoId || params.rotaId);

  if (carregando) return <Carregando />;
  if (editando && !rota) {
    return (
      <Tela>
        <Cabecalho titulo="Editar viagem" onVoltar={() => navegacao.goBack()} />
        <Aviso tipo="erro" titulo="Esta viagem não existe mais. A rota pode ter sido excluída por outra pessoa." />
        <Botao titulo="Voltar para a lista" icone="arrow-back" variante="secundario" onPress={() => navegacao.goBack()} />
      </Tela>
    );
  }
  return (
    <FormularioViagem
      key={geracao}
      rota={rota}
      programacao={programacao}
      editando={editando}
      soRota={!!params.soRota}
      universidades={(cUniversidades.data ?? []).map((u) => ({ id: u.id, nome: u.nome }))}
      pontos={(cPontos.data ?? []).map((p) => ({ id: p.id, nome: p.nome }))}
      motoristas={cMotoristas.data ?? []}
      onibus={cOnibus.data ?? []}
      onRecarregar={async () => {
        await recarregar();
        setGeracao((g) => g + 1);
      }}
    />
  );
}

function FormularioViagem({
  rota,
  programacao,
  editando,
  soRota,
  universidades,
  pontos,
  motoristas,
  onibus,
  onRecarregar,
}: {
  rota: Rota | undefined;
  programacao: Programacao | undefined;
  editando: boolean;
  soRota: boolean;
  universidades: ItemOrdenavel[];
  pontos: ItemOrdenavel[];
  motoristas: Motorista[];
  onibus: Onibus[];
  onRecarregar: () => Promise<void>;
}) {
  const navegacao = useNavigation();
  const { cores } = useTema();
  const s = useEstilos();
  const [inicial, setInicial] = useState(() => formularioInicial(rota, programacao, soRota));
  const [form, setForm] = useState(inicial);
  // Nova viagem: a volta acompanha a ida até o administrador mexer nela
  const [voltaAutomatica, setVoltaAutomatica] = useState(!editando);
  const [erro, setErro] = useState<string | null>(null);
  const [conflito, setConflito] = useState(false);
  const salvarProgramacao = useSalvarProgramacao();
  const salvarRota = useSalvarRota();
  const { excluir, excluindo } = useExcluirRota();
  const salvando = salvarProgramacao.isPending || salvarRota.isPending;
  const alterado = JSON.stringify(form) !== JSON.stringify(inicial);

  const atualizar = (mudanca: Partial<Formulario>) => setForm((f) => ({ ...f, ...mudanca }));
  const mudarIda = (ida: DadosTrecho) => atualizar(voltaAutomatica ? { ida, volta: voltaDaIda(ida) } : { ida });
  const mudarVolta = (volta: DadosTrecho) => {
    setVoltaAutomatica(false);
    atualizar({ volta });
  };

  async function salvar() {
    const problema = validarFormulario(form);
    if (problema) return setErro(problema);
    setErro(null);
    setConflito(false);
    const limpar = (t: DadosTrecho): DadosTrecho => ({ ...t, origem: t.origem.trim(), destino: t.destino.trim() });
    const dadosRota = { nome: form.nome.trim() || undefined, ida: limpar(form.ida), volta: limpar(form.volta) };
    const dadosViagem = {
      onibusId: form.onibusId!,
      motoristaId: form.motoristaId!,
      horarioIda: form.horarioIda,
      horarioVolta: form.temVolta ? form.horarioVolta : null,
      diasSemana: form.diasSemana,
    };
    try {
      if (programacao) {
        // Viagem e rota numa transação só, com as duas versões lidas pela tela
        await salvarProgramacao.mutateAsync({
          id: programacao.id,
          dados: { ...dadosViagem, versao: programacao.atualizadoEm, rota: { ...dadosRota, versao: rota!.atualizadoEm } },
        });
      } else if (rota) {
        await salvarRota.mutateAsync({ id: rota.id, dados: dadosRota, versao: rota.atualizadoEm });
        if (form.programar) await salvarProgramacao.mutateAsync({ dados: { ...dadosViagem, rotaId: rota.id } });
      } else if (form.programar) {
        await salvarProgramacao.mutateAsync({ dados: { ...dadosViagem, rota: dadosRota } });
      } else {
        await salvarRota.mutateAsync({ dados: dadosRota });
      }
      setInicial(form);
      avisar(
        editando ? "Alterações salvas" : "Viagem criada",
        form.programar ? "As viagens dos próximos dias já seguem esta configuração." : "Rota salva."
      );
      navegacao.goBack();
    } catch (err) {
      if (codigoDeErro(err) === "EDICAO_CONFLITANTE") setConflito(true);
      setErro(mensagemDeErro(err, "Não foi possível salvar a viagem."));
    }
  }

  async function recarregarVersaoAtual() {
    await onRecarregar();
  }

  async function cancelar() {
    if (
      alterado &&
      !(await confirmar("Descartar alterações?", "O que você mudou nesta viagem não será salvo.", {
        textoConfirmar: "Descartar",
        destrutivo: true,
      }))
    )
      return;
    navegacao.goBack();
  }

  async function excluirRota() {
    if (!rota) return;
    if (await excluir({ id: rota.id, nome: rota.nome })) navegacao.goBack();
  }

  const situacao = programacao
    ? programacao.ativa
      ? { texto: "Ativa", tom: "sucesso" as const, icone: "repeat" as const }
      : { texto: "Suspensa", tom: "neutro" as const, icone: "pause" as const }
    : rota
      ? { texto: "Sem viagem programada", tom: "alerta" as const, icone: "calendar-outline" as const }
      : { texto: "Nova", tom: "info" as const, icone: "add" as const };
  const nomeExibido =
    form.nome.trim() || (form.ida.origem && form.ida.destino ? `${form.ida.origem} ↔ ${form.ida.destino}` : "Nova viagem");

  return (
    <Tela>
      <Cabecalho
        sobrescrito={nomeExibido}
        titulo={editando ? "Editar viagem" : "Nova viagem"}
        onVoltar={cancelar}
        acoes={
          <BotaoIcone
            icone="checkmark"
            rotulo="Salvar alterações"
            onPress={salvar}
            cor={cores.sobrePrimaria}
            tamanho={24}
            style={{ backgroundColor: cores.primariaForte }}
          />
        }
      />
      <View style={s.situacao}>
        <Pilula texto={situacao.texto} tom={situacao.tom} icone={situacao.icone} />
        {alterado && <Pilula texto="Alterações não salvas" tom="alerta" icone="create-outline" />}
      </View>

      {erro && (
        <Aviso tipo="erro" titulo={erro}>
          {conflito ? "Suas alterações não foram salvas." : undefined}
        </Aviso>
      )}
      {conflito && <Botao titulo="Recarregar a versão atual" icone="refresh" variante="secundario" onPress={recarregarVersaoAtual} />}

      <Secao titulo="Dados gerais" />
      <Card>
        <Campo
          rotulo="Nome da viagem"
          value={form.nome}
          onChangeText={(nome) => atualizar({ nome })}
          placeholder={form.ida.origem && form.ida.destino ? `${form.ida.origem} ↔ ${form.ida.destino}` : "Ex.: Centro ↔ Universidades"}
          maxLength={120}
          ajuda="Em branco, usa a origem e o destino da ida."
        />
        {!programacao && rota && (
          <View style={s.alternar}>
            <Texto variante="corpo" style={{ flex: 1 }}>
              Programar a viagem agora (ônibus, motorista e dias)
            </Texto>
            <Switch value={form.programar} onValueChange={(programar) => atualizar({ programar })} />
          </View>
        )}
        {form.programar && (
          <>
            <Rotulo>Dias da semana</Rotulo>
            <DiasDaSemana valor={form.diasSemana} onChange={(diasSemana) => atualizar({ diasSemana })} />
            <Rotulo>Motorista</Rotulo>
            <Chips
              opcoes={motoristas.map((m) => ({ valor: m.id, rotulo: m.usuario.nome, detalhe: m.onibus?.placa }))}
              valor={form.motoristaId}
              onChange={(motoristaId) =>
                atualizar({ motoristaId, onibusId: motoristas.find((m) => m.id === motoristaId)?.onibusId ?? form.onibusId })
              }
              vazio="Cadastre um motorista na aba Cadastros."
            />
            <Rotulo>Ônibus</Rotulo>
            <Chips
              opcoes={onibus.map((o) => ({
                valor: o.id,
                rotulo: o.placa,
                detalhe: o.emManutencao ? "em manutenção" : `${o.capacidade} lugares`,
              }))}
              valor={form.onibusId}
              onChange={(onibusId) => atualizar({ onibusId })}
              vazio="Cadastre um ônibus na aba Cadastros."
            />
          </>
        )}
      </Card>

      <Secao titulo="Rota: ida e volta" />
      <EditorTrecho
        sentido="IDA"
        valor={form.ida}
        onChange={mudarIda}
        horario={form.horarioIda}
        onHorario={(horarioIda) => atualizar({ horarioIda })}
        universidades={universidades}
        pontos={pontos}
      />
      <EditorTrecho
        sentido="VOLTA"
        valor={form.volta}
        onChange={mudarVolta}
        horario={form.temVolta ? form.horarioVolta : ""}
        onHorario={(horarioVolta) => atualizar({ horarioVolta, temVolta: true })}
        universidades={universidades}
        pontos={pontos}
        extra={
          <View style={s.extraVolta}>
            {form.programar && (
              <View style={s.alternar}>
                <Texto variante="pequeno" style={{ flex: 1 }}>
                  {form.temVolta ? "A viagem tem volta" : "Sem volta: só a ida é gerada"}
                </Texto>
                <Switch value={form.temVolta} onValueChange={(temVolta) => atualizar({ temVolta })} />
              </View>
            )}
            <Texto variante="legenda" cor="textoFraco">
              {voltaAutomatica
                ? "A volta acompanha a ida (invertida) até você editá-la."
                : "A volta tem paradas próprias; não precisa ser igual à ida."}
            </Texto>
            {!voltaAutomatica && (
              <Pressable onPress={() => atualizar({ volta: voltaDaIda(form.ida) })} accessibilityRole="button" style={s.link}>
                <Texto variante="pequenoForte" cor="primaria">
                  Copiar da ida (invertida)
                </Texto>
              </Pressable>
            )}
          </View>
        }
      />

      {programacao && (
        <Aviso tipo="info" titulo="Vale também para as próximas viagens">
          As viagens que ainda não começaram recebem os novos horários, ônibus e motorista. Dias removidos têm as viagens canceladas e os
          alunos avisados. Alunos de instituições que saem da ida perdem os dias nela.
        </Aviso>
      )}

      <View style={s.acoes}>
        <Botao titulo="Cancelar" variante="secundario" onPress={cancelar} style={{ flex: 1 }} />
        <Botao
          titulo={editando ? "Salvar alterações" : "Criar viagem"}
          icone="checkmark"
          onPress={salvar}
          carregando={salvando}
          style={{ flex: 1 }}
        />
      </View>
      {rota && <Botao titulo="Excluir rota" icone="trash-outline" variante="perigoFantasma" onPress={excluirRota} carregando={excluindo} />}
    </Tela>
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

const useEstilos = criarEstilos((t) => ({
  situacao: { flexDirection: "row", flexWrap: "wrap", gap: t.espaco.sm, marginBottom: t.espaco.md },
  alternar: { flexDirection: "row", alignItems: "center", gap: t.espaco.md, marginTop: t.espaco.md },
  extraVolta: { gap: t.espaco.xs, marginTop: t.espaco.xs },
  link: { alignSelf: "flex-start", paddingVertical: t.espaco.xs },
  acoes: { flexDirection: "row", gap: t.espaco.sm, marginTop: t.espaco.sm, marginBottom: t.espaco.sm },
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
