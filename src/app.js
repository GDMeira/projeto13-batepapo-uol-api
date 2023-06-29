import express from 'express';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import cors from 'cors';
import Joi from 'joi';
import dayjs from 'dayjs';

dotenv.config();
const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch(err => console.log(err.messsage));

const schemaMessage = Joi.object({
    to: Joi.string().required(),
    text: Joi.string().required(),
    type: Joi.string().valid("message", "private_message")
});

const schemaParticipant = Joi.object({
    name: Joi.string().required()
});

const app = express();
app.use(express.json());
app.use(cors());
const PORT = 5000;
app.listen(PORT, () => console.log(`Rodando servidor na porta ${PORT}`));

app.get('/participants', (req,res) => {
    db.collection('participants').find().toArray()
        .then(participants => res.send(participants))
        .catch(err => res.status(500).send(err.message))
});

app.post('/participants', async (req,res) => {
    const {name} = req.body;

    try {
        await schemaParticipant.validateAsync(req.body);
    } catch (error) {
        return res.status(422).send({message: error.details[0].message})
    }

    try {
        const participant = await db.collection('participants').findOne({name});

        if (participant) return res.sendStatus(409);

        const newParticipant = {
                name,
                lastStatus: Date.now()
        }
        db.collection('participants').insertOne(newParticipant)
        const newMessage = { 
                from: name,
                to: 'Todos',
                text: 'entra na sala...',
                type: 'status',
                time: dayjs().format('HH:mm:ss')
        }
        db.collection('messages').insertOne(newMessage);
    } catch (error) {
        res.status(500).send(error.message);
    }

    res.sendStatus(201);
});

app.post('/messages', async (req,res) => {
    const from = req.headers.user;

    try {
        await schemaMessage.validateAsync(req.body);
        const senderIsAtParticipants = await db.collection('participants').findOne({name: from});

        if (!senderIsAtParticipants) return res.sendStatus(422);
    } catch (error) {
        return res.status(422).send(error.details[0].message);
    }

    try {
        const newMessage = {from, ...req.body, time: dayjs().format('HH:mm:ss')}
        db.collection('messages').insertOne(newMessage);
    } catch (error) {
        return res.status(500).send(error.message);
    }

    res.sendStatus(201);
});

app.get('/messages', async (req,res) => {
    const {user} = req.headers;
    const {limit} = req.query;

    if (!user || limit && (!Number(limit) || Number(limit) < 1)) return res.sendStatus(422);

    try {
        let messages = await db.collection('messages').find({
            $or: [
                {from: user},
                {to: user},
                {to: "Todos"},
                {type: "message"}
                ]
        }).toArray();

        if (limit && Number(limit) < messages.length) messages = messages.slice(-Number(limit));
        
        res.send(messages.reverse());
    } catch (error) {
        return res.status(500).send(error.message);
    }
});
