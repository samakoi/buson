import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Falta } from "../../types";
import { useTema } from "../../theme/TemaProvider";
import { Aviso, Botao, Campo, Card, Chips, Folha, Pilula, Texto } from "../../components/ui";
import { avisar, mensagemDeErro } from "../../utils/feedback";
import { diaMes, tempoRelativo } from "../../utils/datas";
import { formatarTamanho } from "../../utils/formatos";
import { situacaoDaFalta, situacaoFalta } from "../../utils/rotulos";
import { abrirAnexoDaFalta, descreverViagem, useDecidirFalta } from "./api";

const MOTIVOS_INDEFERIR = ["Justificativa sem comprovação", "Atestado ilegível ou sem data", "Motivo não justifica a falta"];

/** Admin: detalhes da falta, anexo e decisão (justificar ou indeferir com motivo). */
export function DecisaoFaltaFolha({
  falta,
  nomeAluno,
  onFechar,
  aoDecidir,
}: {
  falta: Falta | null;
  nomeAluno: string;
  onFechar: () => void;
  aoDecidir?: () => void;
}) {
  const { espaco } = useTema();
  const [modo, setModo] = useState<"ver" | "indeferir">("ver");
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const decidir = useDecidirFalta(() => {
    onFechar();
    aoDecidir?.();
  });

  useEffect(() => {
    setModo("ver");
    setTexto("");
    setErro(null);
  }, [falta?.id]);

  if (!falta) return null;
  const st = situacaoFalta[situacaoDaFalta(falta)];
  const aberta = falta.status === "REGISTRADA";

  async function confirmar(decisao: "justificar" | "indeferir") {
    if (!falta) return;
    if (decisao === "indeferir" && texto.trim().length < 5) return setErro("Informe o motivo — o aluno vai ler.");
    setErro(null);
    try {
      await decidir.mutateAsync({ id: falta.id, decisao, texto: texto.trim() });
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível registrar a decisão."));
    }
  }

  async function verAnexo() {
    try {
      await abrirAnexoDaFalta(falta!.id);
    } catch (err) {
      avisar("Não foi possível abrir", mensagemDeErro(err, "Tente novamente."));
    }
  }

  return (
    <Folha visivel onFechar={onFechar} titulo={`Falta na ${descreverViagem(falta.viagem)}`}>
      <Texto variante="corpoForte">{nomeAluno}</Texto>
      <Texto variante="pequeno" cor="textoSuave">
        {falta.viagem.rota.nome} • saída {falta.viagem.horario} • registrada {tempoRelativo(falta.criadoEm)}
      </Texto>
      <View style={{ marginTop: espaco.sm, marginBottom: espaco.md }}>
        <Pilula texto={st.rotulo} tom={st.tom} icone={st.icone} />
      </View>

      <Card>
        <Texto variante="pequenoForte">Justificativa do aluno</Texto>
        <Texto variante="pequeno" cor="textoSuave">
          {falta.justificativa ?? (new Date(falta.prazoJustificativa) >= new Date() ? `Ainda não enviou (prazo até ${diaMes(falta.prazoJustificativa)}).` : "Não enviou dentro do prazo.")}
        </Texto>
        {falta.anexoNome && (
          <Botao
            titulo={`Ver anexo${falta.anexoTamanho ? ` (${formatarTamanho(falta.anexoTamanho)})` : ""}`}
            icone="attach"
            variante="secundario"
            onPress={verAnexo}
            style={{ marginTop: espaco.sm }}
          />
        )}
      </Card>

      {!aberta && (
        <Aviso tipo={falta.status === "JUSTIFICADA" ? "sucesso" : "info"} titulo={st.rotulo} style={{ marginTop: espaco.md }}>
          {[falta.observacaoDecisao, falta.decididoPor ? `por ${falta.decididoPor.nome}` : null].filter(Boolean).join(" • ") || undefined}
        </Aviso>
      )}

      {aberta && (
        <View style={{ marginTop: espaco.lg }}>
          {erro && <Aviso tipo="erro" titulo={erro} />}
          {modo === "indeferir" ? (
            <>
              <Chips opcoes={MOTIVOS_INDEFERIR.map((m) => ({ valor: m, rotulo: m }))} valor={MOTIVOS_INDEFERIR.includes(texto) ? texto : null} onChange={setTexto} quebrarLinha />
              <Campo rotulo="Motivo do indeferimento" value={texto} onChangeText={setTexto} maxLength={300} multiline placeholder="O aluno recebe este texto" />
              <View style={{ flexDirection: "row", gap: espaco.sm, marginTop: espaco.lg }}>
                <Botao titulo="Voltar" variante="secundario" onPress={() => setModo("ver")} style={{ flex: 1 }} desabilitado={decidir.isPending} />
                <Botao titulo="Indeferir" icone="close-circle" variante="perigo" onPress={() => confirmar("indeferir")} carregando={decidir.isPending} style={{ flex: 1 }} />
              </View>
            </>
          ) : (
            <>
              <Campo rotulo="Observação (opcional)" value={texto} onChangeText={setTexto} maxLength={300} placeholder="Ex.: motorista confirmou que ele embarcou" />
              <View style={{ flexDirection: "row", gap: espaco.sm, marginTop: espaco.lg }}>
                <Botao titulo="Indeferir" icone="close-circle-outline" variante="perigoFantasma" onPress={() => { setTexto(""); setModo("indeferir"); }} style={{ flex: 1 }} desabilitado={decidir.isPending} />
                <Botao titulo="Justificar" icone="checkmark-circle" onPress={() => confirmar("justificar")} carregando={decidir.isPending} style={{ flex: 1 }} />
              </View>
            </>
          )}
        </View>
      )}
    </Folha>
  );
}
