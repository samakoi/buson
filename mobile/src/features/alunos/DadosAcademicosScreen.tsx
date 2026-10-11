import React, { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { api } from "../../services/api";
import { useQueryClient } from "@tanstack/react-query";
import { MeusDados, Universidade } from "../../types";
import { useUniversidades } from "../cadastros/api";
import { chavesAluno, useMeusDados } from "./api";
import { Aviso, Botao, Cabecalho, Campo, Carregando, Chips, Rotulo, Tela } from "../../components/ui";
import { avisar, mensagemDeErro } from "../../utils/feedback";
import { mascararTelefone } from "../../utils/formatos";

export default function DadosAcademicosScreen() {
  const eu = useMeusDados();
  const universidades = useUniversidades();
  if (!eu.data || !universidades.data) return <Carregando />;
  // O formulário recebe os dados uma vez: buscas novas não apagam o que já foi digitado
  return <FormularioDados eu={eu.data} universidades={universidades.data} />;
}

function FormularioDados({ eu, universidades }: { eu: MeusDados; universidades: Universidade[] }) {
  const navegacao = useNavigation();
  const cliente = useQueryClient();
  const [nome, setNome] = useState(eu.usuario.nome);
  const [matricula, setMatricula] = useState(eu.matricula ?? "");
  const [curso, setCurso] = useState(eu.curso ?? "");
  const [telefone, setTelefone] = useState(eu.telefone ? mascararTelefone(eu.telefone) : "");
  const [universidadeId, setUniversidadeId] = useState<string | null>(eu.universidade.id);
  const universidadeOriginal = eu.universidade.id;
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (nome.trim().length < 2) return setErro("Informe seu nome.");
    if (matricula.trim().length < 3) return setErro("Informe sua matrícula.");
    if (curso.trim().length < 2) return setErro("Informe seu curso.");
    const digitos = telefone.replace(/\D/g, "");
    if (digitos.length < 10) return setErro("Informe o telefone com DDD.");
    setErro(null);
    setSalvando(true);
    try {
      await api.patch("/alunos/me", {
        nome: nome.trim(),
        matricula: matricula.trim(),
        curso: curso.trim(),
        telefone: digitos,
        universidadeId: universidadeId ?? undefined,
      });
      cliente.invalidateQueries({ queryKey: chavesAluno.eu });
      avisar("Dados salvos", "Seus dados acadêmicos foram atualizados.");
      navegacao.goBack();
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível salvar seus dados."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Tela>
      <Cabecalho titulo="Dados acadêmicos" subtitulo="Usados para validar sua matrícula" onVoltar={() => navegacao.goBack()} />

      {erro && <Aviso tipo="erro" titulo={erro} />}

      <Campo rotulo="Nome completo" value={nome} onChangeText={setNome} autoComplete="name" />
      <Campo
        rotulo="Matrícula"
        value={matricula}
        onChangeText={setMatricula}
        autoCapitalize="characters"
        placeholder="Como aparece na declaração da faculdade"
      />
      <Campo rotulo="Curso" value={curso} onChangeText={setCurso} placeholder="Ex.: Engenharia Civil" />
      <Campo
        rotulo="Telefone (WhatsApp)"
        value={telefone}
        onChangeText={(t) => setTelefone(mascararTelefone(t))}
        keyboardType="phone-pad"
        placeholder="(99) 98888-7777"
        autoComplete="tel"
      />

      <Rotulo>Universidade</Rotulo>
      <Chips
        opcoes={universidades.map((u) => ({ valor: u.id, rotulo: u.nome }))}
        valor={universidadeId}
        onChange={setUniversidadeId}
        quebrarLinha
      />
      {universidadeId !== universidadeOriginal && (
        <Aviso tipo="alerta" titulo="Troca de universidade" style={{ marginTop: 12, marginBottom: 0 }}>
          Sua parada na rota muda para a nova universidade. A alteração fica registrada.
        </Aviso>
      )}

      <Botao titulo="Salvar dados" icone="checkmark" onPress={salvar} carregando={salvando} tamanho="grande" style={{ marginTop: 28 }} />
    </Tela>
  );
}
