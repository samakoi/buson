import React from "react";
import { Image, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { criarEstilos, useTema } from "../../theme/TemaProvider";
import { Botao, Texto } from "../../components/ui";
import { avisar, mensagemDeErro } from "../../utils/feedback";
import { formatarTamanho } from "../../utils/formatos";
import { ArquivoEscolhido, CameraSemPermissao, daGaleria, dePdf, problemaNoArquivo, tirarFoto } from "./escolherArquivo";

/**
 * Escolha de um arquivo (foto na hora, galeria ou PDF) com prévia e "Trocar".
 * Usado no comprovante de matrícula e no atestado da falta.
 */
export function SeletorArquivo({
  arquivo,
  onChange,
  onErro,
  prefixo = "foto",
  desabilitado,
}: {
  arquivo: ArquivoEscolhido | null;
  onChange: (a: ArquivoEscolhido | null) => void;
  onErro: (mensagem: string | null) => void;
  prefixo?: string;
  desabilitado?: boolean;
}) {
  const { cores } = useTema();
  const s = useEstilos();

  async function escolher(origem: () => Promise<ArquivoEscolhido | null>, falha: string) {
    onErro(null);
    try {
      const a = await origem();
      if (!a) return;
      const problema = problemaNoArquivo(a);
      if (problema) return onErro(problema);
      onChange(a);
    } catch (err) {
      if (err instanceof CameraSemPermissao) {
        return avisar("Câmera sem permissão", "Permita o uso da câmera nas configurações do celular ou escolha uma foto da galeria.");
      }
      onErro(mensagemDeErro(err, falha));
    }
  }

  if (!arquivo) {
    return (
      <View>
        <View style={s.linha}>
          <Botao titulo="Tirar foto" icone="camera-outline" variante="secundario" onPress={() => escolher(() => tirarFoto(prefixo), "Não foi possível abrir a câmera.")} style={s.opcao} desabilitado={desabilitado} />
          <Botao titulo="Galeria" icone="images-outline" variante="secundario" onPress={() => escolher(() => daGaleria(prefixo), "Não foi possível abrir a galeria.")} style={s.opcao} desabilitado={desabilitado} />
        </View>
        <Botao titulo="Anexar PDF" icone="document-attach-outline" variante="secundario" onPress={() => escolher(dePdf, "Não foi possível abrir os arquivos.")} style={{ marginTop: 8 }} desabilitado={desabilitado} />
      </View>
    );
  }

  const imagem = arquivo.mimeType.startsWith("image/");
  return (
    <View>
      <View style={s.previa}>
        {imagem ? (
          <Image source={{ uri: arquivo.uri }} style={s.miniatura} resizeMode="cover" accessibilityLabel="Prévia da foto" />
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
        <Botao titulo="Trocar" icone="swap-horizontal" variante="fantasma" onPress={() => onChange(null)} desabilitado={desabilitado} style={{ minHeight: 40, paddingHorizontal: 10 }} />
      </View>
      {imagem && (
        <Texto variante="legenda" cor="textoFraco" style={{ marginTop: 8 }}>
          Confira se o texto está legível antes de enviar.
        </Texto>
      )}
    </View>
  );
}

const useEstilos = criarEstilos((t) => ({
  linha: { flexDirection: "row", gap: t.espaco.sm },
  opcao: { flex: 1 },
  previa: { flexDirection: "row", alignItems: "center", gap: t.espaco.md },
  miniatura: { width: 72, height: 72, borderRadius: t.raio.md, backgroundColor: t.cores.superficieAlt },
  iconePdf: { alignItems: "center", justifyContent: "center", backgroundColor: t.cores.primariaSuave },
}));
