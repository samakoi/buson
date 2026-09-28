import React, { useState } from "react";
import { Switch, View } from "react-native";
import { api } from "../../../services/api";
import { Onibus } from "../../../types";
import { useCarregamento } from "../../../hooks/useCarregamento";
import { useTema } from "../../../theme/TemaProvider";
import { Aviso, Botao, BotaoIcone, Campo, Card, Carregando, EstadoVazio, Folha, ItemLista, Texto } from "../../../components/ui";
import { avisar, confirmar, mensagemDeErro } from "../../../utils/feedback";
import { BarraSecao } from "./BarraSecao";

export default function OnibusCadastro() {
  const { cores } = useTema();
  const [onibus, setOnibus] = useState<Onibus[]>([]);

  // Formulário de novo ônibus
  const [novoAberto, setNovoAberto] = useState(false);
  const [placa, setPlaca] = useState("");
  const [capacidade, setCapacidade] = useState("30");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Ônibus sendo colocado em manutenção (abre a folha com a observação)
  const [emManutencao, setEmManutencao] = useState<Onibus | null>(null);
  const [observacao, setObservacao] = useState("");

  const { carregando, recarregar } = useCarregamento(async () => {
    const { data } = await api.get<Onibus[]>("/onibus");
    setOnibus(data);
  });

  function fecharNovo() {
    setNovoAberto(false);
    setPlaca("");
    setCapacidade("30");
    setErro(null);
  }

  async function adicionar() {
    if (placa.trim().length < 4) return setErro("Informe a placa (mínimo 4 caracteres).");
    if (!Number(capacidade)) return setErro("Informe a capacidade.");
    setErro(null);
    setSalvando(true);
    try {
      await api.post("/onibus", { placa: placa.trim(), capacidade: Number(capacidade) });
      fecharNovo();
      await recarregar();
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível cadastrar o ônibus."));
    } finally {
      setSalvando(false);
    }
  }

  async function definirManutencao(o: Onibus, valor: boolean, obs?: string) {
    try {
      await api.patch(`/onibus/${o.id}/manutencao`, { emManutencao: valor, observacao: obs?.trim() || undefined });
      setEmManutencao(null);
      setObservacao("");
      await recarregar();
    } catch (err) {
      avisar("Não foi possível atualizar", mensagemDeErro(err, "Tente novamente."));
    }
  }

  async function alternarManutencao(o: Onibus, valor: boolean) {
    if (valor) {
      setObservacao("");
      setEmManutencao(o);
      return;
    }
    const ok = await confirmar("Liberar ônibus", `Tirar o ${o.placa} da manutenção? Os alunos das próximas viagens serão avisados.`, { textoConfirmar: "Liberar" });
    if (ok) definirManutencao(o, false);
  }

  async function remover(o: Onibus) {
    const ok = await confirmar("Excluir ônibus", `Excluir o ônibus ${o.placa}?`, { textoConfirmar: "Excluir", destrutivo: true });
    if (!ok) return;
    try {
      await api.delete(`/onibus/${o.id}`);
      await recarregar();
    } catch (err) {
      avisar("Não foi possível excluir", mensagemDeErro(err, "Tente novamente.") + " Ônibus com viagens cadastradas não podem ser excluídos.");
    }
  }

  if (carregando) return <Carregando />;

  return (
    <View>
      <BarraSecao texto={`${onibus.length} ônibus`} onAdicionar={() => setNovoAberto(true)} />

      <Card semPadding>
        {onibus.map((o, i) => (
          <ItemLista
            key={o.id}
            icone={o.emManutencao ? "construct" : "bus"}
            tomIcone={o.emManutencao ? "alerta" : "info"}
            titulo={o.placa}
            subtitulo={
              o.emManutencao
                ? `Em manutenção${o.observacaoManutencao ? `: ${o.observacaoManutencao}` : ""}`
                : `${o.capacidade} lugares • em operação`
            }
            ultimo={i === onibus.length - 1}
            direita={
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Switch
                  value={o.emManutencao}
                  onValueChange={(v) => alternarManutencao(o, v)}
                  trackColor={{ true: cores.alerta, false: cores.bordaForte }}
                  thumbColor={cores.sobrePrimaria}
                  accessibilityLabel={`Manutenção do ${o.placa}`}
                />
                <BotaoIcone icone="trash-outline" rotulo={`Excluir ${o.placa}`} cor={cores.perigo} onPress={() => remover(o)} />
              </View>
            }
          />
        ))}
        {onibus.length === 0 && (
          <EstadoVazio icone="bus-outline" titulo="Nenhum ônibus" texto="Cadastre o primeiro ônibus da frota." acao={{ titulo: "Adicionar ônibus", icone: "add", onPress: () => setNovoAberto(true) }} />
        )}
      </Card>
      <Texto variante="legenda" cor="textoFraco" alinhar="center">
        Use o botão ao lado da placa para colocar ou tirar um ônibus da manutenção.
      </Texto>

      <Folha visivel={novoAberto} onFechar={fecharNovo} titulo="Novo ônibus">
        {erro && <Aviso tipo="erro" titulo={erro} />}
        <Campo rotulo="Placa" value={placa} onChangeText={setPlaca} autoCapitalize="characters" placeholder="ABC-1234" autoFocus />
        <Campo rotulo="Lugares" value={capacidade} onChangeText={(t) => setCapacidade(t.replace(/\D/g, ""))} keyboardType="number-pad" />
        <Botao titulo="Adicionar ônibus" icone="add" onPress={adicionar} carregando={salvando} style={{ marginTop: 24 }} />
      </Folha>

      <Folha visivel={!!emManutencao} onFechar={() => setEmManutencao(null)} titulo={`Manutenção do ${emManutencao?.placa ?? ""}`}>
        <Texto variante="pequeno" cor="textoSuave">
          Os alunos com check-in nas próximas viagens deste ônibus serão avisados, e o motorista não poderá iniciar a viagem até o ônibus ser liberado.
        </Texto>
        <Campo
          rotulo="Motivo ou previsão (opcional)"
          value={observacao}
          onChangeText={setObservacao}
          placeholder="Ex.: troca de pneus, volta na segunda"
          maxLength={200}
        />
        <Botao
          titulo="Colocar em manutenção"
          icone="construct"
          variante="perigo"
          onPress={() => emManutencao && definirManutencao(emManutencao, true, observacao)}
          style={{ marginTop: 24 }}
        />
      </Folha>
    </View>
  );
}
