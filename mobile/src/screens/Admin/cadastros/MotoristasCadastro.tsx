import React, { useState } from "react";
import { View } from "react-native";
import { api } from "../../../services/api";
import { Motorista, Onibus } from "../../../types";
import { useCarregamento } from "../../../hooks/useCarregamento";
import { useTema } from "../../../theme/TemaProvider";
import { Aviso, Botao, BotaoIcone, Campo, Card, Carregando, Chips, EstadoVazio, Folha, ItemLista, Rotulo, iniciaisDe } from "../../../components/ui";
import { avisar, confirmar, mensagemDeErro } from "../../../utils/feedback";
import { BarraSecao } from "./BarraSecao";

export default function MotoristasCadastro() {
  const { cores } = useTema();
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [onibus, setOnibus] = useState<Onibus[]>([]);
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [onibusId, setOnibusId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const { carregando, recarregar } = useCarregamento(async () => {
    const [m, o] = await Promise.all([api.get<Motorista[]>("/motoristas"), api.get<Onibus[]>("/onibus")]);
    setMotoristas(m.data);
    setOnibus(o.data);
  });

  function fechar() {
    setAberto(false);
    setNome("");
    setEmail("");
    setSenha("");
    setOnibusId(null);
    setErro(null);
  }

  async function adicionar() {
    if (nome.trim().length < 2) return setErro("Informe o nome do motorista.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErro("Informe um e-mail válido.");
    if (senha.length < 6) return setErro("A senha inicial deve ter ao menos 6 caracteres.");
    setErro(null);
    setSalvando(true);
    try {
      await api.post("/motoristas", { nome: nome.trim(), email: email.trim().toLowerCase(), senha, onibusId: onibusId ?? undefined });
      fechar();
      await recarregar();
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível cadastrar o motorista."));
    } finally {
      setSalvando(false);
    }
  }

  async function remover(m: Motorista) {
    const ok = await confirmar("Remover motorista", `Remover ${m.usuario.nome}? Ele não poderá mais entrar no app.`, { textoConfirmar: "Remover", destrutivo: true });
    if (!ok) return;
    try {
      await api.delete(`/motoristas/${m.id}`);
      await recarregar();
    } catch (err) {
      avisar("Não foi possível remover", mensagemDeErro(err, "Tente novamente."));
    }
  }

  if (carregando) return <Carregando />;

  return (
    <View>
      <BarraSecao texto={`${motoristas.length} motorista(s)`} onAdicionar={() => setAberto(true)} />

      <Card semPadding>
        {motoristas.map((m, i) => (
          <ItemLista
            key={m.id}
            iniciais={iniciaisDe(m.usuario.nome)}
            titulo={m.usuario.nome}
            subtitulo={`${m.usuario.email}${m.onibus ? ` • ${m.onibus.placa}` : ""}`}
            ultimo={i === motoristas.length - 1}
            direita={<BotaoIcone icone="trash-outline" rotulo={`Remover ${m.usuario.nome}`} cor={cores.perigo} onPress={() => remover(m)} />}
          />
        ))}
        {motoristas.length === 0 && (
          <EstadoVazio icone="person-outline" titulo="Nenhum motorista" acao={{ titulo: "Adicionar motorista", icone: "person-add", onPress: () => setAberto(true) }} />
        )}
      </Card>

      <Folha visivel={aberto} onFechar={fechar} titulo="Novo motorista">
        {erro && <Aviso tipo="erro" titulo={erro} />}
        <Campo rotulo="Nome" value={nome} onChangeText={setNome} placeholder="Nome completo" autoFocus />
        <Campo rotulo="E-mail (login)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="motorista@email.com" />
        <Campo rotulo="Senha inicial" senha value={senha} onChangeText={setSenha} placeholder="Mínimo de 6 caracteres" ajuda="Passe a senha ao motorista; ele entra com o e-mail e esta senha." />
        <Rotulo>Ônibus habitual (opcional)</Rotulo>
        <Chips opcoes={onibus.map((o) => ({ valor: o.id, rotulo: o.placa }))} valor={onibusId} onChange={(id) => setOnibusId(id === onibusId ? null : id)} vazio="Nenhum ônibus cadastrado." />
        <Botao titulo="Adicionar motorista" icone="person-add" onPress={adicionar} carregando={salvando} style={{ marginTop: 24 }} />
      </Folha>
    </View>
  );
}
