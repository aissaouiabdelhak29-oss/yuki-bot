const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(bodyParser.json());

// ============================================================
// المتغيرات البيئية
// ============================================================
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PORT = process.env.PORT || 3000;

// ============================================================
// إعداد Gemini
// ============================================================
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// ============================================================
// تخزين سجل المحادثات لكل مستخدم
// ============================================================
const userSessions = {};

// ============================================================
// GET /webhook → التحقق من الويب هوك
// ============================================================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified successfully");
    res.status(200).send(challenge);
  } else {
    console.error("❌ Webhook verification failed");
    res.sendStatus(403);
  }
});

// ============================================================
// POST /webhook → استقبال الرسائل
// ============================================================
app.post("/webhook", (req, res) => {
  // الرد الفوري لفيسبوك لمنع السبام
  res.status(200).send("EVENT_RECEIVED");

  const body = req.body;

  if (body.object !== "page") return;

  body.entry?.forEach((entry) => {
    entry.messaging?.forEach((event) => {
      if (event.message && event.message.text) {
        handleMessage(event);
      }
    });
  });
});

// ============================================================
// معالجة الرسالة الواردة
// ============================================================
async function handleMessage(event) {
  const senderId = event.sender.id;
  const userMessage = event.message.text.trim();

  console.log(`📩 رسالة من ${senderId}: ${userMessage}`);

  try {
    // إرسال حالة "جاري الكتابة..."
    await sendTypingOn(senderId);

    // الحصول على رد Gemini
    const reply = await getGeminiReply(senderId, userMessage);

    // إرسال الرد للمستخدم
    await sendMessage(senderId, reply);
  } catch (error) {
    console.error("❌ خطأ في معالجة الرسالة:", error.message);
    await sendMessage(senderId, "عذراً، حدث خطأ. حاول مرة أخرى. 🙏");
  }
}

// ============================================================
// الحصول على رد من Gemini مع سجل المحادثة
// ============================================================
async function getGeminiReply(senderId, userMessage) {
  // إنشاء جلسة جديدة للمستخدم إن لم تكن موجودة
  if (!userSessions[senderId]) {
    userSessions[senderId] = model.startChat({
      history: [],
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.9,
      },
      systemInstruction: `
        أنت مساعد ذكي ومفيد.
        - تتحدث العربية والإنجليزية بطلاقة.
        - ترد بنفس لغة المستخدم تلقائياً.
        - ردودك واضحة ومختصرة ومفيدة.
        - أسلوبك ودود واحترافي.
      `,
    });
  }

  const chat = userSessions[senderId];
  const result = await chat.sendMessage(userMessage);
  const response = result.response.text();

  return response;
}

// ============================================================
// إرسال رسالة للمستخدم عبر Messenger
// ============================================================
async function sendMessage(recipientId, text) {
  // تقسيم الرسالة إذا تجاوزت حد فيسبوك (2000 حرف)
  const chunks = splitMessage(text, 2000);

  for (const chunk of chunks) {
    await axios.post(
      `https://graph.facebook.com/v19.0/me/messages`,
      {
        recipient: { id: recipientId },
        message: { text: chunk },
        messaging_type: "RESPONSE",
      },
      {
        params: { access_token: PAGE_ACCESS_TOKEN },
      }
    );
  }
}

// ============================================================
// إرسال حالة "جاري الكتابة..."
// ============================================================
async function sendTypingOn(recipientId) {
  await axios.post(
    `https://graph.facebook.com/v19.0/me/messages`,
    {
      recipient: { id: recipientId },
      sender_action: "typing_on",
    },
    {
      params: { access_token: PAGE_ACCESS_TOKEN },
    }
  );
}

// ============================================================
// تقسيم الرسائل الطويلة
// ============================================================
function splitMessage(text, maxLength) {
  const chunks = [];
  while (text.length > maxLength) {
    let chunk = text.substring(0, maxLength);
    const lastSpace = chunk.lastIndexOf(" ");
    if (lastSpace > 0) chunk = chunk.substring(0, lastSpace);
    chunks.push(chunk);
    text = text.substring(chunk.length).trim();
  }
  if (text.length > 0) chunks.push(text);
  return chunks;
}

// ============================================================
// تشغيل السيرفر
// ============================================================
app.listen(PORT, () => {
  console.log(`🚀 البوت يعمل على البورت ${PORT}`);
});
