const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

const PAGE_ACCESS_TOKEN = 'EAAPZA5LSy8NEBSO6usXyfFPGVi2EETZAy0NcPYBasgdkqvZB9YtITUG4qgszzhPZAG2YCKjtsvyDmckJ5wsFWZBtlMRLIap7LS4PaEUx7zvPsZANwPmiZC3R9dBwLLHi0DJMMrTR1bbZCNZBC4qjVWU1cgZBPYSu4Ofne1Qhr8T9hcaPny9f66vkj7T4shr2djsdIY9rGCoQZDZD';
const VERIFY_TOKEN = 'YUKI123';
const GEMINI_API_KEY = 'AQ.Ab8RN6J1Otbq7pOk1N-oG0TfS9osoEOiBAUKxjrOoQnQE4JI6A';

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

app.post('/webhook', async (req, res) => {
    const body = req.body;

    if (body.object === 'page') {
        for (const entry of body.entry) {
            if (!entry.messaging) continue;
            
            const webhook_event = entry.messaging[0];
            const sender_psid = webhook_event.sender.id;

            if (webhook_event.message && webhook_event.message.text) {
                const userMessage = webhook_event.message.text;
                console.log(`Received message from ${sender_psid}: ${userMessage}`);

                try {
                    // استخدام واجهة الـ API الرسمية مباشرة بدون أي حزم معقدة
                    const geminiResponse = await axios.post(
                        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                        {
                            contents: [{ parts: [{ text: userMessage }] }]
                        }
                    );

                    const botReply = geminiResponse.data.candidates[0].content.parts[0].text || "عذراً، لم أستطع توليد رد.";
                    await callSendAPI(sender_psid, botReply);
                } catch (error) {
                    console.error('Error generating AI response:', error.response?.data || error.message);
                    await callSendAPI(sender_psid, "عذراً، حدث خطأ في معالجة الذكاء الاصطناعي.");
                }
            }
        }
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

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

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
