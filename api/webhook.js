
export default async function handler(req, res) {
  // 1. Allow only Telegram POST requests
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  // 2. Verify Telegram webhook secret
  const secret = req.headers["x-telegram-bot-api-secret-token"];
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return res.status(401).send("Unauthorized");
  }

  try {
    // 3. Read incoming Telegram message
    const update = req.body;
    const message = update?.message;
    const chatId = message?.chat?.id;
    const userText = message?.text?.trim();

    if (!chatId || !userText) {
      return res.status(200).send("OK");
    }

    // 4. Handle /start command
    if (userText === "/start") {
      await sendTelegramMessage(
        chatId,
        "👋 Hello! I'm your AI assistant.\n\nSend me any question and I'll help you."
      );

      return res.status(200).send("OK");
    }

    if (userText === "/help") {
      await sendTelegramMessage(
        chatId,
        "🤖 Just send me a message or question. I'll reply using AI!"
      );

      return res.status(200).send("OK");
    }

    // 5. Ignore other bot commands
    if (userText.startsWith("/")) {
      return res.status(200).send("OK");
    }

    // 6. Check required API keys
    if (!process.env.OPENAI_API_KEY || !process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error("Required environment variables are missing");
    }

    // 7. Ask OpenAI to generate a response
    const aiResponse = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          instructions:
            "You are a helpful, friendly AI assistant on Telegram. " +
            "Answer clearly and accurately. Keep replies concise and useful. " +
            "Use simple formatting that works well in Telegram.",
          input: userText.slice(0, 12000),
          max_output_tokens: 700
        })
      }
    );

    if (!aiResponse.ok) {
      const errorDetails = await aiResponse.text();
      console.error("OpenAI API error:", errorDetails);
      throw new Error("AI response generation failed");
    }

    const result = await aiResponse.json();

    // 8. Extract generated text from the Responses API
    const reply = (result.output || [])
      .filter(item => item.type === "message")
      .flatMap(item => item.content || [])
      .filter(part => part.type === "output_text")
      .map(part => part.text)
      .join("\n")
      .trim();

    if (!reply) {
      throw new Error("OpenAI returned an empty response");
    }

    // 9. Send AI response back to Telegram
    await sendTelegramMessage(chatId, reply.slice(0, 4000));

    return res.status(200).send("OK");

  } catch (error) {
    console.error("Telegram bot error:", error.message);

    // Send a friendly error message when possible
    const chatId = req.body?.message?.chat?.id;

    if (chatId && process.env.TELEGRAM_BOT_TOKEN) {
      try {
        await sendTelegramMessage(
          chatId,
          "Sorry! I'm having a temporary problem. Please try again shortly."
        );
      } catch (telegramError) {
        console.error("Telegram reply error:", telegramError.message);
      }
    }

    return res.status(200).send("OK");
  }
}

// 10. Reusable Telegram message sender
async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text
      })
    }
  );

  if (!response.ok) {
    const errorDetails = await response.text();
    console.error("Telegram API error:", errorDetails);
    throw new Error("Telegram message delivery failed");
  }

  return response.json();
}
