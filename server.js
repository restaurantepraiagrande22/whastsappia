import express from "express";
import bodyParser from "body-parser";
import OpenAI from "openai";

const app = express();
app.use(bodyParser.json());

// token que VOCÊ vai colocar no Render e na Meta
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// chave da OpenAI fica no Render
const client = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

// prompt do atendente
const SISTEMA_PROMPT = `
Você é o atendente virtual do Restaurante Praia Grande.
Responda como atendente simpático e educado, mensagens curtas e claras.
Se não souber algo, diga que vai verificar com a equipe.
Sempre responda em português do Brasil.
`;

// ROTA GET (usada pela Meta pra testar o webhook)
app.get("/webhook-whatsapp", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// ROTA POST (aqui chegam as mensagens dos clientes)
app.post("/webhook-whatsapp", async (req, res) => {
  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!msg || !msg.text || !msg.from) {
      return res.sendStatus(200);
    }

    const textoCliente = msg.text.body;
    const numero = msg.from;

    const openaiResponse = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: SISTEMA_PROMPT },
        { role: "user", content: textoCliente },
      ],
    });

    const resposta = openaiResponse.choices[0].message.content;

    // enviar resposta para o WhatsApp Cloud API
    await fetch(
      `https://graph.facebook.com/v17.0/${process.env.PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: numero,
          type: "text",
          text: { body: resposta },
        }),
      }
    );

    return res.sendStatus(200);
  } catch (err) {
    console.error("Erro:", err);
    return res.sendStatus(500);
  }
});

// iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Rodando na porta " + PORT));
