import express from 'express';
import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors';
import Joi from 'joi';
import dayjs from 'dayjs';
import { stripHtml } from "string-strip-html";

dotenv.config();
const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;
const collections = { participants: 'participants', messages: 'messages' };

mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch(err => console.log(err.messsage));

const schemaMessage = Joi.object({
    to: Joi.string().required(),
    text: Joi.string().required(),
    type: Joi.string().valid("message", "private_message").required()
});

const schemaParticipant = Joi.object({
    name: Joi.string().required()
});

const app = express();
app.use(express.json());
app.use(cors());
const PORT = 5000;
app.listen(PORT, () => console.log(`Rodando servidor na porta ${PORT}`));

async function findUserByName(user) {
    const participant = await db.collection(collections.participants).findOne({ name: user });

    if (participant) {
        return participant
    } else {
        return null
    }
}

// async function disconectParticipants() {
//     const limitTime = Date.now() - 10000;

//     try {
//         const promises = [];
//         const excludedParticipants = await db.collection(collections.participants)
//             .find({ lastStatus: { $lt: limitTime } })
//             .toArray();

//         const promiseDelete = db.collection(collections.participants)
//             .deleteMany({ lastStatus: { $lt: limitTime } });
//         promises.push(promiseDelete);

//         excludedParticipants.forEach(participant => {
//             const promiseMsg = db.collection(collections.messages).insertOne({
//                 from: participant.name,
//                 to: 'Todos',
//                 text: 'sai da sala...',
//                 type: 'status',
//                 time: dayjs().format('HH:mm:ss')
//             });

//             promises.push(promiseMsg);
//         });

//         await Promise.all(promises);
//     } catch (error) {
//         res.status(500).send(error.message)
//     }
// }

// const timeBetweenChecks = 15000;
// const intervalId = setInterval(disconectParticipants, timeBetweenChecks);

app.get('/participants', (req, res) => {
    db.collection(collections.participants).find().toArray()
        .then(participants => res.send(participants))
        .catch(err => res.status(500).send(err.message))
});

app.post('/participants', async (req, res) => {
    let { name } = req.body;
    name = stripHtml(name.trim()).result;

    try {
        await schemaParticipant.validateAsync(req.body, { abortEarly: false });
    } catch (error) {
        return res.status(422).send({ message: error.details.map(detail => detail.message) })
    }

    try {
        if (await findUserByName(name)) return res.sendStatus(409);

        const newMessage = {
            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs().format('HH:mm:ss')
        }
        const promisseMessage = db.collection(collections.messages).insertOne(newMessage);

        const newParticipant = {
            name,
            lastStatus: Date.now()
        }
        const promisseParticipant = db.collection(collections.participants).insertOne(newParticipant);

        await Promise.all([promisseMessage, promisseParticipant])
    } catch (error) {
        res.status(500).send(error.message);
    }

    res.sendStatus(201);
});

app.post('/messages', async (req, res) => {
    let from = req.headers.user;
    from = stripHtml(from.trim()).result;

    try {
        if (!(await findUserByName(from))) return res.sendStatus(422);

        await schemaMessage.validateAsync(req.body, { abortEarly: false });
    } catch (error) {
        if (error.details) {
            return res.status(422).send(error.details[0].message);
        } else {
            return res.status(500).send(error.message);
        }
        
    }

    try {
        const newMessage = { 
            from, 
            to: req.body.to.trim(), 
            text: req.body.text.trim(),
            type: req.body.type.trim(),
            time: dayjs().format('HH:mm:ss') 
        }
        db.collection(collections.messages).insertOne(newMessage);
    } catch (error) {
        return res.status(500).send(error.message);
    }

    res.sendStatus(201);
});

app.get('/messages', async (req, res) => {
    const { user } = req.headers;
    const { limit } = req.query;

    if (limit && (!Number(limit) || Number(limit) < 1)) return res.sendStatus(422);
    if (!user || !(await findUserByName(user))) return res.sendStatus(404);

    try {
        let messages = await db.collection(collections.messages).find({
            $or: [
                { from: user },
                { to: user },
                { to: "Todos" },
                { type: "message" }
            ]
        }).toArray();

        if (limit && Number(limit) < messages.length) messages = messages.slice(-Number(limit));

        res.send(messages.reverse());
    } catch (error) {
        return res.status(500).send(error.message);
    }
});

app.post('/status', async (req, res) => {
    const { user } = req.headers;

    if (!user) return res.sendStatus(404);

    const newParticipant = {
        name: user,
        lastStatus: Date.now()
    };

    try {
        const result = await db.collection(collections.participants)
            .updateOne(
                { name: user },
                { $set: newParticipant }
            );

        if (result.matchedCount === 0) return res.sendStatus(404);

        res.sendStatus(200);
    } catch (error) {
        return res.status(500).send(error.message);
    }


});

app.delete('/messages/:id', async (req, res) => {
    let user = req.headers.user;
    user = stripHtml(user.trim()).result;
    const {id} = req.params;
    
    try {
        if (!(await findUserByName(user))) return res.sendStatus(422);

        const message = await db.collection(collections.messages)
            .findOne({_id: new ObjectId(id)});

        if (!message) return res.sendStatus(404);
        if (message.from !== user || message.type === 'status') return res.sendStatus(401);

        await db.collection(collections.messages)
            .deleteOne({_id: new ObjectId(id)})
    } catch (error) {
        return res.status(500).send(error.message);
    }

    res.sendStatus(202);
});
