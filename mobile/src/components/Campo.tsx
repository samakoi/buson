import React, { useState } from "react";
import { TextInput, TextInputProps, View } from "react-native";
import { criarEstilos, useTema } from "../theme/TemaProvider";
import { Texto } from "./Texto";
import { BotaoIcone } from "./BotaoIcone";

/** Campo de texto com rótulo. Com `senha`, mostra o botão de exibir/ocultar. */
export const Campo = React.forwardRef<TextInput, TextInputProps & { rotulo: string; senha?: boolean; ajuda?: string }>(
  function Campo({ rotulo, senha, ajuda, style, onFocus, onBlur, ...props }, ref) {
    const { cores } = useTema();
    const s = useEstilos();
    const [visivel, setVisivel] = useState(false);
    const [focado, setFocado] = useState(false);
    return (
      <View style={s.bloco}>
        <Texto variante="pequenoForte" style={s.rotulo}>
          {rotulo}
        </Texto>
        <View>
          <TextInput
            ref={ref}
            placeholderTextColor={cores.textoFraco}
            secureTextEntry={senha && !visivel}
            style={[s.input, focado && s.inputFocado, senha && { paddingRight: 48 }, style]}
            onFocus={(e) => {
              setFocado(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocado(false);
              onBlur?.(e);
            }}
            {...props}
          />
          {senha && (
            <BotaoIcone
              icone={visivel ? "eye-off-outline" : "eye-outline"}
              rotulo={visivel ? "Ocultar senha" : "Mostrar senha"}
              onPress={() => setVisivel((v) => !v)}
              style={s.olho}
            />
          )}
        </View>
        {ajuda ? (
          <Texto variante="legenda" cor="textoFraco" style={s.ajuda}>
            {ajuda}
          </Texto>
        ) : null}
      </View>
    );
  }
);

const useEstilos = criarEstilos((t) => ({
  bloco: { marginTop: t.espaco.lg },
  rotulo: { marginBottom: t.espaco.sm },
  input: {
    minHeight: 50,
    backgroundColor: t.cores.superficie,
    borderRadius: t.raio.md,
    borderWidth: 1.5,
    borderColor: t.cores.bordaForte,
    paddingHorizontal: t.espaco.lg,
    fontSize: t.tipo.corpo.fontSize,
    color: t.cores.texto,
  },
  inputFocado: { borderColor: t.cores.primaria },
  olho: { position: "absolute", right: 3, top: 3 },
  ajuda: { marginTop: t.espaco.xs },
}));
