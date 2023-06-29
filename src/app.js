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

const schema = Joi.object({
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
        await schema.validateAsync(req.body);
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
})
