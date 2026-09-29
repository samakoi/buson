import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { useNotificacoes } from "../../contexts/NotificacoesContext";
import { useTema } from "../../theme/TemaProvider";
import { BotaoIcone, Cabecalho, Card, EstadoVazio, ItemLista, Secao, Tela } from "../../components/ui";
import { ConviteAvisosNoCelular, PreferenciasAvisos } from "../../features/push/AvisosNoCelular";
import { diaISO, tempoRelativo } from "../../utils/datas";
import { Notificacao, Papel } from "../../types";
import { categoriaAviso } from "../../utils/rotulos";
import { useSessao } from "../../store/sessao";

const subtituloPorPapel: Record<Papel, string> = {
  ALUNO: "Vagas, documentos, lembretes e transporte",
  MOTORISTA: "Liberação dos alunos, ausências e rota",
  ADMIN: "Cadastros, documentos, ocupação e faltas",
};

const vazioPorPapel: Record<Papel, string> = {
  ALUNO: "Você será avisado aqui sobre sua vaga, seus documentos, lembretes do transporte e manutenção do ônibus.",
  MOTORISTA: "Você será avisado aqui quando alunos forem liberados, avisarem ausência ou houver mudança na rota.",
  ADMIN: "Você será avisado aqui sobre novos cadastros, documentos para analisar, ocupação e faltas.",
};

export default function AvisosScreen() {
  const { itens, naoLidas, atualizar, marcarTodasComoLidas } = useNotificacoes();
  const { cores } = useTema();
  const { usuario } = useSessao();
  const focada = useIsFocused();
  const [atualizando, setAtualizando] = useState(false);
  const [preferencias, setPreferencias] = useState(false);
  // Guarda quais estavam não lidas ao abrir a tela, para destacá-las mesmo depois de marcar como lidas
  const [destacadas, setDestacadas] = useState<Set<string>>(new Set());

  useFocusEffect(useCallback(() => { atualizar(); }, [atualizar]));

  // Ao ver a lista, marca tudo como lido (o badge da aba some). Só com a aba visível:
  // as abas continuam montadas em segundo plano depois da primeira visita.
  useEffect(() => {
    if (focada && naoLidas > 0) {
      setDestacadas(new Set(itens.filter((i) => !i.lida).map((i) => i.id)));
      marcarTodasComoLidas().catch(() => undefined);
    }
  }, [focada, naoLidas, itens, marcarTodasComoLidas]);

  async function puxarParaAtualizar() {
    setAtualizando(true);
    await atualizar();
    setAtualizando(false);
  }

  const hoje = diaISO();
  const grupos: { titulo: string; itens: Notificacao[] }[] = [
    { titulo: "Hoje", itens: itens.filter((i) => diaISO(new Date(i.criadoEm)) === hoje) },
    { titulo: "Anteriores", itens: itens.filter((i) => diaISO(new Date(i.criadoEm)) !== hoje) },
  ].filter((g) => g.itens.length > 0);

  return (
    <Tela atualizando={atualizando} onAtualizar={puxarParaAtualizar}>
      <Cabecalho
        titulo="Avisos"
        subtitulo={subtituloPorPapel[usuario?.papel ?? "ALUNO"]}
        acoes={<BotaoIcone icone="settings-outline" rotulo="Avisos no celular" onPress={() => setPreferencias(true)} />}
      />
      <ConviteAvisosNoCelular />
      <PreferenciasAvisos visivel={preferencias} onFechar={() => setPreferencias(false)} />

      {grupos.length === 0 && (
        <Card>
          <EstadoVazio
            icone="notifications-off-outline"
            titulo="Nenhum aviso por enquanto"
            texto={vazioPorPapel[usuario?.papel ?? "ALUNO"]}
          />
        </Card>
      )}

      {grupos.map((g) => (
        <View key={g.titulo}>
          <Secao titulo={g.titulo} />
          <Card semPadding>
            {g.itens.map((item, i) => {
              const { icone, tom } = categoriaAviso[item.categoria] ?? categoriaAviso.GERAL;
              const nova = destacadas.has(item.id);
              return (
                <ItemLista
                  key={item.id}
                  icone={icone}
                  tomIcone={tom}
                  titulo={item.mensagem}
                  subtitulo={tempoRelativo(item.criadoEm)}
                  destacado={nova}
                  ultimo={i === g.itens.length - 1}
                  direita={nova ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: cores.primaria }} /> : undefined}
                />
              );
            })}
          </Card>
        </View>
      ))}
    </Tela>
  );
}
