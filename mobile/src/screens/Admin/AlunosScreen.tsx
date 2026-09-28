import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { api } from "../../services/api";
import { AlunoResumo, ListaAlunos, StatusConta } from "../../types";
import { useCarregamento } from "../../hooks/useCarregamento";
import { useTema } from "../../theme/TemaProvider";
import { Botao, Cabecalho, Campo, Card, Carregando, Chips, EstadoVazio, ItemLista, Pilula, Tela, iniciaisDe } from "../../components/ui";
import { statusConta } from "../../utils/rotulos";
import type { PilhaAdmin } from "../../navigation/AdminTabs";

type FiltroStatus = "TODOS" | StatusConta;
const POR_PAGINA = 20;

export default function AlunosScreen() {
  const navegacao = useNavigation<NativeStackNavigationProp<PilhaAdmin>>();
  const { cores, espaco } = useTema();
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [filtro, setFiltro] = useState<FiltroStatus>("TODOS");
  const [lista, setLista] = useState<ListaAlunos | null>(null);
  const [itens, setItens] = useState<AlunoResumo[]>([]);
  const [carregandoMais, setCarregandoMais] = useState(false);

  // Espera o usuário parar de digitar antes de buscar
  useEffect(() => {
    const id = setTimeout(() => setBuscaAplicada(busca.trim()), 350);
    return () => clearTimeout(id);
  }, [busca]);

  async function buscar(pagina: number) {
    const { data } = await api.get<ListaAlunos>("/alunos", {
      params: { busca: buscaAplicada || undefined, status: filtro === "TODOS" ? undefined : filtro, pagina, porPagina: POR_PAGINA },
    });
    setLista(data);
    setItens((atuais) => (pagina === 1 ? data.itens : [...atuais, ...data.itens]));
  }

  const { carregando, atualizando, atualizar, recarregar } = useCarregamento(() => buscar(1));

  // Mudou a busca ou o filtro: volta para a primeira página
  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    recarregar();
  }, [buscaAplicada, filtro, recarregar]);

  async function carregarMais() {
    if (!lista) return;
    setCarregandoMais(true);
    try {
      await buscar(lista.pagina + 1);
    } finally {
      setCarregandoMais(false);
    }
  }

  if (carregando && !lista) return <Carregando />;

  const c = lista?.contagens ?? { PENDENTE: 0, ATIVO: 0, INATIVO: 0 };
  const totalGeral = c.PENDENTE + c.ATIVO + c.INATIVO;
  const seta = <Ionicons name="chevron-forward" size={18} color={cores.textoFraco} />;

  return (
    <Tela atualizando={atualizando} onAtualizar={atualizar}>
      <Cabecalho titulo="Alunos" subtitulo={buscaAplicada ? `${totalGeral} resultado(s) para "${buscaAplicada}"` : `${totalGeral} aluno(s) cadastrado(s)`} />

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
            { valor: "PENDENTE", rotulo: `Pendentes (${c.PENDENTE})` },
            { valor: "ATIVO", rotulo: `Ativos (${c.ATIVO})` },
            { valor: "INATIVO", rotulo: `Inativos (${c.INATIVO})` },
          ]}
          valor={filtro}
          onChange={(v) => setFiltro(v as FiltroStatus)}
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
            texto={buscaAplicada || filtro !== "TODOS" ? "Tente outra busca ou outro filtro." : "Os alunos aparecem aqui quando criam a conta pelo app."}
          />
        )}
      </Card>

      {lista && itens.length < lista.total && (
        <Botao titulo={`Carregar mais (${lista.total - itens.length})`} variante="fantasma" onPress={carregarMais} carregando={carregandoMais} />
      )}
    </Tela>
  );
}
