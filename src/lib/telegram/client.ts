export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramAudio {
  file_id: string;
  file_unique_id: string;
  duration: number;
  performer?: string;
  title?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
  voice?: TelegramVoice;
  audio?: TelegramAudio;
  document?: TelegramDocument;
  reply_to_message?: TelegramMessage;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  inline_message_id?: string;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface SendMessageOptions {
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
  reply_markup?: InlineKeyboardMarkup;
  reply_to_message_id?: number;
  disable_web_page_preview?: boolean;
}

export function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN não configurada no ambiente (.env ou .env.local).");
  }
  return token;
}

export function getBotUsername(): string | null {
  return process.env.TELEGRAM_BOT_NAME ?? null;
}

const TELEGRAM_API_BASE = "https://api.telegram.org";

export class TelegramClient {
  private token: string;

  constructor(token?: string) {
    this.token = token ?? getBotToken();
  }

  private async callApi<T>(method: string, body?: Record<string, unknown> | FormData): Promise<T> {
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
    const url = `${TELEGRAM_API_BASE}/bot${this.token}/${method}`;
    const headers: Record<string, string> = {};

    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
    });

    const result = (await response.json()) as { ok: boolean; result: T; description?: string };
    if (!result.ok) {
      throw new Error(`Telegram API Error (${method}): ${result.description ?? "Erro desconhecido"}`);
    }
    return result.result;
  }

  async getMe(): Promise<TelegramUser> {
    return this.callApi<TelegramUser>("getMe");
  }

  async sendMessage(chatId: string | number, text: string, options?: SendMessageOptions): Promise<TelegramMessage> {
    return this.callApi<TelegramMessage>("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: options?.parse_mode ?? "HTML",
      reply_markup: options?.reply_markup,
      reply_to_message_id: options?.reply_to_message_id,
      disable_web_page_preview: options?.disable_web_page_preview ?? true,
    });
  }

  async editMessageText(
    chatId: string | number,
    messageId: number,
    text: string,
    options?: SendMessageOptions,
  ): Promise<TelegramMessage | boolean> {
    return this.callApi<TelegramMessage | boolean>("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: options?.parse_mode ?? "HTML",
      reply_markup: options?.reply_markup,
      disable_web_page_preview: options?.disable_web_page_preview ?? true,
    });
  }

  async answerCallbackQuery(callbackQueryId: string, options?: { text?: string; show_alert?: boolean }): Promise<boolean> {
    return this.callApi<boolean>("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text: options?.text,
      show_alert: options?.show_alert,
    });
  }

  async sendChatAction(chatId: string | number, action: "typing" | "upload_document" | "upload_photo" | "record_voice"): Promise<boolean> {
    try {
      return await this.callApi<boolean>("sendChatAction", {
        chat_id: chatId,
        action,
      });
    } catch {
      return false;
    }
  }

  async sendDocument(
    chatId: string | number,
    fileBuffer: Buffer | Uint8Array,
    filename: string,
    caption?: string,
    options?: SendMessageOptions,
  ): Promise<TelegramMessage> {
    const formData = new FormData();
    formData.append("chat_id", String(chatId));
    formData.append("caption", caption ?? "");
    if (options?.parse_mode) formData.append("parse_mode", options.parse_mode);

    // Convert Buffer/Uint8Array to Blob
    const blob = new Blob([fileBuffer as any]);
    formData.append("document", blob, filename);

    return this.callApi<TelegramMessage>("sendDocument", formData);
  }

  async getFile(fileId: string): Promise<{ file_id: string; file_unique_id: string; file_size?: number; file_path?: string }> {
    return this.callApi("getFile", { file_id: fileId });
  }

  async downloadFile(filePath: string): Promise<Buffer> {
    const url = `${TELEGRAM_API_BASE}/file/bot${this.token}/${filePath}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Falha ao baixar arquivo do Telegram: HTTP ${res.status}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async setWebhook(url: string, secretToken?: string): Promise<boolean> {
    return this.callApi<boolean>("setWebhook", {
      url,
      secret_token: secretToken,
      allowed_updates: ["message", "edited_message", "callback_query"],
    });
  }

  async deleteWebhook(dropPendingUpdates = false): Promise<boolean> {
    return this.callApi<boolean>("deleteWebhook", {
      drop_pending_updates: dropPendingUpdates,
    });
  }

  async getUpdates(offset?: number, limit = 50, timeout = 25): Promise<TelegramUpdate[]> {
    return this.callApi<TelegramUpdate[]>("getUpdates", {
      offset,
      limit,
      timeout,
      allowed_updates: ["message", "edited_message", "callback_query"],
    });
  }
}
