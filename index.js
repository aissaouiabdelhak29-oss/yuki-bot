const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(bodyParser.json());

// جلب المفاتيح من بيئة العمل بأمان تام (Render Environment Variables)
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = 'YUKI123';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// تهيئة عميل Gemini الجديد
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// 1. التحقق من الويب هوك (Webhook Verification) مطلوب من فيسبوك
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token === VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// 2. استقبال الرسائل الواردة من ميسنجر
app.post('/webhook', async (req, res) => {
    const body = req.body;

    if (body.object === 'page') {
        // الرد الفوري على فيسبوك لمنع تكرار إرسال الرسائل (السبام)
        res.status(200).send('EVENT_RECEIVED');

        for (const entry of body.entry) {
            if (entry.messaging && entry.messaging[0]) {
                const webhookEvent = entry.messaging[0];
                const senderPsid = webhookEvent.sender.id; // معرف المستخدم على ميسنجر

                // التحقق من أن الرسالة نصية وليست مجرد تفاعل أو إعجاب
                if (webhookEvent.message && webhookEvent.message.text) {
                    const userMessage = webhookEvent.message.text;
                    
                    // توليد الرد باستخدام Gemini
                    const botReply = await getGeminiResponse(userMessage);
                    
                    // إرسال الرد للمستخدم عبر ميسنجر
                    await callSendAPI(senderPsid, botReply);
                }
            }
        }
    } else {
        res.sendStatus(404);
    }
});

// دالة الاتصال بـ Gemini لتوليد الرد
async function getGeminiResponse(prompt) {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash', // النموذج المستقر والمعتمد
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error('Gemini Detailed Error:', error.response ? error.response.data : error.message);
        return 'عذراً، حدث خطأ تقني في معالجة طلبك.';
    }
}

// دالة إرسال الرسالة إلى واجهة Messenger API
async function callSendAPI(senderPsid, responseText) {
    const requestBody = {
        recipient: { id: senderPsid },
        message: { text: responseText }
    };

    try {
        await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, requestBody);
    } catch (error) {
        console.error('Messenger API Error:', error.response?.data || error.message);
    }
}

// تشغيل السيرفر على المنفذ المطلوب من Render تلقائياً
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
