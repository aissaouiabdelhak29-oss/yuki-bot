const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = 'YUKI123';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // ضع مفتاح ChatGPT في متغيرات البيئة

// 1. التحقق من الويب هوك (Webhook Verification)
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
        res.status(200).send('EVENT_RECEIVED');

        for (const entry of body.entry) {
            if (entry.messaging && entry.messaging[0]) {
                const webhookEvent = entry.messaging[0];
                const senderPsid = webhookEvent.sender.id;

                if (webhookEvent.message && webhookEvent.message.text) {
                    const userMessage = webhookEvent.message.text;
                    
                    // توليد الرد باستخدام ChatGPT
                    const botReply = await getOpenAIResponse(userMessage);
                    await callSendAPI(senderPsid, botReply);
                }
            }
        }
    } else {
        res.sendStatus(404);
    }
});

// دالة الاتصال بـ ChatGPT لتوليد الرد
async function getOpenAIResponse(prompt) {
    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o-mini', // أو gpt-3.5-turbo
                messages: [{ role: 'user', content: prompt }]
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data.choices[0].message.content.trim();
    } catch (error) {
        console.error('OpenAI Error:', error.response?.data || error.message);
        return 'عذراً، حدث خطأ تقني في معالجة طلبك عبر ChatGPT.';
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

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
