const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(bodyParser.json());

// قراءة المتغيرات البيئية بأمان
const PAGE_ACCESS_TOKEN = 'EAAPZA5LSy8NEBSO6usXyfFPGVi2EETZAy0NcPYBasgdkqvZB9YtITUG4qgszzhPZAG2YCKjtsvyDmckJ5wsFWZBtlMRLIap7LS4PaEUx7zvPsZANwPmiZC3R9dBwLLHi0DJMMrTR1bbZCNZBC4qjVWU1cgZBPYSu4Ofne1Qhr8T9hcaPny9f66vkj7T4shr2djsdIY9rGCoQZDZD';
const VERIFY_TOKEN = 'YUKI123';
const GEMINI_API_KEY = 'AQ.Ab8RN6IHX8v-9GCv8bff0Sn1KvN7cFAKob8Qd-CkPLyb4NuXfA';

// تهيئة عميل جيمناي الجديد
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// 1. مسار التحقق من الـ Webhook (GET) المطلوب من فيسبوك
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
});

// 2. مسار استقبال الرسائل من فيسبوك (POST)
app.post('/webhook', async (req, res) => {
    const body = req.body;

    if (body.object === 'page') {
        for (const entry of body.entry) {
            if (!entry.messaging) continue;
            
            const webhook_event = entry.messaging[0];
            const sender_psid = webhook_event.sender.id;

            // التحقق من وجود رسالة نصية واردة
            if (webhook_event.message && webhook_event.message.text) {
                const userMessage = webhook_event.message.text;
                console.log(`Received message from ${sender_psid}: ${userMessage}`);

                try {
                    // توليد الرد باستخدام نموذج جيمناي
                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: userMessage,
                    });

                    const botReply = response.text || "عذراً، لم أستطع توليد رد.";

                    // إرسال الرد إلى المستخدم عبر ميسنجر
                    await callSendAPI(sender_psid, botReply);
                } catch (error) {
                    console.error('Error generating AI response:', error);
                    await callSendAPI(sender_psid, "حدث خطأ أثناء معالجة رسالتك.");
                }
            }
        }
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

// دالة لإرسال الرسائل عبر مسنجر API
async function callSendAPI(sender_psid, responseText) {
    const request_body = {
        recipient: { id: sender_psid },
        message: { text: responseText }
    };

    try {
        await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, request_body);
        console.log('Message sent successfully to Messenger');
    } catch (error) {
        console.error('Unable to send message:', error.response?.data || error.message);
    }
}

// تشغيل السيرفر على المنفذ المخصص من Render أو 10000 محلياً
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
