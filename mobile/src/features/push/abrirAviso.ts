import { createNavigationContainerRef } from "@react-navigation/native";
import { CategoriaNotificacao, Papel } from "../../types";

/** Referência da navegação para abrir telas a partir de um toque no aviso do celular. */
export const navegacaoRef = createNavigationContainerRef();

type Destino = { tela: string; params?: object };

/** Para onde leva cada tipo de aviso, conforme o perfil de quem recebeu. */
function destino(categoria: CategoriaNotificacao, papel: Papel): Destino {
  if (papel === "ALUNO") {
    switch (categoria) {
      case "FALTA":
        return { tela: "MinhasFaltas" };
      case "DOCUMENTO":
        return { tela: "Documentacao" };
      case "DIAS":
        return { tela: "MeusDias" };
      case "CADASTRO":
        return { tela: "Abas", params: { screen: "Perfil" } };
      case "TRANSPORTE":
      case "LEMBRETE":
      case "VIAGEM":
        return { tela: "Abas", params: { screen: "Início" } };
      default:
        return { tela: "Abas", params: { screen: "Avisos" } };
    }
  }
  if (papel === "ADMIN") {
    if (categoria === "DOCUMENTO") return { tela: "Documentos" };
    if (categoria === "FALTA") return { tela: "Faltas" };
    return { tela: "Abas", params: { screen: "Avisos" } };
  }
  // Motorista: abas direto (sem pilha)
  return ["LEMBRETE", "VIAGEM", "TRANSPORTE"].includes(categoria) ? { tela: "Painel" } : { tela: "Avisos" };
}

/** Abre a tela do aviso; espera a navegação ficar pronta (app aberto pelo toque no aviso). */
export async function abrirTelaDoAviso(categoria: CategoriaNotificacao, papel: Papel) {
  for (let tentativa = 0; tentativa < 20 && !navegacaoRef.isReady(); tentativa++) {
    await new Promise((r) => setTimeout(r, 150));
  }
  if (!navegacaoRef.isReady()) return;
  const { tela, params } = destino(categoria, papel);
  try {
    // Os nomes variam por perfil (cada um tem sua navegação), por isso sem tipagem aqui
    (navegacaoRef.navigate as (tela: string, params?: object) => void)(tela, params);
  } catch (err) {
    console.warn("Não foi possível abrir a tela do aviso", err);
  }
}
