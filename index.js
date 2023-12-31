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
const photoCollection = client.db("vigorVista").collection("gallery");
const profileCollection = client.db("vigorVista").collection("profile");
const beATrainerCollection = client.db("vigorVista").collection("beATrainer");
const classesCollection = client.db("vigorVista").collection("newClasses");
const forumCollection = client.db("vigorVista").collection("forum");
const paymentsCollection = client.db("vigorVista").collection("payments");
const paidMembersCollection = client.db("vigorVista").collection("paidMembers");

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

    // middlewares
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

    app.get("/users/member/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      // console.log(email);

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const result = await usersCollection.findOne(query);
      // console.log(result);
      res.send(result);
    });

    app.patch("/users/update/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      // console.log("patch Email", email);
      const userUpdates = req.body;

      // Ensure the user making the request matches the email in the URL
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      const query = { email: email };
      const options = { upsert: true };

      const updatedDoc = {
        $set: {
          name: userUpdates.name,
          photoURL: userUpdates.photoURL,
        },
      };

      console.log(updatedDoc);
      const updateResult = await usersCollection.updateOne(
        query,
        updatedDoc,
        options
      );
      res.send(updateResult);
    });

    app.patch("/users/updateStatus/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const options = { upsert: true };

      const updatedDoc = {
        $set: {
          status: "Trainer",
        },
      };

      console.log(updatedDoc);
      const updateResult = await usersCollection.updateOne(
        query,
        updatedDoc,
        options
      );
      res.send(updateResult);
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

    // paid member apis
    app.post("/paidMembers", verifyToken, async (req, res) => {
      const paidMember = req.body;
      const result = await paidMembersCollection.insertOne(paidMember);
      res.send(result);
    });

    app.get("/paidMembers", async (req, res) => {
      const result = await paidMembersCollection.find().toArray();
      res.send(result);
    });

    app.get("/paidMembers/:email", async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      // console.log(query);
      const result = await paidMembersCollection.find(query).toArray();
      // console.log(result);
      res.send(result);
    });

    // Be A Trainer API
    app.post("/beTrainer", async (req, res) => {
      const user = req.body;
      const result = await beATrainerCollection.insertOne(user);
      // console.log(result);
      res.send(result);
    });

    app.get("/beTrainer", async (req, res) => {
      const result = await beATrainerCollection.find().toArray();
      res.send(result);
    });

    app.get("/beTrainer/reject/:trainerId", async (req, res) => {
      const id = req.params.trainerId;
      // console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await beATrainerCollection.findOne(query);
      res.send(result);
    });

    app.put("/beTrainer/:id", async (req, res) => {
      const id = req.params.id;
      const user = req.body;
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };

      const updatedDoc = {
        $set: {
          age: user?.age,
          dayTime: user?.dayTime,
          description: user?.description,
          email: user?.email,
          experience: user?.experience,
          image: user?.image,
          joiningDate: user?.joiningDate,
          name: user?.name,
          skills: user?.skills,
          weekTime: user?.weekTime,
          status: req.body.status,
        },
      };

      const updateResult = await profileCollection.updateOne(
        query,
        updatedDoc,
        options
      );

      const deleteResult = await beATrainerCollection.deleteOne(query);
      console.log(updateResult);
      console.log(deleteResult);
      res.send({ updateResult, deleteResult });
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

    app.get("/trainers/train/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await profileCollection.findOne(query);
      res.send(user);
    });

    //class related api

    app.post("/classes", async (req, res) => {
      const user = req.body;
      const result = await classesCollection.insertOne(user);
      res.send(result);
    });

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

    // app.get("/classes/:duration", async (req, res) => {
    //   const duration = req.params.duration;
    //   const query = { duration: duration };
    //   const result = await classesCollection.find(query).toArray();
    //   res.send(result);
    // });

    // forum related apis
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

    app.post("/forums", verifyToken, async (req, res) => {
      const forum = req.body;
      const result = await forumCollection.insertOne(forum);
      res.send(result);
    });

    //gallery api
    app.get("/pictures", async (req, res) => {
      const result = await photoCollection.find().toArray();
      res.send(result);
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

    // Admin pay info API
    app.post("/payments", async (req, res) => {
      console.log("Get the response");
      const payment = req.body;
      const paymentResult = await paymentsCollection.insertOne(payment);
      res.send(paymentResult);
    });

    app.get("/payments", async (req, res) => {
      const paymentResult = await paymentsCollection.find().toArray();
      res.send(paymentResult);
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
