import React, { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../services/api";
import { Universidade } from "../../types";
import { criarEstilos } from "../../theme/TemaProvider";
import { Aviso, Botao, BotaoIcone, Campo, Chips, Rotulo, Texto } from "../../components/ui";
import { mensagemDeErro } from "../../utils/feedback";

export default function CadastroScreen({ onVoltar }: { onVoltar: () => void }) {
  const { login } = useAuth();
  const s = useEstilos();
  const [universidades, setUniversidades] = useState<Universidade[]>([]);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [universidadeId, setUniversidadeId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const senhaRef = useRef<TextInput>(null);
  const confirmacaoRef = useRef<TextInput>(null);

  useEffect(() => {
    api
      .get<Universidade[]>("/universidades")
      .then(({ data }) => setUniversidades(data))
      .catch((err) => setErro(mensagemDeErro(err, "Não foi possível carregar as universidades.")));
  }, []);

  function validar(): string | null {
    if (nome.trim().length < 2) return "Informe seu nome.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "Informe um e-mail válido.";
    if (senha.length < 6) return "A senha deve ter ao menos 6 caracteres.";
    if (senha !== confirmacao) return "As senhas não conferem.";
    if (!universidadeId) return "Selecione sua universidade.";
    return null;
  }

  async function cadastrar() {
    const problema = validar();
    if (problema) {
      setErro(problema);
      return;
    }
    setErro(null);
    setCarregando(true);
    try {
      const emailNormalizado = email.trim().toLowerCase();
      await api.post("/auth/cadastro", { nome: nome.trim(), email: emailNormalizado, senha, universidadeId });
      await login(emailNormalizado, senha); // já entra no app
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível criar sua conta."));
      setCarregando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <View style={s.form}>
          <BotaoIcone icone="arrow-back" rotulo="Voltar para o login" onPress={onVoltar} style={{ marginLeft: -10 }} />

          <Texto variante="titulo" accessibilityRole="header" style={{ marginTop: 8 }}>
            Criar conta
          </Texto>
          <Texto variante="corpo" cor="textoSuave" style={{ marginBottom: 8 }}>
            Cadastro de aluno para usar o transporte universitário
          </Texto>

          {erro && <Aviso tipo="erro" titulo={erro} style={{ marginTop: 8 }} />}

          <Campo
            rotulo="Nome completo"
            value={nome}
            onChangeText={setNome}
            autoComplete="name"
            placeholder="Seu nome"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            submitBehavior="submit"
          />
          <Campo
            ref={emailRef}
            rotulo="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="seu@email.com"
            returnKeyType="next"
            onSubmitEditing={() => senhaRef.current?.focus()}
            submitBehavior="submit"
          />
          <Campo
            ref={senhaRef}
            rotulo="Senha"
            senha
            value={senha}
            onChangeText={setSenha}
            autoComplete="new-password"
            placeholder="Mínimo de 6 caracteres"
            returnKeyType="next"
            onSubmitEditing={() => confirmacaoRef.current?.focus()}
            submitBehavior="submit"
          />
          <Campo
            ref={confirmacaoRef}
            rotulo="Confirme a senha"
            senha
            value={confirmacao}
            onChangeText={setConfirmacao}
            autoComplete="new-password"
            placeholder="Repita a senha"
            returnKeyType="done"
          />

          <Rotulo>Sua universidade</Rotulo>
          <Chips
            opcoes={universidades.map((u) => ({ valor: u.id, rotulo: u.nome }))}
            valor={universidadeId}
            onChange={setUniversidadeId}
            vazio="Carregando universidades..."
            quebrarLinha
          />

          <Botao titulo="Criar conta" icone="person-add" onPress={cadastrar} carregando={carregando} tamanho="grande" style={{ marginTop: 28 }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useEstilos = criarEstilos((t) => ({
  container: { flexGrow: 1, backgroundColor: t.cores.fundo, alignItems: "center", justifyContent: "center", padding: t.espaco.xxl },
  form: { width: "100%", maxWidth: 420 },
}));
