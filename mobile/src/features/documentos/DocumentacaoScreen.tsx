import React, { useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { Documento, MeusDados } from "../../types";
import { Aviso, Botao, Cabecalho, Card, Carregando, ItemLista, Pilula, Secao, Tela, Texto } from "../../components/ui";
import { avisar, mensagemDeErro } from "../../utils/feedback";
import { formatarDiaBR, diaISO } from "../../utils/datas";
import { statusDocumento, tipoDocumento } from "../../utils/rotulos";
import { abrirDocumento, useMeusDocumentos } from "./api";
import { EnvioDocumento } from "./EnvioDocumento";

const dataBR = (iso: string) => formatarDiaBR(diaISO(new Date(iso)));

async function verArquivo(d: Documento) {
  try {
    await abrirDocumento(d.id);
  } catch (err) {
    avisar("Não foi possível abrir", mensagemDeErro(err, "Tente novamente."));
  }
}

/** Comprovante de matrícula: status do último envio, motivo da reprovação, reenvio e histórico. */
export default function DocumentacaoScreen() {
  const navegacao = useNavigation();
  const documentos = useMeusDocumentos();
  const eu = useQuery({ queryKey: ["alunos", "me"], queryFn: async () => (await api.get<MeusDados>("/alunos/me")).data });
  const [enviarOutro, setEnviarOutro] = useState(false);

  if (documentos.isLoading || eu.isLoading) return <Carregando />;

  const lista = documentos.data ?? [];
  const ultimo = lista[0] ?? null;
  const inativa = eu.data?.statusConta === "INATIVO";
  const aguardando = ultimo && (ultimo.status === "PENDENTE" || ultimo.status === "EM_ANALISE");
  const podeEnviar = !inativa && !aguardando && (!ultimo || ultimo.status === "REPROVADO" || enviarOutro);
  const atualizar = () => Promise.all([documentos.refetch(), eu.refetch()]);

  return (
    <Tela atualizando={documentos.isRefetching} onAtualizar={atualizar}>
      <Cabecalho titulo="Documentação" subtitulo="Comprovante de matrícula" onVoltar={() => navegacao.goBack()} />

      {inativa && (
        <Aviso tipo="alerta" titulo="Conta inativa">
          Procure a administração do transporte para reativar sua conta.
        </Aviso>
      )}

      {ultimo && (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <Texto variante="subtitulo" style={{ flex: 1 }}>
              {tipoDocumento[ultimo.tipo]}
            </Texto>
            <Pilula texto={statusDocumento[ultimo.status].rotulo} tom={statusDocumento[ultimo.status].tom} icone={statusDocumento[ultimo.status].icone} />
          </View>
          <Texto variante="pequeno" cor="textoSuave" style={{ marginTop: 4 }}>
            Enviado em {dataBR(ultimo.criadoEm)} • {ultimo.nomeOriginal}
          </Texto>

          {ultimo.status === "PENDENTE" && (
            <Texto variante="pequeno" cor="textoSuave" style={{ marginTop: 12 }}>
              A administração vai analisar seu documento. Você recebe um aviso com o resultado.
            </Texto>
          )}
          {ultimo.status === "EM_ANALISE" && (
            <Texto variante="pequeno" cor="textoSuave" style={{ marginTop: 12 }}>
              A administração já está analisando seu documento.
            </Texto>
          )}
          {ultimo.status === "APROVADO" && (
            <Aviso tipo="sucesso" titulo="Matrícula validada" style={{ marginTop: 12, marginBottom: 0 }}>
              {eu.data?.statusConta === "ATIVO" ? "Sua conta está ativa. Escolha seus dias de transporte em Perfil › Meus dias." : "Documento aprovado."}
            </Aviso>
          )}
          {ultimo.status === "REPROVADO" && (
            <Aviso tipo="erro" titulo="Documento reprovado" style={{ marginTop: 12, marginBottom: 0 }}>
              {`Motivo: ${ultimo.motivoReprovacao ?? "não informado"}. Corrija e envie um novo documento abaixo.`}
            </Aviso>
          )}

          <Botao titulo="Ver arquivo enviado" icone="eye-outline" variante="fantasma" onPress={() => verArquivo(ultimo)} style={{ marginTop: 8 }} />
        </Card>
      )}

      {podeEnviar && (
        <>
          <Secao titulo={ultimo ? "Enviar novo documento" : "Enviar documento"} />
          <Card>
            <EnvioDocumento aoEnviar={() => setEnviarOutro(false)} />
          </Card>
        </>
      )}
      {!inativa && ultimo?.status === "APROVADO" && !enviarOutro && (
        <Botao titulo="Enviar documento atualizado" icone="refresh" variante="secundario" onPress={() => setEnviarOutro(true)} />
      )}

      {lista.length > 1 && (
        <>
          <Secao titulo="Envios anteriores" />
          <Card semPadding>
            {lista.slice(1).map((d, i, arr) => {
              const st = statusDocumento[d.status];
              return (
                <ItemLista
                  key={d.id}
                  icone={d.mimeType === "application/pdf" ? "document-text-outline" : "image-outline"}
                  tomIcone={st.tom}
                  titulo={d.nomeOriginal}
                  subtitulo={`${dataBR(d.criadoEm)} • ${st.rotulo}${d.motivoReprovacao ? `\nMotivo: ${d.motivoReprovacao}` : ""}`}
                  onPress={() => verArquivo(d)}
                  ultimo={i === arr.length - 1}
                />
              );
            })}
          </Card>
        </>
      )}
    </Tela>
  );
}
