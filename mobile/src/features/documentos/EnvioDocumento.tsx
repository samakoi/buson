import React, { useState } from "react";
import { View } from "react-native";
import { Aviso, Botao, Chips, Rotulo, Texto } from "../../components/ui";
import { avisar, mensagemDeErro } from "../../utils/feedback";
import { tipoDocumento } from "../../utils/rotulos";
import { TipoDocumento } from "../../types";
import { useEnviarDocumento } from "./api";
import { ArquivoEscolhido } from "./escolherArquivo";
import { SeletorArquivo } from "./SeletorArquivo";

/**
 * Envio do comprovante de matrícula: escolha (foto, galeria ou PDF), prévia, tipo e envio.
 * A API confere o conteúdo real do arquivo; aqui só evitamos envios que já sabemos inválidos.
 */
export function EnvioDocumento({ aoEnviar }: { aoEnviar?: () => void }) {
  const enviar = useEnviarDocumento();
  const [arquivo, setArquivo] = useState<ArquivoEscolhido | null>(null);
  const [tipo, setTipo] = useState<TipoDocumento>("DECLARACAO");
  const [erro, setErro] = useState<string | null>(null);

  async function confirmarEnvio() {
    if (!arquivo) return;
    setErro(null);
    try {
      await enviar.mutateAsync({ arquivo, tipo });
      setArquivo(null);
      avisar("Documento enviado", "A administração vai analisar e você recebe um aviso com o resultado.");
      aoEnviar?.();
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível enviar o documento."));
    }
  }

  return (
    <View>
      {erro && <Aviso tipo="erro" titulo={erro} />}
      {!arquivo && (
        <Texto variante="pequeno" cor="textoSuave" style={{ marginBottom: 12 }}>
          Envie a declaração ou o comprovante de matrícula do semestre, com seu nome e a instituição legíveis. PDF ou foto, até 10 MB.
        </Texto>
      )}
      <SeletorArquivo arquivo={arquivo} onChange={setArquivo} onErro={setErro} prefixo="comprovante" desabilitado={enviar.isPending} />

      {arquivo && (
        <>
          <Rotulo>Que documento é este?</Rotulo>
          <Chips
            opcoes={(["DECLARACAO", "COMPROVANTE", "OUTRO"] as const).map((t) => ({ valor: t, rotulo: tipoDocumento[t].replace(" de matrícula", "") }))}
            valor={tipo}
            onChange={setTipo}
          />
          <Botao titulo="Enviar documento" icone="cloud-upload-outline" onPress={confirmarEnvio} carregando={enviar.isPending} style={{ marginTop: 20 }} />
        </>
      )}
    </View>
  );
}
