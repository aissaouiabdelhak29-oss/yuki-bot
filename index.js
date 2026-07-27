const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 10000;

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "YUKI123";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
// مفتاح OpenRouter الذي أرسلته
// احذف السطر القديم الذي يحتوي على المفتاح واستبدله بهذا:
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

app.use(bodyParser.json());

// 1. التحقق من الويب هوك (GET)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified successfully!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// 2. استقبال الرسائل من ماسنجر والرد عليها عبر OpenRouter
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    res.status(200).send("EVENT_RECEIVED");

    for (const entry of body.entry) {
      if (entry.messaging && entry.messaging[0]) {
        const webhookEvent = entry.messaging[0];
        const senderId = webhookEvent.sender.id;

        if (webhookEvent.message && webhookEvent.message.text) {
          const userText = webhookEvent.message.text;
          console.log(`User message: ${userText}`);

          try {
            // إرسال الطلب إلى OpenRouter باستخدام النماذج المجانية أو المتاحة
            const aiResponse = await axios.post(
              'https://openrouter.ai/api/v1/chat/completions',
              {
                model: 'deepseek/deepseek-chat', // أو استخدم 'openai/gpt-4o-mini' أو أي نموذج متاح
                messages: [
                  {
                    role: 'system',
                    content: 'You are a warm, loving, and romantic companion. Make the reply short like WhatsApp chatting.'
                  },
                  {
                    role: 'user',
                    content: userText
                  }
                ]
              },
              {
                headers: {
                  'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                  'HTTP-Referer': 'https://render.com',
                  'X-Title': 'Yuki Bot',
                  'Content-Type': 'application/json'
                }
              }
            );

            const replyText = aiResponse.data.choices[0].message.content || "أهلاً بك يا غالي";
            await sendMessage(senderId, replyText);

          } catch (err) {
            console.error("OpenRouter Error:", err.response?.data || err.message);
          }
        }
      }
    }
  } else {
    res.sendStatus(404);
  }
});

// دالة إرسال الرسالة إلى ماسنجر
async function sendMessage(recipientId, text) {
  const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
  try {
    await axios.post(url, {
      recipient: { id: recipientId },
      message: { text: text }
    });
    console.log("Message sent to Messenger successfully!");
  } catch (error) {
    console.error("Messenger Send Error:", error.response?.data || error.message);
  }
}

app.get("/", (req, res) => {
  res.send("Yuki Bot with OpenRouter is live!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
