import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Aviso, Botao, Cabecalho, Card, Carregando, Chips, EstadoVazio, Rotulo, Tela, Texto } from "../../components/ui";
import { avisar, mensagemDeErro } from "../../utils/feedback";
import { listarDias } from "../../utils/datas";
import { useTema } from "../../theme/TemaProvider";
import { DiasDoAluno } from "../../types";
import { DiaEscolhido, useDias, useSalvarDias } from "./api";
import { SeletorDias } from "./SeletorDias";

/** Parâmetros quando o admin abre os dias de um aluno (sem parâmetros = o próprio aluno). */
export type ParamsDias = { alunoId?: string; nome?: string } | undefined;

type Escolhas = Map<number, string>; // diaSemana → rotaId

/**
 * Dias fixos de transporte. O aluno marca os dias (cada um com a vaga do ônibus
 * daquele dia) e o ponto onde embarca. Dia lotado não pode ser escolhido.
 */
export default function MeusDiasScreen() {
  const navegacao = useNavigation();
  const params = useRoute().params as ParamsDias;
  const alunoId = params?.alunoId;
  const titulo = alunoId ? "Dias de uso" : "Meus dias";
  const { data, isLoading, error, refetch, isRefetching } = useDias(alunoId);

  if (isLoading) return <Carregando />;
  const voltar = () => navegacao.goBack();

  if (error || !data) {
    return (
      <Tela>
        <Cabecalho titulo={titulo} onVoltar={voltar} />
        <Aviso tipo="erro" titulo={mensagemDeErro(error, "Não foi possível carregar os dias.")} />
        <Botao titulo="Tentar de novo" icone="refresh" variante="secundario" onPress={() => refetch()} />
      </Tela>
    );
  }

  // A chave recria o formulário quando os dias salvos mudam (depois de salvar ou recarregar)
  return (
    <FormularioDias
      key={JSON.stringify(data.dias)}
      data={data}
      params={params}
      titulo={titulo}
      voltar={voltar}
      atualizando={isRefetching}
      atualizar={() => refetch()}
    />
  );
}

function FormularioDias({
  data,
  params,
  titulo,
  voltar,
  atualizando,
  atualizar,
}: {
  data: DiasDoAluno;
  params: ParamsDias;
  titulo: string;
  voltar: () => void;
  atualizando: boolean;
  atualizar: () => void;
}) {
  const alunoId = params?.alunoId;
  const doAdmin = !!alunoId;
  const { espaco } = useTema();
  const salvar = useSalvarDias(alunoId);

  // Estado inicial = dias salvos
  const salvos = useMemo(() => {
    const e: Escolhas = new Map();
    const p: Record<string, string | null> = {};
    for (const d of data.dias) {
      e.set(d.diaSemana, d.rota.id);
      p[d.rota.id] = d.pontoEmbarque?.id ?? null;
    }
    return { escolhas: e, pontos: p };
  }, [data.dias]);

  const [escolhas, setEscolhas] = useState<Escolhas>(() => new Map(salvos.escolhas));
  const [pontos, setPontos] = useState<Record<string, string | null>>(() => ({ ...salvos.pontos }));
  const [rotaEscolhida, setRotaAtiva] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Rota na tela: a escolhida (se ainda existir) ou a dos dias salvos / a primeira opção
  const rotaAtiva =
    rotaEscolhida && data.opcoes.some((o) => o.rota.id === rotaEscolhida)
      ? rotaEscolhida
      : (data.dias[0]?.rota.id ?? data.opcoes[0]?.rota.id ?? null);

  const ativa = data.statusConta === "ATIVO";
  const opcao = data.opcoes.find((o) => o.rota.id === rotaAtiva) ?? null;
  const selecionadosDaRota = new Set([...escolhas].filter(([, r]) => r === rotaAtiva).map(([d]) => d));
  const pontoDaRota = rotaAtiva ? (pontos[rotaAtiva] ?? null) : null;
  const precisaPonto = !doAdmin && [...new Set(escolhas.values())].some((r) => {
    const o = data.opcoes.find((x) => x.rota.id === r);
    return o && o.pontosEmbarque.length > 0 && !pontos[r];
  });

  const alterado =
    JSON.stringify([...escolhas].sort()) !== JSON.stringify([...salvos.escolhas].sort()) ||
    [...new Set(escolhas.values())].some((r) => (pontos[r] ?? null) !== (salvos.pontos[r] ?? null));

  function alternar(dia: number) {
    if (!rotaAtiva) return;
    setErro(null);
    setEscolhas((atual) => {
      const nova = new Map(atual);
      // Tocar num dia de outra rota passa o dia para a rota que está na tela
      if (nova.get(dia) === rotaAtiva) nova.delete(dia);
      else nova.set(dia, rotaAtiva);
      return nova;
    });
  }

  async function confirmarDias() {
    if (precisaPonto) return setErro("Escolha o ponto onde você embarca.");
    setErro(null);
    const dias: DiaEscolhido[] = [...escolhas].map(([diaSemana, rotaId]) => ({ diaSemana, rotaId, pontoEmbarqueId: pontos[rotaId] ?? null }));
    try {
      const salvo = await salvar.mutateAsync(dias);
      avisar(
        "Dias salvos",
        salvo.dias.length > 0
          ? `${doAdmin ? "O aluno vai" : "Você vai"} ${listarDias(salvo.dias.map((d) => d.diaSemana))}. ${doAdmin ? "Ele foi avisado." : "Confirme sua presença no dia, na tela Início."}`
          : "Nenhum dia fixo. Ainda dá para pedir vagas avulsas."
      );
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível salvar os dias."));
    }
  }

  const resumoEscolhas = [...escolhas.keys()];
  const outrasRotas = [...new Set(escolhas.values())].filter((r) => r !== rotaAtiva);

  return (
    <Tela atualizando={atualizando} onAtualizar={atualizar}>
      <Cabecalho titulo={titulo} subtitulo={params?.nome ?? data.universidade.nome} onVoltar={voltar} />

      {data.statusConta === "PENDENTE" && (
        <Aviso tipo="info" titulo="Disponível depois da validação da matrícula">
          {doAdmin
            ? "Ative a conta do aluno para definir os dias fixos."
            : "Assim que a administração validar sua matrícula, você escolhe seus dias fixos aqui. Enquanto isso, peça vagas avulsas na tela Início."}
        </Aviso>
      )}
      {data.statusConta === "INATIVO" && (
        <Aviso tipo="alerta" titulo="Conta inativa">
          {doAdmin ? "Contas inativas não ocupam vagas nos dias." : "Procure a administração para reativar sua conta."}
        </Aviso>
      )}

      {data.opcoes.length === 0 ? (
        <Card>
          <EstadoVazio
            icone="calendar-outline"
            titulo="Nenhuma rota programada"
            texto={`Ainda não há programação semanal para ${data.universidade.nome}. Os dias aparecem aqui quando a administração programar a rota.`}
          />
        </Card>
      ) : (
        <>
          {data.opcoes.length > 1 && (
            <>
              <Rotulo>Rota</Rotulo>
              <Chips
                opcoes={data.opcoes.map((o) => {
                  const qtd = [...escolhas.values()].filter((r) => r === o.rota.id).length;
                  return { valor: o.rota.id, rotulo: o.rota.nome, detalhe: qtd ? `${qtd} dia(s)` : undefined };
                })}
                valor={rotaAtiva}
                onChange={setRotaAtiva}
              />
            </>
          )}

          {opcao && (
            <>
              <Card style={{ marginTop: data.opcoes.length > 1 ? espaco.lg : 0 }}>
                <Texto variante="subtitulo">{opcao.rota.nome}</Texto>
                <Texto variante="pequeno" cor="textoSuave">
                  {opcao.rota.instituicoes.join(" → ")}
                </Texto>
                <Texto variante="pequenoForte" cor="primaria" style={{ marginTop: espaco.sm }}>
                  Ida {opcao.horarioIda}
                  {opcao.horarioVolta ? ` • Volta ${opcao.horarioVolta}` : ""}
                </Texto>
              </Card>

              {opcao.pontosEmbarque.length > 0 && (
                <>
                  <Rotulo>Onde você embarca</Rotulo>
                  <Chips
                    opcoes={opcao.pontosEmbarque.map((p) => ({ valor: p.id, rotulo: p.nome, detalhe: p.endereco ?? undefined }))}
                    valor={pontoDaRota}
                    onChange={(id) => {
                      setErro(null);
                      setPontos((atual) => ({ ...atual, [opcao.rota.id]: id }));
                    }}
                    quebrarLinha
                  />
                </>
              )}

              <Rotulo>Dias da semana</Rotulo>
              <SeletorDias dias={opcao.dias} selecionados={selecionadosDaRota} onAlternar={alternar} desabilitado={!ativa} />
              {outrasRotas.length > 0 && (
                <Texto variante="legenda" cor="textoFraco" style={{ marginTop: espaco.sm }}>
                  Também há dias em outra rota. Marcar aqui um desses dias troca a rota daquele dia.
                </Texto>
              )}
            </>
          )}

          <View style={{ marginTop: espaco.xl, gap: espaco.md }}>
            {erro && <Aviso tipo="erro" titulo={erro} style={{ marginBottom: 0 }} />}
            <Texto variante="pequenoForte" cor="textoSuave" alinhar="center">
              {resumoEscolhas.length > 0 ? `Dias escolhidos: ${listarDias(resumoEscolhas)}` : "Nenhum dia escolhido"}
            </Texto>
            <Botao
              titulo="Salvar dias"
              icone="checkmark"
              tamanho="grande"
              onPress={confirmarDias}
              carregando={salvar.isPending}
              desabilitado={!ativa || !alterado}
            />
          </View>
        </>
      )}
    </Tela>
  );
}
