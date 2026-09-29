import React, { useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { api } from "../../services/api";
import { MeusDados } from "../../types";
import { useSessao } from "../../store/sessao";
import { useCarregamento } from "../../hooks/useCarregamento";
import { criarEstilos, useTema } from "../../theme/TemaProvider";
import { Aviso, Botao, Cabecalho, Card, Carregando, ItemLista, Pilula, Secao, Tela, Texto, iniciaisDe } from "../../components/ui";
import { confirmar } from "../../utils/feedback";
import { statusConta, statusDocumento } from "../../utils/rotulos";
import type { PilhaAluno } from "../../navigation/AlunoTabs";

/** Central do cadastro do aluno: status da conta e os passos para ficar ativo. */
export default function PerfilScreen() {
  const navegacao = useNavigation<NativeStackNavigationProp<PilhaAluno>>();
  const { logout } = useSessao();
  const { cores } = useTema();
  const s = useEstilos();
  const [dados, setDados] = useState<MeusDados | null>(null);

  const { carregando, atualizando, atualizar } = useCarregamento(async () => {
    const { data } = await api.get<MeusDados>("/alunos/me");
    setDados(data);
  });

  async function sair() {
    if (await confirmar("Sair da conta", "Deseja realmente sair?", { textoConfirmar: "Sair", destrutivo: true })) logout();
  }

  if (carregando || !dados) return <Carregando />;

  const st = statusConta[dados.statusConta];
  const dadosCompletos = !dados.pendencias.includes("DADOS_ACADEMICOS");
  const semDias = dados.pendencias.includes("DIAS_DE_USO");
  const faltaDocumento = dados.pendencias.includes("DOCUMENTO");
  const doc = dados.documento ? statusDocumento[dados.documento.status] : null;
  const ativa = dados.statusConta === "ATIVO";
  const seta = <Ionicons name="chevron-forward" size={18} color={cores.textoFraco} />;

  return (
    <Tela atualizando={atualizando} onAtualizar={atualizar}>
      <Cabecalho titulo="Perfil" />

      <Card>
        <View style={s.topo}>
          <View style={s.avatar}>
            <Texto variante="titulo" cor="primaria">
              {iniciaisDe(dados.usuario.nome)}
            </Texto>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Texto variante="subtitulo">{dados.usuario.nome}</Texto>
            <Texto variante="pequeno" cor="textoSuave">
              {dados.universidade.nome}
              {dados.curso ? ` • ${dados.curso}` : ""}
            </Texto>
            <Pilula texto={st.conta} tom={st.tom} icone={st.icone} />
          </View>
        </View>
      </Card>

      {dados.statusConta === "PENDENTE" && (
        <Aviso tipo="info" titulo="Cadastro em análise">
          Complete os passos abaixo para a administração validar sua matrícula. Enquanto isso, você já pode pedir vagas avulsas na tela Início.
        </Aviso>
      )}
      {dados.statusConta === "INATIVO" && (
        <Aviso tipo="alerta" titulo="Conta inativa">
          Você não pode usar o transporte no momento. Procure a administração.
        </Aviso>
      )}

      <Secao titulo="Seu cadastro" />
      <Card semPadding>
        <ItemLista
          icone="school-outline"
          tomIcone={dadosCompletos ? "sucesso" : "alerta"}
          titulo="Dados acadêmicos"
          subtitulo={dadosCompletos ? `Matrícula ${dados.matricula}` : "Informe matrícula, curso e telefone"}
          abaixo={!dadosCompletos ? <Pilula texto="Pendente" tom="alerta" /> : undefined}
          direita={seta}
          onPress={() => navegacao.navigate("DadosAcademicos")}
        />
        <ItemLista
          icone="document-text-outline"
          tomIcone={faltaDocumento ? "alerta" : (doc?.tom ?? "neutro")}
          titulo="Documentação"
          subtitulo={
            dados.documento?.status === "REPROVADO"
              ? "Documento reprovado — envie outro"
              : dados.documento
                ? "Comprovante de matrícula"
                : faltaDocumento
                  ? "Envie seu comprovante de matrícula"
                  : "Nenhum documento enviado"
          }
          abaixo={
            faltaDocumento && !dados.documento ? (
              <Pilula texto="Pendente" tom="alerta" />
            ) : doc ? (
              <Pilula texto={doc.rotulo} tom={doc.tom} icone={doc.icone} />
            ) : undefined
          }
          direita={seta}
          onPress={() => navegacao.navigate("Documentacao")}
        />
        <ItemLista
          icone="calendar-outline"
          tomIcone={!ativa ? "neutro" : semDias ? "alerta" : "sucesso"}
          titulo="Meus dias"
          subtitulo={ativa ? (semDias ? "Escolha os dias em que você usa o transporte" : "Dias fixos com vaga garantida") : "Disponível depois da validação da matrícula"}
          abaixo={ativa && semDias ? <Pilula texto="Pendente" tom="alerta" /> : undefined}
          direita={seta}
          onPress={() => navegacao.navigate("MeusDias")}
          apagado={!ativa}
          ultimo
        />
      </Card>

      <Botao titulo="Sair da conta" icone="log-out-outline" variante="perigoFantasma" onPress={sair} style={{ marginTop: 8 }} />
    </Tela>
  );
}

const useEstilos = criarEstilos((t) => ({
  topo: { flexDirection: "row", alignItems: "center", gap: t.espaco.lg },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: t.cores.primariaSuave, alignItems: "center", justifyContent: "center" },
}));
