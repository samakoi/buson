import { useMutation, useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { api } from "../../services/api";
import { chavesViagem } from "../viagens/api";

/** QR gerado pelo motorista: prefixo de versão + viagem + token temporário. */
export interface QrEmbarque {
  sessaoId: string;
  conteudoQr: string;
  expiraEm: string;
}

export interface ResultadoEmbarque {
  id: string;
  metodo: "QR_MOTORISTA" | "MANUAL";
  dataHora: string;
  viagem?: { id: string; horario: string; rota: string; onibus: string };
  aluno?: { nome: string; universidade: string };
}

const PREFIXO_QR = "BUSON1";

/** Lê o conteúdo escaneado. Devolve null se não for um QR de embarque do Bus On. */
export function lerConteudoQr(texto: string): { viagemId: string; token: string } | null {
  const [prefixo, viagemId, ...resto] = texto.trim().split(".");
  const token = resto.join(".");
  if (prefixo !== PREFIXO_QR || !viagemId || token.length < 20) return null;
  return { viagemId, token };
}

/**
 * Guarda o QR atual de cada viagem enquanto o app está aberto (trocar de aba
 * não gera um QR novo). Se o app reiniciar, um QR novo é gerado — e o antigo
 * deixa de valer no servidor.
 */
export const useQrDaViagem = create<{
  porViagem: Record<string, QrEmbarque>;
  salvar: (viagemId: string, qr: QrEmbarque) => void;
}>((set) => ({
  porViagem: {},
  salvar: (viagemId, qr) => set((s) => ({ porViagem: { ...s.porViagem, [viagemId]: qr } })),
}));

/** Motorista gera/renova o QR temporário da viagem. */
export function useGerarQr() {
  const salvar = useQrDaViagem((s) => s.salvar);
  return useMutation({
    mutationFn: async (viagemId: string) => (await api.post<QrEmbarque>(`/viagens/${viagemId}/embarque/sessao`)).data,
    onSuccess: (qr, viagemId) => salvar(viagemId, qr),
  });
}

/** Aluno escaneia o QR do motorista. O servidor identifica o aluno pelo login. */
export function useEscanearQr() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async ({ viagemId, token }: { viagemId: string; token: string }) =>
      (await api.post<ResultadoEmbarque>(`/viagens/${viagemId}/embarque/scan`, { token })).data,
    onSuccess: () => cliente.invalidateQueries({ queryKey: chavesViagem.atual }),
  });
}

/** Emergência: motorista confirma o embarque de um aluno com vaga confirmada. */
export function useEmbarqueManual() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async ({ viagemId, alunoId }: { viagemId: string; alunoId: string }) =>
      (await api.post<ResultadoEmbarque>(`/viagens/${viagemId}/embarque/manual`, { alunoId })).data,
    onSuccess: () => cliente.invalidateQueries({ queryKey: chavesViagem.atual }),
  });
}
