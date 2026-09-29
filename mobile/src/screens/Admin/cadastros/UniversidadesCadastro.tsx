import React, { useState } from "react";
import { View } from "react-native";
import { api } from "../../../services/api";
import { Universidade } from "../../../types";
import { useCarregamento } from "../../../hooks/useCarregamento";
import { useTema } from "../../../theme/TemaProvider";
import { Aviso, Botao, BotaoIcone, Campo, Card, Carregando, EstadoVazio, Folha, ItemLista } from "../../../components/ui";
import { avisar, confirmar, mensagemDeErro } from "../../../utils/feedback";
import { CampoCoordenadas, escreverCoordenadas, lerCoordenadas } from "../../../features/gps/CampoCoordenadas";
import { BarraSecao } from "./BarraSecao";

type Formulario = { id?: string; nome: string; endereco: string; coordenadas: string };

export default function UniversidadesCadastro() {
  const { cores } = useTema();
  const [universidades, setUniversidades] = useState<Universidade[]>([]);
  const [form, setForm] = useState<Formulario | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const { carregando, recarregar } = useCarregamento(async () => {
    const { data } = await api.get<Universidade[]>("/universidades");
    setUniversidades(data);
  });

  function abrir(u?: Universidade) {
    setErro(null);
    setForm(u ? { id: u.id, nome: u.nome, endereco: u.endereco ?? "", coordenadas: escreverCoordenadas(u) } : { nome: "", endereco: "", coordenadas: "" });
  }

  async function salvar() {
    if (!form) return;
    if (form.nome.trim().length < 2) return setErro("Informe o nome da universidade.");
    const coordenadas = lerCoordenadas(form.coordenadas);
    if (form.coordenadas.trim() && !coordenadas) return setErro("Localização inválida. Use: latitude, longitude.");
    setErro(null);
    setSalvando(true);
    try {
      const dados = {
        nome: form.nome.trim(),
        endereco: form.endereco.trim() || undefined,
        latitude: coordenadas?.latitude ?? null,
        longitude: coordenadas?.longitude ?? null,
      };
      if (form.id) await api.patch(`/universidades/${form.id}`, dados);
      else await api.post("/universidades", dados);
      setForm(null);
      await recarregar();
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível salvar a universidade."));
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
      <BarraSecao texto={`${universidades.length} universidade(s)`} onAdicionar={() => abrir()} />

      <Card semPadding>
        {universidades.map((u, i) => (
          <ItemLista
            key={u.id}
            icone="school-outline"
            titulo={u.nome}
            subtitulo={[u.endereco, u.latitude == null ? "sem localização no mapa" : null].filter(Boolean).join(" • ") || undefined}
            ultimo={i === universidades.length - 1}
            direita={
              <View style={{ flexDirection: "row" }}>
                <BotaoIcone icone="create-outline" rotulo={`Editar ${u.nome}`} onPress={() => abrir(u)} />
                <BotaoIcone icone="trash-outline" rotulo={`Excluir ${u.nome}`} cor={cores.perigo} onPress={() => remover(u)} />
              </View>
            }
          />
        ))}
        {universidades.length === 0 && (
          <EstadoVazio icone="school-outline" titulo="Nenhuma universidade" acao={{ titulo: "Adicionar universidade", icone: "add", onPress: () => abrir() }} />
        )}
      </Card>

      <Folha visivel={!!form} onFechar={() => setForm(null)} titulo={form?.id ? "Editar universidade" : "Nova universidade"}>
        {form && (
          <>
            {erro && <Aviso tipo="erro" titulo={erro} />}
            <Campo rotulo="Nome" value={form.nome} onChangeText={(nome) => setForm({ ...form, nome })} placeholder="Ex.: UEMA" autoFocus={!form.id} />
            <Campo rotulo="Endereço (opcional)" value={form.endereco} onChangeText={(endereco) => setForm({ ...form, endereco })} placeholder="Ex.: Rua Godofredo Viana, 1300" />
            <CampoCoordenadas valor={form.coordenadas} onChange={(coordenadas) => setForm({ ...form, coordenadas })} />
            <Botao titulo={form.id ? "Salvar" : "Adicionar universidade"} icone="checkmark" onPress={salvar} carregando={salvando} style={{ marginTop: 24 }} />
          </>
        )}
      </Folha>
    </View>
  );
}
