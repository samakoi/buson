import React, { useState } from "react";
import { View } from "react-native";
import { api } from "../../services/api";
import { Motorista, Onibus, Rota, Viagem } from "../../types";
import { useCarregamento } from "../../hooks/useCarregamento";
import { Aviso, Botao, BotaoIcone, Cabecalho, Campo, Card, Carregando, Chips, EstadoVazio, Folha, ItemLista, Pilula, Rotulo, Secao, Tela } from "../../components/ui";
import { useTema } from "../../theme/TemaProvider";
import { avisar, confirmar, mensagemDeErro } from "../../utils/feedback";
import { diaISO, formatarDiaCurto, mascararDia, mascararHora, parseDiaBR, somarDias } from "../../utils/datas";
import { statusViagem } from "../../utils/rotulos";

type OpcaoData = "hoje" | "amanha" | "outra";

export default function ViagensScreen() {
  const { cores } = useTema();
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [onibus, setOnibus] = useState<Onibus[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);

  const [formAberto, setFormAberto] = useState(false);
  const [opcaoData, setOpcaoData] = useState<OpcaoData>("hoje");
  const [outraData, setOutraData] = useState("");
  const [horario, setHorario] = useState("");
  const [rotaId, setRotaId] = useState<string | null>(null);
  const [motoristaId, setMotoristaId] = useState<string | null>(null);
  const [onibusId, setOnibusId] = useState<string | null>(null);
  const [vagas, setVagas] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const { carregando, atualizando, atualizar, recarregar } = useCarregamento(async () => {
    const [v, r, o, m] = await Promise.all([
      api.get<Viagem[]>("/viagens", { params: { desde: diaISO() } }),
      api.get<Rota[]>("/rotas"),
      api.get<Onibus[]>("/onibus"),
      api.get<Motorista[]>("/motoristas"),
    ]);
    setViagens(v.data);
    setRotas(r.data);
    setOnibus(o.data);
    setMotoristas(m.data);
  });

  function escolherMotorista(id: string) {
    setMotoristaId(id);
    // Sugere o ônibus do motorista
    const doMotorista = motoristas.find((m) => m.id === id)?.onibusId;
    if (doMotorista) setOnibusId(doMotorista);
  }

  function fecharFormulario() {
    setFormAberto(false);
    setHorario("");
    setRotaId(null);
    setMotoristaId(null);
    setOnibusId(null);
    setVagas("");
    setErro(null);
  }

  async function criar() {
    const data = opcaoData === "hoje" ? diaISO() : opcaoData === "amanha" ? somarDias(diaISO(), 1) : parseDiaBR(outraData);
    if (!data) return setErro("Informe a data no formato DD/MM/AAAA.");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horario)) return setErro("Informe o horário no formato HH:MM.");
    if (!rotaId) return setErro("Selecione a rota.");
    if (!motoristaId) return setErro("Selecione o motorista.");
    if (!onibusId) return setErro("Selecione o ônibus.");

    setErro(null);
    setSalvando(true);
    try {
      await api.post("/viagens", { data, horario, rotaId, motoristaId, onibusId, vagas: vagas ? Number(vagas) : undefined });
      fecharFormulario();
      await recarregar();
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível criar a viagem."));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(v: Viagem) {
    const ativos = v.resumo.confirmados + v.resumo.espera;
    const ok = await confirmar(
      "Excluir viagem",
      `Excluir a viagem de ${formatarDiaCurto(diaISO(new Date(v.data)))} às ${v.horario}?` +
        (ativos > 0 ? ` ${ativos} aluno(s) com check-in serão avisados do cancelamento.` : ""),
      { textoConfirmar: "Excluir", destrutivo: true }
    );
    if (!ok) return;
    try {
      await api.delete(`/viagens/${v.id}`);
      await recarregar();
    } catch (err) {
      avisar("Não foi possível excluir", mensagemDeErro(err, "Tente novamente."));
    }
  }

  if (carregando) return <Carregando />;

  const onibusEscolhido = onibus.find((o) => o.id === onibusId);

  // Agrupa por dia
  const porDia = new Map<string, Viagem[]>();
  for (const v of viagens) {
    const dia = diaISO(new Date(v.data));
    porDia.set(dia, [...(porDia.get(dia) ?? []), v]);
  }

  return (
    <Tela atualizando={atualizando} onAtualizar={atualizar}>
      <Cabecalho
        titulo="Viagens"
        subtitulo="De hoje em diante"
        acoes={<BotaoIcone icone="add" rotulo="Nova viagem" onPress={() => setFormAberto(true)} cor={cores.sobrePrimaria} tamanho={24} style={{ backgroundColor: cores.primariaForte }} />}
      />

      {viagens.length === 0 && (
        <Card>
          <EstadoVazio
            icone="calendar-outline"
            titulo="Nenhuma viagem programada"
            texto="Cadastre a próxima viagem para os alunos poderem fazer check-in."
            acao={{ titulo: "Nova viagem", icone: "add", onPress: () => setFormAberto(true) }}
          />
        </Card>
      )}

      {[...porDia.entries()].map(([dia, lista]) => (
        <View key={dia}>
          <Secao titulo={dia === diaISO() ? `Hoje • ${formatarDiaCurto(dia)}` : formatarDiaCurto(dia)} />
          <Card semPadding>
            {lista.map((v, i) => {
              const st = statusViagem[v.status];
              const manutencao = v.onibus.emManutencao && v.status !== "ENCERRADA";
              return (
                <ItemLista
                  key={v.id}
                  icone={manutencao ? "construct" : st.icone}
                  tomIcone={manutencao ? "alerta" : st.tom}
                  titulo={`${v.horario} • ${v.rota.nome}`}
                  subtitulo={
                    `${v.onibus.placa} • ${v.motorista?.usuario.nome ?? "—"} • ${v.resumo.confirmados}/${v.vagas} vagas` +
                    (v.resumo.espera ? ` • ${v.resumo.espera} na espera` : "") +
                    (v.status !== "AGUARDANDO" ? ` • ${v.resumo.embarcados} embarcaram` : "")
                  }
                  abaixo={
                    <>
                      <Pilula texto={st.rotulo} tom={st.tom} />
                      {manutencao && <Pilula texto="Ônibus em manutenção" tom="alerta" icone="construct" />}
                    </>
                  }
                  ultimo={i === lista.length - 1}
                  direita={
                    v.status === "AGUARDANDO" ? (
                      <BotaoIcone icone="trash-outline" rotulo={`Excluir viagem das ${v.horario}`} cor={cores.perigo} onPress={() => excluir(v)} />
                    ) : undefined
                  }
                />
              );
            })}
          </Card>
        </View>
      ))}

      <Folha visivel={formAberto} onFechar={fecharFormulario} titulo="Nova viagem">
        {erro && <Aviso tipo="erro" titulo={erro} />}

        <Rotulo>Data</Rotulo>
        <Chips
          opcoes={[
            { valor: "hoje", rotulo: "Hoje", detalhe: formatarDiaCurto(diaISO()) },
            { valor: "amanha", rotulo: "Amanhã", detalhe: formatarDiaCurto(somarDias(diaISO(), 1)) },
            { valor: "outra", rotulo: "Outra data" },
          ]}
          valor={opcaoData}
          onChange={(v) => setOpcaoData(v as OpcaoData)}
        />
        {opcaoData === "outra" && (
          <Campo rotulo="Qual data?" value={outraData} onChangeText={(t) => setOutraData(mascararDia(t))} placeholder="DD/MM/AAAA" keyboardType="number-pad" maxLength={10} />
        )}

        <Campo rotulo="Horário de saída" value={horario} onChangeText={(t) => setHorario(mascararHora(t))} placeholder="HH:MM" keyboardType="number-pad" maxLength={5} />

        <Rotulo>Rota</Rotulo>
        <Chips
          opcoes={rotas.map((r) => ({ valor: r.id, rotulo: r.nome, detalhe: r.pontos.map((p) => p.universidade.nome).join(" → ") }))}
          valor={rotaId}
          onChange={setRotaId}
          vazio="Cadastre uma rota na aba Cadastros."
        />

        <Rotulo>Motorista</Rotulo>
        <Chips
          opcoes={motoristas.map((m) => ({ valor: m.id, rotulo: m.usuario.nome, detalhe: m.onibus?.placa }))}
          valor={motoristaId}
          onChange={escolherMotorista}
          vazio="Cadastre um motorista na aba Cadastros."
        />

        <Rotulo>Ônibus</Rotulo>
        <Chips
          opcoes={onibus.map((o) => ({ valor: o.id, rotulo: o.placa, detalhe: o.emManutencao ? "em manutenção" : `${o.capacidade} lugares` }))}
          valor={onibusId}
          onChange={setOnibusId}
          vazio="Cadastre um ônibus na aba Cadastros."
        />
        {onibusEscolhido?.emManutencao && (
          <Aviso tipo="alerta" titulo="Este ônibus está em manutenção" style={{ marginTop: 12, marginBottom: 0 }}>
            O motorista só poderá iniciar a viagem depois que o ônibus sair da manutenção.
          </Aviso>
        )}

        <Campo
          rotulo="Vagas"
          value={vagas}
          onChangeText={(t) => setVagas(t.replace(/\D/g, ""))}
          placeholder={onibusEscolhido ? String(onibusEscolhido.capacidade) : "Capacidade do ônibus"}
          ajuda="Deixe em branco para usar a capacidade do ônibus."
          keyboardType="number-pad"
        />

        <Botao titulo="Criar viagem" icone="checkmark" onPress={criar} carregando={salvando} style={{ marginTop: 24 }} />
      </Folha>
    </Tela>
  );
}
