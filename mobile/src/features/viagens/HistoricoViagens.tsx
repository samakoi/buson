import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Aviso,
  Botao,
  Campo,
  Card,
  Carregando,
  Chips,
  EstadoVazio,
  Estatistica,
  Folha,
  GradeEstatisticas,
  ItemLista,
  Pilula,
  Rotulo,
  Secao,
  Texto,
} from "../../components/ui";
import type { PilhaAdmin } from "../../navigation/AdminTabs";
import { Motorista, Rota, SentidoViagem, StatusViagem, ViagemHistorico } from "../../types";
import { diaISO, formatarDiaBR, formatarDiaCurto, mascararDia, parseDiaBR } from "../../utils/datas";
import { PRESETS_PERIODO, Periodo, PresetPeriodo, periodoDoPreset } from "../../utils/periodos";
import { statusViagem } from "../../utils/rotulos";
import { mensagemDeErro } from "../../utils/feedback";
import { useDadosDaTela } from "../../hooks/useDadosDaTela";
import { FiltroHistorico, useHistoricoViagens } from "./api";

/**
 * Histórico de viagens da administração (aba Viagens › Histórico): período, filtros e a lista
 * paginada, das mais recentes para as mais antigas. Tocar numa viagem abre o detalhe.
 */
export function HistoricoViagens({ rotas, motoristas }: { rotas: Rota[]; motoristas: Motorista[] }) {
  const navegacao = useNavigation<NativeStackNavigationProp<PilhaAdmin>>();
  const [preset, setPreset] = useState<PresetPeriodo>("7d");
  const [periodo, setPeriodo] = useState<Periodo>(periodoDoPreset("7d"));
  const [deTexto, setDeTexto] = useState("");
  const [ateTexto, setAteTexto] = useState("");
  const [erroPeriodo, setErroPeriodo] = useState<string | null>(null);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [rotaId, setRotaId] = useState<string | undefined>();
  const [motoristaId, setMotoristaId] = useState<string | undefined>();
  const [sentido, setSentido] = useState<SentidoViagem | undefined>();
  const [status, setStatus] = useState<StatusViagem | undefined>();

  const filtro = useMemo<FiltroHistorico>(
    () => ({ ...periodo, rotaId, motoristaId, sentido, status }),
    [periodo, rotaId, motoristaId, sentido, status]
  );
  const consulta = useHistoricoViagens(filtro);
  useDadosDaTela(consulta);
  const paginas = consulta.data?.pages ?? [];
  const primeira = paginas[0];
  const itens = paginas.flatMap((p) => p.itens);
  const qtdFiltros = [rotaId, motoristaId, sentido, status].filter(Boolean).length;

  function escolherPreset(p: PresetPeriodo) {
    setPreset(p);
    setErroPeriodo(null);
    if (p === "personalizado") {
      setDeTexto(formatarDiaBR(periodo.inicio));
      setAteTexto(formatarDiaBR(periodo.fim));
      return;
    }
    setPeriodo(periodoDoPreset(p));
  }

  function aplicarPersonalizado() {
    const inicio = parseDiaBR(deTexto);
    const fim = parseDiaBR(ateTexto);
    if (!inicio || !fim) return setErroPeriodo("Informe as duas datas no formato DD/MM/AAAA.");
    if (fim < inicio) return setErroPeriodo("A data final é anterior à inicial.");
    setErroPeriodo(null);
    setPeriodo({ inicio, fim });
  }

  function limparFiltros() {
    setRotaId(undefined);
    setMotoristaId(undefined);
    setSentido(undefined);
    setStatus(undefined);
  }

  // Agrupa por dia (a lista já vem da mais recente para a mais antiga)
  const porDia = new Map<string, ViagemHistorico[]>();
  for (const v of itens) {
    const dia = diaISO(new Date(v.data));
    porDia.set(dia, [...(porDia.get(dia) ?? []), v]);
  }

  const textoPeriodo =
    periodo.inicio === periodo.fim ? formatarDiaCurto(periodo.inicio) : `${formatarDiaBR(periodo.inicio)} a ${formatarDiaBR(periodo.fim)}`;

  return (
    <>
      <Chips opcoes={PRESETS_PERIODO} valor={preset} onChange={escolherPreset} />

      {preset === "personalizado" && (
        <Card style={{ marginTop: 12 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
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

      {erroPeriodo && <Aviso tipo="erro" titulo={erroPeriodo} style={{ marginTop: 12 }} />}
      {consulta.isError && (
        <Aviso tipo="erro" titulo={mensagemDeErro(consulta.error, "Não foi possível carregar o histórico.")} style={{ marginTop: 12 }} />
      )}

      <Botao
        titulo={qtdFiltros ? `Filtros (${qtdFiltros})` : "Filtrar por rota, motorista, sentido..."}
        icone="options-outline"
        variante="fantasma"
        onPress={() => setFiltrosAbertos(true)}
        style={{ marginTop: 8 }}
      />

      {consulta.isLoading ? (
        <Carregando />
      ) : (
        <>
          {primeira && (
            <>
              <Secao titulo={`Período • ${textoPeriodo}`} />
              <GradeEstatisticas colunas={3}>
                <Estatistica compacta rotulo="Viagens" valor={primeira.totais.viagens} />
                <Estatistica compacta rotulo="Embarques" valor={primeira.totais.embarcados} tom="sucesso" />
                <Estatistica compacta rotulo="Faltas" valor={primeira.totais.faltas} tom={primeira.totais.faltas ? "perigo" : "neutro"} />
              </GradeEstatisticas>
            </>
          )}

          {itens.length === 0 && (
            <Card style={{ marginTop: 12 }}>
              <EstadoVazio
                icone="time-outline"
                titulo="Nenhuma viagem neste período"
                texto={qtdFiltros ? "Tente outro período ou limpe os filtros." : "Escolha outro período."}
              />
            </Card>
          )}

          {[...porDia.entries()].map(([dia, lista]) => (
            <View key={dia}>
              <Secao titulo={dia === diaISO() ? `Hoje • ${formatarDiaCurto(dia)}` : formatarDiaCurto(dia)} />
              <Card semPadding>
                {lista.map((v, i) => {
                  const st = statusViagem[v.status];
                  return (
                    <ItemLista
                      key={v.id}
                      icone={st.icone}
                      tomIcone={st.tom}
                      titulo={`${v.horario} • ${v.sentido === "VOLTA" ? "Volta" : "Ida"} • ${v.rota.nome}`}
                      subtitulo={
                        `${v.onibus.placa} • ${v.motorista?.usuario.nome ?? "—"} • ${v.resumo.embarcados}/${v.resumo.ocupados} embarcaram` +
                        (v.resumo.faltas ? ` • ${v.resumo.faltas} falta(s)` : "")
                      }
                      abaixo={<Pilula texto={st.rotulo} tom={st.tom} />}
                      onPress={() => navegacao.navigate("DetalheViagem", { viagemId: v.id })}
                      ultimo={i === lista.length - 1}
                    />
                  );
                })}
              </Card>
            </View>
          ))}

          {primeira && consulta.hasNextPage && (
            <Botao
              titulo={`Carregar mais (${primeira.total - itens.length})`}
              variante="fantasma"
              onPress={() => consulta.fetchNextPage()}
              carregando={consulta.isFetchingNextPage}
            />
          )}
        </>
      )}

      <Folha visivel={filtrosAbertos} onFechar={() => setFiltrosAbertos(false)} titulo="Filtrar histórico">
        <Rotulo>Rota</Rotulo>
        <Chips
          opcoes={rotas.map((r) => ({ valor: r.id, rotulo: r.nome }))}
          valor={rotaId ?? null}
          onChange={(id) => setRotaId(id === rotaId ? undefined : id)}
          vazio="Nenhuma rota cadastrada."
          quebrarLinha
        />
        <Rotulo>Motorista</Rotulo>
        <Chips
          opcoes={motoristas.map((m) => ({ valor: m.id, rotulo: m.usuario.nome }))}
          valor={motoristaId ?? null}
          onChange={(id) => setMotoristaId(id === motoristaId ? undefined : id)}
          vazio="Nenhum motorista cadastrado."
          quebrarLinha
        />
        <Rotulo>Sentido</Rotulo>
        <Chips
          opcoes={[
            { valor: "IDA", rotulo: "Ida" },
            { valor: "VOLTA", rotulo: "Volta" },
          ]}
          valor={sentido ?? null}
          onChange={(v) => setSentido(v === sentido ? undefined : v)}
        />
        <Rotulo>Situação</Rotulo>
        <Chips
          opcoes={(Object.keys(statusViagem) as StatusViagem[]).map((s) => ({ valor: s, rotulo: statusViagem[s].rotulo }))}
          valor={status ?? null}
          onChange={(v) => setStatus(v === status ? undefined : v)}
          quebrarLinha
        />
        <Texto variante="pequeno" cor="textoSuave" style={{ marginTop: 12 }}>
          Toque de novo numa opção para tirá-la do filtro.
        </Texto>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
          <Botao titulo="Limpar" variante="secundario" onPress={limparFiltros} style={{ flex: 1 }} />
          <Botao titulo="Ver viagens" icone="checkmark" onPress={() => setFiltrosAbertos(false)} style={{ flex: 1 }} />
        </View>
      </Folha>
    </>
  );
}
