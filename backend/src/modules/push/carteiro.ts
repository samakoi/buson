import { Expo, ExpoPushMessage } from "expo-server-sdk";
import { env } from "../../config/env";

/**
 * Quem entrega os avisos no celular. Em produção, o Expo Push (que repassa ao
 * Google/Apple); nos testes, um carteiro falso que responde como o Expo, sem internet.
 */
export interface Mensagem {
  para: string;
  titulo: string;
  corpo: string;
  dados: Record<string, unknown>;
}

/** Resultado de cada mensagem, na mesma ordem do envio. */
export type Ticket = { ok: true; ticketId: string } | { ok: false; erro: string; tokenInvalido: boolean };
export type Recibo = { ok: true } | { ok: false; erro: string; tokenInvalido: boolean };

export interface Carteiro {
  enviar(mensagens: Mensagem[]): Promise<Ticket[]>;
  recibos(ticketIds: string[]): Promise<Record<string, Recibo>>;
}

export const tokenValido = (token: string) => Expo.isExpoPushToken(token);

class CarteiroExpo implements Carteiro {
  private expo = new Expo({ accessToken: env.push.accessToken });

  async enviar(mensagens: Mensagem[]) {
    const tickets: Ticket[] = [];
    const lotes = this.expo.chunkPushNotifications(
      mensagens.map(
        (m): ExpoPushMessage => ({
          to: m.para,
          title: m.titulo,
          body: m.corpo,
          data: m.dados,
          sound: "default",
          priority: "high",
          channelId: "avisos", // canal criado pelo app no Android
        })
      )
    );
    for (const lote of lotes) {
      try {
        for (const t of await this.expo.sendPushNotificationsAsync(lote)) {
          tickets.push(
            t.status === "ok"
              ? { ok: true, ticketId: t.id }
              : { ok: false, erro: t.details?.error ?? t.message, tokenInvalido: t.details?.error === "DeviceNotRegistered" }
          );
        }
      } catch (err) {
        // Falha de rede/serviço: o lote inteiro volta para a fila
        for (let i = 0; i < lote.length; i++) tickets.push({ ok: false, erro: String((err as Error).message).slice(0, 180), tokenInvalido: false });
      }
    }
    return tickets;
  }

  async recibos(ticketIds: string[]) {
    const resultado: Record<string, Recibo> = {};
    for (const lote of this.expo.chunkPushNotificationReceiptIds(ticketIds)) {
      const recibos = await this.expo.getPushNotificationReceiptsAsync(lote);
      for (const [id, r] of Object.entries(recibos)) {
        resultado[id] =
          r.status === "ok"
            ? { ok: true }
            : { ok: false, erro: r.details?.error ?? r.message, tokenInvalido: r.details?.error === "DeviceNotRegistered" };
      }
    }
    return resultado;
  }
}

/**
 * Carteiro falso (PUSH_MODO=teste). O token decide a resposta, como faria o Expo:
 *  - contém "invalido"        → recusado na hora (DeviceNotRegistered)
 *  - contém "recibo-invalido" → aceito, mas o recibo diz DeviceNotRegistered
 *  - contém "instavel"        → falha temporária (volta para a fila)
 *  - outros                   → entregue
 * Guarda o que "enviou" para os testes conferirem (GET /push/teste/enviados).
 */
export class CarteiroTeste implements Carteiro {
  enviados: Mensagem[] = [];
  private tickets = new Map<string, string>();
  private contador = 0;

  async enviar(mensagens: Mensagem[]) {
    return mensagens.map((m): Ticket => {
      if (m.para.includes("recibo-invalido")) {
        const id = `ticket-${++this.contador}`;
        this.tickets.set(id, m.para);
        this.enviados.push(m);
        return { ok: true, ticketId: id };
      }
      if (m.para.includes("invalido")) return { ok: false, erro: "DeviceNotRegistered", tokenInvalido: true };
      if (m.para.includes("instavel")) return { ok: false, erro: "MessageRateExceeded", tokenInvalido: false };
      const id = `ticket-${++this.contador}`;
      this.tickets.set(id, m.para);
      this.enviados.push(m);
      return { ok: true, ticketId: id };
    });
  }

  async recibos(ticketIds: string[]) {
    return Object.fromEntries(
      ticketIds.map((id): [string, Recibo] => [
        id,
        this.tickets.get(id)?.includes("recibo-invalido") ? { ok: false, erro: "DeviceNotRegistered", tokenInvalido: true } : { ok: true },
      ])
    );
  }
}

export const carteiro: Carteiro | null =
  env.push.modo === "expo" ? new CarteiroExpo() : env.push.modo === "teste" ? new CarteiroTeste() : null;
