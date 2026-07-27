const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 10000;

// المتغيرات الأساسية
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "YUKI123";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN; // توكن ماسنجر
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;     // توكن إنستغرام الجديد
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY; // مفتاح الذكاء الاصطناعي

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

// 2. استقبال الرسائل من ماسنجر أو إنستغرام (POST)
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object === "page" || body.object === "instagram") {
    res.status(200).send("EVENT_RECEIVED");

    for (const entry of body.entry) {
      let messagingEvents = entry.messaging || [];
      
      if (!messagingEvents.length && entry.changes) {
        for (const change of entry.changes) {
          if (change.field === "messages" && change.value) {
            messagingEvents.push(change.value);
          }
        }
      }

      for (const webhookEvent of messagingEvents) {
        const senderId = webhookEvent.sender?.id || webhookEvent.from?.id;
        const userText = webhookEvent.message?.text || webhookEvent.text;

        if (senderId && userText) {
          console.log(`Message from [${body.object}]: ${userText}`);
          await handleAiResponse(senderId, userText, body.object);
        }
      }
    }
  } else {
    res.sendStatus(404);
  }
});

// دالة توليد الرد من الذكاء الاصطناعي (OpenRouter)
async function handleAiResponse(senderId, userText, platform) {
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
    await sendMessage(senderId, replyText, platform);

  } catch (err) {
    console.error("OpenRouter Error:", err.response?.data || err.message);
  }
}

// دالة إرسال الرد وتوزيع التوكنات حسب المنصة
async function sendMessage(recipientId, text, platform) {
  let url = '';

  if (platform === 'instagram' && IG_ACCESS_TOKEN) {
    // إرسال لإنستغرام باستخدام توكن إنستغرام الخاص ومسار me/messages
    url = `https://graph.facebook.com/v18.0/me/messages?access_token=${IG_ACCESS_TOKEN}`;
  } else {
    // إرسال لماسنجر باستخدام توكن الفيسبوك
    url = `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
  }

  try {
    await axios.post(url, {
      recipient: { id: recipientId },
      message: { text: text }
    });
    console.log(`Message sent to [${platform}] successfully!`);
  } catch (error) {
    console.error("Meta Send Error:", error.response?.data || error.message);
  }
}

app.get("/", (req, res) => {
  res.send("Yuki Bot is live!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
