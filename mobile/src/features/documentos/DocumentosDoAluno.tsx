import React, { useState } from "react";
import { View } from "react-native";
import { Documento, StatusConta } from "../../types";
import { useTema } from "../../theme/TemaProvider";
import { Aviso, Botao, Campo, Card, Chips, EstadoVazio, Folha, ItemLista, Pilula, Secao, Texto } from "../../components/ui";
import { avisar, confirmar, mensagemDeErro } from "../../utils/feedback";
import { diaISO, formatarDiaBR } from "../../utils/datas";
import { formatarTamanho } from "../../utils/formatos";
import { statusDocumento, tipoDocumento } from "../../utils/rotulos";
import { abrirDocumento, useAnalisarDocumento } from "./api";

const MOTIVOS = ["Documento ilegível", "Sem carimbo ou assinatura da instituição", "Documento de outro semestre", "Nome não confere com o cadastro"];

const dataBR = (iso: string) => formatarDiaBR(diaISO(new Date(iso)));

/** Admin: documentos do aluno com visualização, aprovação e reprovação (motivo obrigatório). */
export function DocumentosDoAluno({
  documentos,
  nome,
  statusConta,
  aoMudar,
}: {
  documentos: Documento[];
  nome: string;
  statusConta: StatusConta;
  aoMudar: () => void;
}) {
  const { espaco } = useTema();
  const [reprovando, setReprovando] = useState<Documento | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const analisar = useAnalisarDocumento(aoMudar);

  const atual = documentos.find((d) => d.status === "PENDENTE" || d.status === "EM_ANALISE") ?? null;
  const anteriores = documentos.filter((d) => d !== atual);

  async function ver(d: Documento) {
    try {
      await abrirDocumento(d.id);
      if (d.status === "PENDENTE") aoMudar(); // abrir coloca "em análise"
    } catch (err) {
      avisar("Não foi possível abrir", mensagemDeErro(err, "Tente novamente."));
    }
  }

  async function aprovar(d: Documento) {
    const ativa = statusConta === "PENDENTE";
    const ok = await confirmar(
      "Aprovar documento",
      ativa ? `Aprovar o documento e ativar a conta de ${nome}? O aluno será avisado e já poderá escolher os dias.` : `Aprovar o documento de ${nome}?`,
      { textoConfirmar: ativa ? "Aprovar e ativar" : "Aprovar" }
    );
    if (!ok) return;
    try {
      await analisar.mutateAsync({ id: d.id, decisao: "aprovar" });
    } catch (err) {
      avisar("Não foi possível aprovar", mensagemDeErro(err, "Tente novamente."));
      aoMudar();
    }
  }

  async function confirmarReprovacao() {
    if (!reprovando) return;
    if (motivo.trim().length < 5) return setErro("Explique o motivo — o aluno vai ler para corrigir.");
    setErro(null);
    try {
      await analisar.mutateAsync({ id: reprovando.id, decisao: "reprovar", motivo: motivo.trim() });
      setReprovando(null);
      setMotivo("");
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível reprovar."));
    }
  }

  return (
    <>
      <Secao titulo="Documentos" />
      {atual && (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <Texto variante="corpoForte" style={{ flex: 1 }}>
              {tipoDocumento[atual.tipo]}
            </Texto>
            <Pilula texto={statusDocumento[atual.status].rotulo} tom={statusDocumento[atual.status].tom} icone={statusDocumento[atual.status].icone} />
          </View>
          <Texto variante="pequeno" cor="textoSuave">
            {atual.nomeOriginal} • {formatarTamanho(atual.tamanho)} • enviado em {dataBR(atual.criadoEm)}
          </Texto>
          <Botao titulo="Ver documento" icone="eye-outline" variante="secundario" onPress={() => ver(atual)} style={{ marginTop: espaco.md }} />
          <View style={{ flexDirection: "row", gap: espaco.sm, marginTop: espaco.sm }}>
            <Botao titulo="Reprovar" icone="close-circle-outline" variante="perigoFantasma" onPress={() => setReprovando(atual)} style={{ flex: 1 }} desabilitado={analisar.isPending} />
            <Botao titulo="Aprovar" icone="checkmark-circle" onPress={() => aprovar(atual)} carregando={analisar.isPending} style={{ flex: 1 }} />
          </View>
        </Card>
      )}

      {anteriores.length > 0 && (
        <Card semPadding style={atual ? { marginTop: espaco.md } : undefined}>
          {anteriores.map((d, i) => {
            const st = statusDocumento[d.status];
            return (
              <ItemLista
                key={d.id}
                icone={d.mimeType === "application/pdf" ? "document-text-outline" : "image-outline"}
                tomIcone={st.tom}
                titulo={d.nomeOriginal}
                subtitulo={[
                  `${dataBR(d.criadoEm)} • ${st.rotulo}${d.analisadoPor ? ` por ${d.analisadoPor.nome}` : ""}`,
                  d.motivoReprovacao ? `Motivo: ${d.motivoReprovacao}` : null,
                ]
                  .filter(Boolean)
                  .join("\n")}
                onPress={() => ver(d)}
                ultimo={i === anteriores.length - 1}
              />
            );
          })}
        </Card>
      )}

      {documentos.length === 0 && (
        <Card>
          <EstadoVazio icone="document-text-outline" titulo="Nenhum documento enviado" texto="O aluno envia o comprovante pelo app, em Perfil › Documentação." />
        </Card>
      )}

      <Folha visivel={!!reprovando} onFechar={() => setReprovando(null)} titulo="Reprovar documento">
        {erro && <Aviso tipo="erro" titulo={erro} />}
        <Texto variante="pequeno" cor="textoSuave">
          {nome} recebe o motivo e pode enviar um novo documento. A conta continua pendente.
        </Texto>
        <View style={{ marginTop: espaco.md }}>
          <Chips opcoes={MOTIVOS.map((m) => ({ valor: m, rotulo: m }))} valor={MOTIVOS.includes(motivo) ? motivo : null} onChange={setMotivo} quebrarLinha />
        </View>
        <Campo rotulo="Motivo" value={motivo} onChangeText={setMotivo} placeholder="Ex.: a declaração está sem o carimbo da faculdade" maxLength={300} multiline />
        <Botao titulo="Reprovar documento" icone="close-circle" variante="perigo" onPress={confirmarReprovacao} carregando={analisar.isPending} style={{ marginTop: 24 }} />
      </Folha>
    </>
  );
}
