import React, { useState } from "react";
import { Image, Platform, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { criarEstilos, useTema } from "../../theme/TemaProvider";
import { Aviso, Botao, Chips, Rotulo, Texto } from "../../components/ui";
import { avisar, mensagemDeErro } from "../../utils/feedback";
import { formatarTamanho } from "../../utils/formatos";
import { tipoDocumento } from "../../utils/rotulos";
import { TipoDocumento } from "../../types";
import { ArquivoEscolhido, TAMANHO_MAXIMO, useEnviarDocumento } from "./api";

const TIPOS_ACEITOS = ["application/pdf", "image/jpeg", "image/png"];

/**
 * Escolha do comprovante (foto na hora, galeria ou PDF), prévia e envio.
 * A API confere o conteúdo real do arquivo; aqui só evitamos envios que já sabemos inválidos.
 */
export function EnvioDocumento({ aoEnviar }: { aoEnviar?: () => void }) {
  const { cores } = useTema();
  const s = useEstilos();
  const enviar = useEnviarDocumento();
  const [arquivo, setArquivo] = useState<ArquivoEscolhido | null>(null);
  const [tipo, setTipo] = useState<TipoDocumento>("DECLARACAO");
  const [erro, setErro] = useState<string | null>(null);

  function escolher(a: ArquivoEscolhido) {
    setErro(null);
    if (!TIPOS_ACEITOS.includes(a.mimeType)) return setErro("Formato não aceito. Envie um PDF ou uma foto (JPG ou PNG).");
    if (a.tamanho && a.tamanho > TAMANHO_MAXIMO) return setErro(`O arquivo tem ${formatarTamanho(a.tamanho)}. O limite é 10 MB.`);
    setArquivo(a);
  }

  const daImagem = (r: ImagePicker.ImagePickerResult) => {
    const a = r.canceled ? null : r.assets[0];
    if (!a) return;
    const mimeType = a.mimeType ?? (a.uri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
    escolher({
      uri: a.uri,
      nome: a.fileName ?? `comprovante-${Date.now()}.${mimeType === "image/png" ? "png" : "jpg"}`,
      mimeType,
      tamanho: a.fileSize ?? null,
      file: a.file ?? undefined,
    });
  };

  async function tirarFoto() {
    try {
      if (Platform.OS !== "web") {
        const permissao = await ImagePicker.requestCameraPermissionsAsync();
        if (!permissao.granted) {
          return avisar("Câmera sem permissão", "Permita o uso da câmera nas configurações do celular ou escolha uma foto da galeria.");
        }
      }
      daImagem(await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.7 }));
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível abrir a câmera."));
    }
  }

  async function daGaleria() {
    try {
      daImagem(await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.7 }));
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível abrir a galeria."));
    }
  }

  async function dePdf() {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: TIPOS_ACEITOS, copyToCacheDirectory: true });
      const a = r.canceled ? null : r.assets[0];
      if (!a) return;
      escolher({ uri: a.uri, nome: a.name, mimeType: a.mimeType ?? "application/pdf", tamanho: a.size ?? null, file: a.file });
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível abrir os arquivos."));
    }
  }

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

  const imagem = arquivo?.mimeType.startsWith("image/");

  return (
    <View>
      {erro && <Aviso tipo="erro" titulo={erro} />}

      {!arquivo ? (
        <>
          <Texto variante="pequeno" cor="textoSuave" style={{ marginBottom: 12 }}>
            Envie a declaração ou o comprovante de matrícula do semestre, com seu nome e a instituição legíveis. PDF ou foto, até 10 MB.
          </Texto>
          <View style={s.opcoes}>
            <Botao titulo="Tirar foto" icone="camera-outline" variante="secundario" onPress={tirarFoto} style={s.opcao} />
            <Botao titulo="Galeria" icone="images-outline" variante="secundario" onPress={daGaleria} style={s.opcao} />
          </View>
          <Botao titulo="Anexar PDF" icone="document-attach-outline" variante="secundario" onPress={dePdf} style={{ marginTop: 8 }} />
        </>
      ) : (
        <>
          <View style={s.previa}>
            {imagem ? (
              <Image source={{ uri: arquivo.uri }} style={s.miniatura} resizeMode="cover" accessibilityLabel="Prévia da foto do documento" />
            ) : (
              <View style={[s.miniatura, s.iconePdf]}>
                <Ionicons name="document-text" size={32} color={cores.primaria} />
              </View>
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Texto variante="corpoForte" numberOfLines={2}>
                {arquivo.nome}
              </Texto>
              <Texto variante="pequeno" cor="textoSuave">
                {imagem ? "Foto" : "PDF"}
                {arquivo.tamanho ? ` • ${formatarTamanho(arquivo.tamanho)}` : ""}
              </Texto>
            </View>
          </View>
          {imagem && (
            <Texto variante="legenda" cor="textoFraco" style={{ marginTop: 8 }}>
              Confira se o texto está legível antes de enviar.
            </Texto>
          )}

          <Rotulo>Que documento é este?</Rotulo>
          <Chips
            opcoes={(["DECLARACAO", "COMPROVANTE", "OUTRO"] as const).map((t) => ({ valor: t, rotulo: tipoDocumento[t].replace(" de matrícula", "") }))}
            valor={tipo}
            onChange={setTipo}
          />

          <View style={[s.opcoes, { marginTop: 20 }]}>
            <Botao titulo="Trocar" icone="swap-horizontal" variante="secundario" onPress={() => setArquivo(null)} style={s.opcao} desabilitado={enviar.isPending} />
            <Botao titulo="Enviar" icone="cloud-upload-outline" onPress={confirmarEnvio} carregando={enviar.isPending} style={s.opcao} />
          </View>
        </>
      )}
    </View>
  );
}

const useEstilos = criarEstilos((t) => ({
  opcoes: { flexDirection: "row", gap: t.espaco.sm },
  opcao: { flex: 1 },
  previa: { flexDirection: "row", alignItems: "center", gap: t.espaco.md },
  miniatura: { width: 72, height: 72, borderRadius: t.raio.md, backgroundColor: t.cores.superficieAlt },
  iconePdf: { alignItems: "center", justifyContent: "center", backgroundColor: t.cores.primariaSuave },
}));
