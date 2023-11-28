const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const verifyToken = (req, res, next) => {
  // console.log('inside verify token', req.headers.authorization);
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qfcfzds.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const usersCollection = client.db("vigorVista").collection("users");
const subscribedCollection = client.db("vigorVista").collection("subscribe");
const profileCollection = client.db("vigorVista").collection("profile");
const beATrainerCollection = client.db("vigorVista").collection("beATrainer");
const classesCollection = client.db("vigorVista").collection("classes");
const forumCollection = client.db("vigorVista").collection("forum");

async function run() {
  try {
    // await client.connect();

    //jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1d",
      });

      res.send(token);
    });

    // users related api
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({
          message: "User is already present",
          insertedId: null,
        });
      }
      const result = await usersCollection.insertOne(user);

      res.send(result);
    });

    // subscription related api
    app.post("/subscribe", async (req, res) => {
      const user = req.body;
      //checking existing users
      const query = { email: user.email };
      const existingUser = await subscribedCollection.findOne(query);
      if (existingUser) {
        return res.send({
          message: "You have already subscribed",
          insertedId: null,
        });
      }
      const result = await subscribedCollection.insertOne(user);
      res.send(result);
    });

    app.get("/subscribe", async (req, res) => {
      const result = await subscribedCollection.find().toArray();
      res.send(result);
    });

    // Be A Trainer API
    app.post("/beTrainer", async (req, res) => {
      const user = req.body;
      const result = await beATrainerCollection.insertOne(user);

      console.log(result);
      res.send(result);
    });

    app.get("/beTrainer", async (req, res) => {
      const result = await beATrainerCollection.find().toArray();
      res.send(result);
    });

    app.put("/beTrainer/:id", async (req, res) => {
      console.log("Received PUT request");
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };

      const updatedDoc = {
        status: req.body.status,
      };

      const updateResult = await beATrainerCollection.updateOne(
        query,
        {
          $set: { updatedDoc },
        },
        options
      );
      console.log(updateResult);
      res.send(updateResult);
    });

    // profile/trainer related api

    app.get("/trainers", async (req, res) => {
      const result = await profileCollection.find().toArray();
      res.send(result);
    });

    app.get("/trainers/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await profileCollection.findOne(query);
      res.send(result);
    });

    // payment
    app.put("/trainers/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        const payment = {
          status: req.body.status,
          price: req.body.price,
        };

        const options = { upsert: true };

        const updateResult = await profileCollection.updateOne(
          query,
          {
            $set: { payment },
          },
          options
        );

        console.log("Server response:", updateResult);

        if (updateResult.modifiedCount > 0) {
          // Successfully updated the payment status
          res.sendStatus(200);
        } else {
          res.status(404).send("Trainer not found");
        }
      } catch (error) {
        console.error("Error updating payment status:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    //class related api
    app.get("/classes", async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    app.get("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classesCollection.findOne(query);
      res.send(result);
    });

    // forum related api
    app.get("/forums", async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);

      const count = await forumCollection.estimatedDocumentCount();
      const result = await forumCollection
        .find()
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send({ count, result });
    });

    // Update the up votes count in the database for the given postId
    app.patch("/forums/:postId/upVote", async (req, res) => {
      const postId = req.params.postId;
      const email = req.body.email;
      const query = { _id: new ObjectId(postId) };

      const post = await forumCollection.findOne(query);

      if (post.upVotedBy?.includes(email)) {
        return res
          .status(400)
          .json({ error: "You have already voted this post." });
      }

      const updatedPost = await forumCollection.findOneAndUpdate(
        { _id: new ObjectId(postId) },
        { $inc: { upVote: 1 }, $push: { upVotedBy: email } }, // Increment the up votes count
        { new: true } // Return the updated document
      );

      res.json(updatedPost);
    });

    // Update the down votes count in the database for the given postId
    app.patch("/forums/:postId/downVote", async (req, res) => {
      const postId = req.params.postId;
      const email = req.body.email;
      console.log(email);
      const query = { _id: new ObjectId(postId) };

      const post = await forumCollection.findOne(query);

      if (post.downVotedBy?.includes(email)) {
        return res
          .status(400)
          .json({ error: "You have already voted this post." });
      }

      const updatedPost = await forumCollection.findOneAndUpdate(
        { _id: new ObjectId(postId) },
        { $inc: { downVote: -1 }, $push: { downVotedBy: email } }, // decrement the down votes count
        { new: true } // Return the updated document
      );

      res.json(updatedPost);
    });

    // payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Vigor Vista is exercising.");
});

app.listen(port, () => {
  console.log(`Vigor is refreshing on port ${port}`);
});
