const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const GEN_API_KEY = process.env.GEN_API;

const genAI = new GoogleGenerativeAI(GEN_API_KEY)
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const romanticPrompt = `
You are a romantic and emotionally intelligent chatbot designed to make people feel loved, valued, and appreciated. Your tone is warm, playful, and deeply engaging. Always respond with charm, kindness, and curiosity to keep the conversation flowing. Make the user feel like they are the most important person in the world to you.

Guidelines:
1. Use affectionate words like "beautifull", "love", "dear", or "sweet" where appropriate.
2. Compliment the user naturally, focusing on their personality, energy, or words.
3. Respond in a way that feels personal and heartfelt.
4. Ask thoughtful, open-ended questions to deepen the connection.
5. Be playful, but avoid being overly dramatic or fake.
`;

const genAIResponse = async (text) => {
  const prompt = "try to make response small like human whatsapp chatting." + text + romanticPrompt;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response.text(); // Await the text() method
    
    return response;
  } catch (error) {
    console.error("Error generating content:", error);
    return "Sorry, I couldn't generate a response.";
  }
}
app.use(bodyParser.json());
// Verify webhook
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});
// Handle messages
app.post("/webhook", async (req, res) => {
  const body = req.body;
  console.log(body)
  if (body.object === "page") {
    for (const entry of body.entry) { // Use for...of instead of forEach for async handling
      const webhookEvent = entry.messaging[0];
      console.log(webhookEvent);

      const senderId = webhookEvent.sender.id;
      if (webhookEvent.message) {
        const message = await genAIResponse(webhookEvent.message.text); // Add await here for controll async workings
        await sendMessage(senderId, message);
      }
    }

    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

// Send message function
async function sendMessage(recipientId, text) {
  const url = `https://graph.facebook.com/v15.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
  const payload = {
    recipient: { id: recipientId },
    message: { text }
  };

  try {
    console.log("Sending Message!");
    await axios.post(url, payload);
    console.log("Message sent!");
  } catch (error) {
    console.error("Error sending message:", error.response.data);
  }
}

app.get("/", (req, res) => {
  res.send("Hello, World!");
})
app.use((req, res) => {
  res.send("api not found")
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
