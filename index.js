const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 10000;

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "YUKI123";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GEN_API;

// تهيئة العميل بالمكتبة الرسمية المستقرة
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.use(bodyParser.json());

// التحقق من الويب هوك
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

// استقبال الرسائل والرد عليها
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
            const prompt = `Act as a warm, loving, and romantic companion. Make the reply short like WhatsApp chatting: ${userText}`;
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const replyText = response.text() || "أهلاً بك يا غالي";
            
            await sendMessage(senderId, replyText);
          } catch (err) {
            console.error("Gemini Error:", err.message);
            await sendMessage(senderId, "عذراً، حدث خطأ بسيط وسأعود للحديث معك حالاً.");
          }
        }
      }
    }
  } else {
    res.sendStatus(404);
  }
});

// إرسال الرسالة لفيسبوك
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
  res.send("Yuki Bot is live and running!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
