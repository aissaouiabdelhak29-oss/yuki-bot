const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 10000;

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "YUKI123";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
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

// 2. استقبال الرسائل من ماسنجر أو إنستغرام والرد عليها
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object === "page" || body.object === "instagram") {
    res.status(200).send("EVENT_RECEIVED");

    for (const entry of body.entry) {
      // التعامل مع رسائل ماسنجر التقليدية
      if (entry.messaging && entry.messaging[0]) {
        const webhookEvent = entry.messaging[0];
        const senderId = webhookEvent.sender.id;

        if (webhookEvent.message && webhookEvent.message.text) {
          await handleAiResponse(senderId, webhookEvent.message.text);
        }
      } 
      // التعامل مع رسائل إنستغرام (عبر الـ Changes)
      else if (entry.changes && entry.changes[0]) {
        const change = entry.changes[0];
        if (change.field === "messages" && change.value.messages) {
          const senderId = change.value.messaging?.[0]?.sender?.id || change.value.sender?.id;
          const userText = change.value.messages[0]?.text?.body;

          if (senderId && userText) {
            console.log(`Instagram User message: ${userText}`);
            await handleAiResponse(senderId, userText);
          }
        }
      }
    }
  } else {
    res.sendStatus(404);
  }
});

// دالة توليد الرد من الذكاء الاصطناعي وإرساله
async function handleAiResponse(senderId, userText) {
  console.log(`User message: ${userText}`);

  try {
    const aiResponse = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'deepseek/deepseek-chat',
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

// دالة إرسال الرسالة (تعمل لنفس واجهة ميتا لإنستغرام وماسنجر)
async function sendMessage(recipientId, text) {
  const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
  try {
    await axios.post(url, {
      recipient: { id: recipientId },
      message: { text: text }
    });
    console.log("Message sent successfully!");
  } catch (error) {
    console.error("Send Error:", error.response?.data || error.message);
  }
}

app.get("/", (req, res) => {
  res.send("Yuki Bot (Messenger & Instagram) is live!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
