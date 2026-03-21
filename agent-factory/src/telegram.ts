interface TelegramBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
  can_join_groups: boolean;
  can_read_all_group_messages: boolean;
  supports_inline_queries: boolean;
}

interface TelegramResponse {
  ok: boolean;
  result?: TelegramBotInfo;
  description?: string;
}

export async function validateBotToken(token: string): Promise<TelegramBotInfo> {
  const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const data = (await response.json()) as TelegramResponse;

  if (!data.ok || !data.result) {
    throw new Error(`Invalid bot token: ${data.description || 'Unknown error'}`);
  }

  if (!data.result.is_bot) {
    throw new Error('Token does not belong to a bot');
  }

  return data.result;
}
