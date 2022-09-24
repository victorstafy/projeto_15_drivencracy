import express, { application } from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import { v4 as uuid } from "uuid";
import dayjs from "dayjs";
import joi from "joi";

dotenv.config();

// express.json()
const server=express();
server.use(express.json());
server.use(cors());

// calling mongo
const mongoClient= new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect(()=>{
    db=mongoClient.db('drivencracy')
})

const pollSchema = joi
  .object({
    title: joi.string().empty("").required(),
    expireAt: joi.string().empty(""),
  });


server.post('/poll',async (req,res)=>{
  const poll=req.body;
  let expire_at;
  const validation = pollSchema.validate(req.body, {
      abortEarly: false,
  });

  try {

    if (validation.error) {
      res.status(422).send(validation.error.details);
      return;
    }
    if (poll.expireAt.length===0){
      expire_at=dayjs().add(30,'day').format('YYYY/MM/DD HH:mm');
    } 
    else{
      expire_at=poll.expireAt.slice();
    }

    await db.collection("poll").insertOne({
      title:poll.title,
      expireAt: expire_at,      
      })
    res.status(201).send({title:poll.title,
      expireAt:expire_at});

  } catch (error) {
    res.status(500).send(error);
  }
});

server.get('/poll',async (req,res)=>{
  try{
      const poll_list= await db.collection("poll").find().toArray();
      res.send(poll_list);
  }
  catch{
      res.status(404).send('nenhuma pesquisa encontrada');
  } 
})

server.listen(process.env.PORT,function(){console.log('port '+process.env.PORT)});
// process.env.PORT