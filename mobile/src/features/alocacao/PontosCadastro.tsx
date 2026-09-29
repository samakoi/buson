import React, { useState } from "react";
import { View } from "react-native";
import { PontoEmbarque } from "../../types";
import { useTema } from "../../theme/TemaProvider";
import { Aviso, Botao, BotaoIcone, Campo, Card, Carregando, Chips, EstadoVazio, Folha, ItemLista, Pilula, Rotulo } from "../../components/ui";
import { avisar, codigoDeErro, confirmar, mensagemDeErro } from "../../utils/feedback";
import { BarraSecao } from "../../screens/Admin/cadastros/BarraSecao";
import { useExcluirPonto, usePontosEmbarque, useSalvarPonto } from "./api";

type Formulario = { id?: string; nome: string; endereco: string; ativo: boolean };
const vazio: Formulario = { nome: "", endereco: "", ativo: true };

/** Pontos de embarque: onde os alunos esperam o ônibus na ida (praças, bairros, paradas). */
export default function PontosCadastro() {
  const { cores } = useTema();
  const { data: pontos = [], isLoading } = usePontosEmbarque(true);
  const salvar = useSalvarPonto();
  const excluir = useExcluirPonto();
  const [form, setForm] = useState<Formulario | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function abrir(p?: PontoEmbarque) {
    setErro(null);
    setForm(p ? { id: p.id, nome: p.nome, endereco: p.endereco ?? "", ativo: p.ativo } : vazio);
  }

  async function confirmarFormulario() {
    if (!form) return;
    if (form.nome.trim().length < 2) return setErro("Informe o nome do ponto.");
    const original = pontos.find((p) => p.id === form.id);
    if (original?.ativo && !form.ativo && (original._count?.rotas ?? 0) > 0) {
      const ok = await confirmar(
        "Desativar ponto",
        `${original.nome} sai das rotas em que está. Os alunos que embarcam nele serão avisados para escolher outro ponto.`,
        { textoConfirmar: "Desativar", destrutivo: true }
      );
      if (!ok) return;
    }
    setErro(null);
    try {
      await salvar.mutateAsync({ id: form.id, nome: form.nome.trim(), endereco: form.endereco.trim() || null, ...(form.id && { ativo: form.ativo }) });
      setForm(null);
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível salvar o ponto."));
    }
  }

  async function remover(p: PontoEmbarque) {
    const ok = await confirmar("Excluir ponto", `Excluir ${p.nome}?`, { textoConfirmar: "Excluir", destrutivo: true });
    if (!ok) return;
    try {
      await excluir.mutateAsync(p.id);
    } catch (err) {
      avisar(
        "Não foi possível excluir",
        codigoDeErro(err) === "EM_USO" ? "Este ponto faz parte de uma rota. Desative-o em vez de excluir." : mensagemDeErro(err, "Tente novamente.")
      );
    }
  }

  if (isLoading) return <Carregando />;

  return (
    <View>
      <BarraSecao texto={`${pontos.length} ponto(s) de embarque`} onAdicionar={() => abrir()} />

      <Card semPadding>
        {pontos.map((p, i) => {
          const rotas = p._count?.rotas ?? 0;
          return (
            <ItemLista
              key={p.id}
              icone="location-outline"
              tomIcone={p.ativo ? "info" : "neutro"}
              titulo={p.nome}
              subtitulo={[p.endereco, rotas ? `em ${rotas} rota(s)` : "fora das rotas"].filter(Boolean).join(" • ")}
              abaixo={!p.ativo ? <Pilula texto="Inativo" tom="neutro" /> : undefined}
              apagado={!p.ativo}
              ultimo={i === pontos.length - 1}
              direita={
                <View style={{ flexDirection: "row" }}>
                  <BotaoIcone icone="create-outline" rotulo={`Editar ${p.nome}`} onPress={() => abrir(p)} />
                  <BotaoIcone icone="trash-outline" rotulo={`Excluir ${p.nome}`} cor={cores.perigo} onPress={() => remover(p)} />
                </View>
              }
            />
          );
        })}
        {pontos.length === 0 && (
          <EstadoVazio
            icone="location-outline"
            titulo="Nenhum ponto de embarque"
            texto="Cadastre os locais onde os alunos esperam o ônibus e inclua-os nas rotas."
            acao={{ titulo: "Adicionar ponto", icone: "add", onPress: () => abrir() }}
          />
        )}
      </Card>

      <Folha visivel={!!form} onFechar={() => setForm(null)} titulo={form?.id ? "Editar ponto" : "Novo ponto de embarque"}>
        {form && (
          <>
            {erro && <Aviso tipo="erro" titulo={erro} />}
            <Campo rotulo="Nome" value={form.nome} onChangeText={(nome) => setForm({ ...form, nome })} placeholder="Ex.: Praça da Cultura" autoFocus={!form.id} />
            <Campo
              rotulo="Endereço ou referência (opcional)"
              value={form.endereco}
              onChangeText={(endereco) => setForm({ ...form, endereco })}
              placeholder="Ex.: Av. Getúlio Vargas, em frente ao banco"
            />
            {form.id && (
              <>
                <Rotulo>Situação</Rotulo>
                <Chips
                  opcoes={[
                    { valor: "ativo", rotulo: "Ativo" },
                    { valor: "inativo", rotulo: "Inativo", detalhe: "sai das rotas" },
                  ]}
                  valor={form.ativo ? "ativo" : "inativo"}
                  onChange={(v) => setForm({ ...form, ativo: v === "ativo" })}
                />
              </>
            )}
            <Botao titulo={form.id ? "Salvar" : "Adicionar ponto"} icone="checkmark" onPress={confirmarFormulario} carregando={salvar.isPending} style={{ marginTop: 24 }} />
          </>
        )}
      </Folha>
    </View>
  );
}
