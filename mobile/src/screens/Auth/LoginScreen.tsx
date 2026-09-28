import React, { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { criarEstilos } from "../../theme/TemaProvider";
import { Aviso, Botao, Campo, Texto } from "../../components/ui";
import { Logo } from "../../components/Logo";
import { mensagemDeErro } from "../../utils/feedback";

export default function LoginScreen({ onCriarConta }: { onCriarConta: () => void }) {
  const { login } = useAuth();
  const s = useEstilos();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const senhaRef = useRef<TextInput>(null);

  async function handleLogin() {
    if (!email.trim() || !senha) {
      setErro("Informe e-mail e senha.");
      return;
    }
    setErro(null);
    setCarregando(true);
    try {
      await login(email.trim().toLowerCase(), senha);
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível entrar. Verifique a API e tente novamente."));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <View style={s.form}>
          <View style={s.marca}>
            <Logo tamanho={84} />
            <Texto variante="display" style={{ marginTop: 16 }}>
              Bus On
            </Texto>
            <Texto variante="corpo" cor="textoSuave">
              Transporte universitário sem fila e sem surpresa
            </Texto>
          </View>

          {erro && <Aviso tipo="erro" titulo={erro} />}

          <Campo
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
            autoComplete="current-password"
            placeholder="Sua senha"
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />

          <Botao titulo="Entrar" onPress={handleLogin} carregando={carregando} tamanho="grande" style={{ marginTop: 28 }} />

          <Pressable style={s.link} onPress={onCriarConta} accessibilityRole="button">
            <Texto variante="pequeno" cor="textoSuave" alinhar="center">
              Ainda não tem conta?{" "}
              <Texto variante="pequenoForte" cor="primaria">
                Criar conta de aluno
              </Texto>
            </Texto>
          </Pressable>

          {__DEV__ && (
            <Texto variante="legenda" cor="textoFraco" alinhar="center" style={{ marginTop: 8 }}>
              Desenvolvimento: aluno@buson.com, motorista@buson.com ou admin@buson.com (senha: 123456)
            </Texto>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useEstilos = criarEstilos((t) => ({
  container: { flexGrow: 1, backgroundColor: t.cores.fundo, alignItems: "center", justifyContent: "center", padding: t.espaco.xxl },
  form: { width: "100%", maxWidth: 420 },
  marca: { alignItems: "center", gap: t.espaco.xs, marginBottom: t.espaco.xxl },
  link: { marginTop: t.espaco.lg, paddingVertical: t.espaco.md },
}));
