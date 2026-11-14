
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const secret = req.headers["x-telegram-bot-api-secret-token"];

  if (!process.env.TELEGRAM_WEBHOOK_SECRET ||
      secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return res.status(401).send("Unauthorized");
  }

  try {
    const update = req.body;
    const message = update?.message;
    const chatId = message?.chat?.id;
    const userText = message?.text;

    if (!chatId || !userText || userText.startsWith("/")) {
      return res.status(200).send("OK");
    }

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
          instructions: "You are a helpful, friendly Telegram AI assistant. Give clear and useful answers.",
          input: userText,
          max_output_tokens: 500
        })
      }
    );

    if (!aiResponse.ok) {
      throw new Error("OpenAI API request failed");
    }

    const result = await aiResponse.json();
    const reply = result.output_text || "Sorry, I couldn't generate a reply.";

    await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: reply.slice(0, 4000)
        })
      }
    );

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Bot error:", error.message);
    return res.status(200).send("OK");
  }
}
