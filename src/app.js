import express from 'express';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config();
const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch(err => console.log(err.messsage));

const app = express();
const PORT = 5000;
app.listen(PORT, () => console.log(`Rodando servidor na porta ${PORT}`));

app.get('/', (req,res) => {
    db.collection('participants').find().toArray()
        .then(participants => res.send(participants))
        .catch(err => res.status(500).send(err.message))
})

app.get('/a', (req,res) => {
    
})
