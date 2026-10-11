import type { Programacao, Rota } from "../../types";
import type { DadosTrecho } from "../cadastros/api";

/** Regras do formulário da viagem (sem tela), as mesmas que a API confere. */

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const DIAS_UTEIS = [1, 2, 3, 4, 5];
const trechoVazio: DadosTrecho = { origem: "", destino: "", universidadeIds: [], pontosEmbarqueIds: [] };

export interface Formulario {
  nome: string;
  ida: DadosTrecho;
  volta: DadosTrecho;
  horarioIda: string;
  horarioVolta: string;
  temVolta: boolean;
  diasSemana: number[];
  motoristaId: string | null;
  onibusId: string | null;
  /** Rota sem viagem programada: programar agora (ônibus, motorista, dias) ou salvar só a rota */
  programar: boolean;
}

/** Volta coerente com a ida: origem e destino trocados, as mesmas instituições e os pontos na ordem inversa. */
export const voltaDaIda = (ida: DadosTrecho): DadosTrecho => ({
  origem: ida.destino,
  destino: ida.origem,
  universidadeIds: [...ida.universidadeIds],
  pontosEmbarqueIds: [...ida.pontosEmbarqueIds].reverse(),
});

const doTrecho = (t: Rota["trechos"]["ida"]): DadosTrecho => ({
  origem: t.origem,
  destino: t.destino,
  universidadeIds: t.instituicoes.map((p) => p.universidadeId),
  pontosEmbarqueIds: t.pontosEmbarque.map((p) => p.pontoEmbarqueId),
});

export function formularioInicial(rota: Rota | undefined, programacao: Programacao | undefined, soRota: boolean): Formulario {
  return {
    nome: rota?.nome ?? "",
    ida: rota ? doTrecho(rota.trechos.ida) : trechoVazio,
    volta: rota ? doTrecho(rota.trechos.volta) : trechoVazio,
    horarioIda: programacao?.horarioIda ?? "",
    horarioVolta: programacao?.horarioVolta ?? "",
    temVolta: programacao ? !!programacao.horarioVolta : true,
    diasSemana: programacao?.diasSemana ?? DIAS_UTEIS,
    motoristaId: programacao?.motoristaId ?? null,
    onibusId: programacao?.onibusId ?? null,
    programar: !!programacao || !soRota,
  };
}

function validarTrecho(nome: string, t: DadosTrecho): string | null {
  if (t.origem.trim().length < 2) return `Informe a origem da ${nome}.`;
  if (t.destino.trim().length < 2) return `Informe o destino da ${nome}.`;
  if (t.universidadeIds.length === 0) return `Adicione ao menos uma instituição na ${nome}.`;
  return null;
}

/** Primeiro problema do formulário (ou null). Os dados da viagem só contam quando ela é programada. */
export function validarFormulario(f: Formulario): string | null {
  const problema = validarTrecho("ida", f.ida) ?? validarTrecho("volta", f.volta);
  if (problema) return problema;
  if (!f.programar) return null;
  if (!HORA.test(f.horarioIda)) return "Informe o horário de saída da ida (HH:MM).";
  if (f.temVolta && !HORA.test(f.horarioVolta)) return "Informe o horário de saída da volta (HH:MM) ou desligue a volta.";
  if (f.temVolta && f.horarioVolta <= f.horarioIda) return "O horário da volta deve ser depois do horário da ida.";
  if (f.diasSemana.length === 0) return "Escolha ao menos um dia da semana.";
  if (!f.motoristaId) return "Selecione o motorista.";
  if (!f.onibusId) return "Selecione o ônibus.";
  return null;
}
