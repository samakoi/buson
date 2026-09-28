import React, { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { api } from "../../services/api";
import { MeusDados, Universidade } from "../../types";
import { useCarregamento } from "../../hooks/useCarregamento";
import { Aviso, Botao, Cabecalho, Campo, Carregando, Chips, Rotulo, Tela } from "../../components/ui";
import { avisar, mensagemDeErro } from "../../utils/feedback";
import { mascararTelefone } from "../../utils/formatos";

export default function DadosAcademicosScreen() {
  const navegacao = useNavigation();
  const [universidades, setUniversidades] = useState<Universidade[]>([]);
  const [nome, setNome] = useState("");
  const [matricula, setMatricula] = useState("");
  const [curso, setCurso] = useState("");
  const [telefone, setTelefone] = useState("");
  const [universidadeId, setUniversidadeId] = useState<string | null>(null);
  const [universidadeOriginal, setUniversidadeOriginal] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Carrega uma vez (não recarrega ao voltar o foco, para não apagar o que foi digitado)
  const [carregado, setCarregado] = useState(false);
  const { carregando } = useCarregamento(async () => {
    if (carregado) return;
    const [{ data: eu }, { data: unis }] = await Promise.all([api.get<MeusDados>("/alunos/me"), api.get<Universidade[]>("/universidades")]);
    setNome(eu.usuario.nome);
    setMatricula(eu.matricula ?? "");
    setCurso(eu.curso ?? "");
    setTelefone(eu.telefone ? mascararTelefone(eu.telefone) : "");
    setUniversidadeId(eu.universidade.id);
    setUniversidadeOriginal(eu.universidade.id);
    setUniversidades(unis);
    setCarregado(true);
  });

  async function salvar() {
    if (nome.trim().length < 2) return setErro("Informe seu nome.");
    if (matricula.trim().length < 3) return setErro("Informe sua matrícula.");
    if (curso.trim().length < 2) return setErro("Informe seu curso.");
    const digitos = telefone.replace(/\D/g, "");
    if (digitos.length < 10) return setErro("Informe o telefone com DDD.");
    setErro(null);
    setSalvando(true);
    try {
      await api.patch("/alunos/me", { nome: nome.trim(), matricula: matricula.trim(), curso: curso.trim(), telefone: digitos, universidadeId: universidadeId ?? undefined });
      avisar("Dados salvos", "Seus dados acadêmicos foram atualizados.");
      navegacao.goBack();
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível salvar seus dados."));
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <Carregando />;

  return (
    <Tela>
      <Cabecalho titulo="Dados acadêmicos" subtitulo="Usados para validar sua matrícula" onVoltar={() => navegacao.goBack()} />

      {erro && <Aviso tipo="erro" titulo={erro} />}

      <Campo rotulo="Nome completo" value={nome} onChangeText={setNome} autoComplete="name" />
      <Campo rotulo="Matrícula" value={matricula} onChangeText={setMatricula} autoCapitalize="characters" placeholder="Como aparece na declaração da faculdade" />
      <Campo rotulo="Curso" value={curso} onChangeText={setCurso} placeholder="Ex.: Engenharia Civil" />
      <Campo rotulo="Telefone (WhatsApp)" value={telefone} onChangeText={(t) => setTelefone(mascararTelefone(t))} keyboardType="phone-pad" placeholder="(99) 98888-7777" autoComplete="tel" />

      <Rotulo>Universidade</Rotulo>
      <Chips opcoes={universidades.map((u) => ({ valor: u.id, rotulo: u.nome }))} valor={universidadeId} onChange={setUniversidadeId} quebrarLinha />
      {universidadeId !== universidadeOriginal && (
        <Aviso tipo="alerta" titulo="Troca de universidade" style={{ marginTop: 12, marginBottom: 0 }}>
          Sua parada na rota muda para a nova universidade. A alteração fica registrada.
        </Aviso>
      )}

      <Botao titulo="Salvar dados" icone="checkmark" onPress={salvar} carregando={salvando} tamanho="grande" style={{ marginTop: 28 }} />
    </Tela>
  );
}
