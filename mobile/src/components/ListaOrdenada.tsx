import React from "react";
import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { criarEstilos, useTema } from "../theme/TemaProvider";
import { BotaoIcone } from "./BotaoIcone";
import { Texto } from "./Texto";

export interface ItemOrdenavel {
  id: string;
  nome: string;
}

/**
 * Paradas em ordem (pontos de embarque, instituições): a lista numerada com subir, descer e tirar,
 * e abaixo os itens que ainda podem ser adicionados. Tirar da lista não apaga o cadastro do item.
 */
export function ListaOrdenada({
  opcoes,
  selecionados,
  onChange,
  vazio,
  nenhumSelecionado,
}: {
  opcoes: ItemOrdenavel[];
  /** Ids na ordem do trajeto */
  selecionados: string[];
  onChange: (ids: string[]) => void;
  /** Quando não há nada cadastrado para escolher */
  vazio: string;
  /** Quando nada foi escolhido ainda */
  nenhumSelecionado: string;
}) {
  const { cores } = useTema();
  const s = useEstilos();
  const nomeDe = (id: string) => opcoes.find((o) => o.id === id)?.nome ?? "(removido do cadastro)";
  const disponiveis = opcoes.filter((o) => !selecionados.includes(o.id));

  function mover(i: number, delta: -1 | 1) {
    const j = i + delta;
    if (j < 0 || j >= selecionados.length) return;
    const nova = [...selecionados];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    onChange(nova);
  }

  return (
    <View>
      {selecionados.length === 0 ? (
        <Texto variante="pequeno" cor="textoFraco" style={s.nenhum}>
          {nenhumSelecionado}
        </Texto>
      ) : (
        <View style={s.lista}>
          {selecionados.map((id, i) => (
            <View key={id} style={[s.linha, i > 0 && s.separador]}>
              <View style={s.ordem}>
                <Texto variante="legenda" cor="primaria" style={{ fontWeight: "800" }}>
                  {i + 1}
                </Texto>
              </View>
              <Texto variante="corpoForte" style={{ flex: 1 }} numberOfLines={2}>
                {nomeDe(id)}
              </Texto>
              {i > 0 && <BotaoIcone icone="arrow-up" rotulo={`Subir ${nomeDe(id)}`} onPress={() => mover(i, -1)} tamanho={20} />}
              {i < selecionados.length - 1 && (
                <BotaoIcone icone="arrow-down" rotulo={`Descer ${nomeDe(id)}`} onPress={() => mover(i, 1)} tamanho={20} />
              )}
              <BotaoIcone
                icone="close"
                rotulo={`Tirar ${nomeDe(id)} da rota`}
                cor={cores.perigo}
                onPress={() => onChange(selecionados.filter((x) => x !== id))}
                tamanho={20}
              />
            </View>
          ))}
        </View>
      )}

      {opcoes.length === 0 ? (
        <Texto variante="pequeno" cor="textoFraco" style={{ marginTop: 8 }}>
          {vazio}
        </Texto>
      ) : (
        disponiveis.length > 0 && (
          <View style={s.adicionar}>
            {disponiveis.map((o) => (
              <Pressable
                key={o.id}
                onPress={() => onChange([...selecionados, o.id])}
                style={({ pressed }) => [s.chip, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel={`Adicionar ${o.nome}`}
              >
                <Ionicons name="add" size={16} color={cores.primaria} />
                <Texto variante="pequenoForte" cor="primaria">
                  {o.nome}
                </Texto>
              </Pressable>
            ))}
          </View>
        )
      )}
    </View>
  );
}

const useEstilos = criarEstilos((t) => ({
  nenhum: { paddingVertical: t.espaco.sm },
  lista: { borderRadius: t.raio.md, borderWidth: 1, borderColor: t.cores.borda, backgroundColor: t.cores.superficie },
  linha: { flexDirection: "row", alignItems: "center", gap: t.espaco.xs, paddingLeft: t.espaco.md, paddingVertical: t.espaco.xs },
  separador: { borderTopWidth: 1, borderTopColor: t.cores.borda },
  ordem: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: t.cores.primariaSuave,
    alignItems: "center",
    justifyContent: "center",
    marginRight: t.espaco.xs,
  },
  adicionar: { flexDirection: "row", flexWrap: "wrap", gap: t.espaco.sm, marginTop: t.espaco.md },
  chip: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: t.espaco.xs,
    borderRadius: t.raio.pill,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: t.cores.primaria,
    paddingHorizontal: t.espaco.md,
  },
}));
