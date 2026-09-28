import React, { useState } from "react";
import { View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { api } from "../../services/api";
import { Perfil, Viagem } from "../../types";
import { useCarregamento } from "../../hooks/useCarregamento";
import { criarEstilos, useTema } from "../../theme/TemaProvider";
import { Aviso, Cabecalho, Card, Carregando, Pilula, Tela, Texto } from "../../components/ui";

export default function QRCodeScreen() {
  const { cores } = useTema();
  const s = useEstilos();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [viagem, setViagem] = useState<Viagem | null>(null);

  const { carregando, atualizando, atualizar } = useCarregamento(async () => {
    // O motorista valida o embarque pelo Aluno.qrCode (não pelo id do usuário)
    const [p, v] = await Promise.all([api.get<Perfil>("/auth/me"), api.get<Viagem | null>("/viagens/atual")]);
    setPerfil(p.data);
    setViagem(v.data);
  });

  if (carregando) return <Carregando />;

  const qrCode = perfil?.aluno?.qrCode;
  const meu = viagem?.meuCheckin;

  return (
    <Tela atualizando={atualizando} onAtualizar={atualizar}>
      <Cabecalho titulo="Seu QR Code" subtitulo="Mostre ao motorista na entrada do ônibus" />

      {!qrCode ? (
        <Aviso tipo="erro" titulo="Não foi possível carregar seu QR Code">
          Puxe para baixo para tentar de novo.
        </Aviso>
      ) : (
        <Card style={s.cartao}>
          <View style={s.qrBox}>
            <QRCode value={qrCode} size={230} color={cores.qrCor} backgroundColor={cores.qrFundo} />
          </View>
          <Texto variante="subtitulo" alinhar="center" style={{ marginTop: 20 }}>
            {perfil?.nome}
          </Texto>
          <Texto variante="pequeno" cor="textoSuave" alinhar="center">
            {perfil?.aluno?.universidade.nome}
          </Texto>
          <View style={s.status}>
            {meu?.embarcado ? (
              <Pilula texto="Embarque confirmado" tom="sucesso" icone="checkmark-done-circle" style={s.centro} />
            ) : meu?.status === "CONFIRMADO" ? (
              <Pilula texto={`Vaga confirmada • saída ${viagem?.horario}`} tom="sucesso" icone="checkmark-circle" style={s.centro} />
            ) : meu?.status === "ESPERA" ? (
              <Pilula texto={`${meu.posicaoFila}º na lista de espera`} tom="info" icone="time" style={s.centro} />
            ) : (
              <Pilula texto="Sem check-in na viagem de hoje" tom="neutro" icone="ellipse-outline" style={s.centro} />
            )}
          </View>
          <Texto variante="legenda" cor="textoFraco" alinhar="center" style={{ marginTop: 16 }}>
            Código {qrCode.slice(0, 8).toUpperCase()}
          </Texto>
        </Card>
      )}

      <Texto variante="pequeno" cor="textoSuave" alinhar="center">
        Dica: aumente o brilho da tela para o motorista ler mais rápido.
      </Texto>
    </Tela>
  );
}

const useEstilos = criarEstilos((t) => ({
  cartao: { alignItems: "center", paddingVertical: t.espaco.xxl },
  qrBox: { backgroundColor: t.cores.qrFundo, padding: t.espaco.lg, borderRadius: t.raio.lg, borderWidth: 1, borderColor: t.cores.borda },
  status: { marginTop: t.espaco.md },
  centro: { alignSelf: "center" },
}));
