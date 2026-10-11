import React, { useEffect, useState } from "react";
import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Botao, Texto } from "../../components/ui";
import { criarEstilos, useTema } from "../../theme/TemaProvider";

/**
 * Convite para instalar o Bus On pelo navegador (PWA): ícone na tela inicial, abre em tela cheia.
 * - Android/Chrome e computador: o botão abre o "Instalar app" do próprio navegador.
 * - iPhone/iPad (Safari): não existe botão; mostra o caminho Compartilhar › Adicionar à Tela de Início.
 * Some quando o app já está instalado (aberto pelo ícone).
 */

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

// O navegador avisa uma vez, logo ao abrir: guardamos o aviso para usar quando a pessoa tocar no botão
let eventoGuardado: EventoInstalar | null = null;
const ouvintes = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    eventoGuardado = e as EventoInstalar;
    ouvintes.forEach((f) => f());
  });
  window.addEventListener("appinstalled", () => {
    eventoGuardado = null;
    ouvintes.forEach((f) => f());
  });
}

const jaInstalado = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

const ehIOS = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

export function InstalarApp({ compacto = false }: { compacto?: boolean }) {
  const { cores } = useTema();
  const s = useEstilos();
  const [, atualizar] = useState(0);
  useEffect(() => {
    const f = () => atualizar((n) => n + 1);
    ouvintes.add(f);
    return () => {
      ouvintes.delete(f);
    };
  }, []);

  if (jaInstalado()) return null;
  const ios = ehIOS();
  if (!ios && !eventoGuardado && compacto) return null; // no menu, só quando há o que fazer

  async function instalar() {
    if (!eventoGuardado) return;
    await eventoGuardado.prompt();
    await eventoGuardado.userChoice;
    eventoGuardado = null;
    atualizar((n) => n + 1);
  }

  return (
    <View style={s.cartao}>
      <View style={s.linha}>
        <Ionicons name="phone-portrait-outline" size={22} color={cores.primaria} />
        <Texto variante="corpoForte" style={{ flex: 1 }}>
          Use o Bus On como app
        </Texto>
      </View>
      {ios ? (
        <Texto variante="pequeno" cor="textoSuave">
          No Safari, toque em <Texto variante="pequenoForte">Compartilhar</Texto> (o quadrado com a seta) e depois em{" "}
          <Texto variante="pequenoForte">Adicionar à Tela de Início</Texto>. O Bus On fica com ícone e abre em tela cheia.
        </Texto>
      ) : eventoGuardado ? (
        <>
          <Texto variante="pequeno" cor="textoSuave">
            Instale para abrir pelo ícone, em tela cheia, sem passar pelo navegador.
          </Texto>
          <Botao titulo="Instalar o Bus On" icone="download-outline" variante="secundario" onPress={instalar} />
        </>
      ) : (
        <Texto variante="pequeno" cor="textoSuave">
          No menu do navegador (⋮), toque em <Texto variante="pequenoForte">Instalar app</Texto> ou{" "}
          <Texto variante="pequenoForte">Adicionar à tela inicial</Texto>.
        </Texto>
      )}
    </View>
  );
}

const useEstilos = criarEstilos((t) => ({
  cartao: {
    gap: t.espaco.sm,
    padding: t.espaco.lg,
    borderRadius: t.raio.lg,
    backgroundColor: t.cores.primariaSuave,
    marginTop: t.espaco.xl,
  },
  linha: { flexDirection: "row", alignItems: "center", gap: t.espaco.sm },
}));
