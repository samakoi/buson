import React, { useCallback, useEffect, useState } from "react";
import { Linking, Switch, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { CategoriaNotificacao } from "../../types";
import { useTema } from "../../theme/TemaProvider";
import { Aviso, Botao, Card, Folha, ItemLista, Texto } from "../../components/ui";
import { avisar, mensagemDeErro } from "../../utils/feedback";
import { ativarPush, convitePushDispensado, disponibilidadePush, dispensarConvitePush, explicacaoIndisponivel, permissaoPush } from "./push";

type Permissao = Awaited<ReturnType<typeof permissaoPush>>;

/** Situação da permissão de push neste aparelho (recarregável). */
function usePermissao() {
  const [permissao, setPermissao] = useState<Permissao | null>(null);
  const recarregar = useCallback(() => permissaoPush().then(setPermissao).catch(() => setPermissao("indisponivel")), []);
  useEffect(() => {
    recarregar();
  }, [recarregar]);
  return { permissao, recarregar };
}

async function ativar(): Promise<boolean> {
  try {
    const ok = await ativarPush();
    if (!ok) avisar("Avisos no celular desligados", "Você pode ativar depois nas configurações do celular, em Notificações › Bus On.");
    return ok;
  } catch (err) {
    avisar("Não foi possível ativar", mensagemDeErro(err, "Tente novamente mais tarde."));
    return false;
  }
}

/** Convite para ativar o push (só aparece onde o push funciona e antes de o usuário decidir). */
export function ConviteAvisosNoCelular() {
  const { permissao, recarregar } = usePermissao();
  const [dispensado, setDispensado] = useState(true);
  useEffect(() => {
    convitePushDispensado().then(setDispensado);
  }, []);

  if (permissao !== "undetermined" || dispensado) return null;
  return (
    <Card>
      <Aviso tipo="info" titulo="Receba os avisos no celular" style={{ marginBottom: 0 }}>
        Vaga confirmada, lembrete da viagem, documento analisado e mudanças no ônibus chegam na hora, mesmo com o app fechado.
      </Aviso>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        <Botao
          titulo="Agora não"
          variante="fantasma"
          onPress={() => {
            dispensarConvitePush();
            setDispensado(true);
          }}
          style={{ flex: 1 }}
        />
        <Botao titulo="Ativar" icone="notifications-outline" onPress={() => ativar().then(recarregar)} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

const ROTULO: Partial<Record<CategoriaNotificacao, { titulo: string; subtitulo: string }>> = {
  LEMBRETE: { titulo: "Lembretes de viagem", subtitulo: "Na véspera e antes da saída" },
  TRANSPORTE: { titulo: "Vagas e lista de espera", subtitulo: "Vaga confirmada, liberada ou promovida da espera" },
};

/** Preferências: o que chega no celular. Os avisos continuam todos na aba Avisos. */
export function PreferenciasAvisos({ visivel, onFechar }: { visivel: boolean; onFechar: () => void }) {
  const { cores } = useTema();
  const cliente = useQueryClient();
  const { permissao, recarregar } = usePermissao();
  const pref = useQuery({
    queryKey: ["notificacoes", "preferencias"],
    queryFn: async () => (await api.get<{ desligaveis: CategoriaNotificacao[]; desligadas: CategoriaNotificacao[] }>("/notificacoes/preferencias")).data,
    enabled: visivel,
  });
  const salvar = useMutation({
    mutationFn: async (desligadas: CategoriaNotificacao[]) => (await api.put("/notificacoes/preferencias", { desligadas })).data,
    onSuccess: (dados) => cliente.setQueryData(["notificacoes", "preferencias"], dados),
    onError: (err) => avisar("Não foi possível salvar", mensagemDeErro(err, "Tente novamente.")),
  });

  useEffect(() => {
    if (visivel) recarregar();
  }, [visivel, recarregar]);

  const disp = disponibilidadePush();
  const desligadas = pref.data?.desligadas ?? [];
  const alternar = (c: CategoriaNotificacao, ligado: boolean) =>
    salvar.mutate(ligado ? desligadas.filter((d) => d !== c) : [...desligadas, c]);

  return (
    <Folha visivel={visivel} onFechar={onFechar} titulo="Avisos no celular">
      {disp !== "disponivel" ? (
        <Aviso tipo="info" titulo="Push indisponível aqui">
          {explicacaoIndisponivel[disp]}
        </Aviso>
      ) : permissao === "granted" ? (
        <Aviso tipo="sucesso" titulo="Avisos no celular ativados" />
      ) : permissao === "denied" ? (
        <Aviso tipo="alerta" titulo="Notificações bloqueadas no celular">
          Libere em Configurações › Notificações › Bus On.
        </Aviso>
      ) : (
        <Botao titulo="Ativar avisos no celular" icone="notifications-outline" onPress={() => ativar().then(recarregar)} />
      )}
      {permissao === "denied" && <Botao titulo="Abrir configurações" variante="secundario" onPress={() => Linking.openSettings()} style={{ marginTop: 8 }} />}

      <Texto variante="pequeno" cor="textoSuave" style={{ marginTop: 16, marginBottom: 8 }}>
        Escolha o que chega no celular. Cadastro, documentos, faltas e viagem cancelada sempre chegam. Tudo continua na aba Avisos.
      </Texto>
      <Card semPadding>
        {(pref.data?.desligaveis ?? ["LEMBRETE", "TRANSPORTE"]).map((c, i, arr) => {
          const ligado = !desligadas.includes(c);
          return (
            <ItemLista
              key={c}
              icone={c === "LEMBRETE" ? "alarm-outline" : "bus-outline"}
              titulo={ROTULO[c]?.titulo ?? c}
              subtitulo={ROTULO[c]?.subtitulo}
              ultimo={i === arr.length - 1}
              direita={
                <Switch
                  value={ligado}
                  onValueChange={(v) => alternar(c, v)}
                  disabled={!pref.data || salvar.isPending}
                  trackColor={{ true: cores.primariaForte, false: cores.bordaForte }}
                  thumbColor={cores.sobrePrimaria}
                  accessibilityLabel={ROTULO[c]?.titulo}
                />
              }
            />
          );
        })}
      </Card>
    </Folha>
  );
}
