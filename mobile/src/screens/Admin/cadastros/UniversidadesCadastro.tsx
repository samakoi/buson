import React, { useState } from "react";
import { View } from "react-native";
import { api } from "../../../services/api";
import { Universidade } from "../../../types";
import { useCarregamento } from "../../../hooks/useCarregamento";
import { useTema } from "../../../theme/TemaProvider";
import { Aviso, Botao, BotaoIcone, Campo, Card, Carregando, EstadoVazio, Folha, ItemLista } from "../../../components/ui";
import { avisar, confirmar, mensagemDeErro } from "../../../utils/feedback";
import { BarraSecao } from "./BarraSecao";

export default function UniversidadesCadastro() {
  const { cores } = useTema();
  const [universidades, setUniversidades] = useState<Universidade[]>([]);
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const { carregando, recarregar } = useCarregamento(async () => {
    const { data } = await api.get<Universidade[]>("/universidades");
    setUniversidades(data);
  });

  function fechar() {
    setAberto(false);
    setNome("");
    setErro(null);
  }

  async function adicionar() {
    if (nome.trim().length < 2) return setErro("Informe o nome da universidade.");
    setErro(null);
    setSalvando(true);
    try {
      await api.post("/universidades", { nome: nome.trim() });
      fechar();
      await recarregar();
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível cadastrar a universidade."));
    } finally {
      setSalvando(false);
    }
  }

  async function remover(u: Universidade) {
    const ok = await confirmar("Excluir universidade", `Excluir ${u.nome}?`, { textoConfirmar: "Excluir", destrutivo: true });
    if (!ok) return;
    try {
      await api.delete(`/universidades/${u.id}`);
      await recarregar();
    } catch (err) {
      avisar("Não foi possível excluir", mensagemDeErro(err, "Tente novamente.") + " Universidades com alunos ou em rotas não podem ser excluídas.");
    }
  }

  if (carregando) return <Carregando />;

  return (
    <View>
      <BarraSecao texto={`${universidades.length} universidade(s)`} onAdicionar={() => setAberto(true)} />

      <Card semPadding>
        {universidades.map((u, i) => (
          <ItemLista
            key={u.id}
            icone="school-outline"
            titulo={u.nome}
            ultimo={i === universidades.length - 1}
            direita={<BotaoIcone icone="trash-outline" rotulo={`Excluir ${u.nome}`} cor={cores.perigo} onPress={() => remover(u)} />}
          />
        ))}
        {universidades.length === 0 && (
          <EstadoVazio icone="school-outline" titulo="Nenhuma universidade" acao={{ titulo: "Adicionar universidade", icone: "add", onPress: () => setAberto(true) }} />
        )}
      </Card>

      <Folha visivel={aberto} onFechar={fechar} titulo="Nova universidade">
        {erro && <Aviso tipo="erro" titulo={erro} />}
        <Campo rotulo="Nome" value={nome} onChangeText={setNome} placeholder="Ex.: UEMA" returnKeyType="done" onSubmitEditing={adicionar} autoFocus />
        <Botao titulo="Adicionar universidade" icone="add" onPress={adicionar} carregando={salvando} style={{ marginTop: 24 }} />
      </Folha>
    </View>
  );
}
