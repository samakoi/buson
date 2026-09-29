import React, { useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Falta } from "../../types";
import { Aviso, Botao, Cabecalho, Campo, Card, Carregando, EstadoVazio, Folha, ItemLista, Pilula, Secao, Tela, Texto } from "../../components/ui";
import { avisar, mensagemDeErro } from "../../utils/feedback";
import { diaMes } from "../../utils/datas";
import { motivoAusencia, situacaoDaFalta, situacaoFalta } from "../../utils/rotulos";
import { ArquivoEscolhido } from "../documentos/escolherArquivo";
import { SeletorArquivo } from "../documentos/SeletorArquivo";
import { abrirAnexoDaFalta, descreverViagem, tituloViagem, useJustificarFalta, useMinhasFaltas } from "./api";

const podeJustificar = (f: Falta) => f.status === "REGISTRADA" && !f.justificativa && new Date(f.prazoJustificativa) >= new Date();

async function verAnexo(f: Falta) {
  try {
    await abrirAnexoDaFalta(f.id);
  } catch (err) {
    avisar("Não foi possível abrir", mensagemDeErro(err, "Tente novamente."));
  }
}

/** Faltas do aluno: situação, prazo, justificativa (texto + atestado) e ausências avisadas. */
export default function MinhasFaltasScreen() {
  const navegacao = useNavigation();
  const { data, isLoading, refetch, isRefetching } = useMinhasFaltas();
  const justificar = useJustificarFalta();
  const [aberta, setAberta] = useState<Falta | null>(null);
  const [texto, setTexto] = useState("");
  const [anexo, setAnexo] = useState<ArquivoEscolhido | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function abrir(f: Falta) {
    setAberta(f);
    setTexto("");
    setAnexo(null);
    setErro(null);
  }

  async function enviar() {
    if (!aberta) return;
    if (texto.trim().length < 5) return setErro("Explique o motivo da falta.");
    setErro(null);
    try {
      await justificar.mutateAsync({ faltaId: aberta.id, texto: texto.trim(), anexo });
      setAberta(null);
      avisar("Justificativa enviada", "A administração vai analisar e você recebe um aviso com o resultado.");
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível enviar a justificativa."));
    }
  }

  if (isLoading) return <Carregando />;
  const faltas = data?.faltas ?? [];
  const ausencias = data?.ausenciasAvisadas ?? [];
  const aJustificar = faltas.filter(podeJustificar).length;

  return (
    <Tela atualizando={isRefetching} onAtualizar={() => refetch()}>
      <Cabecalho titulo="Minhas faltas" subtitulo={`${faltas.length} falta(s) registrada(s)`} onVoltar={() => navegacao.goBack()} />

      {aJustificar > 0 && (
        <Aviso tipo="alerta" titulo={`${aJustificar} falta(s) para justificar`}>
          Você tem 7 dias depois da viagem para justificar. Toque na falta para enviar o motivo e, se tiver, um atestado.
        </Aviso>
      )}

      <Card semPadding>
        {faltas.map((f, i) => {
          const st = situacaoFalta[situacaoDaFalta(f)];
          const detalhe = podeJustificar(f)
            ? `Justifique até ${diaMes(f.prazoJustificativa)}`
            : f.status === "INDEFERIDA" && f.observacaoDecisao
              ? `Motivo: ${f.observacaoDecisao}`
              : f.status === "REGISTRADA" && !f.justificativa
                ? "Prazo para justificar encerrado"
                : undefined;
          return (
            <ItemLista
              key={f.id}
              icone={st.icone}
              tomIcone={st.tom}
              titulo={tituloViagem(f.viagem)}
              subtitulo={[f.viagem.rota.nome, detalhe].filter(Boolean).join("\n")}
              abaixo={<Pilula texto={st.rotulo} tom={st.tom} />}
              onPress={() => abrir(f)}
              ultimo={i === faltas.length - 1}
            />
          );
        })}
        {faltas.length === 0 && <EstadoVazio icone="checkmark-done-outline" titulo="Nenhuma falta" texto="Continue assim! Se não puder ir, avise antes na tela Início — avisar não conta como falta." />}
      </Card>

      {ausencias.length > 0 && (
        <>
          <Secao titulo="Ausências avisadas (não contam como falta)" />
          <Card semPadding>
            {ausencias.map((a, i) => (
              <ItemLista
                key={a.id}
                icone={a.motivoAusencia === "FALTOU_NA_IDA" ? "swap-horizontal" : "calendar-clear-outline"}
                tomIcone="neutro"
                titulo={tituloViagem(a.viagem)}
                subtitulo={motivoAusencia[a.motivoAusencia]}
                ultimo={i === ausencias.length - 1}
              />
            ))}
          </Card>
        </>
      )}

      <Folha visivel={!!aberta} onFechar={() => setAberta(null)} titulo={aberta ? `Falta na ${descreverViagem(aberta.viagem)}` : ""}>
        {aberta && (
          <>
            <Texto variante="pequeno" cor="textoSuave">
              {aberta.viagem.rota.nome} • saída {aberta.viagem.horario}
            </Texto>
            <View style={{ marginTop: 8, marginBottom: 12 }}>
              <Pilula texto={situacaoFalta[situacaoDaFalta(aberta)].rotulo} tom={situacaoFalta[situacaoDaFalta(aberta)].tom} />
            </View>

            {aberta.justificativa && (
              <Card>
                <Texto variante="pequenoForte">Sua justificativa</Texto>
                <Texto variante="pequeno" cor="textoSuave">
                  {aberta.justificativa}
                </Texto>
                {aberta.anexoNome && <Botao titulo={`Ver anexo (${aberta.anexoNome})`} icone="attach" variante="fantasma" onPress={() => verAnexo(aberta)} />}
              </Card>
            )}
            {aberta.status !== "REGISTRADA" && (
              <Aviso tipo={aberta.status === "JUSTIFICADA" ? "sucesso" : "info"} titulo={aberta.status === "JUSTIFICADA" ? "Falta justificada" : "Justificativa indeferida"} style={{ marginTop: 12 }}>
                {[aberta.observacaoDecisao, aberta.decididoPor ? `Analisada por ${aberta.decididoPor.nome}` : null].filter(Boolean).join(" • ") || undefined}
              </Aviso>
            )}
            {aberta.status === "REGISTRADA" && !aberta.justificativa && !podeJustificar(aberta) && (
              <Aviso tipo="info" titulo="Prazo encerrado">
                O prazo de 7 dias para justificar terminou. Se precisar, procure a administração do transporte.
              </Aviso>
            )}

            {podeJustificar(aberta) && (
              <>
                {erro && <Aviso tipo="erro" titulo={erro} />}
                <Campo
                  rotulo="Por que você faltou?"
                  value={texto}
                  onChangeText={setTexto}
                  placeholder="Ex.: estava com febre e fui ao posto de saúde"
                  maxLength={500}
                  multiline
                />
                <Texto variante="pequenoForte" style={{ marginTop: 16, marginBottom: 8 }}>
                  Atestado ou declaração (opcional)
                </Texto>
                <SeletorArquivo arquivo={anexo} onChange={setAnexo} onErro={setErro} prefixo="atestado" desabilitado={justificar.isPending} />
                <Botao titulo="Enviar justificativa" icone="send" onPress={enviar} carregando={justificar.isPending} style={{ marginTop: 24 }} />
              </>
            )}
          </>
        )}
      </Folha>
    </Tela>
  );
}
