import express, { application } from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import { ObjectId } from "mongodb";
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
    console.log(choice.pollId)
    const poll=await db.collection("poll").findOne({ _id: new ObjectId(choice.pollId) });
    const previos_title=await db.collection("choice").findOne({title:choice.title});

    if (!poll){
      res.sendStatus(404);
      return;
    }
    if (previos_title){
      res.sendStatus(409);
      return;
    }

    if (dayjs().isAfter(dayjs(poll.expireAt))){
      res.sendStatus(403);
      return;
    }

    const choice_obj=await db.collection("choice").insertOne({
      title: choice.title, pollId: choice.pollId, 
    })

    return res.status(201).send({ _id: choice_obj.insertedId,title:choice.title,pollId: choice.pollId});

  } catch (error) {
    return res.status(500).send(error);
  }
});

server.get('/poll/:id/choice',async (req,res)=>{
  const _id= req.params;
  
  try{
      const choice_list= await db.collection("choice").find({pollId: _id.id.slice(1)}).toArray();
      if (choice_list.length===0){
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

server.post('/choice/:id/vote',async (req,res)=>{
  const choiceId= req.params;

  try {
//
    const choice=await db.collection("choice").findOne({_id:new ObjectId(choiceId.id.slice(1))});
    
    if (!choice){
      res.sendStatus(404);
      return;
    }

    const poll=await db.collection("poll").findOne({_id:new ObjectId(choice.pollId)});
    if (dayjs().isAfter(dayjs(poll.expireAt))){
      res.sendStatus(403);
      return;
    }
    await db.collection("vote").insertOne({
      choiceId: choice._id, choiceTitle:choice.title, pollId: choice.pollId, vote: 1, 
      date:dayjs().format('YYYY/MM/DD HH:mm')
    })
    return res.status(201).send('Voto computado com sucesso!');

  } catch (error) {
    console.log(error)
    return res.status(500).send(error);
  }
});

server.get('/poll/:id/result',async (req,res)=>{
  const pollId= req.params;
  let vote_list=[];
  let vote_per_choice;

  console.log(pollId.id.slice(1))
  try{
    const poll=await db.collection("poll").findOne({_id: ObjectId(pollId.id.slice(1))});
    console.log(poll)
    if (!poll){
      res.sendStatus(404);
      return;
    }

    const choice_list= await db.collection("choice").find({pollId: pollId.id.slice(1)}).toArray();
    const id_choice_list=choice_list.map(choice=>choice._id);
    for (let i=0;i<id_choice_list.length;i++) {
      vote_per_choice= await db.collection("vote").find({choiceId: ObjectId(id_choice_list[i]) }).toArray();
      console.log(vote_per_choice)
      vote_list.push(vote_per_choice)
    }
    const votes_count=vote_list.map(vote_list_per_choice=>vote_list_per_choice.length);
    const max_votes=Math.max(...votes_count);
    const max_votes_index=votes_count.indexOf(max_votes);
    const chosen_choice= choice_list[max_votes_index].title;

    const new_poll_obj={...poll};
    new_poll_obj.result={
      title: chosen_choice,
      votes: max_votes
    }
    return res.send(new_poll_obj);

  }
  catch (error) {
    return res.status(500);
  } 
})

server.listen(5000,function(){console.log('port '+'5000')});
// process.env.PORT