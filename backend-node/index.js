const express = require('express');
const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());


app.post('/webhooks/n8n', (req, res) => {
    console.log('Received webhook from n8n:', req.body);
    res.status(200).json({ message: 'Webhook received' });
});


app.post('/api/notifications/send', (req, res) => {
    const { userId, message } = req.body;
    console.log(`Sending notification to user ${userId}: ${message}`);
    res.status(200).json({ status: 'sent' });
});

app.listen(port, () => {
    console.log(`Node backend listening on port ${port}`);
});
