import React, { useEffect, useState } from "react";
import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useDadosDaTela } from "../../hooks/useDadosDaTela";
import { FiltroAlunos, useListaAlunos } from "./api";
import { useTema } from "../../theme/TemaProvider";
import {
  Botao,
  BotaoIcone,
  Cabecalho,
  Campo,
  Card,
  Carregando,
  Chips,
  EstadoVazio,
  ItemLista,
  Pilula,
  Tela,
  iniciaisDe,
} from "../../components/ui";
import { statusConta } from "../../utils/rotulos";
import type { PilhaAdmin } from "../../navigation/AdminTabs";

export default function AlunosScreen() {
  const navegacao = useNavigation<NativeStackNavigationProp<PilhaAdmin>>();
  const { cores, espaco } = useTema();
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [filtro, setFiltro] = useState<FiltroAlunos>("TODOS");

  // Espera o usuário parar de digitar antes de buscar
  useEffect(() => {
    const id = setTimeout(() => setBuscaAplicada(busca.trim()), 350);
    return () => clearTimeout(id);
  }, [busca]);

  // Busca e filtro fazem parte da chave: ao mudar, o React Query busca a primeira página de novo
  const consulta = useListaAlunos(buscaAplicada, filtro);
  const { carregando, atualizando, atualizar } = useDadosDaTela(consulta);
  const paginas = consulta.data?.pages ?? [];
  const lista = paginas.at(-1) ?? null;
  const itens = paginas.flatMap((p) => p.itens);

  if (carregando && !lista) return <Carregando />;

  const c = lista?.contagens ?? { PENDENTE: 0, ATIVO: 0, INATIVO: 0 };
  const totalGeral = c.PENDENTE + c.ATIVO + c.INATIVO;
  const seta = <Ionicons name="chevron-forward" size={18} color={cores.textoFraco} />;

  return (
    <Tela atualizando={atualizando} onAtualizar={atualizar}>
      <Cabecalho
        titulo="Alunos"
        subtitulo={buscaAplicada ? `${totalGeral} resultado(s) para "${buscaAplicada}"` : `${totalGeral} aluno(s) cadastrado(s)`}
        acoes={
          <View style={{ flexDirection: "row" }}>
            <BotaoIcone icone="alert-circle-outline" rotulo="Faltas" onPress={() => navegacao.navigate("Faltas")} />
            <BotaoIcone icone="document-text-outline" rotulo="Documentos para analisar" onPress={() => navegacao.navigate("Documentos")} />
          </View>
        }
      />

      <Campo
        rotulo="Buscar"
        value={busca}
        onChangeText={setBusca}
        placeholder="Nome, matrícula, e-mail ou universidade"
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      <View style={{ marginTop: espaco.md, marginBottom: espaco.md }}>
        <Chips
          opcoes={[
            { valor: "TODOS", rotulo: `Todos (${totalGeral})` },
            { valor: "DOCUMENTO", rotulo: `Doc. pendente (${lista?.documentosPendentes ?? 0})` },
            { valor: "PENDENTE", rotulo: `Pendentes (${c.PENDENTE})` },
            { valor: "ATIVO", rotulo: `Ativos (${c.ATIVO})` },
            { valor: "INATIVO", rotulo: `Inativos (${c.INATIVO})` },
          ]}
          valor={filtro}
          onChange={(v) => setFiltro(v as FiltroAlunos)}
        />
      </View>

      <Card semPadding>
        {itens.map((a, i) => {
          const st = statusConta[a.statusConta];
          return (
            <ItemLista
              key={a.id}
              iniciais={iniciaisDe(a.usuario.nome)}
              tomIcone={st.tom === "neutro" ? "neutro" : "info"}
              titulo={a.usuario.nome}
              subtitulo={[a.matricula, a.universidade.nome, a.curso].filter(Boolean).join(" • ")}
              abaixo={<Pilula texto={st.rotulo} tom={st.tom} icone={st.icone} />}
              direita={seta}
              onPress={() => navegacao.navigate("PerfilAluno", { alunoId: a.id })}
              ultimo={i === itens.length - 1}
            />
          );
        })}
        {itens.length === 0 && (
          <EstadoVazio
            icone="people-outline"
            titulo={buscaAplicada || filtro !== "TODOS" ? "Nenhum aluno encontrado" : "Nenhum aluno cadastrado"}
            texto={
              buscaAplicada || filtro !== "TODOS"
                ? "Tente outra busca ou outro filtro."
                : "Os alunos aparecem aqui quando criam a conta pelo app."
            }
          />
        )}
      </Card>

      {lista && consulta.hasNextPage && (
        <Botao
          titulo={`Carregar mais (${lista.total - itens.length})`}
          variante="fantasma"
          onPress={() => consulta.fetchNextPage()}
          carregando={consulta.isFetchingNextPage}
        />
      )}
    </Tela>
  );
}
