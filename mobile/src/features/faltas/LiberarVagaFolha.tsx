import React, { useState } from "react";
import { View } from "react-native";
import { MotivoAusencia, Viagem } from "../../types";
import { Aviso, Botao, Chips, Folha, Rotulo, Texto } from "../../components/ui";
import { mensagemDeErro } from "../../utils/feedback";
import { motivoAusencia } from "../../utils/rotulos";
import { liberarVaga } from "./api";

type Motivo = Exclude<MotivoAusencia, "FALTOU_NA_IDA">;
const MOTIVOS: Motivo[] = ["DOENCA", "COMPROMISSO_ACADEMICO", "COMPROMISSO_PESSOAL", "TRABALHO", "TRANSPORTE_PROPRIO", "OUTRO"];

/**
 * "Não vou nesta viagem": o aluno libera a vaga antes da saída informando o motivo.
 * Monte só quando for abrir (o formulário começa limpo a cada vez).
 * Avisar antes não conta como falta — fica como "ausência avisada".
 */
export function LiberarVagaFolha({
  viagem,
  visivel,
  onFechar,
  aoLiberar,
}: {
  viagem: Viagem;
  visivel: boolean;
  onFechar: () => void;
  aoLiberar: (liberouIrma: boolean) => void;
}) {
  const [motivo, setMotivo] = useState<Motivo | null>(null);
  // Na ida de uma viagem programada, oferece liberar também a volta do dia
  const temVolta = viagem.sentido === "IDA" && !!viagem.programacaoId;
  const [diaTodo, setDiaTodo] = useState<"sim" | "nao">("sim");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    if (!motivo) return setErro("Escolha o motivo.");
    setErro(null);
    setEnviando(true);
    try {
      const r = await liberarVaga(viagem.id, motivo, temVolta && diaTodo === "sim");
      aoLiberar(r.liberouIrma);
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível liberar a vaga."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Folha visivel={visivel} onFechar={onFechar} titulo="Não vou nesta viagem">
      <Texto variante="pequeno" cor="textoSuave">
        Sua vaga vai para outro aluno. Avisar antes da saída não conta como falta — seus dias fixos continuam valendo nas próximas semanas.
      </Texto>
      {erro && <Aviso tipo="erro" titulo={erro} style={{ marginTop: 12 }} />}

      <Rotulo>Motivo</Rotulo>
      <Chips opcoes={MOTIVOS.map((m) => ({ valor: m, rotulo: motivoAusencia[m] }))} valor={motivo} onChange={setMotivo} quebrarLinha />

      {temVolta && (
        <>
          <Rotulo>E a volta de hoje?</Rotulo>
          <Chips
            opcoes={[
              { valor: "sim", rotulo: "Também não volto de ônibus" },
              { valor: "nao", rotulo: "Vou precisar da volta" },
            ]}
            valor={diaTodo}
            onChange={setDiaTodo}
            quebrarLinha
          />
        </>
      )}

      <View style={{ marginTop: 24 }}>
        <Botao titulo="Liberar minha vaga" icone="close-circle" variante="perigo" onPress={confirmar} carregando={enviando} />
      </View>
    </Folha>
  );
}
