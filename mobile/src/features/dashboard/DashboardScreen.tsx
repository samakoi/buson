import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { Relatorio } from "../../types";
import { useDadosDaTela } from "../../hooks/useDadosDaTela";
import { useOcupacaoPorUniversidade, useRelatorio, useResumo } from "./api";
import { criarEstilos, useTema } from "../../theme/TemaProvider";
import {
  Aviso,
  BarraProgresso,
  Botao,
  Cabecalho,
  Campo,
  Card,
  Carregando,
  Chips,
  EstadoVazio,
  Estatistica,
  GradeEstatisticas,
  ItemLista,
  Pilula,
  Secao,
  Tela,
  Texto,
  iniciaisDe,
} from "../../components/ui";
import { dataPorExtenso, formatarDiaBR, formatarDiaCurto, mascararDia, parseDiaBR } from "../../utils/datas";
import { PRESETS_PERIODO, PresetPeriodo, periodoDoPreset } from "../../utils/periodos";
import { mensagemDeErro } from "../../utils/feedback";
import { situacaoFalta, statusViagem } from "../../utils/rotulos";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { PilhaAdmin } from "../../navigation/AdminTabs";
import { queryClient } from "../../services/queryClient";
import { chavesAlocacao } from "../alocacao/api";
import { OcupacaoSemanalCard } from "../alocacao/OcupacaoSemanalCard";

type Preset = PresetPeriodo;
const presets = PRESETS_PERIODO;

const FALTAS_VISIVEIS = 8;

export default function DashboardScreen() {
  const navegacao = useNavigation<NativeStackNavigationProp<PilhaAdmin>>();
  const { cores } = useTema();
  const s = useEstilos();

  const [preset, setPreset] = useState<Preset>("hoje");
  const [periodo, setPeriodo] = useState(periodoDoPreset("hoje"));
  const [deTexto, setDeTexto] = useState("");
  const [ateTexto, setAteTexto] = useState("");
  const [erroDatas, setErroDatas] = useState<string | null>(null);
  const [todasFaltas, setTodasFaltas] = useState(false);

  const consultaResumo = useResumo();
  const consultaOcupacao = useOcupacaoPorUniversidade();
  // O período faz parte da chave: trocar o período busca só o relatório
  const consultaRelatorio = useRelatorio(periodo);
  const resumo = consultaResumo.data ?? null;
  const ocupacao = consultaOcupacao.data ?? {};
  const relatorio = consultaRelatorio.data ?? null;
  const carregandoRelatorio = consultaRelatorio.isFetching;
  const erro =
    erroDatas ?? (consultaRelatorio.error ? mensagemDeErro(consultaRelatorio.error, "Não foi possível carregar o relatório.") : null);

  const { carregando, atualizando, atualizar } = useDadosDaTela([consultaResumo, consultaOcupacao, consultaRelatorio]);
  // A ocupação da semana (outro cartão) acompanha o puxar para atualizar do painel
  const atualizarTudo = useCallback(async () => {
    queryClient.invalidateQueries({ queryKey: chavesAlocacao.ocupacaoSemanal });
    await atualizar();
  }, [atualizar]);

  function escolherPreset(p: Preset) {
    setPreset(p);
    setErroDatas(null);
    if (p === "personalizado") {
      setDeTexto(formatarDiaBR(periodo.inicio));
      setAteTexto(formatarDiaBR(periodo.fim));
      return;
    }
    setPeriodo(periodoDoPreset(p));
    setTodasFaltas(false);
  }

  function aplicarPersonalizado() {
    const inicio = parseDiaBR(deTexto);
    const fim = parseDiaBR(ateTexto);
    if (!inicio || !fim) return setErroDatas("Informe as duas datas no formato DD/MM/AAAA.");
    if (fim < inicio) return setErroDatas("A data final deve ser igual ou posterior à inicial.");
    setErroDatas(null);
    setPeriodo({ inicio, fim });
    setTodasFaltas(false);
  }

  if (carregando || !resumo) return <Carregando />;

  const t = relatorio?.totais;
  const faltas = relatorio?.faltas ?? [];
  const faltasVisiveis = todasFaltas ? faltas : faltas.slice(0, FALTAS_VISIVEIS);
  const faltasPorUni = Object.entries(relatorio?.faltasPorUniversidade ?? {}).sort((a, b) => b[1] - a[1]);
  const textoPeriodo = relatorio
    ? relatorio.periodo.inicio === relatorio.periodo.fim
      ? formatarDiaCurto(relatorio.periodo.inicio)
      : `${formatarDiaBR(relatorio.periodo.inicio)} a ${formatarDiaBR(relatorio.periodo.fim)}`
    : "";
  const presenca = t?.taxaPresenca ?? null;

  return (
    <Tela atualizando={atualizando} onAtualizar={atualizarTudo}>
      <Cabecalho sobrescrito={dataPorExtenso()} titulo="Dashboard" />

      <Chips opcoes={presets} valor={preset} onChange={escolherPreset} />

      {preset === "personalizado" && (
        <Card style={{ marginTop: 12 }}>
          <View style={s.linhaCampos}>
            <View style={{ flex: 1 }}>
              <Campo
                rotulo="De"
                value={deTexto}
                onChangeText={(v) => setDeTexto(mascararDia(v))}
                placeholder="DD/MM/AAAA"
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Campo
                rotulo="Até"
                value={ateTexto}
                onChangeText={(v) => setAteTexto(mascararDia(v))}
                placeholder="DD/MM/AAAA"
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
          </View>
          <Botao titulo="Aplicar período" icone="funnel-outline" onPress={aplicarPersonalizado} style={{ marginTop: 16 }} />
        </Card>
      )}

      {erro && <Aviso tipo="erro" titulo={erro} style={{ marginTop: 12 }} />}

      {relatorio && t && (
        <>
          {/* Destaque: a pergunta principal do admin — "os alunos estão indo?" */}
          <Card variante="destaque" style={{ marginTop: 12 }}>
            <View style={s.destaqueTopo}>
              <Texto variante="pequenoForte" cor="sobreDestaqueSuave">
                Presença • {textoPeriodo}
              </Texto>
              {carregandoRelatorio && <ActivityIndicator size="small" color={cores.sobreDestaque} />}
            </View>
            {presenca === null ? (
              <View style={s.semPresenca}>
                <Texto variante="titulo" cor="sobreDestaque">
                  Ainda sem dados
                </Texto>
                <Texto variante="pequeno" cor="sobreDestaqueSuave">
                  A presença é calculada quando as viagens do período são encerradas.
                </Texto>
              </View>
            ) : (
              <>
                <Texto variante="numeroDestaque" cor="sobreDestaque">
                  {Math.round(presenca * 100)}%
                </Texto>
                <BarraProgresso valor={presenca} cor={cores.sobreDestaque} fundo="rgba(255,255,255,0.18)" />
              </>
            )}
            <View style={s.destaqueRodape}>
              <Texto variante="pequeno" cor="sobreDestaqueSuave">
                {t.embarcados} embarques
              </Texto>
              <Texto variante="pequeno" cor="sobreDestaqueSuave">
                {t.faltas} faltas
              </Texto>
              {t.pendentes > 0 && (
                <Texto variante="pequeno" cor="sobreDestaqueSuave">
                  {t.pendentes} aguardando
                </Texto>
              )}
            </View>
          </Card>

          <GradeEstatisticas colunas={3}>
            <Estatistica compacta rotulo="Viagens" valor={t.viagens} />
            <Estatistica compacta rotulo="Com vaga" valor={t.confirmados} tom="info" />
            <Estatistica compacta rotulo="Faltas" valor={t.faltas} tom={t.faltas > 0 ? "perigo" : "neutro"} />
          </GradeEstatisticas>

          {relatorio.porDia.length > 1 && <GraficoPorDia dados={relatorio.porDia} />}

          <Secao
            titulo={`Quem faltou${faltas.length ? ` (${faltas.length})` : ""}`}
            acao={
              faltas.length > FALTAS_VISIVEIS
                ? { texto: todasFaltas ? "Mostrar menos" : "Ver todas", onPress: () => setTodasFaltas((v) => !v) }
                : undefined
            }
          />
          <Card semPadding>
            {faltasVisiveis.map((f, i) => (
              <ItemLista
                key={f.faltaId}
                iniciais={iniciaisDe(f.aluno)}
                tomIcone={situacaoFalta[f.situacao].tom}
                titulo={f.aluno}
                subtitulo={`${f.universidade} • ${formatarDiaCurto(f.dia)} ${f.horario}`}
                abaixo={<Pilula texto={situacaoFalta[f.situacao].rotulo} tom={situacaoFalta[f.situacao].tom} />}
                onPress={() => navegacao.navigate("PerfilAluno", { alunoId: f.alunoId })}
                ultimo={i === faltasVisiveis.length - 1}
              />
            ))}
            {faltas.length === 0 && (
              <EstadoVazio
                icone="happy-outline"
                titulo="Nenhuma falta"
                texto={t.pendentes > 0 ? "As faltas aparecem quando o motorista encerra a viagem." : "Todos os alunos com vaga embarcaram."}
              />
            )}
          </Card>

          {faltasPorUni.length > 0 && (
            <>
              <Botao
                titulo="Gerenciar faltas e justificativas"
                icone="alert-circle-outline"
                variante="secundario"
                onPress={() => navegacao.navigate("Faltas")}
                style={{ marginTop: 12 }}
              />
              <Secao titulo="Faltas por universidade" />
              <Card semPadding>
                {faltasPorUni.map(([uni, qtd], i) => (
                  <ItemLista
                    key={uni}
                    icone="school-outline"
                    tomIcone="neutro"
                    titulo={uni}
                    ultimo={i === faltasPorUni.length - 1}
                    direita={<Pilula texto={`${qtd} falta(s)`} tom="perigo" />}
                  />
                ))}
              </Card>
            </>
          )}

          <Secao titulo="Viagens do período" />
          <Card semPadding>
            {relatorio.viagens.map((v, i) => {
              const st = statusViagem[v.status];
              return (
                <ItemLista
                  key={v.id}
                  icone={st.icone}
                  tomIcone={st.tom}
                  titulo={`${formatarDiaCurto(v.dia)} • ${v.horario}`}
                  subtitulo={`${v.rota} • ${v.placa}`}
                  ultimo={i === relatorio.viagens.length - 1}
                  direita={
                    <View style={{ alignItems: "flex-end" }}>
                      <Texto variante="corpoForte" cor="sucesso">
                        {v.embarcados}/{v.confirmados}
                      </Texto>
                      {v.faltas > 0 && (
                        <Texto variante="legenda" cor="perigo">
                          {v.faltas} falta(s)
                        </Texto>
                      )}
                    </View>
                  }
                />
              );
            })}
            {relatorio.viagens.length === 0 && <EstadoVazio icone="calendar-outline" titulo="Nenhuma viagem no período" />}
          </Card>
        </>
      )}

      <OcupacaoSemanalCard />

      <Secao titulo="Visão geral do sistema" />
      <GradeEstatisticas colunas={3}>
        <Estatistica compacta rotulo="Alunos ativos" valor={resumo.alunosAtivos} tom="sucesso" />
        <Estatistica compacta rotulo="Pendentes" valor={resumo.alunosPendentes} tom={resumo.alunosPendentes > 0 ? "alerta" : "neutro"} />
        <Estatistica
          compacta
          rotulo="Documentos"
          valor={resumo.documentosPendentes}
          tom={resumo.documentosPendentes > 0 ? "alerta" : "neutro"}
        />
        <Estatistica compacta rotulo="Motoristas" valor={resumo.totalMotoristas} />
        <Estatistica compacta rotulo="Universidades" valor={resumo.totalUniversidades} />
        <Estatistica compacta rotulo="Ônibus" valor={resumo.totalOnibus} />
        <Estatistica
          compacta
          rotulo="Em manutenção"
          valor={resumo.onibusEmManutencao}
          tom={resumo.onibusEmManutencao > 0 ? "alerta" : "neutro"}
        />
        <Estatistica compacta rotulo="Viagens ativas" valor={resumo.viagensAtivas} tom={resumo.viagensAtivas > 0 ? "sucesso" : "neutro"} />
      </GradeEstatisticas>
      {resumo.viagensAtivas > 0 && (
        <Botao
          titulo="Ver ônibus no mapa (ao vivo)"
          icone="map-outline"
          variante="secundario"
          onPress={() => navegacao.navigate("AoVivo")}
          style={{ marginTop: 12 }}
        />
      )}

      {Object.keys(ocupacao).length > 0 && (
        <Card semPadding>
          {Object.entries(ocupacao).map(([uni, qtd], i, arr) => (
            <ItemLista
              key={uni}
              icone="school-outline"
              tomIcone="info"
              titulo={uni}
              subtitulo="Alunos cadastrados"
              ultimo={i === arr.length - 1}
              direita={<Texto variante="subtitulo">{qtd}</Texto>}
            />
          ))}
        </Card>
      )}
    </Tela>
  );
}

/** Barras empilhadas por dia: embarques + faltas. */
function GraficoPorDia({ dados }: { dados: Relatorio["porDia"] }) {
  const { cores } = useTema();
  const s = useEstilos();
  const maximo = Math.max(1, ...dados.map((d) => d.embarcados + d.faltas));
  const ALTURA = 120;
  // Em períodos longos, rotula só alguns dias para não embolar
  const passoRotulo = dados.length > 14 ? Math.ceil(dados.length / 8) : 1;

  return (
    <Card>
      <View style={s.legenda}>
        <View style={[s.legendaCor, { backgroundColor: cores.sucesso }]} />
        <Texto variante="legenda" cor="textoSuave">
          Embarques
        </Texto>
        <View style={[s.legendaCor, { backgroundColor: cores.perigo, marginLeft: 12 }]} />
        <Texto variante="legenda" cor="textoSuave">
          Faltas
        </Texto>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={s.barras}>
          {dados.map((d, i) => (
            <View
              key={d.dia}
              style={s.coluna}
              accessibilityLabel={`${formatarDiaBR(d.dia)}: ${d.embarcados} embarques, ${d.faltas} faltas`}
            >
              <View style={[s.trilho, { height: ALTURA }]}>
                <View
                  style={{
                    height: (d.faltas / maximo) * ALTURA,
                    backgroundColor: cores.perigo,
                    borderTopLeftRadius: 4,
                    borderTopRightRadius: 4,
                  }}
                />
                <View
                  style={{
                    height: (d.embarcados / maximo) * ALTURA,
                    backgroundColor: cores.sucesso,
                    borderTopLeftRadius: d.faltas ? 0 : 4,
                    borderTopRightRadius: d.faltas ? 0 : 4,
                  }}
                />
              </View>
              <Texto variante="micro" cor="textoFraco" style={s.colunaRotulo} numberOfLines={1}>
                {i % passoRotulo === 0 ? `${d.dia.slice(8, 10)}/${d.dia.slice(5, 7)}` : ""}
              </Texto>
            </View>
          ))}
        </View>
      </ScrollView>
    </Card>
  );
}

const useEstilos = criarEstilos((t) => ({
  linhaCampos: { flexDirection: "row", gap: t.espaco.md },
  destaqueTopo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  semPresenca: { gap: t.espaco.xs, marginTop: t.espaco.sm },
  destaqueRodape: { flexDirection: "row", gap: t.espaco.lg, marginTop: t.espaco.md, flexWrap: "wrap" },
  legenda: { flexDirection: "row", alignItems: "center", gap: t.espaco.xs, marginBottom: t.espaco.md },
  legendaCor: { width: 10, height: 10, borderRadius: 3 },
  barras: { flexDirection: "row", alignItems: "flex-end", gap: t.espaco.sm },
  coluna: { width: 28, alignItems: "center" },
  trilho: { width: 20, justifyContent: "flex-end", backgroundColor: t.cores.superficieAlt, borderRadius: 4, overflow: "hidden" },
  colunaRotulo: { marginTop: t.espaco.xs, width: 40, textAlign: "center" },
}));
