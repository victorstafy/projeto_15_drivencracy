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

const choiceSchema = joi
  .object({
    title: joi.string().empty("").required(),
    pollId: joi.string().required(),
  });


server.post('/poll',async (req,res)=>{
  const poll=req.body;
  let expire_at;
  const validation = pollSchema.validate(req.body, {
      abortEarly: false,
  });

  try {

    if (validation.error) {
      return res.status(422).send(validation.error.details);
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
    return res.status(201).send({title:poll.title,
      expireAt:expire_at});

  } catch (error) {
    return res.status(500).send(error);
  }
});

server.get('/poll',async (req,res)=>{
  try{
      const poll_list= await db.collection("poll").find().toArray();
      return res.send(poll_list);
  }
  catch{
    return res.status(404).send('nenhuma pesquisa encontrada');
  } 
})

server.post('/choice',async (req,res)=>{
  const choice=req.body;
  const today = dayjs(new Date());

  const validation = choiceSchema.validate(req.body, {
      abortEarly: false,
  });

  try {

    if (validation.error) {
      return res.status(422).send(validation.error.details);
    }

    const poll=await db.collection("poll").findOne({_id:choice.pollId});
    const previos_title=await db.collection("choice").findOne({title:choice.title});

    if (!poll){
      res.sendStatus(404);
      return;
    }
    if (!previos_title){
      res.sendStatus(409);
      return;
    }
    if (poll.expireAt.isBefore(today)){
      res.sendStatus(403);
      return;
    }

    await db.collection("choice").insertOne({
      title: choice.title, pollId: choice.pollId, 
    })

    return res.status(201).send(choice.pollId);

  } catch (error) {
    return res.status(500).send(error);
  }
});

server.get('/poll/:id/choice',async (req,res)=>{
  const _id= req.params;
  try{
      const choice_list= await db.collection("choice").find().toArray();
      if (!choice_list){
        res.sendStatus(404);
        return;
      }
      else{
        res.send(choice_list);
        return;
      }
  }
  catch{
    return res.status(500);
  } 
})

server.listen(5000,function(){console.log('port '+'5000')});
// process.env.PORT