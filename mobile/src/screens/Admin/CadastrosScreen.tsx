import React, { useState } from "react";
import { View } from "react-native";
import { Cabecalho, Chips, Tela } from "../../components/ui";
import { useTema } from "../../theme/TemaProvider";
import OnibusCadastro from "./cadastros/OnibusCadastro";
import MotoristasCadastro from "./cadastros/MotoristasCadastro";
import UniversidadesCadastro from "./cadastros/UniversidadesCadastro";
import RotasCadastro from "./cadastros/RotasCadastro";
import PontosCadastro from "../../features/alocacao/PontosCadastro";

type Secao = "onibus" | "motoristas" | "universidades" | "pontos" | "rotas";

const secoes: { valor: Secao; rotulo: string }[] = [
  { valor: "onibus", rotulo: "Ônibus" },
  { valor: "motoristas", rotulo: "Motoristas" },
  { valor: "universidades", rotulo: "Universidades" },
  { valor: "pontos", rotulo: "Pontos" },
  { valor: "rotas", rotulo: "Rotas" },
];

export default function CadastrosScreen() {
  const { espaco } = useTema();
  const [secao, setSecao] = useState<Secao>("onibus");

  return (
    <Tela>
      <Cabecalho titulo="Cadastros" subtitulo="Frota, equipe e trajetos" />
      <View style={{ marginBottom: espaco.lg }}>
        <Chips opcoes={secoes} valor={secao} onChange={setSecao} />
      </View>

      {secao === "onibus" && <OnibusCadastro />}
      {secao === "motoristas" && <MotoristasCadastro />}
      {secao === "universidades" && <UniversidadesCadastro />}
      {secao === "pontos" && <PontosCadastro />}
      {secao === "rotas" && <RotasCadastro />}
    </Tela>
  );
}
